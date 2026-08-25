from decimal import Decimal

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
    asset_class = models.CharField(max_length=80, blank=True, default='Mechanical & Electrical')
    property = models.ForeignKey('properties.Property', on_delete=models.PROTECT, related_name='facility_assets')
    building = models.ForeignKey('properties.Building', on_delete=models.PROTECT, related_name='facility_assets', null=True, blank=True)
    unit = models.ForeignKey('properties.Unit', on_delete=models.PROTECT, related_name='facility_assets', null=True, blank=True)
    manufacturer = models.CharField(max_length=120, blank=True)
    model_number = models.CharField(max_length=100, blank=True)
    serial_number = models.CharField(max_length=100, blank=True)
    installed_on = models.DateField(null=True, blank=True)
    commissioned_on = models.DateField(null=True, blank=True)
    warranty_expires_on = models.DateField(null=True, blank=True)
    expected_useful_life_years = models.PositiveSmallIntegerField(default=10)
    estimated_replacement_date = models.DateField(null=True, blank=True)
    purchase_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    replacement_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    funding_source = models.CharField(max_length=80, blank=True, default='Landlord CAPEX')
    criticality = models.CharField(max_length=20, default='medium')
    condition = models.CharField(max_length=20, choices=Condition.choices, default=Condition.GOOD)
    maintenance_procedure = models.TextField(blank=True)
    contractor_contract = models.CharField(max_length=120, blank=True)
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

    class ApprovalStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PENDING = 'pending', 'Pending approval'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    code = models.CharField(max_length=40)
    name = models.CharField(max_length=180)
    specialty = models.CharField(max_length=100)
    contact_name = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    emergency_phone = models.CharField(max_length=40, blank=True)
    pin_number = models.CharField(max_length=40, blank=True)
    registration_number = models.CharField(max_length=60, blank=True)
    coverage_areas = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.REVIEW)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    insurance_expires_on = models.DateField(null=True, blank=True)
    license_expires_on = models.DateField(null=True, blank=True)
    tax_compliance_expires_on = models.DateField(null=True, blank=True)
    approval_status = models.CharField(max_length=16, choices=ApprovalStatus.choices, default=ApprovalStatus.PENDING)
    is_preferred = models.BooleanField(default=False)
    is_blacklisted = models.BooleanField(default=False)
    assigned_properties = models.ManyToManyField('properties.Property', related_name='facility_contractors', blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('name',)
        constraints = [models.UniqueConstraint(fields=('organization', 'code'), name='unique_organization_contractor_code')]


class ServiceProfile(OrganizationOwnedModel):
    """Reusable definition of a required service, independent of its provider."""

    class ServiceType(models.TextChoices):
        ROUTINE = 'routine', 'Routine'
        PREVENTIVE = 'preventive', 'Preventive'
        REACTIVE = 'reactive', 'Reactive'
        SPECIALIST = 'specialist', 'Specialist'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        ACTIVE = 'active', 'Active'
        SUSPENDED = 'suspended', 'Suspended'

    class Criticality(models.TextChoices):
        CRITICAL = 'critical', 'Critical'
        HIGH = 'high', 'High'
        MEDIUM = 'medium', 'Medium'
        LOW = 'low', 'Low'

    class Coverage(models.TextChoices):
        PROPERTY = 'property', 'This property'
        MULTIPLE = 'multiple', 'Multiple properties'
        PORTFOLIO = 'portfolio', 'Portfolio'
        REGION = 'region', 'Region'

    code = models.CharField(max_length=50)
    name = models.CharField(max_length=180)
    category = models.CharField(max_length=80)
    service_type = models.CharField(max_length=16, choices=ServiceType.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    criticality = models.CharField(max_length=16, choices=Criticality.choices, default=Criticality.MEDIUM)
    coverage = models.CharField(max_length=16, choices=Coverage.choices, default=Coverage.PROPERTY)
    default_frequency = models.CharField(max_length=80, blank=True)
    description = models.TextField()
    notes = models.TextField(blank=True)
    properties = models.ManyToManyField('properties.Property', related_name='facility_service_profiles', blank=True)
    assets = models.ManyToManyField(FacilityAsset, related_name='service_profiles', blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_service_profiles')

    class Meta:
        ordering = ('name',)
        constraints = [models.UniqueConstraint(fields=('organization', 'code'), name='unique_organization_service_profile_code')]


class ServiceProfileAllocation(OrganizationOwnedModel):
    """Time-safe provider allocation; changing provider never rewrites the service master."""

    service_profile = models.ForeignKey(ServiceProfile, on_delete=models.PROTECT, related_name='allocations')
    property = models.ForeignKey('properties.Property', on_delete=models.PROTECT, related_name='service_profile_allocations')
    provider = models.ForeignKey(Contractor, on_delete=models.PROTECT, related_name='service_profile_allocations', null=True, blank=True)
    starts_on = models.DateField(null=True, blank=True)
    ends_on = models.DateField(null=True, blank=True)
    response_target_minutes = models.PositiveIntegerField(null=True, blank=True)
    resolution_target_minutes = models.PositiveIntegerField(null=True, blank=True)
    quality_target_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ('service_profile__name', 'property__name', '-starts_on')


class FacilityIncident(OrganizationOwnedModel):
    """Mobile-first operational incident with controlled review and closure."""

    class Severity(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        CRITICAL = 'critical', 'Critical'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SUBMITTED = 'submitted', 'Submitted'
        UNDER_REVIEW = 'under_review', 'Under review'
        FOLLOW_UP = 'follow_up', 'Follow-up required'
        RESOLVED = 'resolved', 'Resolved'
        CLOSED = 'closed', 'Closed'

    reference = models.CharField(max_length=60)
    property = models.ForeignKey('properties.Property', on_delete=models.PROTECT, related_name='facility_incidents')
    unit = models.ForeignKey('properties.Unit', on_delete=models.SET_NULL, related_name='facility_incidents', null=True, blank=True)
    asset = models.ForeignKey(FacilityAsset, on_delete=models.SET_NULL, related_name='incidents', null=True, blank=True)
    service_provider = models.ForeignKey(Contractor, on_delete=models.SET_NULL, related_name='incidents', null=True, blank=True)
    location = models.CharField(max_length=180)
    occurred_at = models.DateTimeField()
    category = models.CharField(max_length=80)
    severity = models.CharField(max_length=12, choices=Severity.choices, default=Severity.MEDIUM)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    narrative = models.TextField()
    people_involved = models.JSONField(default=list, blank=True)
    impacts = models.JSONField(default=list, blank=True)
    immediate_action = models.TextField(blank=True)
    evidence = models.JSONField(default=list, blank=True)
    recommended_action = models.TextField(blank=True)
    responsible_person = models.CharField(max_length=160, blank=True)
    target_date = models.DateField(null=True, blank=True)
    prevention_notes = models.TextField(blank=True)
    investigation_notes = models.TextField(blank=True)
    resolution_notes = models.TextField(blank=True)
    work_order = models.ForeignKey('facilities.WorkOrder', on_delete=models.SET_NULL, related_name='source_incidents', null=True, blank=True)
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='reported_facility_incidents')
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name='reviewed_facility_incidents', null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-occurred_at',)
        constraints = [models.UniqueConstraint(fields=('organization', 'reference'), name='unique_organization_facility_incident_ref')]


class FacilityIncidentEvent(OrganizationOwnedModel):
    incident = models.ForeignKey(FacilityIncident, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=40)
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='facility_incident_events')

    class Meta:
        ordering = ('-created_at',)


class FacilityIncidentAttachment(OrganizationOwnedModel):
    incident = models.ForeignKey(FacilityIncident, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='facility/incidents/%Y/%m/')
    name = models.CharField(max_length=180)
    content_type = models.CharField(max_length=100, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='facility_incident_attachments')

    class Meta:
        ordering = ('-created_at',)


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
    source = models.CharField(max_length=30, default='fm_officer')
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
    root_cause = models.TextField(blank=True)
    resolution_notes = models.TextField(blank=True)
    supervisor_verified = models.BooleanField(default=False)
    supervisor_verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_facility_work_orders')
    requester_confirmed = models.BooleanField(default=False)
    sla_breached = models.BooleanField(default=False)

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
    file_url = models.CharField(max_length=500, blank=True)
    uploaded_file = models.FileField(upload_to='facility/work-orders/%Y/%m/', null=True, blank=True)
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
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='recorded_meter_readings', null=True, blank=True)
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


class FloorPlan(OrganizationOwnedModel):
    building = models.ForeignKey('properties.Building', on_delete=models.CASCADE, related_name='facility_floor_plans')
    floor = models.CharField(max_length=40, default='1')
    title = models.CharField(max_length=180)
    file_url = models.CharField(max_length=500)
    scale_factor = models.DecimalField(max_digits=12, decimal_places=4, default=1.0)
    scale_unit = models.CharField(max_length=20, default='m')
    version = models.CharField(max_length=20, default='1.0')
    approval_status = models.CharField(max_length=20, default='approved')
    tagged_areas = models.JSONField(default=list, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='uploaded_floor_plans')

    class Meta:
        ordering = ('building', 'floor', '-version')

    def clean(self):
        if self.building_id and self.building.organization_id != self.organization_id:
            raise ValidationError('Floor plan building must belong to the same organization.')


class AssetConditionAssessment(OrganizationOwnedModel):
    asset = models.ForeignKey(FacilityAsset, on_delete=models.CASCADE, related_name='condition_assessments')
    assessed_on = models.DateField()
    condition_grade = models.PositiveSmallIntegerField(default=4)
    condition_label = models.CharField(max_length=30, default='good')
    assessor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='asset_assessments')
    defect_notes = models.TextField(blank=True)
    recommended_action = models.CharField(max_length=100, blank=True)
    evidence_urls = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ('-assessed_on',)

    def clean(self):
        if self.asset_id and self.asset.organization_id != self.organization_id:
            raise ValidationError('Assessment asset must belong to the same organization.')


