from decimal import Decimal

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
        constraints = [
            models.UniqueConstraint(
                fields=('organization', 'code'), name='unique_organization_property_code'
            ),
            models.UniqueConstraint(
                fields=('organization', 'name'), name='unique_organization_property_name'
            ),
        ]

    def clean(self):
        super().clean()
        if self.name and self.organization_id:
            qs = Property.objects.filter(
                organization_id=self.organization_id,
                name__iexact=self.name.strip()
            )
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                raise ValidationError({'name': f'A property named "{self.name}" already exists in this organization.'})

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


class ParkingSpace(OrganizationOwnedModel):
    class Status(models.TextChoices):
        AVAILABLE = 'available', 'Available'
        ASSIGNED = 'assigned', 'Assigned'
        RESERVED = 'reserved', 'Reserved'
        MAINTENANCE = 'maintenance', 'Maintenance'
        BLOCKED = 'blocked', 'Blocked'

    class SpaceType(models.TextChoices):
        STANDARD = 'standard', 'Standard'
        ACCESSIBLE = 'accessible', 'Accessible'
        VISITOR = 'visitor', 'Visitor'
        MOTORCYCLE = 'motorcycle', 'Motorcycle'
        LOADING = 'loading', 'Loading bay'

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='parking_spaces')
    building = models.ForeignKey(Building, on_delete=models.SET_NULL, related_name='parking_spaces', null=True, blank=True)
    unit = models.ForeignKey(Unit, on_delete=models.SET_NULL, related_name='parking_spaces', null=True, blank=True)
    code = models.CharField(max_length=40)
    floor_or_zone = models.CharField(max_length=80, blank=True)
    space_type = models.CharField(max_length=20, choices=SpaceType.choices, default=SpaceType.STANDARD)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('property__name', 'code')
        constraints = [models.UniqueConstraint(fields=('property', 'code'), name='unique_property_parking_code')]

    def clean(self):
        if self.property_id and self.organization_id != self.property.organization_id:
            raise ValidationError('Parking space and property must belong to the same organization.')
        if self.building_id and self.building.property_id != self.property_id:
            raise ValidationError({'building': 'The building must belong to the selected property.'})
        if self.unit_id and self.unit.property_id != self.property_id:
            raise ValidationError({'unit': 'The unit must belong to the selected property.'})

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
    escalation_interval_months = models.PositiveSmallIntegerField(default=12)
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
        if self.escalation_percent and not 1 <= self.escalation_interval_months <= 120:
            raise ValidationError({'escalation_interval_months': 'Escalation frequency must be between 1 and 120 months.'})
        if not 1 <= self.billing_day <= 28:
            raise ValidationError({'billing_day': 'Billing day must be between 1 and 28.'})

    def __str__(self):
        return self.reference

    def effective_rent(self, as_of):
        """Return compound rent effective on a date within this lease term."""
        explicit = self.escalations.filter(effective_on__lte=as_of, status=LeaseEscalation.Status.APPROVED).order_by('-effective_on').first()
        if explicit:
            return explicit.new_monthly_rent
        if as_of < self.starts_on:
            return self.monthly_rent
        elapsed_months = (as_of.year - self.starts_on.year) * 12 + as_of.month - self.starts_on.month
        if as_of.day < self.starts_on.day:
            elapsed_months -= 1
        steps = elapsed_months // max(self.escalation_interval_months, 1) if self.escalation_percent else 0
        multiplier = (Decimal('1') + self.escalation_percent / Decimal('100')) ** steps
        return (self.monthly_rent * multiplier).quantize(Decimal('0.01'))


