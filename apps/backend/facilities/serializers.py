from rest_framework import serializers

from .models import (
    Contractor, FacilityAsset, Inspection, MeterReading, PreventiveSchedule,
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
    class Meta:
        model = ServiceRequest
        exclude = ('organization',)
        read_only_fields = ('status', 'submitted_at', 'resolved_at', 'work_order')


class UtilityMeterSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    latest_reading = serializers.SerializerMethodField()
    class Meta:
        model = UtilityMeter
        exclude = ('organization',)

    def get_latest_reading(self, obj):
        reading = obj.readings.first()
        return MeterReadingSerializer(reading).data if reading else None


class MeterReadingSerializer(serializers.ModelSerializer):
    meter_name = serializers.CharField(source='meter.name', read_only=True)
    class Meta:
        model = MeterReading
        exclude = ('organization',)
        read_only_fields = ('consumption', 'cost', 'is_anomaly')


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


class WorkOrderAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.username', read_only=True)

    class Meta:
        model = WorkOrderAttachment
        exclude = ('organization', 'uploaded_by')
