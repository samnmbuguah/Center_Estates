from decimal import Decimal

from rest_framework import serializers
from core.tenancy import get_active_organization

from .models import (
    BankTransaction, BillingCandidate, BillingItem, BillingProfile, BillingReadinessIssue, BillingRun,
    Building, Budget, CreditNote, Expense, Invoice, InvoiceLine,
    InvoiceReminder, Lease, PaymentGatewayConfiguration, PaymentIntent, Project, Property,
    Receipt, ReceiptAllocation, RentSchedule, ReportDefinition, ReportExecution, ScheduledReport,
    ServiceCharge, TaxConfiguration, TenantMovement, UnitStatusHistory, LeaseEscalation,
    ServiceChargeAllocation, ServiceChargeReconciliation, Tenant,
    TenantDocument, TenantPortalAccess, Unit, UnitChargeRule, ParkingSpace, ParkingAssignment,
    TenantHandover, ExitClearance,
)


class ParkingSpaceSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    building_name = serializers.CharField(source='building.name', read_only=True, default='')
    unit_code = serializers.CharField(source='unit.code', read_only=True, default='')

    class Meta:
        model = ParkingSpace
        exclude = ('organization',)


class ParkingAssignmentSerializer(serializers.ModelSerializer):
    parking_code = serializers.CharField(source='parking_space.code', read_only=True)
    tenant_name = serializers.CharField(source='lease.tenant.name', read_only=True)
    unit_code = serializers.CharField(source='lease.unit.code', read_only=True)

    class Meta:
        model = ParkingAssignment
        exclude = ('organization',)


class TaxConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxConfiguration
        exclude = ('organization',)


class BillingItemSerializer(serializers.ModelSerializer):
    tax_code = serializers.CharField(source='tax_configuration.code', read_only=True, default='')
    class Meta:
        model = BillingItem
        exclude = ('organization',)


class UnitChargeRuleSerializer(serializers.ModelSerializer):
    billing_item_name = serializers.CharField(source='billing_item.name', read_only=True)
    billing_item_code = serializers.CharField(source='billing_item.code', read_only=True)

    class Meta:
        model = UnitChargeRule
        exclude = ('organization',)


class BillingProfileSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='lease.tenant.name', read_only=True)
    property_name = serializers.CharField(source='lease.unit.property.name', read_only=True)
    unit_code = serializers.CharField(source='lease.unit.code', read_only=True)
    billing_item_name = serializers.CharField(source='billing_item.name', read_only=True)
    class Meta:
        model = BillingProfile
        exclude = ('organization',)


class LeaseEscalationSerializer(serializers.ModelSerializer):
    lease_reference = serializers.CharField(source='lease.reference', read_only=True)
    class Meta:
        model = LeaseEscalation
        exclude = ('organization', 'approved_by', 'approved_at')
        read_only_fields = ('status',)


class UnitStatusHistorySerializer(serializers.ModelSerializer):
    unit_code = serializers.CharField(source='unit.code', read_only=True)
    property_name = serializers.CharField(source='unit.property.name', read_only=True)
    class Meta:
        model = UnitStatusHistory
        exclude = ('organization', 'recorded_by')


class TenantMovementSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    unit_code = serializers.CharField(source='unit.code', read_only=True)
    property_name = serializers.CharField(source='unit.property.name', read_only=True)
    class Meta:
        model = TenantMovement
        exclude = ('organization', 'recorded_by')


class InvoiceLineSerializer(serializers.ModelSerializer):
    billing_item_name = serializers.CharField(source='billing_item.name', read_only=True, default='')
    class Meta:
        model = InvoiceLine
        exclude = ('organization',)


class BillingReadinessIssueSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='lease.tenant.name', read_only=True, default='')
    unit_code = serializers.CharField(source='lease.unit.code', read_only=True, default='')
    class Meta:
        model = BillingReadinessIssue
        exclude = ('organization', 'resolved_by', 'resolved_at')
        read_only_fields = ('status',)


class BillingCandidateSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='lease.tenant.name', read_only=True)
    property_name = serializers.CharField(source='lease.unit.property.name', read_only=True)
    unit_code = serializers.CharField(source='lease.unit.code', read_only=True)
    lease_reference = serializers.CharField(source='lease.reference', read_only=True)
    invoice_number = serializers.CharField(source='invoice.number', read_only=True, default='')
    class Meta:
        model = BillingCandidate
        exclude = ('organization', 'excluded_by')
        read_only_fields = tuple(field.name for field in BillingCandidate._meta.fields if field.name not in ('id', 'organization'))


class BillingRunSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True, default='Portfolio')
    issues = BillingReadinessIssueSerializer(many=True, read_only=True)
    candidates = BillingCandidateSerializer(many=True, read_only=True)
    class Meta:
        model = BillingRun
        exclude = ('organization', 'created_by', 'approved_by', 'approved_at', 'generated_at')
        read_only_fields = ('status', 'totals')


class ReportDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportDefinition
        exclude = ('organization', 'created_by')


class ReportExecutionSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True, default='Portfolio')
    generated_by_name = serializers.CharField(source='generated_by.get_full_name', read_only=True)
    class Meta:
        model = ReportExecution
        exclude = ('organization',)
        read_only_fields = ('status', 'generated_by', 'generated_at', 'file', 'row_count', 'error_message')


class ScheduledReportSerializer(serializers.ModelSerializer):
    report_name = serializers.CharField(source='definition.name', read_only=True)
    class Meta:
        model = ScheduledReport
        exclude = ('organization', 'created_by')
        read_only_fields = ('last_execution', 'last_delivery_at', 'last_delivery_status', 'last_delivery_error')

    def validate_recipients(self, value):
        from django.core.validators import validate_email
        if not isinstance(value, list):
            raise serializers.ValidationError('Recipients must be a list of email addresses.')
        for recipient in value:
            try:
                validate_email(recipient)
            except Exception:
                raise serializers.ValidationError(f'{recipient} is not a valid email address.')
        return value


class PaymentGatewayConfigurationSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)

    class Meta:
        model = PaymentGatewayConfiguration
        exclude = ('organization',)
        read_only_fields = ('public_key',)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        provider = attrs.get('provider', getattr(self.instance, 'provider', ''))
        enabled = attrs.get('is_enabled', getattr(self.instance, 'is_enabled', False))
        checkout = attrs.get('checkout_url_template', getattr(self.instance, 'checkout_url_template', ''))
        secret_env = attrs.get('webhook_secret_env', getattr(self.instance, 'webhook_secret_env', ''))
        # STK Push (M-Pesa) uses a callback URL derived from public_key — no checkout URL or webhook secret needed.
        # Redirect-based gateways (eCitizen, bank redirect, etc.) do require both.
        is_stk_provider = provider == 'mpesa'
        if enabled and not is_stk_provider and (not checkout or not secret_env):
            raise serializers.ValidationError('Enabled redirect gateways require a checkout URL template and webhook secret environment key.')
        if enabled and is_stk_provider:
            stk_settings = attrs.get('settings', getattr(self.instance, 'settings', {})) or {}
            missing = [k for k in ('consumer_key', 'consumer_secret', 'shortcode', 'passkey') if not stk_settings.get(k)]
            if missing:
                raise serializers.ValidationError(
                    f'M-Pesa STK Push gateway requires: {", ".join(missing)}.'
                )
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
    charge_rules = UnitChargeRuleSerializer(many=True, read_only=True)
    class Meta:
        model = Unit
        exclude = ('organization',)


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        exclude = ('organization',)
        ref_name = 'PropertyProject'