class LeaseEscalation(OrganizationOwnedModel):
    class Status(models.TextChoices):
        PLANNED = 'planned', 'Planned'
        APPROVED = 'approved', 'Approved'
        CANCELLED = 'cancelled', 'Cancelled'

    lease = models.ForeignKey(Lease, on_delete=models.CASCADE, related_name='escalations')
    effective_on = models.DateField()
    previous_monthly_rent = models.DecimalField(max_digits=14, decimal_places=2)
    new_monthly_rent = models.DecimalField(max_digits=14, decimal_places=2)
    percentage = models.DecimalField(max_digits=7, decimal_places=3, default=0)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PLANNED)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_lease_escalations')
    approved_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ('effective_on',)
        constraints = [models.UniqueConstraint(fields=('lease', 'effective_on'), name='unique_lease_escalation_date')]

    def clean(self):
        if self.lease_id and self.lease.organization_id != self.organization_id:
            raise ValidationError('Lease escalation must belong to the lease organization.')
        if self.lease_id and not self.lease.starts_on <= self.effective_on < self.lease.ends_on:
            raise ValidationError({'effective_on': 'Escalation must fall within the lease term.'})
        if self.previous_monthly_rent <= 0 or self.new_monthly_rent <= 0:
            raise ValidationError('Escalation rent values must be greater than zero.')


class UnitStatusHistory(OrganizationOwnedModel):
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name='status_history')
    status = models.CharField(max_length=20, choices=Unit.Status.choices)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    reason = models.CharField(max_length=160, blank=True)
    marketing_status = models.CharField(max_length=80, blank=True)
    expected_monthly_rent = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    expected_service_charge = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='recorded_unit_statuses')

    class Meta:
        ordering = ('-effective_from', '-created_at')
        constraints = [models.UniqueConstraint(fields=('unit', 'effective_from'), name='unique_unit_status_effective_date')]

    def clean(self):
        if self.unit_id and self.unit.organization_id != self.organization_id:
            raise ValidationError('Unit status history must belong to the unit organization.')
        if self.effective_to and self.effective_to < self.effective_from:
            raise ValidationError({'effective_to': 'End date cannot be before the effective date.'})

    def delete(self, *args, **kwargs):
        raise TypeError('Unit status history is immutable.')


class TenantMovement(OrganizationOwnedModel):
    class Kind(models.TextChoices):
        MOVE_IN = 'move_in', 'Move in'
        MOVE_OUT = 'move_out', 'Move out'
        TRANSFER = 'transfer', 'Transfer'

    tenant = models.ForeignKey(Tenant, on_delete=models.PROTECT, related_name='movements')
    lease = models.ForeignKey(Lease, on_delete=models.PROTECT, related_name='movements')
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name='tenant_movements')
    kind = models.CharField(max_length=12, choices=Kind.choices)
    effective_on = models.DateField()
    reason = models.CharField(max_length=200, blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='recorded_tenant_movements')

    class Meta:
        ordering = ('-effective_on', '-created_at')
        constraints = [models.UniqueConstraint(fields=('lease', 'kind', 'effective_on'), name='unique_lease_movement_event')]

    def clean(self):
        if any(record.organization_id != self.organization_id for record in (self.tenant, self.lease, self.unit)):
            raise ValidationError('Tenant movement records must belong to one organization.')
        if self.lease.tenant_id != self.tenant_id or self.lease.unit_id != self.unit_id:
            raise ValidationError('Movement tenant and unit must match the selected lease.')

    def delete(self, *args, **kwargs):
        raise TypeError('Tenant movement history is immutable.')


class TaxConfiguration(OrganizationOwnedModel):
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=100)
    rate = models.DecimalField(max_digits=7, decimal_places=4)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_input_tax = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ('code', '-effective_from')
        constraints = [models.UniqueConstraint(fields=('organization', 'code', 'effective_from'), name='unique_tax_code_effective_date')]

    def clean(self):
        if self.rate < 0 or self.rate > 100:
            raise ValidationError({'rate': 'Tax rate must be between 0 and 100 percent.'})
        if self.effective_to and self.effective_to < self.effective_from:
            raise ValidationError({'effective_to': 'End date cannot precede the effective date.'})


