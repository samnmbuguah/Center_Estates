from django.db import models
from django.core.exceptions import ValidationError
from django.conf import settings

from core.models import OrganizationOwnedModel


class Property(OrganizationOwnedModel):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        ACTIVE = 'active', 'Active'
        INACTIVE = 'inactive', 'Inactive'
        DISPOSED = 'disposed', 'Disposed'

    code = models.CharField(max_length=40)
    name = models.CharField(max_length=200)
    property_type = models.CharField(max_length=80, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=2, default='KE')
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('name',)
        constraints = [models.UniqueConstraint(
            fields=('organization', 'code'), name='unique_organization_property_code'
        )]

    def __str__(self):
        return f'{self.code} — {self.name}'


class Building(OrganizationOwnedModel):
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='buildings')
    code = models.CharField(max_length=40)
    name = models.CharField(max_length=160)
    floors = models.PositiveSmallIntegerField(default=1)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('property__name', 'name')
        constraints = [models.UniqueConstraint(
            fields=('property', 'code'), name='unique_property_building_code'
        )]

    def clean(self):
        if self.property_id and self.organization_id != self.property.organization_id:
            raise ValidationError('Building and property must belong to the same organization.')

    def __str__(self):
        return f'{self.property.code}/{self.code}'


class Unit(OrganizationOwnedModel):
    class Status(models.TextChoices):
        AVAILABLE = 'available', 'Available'
        RESERVED = 'reserved', 'Reserved'
        OCCUPIED = 'occupied', 'Occupied'
        SOLD = 'sold', 'Sold'
        UNAVAILABLE = 'unavailable', 'Unavailable'

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='units')
    building = models.ForeignKey(Building, on_delete=models.CASCADE, related_name='units', null=True, blank=True)
    code = models.CharField(max_length=40)
    floor = models.CharField(max_length=20, blank=True)
    unit_type = models.CharField(max_length=80, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)
    area = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('property__name', 'code')
        constraints = [models.UniqueConstraint(
            fields=('property', 'code'), name='unique_property_unit_code'
        )]

    def clean(self):
        if self.property_id and self.organization_id != self.property.organization_id:
            raise ValidationError('Unit and property must belong to the same organization.')
        if self.building_id and self.building.property_id != self.property_id:
            raise ValidationError({'building': 'The building must belong to the selected property.'})

    def __str__(self):
        return f'{self.property.code}/{self.code}'


class Project(OrganizationOwnedModel):
    class Status(models.TextChoices):
        PLANNED = 'planned', 'Planned'
        ACTIVE = 'active', 'Active'
        ON_HOLD = 'on_hold', 'On hold'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    code = models.CharField(max_length=40)
    name = models.CharField(max_length=200)
    property = models.ForeignKey(Property, on_delete=models.SET_NULL, related_name='projects', null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    starts_on = models.DateField(null=True, blank=True)
    ends_on = models.DateField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('name',)
        constraints = [models.UniqueConstraint(
            fields=('organization', 'code'), name='unique_organization_project_code'
        )]

    def clean(self):
        if self.property_id and self.organization_id != self.property.organization_id:
            raise ValidationError('Project and property must belong to the same organization.')

    def __str__(self):
        return f'{self.code} — {self.name}'


class Tenant(OrganizationOwnedModel):
    class Status(models.TextChoices):
        PROSPECT = 'prospect', 'Prospect'
        ACTIVE = 'active', 'Active'
        FORMER = 'former', 'Former'
        SUSPENDED = 'suspended', 'Suspended'

    code = models.CharField(max_length=40)
    property = models.ForeignKey(
        Property, on_delete=models.PROTECT, related_name='onboarded_tenants',
        null=True, blank=True,
        help_text='Property where this tenant or prospect was onboarded.',
    )
    name = models.CharField(max_length=200)
    tenant_type = models.CharField(max_length=40, default='company')
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    tax_id = models.CharField(max_length=80, blank=True)
    registration_number = models.CharField(max_length=80, blank=True)
    directors = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PROSPECT)
    billing_address = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('name',)
        constraints = [models.UniqueConstraint(fields=('organization', 'code'), name='unique_organization_tenant_code')]

    def __str__(self):
        return f'{self.code} — {self.name}'


