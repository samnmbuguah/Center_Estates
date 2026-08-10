from rest_framework import serializers

from .models import (
    BankTransaction, Building, Budget, CreditNote, Expense, Invoice,
    InvoiceReminder, Lease, PaymentGatewayConfiguration, PaymentIntent, Project, Property,
    Receipt, ReceiptAllocation, RentSchedule, ServiceCharge,
    ServiceChargeAllocation, ServiceChargeReconciliation, Tenant,
    TenantDocument, TenantPortalAccess, Unit,
)


class PaymentGatewayConfigurationSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)

    class Meta:
        model = PaymentGatewayConfiguration
        exclude = ('organization',)
        read_only_fields = ('public_key',)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        enabled = attrs.get('is_enabled', getattr(self.instance, 'is_enabled', False))
        checkout = attrs.get('checkout_url_template', getattr(self.instance, 'checkout_url_template', ''))
        secret_env = attrs.get('webhook_secret_env', getattr(self.instance, 'webhook_secret_env', ''))
        if enabled and (not checkout or not secret_env):
            raise serializers.ValidationError('Enabled gateways require a checkout URL template and webhook secret environment key.')
        return attrs


class PaymentIntentSerializer(serializers.ModelSerializer):
    provider = serializers.CharField(source='configuration.provider', read_only=True)
    invoice_number = serializers.CharField(source='invoice.number', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)

    class Meta:
        model = PaymentIntent
        exclude = ('organization',)
        read_only_fields = tuple(
            field.name for field in PaymentIntent._meta.fields
            if field.name not in ('id', 'organization')
        )


class PropertySerializer(serializers.ModelSerializer):
    code = serializers.CharField(read_only=True)
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
        ref_name = 'PropertyProject'


class TenantSerializer(serializers.ModelSerializer):
    code = serializers.CharField(read_only=True)
    class Meta:
        model = Tenant
        exclude = ('organization',)

    def validate_tax_id(self, value):
        value = value.strip().upper()
        if value and not __import__('re').fullmatch(r'[AP]\d{9}[A-Z]', value):
            raise serializers.ValidationError('Enter a valid KRA PIN, for example P051234567X.')
        return value

    def validate_directors(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Directors must be supplied as a list of names.')
        cleaned = [str(name).strip() for name in value if str(name).strip()]
        if len(cleaned) != len(set(name.casefold() for name in cleaned)):
            raise serializers.ValidationError('Director names must be unique.')
        return cleaned

    def validate_registration_number(self, value):
        value = value.strip().upper()
        if value and not __import__('re').fullmatch(r'[A-Z0-9][A-Z0-9/\-]{2,79}', value):
            raise serializers.ValidationError('Use letters, numbers, slashes or hyphens for the registration number.')
        return value


class TenantPortalAccessSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)

    class Meta:
        model = TenantPortalAccess
        exclude = ('organization',)


class LeaseSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    unit_code = serializers.CharField(source='unit.code', read_only=True)
    property_name = serializers.CharField(source='unit.property.name', read_only=True)
    class Meta:
        model = Lease
        exclude = ('organization',)
        read_only_fields = ('status', 'renewed_from')

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
        read_only_fields = ('balance', 'status', 'tax_amount', 'prepared_by', 'reviewed_by', 'reviewed_at', 'issued_by', 'issued_at')
        ref_name = 'PropertyInvoice'
        extra_kwargs = {'amount': {'required': False}, 'subtotal': {'required': False}}

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Invoice amount must be greater than zero.')
        return value

    def validate_tax_rate(self, value):
        if value not in (0, 16):
            raise serializers.ValidationError('Supported VAT rates are 0% and 16%.')
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        subtotal = attrs.get('subtotal') or attrs.get('amount') or getattr(self.instance, 'subtotal', None)
        if subtotal is None or subtotal <= 0:
            raise serializers.ValidationError({'subtotal': 'Invoice subtotal must be greater than zero.'})
        tax_rate = attrs.get('tax_rate', getattr(self.instance, 'tax_rate', 0))
        tax_amount = (subtotal * tax_rate / 100).quantize(__import__('decimal').Decimal('0.01'))
        attrs['subtotal'] = subtotal
        attrs['tax_amount'] = tax_amount
        attrs['amount'] = subtotal + tax_amount
        return attrs


class ReceiptSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    class Meta:
        model = Receipt
        exclude = ('organization', 'received_by')

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Receipt amount must be greater than zero.')
        return value


class InvoiceReminderSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.number', read_only=True)
    tenant_name = serializers.CharField(source='invoice.lease.tenant.name', read_only=True)

    class Meta:
        model = InvoiceReminder
        exclude = ('organization', 'sent_by')
        read_only_fields = ('invoice', 'channel', 'recipient', 'message', 'sent_at')


class BankTransactionSerializer(serializers.ModelSerializer):
    receipt_number = serializers.CharField(source='receipt.number', read_only=True, default='')

    class Meta:
        model = BankTransaction
        exclude = ('organization', 'matched_by', 'matched_at')
        read_only_fields = ('status', 'receipt')

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Transaction amount must be greater than zero.')
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
