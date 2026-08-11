from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from core.models import OrganizationOwnedModel


class FacilityAsset(OrganizationOwnedModel):
    class Condition(models.TextChoices):
        EXCELLENT = 'excellent', 'Excellent'
        GOOD = 'good', 'Good'
        FAIR = 'fair', 'Fair'
        POOR = 'poor', 'Poor'
        OUT_OF_SERVICE = 'out_of_service', 'Out of service'

    code = models.CharField(max_length=50)
    name = models.CharField(max_length=180)
    category = models.CharField(max_length=80)
    property = models.ForeignKey('properties.Property', on_delete=models.PROTECT, related_name='facility_assets')
    building = models.ForeignKey('properties.Building', on_delete=models.PROTECT, related_name='facility_assets', null=True, blank=True)
    unit = models.ForeignKey('properties.Unit', on_delete=models.PROTECT, related_name='facility_assets', null=True, blank=True)
    manufacturer = models.CharField(max_length=120, blank=True)
    model_number = models.CharField(max_length=100, blank=True)
    serial_number = models.CharField(max_length=100, blank=True)
    installed_on = models.DateField(null=True, blank=True)
    warranty_expires_on = models.DateField(null=True, blank=True)
    purchase_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    condition = models.CharField(max_length=20, choices=Condition.choices, default=Condition.GOOD)
    is_active = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('name',)
        constraints = [models.UniqueConstraint(fields=('organization', 'code'), name='unique_organization_asset_code')]

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Asset property must belong to the same organization.')
        if self.building_id and self.building.property_id != self.property_id:
            raise ValidationError({'building': 'Building must belong to the selected property.'})
        if self.unit_id and self.unit.property_id != self.property_id:
            raise ValidationError({'unit': 'Unit must belong to the selected property.'})


class Contractor(OrganizationOwnedModel):
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        REVIEW = 'review', 'Under review'
        SUSPENDED = 'suspended', 'Suspended'
        EXPIRED = 'expired', 'Compliance expired'

    code = models.CharField(max_length=40)
    name = models.CharField(max_length=180)
    specialty = models.CharField(max_length=100)
    contact_name = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.REVIEW)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    insurance_expires_on = models.DateField(null=True, blank=True)
    license_expires_on = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ('name',)
        constraints = [models.UniqueConstraint(fields=('organization', 'code'), name='unique_organization_contractor_code')]


