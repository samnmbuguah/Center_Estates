from django.db import transaction
from django.db.models import Count,Sum
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.viewsets import ModelViewSet,ViewSet
from core.models import Module
from core.permissions import HasModuleSubscription
from core.tenancy import get_active_organization
from .models import BidDecision,CompanyDocument,FinancialItem,ProposalSection,Tender,TenderAuditEvent,TenderOutcome,TenderRequirement,TenderReview,TenderSubmission,TenderTask
from .serializers import CompanyDocumentSerializer,DecisionSerializer,FinancialItemSerializer,OutcomeSerializer,ProposalSectionSerializer,RequirementSerializer,ReviewSerializer,SubmissionSerializer,TaskSerializer,TenderAuditEventSerializer,TenderSerializer

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
 def perform_update(self,serializer):
  if 'stage' in serializer.validated_data and serializer.validated_data['stage']!=self.get_object().stage: raise ValidationError({'stage':'Use the transition action so approval gates and the audit trail are enforced.'})
  super().perform_update(serializer)
 @action(detail=True,methods=('post',))
 @transaction.atomic
 def transition(self,request,pk=None):
  org=get_active_organization(request); tender=Tender.objects.select_for_update().filter(pk=pk,organization=org).first()
  if not tender: return Response({'detail':'Tender not found.'},status=404)
  target=str(request.data.get('stage','')).strip(); previous=tender.stage
  allowed={Tender.Stage.INVITATION:Tender.Stage.ANALYSIS,Tender.Stage.ANALYSIS:Tender.Stage.DECISION,Tender.Stage.DECISION:Tender.Stage.PLANNING,Tender.Stage.PLANNING:Tender.Stage.TECHNICAL,Tender.Stage.TECHNICAL:Tender.Stage.FINANCIAL,Tender.Stage.FINANCIAL:Tender.Stage.REVIEW,Tender.Stage.REVIEW:Tender.Stage.PACKAGING}
  if allowed.get(previous)!=target: raise ValidationError({'stage':f'Cannot transition from {previous} to {target or "blank"}.'})
  if target==Tender.Stage.DECISION and tender.requirements.filter(mandatory=True,status__in=('pending','gap')).exists(): raise ValidationError({'requirements':'Resolve every mandatory requirement before bid decision.'})
  if target==Tender.Stage.PLANNING:
   decision=getattr(tender,'bid_decision',None)
   if not decision or decision.decision!='approved': raise ValidationError({'decision':'An approved bid decision is required before planning.'})
  if target==Tender.Stage.PACKAGING:
   if tender.proposal_sections.exclude(status='approved').exists() or not tender.proposal_sections.exists(): raise ValidationError({'proposals':'Every proposal section must be approved before packaging.'})
   if tender.financial_items.filter(approved=False).exists() or not tender.financial_items.exists(): raise ValidationError({'financial':'Every BOQ item must be approved before packaging.'})
   if tender.reviews.exclude(status='approved').exists() or not tender.reviews.exists(): raise ValidationError({'reviews':'Every approval gate must be approved before packaging.'})
  tender.stage=target; tender.save(update_fields=('stage','updated_at'))
  TenderAuditEvent.objects.create(organization=org,tender=tender,event_type='stage_transition',from_stage=previous,to_stage=target,notes=str(request.data.get('notes','')).strip(),actor=request.user)
  return Response(TenderSerializer(tender).data)
