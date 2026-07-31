from django.db.models import Count,Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet,ViewSet
from core.models import Module
from core.permissions import HasModuleSubscription
from core.tenancy import get_active_organization
from .models import ComparableEvidence,DraftValuationReport,FinalValuationReport,ValuationClient,ValuationInspection,ValuationInstruction,ValuationInvoice,ValuationPayment
from .serializers import ClientSerializer,ComparableSerializer,DraftSerializer,FinalSerializer,InspectionSerializer,InstructionSerializer,InvoiceSerializer,PaymentSerializer

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
class InstructionViewSet(Scoped):queryset=ValuationInstruction.objects.select_related('client','property','valuer');serializer_class=InstructionSerializer;search_fields=('reference','client__name','property_description','purpose','valuation_type')
class InspectionViewSet(Scoped):queryset=ValuationInspection.objects.select_related('instruction','inspector');serializer_class=InspectionSerializer;search_fields=('reference','instruction__reference','instruction__property_description','findings')
class ComparableViewSet(Scoped):queryset=ComparableEvidence.objects.select_related('instruction');serializer_class=ComparableSerializer;search_fields=('reference','address','property_type','source')
class DraftViewSet(Scoped):queryset=DraftValuationReport.objects.select_related('instruction','prepared_by','reviewer');serializer_class=DraftSerializer;search_fields=('instruction__reference','instruction__property_description','valuation_method','template')
class FinalViewSet(Scoped):queryset=FinalValuationReport.objects.select_related('instruction__client','draft','signed_by');serializer_class=FinalSerializer;search_fields=('report_number','instruction__reference','instruction__property_description','instruction__client__name')
class InvoiceViewSet(Scoped):queryset=ValuationInvoice.objects.select_related('instruction__client');serializer_class=InvoiceSerializer;search_fields=('number','instruction__reference','instruction__client__name')
class PaymentViewSet(Scoped):
 queryset=ValuationPayment.objects.select_related('invoice__instruction__client');serializer_class=PaymentSerializer;search_fields=('reference','external_reference','invoice__number')
 def perform_create(self,s):s.save(organization=self._org(s),received_by=self.request.user)
class DashboardViewSet(ViewSet):
 permission_classes=(HasModuleSubscription,);required_module=Module.VALUATION
 def list(self,request):
  org=get_active_organization(request);today=timezone.localdate();ins=ValuationInstruction.objects.for_organization(org);inv=ValuationInvoice.objects.for_organization(org);pay=ValuationPayment.objects.for_organization(org)
  active=ins.exclude(status__in=(ValuationInstruction.Status.DELIVERED,ValuationInstruction.Status.CANCELLED))
  return Response({'kpis':{'activeInstructions':active.count(),'dueThisWeek':active.filter(due_on__lte=today+timezone.timedelta(days=7)).count(),'inspectionsPending':ValuationInspection.objects.for_organization(org).exclude(status=ValuationInspection.Status.COMPLETED).count(),'draftsInReview':DraftValuationReport.objects.for_organization(org).filter(status=DraftValuationReport.Status.REVIEW).count(),'finalReports':FinalValuationReport.objects.for_organization(org).count(),'revenue':pay.aggregate(v=Sum('amount'))['v'] or 0,'outstanding':inv.exclude(status__in=(ValuationInvoice.Status.PAID,ValuationInvoice.Status.VOID)).aggregate(v=Sum('balance'))['v'] or 0},'recentInstructions':InstructionSerializer(ins[:6],many=True).data,'upcomingInspections':InspectionSerializer(ValuationInspection.objects.for_organization(org).exclude(status=ValuationInspection.Status.COMPLETED)[:5],many=True).data,'pipeline':list(ins.values('status').annotate(count=Count('id')).order_by('status')),'valuationMix':list(ins.values('valuation_type').annotate(count=Count('id')).order_by('-count'))})
