import csv
from decimal import Decimal

from django.db import transaction
from django.db.models import Avg,Count,Q,Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet,ViewSet
from core.models import Module
from core.permissions import HasModuleActionPermission
from core.tenancy import get_active_organization
from core.property_scope import scope_model_queryset, scope_queryset_to_property
from .models import ComparableEvidence,DraftValuationReport,FinalValuationReport,ValuationAuditEvent,ValuationClient,ValuationInspection,ValuationInstruction,ValuationInvoice,ValuationPayment
from .serializers import AuditEventSerializer,ClientSerializer,ComparableSerializer,DraftSerializer,FinalSerializer,InspectionSerializer,InstructionSerializer,InvoiceSerializer,PaymentSerializer

class Scoped(ModelViewSet):
 permission_classes=(HasModuleActionPermission,); required_module=Module.VALUATION; search_fields=()
 def get_queryset(self):
  org=get_active_organization(self.request);q=scope_queryset_to_property(self.queryset.for_organization(org),self.request,org); s=self.request.query_params.get('search','').strip()
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
class ClientViewSet(Scoped):
 write_permission='valuation.coordinate';queryset=ValuationClient.objects.all();serializer_class=ClientSerializer;search_fields=('code','name','contact_name','email')
class InstructionViewSet(Scoped):
 write_permission='valuation.coordinate'
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
class InspectionViewSet(Scoped):
 write_permission='valuation.field'
 queryset=ValuationInspection.objects.select_related('instruction','inspector');serializer_class=InspectionSerializer;search_fields=('reference','instruction__reference','instruction__property_description','findings')
 def perform_create(self,s):s.save(organization=self._org(s),status=ValuationInspection.Status.SCHEDULED,completed_at=None,evidence_count=0)
 def perform_update(self,s):
  if self.get_object().status==ValuationInspection.Status.COMPLETED:raise ValidationError({'inspection':'Completed inspection evidence is immutable.'})
  super().perform_update(s)
 @action(detail=True,methods=('post',))
 def start(self,request,pk=None):
  inspection=self.get_object()
  if inspection.status not in (ValuationInspection.Status.SCHEDULED,ValuationInspection.Status.RESCHEDULED):raise ValidationError({'status':'Only a scheduled inspection can start.'})
  inspection.status=ValuationInspection.Status.IN_PROGRESS;inspection.save(update_fields=('status','updated_at'))
  return Response(self.get_serializer(inspection).data)
 @action(detail=True,methods=('post',))
 @transaction.atomic
 def complete(self,request,pk=None):
  inspection=self.get_object()
  if inspection.status!=ValuationInspection.Status.IN_PROGRESS:raise ValidationError({'status':'Start the inspection before completion.'})
  checklist=request.data.get('checklist',inspection.checklist);findings=str(request.data.get('findings',inspection.findings)).strip();evidence=int(request.data.get('evidence_count',0))
  if not isinstance(checklist,dict) or not checklist or not findings or evidence<1:raise ValidationError({'evidence':'Checklist, findings and at least one evidence item are required.'})
  inspection.checklist=checklist;inspection.findings=findings;inspection.issues=str(request.data.get('issues',inspection.issues)).strip();inspection.evidence_count=evidence;inspection.completed_at=timezone.now();inspection.status=ValuationInspection.Status.COMPLETED;inspection.save()
  instruction=inspection.instruction;previous=instruction.status
  if instruction.status in (ValuationInstruction.Status.ASSIGNED,ValuationInstruction.Status.INSPECTION):instruction.status=ValuationInstruction.Status.INSPECTION;instruction.save(update_fields=('status','updated_at'))
  ValuationAuditEvent.objects.create(organization=inspection.organization,instruction=instruction,event_type='inspection_completed',from_status=previous,to_status=instruction.status,details={'inspection':inspection.reference,'evidence_count':evidence},actor=request.user)
  return Response(self.get_serializer(inspection).data)
class ComparableViewSet(Scoped):
 write_permission='valuation.field'
 queryset=ComparableEvidence.objects.select_related('instruction');serializer_class=ComparableSerializer;search_fields=('reference','address','property_type','source')
 def _calculated(self,s):
  price=s.validated_data.get('transaction_price',getattr(s.instance,'transaction_price',None));area=s.validated_data.get('area',getattr(s.instance,'area',None));adjustment=s.validated_data.get('adjustment_percent',getattr(s.instance,'adjustment_percent',Decimal(0)))
  if not price or not area or price<=0 or area<=0:raise ValidationError({'comparable':'Price and area must be greater than zero.'})
  return (price/area).quantize(Decimal('0.01')),(price*(Decimal(1)+adjustment/Decimal(100))).quantize(Decimal('0.01'))
 def perform_create(self,s):
  rate,adjusted=self._calculated(s);s.save(organization=self._org(s),rate_per_area=rate,adjusted_value=adjusted)
 def perform_update(self,s):
  self._org(s);rate,adjusted=self._calculated(s);s.save(rate_per_area=rate,adjusted_value=adjusted)