class StrategicFMPlan(OrganizationOwnedModel):
    property = models.ForeignKey('properties.Property', on_delete=models.CASCADE, related_name='strategic_fm_plans')
    title = models.CharField(max_length=200)
    period_year = models.PositiveIntegerField(default=2026)
    status = models.CharField(max_length=20, default='approved')
    service_standards = models.JSONField(default=list, blank=True)
    maintenance_targets = models.JSONField(default=dict, blank=True)
    budget_allocations = models.JSONField(default=dict, blank=True)
    compliance_obligations = models.JSONField(default=list, blank=True)
    risk_mitigation_targets = models.JSONField(default=list, blank=True)
    improvement_initiatives = models.JSONField(default=list, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_strategic_fm_plans')

    class Meta:
        ordering = ('-period_year', 'property__name')
        constraints = [models.UniqueConstraint(fields=('organization', 'property', 'period_year'), name='unique_property_fm_plan_year')]

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('FM plan property must belong to the same organization.')


class ContractorContract(OrganizationOwnedModel):
    contractor = models.ForeignKey(Contractor, on_delete=models.CASCADE, related_name='contracts')
    property = models.ForeignKey('properties.Property', on_delete=models.SET_NULL, null=True, blank=True, related_name='contractor_contracts')
    contract_number = models.CharField(max_length=80)
    scope_of_work = models.TextField()
    contract_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    start_date = models.DateField()
    end_date = models.DateField()
    response_sla_hours = models.PositiveIntegerField(default=4)
    resolution_sla_hours = models.PositiveIntegerField(default=24)
    rate_card = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, default='active')

    class Meta:
        ordering = ('-end_date',)
        constraints = [models.UniqueConstraint(fields=('organization', 'contract_number'), name='unique_org_contractor_contract_no')]

    def clean(self):
        if self.contractor_id and self.contractor.organization_id != self.organization_id:
            raise ValidationError('Contractor must belong to the same organization.')


