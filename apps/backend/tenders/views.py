from django.db.models import Count,Sum
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.viewsets import ModelViewSet,ViewSet
from core.models import Module
from core.permissions import HasModuleSubscription
from core.tenancy import get_active_organization
from .models import BidDecision,CompanyDocument,FinancialItem,ProposalSection,Tender,TenderOutcome,TenderRequirement,TenderReview,TenderSubmission,TenderTask
from .serializers import CompanyDocumentSerializer,DecisionSerializer,FinancialItemSerializer,OutcomeSerializer,ProposalSectionSerializer,RequirementSerializer,ReviewSerializer,SubmissionSerializer,TaskSerializer,TenderSerializer

class Scoped(ModelViewSet):
 permission_classes=(HasModuleSubscription,); required_module=Module.TENDER; search_fields=()
 def get_queryset(self):
  q=self.queryset.for_organization(get_active_organization(self.request)); s=self.request.query_params.get('search','').strip()
  if s:
   from django.db.models import Q
   query=Q()
   for f in self.search_fields: query|=Q(**{f'{f}__icontains':s})
   q=q.filter(query)
  return q
 def _validate_relations(self,serializer):
  org=get_active_organization(self.request)
  for name,value in serializer.validated_data.items():
   related_org=getattr(value,'organization_id',None)
   if related_org and related_org!=org.id: raise ValidationError({name:'The selected record belongs to another organization.'})
  return org
 def perform_create(self,serializer): serializer.save(organization=self._validate_relations(serializer))
 def perform_update(self,serializer): self._validate_relations(serializer); serializer.save()
class TenderViewSet(Scoped):
 queryset=Tender.objects.select_related('owner'); serializer_class=TenderSerializer; search_fields=('reference','title','client','category')
 def perform_create(self,serializer): serializer.save(organization=self._validate_relations(serializer),owner=self.request.user)
class RequirementViewSet(Scoped): queryset=TenderRequirement.objects.select_related('tender'); serializer_class=RequirementSerializer; search_fields=('text','category','tender__title')
class DecisionViewSet(Scoped): queryset=BidDecision.objects.select_related('tender'); serializer_class=DecisionSerializer; search_fields=('tender__title','rationale')
class TaskViewSet(Scoped): queryset=TenderTask.objects.select_related('tender','owner'); serializer_class=TaskSerializer; search_fields=('title','tender__title','owner__username')
class DocumentViewSet(Scoped): queryset=CompanyDocument.objects.all(); serializer_class=CompanyDocumentSerializer; search_fields=('name','document_type','version')
class ProposalViewSet(Scoped): queryset=ProposalSection.objects.select_related('tender','owner'); serializer_class=ProposalSectionSerializer; search_fields=('title','content','tender__title')
class FinancialViewSet(Scoped): queryset=FinancialItem.objects.select_related('tender'); serializer_class=FinancialItemSerializer; search_fields=('code','description','tender__title')
class ReviewViewSet(Scoped): queryset=TenderReview.objects.select_related('tender','reviewer'); serializer_class=ReviewSerializer; search_fields=('gate','tender__title','comments')
class SubmissionViewSet(Scoped): queryset=TenderSubmission.objects.select_related('tender','submitted_by'); serializer_class=SubmissionSerializer; search_fields=('tender__title','receipt_reference')
class OutcomeViewSet(Scoped): queryset=TenderOutcome.objects.select_related('tender'); serializer_class=OutcomeSerializer; search_fields=('tender__title','winner','feedback')
class DashboardViewSet(ViewSet):
 permission_classes=(HasModuleSubscription,); required_module=Module.TENDER
 def list(self,request):
  org=get_active_organization(request); now=timezone.now(); tenders=Tender.objects.for_organization(org); tasks=TenderTask.objects.for_organization(org); docs=CompanyDocument.objects.for_organization(org)
  active=tenders.exclude(stage__in=(Tender.Stage.AWARDED,Tender.Stage.REGRETTED))
  return Response({'kpis':{'activeTenders':active.count(),'dueThisWeek':active.filter(submission_deadline__lte=now+timezone.timedelta(days=7)).count(),'pipelineValue':active.aggregate(v=Sum('estimated_value'))['v'] or 0,'pendingTasks':tasks.exclude(status='completed').count(),'expiringDocuments':docs.filter(expires_on__lte=timezone.localdate()+timezone.timedelta(days=30)).count(),'submitted':tenders.filter(stage=Tender.Stage.SUBMITTED).count()},'recentTenders':TenderSerializer(tenders[:6],many=True).data,'urgentTasks':TaskSerializer(tasks.exclude(status='completed').order_by('due_on')[:6],many=True).data,'stageFunnel':list(tenders.values('stage').annotate(count=Count('id')).order_by('stage'))})
