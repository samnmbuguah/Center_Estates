from decimal import Decimal

from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from core.tenancy import get_active_organization

from .models import (
    AssetConditionAssessment, ComplianceObligation, Contractor, ContractorContract, FacilityAsset,
    FacilityExpense, FacilityFlag, FacilityIncident, FacilityIncidentAttachment, FacilityIncidentEvent, FacilityRisk, FloorPlan, FMBudget, Inspection, MeterReading, MeterReconciliation,
    ContractInvoiceAppraisal, FacilityJobCard, FacilityPaymentRecord, FinancePaymentRequest,
    LocalPurchaseOrder, MeterResetEvent, PettyCashVoucher, PreventiveSchedule, ProcurementQuotation, ProcurementRecord,
    RepairRequisition, ServiceProfile, ServiceProfileAllocation, ServiceRequest, StrategicFMPlan, SupplierInvoice, UtilityMeter, WorkOrder,
    WorkOrderAttachment, WorkOrderCostItem, WorkOrderEvent,
)


class ServiceProfileAllocationSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    provider_name = serializers.CharField(source='provider.name', read_only=True, default='')

    class Meta:
        model = ServiceProfileAllocation
        exclude = ('organization',)


class ServiceProfileSerializer(serializers.ModelSerializer):
    allocations = ServiceProfileAllocationSerializer(many=True, read_only=True)

    class Meta:
        model = ServiceProfile
        exclude = ('organization', 'created_by')
        read_only_fields = ('code',)

    def validate(self, attrs):
        organization = get_active_organization(self.context['request'])
        for prop in attrs.get('properties', []):
            if prop.organization_id != organization.id:
                raise serializers.ValidationError({'properties': 'Every property must belong to the active organization.'})
        for asset in attrs.get('assets', []):
            if asset.organization_id != organization.id:
                raise serializers.ValidationError({'assets': 'Every asset must belong to the active organization.'})
        return attrs


class FacilityIncidentEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.get_full_name', read_only=True)

    class Meta:
        model = FacilityIncidentEvent
        exclude = ('organization', 'actor')


class FacilityIncidentAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)

    class Meta:
        model = FacilityIncidentAttachment
        exclude = ('organization', 'uploaded_by')
        read_only_fields = ('incident', 'name', 'content_type')

    def get_file_url(self, obj):
        request = self.context.get('request')
        return request.build_absolute_uri(obj.file.url) if request else obj.file.url

    def validate_file(self, value):
        if value.size > 15 * 1024 * 1024:
            raise serializers.ValidationError('Incident evidence must be 15 MB or smaller.')
        return value


class FacilityIncidentSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    unit_code = serializers.CharField(source='unit.code', read_only=True, default='')
    asset_name = serializers.CharField(source='asset.name', read_only=True, default='')
    provider_name = serializers.CharField(source='service_provider.name', read_only=True, default='')
    reported_by_name = serializers.CharField(source='reported_by.get_full_name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.get_full_name', read_only=True, default='')
    events = FacilityIncidentEventSerializer(many=True, read_only=True)
    attachments = FacilityIncidentAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = FacilityIncident
        exclude = ('organization', 'reported_by')
        read_only_fields = ('reference', 'status', 'reviewed_by', 'submitted_at', 'closed_at', 'work_order')

    def validate(self, attrs):
        organization = get_active_organization(self.context['request'])
        for field in ('property', 'unit', 'asset', 'service_provider'):
            value = attrs.get(field)
            if value is not None and getattr(value, 'organization_id', organization.id) != organization.id:
                raise serializers.ValidationError({field: 'The selected record belongs to another organization.'})
        return attrs


class FacilityAssetSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    building_name = serializers.CharField(source='building.name', read_only=True, default='')
    unit_code = serializers.CharField(source='unit.code', read_only=True, default='')
    latest_condition = serializers.SerializerMethodField()

    class Meta:
        model = FacilityAsset
        exclude = ('organization',)
        read_only_fields = ('code',)

    @extend_schema_field(serializers.DictField(allow_null=True))
    def get_latest_condition(self, obj):
        latest = obj.condition_assessments.first()
        return AssetConditionAssessmentSerializer(latest).data if latest else None


class RepairRequisitionSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    unit_code = serializers.CharField(source='unit.code', read_only=True, default='')
    asset_name = serializers.CharField(source='asset.name', read_only=True, default='')
    provider_name = serializers.CharField(source='provider.name', read_only=True, default='')
    requester_name = serializers.CharField(source='requester.get_full_name', read_only=True, default='')
    service_request_reference = serializers.CharField(source='service_request.reference', read_only=True, default='')
    work_order_number = serializers.CharField(source='work_order.number', read_only=True, default='')
    procurement_code = serializers.CharField(source='procurement.code', read_only=True, default='')

    class Meta:
        model = RepairRequisition
        exclude = ('organization',)
        read_only_fields = ('code', 'status', 'requester', 'manager', 'manager_approved_at',
                            'landlord_approved_at', 'rejected_reason', 'work_order', 'converted_at')

    def validate(self, attrs):
        organization = get_active_organization(self.context['request'])
        prop = attrs.get('property')
        if prop and prop.organization_id != organization.id:
            raise serializers.ValidationError({'property': 'Property must belong to the active organization.'})
        unit = attrs.get('unit')
        if unit and unit.organization_id != organization.id:
            raise serializers.ValidationError({'unit': 'Unit must belong to the active organization.'})
        asset = attrs.get('asset')
        if asset and asset.organization_id != organization.id:
            raise serializers.ValidationError({'asset': 'Asset must belong to the active organization.'})
        return attrs


class SupplierInvoiceSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    work_order_number = serializers.CharField(source='work_order.number', read_only=True, default='')
    service_profile_name = serializers.CharField(source='service_profile.name', read_only=True, default='')
    budget_name = serializers.CharField(source='budget.name', read_only=True, default='')
    work_order_value = serializers.SerializerMethodField()
    variance = serializers.SerializerMethodField()
    requisition_code = serializers.SerializerMethodField()
    lpo_number = serializers.SerializerMethodField()
    job_card_number = serializers.SerializerMethodField()
    ticket_reference = serializers.SerializerMethodField()

    class Meta:
        model = SupplierInvoice
        exclude = ('organization',)
        read_only_fields = ('code', 'status', 'submitted_by', 'submitted_at', 'verified_by', 'verified_at',
                            'approved_by', 'approved_at', 'rejected_reason', 'paid_at', 'exception_approved')
        ref_name = 'FacilitySupplierInvoice'

    @extend_schema_field(serializers.DecimalField(max_digits=14, decimal_places=2))
    def get_work_order_value(self, obj):
        if not obj.work_order_id:
            return None
        return obj.work_order.labor_cost + obj.work_order.parts_cost + obj.work_order.other_cost

    @extend_schema_field(serializers.DecimalField(max_digits=14, decimal_places=2))
    def get_variance(self, obj):
        if not obj.work_order_id:
            return None
        approved = obj.work_order.labor_cost + obj.work_order.parts_cost + obj.work_order.other_cost
        return obj.total - approved

    def _job_card(self, obj):
        if not obj.work_order_id:
            return None
        return getattr(obj.work_order, 'job_card', None)

    def get_requisition_code(self, obj):
        card = self._job_card(obj)
        return card.lpo.procurement.requisition.code if card else ''

    def get_lpo_number(self, obj):
        card = self._job_card(obj)
        return card.lpo.number if card else ''

    def get_job_card_number(self, obj):
        card = self._job_card(obj)
        return card.number if card else ''

    def get_ticket_reference(self, obj):
        card = self._job_card(obj)
        request = card.lpo.procurement.requisition.service_request if card else None
        return request.reference if request else ''

    def validate(self, attrs):
        organization = get_active_organization(self.context['request'])
        supplier = attrs.get('supplier')
        number = attrs.get('supplier_invoice_number')
        if supplier and number:
            queryset = SupplierInvoice.objects.filter(
                organization=organization, supplier=supplier, supplier_invoice_number__iexact=number,
            )
            if self.instance is not None:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {'supplier_invoice_number': 'This supplier has already submitted an invoice with this number (duplicate detection).'},
                )
        work_order = attrs.get('work_order')
        if work_order and work_order.organization_id != organization.id:
            raise serializers.ValidationError({'work_order': 'Work order must belong to the active organization.'})
        if attrs.get('service_profile') and attrs['service_profile'].organization_id != organization.id:
            raise serializers.ValidationError({'service_profile': 'Service profile must belong to the active organization.'})
        if attrs.get('budget') and attrs['budget'].organization_id != organization.id:
            raise serializers.ValidationError({'budget': 'Budget must belong to the active organization.'})
        return attrs


