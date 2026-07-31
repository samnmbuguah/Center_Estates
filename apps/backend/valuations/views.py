from django.db import transaction
from django.db.models import Count,Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet,ViewSet
from core.models import Module
from core.permissions import HasModuleSubscription
from core.tenancy import get_active_organization
from .models import ComparableEvidence,DraftValuationReport,FinalValuationReport,ValuationAuditEvent,ValuationClient,ValuationInspection,ValuationInstruction,ValuationInvoice,ValuationPayment
from .serializers import AuditEventSerializer,ClientSerializer,ComparableSerializer,DraftSerializer,FinalSerializer,InspectionSerializer,InstructionSerializer,InvoiceSerializer,PaymentSerializer

class Scoped(ModelViewSet):
 permission_classes=(HasModuleSubscription,); required_module=Module.VALUATION; search_fields=()
 def get_queryset(self):
  q=self.queryset.for_organization(get_active_organization(self.request)); s=self.request.query_params.get('search','').strip()
  if s:
   from django.db.models import Q
   x=Q()
   for f in self.search_fields:x|=Q(**{f'{f}__icontains':s})
   q=q.filter(x)
  return q
 def _org(self,serializer):
  org=get_active_organization(self.request)
  for name,value in serializer.validated_data.items():
   if getattr(value,'organization_id',org.id)!=org.id: raise ValidationError({name:'The selected record belongs to another organization.'})
  return org
 def perform_create(self,s):s.save(organization=self._org(s))
 def perform_update(self,s):self._org(s);s.save()
class ClientViewSet(Scoped):queryset=ValuationClient.objects.all();serializer_class=ClientSerializer;search_fields=('code','name','contact_name','email')
class InstructionViewSet(Scoped):
 queryset=ValuationInstruction.objects.select_related('client','property','valuer');serializer_class=InstructionSerializer;search_fields=('reference','client__name','property_description','purpose','valuation_type')
 def perform_create(self,s):
  org=self._org(s); instruction=s.save(organization=org,status=ValuationInstruction.Status.NEW)
  ValuationAuditEvent.objects.create(organization=org,instruction=instruction,event_type='created',to_status=instruction.status,actor=self.request.user)
 def perform_update(self,s):
  if 'status' in s.validated_data and s.validated_data['status']!=self.get_object().status: raise ValidationError({'status':'Use the transition action so evidence and audit controls are applied.'})
  super().perform_update(s)
 @action(detail=True,methods=('post',))
 @transaction.atomic
 def transition(self,request,pk=None):
  org=get_active_organization(request); instruction=ValuationInstruction.objects.select_for_update().filter(pk=pk,organization=org).first()
  if not instruction:return Response({'detail':'Instruction not found.'},status=404)
  target=str(request.data.get('status','')).strip(); previous=instruction.status
  allowed={ValuationInstruction.Status.NEW:{ValuationInstruction.Status.ASSIGNED,ValuationInstruction.Status.CANCELLED},ValuationInstruction.Status.ASSIGNED:{ValuationInstruction.Status.INSPECTION,ValuationInstruction.Status.CANCELLED},ValuationInstruction.Status.INSPECTION:{ValuationInstruction.Status.DRAFTING,ValuationInstruction.Status.CANCELLED},ValuationInstruction.Status.DRAFTING:{ValuationInstruction.Status.REVIEW,ValuationInstruction.Status.CANCELLED}}
  if target not in allowed.get(previous,set()):raise ValidationError({'status':f'Cannot transition from {previous} to {target or "blank"}.'})
  notes=str(request.data.get('notes','')).strip()
  if target==ValuationInstruction.Status.CANCELLED and not notes:raise ValidationError({'notes':'A cancellation reason is required.'})
  if target==ValuationInstruction.Status.INSPECTION and not instruction.inspections.exists():raise ValidationError({'inspection':'Schedule an inspection before starting fieldwork.'})
  if target==ValuationInstruction.Status.DRAFTING and not instruction.inspections.filter(status=ValuationInspection.Status.COMPLETED,evidence_count__gt=0).exists():raise ValidationError({'inspection':'A completed inspection with evidence is required before drafting.'})
  if target==ValuationInstruction.Status.REVIEW and not instruction.draft_reports.filter(status=DraftValuationReport.Status.REVIEW).exists():raise ValidationError({'draft':'Submit a draft report for review first.'})
  instruction.status=target;instruction.save(update_fields=('status','updated_at'))
  ValuationAuditEvent.objects.create(organization=org,instruction=instruction,event_type='status_transition',from_status=previous,to_status=target,notes=notes,actor=request.user)
  return Response(InstructionSerializer(instruction).data)
