from django.db.models import Count, Sum
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet

from core.models import Module
from core.permissions import HasModuleSubscription
from core.tenancy import get_active_organization

from .models import AgentCommission, Buyer, Installment, PropertySale, SaleDocument, SaleListing, SalePayment, SiteVisit
from .serializers import AgentCommissionSerializer, BuyerSerializer, InstallmentSerializer, PropertySaleSerializer, SaleDocumentSerializer, SaleListingSerializer, SalePaymentSerializer, SiteVisitSerializer


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

    def perform_create(self, serializer):
        serializer.save(organization=get_active_organization(self.request))


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


class InstallmentViewSet(SalesModelViewSet):
    queryset = Installment.objects.select_related('sale__buyer')
    serializer_class = InstallmentSerializer
    search_fields = ('sale__reference', 'sale__buyer__full_name', 'description', 'milestone')


class PaymentViewSet(SalesModelViewSet):
    queryset = SalePayment.objects.select_related('sale__buyer', 'installment', 'verified_by')
    serializer_class = SalePaymentSerializer
    search_fields = ('reference', 'external_reference', 'sale__reference', 'sale__buyer__full_name')


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
