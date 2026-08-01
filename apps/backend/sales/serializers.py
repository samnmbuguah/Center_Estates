from rest_framework import serializers

from .models import AgentCommission, Buyer, Installment, PropertySale, SaleDocument, SaleListing, SalePayment, SalesAuditEvent, SiteVisit


class SaleListingSerializer(serializers.ModelSerializer):
    unit_code = serializers.CharField(source='unit.code', read_only=True)
    unit_type = serializers.CharField(source='unit.unit_type', read_only=True)
    floor = serializers.CharField(source='unit.floor', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    class Meta:
        model = SaleListing
        exclude = ('organization',)
        read_only_fields = ('status', 'reservation_expires_at')


class BuyerSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source='assigned_agent.get_full_name', read_only=True, default='')
    class Meta:
        model = Buyer
        exclude = ('organization',)
        read_only_fields = ('status', 'confirmed_at')


class PropertySaleSerializer(serializers.ModelSerializer):
    buyer_name = serializers.CharField(source='buyer.full_name', read_only=True)
    unit_code = serializers.CharField(source='listing.unit.code', read_only=True)
    project_name = serializers.CharField(source='listing.project.name', read_only=True)
    paid_amount = serializers.SerializerMethodField()
    class Meta:
        model = PropertySale
        exclude = ('organization',)
        read_only_fields = ('status', 'reserved_at', 'contracted_on', 'cancellation_reason')

    def get_paid_amount(self, obj):
        return sum((payment.amount for payment in obj.payments.all() if payment.status == SalePayment.Status.VERIFIED), start=0)


class InstallmentSerializer(serializers.ModelSerializer):
    sale_reference = serializers.CharField(source='sale.reference', read_only=True)
    buyer_name = serializers.CharField(source='sale.buyer.full_name', read_only=True)
    class Meta:
        model = Installment
        exclude = ('organization',)
        read_only_fields = ('paid_amount', 'status')


class SalePaymentSerializer(serializers.ModelSerializer):
    sale_reference = serializers.CharField(source='sale.reference', read_only=True)
    buyer_name = serializers.CharField(source='sale.buyer.full_name', read_only=True)
    class Meta:
        model = SalePayment
        exclude = ('organization',)
        read_only_fields = ('status', 'verified_by', 'verified_at', 'rejection_reason')

    def validate(self, attrs):
        sale = attrs.get('sale', getattr(self.instance, 'sale', None))
        installment = attrs.get('installment', getattr(self.instance, 'installment', None))
        if sale and installment and installment.sale_id != sale.id:
            raise serializers.ValidationError({'installment': 'Installment must belong to the selected sale.'})
        return attrs

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Payment amount must be greater than zero.')
        return value

    def validate_external_reference(self, value):
        request = self.context.get('request')
        organization = getattr(request, 'active_organization', None)
        if organization is None and request is not None:
            from core.tenancy import get_active_organization
            organization = get_active_organization(request)
        existing = SalePayment.objects.for_organization(organization).filter(external_reference=value)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError('This payment reference has already been submitted.')
        return value


class SiteVisitSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)
    agent_name = serializers.CharField(source='introducing_agent.get_full_name', read_only=True, default='')
    class Meta:
        model = SiteVisit
        exclude = ('organization',)


class AgentCommissionSerializer(serializers.ModelSerializer):
    sale_reference = serializers.CharField(source='sale.reference', read_only=True)
    buyer_name = serializers.CharField(source='sale.buyer.full_name', read_only=True)
    agent_name = serializers.CharField(source='agent.get_full_name', read_only=True)
    class Meta:
        model = AgentCommission
        exclude = ('organization',)
        read_only_fields = ('status', 'approved_at', 'paid_on')


class SaleDocumentSerializer(serializers.ModelSerializer):
    sale_reference = serializers.CharField(source='sale.reference', read_only=True)
    class Meta:
        model = SaleDocument
        exclude = ('organization',)


class SalesAuditEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.username', read_only=True)
    sale_reference = serializers.CharField(source='sale.reference', read_only=True, default='')
    payment_reference = serializers.CharField(source='payment.reference', read_only=True, default='')

    class Meta:
        model = SalesAuditEvent
        exclude = ('organization', 'actor')