class InspectionViewSet(Scoped):queryset=ValuationInspection.objects.select_related('instruction','inspector');serializer_class=InspectionSerializer;search_fields=('reference','instruction__reference','instruction__property_description','findings')
class ComparableViewSet(Scoped):queryset=ComparableEvidence.objects.select_related('instruction');serializer_class=ComparableSerializer;search_fields=('reference','address','property_type','source')
class DraftViewSet(Scoped):
 queryset=DraftValuationReport.objects.select_related('instruction','prepared_by','reviewer');serializer_class=DraftSerializer;search_fields=('instruction__reference','instruction__property_description','valuation_method','template')
 def perform_create(self,s):s.save(organization=self._org(s),prepared_by=self.request.user,status=DraftValuationReport.Status.DRAFT)
 def perform_update(self,s):
  if 'status' in s.validated_data and s.validated_data['status']!=self.get_object().status:raise ValidationError({'status':'Use report review actions.'})
  super().perform_update(s)
 @action(detail=True,methods=('post',),url_path='submit-review')
 def submit_review(self,request,pk=None):
  draft=self.get_object()
  if draft.status not in (DraftValuationReport.Status.DRAFT,DraftValuationReport.Status.CHANGES):raise ValidationError({'status':'Only a draft or changes-required report can enter review.'})
  if not draft.reviewer_id:raise ValidationError({'reviewer':'Assign a reviewer before submission.'})
  previous=draft.status;draft.status=DraftValuationReport.Status.REVIEW;draft.save(update_fields=('status','updated_at'))
  ValuationAuditEvent.objects.create(organization=draft.organization,instruction=draft.instruction,event_type='draft_submitted',from_status=previous,to_status=draft.status,details={'version':draft.version},actor=request.user)
  return Response(DraftSerializer(draft).data)
 @action(detail=True,methods=('post',))
 def approve(self,request,pk=None):
  draft=self.get_object()
  if draft.status!=DraftValuationReport.Status.REVIEW:raise ValidationError({'status':'Only a report in review can be approved.'})
  if draft.reviewer_id!=request.user.id:raise ValidationError({'reviewer':'Only the assigned reviewer can approve this report.'})
  draft.status=DraftValuationReport.Status.APPROVED;draft.review_notes=str(request.data.get('notes','')).strip();draft.save(update_fields=('status','review_notes','updated_at'))
  ValuationAuditEvent.objects.create(organization=draft.organization,instruction=draft.instruction,event_type='draft_approved',from_status='review',to_status='approved',details={'version':draft.version},notes=draft.review_notes,actor=request.user)
  return Response(DraftSerializer(draft).data)
class FinalViewSet(Scoped):
 queryset=FinalValuationReport.objects.select_related('instruction__client','draft','signed_by');serializer_class=FinalSerializer;search_fields=('report_number','instruction__reference','instruction__property_description','instruction__client__name')
 @transaction.atomic
 def perform_create(self,s):
  org=self._org(s); draft=s.validated_data['draft']; instruction=ValuationInstruction.objects.select_for_update().get(pk=s.validated_data['instruction'].pk)
  if draft.instruction_id!=instruction.id:raise ValidationError({'draft':'The approved draft must belong to this instruction.'})
  if draft.status!=DraftValuationReport.Status.APPROVED:raise ValidationError({'draft':'Only an approved draft can become a final report.'})
  report=s.save(organization=org,signed_by=self.request.user,market_value=draft.market_value)
  previous=instruction.status;instruction.status=ValuationInstruction.Status.FINAL;instruction.save(update_fields=('status','updated_at'))
  ValuationAuditEvent.objects.create(organization=org,instruction=instruction,event_type='final_report_issued',from_status=previous,to_status=instruction.status,details={'report_number':report.report_number,'checksum':report.checksum},actor=self.request.user)
 def perform_update(self,s):raise ValidationError({'report':'Final reports are immutable; record delivery through the delivery action.'})
 def perform_destroy(self,instance):raise ValidationError({'report':'Final reports are immutable.'})
 @action(detail=True,methods=('post',))
 @transaction.atomic
 def deliver(self,request,pk=None):
  report=FinalValuationReport.objects.select_for_update().select_related('instruction').filter(pk=pk,organization=get_active_organization(request)).first()
  method=str(request.data.get('delivery_method','')).strip()
  if not report:return Response({'detail':'Final report not found.'},status=404)
  if report.delivered_at:raise ValidationError({'report':'Delivery has already been recorded.'})
  if not method:raise ValidationError({'delivery_method':'Delivery method is required.'})
  report.delivered_at=timezone.now();report.delivery_method=method;report.save(update_fields=('delivered_at','delivery_method','updated_at'))
  report.instruction.status=ValuationInstruction.Status.DELIVERED;report.instruction.save(update_fields=('status','updated_at'))
  ValuationAuditEvent.objects.create(organization=report.organization,instruction=report.instruction,event_type='delivered',from_status='final',to_status='delivered',details={'delivery_method':method},actor=request.user)
  return Response(FinalSerializer(report).data)