class BillingItem(OrganizationOwnedModel):
    class Calculation(models.TextChoices):
        FIXED = 'fixed', 'Fixed amount'
        AREA_RATE = 'area_rate', 'Rate per area'
        METERED = 'metered', 'Meter consumption'
        PERCENTAGE = 'percentage', 'Percentage'
        MANUAL = 'manual', 'Authorized manual amount'

    code = models.CharField(max_length=40)
    name = models.CharField(max_length=120)
    calculation = models.CharField(max_length=16, choices=Calculation.choices, default=Calculation.FIXED)
    income_category = models.CharField(max_length=80, blank=True)
    tax_configuration = models.ForeignKey(TaxConfiguration, on_delete=models.PROTECT, related_name='billing_items', null=True, blank=True)
    is_recurring = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('name',)
        constraints = [models.UniqueConstraint(fields=('organization', 'code'), name='unique_organization_billing_item_code')]


class BillingProfile(OrganizationOwnedModel):
    class Frequency(models.TextChoices):
        MONTHLY = 'monthly', 'Monthly'
        QUARTERLY = 'quarterly', 'Quarterly'
        BIANNUAL = 'biannual', 'Biannual'
        ANNUAL = 'annual', 'Annual'
        ONE_OFF = 'one_off', 'One-off'
        METERED = 'metered', 'Meter-based'
        EVENT = 'event', 'Event-based'
        CUSTOM = 'custom', 'Custom schedule'

    lease = models.ForeignKey(Lease, on_delete=models.CASCADE, related_name='billing_profiles')
    billing_item = models.ForeignKey(BillingItem, on_delete=models.PROTECT, related_name='profiles')
    frequency = models.CharField(max_length=16, choices=Frequency.choices, default=Frequency.MONTHLY)
    calculation = models.CharField(max_length=16, choices=BillingItem.Calculation.choices, default=BillingItem.Calculation.FIXED)
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    rate = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    billing_day = models.PositiveSmallIntegerField(default=1)
    custom_interval_months = models.PositiveSmallIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    instructions = models.TextField(blank=True)

    class Meta:
        ordering = ('lease__reference', 'billing_item__name', '-effective_from')
        constraints = [models.UniqueConstraint(fields=('lease', 'billing_item', 'effective_from'), name='unique_billing_profile_effective_date')]

    def clean(self):
        if self.lease_id and self.lease.organization_id != self.organization_id:
            raise ValidationError('Billing profile must belong to the lease organization.')
        if self.billing_item_id and self.billing_item.organization_id != self.organization_id:
            raise ValidationError('Billing item must belong to the profile organization.')
        if not 1 <= self.billing_day <= 28:
            raise ValidationError({'billing_day': 'Billing day must be between 1 and 28.'})
        if self.effective_to and self.effective_to < self.effective_from:
            raise ValidationError({'effective_to': 'End date cannot precede the effective date.'})


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
        if self.tax_rate < 0 or self.tax_rate > 100:
            raise ValidationError({'tax_rate': 'Tax rate must be between 0 and 100 percent.'})
        if self.subtotal + self.tax_amount != self.amount:
            raise ValidationError({'amount': 'Invoice total must equal subtotal plus tax.'})


class BillingRun(OrganizationOwnedModel):
    class Status(models.TextChoices):
        PREPARING = 'preparing', 'Preparing'
        REVIEW = 'review', 'Under review'
        APPROVED = 'approved', 'Approved'
        GENERATED = 'generated', 'Generated'
        CANCELLED = 'cancelled', 'Cancelled'

    period_start = models.DateField()
    period_end = models.DateField()
    property = models.ForeignKey(Property, on_delete=models.PROTECT, related_name='billing_runs', null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PREPARING)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_billing_runs')
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_billing_runs')
    approved_at = models.DateTimeField(null=True, blank=True)
    generated_at = models.DateTimeField(null=True, blank=True)
    totals = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('-period_start', '-created_at')
        constraints = [models.UniqueConstraint(fields=('organization', 'property', 'period_start'), name='unique_property_billing_run_period')]

    def clean(self):
        if self.period_end < self.period_start:
            raise ValidationError({'period_end': 'Billing period end cannot precede its start.'})
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Billing run property must belong to the organization.')