class DraftViewSet(Scoped):
 write_permission='valuation.field'
 queryset=DraftValuationReport.objects.select_related('instruction','prepared_by','reviewer');serializer_class=DraftSerializer;search_fields=('instruction__reference','instruction__property_description','valuation_method','template')
 def perform_create(self,s):s.save(organization=self._org(s),prepared_by=self.request.user,status=DraftValuationReport.Status.DRAFT)
 def perform_update(self,s):
  if self.get_object().status==DraftValuationReport.Status.APPROVED:raise ValidationError({'report':'Approved drafts are immutable.'})
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
 @action(detail=True,methods=('post',),url_path='request-changes')
 def request_changes(self,request,pk=None):
  draft=self.get_object();notes=str(request.data.get('notes','')).strip()
  if draft.status!=DraftValuationReport.Status.REVIEW or draft.reviewer_id!=request.user.id:raise ValidationError({'status':'Only the assigned reviewer can return a report in review.'})
  if not notes:raise ValidationError({'notes':'Required changes must be described.'})
  draft.status=DraftValuationReport.Status.CHANGES;draft.review_notes=notes;draft.save(update_fields=('status','review_notes','updated_at'))
  ValuationAuditEvent.objects.create(organization=draft.organization,instruction=draft.instruction,event_type='draft_changes_requested',from_status='review',to_status='changes',notes=notes,details={'version':draft.version},actor=request.user)
  return Response(DraftSerializer(draft).data)
class FinalViewSet(Scoped):
 write_permission='valuation.review'
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
class InvoiceViewSet(Scoped):
 write_permission='valuation.finance'
 queryset=ValuationInvoice.objects.select_related('instruction__client');serializer_class=InvoiceSerializer;search_fields=('number','instruction__reference','instruction__client__name')
 def perform_create(self,s):
  subtotal=s.validated_data['subtotal'];tax=s.validated_data.get('tax',Decimal(0));total=(subtotal+tax).quantize(Decimal('0.01'));s.save(organization=self._org(s),total=total,balance=total,status=ValuationInvoice.Status.DRAFT)
 def perform_update(self,s):
  if self.get_object().status!=ValuationInvoice.Status.DRAFT:raise ValidationError({'invoice':'Only draft invoices can be edited.'})
  self._org(s);subtotal=s.validated_data.get('subtotal',s.instance.subtotal);tax=s.validated_data.get('tax',s.instance.tax);total=(subtotal+tax).quantize(Decimal('0.01'));s.save(total=total,balance=total)
 def perform_destroy(self,instance):raise ValidationError({'invoice':'Invoices are permanent; void an issued invoice instead.'})
 @action(detail=True,methods=('post',))
 def issue(self,request,pk=None):
  invoice=self.get_object()
  if invoice.status!=ValuationInvoice.Status.DRAFT:raise ValidationError({'status':'Only a draft invoice can be issued.'})
  invoice.status=ValuationInvoice.Status.ISSUED;invoice.save(update_fields=('status','updated_at'));ValuationAuditEvent.objects.create(organization=invoice.organization,instruction=invoice.instruction,event_type='invoice_issued',details={'invoice':invoice.number,'total':str(invoice.total)},actor=request.user);return Response(self.get_serializer(invoice).data)
 @action(detail=True,methods=('post',))
 def void(self,request,pk=None):
  invoice=self.get_object();reason=str(request.data.get('reason','')).strip()
  if invoice.status!=ValuationInvoice.Status.ISSUED or invoice.balance!=invoice.total:raise ValidationError({'status':'Only an unpaid issued invoice can be voided.'})
  if not reason:raise ValidationError({'reason':'A void reason is required.'})
  invoice.status=ValuationInvoice.Status.VOID;invoice.balance=Decimal(0);invoice.save(update_fields=('status','balance','updated_at'));ValuationAuditEvent.objects.create(organization=invoice.organization,instruction=invoice.instruction,event_type='invoice_voided',notes=reason,details={'invoice':invoice.number},actor=request.user);return Response(self.get_serializer(invoice).data)
