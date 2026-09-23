from django.db import transaction
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes
import csv
from decimal import Decimal

from django.db.models import Count,Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.viewsets import ModelViewSet,ViewSet
from core.models import Module
from core.permissions import HasModuleActionPermission
from core.tenancy import get_active_organization
from core.property_scope import get_active_property, scope_model_queryset, scope_queryset_to_property
from .models import BidDecision,CompanyDocument,FinancialItem,ProposalSection,Tender,TenderAuditEvent,TenderOutcome,TenderRequirement,TenderReview,TenderSubmission,TenderTask
from .serializers import CompanyDocumentSerializer,DecisionSerializer,FinancialItemSerializer,OutcomeSerializer,ProposalSectionSerializer,RequirementSerializer,ReviewSerializer,SubmissionSerializer,TaskSerializer,TenderAuditEventSerializer,TenderSerializer

class Scoped(ModelViewSet):
 permission_classes=(HasModuleActionPermission,); required_module=Module.TENDER; search_fields=()
 def get_queryset(self):
  org=get_active_organization(self.request); q=scope_queryset_to_property(self.queryset.for_organization(org),self.request,org); s=self.request.query_params.get('search','').strip()
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
 write_permission = 'tender.intake'
 queryset=Tender.objects.select_related('owner'); serializer_class=TenderSerializer; search_fields=('reference','title','client','category')
 def perform_create(self,serializer):
  org=self._validate_relations(serializer); serializer.save(organization=org,owner=self.request.user,property=serializer.validated_data.get('property') or get_active_property(self.request,org))
 def perform_update(self,serializer):
  if self.get_object().stage in (Tender.Stage.SUBMITTED,Tender.Stage.AWARDED,Tender.Stage.REGRETTED): raise ValidationError({'tender':'Submitted and closed tenders are immutable.'})
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
class RequirementViewSet(Scoped):
 write_permission = 'tender.compliance'
 queryset=TenderRequirement.objects.select_related('tender'); serializer_class=RequirementSerializer; search_fields=('text','category','tender__title')
 @action(detail=True,methods=('post',))
 def confirm(self,request,pk=None):
  requirement=self.get_object(); target=str(request.data.get('status','confirmed'))
  if target not in ('confirmed','met','gap'): raise ValidationError({'status':'Confirmation must mark the requirement confirmed, met, or gap.'})
  if requirement.status!='pending': raise ValidationError({'status':'Only pending extraction findings can be confirmed.'})
  requirement.status=target; requirement.confirmed_by=request.user; requirement.save(update_fields=('status','confirmed_by','updated_at'))
  TenderAuditEvent.objects.create(organization=requirement.organization,tender=requirement.tender,event_type='requirement_confirmed',details={'requirement':str(requirement.id),'status':target,'citation':requirement.citation},actor=request.user)
  return Response(self.get_serializer(requirement).data)
class DecisionViewSet(Scoped):
 write_permission = 'tender.decision'
 queryset=BidDecision.objects.select_related('tender'); serializer_class=DecisionSerializer; search_fields=('tender__title','rationale')
 @action(detail=True,methods=('post',))
 def decide(self,request,pk=None):
  decision=self.get_object(); target=str(request.data.get('decision',''))
  if decision.decision!='pending' or target not in ('approved','declined'): raise ValidationError({'decision':'A pending decision must be approved or declined.'})
  if decision.tender.stage!=Tender.Stage.DECISION: raise ValidationError({'tender':'The tender must be at the bid decision stage.'})
  if decision.tender.requirements.filter(mandatory=True,status__in=('pending','gap')).exists(): raise ValidationError({'requirements':'Mandatory requirements must be resolved first.'})
  decision.decision=target; decision.decided_by=request.user; decision.decided_at=timezone.now(); decision.rationale=str(request.data.get('rationale',decision.rationale)).strip(); decision.save()
  TenderAuditEvent.objects.create(organization=decision.organization,tender=decision.tender,event_type='bid_decision',notes=decision.rationale,details={'decision':target},actor=request.user)
  return Response(self.get_serializer(decision).data)
