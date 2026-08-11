from decimal import Decimal

from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from .models import (
    Contractor, FacilityAsset, Inspection, MeterReading, MeterReconciliation, MeterResetEvent, PreventiveSchedule,
    ServiceRequest, UtilityMeter, WorkOrder, WorkOrderAttachment,
    WorkOrderCostItem, WorkOrderEvent,
)


class FacilityAssetSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    building_name = serializers.CharField(source='building.name', read_only=True, default='')
    class Meta:
        model = FacilityAsset
        exclude = ('organization',)


class ContractorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contractor
        exclude = ('organization',)


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
    class Meta:
        model = MeterReading
        exclude = ('organization',)
        read_only_fields = ('previous_value', 'consumption', 'cost', 'is_anomaly', 'status', 'reviewed_by', 'reviewed_at', 'review_notes')


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
