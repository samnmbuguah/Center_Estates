from rest_framework import serializers

from .models import (
    Building, Budget, CreditNote, Expense, Invoice, Lease, Project, Property,
    Receipt, ReceiptAllocation, RentSchedule, ServiceCharge, Tenant,
    TenantDocument, Unit,
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


class InvoiceSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='lease.tenant.name', read_only=True)
    tenant_id = serializers.UUIDField(source='lease.tenant.id', read_only=True)
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


class TenantDocumentSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)

    class Meta:
        model = TenantDocument
        exclude = ('organization', 'verified_by', 'verified_at')


class RentScheduleSerializer(serializers.ModelSerializer):
    lease_reference = serializers.CharField(source='lease.reference', read_only=True)
    tenant_name = serializers.CharField(source='lease.tenant.name', read_only=True)

    class Meta:
        model = RentSchedule
        exclude = ('organization',)


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
