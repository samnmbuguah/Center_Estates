from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet

from core.models import Module
from core.permissions import HasModuleSubscription
from core.tenancy import get_active_organization

from .models import AgentCommission, Buyer, Installment, PropertySale, SaleDocument, SaleListing, SalePayment, SalesAuditEvent, SiteVisit
from .serializers import AgentCommissionSerializer, BuyerSerializer, InstallmentSerializer, PropertySaleSerializer, SaleDocumentSerializer, SaleListingSerializer, SalePaymentSerializer, SalesAuditEventSerializer, SiteVisitSerializer


class SalesModelViewSet(ModelViewSet):
    permission_classes = (HasModuleSubscription,)
    required_module = Module.SALES
    search_fields = ()

    def get_queryset(self):
        queryset = self.queryset.for_organization(get_active_organization(self.request))
        search = self.request.query_params.get('search', '').strip()
        if search:
            from django.db.models import Q
            query = Q()
            for field in self.search_fields:
                query |= Q(**{f'{field}__icontains': search})
            queryset = queryset.filter(query)
        status = self.request.query_params.get('status')
        if status and any(field.name == 'status' for field in queryset.model._meta.fields):
            queryset = queryset.filter(status=status)
        return queryset

    def _validate_organization(self, serializer):
        organization = get_active_organization(self.request)
        for name, value in serializer.validated_data.items():
            if getattr(value, 'organization_id', organization.id) != organization.id:
                raise ValidationError({name: 'The selected record belongs to another organization.'})
        return organization

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer))

    def perform_update(self, serializer):
        self._validate_organization(serializer)
        serializer.save()


class ListingViewSet(SalesModelViewSet):
    queryset = SaleListing.objects.select_related('unit', 'project')
    serializer_class = SaleListingSerializer
    search_fields = ('unit__code', 'unit__unit_type', 'project__name')


class BuyerViewSet(SalesModelViewSet):
    queryset = Buyer.objects.select_related('assigned_agent')
    serializer_class = BuyerSerializer
    search_fields = ('reference', 'full_name', 'email', 'phone', 'id_number')


class SaleViewSet(SalesModelViewSet):
    queryset = PropertySale.objects.select_related('buyer', 'listing__unit', 'listing__project', 'agent').prefetch_related('payments')
    serializer_class = PropertySaleSerializer
    search_fields = ('reference', 'buyer__full_name', 'listing__unit__code', 'listing__project__name')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        sale = serializer.save(organization=organization, status=PropertySale.Status.DRAFT)
        SalesAuditEvent.objects.create(organization=organization, sale=sale, event_type='created', to_status=sale.status, actor=self.request.user)

    def perform_update(self, serializer):
        if 'status' in serializer.validated_data and serializer.validated_data['status'] != self.get_object().status:
            raise ValidationError({'status': 'Use the transition action so inventory and audit controls are applied.'})
        super().perform_update(serializer)

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def transition(self, request, pk=None):
        organization = get_active_organization(request)
        sale = PropertySale.objects.select_for_update().select_related('listing__unit').filter(pk=pk, organization=organization).first()
        if not sale:
            return Response({'detail': 'Sale not found.'}, status=404)
        target = str(request.data.get('status', '')).strip()
        allowed = {
            PropertySale.Status.DRAFT: {PropertySale.Status.RESERVED, PropertySale.Status.CANCELLED},
            PropertySale.Status.RESERVED: {PropertySale.Status.CONTRACTED, PropertySale.Status.CANCELLED},
            PropertySale.Status.CONTRACTED: {PropertySale.Status.COMPLETED, PropertySale.Status.CANCELLED},
            PropertySale.Status.COMPLETED: set(), PropertySale.Status.CANCELLED: set(),
        }
        if target not in allowed[sale.status]:
            raise ValidationError({'status': f'Cannot transition from {sale.status} to {target or "blank"}.'})
        listing = SaleListing.objects.select_for_update().get(pk=sale.listing_id)
        notes = str(request.data.get('notes', '')).strip()
        verified_total = sale.payments.filter(status=SalePayment.Status.VERIFIED).aggregate(total=Sum('amount'))['total'] or Decimal(0)
        previous = sale.status
        if target == PropertySale.Status.RESERVED:
            if listing.status != SaleListing.Status.AVAILABLE:
                raise ValidationError({'listing': 'The unit is not available for reservation.'})
            sale.reserved_at = timezone.now()
            listing.status = SaleListing.Status.RESERVED
            listing.reservation_expires_at = request.data.get('reservation_expires_at') or timezone.now() + timezone.timedelta(days=14)
        elif target == PropertySale.Status.CONTRACTED:
            if verified_total < sale.reservation_fee:
                raise ValidationError({'payment': 'Verified payments must cover the reservation fee before contracting.'})
            sale.contracted_on = request.data.get('contracted_on') or timezone.localdate()
        elif target == PropertySale.Status.COMPLETED:
            if verified_total < sale.agreed_price:
                raise ValidationError({'payment': 'The full sale price must be verified before completion.'})
            listing.status = SaleListing.Status.SOLD
            listing.unit.status = 'sold'
            listing.unit.save(update_fields=('status', 'updated_at'))
        elif target == PropertySale.Status.CANCELLED:
            if not notes:
                raise ValidationError({'notes': 'A cancellation reason is required.'})
            sale.cancellation_reason = notes
            listing.status = SaleListing.Status.AVAILABLE
            listing.reservation_expires_at = None
        sale.status = target
        sale.save()
        listing.save()
        SalesAuditEvent.objects.create(
            organization=organization, sale=sale, event_type='sale_status_change',
            from_status=previous, to_status=target, notes=notes,
            details={'verified_total': str(verified_total)}, actor=request.user,
        )
        return Response(PropertySaleSerializer(sale).data)