class TenantPortalAccess(OrganizationOwnedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tenant_portal_accesses')
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='portal_accesses')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ('tenant__name', 'user__username')
        constraints = [
            models.UniqueConstraint(fields=('organization', 'user'), name='unique_organization_tenant_portal_user'),
        ]

    def clean(self):
        if self.tenant_id and self.tenant.organization_id != self.organization_id:
            raise ValidationError('Portal tenant must belong to the same organization.')
        if self.user_id and self.organization_id:
            from organizations.models import Membership
            if not Membership.objects.active().filter(user_id=self.user_id, organization_id=self.organization_id).exists():
                raise ValidationError('Portal user must be an active organization member.')


class Lease(OrganizationOwnedModel):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        ACTIVE = 'active', 'Active'
        EXPIRING = 'expiring', 'Expiring'
        EXPIRED = 'expired', 'Expired'
        TERMINATED = 'terminated', 'Terminated'

    reference = models.CharField(max_length=60)
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name='leases')
    tenant = models.ForeignKey(Tenant, on_delete=models.PROTECT, related_name='leases')
    starts_on = models.DateField()
    ends_on = models.DateField()
    monthly_rent = models.DecimalField(max_digits=14, decimal_places=2)
    deposit = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    escalation_percent = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    billing_day = models.PositiveSmallIntegerField(default=1)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    metadata = models.JSONField(default=dict, blank=True)
    renewed_from = models.OneToOneField('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='renewal')

    class Meta:
        ordering = ('-starts_on',)
        constraints = [models.UniqueConstraint(fields=('organization', 'reference'), name='unique_organization_lease_reference')]

    def clean(self):
        if self.ends_on and self.starts_on and self.ends_on <= self.starts_on:
            raise ValidationError({'ends_on': 'Lease end date must be after its start date.'})
        if self.unit_id and self.unit.organization_id != self.organization_id:
            raise ValidationError('Lease unit must belong to the same organization.')
        if self.tenant_id and self.tenant.organization_id != self.organization_id:
            raise ValidationError('Lease tenant must belong to the same organization.')
        if self.renewed_from_id and self.renewed_from.organization_id != self.organization_id:
            raise ValidationError('Renewed lease must belong to the same organization.')
        if self.monthly_rent <= 0:
            raise ValidationError({'monthly_rent': 'Monthly rent must be greater than zero.'})
        if self.deposit < 0 or self.escalation_percent < 0:
            raise ValidationError('Deposit and escalation cannot be negative.')
        if not 1 <= self.billing_day <= 28:
            raise ValidationError({'billing_day': 'Billing day must be between 1 and 28.'})

    def __str__(self):
        return self.reference


class Invoice(OrganizationOwnedModel):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        REVIEW = 'review', 'In review'
        APPROVED = 'approved', 'Approved'
        ISSUED = 'issued', 'Issued'
        PARTIAL = 'partial', 'Partially paid'
        PAID = 'paid', 'Paid'
        OVERDUE = 'overdue', 'Overdue'
        VOID = 'void', 'Void'

    number = models.CharField(max_length=60)
    lease = models.ForeignKey(Lease, on_delete=models.PROTECT, related_name='invoices')
    invoice_type = models.CharField(max_length=40, default='rent')
    issued_on = models.DateField()
    due_on = models.DateField()
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    balance = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    metadata = models.JSONField(default=dict, blank=True)
    prepared_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='prepared_property_invoices')
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_property_invoices')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    issued_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='issued_property_invoices')
    issued_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-issued_on',)
        constraints = [models.UniqueConstraint(fields=('organization', 'number'), name='unique_organization_invoice_number')]

    def clean(self):
        if self.subtotal == 0 and self.amount > 0 and self.tax_amount == 0:
            self.subtotal = self.amount
        if self.lease_id and self.lease.organization_id != self.organization_id:
            raise ValidationError('Invoice lease must belong to the same organization.')
        if self.amount <= 0:
            raise ValidationError({'amount': 'Invoice amount must be greater than zero.'})
        if self.balance < 0 or self.balance > self.amount:
            raise ValidationError({'balance': 'Invoice balance must be between zero and the invoice amount.'})
        if self.due_on < self.issued_on:
            raise ValidationError({'due_on': 'Due date cannot be before the issue date.'})
        if self.tax_rate not in (0, 16):
            raise ValidationError({'tax_rate': 'Supported VAT rates are 0% and 16%.'})
        if self.subtotal + self.tax_amount != self.amount:
            raise ValidationError({'amount': 'Invoice total must equal subtotal plus tax.'})