class WorkOrder(OrganizationOwnedModel):
    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        ASSIGNED = 'assigned', 'Assigned'
        IN_PROGRESS = 'in_progress', 'In progress'
        ON_HOLD = 'on_hold', 'On hold'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'
    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        CRITICAL = 'critical', 'Critical'

    number = models.CharField(max_length=60)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=80)
    property = models.ForeignKey('properties.Property', on_delete=models.PROTECT, related_name='work_orders')
    asset = models.ForeignKey(FacilityAsset, on_delete=models.PROTECT, related_name='work_orders', null=True, blank=True)
    contractor = models.ForeignKey(Contractor, on_delete=models.SET_NULL, related_name='work_orders', null=True, blank=True)
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name='facility_work_orders', null=True, blank=True)
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='reported_facility_work_orders')
    priority = models.CharField(max_length=12, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    reported_at = models.DateTimeField()
    response_due_at = models.DateTimeField(null=True, blank=True)
    resolution_due_at = models.DateTimeField(null=True, blank=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    labor_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    parts_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    other_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    progress = models.PositiveSmallIntegerField(default=0)
    resolution_notes = models.TextField(blank=True)

    class Meta:
        ordering = ('-reported_at',)
        constraints = [models.UniqueConstraint(fields=('organization', 'number'), name='unique_organization_work_order_number')]

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Work order property must belong to the same organization.')
        if self.asset_id and self.asset.organization_id != self.organization_id:
            raise ValidationError('Work order asset must belong to the same organization.')
        if self.progress > 100:
            raise ValidationError({'progress': 'Progress cannot exceed 100 percent.'})


class WorkOrderEvent(OrganizationOwnedModel):
    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=40, default='status_change')
    from_status = models.CharField(max_length=16, blank=True)
    to_status = models.CharField(max_length=16, blank=True)
    notes = models.TextField(blank=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='facility_work_order_events')

    class Meta:
        ordering = ('-created_at',)

    def clean(self):
        if self.work_order_id and self.work_order.organization_id != self.organization_id:
            raise ValidationError('Work-order event must belong to the same organization.')


class WorkOrderCostItem(OrganizationOwnedModel):
    class Kind(models.TextChoices):
        LABOR = 'labor', 'Labor'
        PART = 'part', 'Part / material'
        OTHER = 'other', 'Other'

    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name='cost_items')
    kind = models.CharField(max_length=12, choices=Kind.choices)
    description = models.CharField(max_length=200)
    quantity = models.DecimalField(max_digits=12, decimal_places=3, default=1)
    unit_cost = models.DecimalField(max_digits=14, decimal_places=2)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    supplier = models.CharField(max_length=160, blank=True)
    reference = models.CharField(max_length=100, blank=True)
    added_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='facility_cost_items')

    class Meta:
        ordering = ('created_at',)

    def clean(self):
        if self.work_order_id and self.work_order.organization_id != self.organization_id:
            raise ValidationError('Cost item must belong to the same organization.')
        if self.quantity <= 0 or self.unit_cost < 0:
            raise ValidationError('Quantity must be positive and unit cost cannot be negative.')
        if self.total != self.quantity * self.unit_cost:
            raise ValidationError({'total': 'Total must equal quantity multiplied by unit cost.'})


class WorkOrderAttachment(OrganizationOwnedModel):
    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name='attachments')
    file_url = models.CharField(max_length=500)
    file_name = models.CharField(max_length=200)
    media_type = models.CharField(max_length=80, blank=True)
    caption = models.CharField(max_length=250, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='facility_work_order_attachments')

    class Meta:
        ordering = ('created_at',)

    def clean(self):
        if self.work_order_id and self.work_order.organization_id != self.organization_id:
            raise ValidationError('Attachment must belong to the same organization.')


class PreventiveSchedule(OrganizationOwnedModel):
    class Frequency(models.TextChoices):
        WEEKLY = 'weekly', 'Weekly'
        MONTHLY = 'monthly', 'Monthly'
        QUARTERLY = 'quarterly', 'Quarterly'
        BIANNUAL = 'biannual', 'Biannual'
        ANNUAL = 'annual', 'Annual'

    code = models.CharField(max_length=50)
    name = models.CharField(max_length=180)
    asset = models.ForeignKey(FacilityAsset, on_delete=models.CASCADE, related_name='preventive_schedules')
    frequency = models.CharField(max_length=16, choices=Frequency.choices)
    last_completed_on = models.DateField(null=True, blank=True)
    next_due_on = models.DateField()
    estimated_hours = models.DecimalField(max_digits=7, decimal_places=2, default=1)
    instructions = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ('next_due_on',)
        constraints = [models.UniqueConstraint(fields=('organization', 'code'), name='unique_organization_pm_code')]

    def clean(self):
        if self.asset_id and self.asset.organization_id != self.organization_id:
            raise ValidationError('Schedule asset must belong to the same organization.')