class BillingReadinessIssue(OrganizationOwnedModel):
    class Severity(models.TextChoices):
        WARNING = 'warning', 'Warning'
        BLOCKING = 'blocking', 'Blocking'
    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        RESOLVED = 'resolved', 'Resolved'
        OVERRIDDEN = 'overridden', 'Authorized override'

    billing_run = models.ForeignKey(BillingRun, on_delete=models.CASCADE, related_name='issues')
    lease = models.ForeignKey(Lease, on_delete=models.PROTECT, related_name='billing_issues', null=True, blank=True)
    billing_profile = models.ForeignKey(BillingProfile, on_delete=models.PROTECT, related_name='readiness_issues', null=True, blank=True)
    code = models.CharField(max_length=60)
    message = models.CharField(max_length=250)
    severity = models.CharField(max_length=12, choices=Severity.choices, default=Severity.BLOCKING)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN)
    resolution_notes = models.TextField(blank=True)
    resolved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='resolved_billing_issues')
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('status', '-severity', 'created_at')
        constraints = [models.UniqueConstraint(fields=('billing_run', 'lease', 'billing_profile', 'code'), name='unique_billing_readiness_issue')]


class BillingCandidate(OrganizationOwnedModel):
    class Status(models.TextChoices):
        READY = 'ready', 'Ready'
        ISSUE = 'issue', 'Has issues'
        GENERATED = 'generated', 'Generated'
        EXCLUDED = 'excluded', 'Excluded'

    billing_run = models.ForeignKey(BillingRun, on_delete=models.CASCADE, related_name='candidates')
    lease = models.ForeignKey(Lease, on_delete=models.PROTECT, related_name='billing_candidates')
    invoice_date = models.DateField()
    due_date = models.DateField()
    billing_items = models.JSONField(default=list)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.READY)
    issue_summary = models.JSONField(default=list, blank=True)
    exclusion_reason = models.TextField(blank=True)
    excluded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='excluded_billing_candidates')
    invoice = models.OneToOneField(Invoice, on_delete=models.PROTECT, null=True, blank=True, related_name='billing_candidate')

    class Meta:
        ordering = ('lease__tenant__name',)
        constraints = [models.UniqueConstraint(fields=('billing_run', 'lease'), name='unique_billing_run_lease_candidate')]

    def clean(self):
        if self.billing_run_id and self.billing_run.organization_id != self.organization_id:
            raise ValidationError('Billing candidate must belong to the billing-run organization.')
        if self.lease_id and self.lease.organization_id != self.organization_id:
            raise ValidationError('Billing candidate must belong to the lease organization.')
        if self.total != self.subtotal + self.tax_amount:
            raise ValidationError({'total': 'Candidate total must equal subtotal plus tax.'})