class InstallmentViewSet(SalesModelViewSet):
    queryset = Installment.objects.select_related('sale__buyer')
    serializer_class = InstallmentSerializer
    search_fields = ('sale__reference', 'sale__buyer__full_name', 'description', 'milestone')


class PaymentViewSet(SalesModelViewSet):
    queryset = SalePayment.objects.select_related('sale__buyer', 'installment', 'verified_by')
    serializer_class = SalePaymentSerializer
    search_fields = ('reference', 'external_reference', 'sale__reference', 'sale__buyer__full_name')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        payment = serializer.save(
            organization=organization, status=SalePayment.Status.PENDING,
            verified_by=None, verified_at=None, rejection_reason='',
        )
        SalesAuditEvent.objects.create(organization=organization, sale=payment.sale, payment=payment, event_type='payment_submitted', to_status=payment.status, actor=self.request.user)

    def perform_update(self, serializer):
        protected = {'status', 'verified_by', 'verified_at', 'rejection_reason'} & set(serializer.validated_data)
        if protected:
            raise ValidationError({'payment': 'Use verification actions for controlled payment status changes.'})
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        raise ValidationError({'payment': 'Payment records are permanent; reject or reverse them instead.'})

    def _recalculate_commissions(self, sale):
        verified_total = sale.payments.filter(status=SalePayment.Status.VERIFIED).aggregate(total=Sum('amount'))['total'] or Decimal(0)
        paid_percent = verified_total / sale.agreed_price * 100 if sale.agreed_price else Decimal(0)
        for commission in sale.commissions.exclude(status=AgentCommission.Status.PAID):
            commission.status = AgentCommission.Status.ELIGIBLE if paid_percent >= commission.required_paid_percent else AgentCommission.Status.PENDING
            commission.save(update_fields=('status', 'updated_at'))

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def verify(self, request, pk=None):
        organization = get_active_organization(request)
        payment = SalePayment.objects.select_for_update().select_related('installment', 'sale').filter(pk=pk, organization=organization).first()
        if not payment:
            return Response({'detail': 'Payment not found.'}, status=404)
        if payment.status != SalePayment.Status.PENDING:
            raise ValidationError({'status': 'Only pending payments can be verified.'})
        if not payment.installment_id:
            raise ValidationError({'installment': 'Select an installment before verification.'})
        installment = Installment.objects.select_for_update().get(pk=payment.installment_id)
        remaining = installment.amount - installment.paid_amount
        if payment.amount > remaining:
            raise ValidationError({'amount': 'Payment exceeds the installment balance.'})
        installment.paid_amount += payment.amount
        installment.status = Installment.Status.PAID if installment.paid_amount == installment.amount else Installment.Status.PARTIAL
        installment.save()
        payment.status = SalePayment.Status.VERIFIED
        payment.verified_by = request.user
        payment.verified_at = timezone.now()
        payment.rejection_reason = ''
        payment.save()
        self._recalculate_commissions(payment.sale)
        SalesAuditEvent.objects.create(organization=organization, sale=payment.sale, payment=payment, event_type='payment_verified', from_status='pending', to_status='verified', details={'allocated': str(payment.amount), 'installment': installment.sequence}, actor=request.user)
        return Response(SalePaymentSerializer(payment).data)

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def reject(self, request, pk=None):
        payment = SalePayment.objects.select_for_update().filter(pk=pk, organization=get_active_organization(request)).first()
        reason = str(request.data.get('reason', '')).strip()
        if not payment or payment.status != SalePayment.Status.PENDING:
            raise ValidationError({'status': 'Only pending payments can be rejected.'})
        if not reason:
            raise ValidationError({'reason': 'A rejection reason is required.'})
        payment.status = SalePayment.Status.REJECTED; payment.rejection_reason = reason; payment.save()
        SalesAuditEvent.objects.create(organization=payment.organization, sale=payment.sale, payment=payment, event_type='payment_rejected', from_status='pending', to_status='rejected', notes=reason, actor=request.user)
        return Response(SalePaymentSerializer(payment).data)

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def reverse(self, request, pk=None):
        payment = SalePayment.objects.select_for_update().select_related('installment', 'sale').filter(pk=pk, organization=get_active_organization(request)).first()
        reason = str(request.data.get('reason', '')).strip()
        if not payment or payment.status != SalePayment.Status.VERIFIED:
            raise ValidationError({'status': 'Only verified payments can be reversed.'})
        if not reason:
            raise ValidationError({'reason': 'A reversal reason is required.'})
        if payment.installment_id:
            installment = Installment.objects.select_for_update().get(pk=payment.installment_id)
            installment.paid_amount = max(Decimal(0), installment.paid_amount - payment.amount)
            if installment.paid_amount == 0:
                installment.status = Installment.Status.DUE if installment.due_on <= timezone.localdate() else Installment.Status.UPCOMING
            elif installment.paid_amount < installment.amount:
                installment.status = Installment.Status.PARTIAL
            installment.save()
        payment.status = SalePayment.Status.REVERSED
        payment.rejection_reason = reason
        payment.save()
        self._recalculate_commissions(payment.sale)
        SalesAuditEvent.objects.create(organization=payment.organization, sale=payment.sale, payment=payment, event_type='payment_reversed', from_status='verified', to_status='reversed', notes=reason, details={'amount': str(payment.amount)}, actor=request.user)
        return Response(SalePaymentSerializer(payment).data)