class FMBudget(OrganizationOwnedModel):
    property = models.ForeignKey('properties.Property', on_delete=models.CASCADE, related_name='fm_budgets')
    financial_year = models.PositiveIntegerField(default=2026)
    category = models.CharField(max_length=80)
    allocated_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    committed_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    actual_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    period_month = models.PositiveSmallIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ('-financial_year', 'property__name', 'category')

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('FM Budget property must belong to the same organization.')


class FacilityExpense(OrganizationOwnedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending approval'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    property = models.ForeignKey('properties.Property', on_delete=models.PROTECT, related_name='facility_expenses')
    work_order = models.ForeignKey(WorkOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses')
    spent_on = models.DateField()
    category = models.CharField(max_length=80)
    description = models.CharField(max_length=240)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    float_reference = models.CharField(max_length=100, blank=True)
    supplier = models.CharField(max_length=180, blank=True)
    receipt_reference = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='recorded_facility_expenses')
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_facility_expenses')
    approved_at = models.DateTimeField(null=True, blank=True)
    decision_notes = models.TextField(blank=True)

    class Meta:
        ordering = ('-spent_on', '-created_at')

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Facility expense property must belong to the same organization.')
        if self.work_order_id and self.work_order.property_id != self.property_id:
            raise ValidationError({'work_order': 'The work order must belong to the selected property.'})
        if self.amount <= 0:
            raise ValidationError({'amount': 'Expense amount must be greater than zero.'})


class SupplierInvoice(OrganizationOwnedModel):
    class Classification(models.TextChoices):
        REPAIR = 'repair', 'One-off repair'
        RECURRING = 'recurring', 'Recurring service'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SUBMITTED = 'submitted', 'Submitted'
        VERIFIED = 'verified', 'Verified'
        APPROVED = 'approved', 'Approved'
        PAYMENT_PROCESSING = 'payment_processing', 'Payment processing'
        PAID = 'paid', 'Paid'
        REJECTED = 'rejected', 'Rejected'
        ON_HOLD = 'on_hold', 'On hold'

    code = models.CharField(max_length=60)
    supplier = models.ForeignKey(Contractor, on_delete=models.PROTECT, related_name='supplier_invoices')
    property = models.ForeignKey('properties.Property', on_delete=models.PROTECT, related_name='supplier_invoices')
    supplier_invoice_number = models.CharField(max_length=80)
    classification = models.CharField(max_length=16, choices=Classification.choices, default=Classification.REPAIR)

    work_order = models.ForeignKey(WorkOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='supplier_invoices')
    service_profile = models.ForeignKey('facilities.ServiceProfile', on_delete=models.SET_NULL, null=True, blank=True, related_name='supplier_invoices')
    service_period_start = models.DateField(null=True, blank=True)
    service_period_end = models.DateField(null=True, blank=True)

    description = models.TextField()
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('16.00'))
    vat_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    total = models.DecimalField(max_digits=14, decimal_places=2)
    tax_code = models.CharField(max_length=40, blank=True)
    cost_centre = models.CharField(max_length=80, blank=True)
    budget = models.ForeignKey(FMBudget, on_delete=models.SET_NULL, null=True, blank=True, related_name='supplier_invoices')

    invoice_document_url = models.CharField(max_length=500, blank=True)
    variance_notes = models.TextField(blank=True)
    exception_approved = models.BooleanField(default=False)
    exception_notes = models.TextField(blank=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='submitted_supplier_invoices')
    submitted_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_supplier_invoices')
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_notes = models.TextField(blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_supplier_invoices')
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_notes = models.TextField(blank=True)
    rejected_reason = models.TextField(blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_reference = models.CharField(max_length=120, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('-created_at',)
        constraints = [
            models.UniqueConstraint(fields=('organization', 'code'), name='unique_organization_supplier_invoice_code'),
            models.UniqueConstraint(fields=('organization', 'supplier', 'supplier_invoice_number'), name='unique_organization_supplier_invoice_number'),
        ]

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Supplier invoice property must belong to the active organization.')
        if self.supplier_id and self.supplier.organization_id != self.organization_id:
            raise ValidationError('Supplier must belong to the active organization.')
        if self.work_order_id and self.work_order.property_id != self.property_id:
            raise ValidationError({'work_order': 'The linked work order must belong to the selected property.'})
        if self.total <= 0:
            raise ValidationError({'total': 'Invoice total amount must be greater than zero.'})
        if self.classification == self.Classification.REPAIR and not self.work_order_id and not self.exception_approved:
            raise ValidationError({'work_order': 'One-off reactive repair invoices must link to a valid Work Order.'})


class ComplianceObligation(OrganizationOwnedModel):
    property = models.ForeignKey('properties.Property', on_delete=models.CASCADE, related_name='compliance_obligations')
    building = models.ForeignKey('properties.Building', on_delete=models.SET_NULL, null=True, blank=True, related_name='compliance_obligations')
    category = models.CharField(max_length=60)
    title = models.CharField(max_length=180)
    issuing_authority = models.CharField(max_length=160, blank=True)
    certificate_number = models.CharField(max_length=100, blank=True)
    issue_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField()
    status = models.CharField(max_length=20, default='compliant')
    responsible_person = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='responsible_compliance_items')
    evidence_urls = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ('expiry_date',)

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Compliance obligation property must belong to the same organization.')


class FacilityRisk(OrganizationOwnedModel):
    property = models.ForeignKey('properties.Property', on_delete=models.CASCADE, related_name='facility_risks')
    building = models.ForeignKey('properties.Building', on_delete=models.SET_NULL, null=True, blank=True, related_name='facility_risks')
    asset = models.ForeignKey(FacilityAsset, on_delete=models.SET_NULL, null=True, blank=True, related_name='facility_risks')
    risk_id = models.CharField(max_length=40)
    category = models.CharField(max_length=60, default='operational')
    description = models.TextField()
    cause = models.TextField(blank=True)
    consequence = models.TextField(blank=True)
    likelihood = models.PositiveSmallIntegerField(default=3)
    impact = models.PositiveSmallIntegerField(default=3)
    inherent_score = models.PositiveSmallIntegerField(default=9)
    mitigation_controls = models.TextField(blank=True)
    action_owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='owned_facility_risks')
    due_date = models.DateField(null=True, blank=True)
    residual_score = models.PositiveSmallIntegerField(default=4)
    status = models.CharField(max_length=20, default='open')

    class Meta:
        ordering = ('-inherent_score',)
        constraints = [models.UniqueConstraint(fields=('organization', 'risk_id'), name='unique_org_facility_risk_id')]

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Risk property must belong to the same organization.')
        self.inherent_score = self.likelihood * self.impact


class FacilityFlag(OrganizationOwnedModel):
    property = models.ForeignKey('properties.Property', on_delete=models.CASCADE, related_name='facility_flags')
    flag_type = models.CharField(max_length=40)
    severity = models.CharField(max_length=20, default='warning')
    title = models.CharField(max_length=200)
    message = models.TextField()
    source_reference = models.CharField(max_length=120, blank=True)
    action_url = models.CharField(max_length=200, blank=True)
    is_resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='resolved_facility_flags')

    class Meta:
        ordering = ('is_resolved', '-created_at')

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Flag property must belong to the same organization.')