class ProcurementQuotationSerializer(serializers.ModelSerializer):
    bidder_name = serializers.CharField(source='bidder.name', read_only=True)

    class Meta:
        model = ProcurementQuotation
        exclude = ('organization', 'recorded_by')
        read_only_fields = ('procurement', 'is_awarded')


class ProcurementRecordSerializer(serializers.ModelSerializer):
    requisition_code = serializers.CharField(source='requisition.code', read_only=True)
    requisition_title = serializers.CharField(source='requisition.title', read_only=True)
    property_name = serializers.CharField(source='property.name', read_only=True)
    quotations = ProcurementQuotationSerializer(many=True, read_only=True)
    lpo_number = serializers.CharField(source='lpo.number', read_only=True, default='')
    job_card_number = serializers.CharField(source='lpo.job_card.number', read_only=True, default='')

    class Meta:
        model = ProcurementRecord
        exclude = ('organization',)
        read_only_fields = ('code', 'property', 'status', 'created_by', 'evaluated_by', 'evaluated_at', 'awarded_by', 'awarded_at')


class LocalPurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    property_name = serializers.CharField(source='property.name', read_only=True)
    procurement_code = serializers.CharField(source='procurement.code', read_only=True)
    requisition_code = serializers.CharField(source='procurement.requisition.code', read_only=True)

    class Meta:
        model = LocalPurchaseOrder
        exclude = ('organization',)
        read_only_fields = ('number', 'procurement', 'quotation', 'supplier', 'property', 'subtotal', 'vat_amount', 'total', 'scope', 'status', 'issued_by', 'issued_at')


class FacilityJobCardSerializer(serializers.ModelSerializer):
    lpo_number = serializers.CharField(source='lpo.number', read_only=True)
    procurement_code = serializers.CharField(source='lpo.procurement.code', read_only=True)
    requisition_code = serializers.CharField(source='lpo.procurement.requisition.code', read_only=True)
    ticket_reference = serializers.CharField(source='lpo.procurement.requisition.service_request.reference', read_only=True, default='')
    property_name = serializers.CharField(source='property.name', read_only=True)
    work_order_number = serializers.CharField(source='work_order.number', read_only=True, default='')
    ticket_closure_eligible = serializers.SerializerMethodField()

    class Meta:
        model = FacilityJobCard
        exclude = ('organization',)
        read_only_fields = ('number', 'lpo', 'property', 'work_order', 'status', 'contractor_signed_at',
                            'caretaker_signed_by', 'caretaker_signed_at', 'verified_by', 'verified_at')

    def get_ticket_closure_eligible(self, obj):
        return obj.status == FacilityJobCard.Status.VERIFIED


class ContractInvoiceAppraisalSerializer(serializers.ModelSerializer):
    invoice_code = serializers.CharField(source='invoice.code', read_only=True)
    supplier_name = serializers.CharField(source='invoice.supplier.name', read_only=True)
    contract_number = serializers.CharField(source='contract.contract_number', read_only=True)
    average_score = serializers.SerializerMethodField()

    class Meta:
        model = ContractInvoiceAppraisal
        exclude = ('organization',)
        read_only_fields = ('invoice', 'contract', 'contract_valid', 'service_mapping_valid', 'status', 'caretaker',
                            'caretaker_signed_at', 'manager', 'manager_decided_at')

    def get_average_score(self, obj):
        return round((obj.quality_score + obj.timeliness_score + obj.responsiveness_score) / 3, 1)


class FinancePaymentRequestSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True, default='')
    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)

    class Meta:
        model = FinancePaymentRequest
        exclude = ('organization',)
        read_only_fields = ('number', 'status', 'requested_by', 'approved_by', 'approved_at', 'payment_reference', 'paid_at')


class FacilityPaymentRecordSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True, default='')
    source_reference = serializers.SerializerMethodField()

    class Meta:
        model = FacilityPaymentRecord
        exclude = ('organization', 'processed_by')
        read_only_fields = ('number', 'expense')

    def get_source_reference(self, obj):
        if obj.supplier_invoice_id:
            return obj.supplier_invoice.code
        return obj.payment_request.number if obj.payment_request_id else ''