class TaskViewSet(Scoped):
 write_permission = 'tender.intake'
 permission_map = {'transition': 'tender.intake'}
 queryset=TenderTask.objects.select_related('tender','owner','dependency'); serializer_class=TaskSerializer; search_fields=('title','tender__title','owner__username')
 @action(detail=True,methods=('post',))
 def transition(self,request,pk=None):
  task=self.get_object(); target=str(request.data.get('status','')); allowed={'pending':('in_progress','blocked'),'in_progress':('blocked','completed'),'blocked':('in_progress',),'completed':()}
  if target not in allowed[task.status]: raise ValidationError({'status':f'Cannot transition task from {task.status} to {target or "blank"}.'})
  if target=='in_progress' and task.dependency_id and task.dependency.status!='completed': raise ValidationError({'dependency':'Complete the dependency before starting this task.'})
  task.status=target; task.progress=100 if target=='completed' else max(task.progress,1) if target=='in_progress' else task.progress; task.save(update_fields=('status','progress','updated_at'))
  TenderAuditEvent.objects.create(organization=task.organization,tender=task.tender,event_type='task_status_change',details={'task':str(task.id),'status':target},actor=request.user)
  return Response(self.get_serializer(task).data)
class DocumentViewSet(Scoped):
 write_permission = 'tender.compliance'
 queryset=CompanyDocument.objects.all(); serializer_class=CompanyDocumentSerializer; search_fields=('name','document_type','version')
 def perform_update(self,serializer): raise ValidationError({'document':'Vault evidence is immutable; upload a new checksum version.'})
 def perform_destroy(self,instance): raise ValidationError({'document':'Vault evidence cannot be deleted.'})
class ProposalViewSet(Scoped):
 write_permission = 'tender.proposal'
 queryset=ProposalSection.objects.select_related('tender','owner'); serializer_class=ProposalSectionSerializer; search_fields=('title','content','tender__title')
 def get_action_permission(self,request,action):
  if action=='transition' and str(request.data.get('status',''))=='approved': return 'tender.approve'
  if action=='transition': return 'tender.proposal'
  return self.permission_map.get(action) if hasattr(self,'permission_map') else None
 def perform_update(self,serializer):
  section=self.get_object()
  if section.status=='approved': raise ValidationError({'proposal':'Approved proposal sections are immutable.'})
  self._validate_relations(serializer)
  serializer.save(version=section.version+1)
 @action(detail=True,methods=('post',))
 def transition(self,request,pk=None):
  section=self.get_object(); target=str(request.data.get('status','')); allowed={'draft':('review',),'review':('draft','approved'),'approved':()}
  if target not in allowed[section.status]: raise ValidationError({'status':'Invalid proposal review transition.'})
  section.status=target; section.save(update_fields=('status','updated_at'))
  TenderAuditEvent.objects.create(organization=section.organization,tender=section.tender,event_type='proposal_status_change',details={'section':str(section.id),'status':target,'version':section.version},actor=request.user)
  return Response(self.get_serializer(section).data)
class FinancialViewSet(Scoped):
 write_permission = 'tender.pricing'
 queryset=FinancialItem.objects.select_related('tender'); serializer_class=FinancialItemSerializer; search_fields=('code','description','tender__title')
 def perform_create(self,serializer):
  amount=(serializer.validated_data['quantity']*serializer.validated_data['unit_rate']).quantize(Decimal('0.01'))
  serializer.save(organization=self._validate_relations(serializer),amount=amount,approved=False)
 def perform_update(self,serializer):
  if self.get_object().approved: raise ValidationError({'financial':'Approved pricing is immutable.'})
  self._validate_relations(serializer)
  quantity=serializer.validated_data.get('quantity',serializer.instance.quantity); rate=serializer.validated_data.get('unit_rate',serializer.instance.unit_rate)
  serializer.save(amount=(quantity*rate).quantize(Decimal('0.01')))
 @action(detail=True,methods=('post',))
 def approve(self,request,pk=None):
  item=self.get_object()
  if item.approved: raise ValidationError({'financial':'Pricing item is already approved.'})
  item.approved=True; item.save(update_fields=('approved','updated_at'))
  TenderAuditEvent.objects.create(organization=item.organization,tender=item.tender,event_type='financial_item_approved',details={'item':str(item.id),'amount':str(item.amount)},actor=request.user)
  return Response(self.get_serializer(item).data)