class InvoiceViewSet(Scoped):queryset=ValuationInvoice.objects.select_related('instruction__client');serializer_class=InvoiceSerializer;search_fields=('number','instruction__reference','instruction__client__name')
class PaymentViewSet(Scoped):
 queryset=ValuationPayment.objects.select_related('invoice__instruction__client');serializer_class=PaymentSerializer;search_fields=('reference','external_reference','invoice__number')
 @transaction.atomic
 def perform_create(self,s):
  org=self._org(s); invoice=ValuationInvoice.objects.select_for_update().get(pk=s.validated_data['invoice'].pk)
  amount=s.validated_data['amount']
  if invoice.status in (ValuationInvoice.Status.DRAFT,ValuationInvoice.Status.VOID):raise ValidationError({'invoice':'Payments can only be allocated to an issued invoice.'})
  if amount<=0 or amount>invoice.balance:raise ValidationError({'amount':'Payment must be positive and cannot exceed the invoice balance.'})
  payment=s.save(organization=org,received_by=self.request.user)
  invoice.balance-=amount;invoice.status=ValuationInvoice.Status.PAID if invoice.balance==0 else ValuationInvoice.Status.PARTIAL;invoice.save(update_fields=('balance','status','updated_at'))
  ValuationAuditEvent.objects.create(organization=org,instruction=invoice.instruction,event_type='payment_allocated',details={'payment_reference':payment.reference,'invoice':invoice.number,'amount':str(amount)},actor=self.request.user)
 def perform_update(self,s):raise ValidationError({'payment':'Payment records are immutable.'})
 def perform_destroy(self,instance):raise ValidationError({'payment':'Payment records are immutable.'})
class AuditEventViewSet(Scoped):
 queryset=ValuationAuditEvent.objects.select_related('instruction','actor');serializer_class=AuditEventSerializer;http_method_names=('get','head','options');search_fields=('instruction__reference','event_type','notes')
class DashboardViewSet(ViewSet):
 permission_classes=(HasModuleSubscription,);required_module=Module.VALUATION
 def list(self,request):
  org=get_active_organization(request);today=timezone.localdate();ins=ValuationInstruction.objects.for_organization(org);inv=ValuationInvoice.objects.for_organization(org);pay=ValuationPayment.objects.for_organization(org)
  active=ins.exclude(status__in=(ValuationInstruction.Status.DELIVERED,ValuationInstruction.Status.CANCELLED))
  return Response({'kpis':{'activeInstructions':active.count(),'dueThisWeek':active.filter(due_on__lte=today+timezone.timedelta(days=7)).count(),'inspectionsPending':ValuationInspection.objects.for_organization(org).exclude(status=ValuationInspection.Status.COMPLETED).count(),'draftsInReview':DraftValuationReport.objects.for_organization(org).filter(status=DraftValuationReport.Status.REVIEW).count(),'finalReports':FinalValuationReport.objects.for_organization(org).count(),'revenue':pay.aggregate(v=Sum('amount'))['v'] or 0,'outstanding':inv.exclude(status__in=(ValuationInvoice.Status.PAID,ValuationInvoice.Status.VOID)).aggregate(v=Sum('balance'))['v'] or 0},'recentInstructions':InstructionSerializer(ins[:6],many=True).data,'upcomingInspections':InspectionSerializer(ValuationInspection.objects.for_organization(org).exclude(status=ValuationInspection.Status.COMPLETED)[:5],many=True).data,'pipeline':list(ins.values('status').annotate(count=Count('id')).order_by('status')),'valuationMix':list(ins.values('valuation_type').annotate(count=Count('id')).order_by('-count'))})