class RepairRequisition(OrganizationOwnedModel):
    """Formal repair requisition raised from a ticket or inspection, flowing through
    approval, procurement and work-order conversion before supplier invoicing."""

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SUBMITTED = 'submitted', 'Submitted'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        CONVERTED = 'converted', 'Converted to work order'
        CANCELLED = 'cancelled', 'Cancelled'

    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        EMERGENCY = 'emergency', 'Emergency'

    code = models.CharField(max_length=60)
    property = models.ForeignKey('properties.Property', on_delete=models.PROTECT, related_name='repair_requisitions')
    unit = models.ForeignKey('properties.Unit', on_delete=models.SET_NULL, related_name='repair_requisitions', null=True, blank=True)
    asset = models.ForeignKey(FacilityAsset, on_delete=models.SET_NULL, related_name='repair_requisitions', null=True, blank=True)
    service_request = models.ForeignKey(ServiceRequest, on_delete=models.SET_NULL, related_name='requisitions', null=True, blank=True)
    title = models.CharField(max_length=200)
    location = models.CharField(max_length=180, blank=True)
    issue_description = models.TextField()
    required_repair = models.TextField()
    quotation_specification = models.TextField(blank=True)
    estimated_cost = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    priority = models.CharField(max_length=12, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    required_by = models.DateField(null=True, blank=True)
    requester = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='raised_facility_requisitions')
    manager = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_facility_requisitions')
    manager_approved_at = models.DateTimeField(null=True, blank=True)
    manager_notes = models.TextField(blank=True)
    landlord_approval_required = models.BooleanField(default=False)
    landlord_approved_at = models.DateTimeField(null=True, blank=True)
    landlord_notes = models.TextField(blank=True)
    rejected_reason = models.TextField(blank=True)
    provider = models.ForeignKey(Contractor, on_delete=models.SET_NULL, related_name='requisitions', null=True, blank=True)
    work_order = models.ForeignKey(WorkOrder, on_delete=models.SET_NULL, related_name='source_requisitions', null=True, blank=True)
    converted_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('-created_at',)
        constraints = [models.UniqueConstraint(fields=('organization', 'code'), name='unique_organization_requisition_code')]

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Requisition property must belong to the same organization.')
        if self.provider_id and self.provider.organization_id != self.organization_id:
            raise ValidationError('Requisition provider must belong to the same organization.')
        if self.work_order_id and self.work_order.organization_id != self.organization_id:
            raise ValidationError('Requisition work order must belong to the same organization.')