class ReviewViewSet(Scoped):
 write_permission = 'tender.decision'
 queryset=TenderReview.objects.select_related('tender','reviewer'); serializer_class=ReviewSerializer; search_fields=('gate','tender__title','comments')
 @action(detail=True,methods=('post',))
 def decide(self,request,pk=None):
  review=self.get_object(); target=str(request.data.get('status',''))
  if review.status!='pending' or target not in ('approved','changes'): raise ValidationError({'status':'A pending gate must be approved or returned for changes.'})
  comments=str(request.data.get('comments',review.comments)).strip()
  if target=='changes' and not comments: raise ValidationError({'comments':'Required changes must be described.'})
  review.status=target; review.comments=comments; review.reviewed_at=timezone.now(); review.save(update_fields=('status','comments','reviewed_at','updated_at'))
  TenderAuditEvent.objects.create(organization=review.organization,tender=review.tender,event_type='review_decision',notes=comments,details={'gate':review.gate,'status':target},actor=request.user)
  return Response(self.get_serializer(review).data)
class SubmissionViewSet(Scoped):
 write_permission = 'tender.decision'
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
 write_permission = 'tender.decision'
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
 permission_classes=(HasModuleActionPermission,); required_module=Module.TENDER
 @extend_schema(request=None, responses={200: {"type": "object"}})
 def list(self,request):
  org=get_active_organization(request); now=timezone.now(); tenders=scope_model_queryset(Tender,request,org); tasks=scope_model_queryset(TenderTask,request,org); docs=CompanyDocument.objects.for_organization(org)
  active=tenders.exclude(stage__in=(Tender.Stage.AWARDED,Tender.Stage.REGRETTED))
  return Response({'kpis':{'activeTenders':active.count(),'dueThisWeek':active.filter(submission_deadline__lte=now+timezone.timedelta(days=7)).count(),'pipelineValue':active.aggregate(v=Sum('estimated_value'))['v'] or 0,'pendingTasks':tasks.exclude(status='completed').count(),'expiringDocuments':docs.filter(expires_on__lte=timezone.localdate()+timezone.timedelta(days=30)).count(),'submitted':tenders.filter(stage=Tender.Stage.SUBMITTED).count()},'recentTenders':TenderSerializer(tenders[:6],many=True).data,'urgentTasks':TaskSerializer(tasks.exclude(status='completed').order_by('due_on')[:6],many=True).data,'stageFunnel':list(tenders.values('stage').annotate(count=Count('id')).order_by('stage'))})