class Inspection(OrganizationOwnedModel):
    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Scheduled'
        IN_PROGRESS = 'in_progress', 'In progress'
        PASSED = 'passed', 'Passed'
        FAILED = 'failed', 'Failed'
        FOLLOW_UP = 'follow_up', 'Follow-up required'

    reference = models.CharField(max_length=60)
    title = models.CharField(max_length=180)
    inspection_type = models.CharField(max_length=80)
    property = models.ForeignKey('properties.Property', on_delete=models.PROTECT, related_name='facility_inspections')
    asset = models.ForeignKey(FacilityAsset, on_delete=models.SET_NULL, related_name='inspections', null=True, blank=True)
    inspector = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='facility_inspections')
    scheduled_on = models.DateField()
    completed_on = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.SCHEDULED)
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    findings = models.TextField(blank=True)
    violations = models.PositiveSmallIntegerField(default=0)
    follow_up_work_order = models.ForeignKey(WorkOrder, on_delete=models.SET_NULL, related_name='source_inspections', null=True, blank=True)

    class Meta:
        ordering = ('-scheduled_on',)
        constraints = [models.UniqueConstraint(fields=('organization', 'reference'), name='unique_organization_inspection_ref')]

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Inspection property must belong to the same organization.')


class ServiceRequest(OrganizationOwnedModel):
    class Status(models.TextChoices):
        NEW = 'new', 'New'
        APPROVED = 'approved', 'Approved for work'
        REJECTED = 'rejected', 'Rejected'
        ASSIGNED = 'assigned', 'Assigned'
        IN_PROGRESS = 'in_progress', 'In progress'
        RESOLVED = 'resolved', 'Resolved'
        CLOSED = 'closed', 'Closed'

    reference = models.CharField(max_length=60)
    subject = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=80)
    property = models.ForeignKey('properties.Property', on_delete=models.PROTECT, related_name='service_requests')
    unit = models.ForeignKey('properties.Unit', on_delete=models.SET_NULL, related_name='service_requests', null=True, blank=True)
    tenant = models.ForeignKey('properties.Tenant', on_delete=models.SET_NULL, related_name='service_requests', null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    priority = models.CharField(max_length=12, choices=WorkOrder.Priority.choices, default=WorkOrder.Priority.MEDIUM)
    submitted_at = models.DateTimeField()
    response_due_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    satisfaction_score = models.PositiveSmallIntegerField(null=True, blank=True)
    work_order = models.ForeignKey(WorkOrder, on_delete=models.SET_NULL, related_name='service_requests', null=True, blank=True)
    decision_notes = models.TextField(blank=True)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name='decided_facility_requests', null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-submitted_at',)
        constraints = [models.UniqueConstraint(fields=('organization', 'reference'), name='unique_organization_service_request_ref')]

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Service request property must belong to the same organization.')
        if self.satisfaction_score is not None and self.satisfaction_score > 5:
            raise ValidationError({'satisfaction_score': 'Satisfaction score must be between 0 and 5.'})


class UtilityMeter(OrganizationOwnedModel):
    class Utility(models.TextChoices):
        ELECTRICITY = 'electricity', 'Electricity'
        WATER = 'water', 'Water'
        GAS = 'gas', 'Gas'
    class MeterRole(models.TextChoices):
        STANDARD = 'standard', 'Standard meter'
        BULK = 'bulk', 'Bulk / main meter'
        CHECK = 'check', 'Check / sub-meter'

    code = models.CharField(max_length=50)
    name = models.CharField(max_length=160)
    property = models.ForeignKey('properties.Property', on_delete=models.PROTECT, related_name='utility_meters')
    property_unit = models.ForeignKey('properties.Unit', on_delete=models.PROTECT, related_name='utility_meters', null=True, blank=True)
    utility_type = models.CharField(max_length=16, choices=Utility.choices)
    meter_role = models.CharField(max_length=12, choices=MeterRole.choices, default=MeterRole.STANDARD)
    parent_meter = models.ForeignKey('self', on_delete=models.PROTECT, related_name='check_meters', null=True, blank=True)
    unit = models.CharField(max_length=20, default='kWh')
    tariff = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ('name',)
        constraints = [models.UniqueConstraint(fields=('organization', 'code'), name='unique_organization_meter_code')]

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Utility meter property must belong to the same organization.')
        if self.property_unit_id and self.property_unit.property_id != self.property_id:
            raise ValidationError({'property_unit': 'The metered unit must belong to the selected property.'})
        if self.parent_meter_id and (self.parent_meter.property_id != self.property_id or self.parent_meter.meter_role != self.MeterRole.BULK):
            raise ValidationError({'parent_meter': 'A check meter must reference a bulk meter at the same property.'})


class MeterReading(OrganizationOwnedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending review'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
    class Method(models.TextChoices):
        MANUAL = 'manual', 'Manual'
        MOBILE = 'mobile', 'Mobile app'
        IMPORT = 'import', 'Imported file or API'
        IOT = 'iot', 'Smart meter / IoT'

    meter = models.ForeignKey(UtilityMeter, on_delete=models.CASCADE, related_name='readings')
    read_at = models.DateTimeField()
    method = models.CharField(max_length=12, choices=Method.choices, default=Method.MANUAL)
    source_reference = models.CharField(max_length=160, blank=True)
    value = models.DecimalField(max_digits=16, decimal_places=3)
    previous_value = models.DecimalField(max_digits=16, decimal_places=3, default=0)
    consumption = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    is_anomaly = models.BooleanField(default=False)
    notes = models.CharField(max_length=250, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name='reviewed_meter_readings', null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.CharField(max_length=250, blank=True)

    class Meta:
        ordering = ('-read_at',)
        constraints = [models.UniqueConstraint(fields=('meter', 'read_at'), name='unique_meter_read_time')]

    def clean(self):
        if self.meter_id and self.meter.organization_id != self.organization_id:
            raise ValidationError('Meter reading must belong to the meter organization.')
        if self.value < self.previous_value and not self.meter.reset_events.filter(effective_at__lte=self.read_at).exists():
            self.status = self.Status.REJECTED
            self.is_anomaly = True
            self.consumption = 0
            self.cost = 0
            self.review_notes = self.review_notes or 'Reverse reading rejected; authorize a meter reset or replacement before billing.'


class MeterResetEvent(OrganizationOwnedModel):
    class Kind(models.TextChoices):
        RESET = 'reset', 'Meter reset'
        REPLACEMENT = 'replacement', 'Meter replacement'

    meter = models.ForeignKey(UtilityMeter, on_delete=models.PROTECT, related_name='reset_events')
    kind = models.CharField(max_length=12, choices=Kind.choices)
    effective_at = models.DateTimeField()
    previous_value = models.DecimalField(max_digits=16, decimal_places=3)
    reset_value = models.DecimalField(max_digits=16, decimal_places=3, default=0)
    reason = models.TextField()
    authorized_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='authorized_meter_resets')

    class Meta:
        ordering = ('-effective_at',)


class MeterReconciliation(OrganizationOwnedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending review'
        WITHIN_TOLERANCE = 'within_tolerance', 'Within tolerance'
        EXCEPTION = 'exception', 'Exception required'
        APPROVED = 'approved', 'Approved'

    bulk_meter = models.ForeignKey(UtilityMeter, on_delete=models.PROTECT, related_name='reconciliations')
    period_start = models.DateField()
    period_end = models.DateField()
    bulk_consumption = models.DecimalField(max_digits=16, decimal_places=3)
    check_consumption = models.DecimalField(max_digits=16, decimal_places=3)
    variance = models.DecimalField(max_digits=16, decimal_places=3)
    variance_percent = models.DecimalField(max_digits=8, decimal_places=3, default=0)
    tolerance_percent = models.DecimalField(max_digits=8, decimal_places=3, default=5)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_meter_reconciliations')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)
    supporting_documents = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ('-period_start',)
        constraints = [models.UniqueConstraint(fields=('bulk_meter', 'period_start'), name='unique_bulk_meter_reconciliation_period')]

    def clean(self):
        if self.bulk_meter_id and self.bulk_meter.meter_role != UtilityMeter.MeterRole.BULK:
            raise ValidationError({'bulk_meter': 'Reconciliation requires a bulk meter.'})
        if self.period_end < self.period_start:
            raise ValidationError({'period_end': 'Period end cannot precede its start.'})
