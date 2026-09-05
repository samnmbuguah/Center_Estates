from decimal import Decimal

from rest_framework import serializers
from core.tenancy import get_active_organization

from .models import (
    BankTransaction, BillingCandidate, BillingItem, BillingProfile, BillingReadinessIssue, BillingRun,
    Building, Budget, CreditNote, Expense, Invoice, InvoiceLine,
    InvoiceReminder, Lease, PaymentGatewayConfiguration, PaymentIntent, Project, Property,
    Receipt, ReceiptAllocation, PayerWallet, RentSchedule, ReportDefinition, ReportExecution, ScheduledReport,
    ServiceCharge, TaxConfiguration, TenantMovement, UnitStatusHistory, LeaseEscalation,
    ServiceChargeAllocation, ServiceChargeReconciliation, Tenant,
    TenantDocument, TenantPortalAccess, Unit, UnitChargeRule, ParkingSpace, ParkingAssignment,
    TenantHandover, ExitClearance, LandlordInvoice, Owner, PropertyCollectionAccount, PropertyFeeProfile,
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
    created_by_username = serializers.CharField(source='created_by.username', read_only=True, default='')
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Property
        exclude = ('organization',)

    def get_created_by_name(self, obj) -> str:
        if not obj.created_by:
            return ''
        return obj.created_by.get_full_name() or obj.created_by.username

    def validate_country(self, value):
        if not value:
            return 'KE'
        val = str(value).strip()
        country_map = {
            'kenya': 'KE', 'uganda': 'UG', 'tanzania': 'TZ', 'rwanda': 'RW',
            'south sudan': 'SS', 'united states': 'US', 'united kingdom': 'GB',
        }
        return country_map.get(val.lower(), val[:60])



class BuildingSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    class Meta:
        model = Building
        exclude = ('organization',)


class OwnerSerializer(serializers.ModelSerializer):
    code = serializers.CharField(read_only=True)
    units_count = serializers.SerializerMethodField()
    units_list = serializers.SerializerMethodField()

    class Meta:
        model = Owner
        exclude = ('organization',)

    def get_units_count(self, obj):
        return obj.units.count()

    def get_units_list(self, obj):
        return [
            {
                'id': str(u.id),
                'code': u.code,
                'property_id': str(u.property_id),
                'property_name': u.property.name,
                'sectional_title_number': u.sectional_title_number,
                'management_mandate': u.management_mandate,
                'ownership_share': str(u.ownership_share),
                'floor': u.floor or '',
                'area': str(u.area) if u.area else None,
            }
            for u in obj.units.all().select_related('property')
        ]


class PropertyCollectionAccountSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)

    class Meta:
        model = PropertyCollectionAccount
        exclude = ('organization',)


class PropertyFeeProfileSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)

    class Meta:
        model = PropertyFeeProfile
        exclude = ('organization',)


class UnitSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    building_name = serializers.CharField(source='building.name', read_only=True, default='')
    owner_name = serializers.CharField(source='owner.name', read_only=True, default='')
    owner_code = serializers.CharField(source='owner.code', read_only=True, default='')
    charge_rules = UnitChargeRuleSerializer(many=True, read_only=True)
    tenant_name = serializers.SerializerMethodField()
    tenant_code = serializers.SerializerMethodField()
    lease_reference = serializers.SerializerMethodField()
    rent_collection_mode = serializers.SerializerMethodField()
    effective_rent = serializers.SerializerMethodField()
    occupancy_state = serializers.SerializerMethodField()
    occupancy_state_display = serializers.SerializerMethodField()
    billing_isolation = serializers.SerializerMethodField()

    class Meta:
        model = Unit
        exclude = ('organization',)

    def _get_active_lease(self, obj):
        if hasattr(obj, 'active_leases'):
            return obj.active_leases[0] if obj.active_leases else None
        return obj.leases.filter(status__in=('active', 'expiring')).select_related('tenant').first()

    def get_tenant_name(self, obj):
        lease = self._get_active_lease(obj)
        if lease and lease.tenant:
            return lease.tenant.name
        return ''

    def get_tenant_code(self, obj):
        lease = self._get_active_lease(obj)
        if lease and lease.tenant:
            return lease.tenant.code
        return ''

    def get_lease_reference(self, obj):
        lease = self._get_active_lease(obj)
        return lease.reference if lease else ''

    def get_rent_collection_mode(self, obj):
        lease = self._get_active_lease(obj)
        if not lease:
            return 'none'
        meta = lease.metadata or {}
        mode = meta.get('rent_collection_mode')
        if not mode:
            mode = 'estate_managed' if lease.monthly_rent > 0 else 'direct_landlord'
        return mode

    def get_effective_rent(self, obj):
        lease = self._get_active_lease(obj)
        return str(lease.monthly_rent) if lease else '0.00'

    def get_occupancy_state(self, obj):
        lease = self._get_active_lease(obj)
        if not lease:
            return 'sold_self_occupied' if obj.owner_id else 'available'
        mode = self.get_rent_collection_mode(obj)
        if mode == 'direct_landlord':
            return 'sold_tenant_unmanaged'
        elif obj.owner_id:
            return 'sold_tenant_managed'
        else:
            return 'developer_tenanted'

    def get_occupancy_state_display(self, obj):
        state = self.get_occupancy_state(obj)
        labels = {
            'developer_tenanted': 'Developer-Held (Unsold, Tenanted)',
            'sold_tenant_unmanaged': "Sold · Direct Landlord",
            'sold_tenant_managed': "Sold · Estate Managed",
            'sold_self_occupied': 'Sold · Self-Occupied',
            'available': 'Vacant (Available)',
        }
        return labels.get(state, state.replace('_', ' ').title())

    def get_billing_isolation(self, obj):
        lease = self._get_active_lease(obj)
        mode = self.get_rent_collection_mode(obj) if lease else 'none'
        is_rent_billed = bool(lease and lease.monthly_rent > 0 and mode != 'direct_landlord')
        return {
            'bill_rent': is_rent_billed,
            'rent_amount': str(lease.monthly_rent) if is_rent_billed else '0.00',
            'rent_collection_mode': mode,
            'rent_payer': 'tenant' if is_rent_billed else 'none',
            'rent_destination': 'estate_account' if is_rent_billed else ('direct_to_landlord' if mode == 'direct_landlord' else 'none'),
            'bill_service_charge_to_tenant': False,
            'service_charge_payer': 'owner' if (obj.owner_id or mode == 'direct_landlord') else 'n/a_developer',
            'bill_utilities_to_tenant': bool(lease),
            'utilities_payer': 'tenant' if lease else 'none',
        }


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


class LandlordInvoiceSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)

    class Meta:
        model = LandlordInvoice
        exclude = ('organization',)
        read_only_fields = ('number', 'status', 'issued_on', 'paid_at', 'payment_reference')
        ref_name = 'LandlordInvoice'

    def validate(self, attrs):
        organization = get_active_organization(self.context['request'])
        prop = attrs.get('property')
        if prop and prop.organization_id != organization.id:
            raise serializers.ValidationError({'property': 'Property must belong to the active organization.'})
        return attrs


