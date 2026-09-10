from decimal import Decimal

from rest_framework import serializers

from .models import AgentCommission, Buyer, BuyerPortalAccess, Installment, ListingRender, PropertySale, SaleDocument, SaleListing, SalePayment, SalesAuditEvent, SiteVisit


class SaleListingSerializer(serializers.ModelSerializer):
    unit_code = serializers.CharField(source='unit.code', read_only=True)
    unit_type = serializers.CharField(source='unit.unit_type', read_only=True)
    floor = serializers.CharField(source='unit.floor', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    renders = serializers.SerializerMethodField()

    class Meta:
        model = SaleListing
        exclude = ('organization',)
        read_only_fields = ('status', 'reservation_expires_at')

    def get_renders(self, obj):
        return ListingRenderSerializer(obj.renders.all(), many=True, context=self.context).data


class ListingRenderSerializer(serializers.ModelSerializer):
    render_url = serializers.SerializerMethodField()

    class Meta:
        model = ListingRender
        exclude = ('organization', 'file')
        read_only_fields = ('mime_type', 'file_size')

    def get_render_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            url = obj.file.url
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        if obj.file_url:
            return obj.file_url
        return ''


class BuyerSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source='assigned_agent.get_full_name', read_only=True, default='')
    class Meta:
        model = Buyer
        exclude = ('organization',)
        read_only_fields = ('status', 'confirmed_at')


class BuyerPortalAccessSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True, default='')
    buyer_name = serializers.CharField(source='buyer.full_name', read_only=True, default='')
    class Meta:
        model = BuyerPortalAccess
        exclude = ('organization',)
        read_only_fields = ('is_active',)


class PropertySaleSerializer(serializers.ModelSerializer):
    buyer_name = serializers.CharField(source='buyer.full_name', read_only=True)
    unit_code = serializers.CharField(source='listing.unit.code', read_only=True)
    project_name = serializers.CharField(source='listing.project.name', read_only=True)
    unit_type = serializers.CharField(source='listing.unit.unit_type', read_only=True, default='')
    unit_floor = serializers.CharField(source='listing.unit.floor', read_only=True, default='')
    unit_area = serializers.SerializerMethodField()
    renders = serializers.SerializerMethodField()
    paid_amount = serializers.SerializerMethodField()

    class Meta:
        model = PropertySale
        exclude = ('organization',)
        read_only_fields = ('status', 'reserved_at', 'contracted_on', 'cancellation_reason')

    def get_unit_area(self, obj):
        if obj.listing_id and obj.listing.unit_id and obj.listing.unit.area is not None:
            return str(obj.listing.unit.area)
        return None

    def get_renders(self, obj):
        if not obj.listing_id:
            return []
        return ListingRenderSerializer(obj.listing.renders.all(), many=True, context=self.context).data

    def get_paid_amount(self, obj) -> Decimal:
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
    achieved_paid_percent = serializers.SerializerMethodField()
    achieved_construction_percent = serializers.SerializerMethodField()

    class Meta:
        model = AgentCommission
        exclude = ('organization',)
        read_only_fields = ('status', 'approved_at', 'paid_on')

    def get_achieved_paid_percent(self, obj) -> float:
        sale = obj.sale
        verified = sum(
            (p.amount for p in sale.payments.all() if p.status == SalePayment.Status.VERIFIED), 0,
        )
        if not sale.agreed_price:
            return 0.0
        return round(float(verified / sale.agreed_price * 100), 1)

    def get_achieved_construction_percent(self, obj) -> float:
        if obj.sale_id and obj.sale.listing_id and obj.sale.listing.construction_progress is not None:
            return float(obj.sale.listing.construction_progress)
        return 0.0


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