class SupplierInvoice(OrganizationOwnedModel):
    """Supplier invoice register with controlled verification, approval and payment flow.

    Repair invoices only become payable once the source work order is completed and
    supervisor-verified, unless an authorised exception is recorded on approval.
    """

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SUBMITTED = 'submitted', 'Submitted'
        VERIFIED = 'verified', 'Verified'
        APPROVED = 'approved', 'Approved'
        PAYMENT_PROCESSING = 'payment_processing', 'Payment processing'
        PAID = 'paid', 'Paid'
        REJECTED = 'rejected', 'Rejected'
        ON_HOLD = 'on_hold', 'On hold'

    class Classification(models.TextChoices):
        REPAIR = 'repair', 'One-off repair'
        RECURRING = 'recurring', 'Recurring service'

    code = models.CharField(max_length=60)
    property = models.ForeignKey('properties.Property', on_delete=models.PROTECT, related_name='supplier_invoices')
    supplier = models.ForeignKey(Contractor, on_delete=models.PROTECT, related_name='supplier_invoices')
    supplier_invoice_number = models.CharField(max_length=80)
    classification = models.CharField(max_length=16, choices=Classification.choices, default=Classification.REPAIR)
    work_order = models.ForeignKey(WorkOrder, on_delete=models.SET_NULL, related_name='supplier_invoices', null=True, blank=True)
    service_profile = models.ForeignKey(ServiceProfile, on_delete=models.SET_NULL, related_name='supplier_invoices', null=True, blank=True)
    service_period_start = models.DateField(null=True, blank=True)
    service_period_end = models.DateField(null=True, blank=True)
    description = models.TextField()
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('16.00'))
    vat_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    total = models.DecimalField(max_digits=14, decimal_places=2)
    tax_code = models.CharField(max_length=40, blank=True)
    cost_centre = models.CharField(max_length=80, blank=True)
    budget = models.ForeignKey(FMBudget, on_delete=models.SET_NULL, related_name='supplier_invoices', null=True, blank=True)
    invoice_document_url = models.CharField(max_length=500, blank=True)
    variance_notes = models.TextField(blank=True)
    exception_approved = models.BooleanField(default=False)
    exception_notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='submitted_supplier_invoices')
    submitted_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_supplier_invoices')
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_notes = models.TextField(blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_supplier_invoices')
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_notes = models.TextField(blank=True)
    rejected_reason = models.TextField(blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_reference = models.CharField(max_length=120, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('-created_at',)
        constraints = [
            models.UniqueConstraint(fields=('organization', 'code'), name='unique_organization_supplier_invoice_code'),
            models.UniqueConstraint(fields=('organization', 'supplier', 'supplier_invoice_number'), name='unique_organization_supplier_invoice_number'),
        ]

    def clean(self):
        if self.property_id and self.property.organization_id != self.organization_id:
            raise ValidationError('Invoice property must belong to the same organization.')
        if self.supplier_id and self.supplier.organization_id != self.organization_id:
            raise ValidationError('Invoice supplier must belong to the same organization.')
        if self.work_order_id and self.work_order.organization_id != self.organization_id:
            raise ValidationError('Invoice work order must belong to the same organization.')
        if self.service_profile_id and self.service_profile.organization_id != self.organization_id:
            raise ValidationError('Invoice service profile must belong to the same organization.')
        if self.budget_id and self.budget.organization_id != self.organization_id:
            raise ValidationError('Invoice budget must belong to the same organization.')
        if self.total is not None and self.total <= 0:
            raise ValidationError({'total': 'Invoice total must be greater than zero.'})
        if self.classification == self.Classification.RECURRING and self.service_period_start and self.service_period_end:
            if self.service_period_end < self.service_period_start:
                raise ValidationError({'service_period_end': 'Service period end cannot be before its start.'})