class RequirementViewSet(Scoped): queryset=TenderRequirement.objects.select_related('tender'); serializer_class=RequirementSerializer; search_fields=('text','category','tender__title')
class DecisionViewSet(Scoped): queryset=BidDecision.objects.select_related('tender'); serializer_class=DecisionSerializer; search_fields=('tender__title','rationale')
class TaskViewSet(Scoped): queryset=TenderTask.objects.select_related('tender','owner'); serializer_class=TaskSerializer; search_fields=('title','tender__title','owner__username')
class DocumentViewSet(Scoped): queryset=CompanyDocument.objects.all(); serializer_class=CompanyDocumentSerializer; search_fields=('name','document_type','version')
class ProposalViewSet(Scoped): queryset=ProposalSection.objects.select_related('tender','owner'); serializer_class=ProposalSectionSerializer; search_fields=('title','content','tender__title')
class FinancialViewSet(Scoped): queryset=FinancialItem.objects.select_related('tender'); serializer_class=FinancialItemSerializer; search_fields=('code','description','tender__title')
class ReviewViewSet(Scoped): queryset=TenderReview.objects.select_related('tender','reviewer'); serializer_class=ReviewSerializer; search_fields=('gate','tender__title','comments')
class SubmissionViewSet(Scoped):
 queryset=TenderSubmission.objects.select_related('tender','submitted_by'); serializer_class=SubmissionSerializer; search_fields=('tender__title','receipt_reference')
 @transaction.atomic
 def perform_create(self,serializer):
  org=self._validate_relations(serializer); tender=Tender.objects.select_for_update().get(pk=serializer.validated_data['tender'].pk)
  if tender.stage!=Tender.Stage.PACKAGING: raise ValidationError({'tender':'The approved package must reach packaging before submission.'})
  submission=serializer.save(organization=org,submitted_by=self.request.user,submitted_at=timezone.now())
  tender.stage=Tender.Stage.SUBMITTED; tender.readiness_score=100; tender.save(update_fields=('stage','readiness_score','updated_at'))
  TenderAuditEvent.objects.create(organization=org,tender=tender,event_type='submitted',from_stage=Tender.Stage.PACKAGING,to_stage=Tender.Stage.SUBMITTED,details={'receipt_reference':submission.receipt_reference,'package_checksum':submission.package_checksum},actor=self.request.user)
 def perform_update(self,serializer): raise ValidationError({'submission':'Submission receipts are immutable.'})
 def perform_destroy(self,instance): raise ValidationError({'submission':'Submission receipts are immutable.'})
class OutcomeViewSet(Scoped):
 queryset=TenderOutcome.objects.select_related('tender'); serializer_class=OutcomeSerializer; search_fields=('tender__title','winner','feedback')
 @transaction.atomic
 def perform_create(self,serializer):
  org=self._validate_relations(serializer); tender=Tender.objects.select_for_update().get(pk=serializer.validated_data['tender'].pk)
  if tender.stage!=Tender.Stage.SUBMITTED: raise ValidationError({'tender':'Only a submitted tender can receive an outcome.'})
  outcome=serializer.save(organization=org); next_stage=Tender.Stage.AWARDED if outcome.result=='awarded' else Tender.Stage.REGRETTED
  tender.stage=next_stage; tender.save(update_fields=('stage','updated_at'))
  TenderAuditEvent.objects.create(organization=org,tender=tender,event_type='outcome_recorded',from_stage=Tender.Stage.SUBMITTED,to_stage=next_stage,details={'result':outcome.result,'awarded_value':str(outcome.awarded_value or '')},actor=self.request.user)
class TenderAuditEventViewSet(Scoped):
 queryset=TenderAuditEvent.objects.select_related('tender','actor'); serializer_class=TenderAuditEventSerializer; http_method_names=('get','head','options'); search_fields=('tender__reference','event_type','notes')
class DashboardViewSet(ViewSet):
 permission_classes=(HasModuleSubscription,); required_module=Module.TENDER
 def list(self,request):
  org=get_active_organization(request); now=timezone.now(); tenders=Tender.objects.for_organization(org); tasks=TenderTask.objects.for_organization(org); docs=CompanyDocument.objects.for_organization(org)
  active=tenders.exclude(stage__in=(Tender.Stage.AWARDED,Tender.Stage.REGRETTED))
  return Response({'kpis':{'activeTenders':active.count(),'dueThisWeek':active.filter(submission_deadline__lte=now+timezone.timedelta(days=7)).count(),'pipelineValue':active.aggregate(v=Sum('estimated_value'))['v'] or 0,'pendingTasks':tasks.exclude(status='completed').count(),'expiringDocuments':docs.filter(expires_on__lte=timezone.localdate()+timezone.timedelta(days=30)).count(),'submitted':tenders.filter(stage=Tender.Stage.SUBMITTED).count()},'recentTenders':TenderSerializer(tenders[:6],many=True).data,'urgentTasks':TaskSerializer(tasks.exclude(status='completed').order_by('due_on')[:6],many=True).data,'stageFunnel':list(tenders.values('stage').annotate(count=Count('id')).order_by('stage'))})
