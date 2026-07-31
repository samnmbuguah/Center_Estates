from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from core.models import OrganizationOwnedModel


class Tender(OrganizationOwnedModel):
    class Stage(models.TextChoices):
        INVITATION='invitation','Invitation'; ANALYSIS='analysis','AI analysis'; DECISION='decision','Bid decision'; PLANNING='planning','Planning'; TECHNICAL='technical','Technical proposal'; FINANCIAL='financial','Financial proposal'; REVIEW='review','Review & approval'; PACKAGING='packaging','Packaging'; SUBMITTED='submitted','Submitted'; AWARDED='awarded','Awarded'; REGRETTED='regretted','Regretted'
    reference=models.CharField(max_length=80); title=models.CharField(max_length=240); client=models.CharField(max_length=200); description=models.TextField(blank=True)
    category=models.CharField(max_length=100,blank=True); source=models.CharField(max_length=100,blank=True); published_on=models.DateField(null=True,blank=True); clarification_deadline=models.DateTimeField(null=True,blank=True); submission_deadline=models.DateTimeField()
    estimated_value=models.DecimalField(max_digits=18,decimal_places=2,default=0); currency=models.CharField(max_length=3,default='KES'); stage=models.CharField(max_length=16,choices=Stage.choices,default=Stage.INVITATION); owner=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT,related_name='owned_tenders'); readiness_score=models.DecimalField(max_digits=5,decimal_places=2,default=0); source_document_url=models.URLField(blank=True)
    class Meta:
        ordering=('-submission_deadline',); constraints=[models.UniqueConstraint(fields=('organization','reference'),name='unique_organization_tender_ref')]


class TenderRequirement(OrganizationOwnedModel):
    tender=models.ForeignKey(Tender,on_delete=models.CASCADE,related_name='requirements'); category=models.CharField(max_length=80); text=models.TextField(); mandatory=models.BooleanField(default=True); status=models.CharField(max_length=16,choices=(('pending','Pending'),('confirmed','Confirmed'),('met','Met'),('gap','Gap')),default='pending'); confidence=models.DecimalField(max_digits=5,decimal_places=2,null=True,blank=True); citation=models.CharField(max_length=250,blank=True); model_version=models.CharField(max_length=80,blank=True); confirmed_by=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.SET_NULL,null=True,blank=True,related_name='confirmed_tender_requirements')
    class Meta: ordering=('category','created_at')


class BidDecision(OrganizationOwnedModel):
    tender=models.OneToOneField(Tender,on_delete=models.CASCADE,related_name='bid_decision'); eligibility_score=models.DecimalField(max_digits=5,decimal_places=2); profitability_score=models.DecimalField(max_digits=5,decimal_places=2); capacity_score=models.DecimalField(max_digits=5,decimal_places=2); risk_score=models.DecimalField(max_digits=5,decimal_places=2); recommendation=models.CharField(max_length=16,choices=(('bid','Bid'),('no_bid','No bid'),('review','Review'))); decision=models.CharField(max_length=16,choices=(('pending','Pending'),('approved','Approved to bid'),('declined','Declined')),default='pending'); rationale=models.TextField(blank=True); decided_by=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.SET_NULL,null=True,blank=True,related_name='tender_decisions'); decided_at=models.DateTimeField(null=True,blank=True)


class TenderTask(OrganizationOwnedModel):
    tender=models.ForeignKey(Tender,on_delete=models.CASCADE,related_name='tasks'); title=models.CharField(max_length=200); stage=models.CharField(max_length=16,choices=Tender.Stage.choices); owner=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT,related_name='tender_tasks'); starts_on=models.DateField(); due_on=models.DateField(); status=models.CharField(max_length=16,choices=(('pending','Pending'),('in_progress','In progress'),('blocked','Blocked'),('completed','Completed')),default='pending'); progress=models.PositiveSmallIntegerField(default=0); dependency=models.ForeignKey('self',on_delete=models.SET_NULL,null=True,blank=True,related_name='dependents')
    def clean(self):
        if self.progress>100: raise ValidationError({'progress':'Progress cannot exceed 100.'})