class Receipt(OrganizationOwnedModel):
    number = models.CharField(max_length=60)
    tenant = models.ForeignKey(Tenant, on_delete=models.PROTECT, related_name='receipts')
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name='receipts', null=True, blank=True)
    received_on = models.DateField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    payment_method = models.CharField(max_length=40)
    external_reference = models.CharField(max_length=120, blank=True)
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='property_receipts')

    class Meta:
        ordering = ('-received_on',)
        constraints = [models.UniqueConstraint(fields=('organization', 'number'), name='unique_organization_receipt_number')]

    def clean(self):
        if self.tenant_id and self.tenant.organization_id != self.organization_id:
            raise ValidationError('Receipt tenant must belong to the same organization.')
        if self.invoice_id and self.invoice.organization_id != self.organization_id:
            raise ValidationError('Receipt invoice must belong to the same organization.')
        if self.amount <= 0:
            raise ValidationError({'amount': 'Receipt amount must be greater than zero.'})


class InvoiceReminder(OrganizationOwnedModel):
    class Channel(models.TextChoices):
        EMAIL = 'email', 'Email'
        SMS = 'sms', 'SMS'
        PORTAL = 'portal', 'Tenant portal'

    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name='reminders')
    channel = models.CharField(max_length=12, choices=Channel.choices)
    recipient = models.CharField(max_length=200)
    message = models.TextField()
    sent_at = models.DateTimeField()
    sent_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='sent_property_reminders')

    class Meta:
        ordering = ('-sent_at',)

    def clean(self):
        if self.invoice_id and self.invoice.organization_id != self.organization_id:
            raise ValidationError('Reminder invoice must belong to the same organization.')


class BankTransaction(OrganizationOwnedModel):
    class Status(models.TextChoices):
        UNMATCHED = 'unmatched', 'Unmatched'
        MATCHED = 'matched', 'Matched'
        IGNORED = 'ignored', 'Ignored'

    reference = models.CharField(max_length=120)
    transacted_on = models.DateField()
    description = models.CharField(max_length=250, blank=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.UNMATCHED)
    receipt = models.OneToOneField(Receipt, on_delete=models.PROTECT, null=True, blank=True, related_name='bank_transaction')
    matched_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='matched_property_bank_transactions')
    matched_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-transacted_on',)
        constraints = [models.UniqueConstraint(fields=('organization', 'reference'), name='unique_organization_bank_reference')]

    def clean(self):
        if self.amount <= 0:
            raise ValidationError({'amount': 'Transaction amount must be greater than zero.'})
        if self.receipt_id and self.receipt.organization_id != self.organization_id:
            raise ValidationError('Matched receipt must belong to the same organization.')
        if self.receipt_id and self.receipt.amount != self.amount:
            raise ValidationError({'receipt': 'Receipt amount must equal the bank transaction amount.'})


class Expense(OrganizationOwnedModel):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PENDING = 'pending', 'Pending approval'
        APPROVED = 'approved', 'Approved'
        PAID = 'paid', 'Paid'
        REJECTED = 'rejected', 'Rejected'

    property = models.ForeignKey(Property, on_delete=models.PROTECT, related_name='expenses')
    supplier = models.CharField(max_length=200)
    category = models.CharField(max_length=80)
    invoice_number = models.CharField(max_length=80, blank=True)
    incurred_on = models.DateField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ('-incurred_on',)

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Expense property must belong to the same organization.')
        if self.amount <= 0:
            raise ValidationError({'amount': 'Expense amount must be greater than zero.'})


