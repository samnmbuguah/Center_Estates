from rest_framework import serializers
from .models import BidDecision,CompanyDocument,FinancialItem,ProposalSection,Tender,TenderAuditEvent,TenderOutcome,TenderRequirement,TenderReview,TenderSubmission,TenderTask

class Base(serializers.ModelSerializer): pass
class TenderSerializer(Base):
 owner_name=serializers.CharField(source='owner.get_full_name',read_only=True)
 class Meta:
  model=Tender; exclude=('organization',); read_only_fields=('owner','readiness_score')
class RequirementSerializer(Base):
 class Meta: model=TenderRequirement; exclude=('organization',); read_only_fields=('status','confirmed_by')
class DecisionSerializer(Base):
 class Meta: model=BidDecision; exclude=('organization',); read_only_fields=('decision','decided_by','decided_at')
class TaskSerializer(Base):
 owner_name=serializers.CharField(source='owner.get_full_name',read_only=True)
 tender_title=serializers.CharField(source='tender.title',read_only=True)
 class Meta: model=TenderTask; exclude=('organization',); read_only_fields=('status','progress'); ref_name='TenderTask'
class CompanyDocumentSerializer(Base):
 class Meta: model=CompanyDocument; exclude=('organization',)
class ProposalSectionSerializer(Base):
 tender_title=serializers.CharField(source='tender.title',read_only=True)
 owner_name=serializers.CharField(source='owner.get_full_name',read_only=True)
 class Meta: model=ProposalSection; exclude=('organization',)
class FinancialItemSerializer(Base):
 tender_title=serializers.CharField(source='tender.title',read_only=True)
 class Meta: model=FinancialItem; exclude=('organization',); read_only_fields=('amount','approved')
class ReviewSerializer(Base):
 tender_title=serializers.CharField(source='tender.title',read_only=True)
 reviewer_name=serializers.CharField(source='reviewer.get_full_name',read_only=True)
 class Meta: model=TenderReview; exclude=('organization',); read_only_fields=('status','reviewed_at')
class SubmissionSerializer(Base):
 tender_title=serializers.CharField(source='tender.title',read_only=True)
 class Meta:
  model=TenderSubmission; exclude=('organization',); read_only_fields=('submitted_by','submitted_at')
class OutcomeSerializer(Base):
 tender_title=serializers.CharField(source='tender.title',read_only=True)
 class Meta: model=TenderOutcome; exclude=('organization',)
class TenderAuditEventSerializer(Base):
 tender_reference=serializers.CharField(source='tender.reference',read_only=True)
 actor_name=serializers.CharField(source='actor.username',read_only=True)
 class Meta: model=TenderAuditEvent; exclude=('organization','actor')