class SiteVisitViewSet(SalesModelViewSet):
    queryset = SiteVisit.objects.select_related('project', 'introducing_agent', 'converted_buyer')
    serializer_class = SiteVisitSerializer
    search_fields = ('reference', 'visitor_name', 'email', 'phone', 'project__name')


class CommissionViewSet(SalesModelViewSet):
    queryset = AgentCommission.objects.select_related('sale__buyer', 'agent')
    serializer_class = AgentCommissionSerializer
    search_fields = ('reference', 'sale__reference', 'sale__buyer__full_name', 'agent__username')


class SaleDocumentViewSet(SalesModelViewSet):
    queryset = SaleDocument.objects.select_related('sale')
    serializer_class = SaleDocumentSerializer
    search_fields = ('title', 'document_type', 'sale__reference')


class SalesAuditEventViewSet(SalesModelViewSet):
    queryset = SalesAuditEvent.objects.select_related('sale', 'payment', 'actor')
    serializer_class = SalesAuditEventSerializer
    http_method_names = ('get', 'head', 'options')
    search_fields = ('sale__reference', 'payment__reference', 'event_type', 'notes')


class SalesDashboardViewSet(ViewSet):
    permission_classes = (HasModuleSubscription,)
    required_module = Module.SALES

    def list(self, request):
        organization = get_active_organization(request)
        listings = SaleListing.objects.for_organization(organization)
        sales = PropertySale.objects.for_organization(organization)
        payments = SalePayment.objects.for_organization(organization)
        visits = SiteVisit.objects.for_organization(organization)
        commissions = AgentCommission.objects.for_organization(organization)
        verified = payments.filter(status=SalePayment.Status.VERIFIED)
        pipeline = sales.exclude(status__in=(PropertySale.Status.COMPLETED, PropertySale.Status.CANCELLED))
        return Response({
            'kpis': {
                'availableUnits': listings.filter(status=SaleListing.Status.AVAILABLE).count(),
                'reservedUnits': listings.filter(status=SaleListing.Status.RESERVED).count(),
                'soldUnits': listings.filter(status=SaleListing.Status.SOLD).count(),
                'salesValue': sales.exclude(status=PropertySale.Status.CANCELLED).aggregate(total=Sum('agreed_price'))['total'] or 0,
                'verifiedPayments': verified.aggregate(total=Sum('amount'))['total'] or 0,
                'pendingPayments': payments.filter(status=SalePayment.Status.PENDING).count(),
                'activeBuyers': Buyer.objects.for_organization(organization).filter(status__in=(Buyer.Status.QUALIFIED, Buyer.Status.ACTIVE)).count(),
                'siteVisits': visits.count(), 'pipelineDeals': pipeline.count(),
                'pendingCommissions': commissions.exclude(status=AgentCommission.Status.PAID).aggregate(total=Sum('amount'))['total'] or 0,
            },
            'recentSales': PropertySaleSerializer(sales[:6], many=True).data,
            'pendingPayments': SalePaymentSerializer(payments.filter(status=SalePayment.Status.PENDING)[:5], many=True).data,
            'inventoryByStatus': list(listings.values('status').annotate(count=Count('id')).order_by('status')),
            'salesByProject': list(sales.values('listing__project__name').annotate(count=Count('id'), value=Sum('agreed_price')).order_by('-value')),
        })