class Budget(OrganizationOwnedModel):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PENDING = 'pending', 'Pending approval'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='budgets')
    year = models.PositiveSmallIntegerField()
    category = models.CharField(max_length=80)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_property_budgets')
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-year', 'category')
        constraints = [models.UniqueConstraint(fields=('property', 'year', 'category'), name='unique_property_budget_category')]

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Budget property must belong to the same organization.')
        if self.amount < 0:
            raise ValidationError({'amount': 'Budget amount cannot be negative.'})


class ServiceCharge(OrganizationOwnedModel):
    class Method(models.TextChoices):
        AREA = 'area', 'Floor area'
        EQUAL = 'equal', 'Equal share'
        FIXED = 'fixed', 'Fixed amount'

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='service_charges')
    name = models.CharField(max_length=160)
    method = models.CharField(max_length=16, choices=Method.choices, default=Method.AREA)
    annual_budget = models.DecimalField(max_digits=14, decimal_places=2)
    starts_on = models.DateField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ('-starts_on',)

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Service charge property must belong to the same organization.')
        if self.annual_budget < 0:
            raise ValidationError({'annual_budget': 'Annual budget cannot be negative.'})


class ServiceChargeAllocation(OrganizationOwnedModel):
    service_charge = models.ForeignKey(ServiceCharge, on_delete=models.CASCADE, related_name='allocations')
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name='service_charge_allocations')
    ratio = models.DecimalField(max_digits=9, decimal_places=6)
    annual_amount = models.DecimalField(max_digits=14, decimal_places=2)
    monthly_amount = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        ordering = ('service_charge__name', 'unit__code')
        constraints = [models.UniqueConstraint(
            fields=('service_charge', 'unit'), name='unique_service_charge_unit_allocation',
        )]

    def clean(self):
        if self.service_charge_id and self.service_charge.organization_id != self.organization_id:
            raise ValidationError('Service charge allocation must belong to the same organization.')
        if self.unit_id and self.unit.organization_id != self.organization_id:
            raise ValidationError('Allocated unit must belong to the same organization.')
        if self.service_charge_id and self.unit_id and self.service_charge.property_id != self.unit.property_id:
            raise ValidationError({'unit': 'Unit must belong to the service charge property.'})
        if not 0 <= self.ratio <= 1:
            raise ValidationError({'ratio': 'Allocation ratio must be between zero and one.'})


class ServiceChargeReconciliation(OrganizationOwnedModel):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        REVIEWED = 'reviewed', 'Reviewed'
        APPROVED = 'approved', 'Approved'

    service_charge = models.ForeignKey(ServiceCharge, on_delete=models.PROTECT, related_name='reconciliations')
    period_start = models.DateField()
    period_end = models.DateField()
    budgeted_amount = models.DecimalField(max_digits=14, decimal_places=2)
    actual_amount = models.DecimalField(max_digits=14, decimal_places=2)
    variance = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    prepared_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='prepared_service_charge_reconciliations')
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_service_charge_reconciliations')
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-period_end',)
        constraints = [models.UniqueConstraint(
            fields=('service_charge', 'period_start', 'period_end'), name='unique_service_charge_reconciliation_period',
        )]

    def clean(self):
        if self.service_charge_id and self.service_charge.organization_id != self.organization_id:
            raise ValidationError('Service charge reconciliation must belong to the same organization.')
        if self.period_end < self.period_start:
            raise ValidationError({'period_end': 'Period end cannot be before period start.'})
        if self.variance != self.budgeted_amount - self.actual_amount:
            raise ValidationError({'variance': 'Variance must equal budget less actual expenditure.'})