class InvoiceLine(OrganizationOwnedModel):
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name='lines')
    billing_item = models.ForeignKey(BillingItem, on_delete=models.PROTECT, related_name='invoice_lines', null=True, blank=True)
    description = models.CharField(max_length=200)
    quantity = models.DecimalField(max_digits=14, decimal_places=4, default=1)
    unit_rate = models.DecimalField(max_digits=14, decimal_places=4)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    tax_code = models.CharField(max_length=30, blank=True)
    tax_rate = models.DecimalField(max_digits=7, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    source_type = models.CharField(max_length=40, blank=True)
    source_id = models.CharField(max_length=80, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('created_at',)

    def clean(self):
        if self.invoice_id and self.invoice.organization_id != self.organization_id:
            raise ValidationError('Invoice line must belong to the invoice organization.')
        if self.billing_item_id and self.billing_item.organization_id != self.organization_id:
            raise ValidationError('Billing item must belong to the invoice organization.')
        if min(self.quantity, self.unit_rate, self.subtotal, self.tax_rate, self.tax_amount, self.total) < 0:
            raise ValidationError('Invoice line values cannot be negative.')
        if self.subtotal + self.tax_amount != self.total:
            raise ValidationError({'total': 'Line total must equal subtotal plus tax.'})


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


class PaymentGatewayConfiguration(OrganizationOwnedModel):
    """Property-level gateway routing without storing provider secrets in the database."""
    class Provider(models.TextChoices):
        ECITIZEN = 'ecitizen', 'eCitizen'
        MPESA = 'mpesa', 'M-Pesa'
        BANK = 'bank', 'Bank gateway'
        OTHER = 'other', 'Other gateway'

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='payment_gateways')
    provider = models.CharField(max_length=24, choices=Provider.choices)
    display_name = models.CharField(max_length=100)
    public_key = models.UUIDField(default=__import__('uuid').uuid4, unique=True, editable=False)
    merchant_reference = models.CharField(max_length=120, blank=True)
    checkout_url_template = models.URLField(blank=True, help_text='Provider-approved URL template with {reference}, {amount}, {invoice} placeholders.')
    webhook_secret_env = models.CharField(max_length=120, blank=True, help_text='Environment variable containing the callback signing secret.')
    is_enabled = models.BooleanField(default=False)
    settings = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('property__name', 'provider')
        constraints = [models.UniqueConstraint(fields=('property', 'provider'), name='unique_property_payment_gateway')]

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Payment gateway property must belong to the same organization.')
        if self.is_enabled and self.provider != self.Provider.MPESA and (not self.checkout_url_template or not self.webhook_secret_env):
            raise ValidationError('Enabled gateways require a checkout URL template and webhook secret environment key.')


class PaymentIntent(OrganizationOwnedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        REDIRECTED = 'redirected', 'Redirected'
        PAID = 'paid', 'Paid'
        FAILED = 'failed', 'Failed'
        EXPIRED = 'expired', 'Expired'
        CANCELLED = 'cancelled', 'Cancelled'

    configuration = models.ForeignKey(PaymentGatewayConfiguration, on_delete=models.PROTECT, related_name='payment_intents')
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name='payment_intents')
    tenant = models.ForeignKey(Tenant, on_delete=models.PROTECT, related_name='payment_intents')
    reference = models.CharField(max_length=80)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    checkout_url = models.URLField(blank=True)
    external_reference = models.CharField(max_length=160, blank=True)
    error_message = models.TextField(blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('-created_at',)
        constraints = [models.UniqueConstraint(fields=('organization', 'reference'), name='unique_organization_payment_intent_reference')]

    def clean(self):
        if self.configuration_id and self.configuration.organization_id != self.organization_id:
            raise ValidationError('Payment intent gateway must belong to the same organization.')
        if self.invoice_id and self.invoice.organization_id != self.organization_id:
            raise ValidationError('Payment intent invoice must belong to the same organization.')
        if self.configuration_id and self.invoice_id and self.configuration.property_id != self.invoice.lease.unit.property_id:
            raise ValidationError('Payment intent gateway must belong to the invoiced property.')
        if self.tenant_id and self.invoice_id and self.invoice.lease.tenant_id != self.tenant_id:
            raise ValidationError('Payment intent tenant must own the invoice.')
        if self.amount <= 0:
            raise ValidationError({'amount': 'Payment amount must be greater than zero.'})


class PaymentWebhookEvent(OrganizationOwnedModel):
    class Status(models.TextChoices):
        RECEIVED = 'received', 'Received'
        PROCESSED = 'processed', 'Processed'
        REJECTED = 'rejected', 'Rejected'

    configuration = models.ForeignKey(PaymentGatewayConfiguration, on_delete=models.PROTECT, related_name='webhook_events')
    event_id = models.CharField(max_length=160)
    payload_hash = models.CharField(max_length=64)
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.RECEIVED)
    error_message = models.TextField(blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)
        constraints = [models.UniqueConstraint(fields=('configuration', 'event_id'), name='unique_gateway_webhook_event')]


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
    taxable_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax_code = models.CharField(max_length=30, blank=True)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    cost_centre = models.CharField(max_length=80, blank=True)
    budget_code = models.CharField(max_length=80, blank=True)
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
    version = models.PositiveSmallIntegerField(default=1)
    revised_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    forecast_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_property_budgets')
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-year', 'category')
        constraints = [models.UniqueConstraint(fields=('property', 'year', 'category', 'version'), name='unique_property_budget_category_version')]

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
    file_url = models.CharField(max_length=500, blank=True, default='')
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


class ReportDefinition(OrganizationOwnedModel):
    class Domain(models.TextChoices):
        TENANCY = 'tenancy', 'Tenancy and occupancy'
        FINANCIAL = 'financial', 'Financial'
        BILLING = 'billing', 'Billing'

    key = models.CharField(max_length=80)
    name = models.CharField(max_length=160)
    domain = models.CharField(max_length=16, choices=Domain.choices)
    description = models.TextField(blank=True)
    selected_fields = models.JSONField(default=list, blank=True)
    default_filters = models.JSONField(default=dict, blank=True)
    grouping = models.JSONField(default=list, blank=True)
    sorting = models.JSONField(default=list, blank=True)
    is_standard = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_report_definitions')

    class Meta:
        ordering = ('domain', 'name')
        constraints = [models.UniqueConstraint(fields=('organization', 'key'), name='unique_organization_report_definition')]


class ReportExecution(OrganizationOwnedModel):
    class Status(models.TextChoices):
        QUEUED = 'queued', 'Queued'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    definition = models.ForeignKey(ReportDefinition, on_delete=models.PROTECT, related_name='executions', null=True, blank=True)
    report_key = models.CharField(max_length=80)
    property = models.ForeignKey(Property, on_delete=models.PROTECT, related_name='report_executions', null=True, blank=True)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    filters = models.JSONField(default=dict, blank=True)
    output_format = models.CharField(max_length=12, choices=(('pdf', 'PDF'), ('csv', 'CSV'), ('xlsx', 'Excel')), default='pdf')
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.QUEUED)
    generated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='generated_property_reports')
    generated_at = models.DateTimeField(null=True, blank=True)
    file = models.FileField(upload_to='property/reports/%Y/%m/', blank=True)
    row_count = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ('-created_at',)