class TenantSerializer(serializers.ModelSerializer):
    code = serializers.CharField(read_only=True)
    unit = serializers.SerializerMethodField()
    units = serializers.SerializerMethodField()
    active_leases_count = serializers.SerializerMethodField()
    lease_start = serializers.SerializerMethodField()
    lease_end = serializers.SerializerMethodField()
    lease_reference = serializers.SerializerMethodField()
    monthly_rent = serializers.SerializerMethodField()
    rent_collection_mode = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        exclude = ('organization',)

    def _primary_lease(self, obj):
        if not hasattr(obj, '_cached_primary_lease'):
            leases = list(obj.leases.all())
            active = [l for l in leases if l.status in (Lease.Status.ACTIVE, Lease.Status.EXPIRING)]
            obj._cached_primary_lease = active[0] if active else (leases[0] if leases else None)
        return obj._cached_primary_lease

    def get_lease_start(self, obj):
        l = self._primary_lease(obj)
        return str(l.starts_on) if l and l.starts_on else None

    def get_lease_end(self, obj):
        l = self._primary_lease(obj)
        return str(l.ends_on) if l and l.ends_on else None

    def get_lease_reference(self, obj):
        l = self._primary_lease(obj)
        return l.reference if l else None

    def get_monthly_rent(self, obj):
        l = self._primary_lease(obj)
        return str(l.monthly_rent) if l else None

    def get_rent_collection_mode(self, obj):
        l = self._primary_lease(obj)
        return getattr(l, 'rent_collection_mode', 'estate_managed') if l else None

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
                'rent_collection_mode': getattr(l, 'rent_collection_mode', 'estate_managed'),
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
        # A zero-rent lease is a real occupancy state for a tenant whose rent
        # is collected directly by their landlord.  Utilities can still be
        # billed to that occupant, so rejecting it here made direct-landlord
        # occupancy impossible through the normal API.
        if value < 0:
            raise serializers.ValidationError('Monthly rent cannot be negative.')
        return value

    def validate_escalation_interval_months(self, value):
        if not 1 <= value <= 120:
            raise serializers.ValidationError('Escalation frequency must be between 1 and 120 months.')
        return value


class InvoiceSerializer(serializers.ModelSerializer):
    tenant_name = serializers.SerializerMethodField()
    tenant_id = serializers.SerializerMethodField()
    owner_name = serializers.CharField(source='owner.name', read_only=True, default='')
    owner_id = serializers.UUIDField(source='owner.id', read_only=True, default=None)
    property_name = serializers.SerializerMethodField()
    unit_code = serializers.SerializerMethodField()
    collection_account_details = PropertyCollectionAccountSerializer(source='collection_account', read_only=True)
    lines = InvoiceLineSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        exclude = ('organization',)
        read_only_fields = ('number', 'balance', 'status', 'tax_amount', 'prepared_by', 'reviewed_by', 'reviewed_at', 'issued_by', 'issued_at')
        ref_name = 'PropertyInvoice'
        extra_kwargs = {'amount': {'required': False}, 'subtotal': {'required': False}}

    def get_tenant_name(self, obj):
        if obj.lease and obj.lease.tenant:
            return obj.lease.tenant.name
        return ''

    def get_tenant_id(self, obj):
        if obj.lease and obj.lease.tenant:
            return str(obj.lease.tenant.id)
        return None

    def get_unit_code(self, obj):
        if obj.unit:
            return obj.unit.code
        if obj.lease and obj.lease.unit:
            return obj.lease.unit.code
        return ''

    def get_property_name(self, obj):
        if obj.unit and obj.unit.property:
            return obj.unit.property.name
        if obj.lease and obj.lease.unit and obj.lease.unit.property:
            return obj.lease.unit.property.name
        return ''

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
    tenant_name = serializers.CharField(source='tenant.name', read_only=True, default='')
    owner_name = serializers.CharField(source='owner.name', read_only=True, default='')
    payer_name = serializers.SerializerMethodField()
    wallet_credit = serializers.SerializerMethodField()
    # Charge classification — allows UI to filter receipts by what they paid for
    charge_type = serializers.CharField(source='invoice.invoice_type', read_only=True, default='')
    recipient_type = serializers.CharField(source='invoice.recipient_type', read_only=True, default='')

    class Meta:
        model = Receipt
        exclude = ('organization', 'received_by')
        extra_kwargs = {
            'number': {'required': False, 'allow_blank': True},
            # Retained for historic report rows only. New receipts always use
            # the configured automatic allocation matrix.
            'paying_for': {'read_only': True},
        }

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Receipt amount must be greater than zero.')
        return value

    def get_payer_name(self, obj):
        return obj.owner.name if obj.payer_type == Receipt.PayerType.LANDLORD and obj.owner_id else (obj.tenant.name if obj.tenant_id else '')

    def get_wallet_credit(self, obj):
        filters = {'organization': obj.organization}
        filters['owner_id' if obj.payer_type == Receipt.PayerType.LANDLORD else 'tenant_id'] = obj.owner_id if obj.payer_type == Receipt.PayerType.LANDLORD else obj.tenant_id
        return str(PayerWallet.objects.filter(**filters).values_list('balance', flat=True).first() or Decimal('0.00'))

    def validate(self, attrs):
        # A payment is owned by its payer, not by a selected charge or invoice.
        # Restrict direct API clients as well as the web UI so the configured
        # allocation matrix cannot be silently bypassed.
        if self.instance is None and self.initial_data.get('invoice'):
            raise serializers.ValidationError({
                'invoice': 'Receipts are allocated automatically by the configured priority matrix. Select a payer instead.'
            })
        payer_type = attrs.get('payer_type') or (Receipt.PayerType.LANDLORD if attrs.get('owner') else Receipt.PayerType.TENANT)
        tenant = attrs.get('tenant', getattr(self.instance, 'tenant', None))
        owner = attrs.get('owner', getattr(self.instance, 'owner', None))
        if payer_type == Receipt.PayerType.TENANT and not tenant:
            raise serializers.ValidationError({'tenant': 'Select the tenant who made this payment.'})
        if payer_type == Receipt.PayerType.LANDLORD and not owner:
            raise serializers.ValidationError({'owner': 'Select the landlord who made this payment.'})
        if tenant and owner:
            raise serializers.ValidationError({'payer_type': 'A receipt can have one payer only.'})
        attrs['payer_type'] = payer_type
        return attrs


class InvoiceReminderSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.number', read_only=True)
    tenant_name = serializers.CharField(source='invoice.lease.tenant.name', read_only=True)

    class Meta:
        model = InvoiceReminder
        exclude = ('organization', 'sent_by')
        read_only_fields = ('invoice', 'channel', 'recipient', 'message', 'sent_at')


class BankTransactionSerializer(serializers.ModelSerializer):
    receipt_number = serializers.CharField(source='receipt.number', read_only=True, default='')
    receipt_payer = serializers.CharField(source='receipt.payer_name', read_only=True, default='')
    receipt_tenant = serializers.CharField(source='receipt.invoice.lease.tenant.name', read_only=True, default='')
    receipt_unit = serializers.CharField(source='receipt.invoice.lease.unit.code', read_only=True, default='')
    receipt_invoice_number = serializers.CharField(source='receipt.invoice.number', read_only=True, default='')
    # Expose invoice charge type so the UI can display a charge-category badge on matched rows
    receipt_invoice_type = serializers.CharField(source='receipt.invoice.invoice_type', read_only=True, default='')
    receipt_recipient_type = serializers.CharField(source='receipt.invoice.recipient_type', read_only=True, default='')

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
    prepared_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ServiceChargeReconciliation
        exclude = ('organization',)
        read_only_fields = ('budgeted_amount', 'actual_amount', 'variance', 'status', 'prepared_by', 'reviewed_by', 'reviewed_at')

    def get_prepared_by_name(self, obj):
        return obj.prepared_by.get_full_name() or obj.prepared_by.get_username() if obj.prepared_by else 'System'

    def get_reviewed_by_name(self, obj):
        return obj.reviewed_by.get_full_name() or obj.reviewed_by.get_username() if obj.reviewed_by else ''


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
    number = serializers.CharField(required=False, allow_blank=True, default="")
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
