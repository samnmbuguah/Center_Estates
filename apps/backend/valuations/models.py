from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from core.models import OrganizationOwnedModel


class ValuationClient(OrganizationOwnedModel):
    code = models.CharField(max_length=40)
    name = models.CharField(max_length=200)
    client_type = models.CharField(max_length=30, choices=(('bank', 'Bank'), ('corporate', 'Corporate'), ('government', 'Government'), ('individual', 'Individual'), ('legal', 'Legal firm')))
    contact_name = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    tax_number = models.CharField(max_length=60, blank=True)
    payment_terms_days = models.PositiveSmallIntegerField(default=30)

    class Meta:
        ordering = ('name',)
        constraints = [models.UniqueConstraint(fields=('organization', 'code'), name='unique_organization_valuation_client')]


class ValuationInstruction(OrganizationOwnedModel):
    class Status(models.TextChoices):
        NEW = 'new', 'New'
        ASSIGNED = 'assigned', 'Assigned'
        INSPECTION = 'inspection', 'Inspection'
        DRAFTING = 'drafting', 'Drafting'
        REVIEW = 'review', 'Review'
        FINAL = 'final', 'Final report'
        DELIVERED = 'delivered', 'Delivered'
        CANCELLED = 'cancelled', 'Cancelled'

    reference = models.CharField(max_length=60)
    client = models.ForeignKey(ValuationClient, on_delete=models.PROTECT, related_name='instructions')
    property = models.ForeignKey('properties.Property', on_delete=models.PROTECT, related_name='valuation_instructions', null=True, blank=True)
    property_description = models.CharField(max_length=240)
    address = models.TextField(blank=True)
    valuation_type = models.CharField(max_length=80)
    purpose = models.CharField(max_length=100)
    priority = models.CharField(max_length=12, choices=(('normal', 'Normal'), ('high', 'High'), ('urgent', 'Urgent')), default='normal')
    valuer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='valuation_instructions')
    instructed_on = models.DateField()
    due_on = models.DateField()
    quoted_fee = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    instructions = models.TextField(blank=True)

    class Meta:
        ordering = ('due_on',)
        constraints = [models.UniqueConstraint(fields=('organization', 'reference'), name='unique_organization_valuation_instruction')]

    def clean(self):
        if self.client_id and self.client.organization_id != self.organization_id:
            raise ValidationError('Client must belong to the same organization.')
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Property must belong to the same organization.')
        if self.due_on and self.instructed_on and self.due_on < self.instructed_on:
            raise ValidationError({'due_on': 'Due date cannot precede the instruction date.'})


class ValuationInspection(OrganizationOwnedModel):
    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Scheduled'
        IN_PROGRESS = 'in_progress', 'In progress'
        COMPLETED = 'completed', 'Completed'
        RESCHEDULED = 'rescheduled', 'Rescheduled'

    reference = models.CharField(max_length=60)
    instruction = models.ForeignKey(ValuationInstruction, on_delete=models.CASCADE, related_name='inspections')
    inspector = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='valuation_inspections')
    scheduled_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    contact_person = models.CharField(max_length=120, blank=True)
    contact_phone = models.CharField(max_length=40, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.SCHEDULED)
    checklist = models.JSONField(default=dict, blank=True)
    findings = models.TextField(blank=True)
    issues = models.TextField(blank=True)
    evidence_count = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ('scheduled_at',)
        constraints = [models.UniqueConstraint(fields=('organization', 'reference'), name='unique_organization_valuation_inspection')]

    def clean(self):
        if self.instruction_id and self.instruction.organization_id != self.organization_id:
            raise ValidationError('Inspection must belong to the instruction organization.')


class ComparableEvidence(OrganizationOwnedModel):
    instruction = models.ForeignKey(ValuationInstruction, on_delete=models.CASCADE, related_name='comparables')
    reference = models.CharField(max_length=60)
    address = models.CharField(max_length=240)
    property_type = models.CharField(max_length=80)
    transaction_date = models.DateField()
    transaction_price = models.DecimalField(max_digits=16, decimal_places=2)
    area = models.DecimalField(max_digits=14, decimal_places=2)
    rate_per_area = models.DecimalField(max_digits=14, decimal_places=2)
    source = models.CharField(max_length=160)
    adjustment_percent = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    adjusted_value = models.DecimalField(max_digits=16, decimal_places=2)

    class Meta:
        ordering = ('-transaction_date',)
        constraints = [models.UniqueConstraint(fields=('instruction', 'reference'), name='unique_instruction_comparable')]


class DraftValuationReport(OrganizationOwnedModel):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        REVIEW = 'review', 'In review'
        CHANGES = 'changes', 'Changes required'
        APPROVED = 'approved', 'Approved'

    instruction = models.ForeignKey(ValuationInstruction, on_delete=models.PROTECT, related_name='draft_reports')
    version = models.PositiveSmallIntegerField()
    template = models.CharField(max_length=120)
    valuation_method = models.CharField(max_length=100)
    assessed_value = models.DecimalField(max_digits=18, decimal_places=2)
    market_value = models.DecimalField(max_digits=18, decimal_places=2)
    forced_sale_value = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    prepared_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='prepared_valuation_reports')
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name='reviewed_valuation_reports', null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    review_notes = models.TextField(blank=True)
    file_url = models.URLField(blank=True)

    class Meta:
        ordering = ('-version',)
        constraints = [models.UniqueConstraint(fields=('instruction', 'version'), name='unique_instruction_draft_version')]


class FinalValuationReport(OrganizationOwnedModel):
    instruction = models.OneToOneField(ValuationInstruction, on_delete=models.PROTECT, related_name='final_report')
    draft = models.ForeignKey(DraftValuationReport, on_delete=models.PROTECT, related_name='final_versions')
    report_number = models.CharField(max_length=80)
    issued_on = models.DateField()
    signed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='signed_valuation_reports')
    market_value = models.DecimalField(max_digits=18, decimal_places=2)
    file_url = models.URLField(blank=True)
    checksum = models.CharField(max_length=128)
    delivered_at = models.DateTimeField(null=True, blank=True)
    delivery_method = models.CharField(max_length=60, blank=True)

    class Meta:
        ordering = ('-issued_on',)
        constraints = [models.UniqueConstraint(fields=('organization', 'report_number'), name='unique_organization_final_report')]


class ValuationInvoice(OrganizationOwnedModel):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        ISSUED = 'issued', 'Issued'
        PARTIAL = 'partial', 'Partially paid'
        PAID = 'paid', 'Paid'
        OVERDUE = 'overdue', 'Overdue'
        VOID = 'void', 'Void'

    number = models.CharField(max_length=60)
    instruction = models.ForeignKey(ValuationInstruction, on_delete=models.PROTECT, related_name='invoices')
    issued_on = models.DateField()
    due_on = models.DateField()
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    tax = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    balance = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)

    class Meta:
        ordering = ('-issued_on',)
        constraints = [models.UniqueConstraint(fields=('organization', 'number'), name='unique_organization_valuation_invoice')]


class ValuationPayment(OrganizationOwnedModel):
    reference = models.CharField(max_length=80)
    invoice = models.ForeignKey(ValuationInvoice, on_delete=models.PROTECT, related_name='payments')
    paid_on = models.DateField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    method = models.CharField(max_length=40)
    external_reference = models.CharField(max_length=120, blank=True)
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='valuation_payments')

    class Meta:
        ordering = ('-paid_on',)
        constraints = [models.UniqueConstraint(fields=('organization', 'reference'), name='unique_organization_valuation_payment')]
