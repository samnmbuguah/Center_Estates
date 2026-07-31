from rest_framework import serializers

from .models import Contractor, FacilityAsset, Inspection, MeterReading, PreventiveSchedule, ServiceRequest, UtilityMeter, WorkOrder


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


class InspectionSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    inspector_name = serializers.CharField(source='inspector.get_full_name', read_only=True)
    class Meta:
        model = Inspection
        exclude = ('organization',)


class ServiceRequestSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True, default='')
    unit_code = serializers.CharField(source='unit.code', read_only=True, default='')
    class Meta:
        model = ServiceRequest
        exclude = ('organization',)


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