class PettyCashVoucherSerializer(serializers.ModelSerializer):
    lpo_number = serializers.CharField(source='lpo.number', read_only=True)
    job_card_number = serializers.CharField(source='job_card.number', read_only=True)
    property_name = serializers.CharField(source='property.name', read_only=True)
    prepared_by_name = serializers.CharField(source='prepared_by.get_full_name', read_only=True)

    class Meta:
        model = PettyCashVoucher
        exclude = ('organization',)
        read_only_fields = ('number', 'property', 'purpose', 'total_amount', 'status', 'prepared_by',
                            'approved_by', 'approved_at', 'paid_at', 'expense')

    def validate(self, attrs):
        organization = get_active_organization(self.context['request'])
        lpo, card = attrs.get('lpo'), attrs.get('job_card')
        if not lpo or lpo.organization_id != organization.id:
            raise serializers.ValidationError({'lpo': 'Select an LPO in the active organization.'})
        if not card or card.lpo_id != lpo.id:
            raise serializers.ValidationError({'job_card': 'The Job Card must belong to the selected LPO.'})
        if card.status != FacilityJobCard.Status.VERIFIED:
            raise serializers.ValidationError({'job_card': 'Only a verified Job Card is eligible for petty-cash payment.'})
        recipients = attrs.get('recipients') or []
        if not 1 <= len(recipients) <= 4:
            raise serializers.ValidationError({'recipients': 'Enter between one and four recipients.'})
        total = Decimal('0')
        for index, recipient in enumerate(recipients, 1):
            if not all(str(recipient.get(key, '')).strip() for key in ('name', 'identity', 'role')):
                raise serializers.ValidationError({'recipients': f'Recipient {index} needs a name, ID/phone and service role.'})
            try:
                amount = Decimal(str(recipient.get('amount', '0')))
            except Exception:
                raise serializers.ValidationError({'recipients': f'Recipient {index} amount is invalid.'})
            if amount <= 0:
                raise serializers.ValidationError({'recipients': f'Recipient {index} amount must be positive.'})
            total += amount
        if total > lpo.total:
            raise serializers.ValidationError({'recipients': 'Voucher total cannot exceed the authorised LPO amount.'})
        attrs['_calculated_total'] = total
        return attrs


class ContractorSerializer(serializers.ModelSerializer):
    active_contracts_count = serializers.SerializerMethodField()

    class Meta:
        model = Contractor
        exclude = ('organization',)
        read_only_fields = ('code',)

    def validate(self, attrs):
        organization = get_active_organization(self.context['request'])
        for prop in attrs.get('assigned_properties', []):
            if prop.organization_id != organization.id:
                raise serializers.ValidationError({'assigned_properties': 'Every assigned property must belong to the active organization.'})
        return attrs

    @extend_schema_field(serializers.IntegerField())
    def get_active_contracts_count(self, obj):
        return obj.contracts.filter(status='active').count()


class WorkOrderSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    asset_name = serializers.CharField(source='asset.name', read_only=True, default='')
    contractor_name = serializers.CharField(source='contractor.name', read_only=True, default='')
    assigned_to_name = serializers.CharField(source='assigned_to.get_full_name', read_only=True, default='')
    total_cost = serializers.SerializerMethodField()

    class Meta:
        model = WorkOrder
        exclude = ('organization', 'reported_by')
        ref_name = 'FacilityWorkOrder'
        extra_kwargs = {'number': {'required': False, 'allow_blank': True}}

    @extend_schema_field(serializers.DecimalField(max_digits=14, decimal_places=2))
    def get_total_cost(self, obj):
        return obj.labor_cost + obj.parts_cost + obj.other_cost


class PreventiveScheduleSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    property_name = serializers.CharField(source='asset.property.name', read_only=True)
    class Meta:
        model = PreventiveSchedule
        exclude = ('organization',)
        read_only_fields = ('last_completed_on',)


class InspectionSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    inspector_name = serializers.CharField(source='inspector.get_full_name', read_only=True)
    class Meta:
        model = Inspection
        exclude = ('organization', 'inspector')
        read_only_fields = ('completed_on', 'status', 'score', 'findings', 'violations', 'follow_up_work_order')


class ServiceRequestSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True, default='')
    unit_code = serializers.CharField(source='unit.code', read_only=True, default='')
    decided_by_name = serializers.CharField(source='decided_by.get_full_name', read_only=True, default='')
    class Meta:
        model = ServiceRequest
        exclude = ('organization',)
        read_only_fields = ('status', 'submitted_at', 'resolved_at', 'work_order', 'decision_notes', 'decided_by', 'decided_at')


class UtilityMeterSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    unit_code = serializers.CharField(source='property_unit.code', read_only=True, default='')
    latest_reading = serializers.SerializerMethodField()
    current_reading = serializers.SerializerMethodField()
    previous_reading = serializers.SerializerMethodField()
    consumption = serializers.SerializerMethodField()
    cost = serializers.SerializerMethodField()
    read_at = serializers.SerializerMethodField()
    reading_status = serializers.SerializerMethodField()
    reading_is_anomaly = serializers.SerializerMethodField()
    class Meta:
        model = UtilityMeter
        exclude = ('organization',)

    def validate_tariff(self, value):
        if value < 0:
            raise serializers.ValidationError('The utility rate cannot be negative.')
        return value

    @extend_schema_field(serializers.DictField(allow_null=True))
    def get_latest_reading(self, obj):
        reading = obj.readings.first()
        return MeterReadingSerializer(reading).data if reading else None

    def _latest(self, obj):
        return obj.readings.first()

    @extend_schema_field(serializers.DecimalField(max_digits=16, decimal_places=3, allow_null=True))
    def get_current_reading(self, obj):
        reading = self._latest(obj)
        return reading.value if reading else None

    @extend_schema_field(serializers.DecimalField(max_digits=16, decimal_places=3, allow_null=True))
    def get_previous_reading(self, obj):
        reading = self._latest(obj)
        return reading.previous_value if reading else None

    @extend_schema_field(serializers.DecimalField(max_digits=14, decimal_places=3, allow_null=True))
    def get_consumption(self, obj):
        reading = self._latest(obj)
        return reading.consumption if reading else None

    @extend_schema_field(serializers.DecimalField(max_digits=14, decimal_places=2, allow_null=True))
    def get_cost(self, obj):
        reading = self._latest(obj)
        return reading.cost if reading else None

    @extend_schema_field(serializers.DateTimeField(allow_null=True))
    def get_read_at(self, obj):
        reading = self._latest(obj)
        return reading.read_at if reading else None

    @extend_schema_field(serializers.CharField(allow_blank=True))
    def get_reading_status(self, obj):
        reading = self._latest(obj)
        return reading.status if reading else 'not_read'

    @extend_schema_field(serializers.BooleanField())
    def get_reading_is_anomaly(self, obj):
        reading = self._latest(obj)
        return reading.is_anomaly if reading else False


class MeterReadingSerializer(serializers.ModelSerializer):
    meter_name = serializers.CharField(source='meter.name', read_only=True)
    unit_code = serializers.CharField(source='meter.property_unit.code', read_only=True, default='')
    reviewed_by_name = serializers.CharField(source='reviewed_by.username', read_only=True, default='')
    recorded_by_name = serializers.CharField(source='recorded_by.get_full_name', read_only=True, default='')
    class Meta:
        model = MeterReading
        exclude = ('organization',)
        read_only_fields = ('previous_value', 'consumption', 'cost', 'is_anomaly', 'status', 'recorded_by', 'reviewed_by', 'reviewed_at', 'review_notes')


class MeterResetEventSerializer(serializers.ModelSerializer):
    meter_name = serializers.CharField(source='meter.name', read_only=True)
    authorized_by_name = serializers.CharField(source='authorized_by.get_full_name', read_only=True)
    class Meta:
        model = MeterResetEvent
        exclude = ('organization', 'authorized_by')


class MeterReconciliationSerializer(serializers.ModelSerializer):
    meter_name = serializers.CharField(source='bulk_meter.name', read_only=True)
    property_name = serializers.CharField(source='bulk_meter.property.name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.get_full_name', read_only=True, default='')
    class Meta:
        model = MeterReconciliation
        exclude = ('organization', 'reviewed_by', 'reviewed_at')
        read_only_fields = ('variance', 'variance_percent', 'status')


class WorkOrderEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.username', read_only=True)

    class Meta:
        model = WorkOrderEvent
        exclude = ('organization', 'actor')