class ScheduledReport(OrganizationOwnedModel):
    class Frequency(models.TextChoices):
        DAILY = 'daily', 'Daily'
        WEEKLY = 'weekly', 'Weekly'
        MONTHLY = 'monthly', 'Monthly'
        QUARTERLY = 'quarterly', 'Quarterly'

    definition = models.ForeignKey(ReportDefinition, on_delete=models.PROTECT, related_name='schedules')
    property = models.ForeignKey(Property, on_delete=models.PROTECT, related_name='scheduled_reports', null=True, blank=True)
    frequency = models.CharField(max_length=12, choices=Frequency.choices, default=Frequency.MONTHLY)
    next_run_at = models.DateTimeField()
    recipients = models.JSONField(default=list)
    filters = models.JSONField(default=dict, blank=True)
    output_format = models.CharField(max_length=12, choices=(('pdf', 'PDF'), ('csv', 'CSV'), ('xlsx', 'Excel')), default='pdf')
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_scheduled_reports')
    last_execution = models.ForeignKey(ReportExecution, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    last_delivery_at = models.DateTimeField(null=True, blank=True)
    last_delivery_status = models.CharField(max_length=24, blank=True)
    last_delivery_error = models.TextField(blank=True)

    class Meta:
        ordering = ('next_run_at',)

    def clean(self):
        if self.definition_id and self.definition.organization_id != self.organization_id:
            raise ValidationError('Scheduled report must belong to the definition organization.')
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Scheduled report property must belong to the organization.')
        if not isinstance(self.recipients, list) or not all(isinstance(value, str) for value in self.recipients):
            raise ValidationError({'recipients': 'Recipients must be a list of email addresses.'})