class TenantHandoverSerializer(serializers.ModelSerializer):
    lease_reference = serializers.CharField(source='lease.reference', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    unit_code = serializers.CharField(source='unit.code', read_only=True, default='')

    class Meta:
        model = TenantHandover
        exclude = ('organization',)
        read_only_fields = ('code', 'status', 'caretaker_signed_at', 'tenant_signed_at', 'acknowledged_at')
        extra_kwargs = {'tenant': {'required': False}, 'unit': {'required': False}}
        ref_name = 'TenantHandover'

    def validate(self, attrs):
        organization = get_active_organization(self.context['request'])
        for field in ('lease', 'tenant', 'unit'):
            record = attrs.get(field)
            if record and record.organization_id != organization.id:
                raise serializers.ValidationError({field: 'Record must belong to the active organization.'})
        return attrs


class ExitClearanceSerializer(serializers.ModelSerializer):
    lease_reference = serializers.CharField(source='lease.reference', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)

    class Meta:
        model = ExitClearance
        exclude = ('organization',)
        read_only_fields = ('code', 'status', 'manager_approved_by', 'manager_approved_at',
                            'finance_approved_by', 'finance_approved_at', 'landlord_approved_at',
                            'rejected_reason', 'gate_pass_number', 'gate_pass_issued_at')
        extra_kwargs = {'tenant': {'required': False}}
        ref_name = 'ExitClearance'

    def validate(self, attrs):
        organization = get_active_organization(self.context['request'])
        for field in ('lease', 'tenant'):
            record = attrs.get(field)
            if record and record.organization_id != organization.id:
                raise serializers.ValidationError({field: 'Record must belong to the active organization.'})
        deductions = attrs.get('deductions')
        if deductions:
            total_deductions = sum(Decimal(str(d.get('amount', 0))) for d in deductions if isinstance(d, dict))
            deposit = attrs.get('deposit_amount', self.instance.deposit_amount if self.instance else None)
            if deposit is not None and total_deductions > deposit:
                raise serializers.ValidationError({'deductions': 'Total deductions cannot exceed the deposit amount.'})
        return attrs


class TenantSerializer(serializers.ModelSerializer):
    code = serializers.CharField(read_only=True)
    unit = serializers.SerializerMethodField()
    units = serializers.SerializerMethodField()
    active_leases_count = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        exclude = ('organization',)

    def get_units(self, obj):
        leases = obj.leases.all().select_related('unit')
        res = []
        for l in leases:
            u = l.unit
            res.append({
                'unit_id': u.id,
                'code': u.code,
                'floor': u.floor or '',
                'area': str(u.area) if u.area else None,
                'lease_id': l.id,
                'lease_reference': l.reference,
                'lease_status': l.status,
                'starts_on': str(l.starts_on),
                'ends_on': str(l.ends_on),
                'monthly_rent': str(l.monthly_rent),
            })
        return res

    def get_unit(self, obj):
        leases = obj.leases.all().select_related('unit')
        if not leases:
            return ''
        codes = [f"{l.unit.code}{f' (Fl {l.unit.floor})' if l.unit.floor else ''}" for l in leases]
        return ', '.join(codes)

    def get_active_leases_count(self, obj):
        return obj.leases.filter(status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING, Lease.Status.DRAFT)).count()

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

    def validate_escalation_interval_months(self, value):
        if not 1 <= value <= 120:
            raise serializers.ValidationError('Escalation frequency must be between 1 and 120 months.')
        return value


class InvoiceSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='lease.tenant.name', read_only=True)
    tenant_id = serializers.UUIDField(source='lease.tenant.id', read_only=True)
    property_name = serializers.CharField(source='lease.unit.property.name', read_only=True)
    unit_code = serializers.CharField(source='lease.unit.code', read_only=True)
    lines = InvoiceLineSerializer(many=True, read_only=True)
    class Meta:
        model = Invoice
        exclude = ('organization',)
        read_only_fields = ('number', 'balance', 'status', 'tax_amount', 'prepared_by', 'reviewed_by', 'reviewed_at', 'issued_by', 'issued_at')
        ref_name = 'PropertyInvoice'
        extra_kwargs = {'amount': {'required': False}, 'subtotal': {'required': False}}

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Invoice amount must be greater than zero.')
        return value

    def validate_tax_rate(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError('Tax rate must be between 0 and 100 percent.')
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
    file_url = serializers.CharField(required=False, allow_blank=True, default='')

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