class TenantDocument(OrganizationOwnedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending review'
        VERIFIED = 'verified', 'Verified'
        REJECTED = 'rejected', 'Rejected'
        EXPIRED = 'expired', 'Expired'

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=60)
    document_number = models.CharField(max_length=100, blank=True)
    file_url = models.CharField(max_length=500)
    issued_on = models.DateField(null=True, blank=True)
    expires_on = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_tenant_documents')
    verified_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    class Meta:
        ordering = ('tenant__name', 'document_type')
        constraints = [models.UniqueConstraint(fields=('tenant', 'document_type', 'document_number'), name='unique_tenant_document_identity')]

    def clean(self):
        if self.tenant_id and self.tenant.organization_id != self.organization_id:
            raise ValidationError('Tenant document must belong to the same organization.')
        if self.expires_on and self.issued_on and self.expires_on <= self.issued_on:
            raise ValidationError({'expires_on': 'Expiry must be after the issue date.'})


class RentSchedule(OrganizationOwnedModel):
    class Status(models.TextChoices):
        UPCOMING = 'upcoming', 'Upcoming'
        INVOICED = 'invoiced', 'Invoiced'
        PAID = 'paid', 'Paid'
        WAIVED = 'waived', 'Waived'

    lease = models.ForeignKey(Lease, on_delete=models.CASCADE, related_name='rent_schedule')
    period_start = models.DateField()
    period_end = models.DateField()
    due_on = models.DateField()
    base_rent = models.DecimalField(max_digits=14, decimal_places=2)
    escalation_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    service_charge = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.UPCOMING)
    invoice = models.OneToOneField(Invoice, on_delete=models.SET_NULL, null=True, blank=True, related_name='rent_schedule_item')

    class Meta:
        ordering = ('period_start',)
        constraints = [models.UniqueConstraint(fields=('lease', 'period_start'), name='unique_lease_rent_period')]

    def clean(self):
        if self.lease_id and self.lease.organization_id != self.organization_id:
            raise ValidationError('Rent schedule lease must belong to the same organization.')
        if self.period_end <= self.period_start:
            raise ValidationError({'period_end': 'Period end must be after period start.'})
        expected = self.base_rent + self.escalation_amount + self.service_charge
        if self.total != expected:
            raise ValidationError({'total': 'Total must equal rent, escalation and service charge.'})
        if min(self.base_rent, self.escalation_amount, self.service_charge, self.total) < 0:
            raise ValidationError('Rent schedule amounts cannot be negative.')


class ReceiptAllocation(OrganizationOwnedModel):
    receipt = models.ForeignKey(Receipt, on_delete=models.PROTECT, related_name='allocations')
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name='receipt_allocations')
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    allocated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='property_receipt_allocations')

    class Meta:
        ordering = ('created_at',)
        constraints = [models.UniqueConstraint(fields=('receipt', 'invoice'), name='unique_receipt_invoice_allocation')]

    def clean(self):
        if self.receipt_id and self.receipt.organization_id != self.organization_id:
            raise ValidationError('Receipt allocation must belong to the same organization.')
        if self.invoice_id and self.invoice.organization_id != self.organization_id:
            raise ValidationError('Allocated invoice must belong to the same organization.')
        if self.receipt_id and self.invoice_id and self.receipt.tenant_id != self.invoice.lease.tenant_id:
            raise ValidationError({'invoice': 'Receipt and invoice must belong to the same tenant.'})
        if self.amount <= 0:
            raise ValidationError({'amount': 'Allocation must be greater than zero.'})


class CreditNote(OrganizationOwnedModel):
    class Status(models.TextChoices):
        ISSUED = 'issued', 'Issued'
        VOID = 'void', 'Void'

    number = models.CharField(max_length=60)
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name='credit_notes')
    issued_on = models.DateField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    reason = models.TextField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ISSUED)
    issued_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='property_credit_notes')
    void_reason = models.TextField(blank=True)

    class Meta:
        ordering = ('-issued_on',)
        constraints = [models.UniqueConstraint(fields=('organization', 'number'), name='unique_organization_credit_note_number')]

    def clean(self):
        if self.invoice_id and self.invoice.organization_id != self.organization_id:
            raise ValidationError('Credit note invoice must belong to the same organization.')
        if self.amount <= 0:
            raise ValidationError({'amount': 'Credit amount must be greater than zero.'})