class CompanyDocument(OrganizationOwnedModel):
    name=models.CharField(max_length=180); document_type=models.CharField(max_length=80); version=models.CharField(max_length=30); issued_on=models.DateField(null=True,blank=True); expires_on=models.DateField(null=True,blank=True); status=models.CharField(max_length=16,choices=(('valid','Valid'),('expiring','Expiring'),('expired','Expired')),default='valid'); file_url=models.URLField(blank=True); checksum=models.CharField(max_length=128)
    class Meta:
        ordering=('expires_on','name'); constraints=[models.UniqueConstraint(fields=('organization','checksum'),name='unique_organization_company_doc_checksum')]


class ProposalSection(OrganizationOwnedModel):
    tender=models.ForeignKey(Tender,on_delete=models.CASCADE,related_name='proposal_sections'); title=models.CharField(max_length=200); section_type=models.CharField(max_length=20,choices=(('technical','Technical'),('financial','Financial'),('form','Form'))); sequence=models.PositiveSmallIntegerField(); owner=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT,related_name='proposal_sections'); content=models.TextField(blank=True); status=models.CharField(max_length=16,choices=(('draft','Draft'),('review','In review'),('approved','Approved')),default='draft'); ai_assisted=models.BooleanField(default=False); version=models.PositiveIntegerField(default=1)
    class Meta: ordering=('sequence',); constraints=[models.UniqueConstraint(fields=('tender','sequence'),name='unique_tender_proposal_sequence')]


class FinancialItem(OrganizationOwnedModel):
    tender=models.ForeignKey(Tender,on_delete=models.CASCADE,related_name='financial_items'); code=models.CharField(max_length=60); description=models.CharField(max_length=240); quantity=models.DecimalField(max_digits=14,decimal_places=3); unit=models.CharField(max_length=30); unit_rate=models.DecimalField(max_digits=16,decimal_places=2); amount=models.DecimalField(max_digits=18,decimal_places=2); approved=models.BooleanField(default=False)
    class Meta: ordering=('code',); constraints=[models.UniqueConstraint(fields=('tender','code'),name='unique_tender_financial_item')]


class TenderReview(OrganizationOwnedModel):
    tender=models.ForeignKey(Tender,on_delete=models.CASCADE,related_name='reviews'); reviewer=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT,related_name='tender_reviews'); gate=models.CharField(max_length=80); status=models.CharField(max_length=16,choices=(('pending','Pending'),('approved','Approved'),('changes','Changes required')),default='pending'); comments=models.TextField(blank=True); reviewed_at=models.DateTimeField(null=True,blank=True)


class TenderSubmission(OrganizationOwnedModel):
    tender=models.OneToOneField(Tender,on_delete=models.PROTECT,related_name='submission'); channel=models.CharField(max_length=40); submitted_at=models.DateTimeField(); submitted_by=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT,related_name='tender_submissions'); package_version=models.CharField(max_length=30); package_checksum=models.CharField(max_length=128); receipt_reference=models.CharField(max_length=120); acknowledgement_url=models.URLField(blank=True); compliant=models.BooleanField(default=True)


class TenderOutcome(OrganizationOwnedModel):
    tender=models.OneToOneField(Tender,on_delete=models.PROTECT,related_name='outcome'); result=models.CharField(max_length=16,choices=(('awarded','Awarded'),('regretted','Regretted'),('cancelled','Cancelled'))); notified_on=models.DateField(); awarded_value=models.DecimalField(max_digits=18,decimal_places=2,null=True,blank=True); winner=models.CharField(max_length=200,blank=True); feedback=models.TextField(blank=True); lessons_learned=models.TextField(blank=True)
