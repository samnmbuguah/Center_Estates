from rest_framework import serializers

from .models import (
    Building, Budget, CreditNote, Expense, Invoice, Lease, Project, Property,
    Receipt, ReceiptAllocation, RentSchedule, ServiceCharge,
    ServiceChargeAllocation, ServiceChargeReconciliation, Tenant, TenantDocument,
    Unit,
)


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
        read_only_fields = ('status',)

    def validate_monthly_rent(self, value):
        if value <= 0:
            raise serializers.ValidationError('Monthly rent must be greater than zero.')
        return value


class InvoiceSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='lease.tenant.name', read_only=True)
    tenant_id = serializers.UUIDField(source='lease.tenant.id', read_only=True)
    class Meta:
        model = Invoice
        exclude = ('organization',)
        read_only_fields = ('balance', 'status')

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Invoice amount must be greater than zero.')
        return value


class ReceiptSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    class Meta:
        model = Receipt
        exclude = ('organization', 'received_by')

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Receipt amount must be greater than zero.')
        return value


class ExpenseSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    class Meta:
        model = Expense
        exclude = ('organization',)
        read_only_fields = ('status',)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Expense amount must be greater than zero.')
        return value


class BudgetSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    actual_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True, default=0)
    variance = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True, default=0)
    class Meta:
        model = Budget
        exclude = ('organization', 'approved_by', 'approved_at')
        read_only_fields = ('status',)

    def validate_amount(self, value):
        if value < 0:
            raise serializers.ValidationError('Budget amount cannot be negative.')
        return value


class ServiceChargeSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    allocation_count = serializers.IntegerField(read_only=True, default=0)
    class Meta:
        model = ServiceCharge
        exclude = ('organization',)

    def validate_annual_budget(self, value):
        if value < 0:
            raise serializers.ValidationError('Annual budget cannot be negative.')
        return value


class ServiceChargeAllocationSerializer(serializers.ModelSerializer):
    service_charge_name = serializers.CharField(source='service_charge.name', read_only=True)
    property_name = serializers.CharField(source='service_charge.property.name', read_only=True)
    unit_code = serializers.CharField(source='unit.code', read_only=True)

    class Meta:
        model = ServiceChargeAllocation
        exclude = ('organization',)
        read_only_fields = ('service_charge', 'unit', 'ratio', 'annual_amount', 'monthly_amount')


class ServiceChargeReconciliationSerializer(serializers.ModelSerializer):
    service_charge_name = serializers.CharField(source='service_charge.name', read_only=True)
    property_name = serializers.CharField(source='service_charge.property.name', read_only=True)

    class Meta:
        model = ServiceChargeReconciliation
        exclude = ('organization', 'prepared_by', 'reviewed_by', 'reviewed_at')
        read_only_fields = ('budgeted_amount', 'actual_amount', 'variance', 'status')


class TenantDocumentSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)

    class Meta:
        model = TenantDocument
        exclude = ('organization', 'verified_by', 'verified_at')
        read_only_fields = ('status', 'rejection_reason')


class RentScheduleSerializer(serializers.ModelSerializer):
    lease_reference = serializers.CharField(source='lease.reference', read_only=True)
    tenant_name = serializers.CharField(source='lease.tenant.name', read_only=True)

    class Meta:
        model = RentSchedule
        exclude = ('organization',)
        read_only_fields = ('status', 'invoice')


class ReceiptAllocationSerializer(serializers.ModelSerializer):
    receipt_number = serializers.CharField(source='receipt.number', read_only=True)
    invoice_number = serializers.CharField(source='invoice.number', read_only=True)
    tenant_name = serializers.CharField(source='receipt.tenant.name', read_only=True)

    class Meta:
        model = ReceiptAllocation
        exclude = ('organization', 'allocated_by')


class CreditNoteSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.number', read_only=True)
    tenant_name = serializers.CharField(source='invoice.lease.tenant.name', read_only=True)

    class Meta:
        model = CreditNote
        exclude = ('organization', 'issued_by')
        read_only_fields = ('status', 'void_reason')

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Credit amount must be greater than zero.')
        return value