class WorkOrderCostItemSerializer(serializers.ModelSerializer):
    added_by_name = serializers.CharField(source='added_by.username', read_only=True)

    class Meta:
        model = WorkOrderCostItem
        exclude = ('organization', 'added_by')
        read_only_fields = ('total',)

    def validate(self, attrs):
        quantity = attrs.get('quantity')
        unit_cost = attrs.get('unit_cost')
        if quantity is not None and quantity <= 0:
            raise serializers.ValidationError({'quantity': 'Quantity must be greater than zero.'})
        if unit_cost is not None and unit_cost < 0:
            raise serializers.ValidationError({'unit_cost': 'Unit cost cannot be negative.'})
        return attrs

    def create(self, validated_data):
        validated_data['total'] = (validated_data['quantity'] * validated_data['unit_cost']).quantize(Decimal('0.01'))
        return super().create(validated_data)


class WorkOrderAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.username', read_only=True)

    class Meta:
        model = WorkOrderAttachment
        exclude = ('organization', 'uploaded_by')

    def validate(self, attrs):
        if not attrs.get('uploaded_file') and not str(attrs.get('file_url', '')).strip():
            raise serializers.ValidationError({'uploaded_file': 'Choose a file to upload.'})
        uploaded = attrs.get('uploaded_file')
        if uploaded and uploaded.size > 15 * 1024 * 1024:
            raise serializers.ValidationError({'uploaded_file': 'Files must be 15 MB or smaller.'})
        return attrs


class FloorPlanSerializer(serializers.ModelSerializer):
    building_name = serializers.CharField(source='building.name', read_only=True)
    property_name = serializers.CharField(source='building.property.name', read_only=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True, default='')

    class Meta:
        model = FloorPlan
        exclude = ('organization',)


class AssetConditionAssessmentSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    asset_code = serializers.CharField(source='asset.code', read_only=True)
    assessor_name = serializers.CharField(source='assessor.get_full_name', read_only=True)

    class Meta:
        model = AssetConditionAssessment
        exclude = ('organization', 'assessor')


class StrategicFMPlanSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, default='')

    class Meta:
        model = StrategicFMPlan
        exclude = ('organization',)


class ContractorContractSerializer(serializers.ModelSerializer):
    contractor_name = serializers.CharField(source='contractor.name', read_only=True)
    property_name = serializers.CharField(source='property.name', read_only=True, default='')

    class Meta:
        model = ContractorContract
        exclude = ('organization',)


class FMBudgetSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    variance_amount = serializers.SerializerMethodField()
    variance_percent = serializers.SerializerMethodField()

    class Meta:
        model = FMBudget
        exclude = ('organization',)

    @extend_schema_field(serializers.DecimalField(max_digits=14, decimal_places=2))
    def get_variance_amount(self, obj):
        return obj.allocated_amount - (obj.actual_amount + obj.committed_amount)

    @extend_schema_field(serializers.DecimalField(max_digits=8, decimal_places=2))
    def get_variance_percent(self, obj):
        if not obj.allocated_amount:
            return Decimal('0.00')
        spent = obj.actual_amount + obj.committed_amount
        return ((spent / obj.allocated_amount) * Decimal('100.0')).quantize(Decimal('0.01'))


class FacilityExpenseSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    work_order_number = serializers.CharField(source='work_order.number', read_only=True, default='')
    recorded_by_name = serializers.CharField(source='recorded_by.get_full_name', read_only=True, default='')
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, default='')

    class Meta:
        model = FacilityExpense
        exclude = ('organization', 'recorded_by', 'approved_by', 'approved_at')
        read_only_fields = ('status', 'decision_notes')

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Expense amount must be greater than zero.')
        return value


class ComplianceObligationSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    building_name = serializers.CharField(source='building.name', read_only=True, default='')
    responsible_person_name = serializers.CharField(source='responsible_person.get_full_name', read_only=True, default='')

    class Meta:
        model = ComplianceObligation
        exclude = ('organization',)


class FacilityRiskSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    building_name = serializers.CharField(source='building.name', read_only=True, default='')
    asset_name = serializers.CharField(source='asset.name', read_only=True, default='')
    action_owner_name = serializers.CharField(source='action_owner.get_full_name', read_only=True, default='')

    class Meta:
        model = FacilityRisk
        exclude = ('organization',)


class FacilityFlagSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    resolved_by_name = serializers.CharField(source='resolved_by.get_full_name', read_only=True, default='')

    class Meta:
        model = FacilityFlag
        exclude = ('organization',)
