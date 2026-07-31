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
    name = models.CharField(max_length=200)
    tenant_type = models.CharField(max_length=40, default='company')
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    tax_id = models.CharField(max_length=80, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PROSPECT)
    billing_address = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('name',)
        constraints = [models.UniqueConstraint(fields=('organization', 'code'), name='unique_organization_tenant_code')]

    def __str__(self):
        return f'{self.code} — {self.name}'


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

    def __str__(self):
        return self.reference


class Invoice(OrganizationOwnedModel):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
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
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    balance = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('-issued_on',)
        constraints = [models.UniqueConstraint(fields=('organization', 'number'), name='unique_organization_invoice_number')]

    def clean(self):
        if self.lease_id and self.lease.organization_id != self.organization_id:
            raise ValidationError('Invoice lease must belong to the same organization.')


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


class Budget(OrganizationOwnedModel):
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='budgets')
    year = models.PositiveSmallIntegerField()
    category = models.CharField(max_length=80)
    amount = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        ordering = ('-year', 'category')
        constraints = [models.UniqueConstraint(fields=('property', 'year', 'category'), name='unique_property_budget_category')]

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Budget property must belong to the same organization.')


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