class TenderAnalyticsViewSet(ViewSet):
 permission_classes=(HasModuleActionPermission,); required_module=Module.TENDER
 @extend_schema(request=None, responses={200: {"type": "object"}})
 def list(self,request):
  org=get_active_organization(request); tenders=scope_model_queryset(Tender,request,org); submitted=tenders.filter(stage__in=(Tender.Stage.SUBMITTED,Tender.Stage.AWARDED,Tender.Stage.REGRETTED)); closed=tenders.filter(stage__in=(Tender.Stage.AWARDED,Tender.Stage.REGRETTED))
  return Response({'outcomes':list(closed.values('stage').annotate(count=Count('id'),value=Sum('estimated_value')).order_by('stage')),'metrics':{'submitted':submitted.count(),'awarded':closed.filter(stage=Tender.Stage.AWARDED).count(),'regretted':closed.filter(stage=Tender.Stage.REGRETTED).count(),'winRate':round(closed.filter(stage=Tender.Stage.AWARDED).count()/closed.count()*100,2) if closed.exists() else 0},'reports':[{'key':'pipeline','name':'Tender pipeline and deadlines'},{'key':'requirements','name':'Requirement compliance matrix'},{'key':'tasks','name':'Bid plan and workload'},{'key':'pricing','name':'Financial proposal'},{'key':'outcomes','name':'Awards, regrets and lessons'}]})
 @extend_schema(request=None, responses={200: {"type": "string", "format": "binary"}}, parameters=[OpenApiParameter("report_kind", OpenApiTypes.STR, OpenApiParameter.PATH)])
 @action(detail=False,methods=('get',),url_path=r'exports/(?P<report_kind>[^/.]+)')
 def export(self,request,report_kind=None):
  org=get_active_organization(request); output=str(request.query_params.get('output','csv')).lower()
  if output not in ('csv','xlsx','pdf'): raise ValidationError({'output':'Output format must be csv, xlsx or pdf.'})
  from io import StringIO; buffer=StringIO(); writer=csv.writer(buffer)
  if report_kind=='pipeline':
   writer.writerow(('Reference','Title','Client','Deadline','Value','Currency','Stage','Readiness'))
   for x in scope_model_queryset(Tender,request,org): writer.writerow((x.reference,x.title,x.client,x.submission_deadline,x.estimated_value,x.currency,x.stage,x.readiness_score))
  elif report_kind=='requirements':
   writer.writerow(('Tender','Category','Requirement','Mandatory','Status','Confidence','Citation','Model'))
   for x in scope_model_queryset(TenderRequirement,request,org).select_related('tender'): writer.writerow((x.tender.reference,x.category,x.text,x.mandatory,x.status,x.confidence or '',x.citation,x.model_version))
  elif report_kind=='tasks':
   writer.writerow(('Tender','Task','Owner','Start','Due','Status','Progress'))
   for x in scope_model_queryset(TenderTask,request,org).select_related('tender','owner'): writer.writerow((x.tender.reference,x.title,x.owner.username,x.starts_on,x.due_on,x.status,x.progress))
  elif report_kind=='pricing':
   writer.writerow(('Tender','Code','Description','Quantity','Unit','Rate','Amount','Approved'))
   for x in scope_model_queryset(FinancialItem,request,org).select_related('tender'): writer.writerow((x.tender.reference,x.code,x.description,x.quantity,x.unit,x.unit_rate,x.amount,x.approved))
  elif report_kind=='outcomes':
   writer.writerow(('Tender','Result','Notified','Awarded value','Winner','Feedback','Lessons learned'))
   for x in scope_model_queryset(TenderOutcome,request,org).select_related('tender'): writer.writerow((x.tender.reference,x.result,x.notified_on,x.awarded_value or '',x.winner,x.feedback,x.lessons_learned))
  else: raise ValidationError({'report':'Unknown tender report.'})
  content=buffer.getvalue().encode('utf-8-sig'); titles={'pipeline':'Tender Pipeline','requirements':'Tender Requirements','tasks':'Tender Tasks','pricing':'Tender Pricing','outcomes':'Tender Outcomes'}
  title=titles.get(report_kind,f'Tender {report_kind}'); filename=f'tender-{report_kind}.{output}'
  if output=='pdf':
   from properties.pdf_documents import tabular_report_pdf
   return tabular_report_pdf(org,title,filename,content,property_name='Portfolio',generated_by=request.user.get_username())
  if output=='xlsx':
   from properties.pdf_documents import xlsx_from_csv
   return xlsx_from_csv(title,content,filename=filename)
  response=HttpResponse(content,content_type='text/csv'); response['Content-Disposition']=f'attachment; filename="{filename}"'; return response