class PaymentViewSet(Scoped):
 write_permission='valuation.finance'
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
 permission_classes=(HasModuleActionPermission,);required_module=Module.VALUATION
 def list(self,request):
  org=get_active_organization(request);today=timezone.localdate();ins=scope_model_queryset(ValuationInstruction,request,org);inv=scope_model_queryset(ValuationInvoice,request,org);pay=scope_model_queryset(ValuationPayment,request,org)
  active=ins.exclude(status__in=(ValuationInstruction.Status.DELIVERED,ValuationInstruction.Status.CANCELLED))
  inspections=scope_model_queryset(ValuationInspection,request,org);drafts=scope_model_queryset(DraftValuationReport,request,org);finals=scope_model_queryset(FinalValuationReport,request,org)
  return Response({'kpis':{'activeInstructions':active.count(),'dueThisWeek':active.filter(due_on__lte=today+timezone.timedelta(days=7)).count(),'inspectionsPending':inspections.exclude(status=ValuationInspection.Status.COMPLETED).count(),'draftsInReview':drafts.filter(status=DraftValuationReport.Status.REVIEW).count(),'finalReports':finals.count(),'revenue':pay.aggregate(v=Sum('amount'))['v'] or 0,'outstanding':inv.exclude(status__in=(ValuationInvoice.Status.PAID,ValuationInvoice.Status.VOID)).aggregate(v=Sum('balance'))['v'] or 0},'recentInstructions':InstructionSerializer(ins[:6],many=True).data,'upcomingInspections':InspectionSerializer(inspections.exclude(status=ValuationInspection.Status.COMPLETED)[:5],many=True).data,'pipeline':list(ins.values('status').annotate(count=Count('id')).order_by('status')),'valuationMix':list(ins.values('valuation_type').annotate(count=Count('id')).order_by('-count'))})

class ValuationAnalyticsViewSet(ViewSet):
 permission_classes=(HasModuleActionPermission,);required_module=Module.VALUATION
 def list(self,request):
  org=get_active_organization(request);instructions=scope_model_queryset(ValuationInstruction,request,org);invoices=scope_model_queryset(ValuationInvoice,request,org);today=timezone.localdate();overdue=invoices.filter(due_on__lt=today).exclude(status__in=(ValuationInvoice.Status.PAID,ValuationInvoice.Status.VOID))
  return Response({'teamPerformance':list(instructions.values('valuer__username','valuer__first_name','valuer__last_name').annotate(instructions=Count('id'),averageFee=Avg('quoted_fee'),delivered=Count('id',filter=Q(status=ValuationInstruction.Status.DELIVERED))).order_by('-instructions')),'aging':{'overdueInvoices':overdue.count(),'overdueBalance':overdue.aggregate(v=Sum('balance'))['v'] or 0},'reports':[{'key':'instructions','name':'Instruction pipeline and SLA'},{'key':'inspections','name':'Inspection evidence register'},{'key':'comparables','name':'Comparable evidence analysis'},{'key':'reports','name':'Final valuation reports'},{'key':'fees','name':'Fees, payments and aging'}]})
 @action(detail=False,methods=('get',),url_path=r'exports/(?P<report_kind>[^/.]+)')
 def export(self,request,report_kind=None):
  org=get_active_organization(request);response=HttpResponse(content_type='text/csv');response['Content-Disposition']=f'attachment; filename="valuation-{report_kind}.csv"';writer=csv.writer(response)
  if report_kind=='instructions':
   writer.writerow(('Reference','Client','Property','Type','Purpose','Valuer','Instruction date','Due date','Fee','Priority','Status'))
   for x in scope_model_queryset(ValuationInstruction,request,org).select_related('client','valuer'):writer.writerow((x.reference,x.client.name,x.property_description,x.valuation_type,x.purpose,x.valuer.username,x.instructed_on,x.due_on,x.quoted_fee,x.priority,x.status))
  elif report_kind=='inspections':
   writer.writerow(('Reference','Instruction','Inspector','Scheduled','Completed','GPS','Evidence','Status','Findings','Issues'))
   for x in scope_model_queryset(ValuationInspection,request,org).select_related('instruction','inspector'):writer.writerow((x.reference,x.instruction.reference,x.inspector.username,x.scheduled_at,x.completed_at or '',f'{x.latitude or ""},{x.longitude or ""}',x.evidence_count,x.status,x.findings,x.issues))
  elif report_kind=='comparables':
   writer.writerow(('Instruction','Reference','Address','Type','Date','Price','Area','Rate','Adjustment','Adjusted value','Source'))
   for x in scope_model_queryset(ComparableEvidence,request,org).select_related('instruction'):writer.writerow((x.instruction.reference,x.reference,x.address,x.property_type,x.transaction_date,x.transaction_price,x.area,x.rate_per_area,x.adjustment_percent,x.adjusted_value,x.source))
  elif report_kind=='reports':
   writer.writerow(('Report','Instruction','Client','Issued','Market value','Signed by','Delivered','Method','Checksum'))
   for x in scope_model_queryset(FinalValuationReport,request,org).select_related('instruction__client','signed_by'):writer.writerow((x.report_number,x.instruction.reference,x.instruction.client.name,x.issued_on,x.market_value,x.signed_by.username,x.delivered_at or '',x.delivery_method,x.checksum))
  elif report_kind=='fees':
   writer.writerow(('Invoice','Instruction','Client','Issued','Due','Subtotal','Tax','Total','Balance','Status'))
   for x in scope_model_queryset(ValuationInvoice,request,org).select_related('instruction__client'):writer.writerow((x.number,x.instruction.reference,x.instruction.client.name,x.issued_on,x.due_on,x.subtotal,x.tax,x.total,x.balance,x.status))
  else:raise ValidationError({'report':'Unknown valuation report.'})
  return response
