from rest_framework import serializers

from .models import Building, Budget, Expense, Invoice, Lease, Project, Property, Receipt, ServiceCharge, Tenant, Unit


class PropertySerializer(serializers.ModelSerializer):
    buildings_count = serializers.IntegerField(read_only=True, default=0)
    units_count = serializers.IntegerField(read_only=True, default=0)
    class Meta:
        model = Property
        exclude = ('organization',)


class BuildingSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    class Meta:
        model = Building
        exclude = ('organization',)


class UnitSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    building_name = serializers.CharField(source='building.name', read_only=True, default='')
    class Meta:
        model = Unit
        exclude = ('organization',)


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        exclude = ('organization',)


class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        exclude = ('organization',)


class LeaseSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    unit_code = serializers.CharField(source='unit.code', read_only=True)
    property_name = serializers.CharField(source='unit.property.name', read_only=True)
    class Meta:
        model = Lease
        exclude = ('organization',)


class InvoiceSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='lease.tenant.name', read_only=True)
    class Meta:
        model = Invoice
        exclude = ('organization',)


class ReceiptSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    class Meta:
        model = Receipt
        exclude = ('organization', 'received_by')


class ExpenseSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    class Meta:
        model = Expense
        exclude = ('organization',)


class BudgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Budget
        exclude = ('organization',)


class ServiceChargeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCharge
        exclude = ('organization',)
