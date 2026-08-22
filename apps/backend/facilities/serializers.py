from decimal import Decimal

from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from core.tenancy import get_active_organization

from .models import (
    AssetConditionAssessment, ComplianceObligation, Contractor, ContractorContract, FacilityAsset,
    FacilityFlag, FacilityRisk, FloorPlan, FMBudget, Inspection, MeterReading, MeterReconciliation,
    MeterResetEvent, PreventiveSchedule, ServiceRequest, StrategicFMPlan, UtilityMeter, WorkOrder,
    WorkOrderAttachment, WorkOrderCostItem, WorkOrderEvent,
)


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
