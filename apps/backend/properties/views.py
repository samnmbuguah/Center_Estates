from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet, ViewSet

from core.models import Module
from core.permissions import HasModuleSubscription
from core.tenancy import get_active_organization

from .models import (
    Building, Budget, CreditNote, Expense, Invoice, Lease, Project, Property,
    Receipt, ReceiptAllocation, RentSchedule, ServiceCharge, Tenant,
    TenantDocument, Unit,
)
from .serializers import (
    BuildingSerializer, BudgetSerializer, CreditNoteSerializer, ExpenseSerializer,
    InvoiceSerializer, LeaseSerializer, ProjectSerializer, PropertySerializer,
    ReceiptAllocationSerializer, ReceiptSerializer, RentScheduleSerializer,
    ServiceChargeSerializer, TenantDocumentSerializer, TenantSerializer,
    UnitSerializer,
)


class OrganizationModelViewSet(ModelViewSet):
    permission_classes = (HasModuleSubscription,)
    required_module = Module.PROPERTY
    search_fields = ()

    def get_queryset(self):
        queryset = self.queryset.for_organization(get_active_organization(self.request))
        search = self.request.query_params.get('search', '').strip()
        if search and self.search_fields:
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
            related_organization = getattr(value, 'organization_id', organization.id)
            if related_organization != organization.id:
                raise ValidationError({name: 'The selected record belongs to another organization.'})
        return organization

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer))

    def perform_update(self, serializer):
        self._validate_organization(serializer)
        serializer.save()


class PropertyViewSet(OrganizationModelViewSet):
    queryset = Property.objects.annotate(buildings_count=Count('buildings'), units_count=Count('units'))
    serializer_class = PropertySerializer
    search_fields = ('name', 'code', 'city')


class BuildingViewSet(OrganizationModelViewSet):
    queryset = Building.objects.select_related('property')
    serializer_class = BuildingSerializer
    search_fields = ('name', 'code', 'property__name')


class UnitViewSet(OrganizationModelViewSet):
    queryset = Unit.objects.select_related('property', 'building')
    serializer_class = UnitSerializer
    search_fields = ('code', 'unit_type', 'property__name')


class ProjectViewSet(OrganizationModelViewSet):
    queryset = Project.objects.select_related('property')
    serializer_class = ProjectSerializer
    search_fields = ('name', 'code')


class TenantViewSet(OrganizationModelViewSet):
    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
    search_fields = ('name', 'code', 'email', 'phone')


class LeaseViewSet(OrganizationModelViewSet):
    queryset = Lease.objects.select_related('tenant', 'unit__property')
    serializer_class = LeaseSerializer
    search_fields = ('reference', 'tenant__name', 'unit__code')


class InvoiceViewSet(OrganizationModelViewSet):
    queryset = Invoice.objects.select_related('lease__tenant')
    serializer_class = InvoiceSerializer
    search_fields = ('number', 'lease__tenant__name')


class ReceiptViewSet(OrganizationModelViewSet):
    queryset = Receipt.objects.select_related('tenant', 'invoice')
    serializer_class = ReceiptSerializer
    search_fields = ('number', 'tenant__name', 'external_reference')

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        invoice = serializer.validated_data.get('invoice')
        tenant = serializer.validated_data.get('tenant')
        amount = serializer.validated_data['amount']
        if invoice:
            invoice = Invoice.objects.select_for_update().filter(pk=invoice.pk, organization=organization).first()
            if not invoice:
                raise ValidationError({'invoice': 'Invoice belongs to another organization.'})
            if invoice.lease.tenant_id != tenant.id:
                raise ValidationError({'invoice': 'Invoice belongs to another tenant.'})
            if amount > invoice.balance:
                raise ValidationError({'amount': 'Receipt exceeds the invoice balance.'})
        receipt = serializer.save(organization=organization, received_by=self.request.user)
        if invoice:
            ReceiptAllocation.objects.create(
                organization=organization, receipt=receipt, invoice=invoice,
                amount=amount, allocated_by=self.request.user,
            )
            invoice.balance -= amount
            invoice.status = Invoice.Status.PAID if invoice.balance == 0 else Invoice.Status.PARTIAL
            invoice.save(update_fields=('balance', 'status', 'updated_at'))


class ExpenseViewSet(OrganizationModelViewSet):
    queryset = Expense.objects.select_related('property')
    serializer_class = ExpenseSerializer
    search_fields = ('supplier', 'category', 'invoice_number', 'property__name')


class BudgetViewSet(OrganizationModelViewSet):
    queryset = Budget.objects.select_related('property')
    serializer_class = BudgetSerializer


class ServiceChargeViewSet(OrganizationModelViewSet):
    queryset = ServiceCharge.objects.select_related('property')
    serializer_class = ServiceChargeSerializer


class TenantDocumentViewSet(OrganizationModelViewSet):
    queryset = TenantDocument.objects.select_related('tenant', 'verified_by')
    serializer_class = TenantDocumentSerializer
    search_fields = ('tenant__name', 'document_type', 'document_number')

    @action(detail=True, methods=('post',))
    def verify(self, request, pk=None):
        document = self.get_object()
        document.status = TenantDocument.Status.VERIFIED
        document.verified_by = request.user
        document.verified_at = timezone.now()
        document.rejection_reason = ''
        document.save()
        return Response(self.get_serializer(document).data)


class RentScheduleViewSet(OrganizationModelViewSet):
    queryset = RentSchedule.objects.select_related('lease__tenant', 'invoice')
    serializer_class = RentScheduleSerializer
    search_fields = ('lease__reference', 'lease__tenant__name')


class ReceiptAllocationViewSet(OrganizationModelViewSet):
    queryset = ReceiptAllocation.objects.select_related('receipt__tenant', 'invoice')
    serializer_class = ReceiptAllocationSerializer
    http_method_names = ('get', 'head', 'options')
    search_fields = ('receipt__number', 'invoice__number', 'receipt__tenant__name')


class CreditNoteViewSet(OrganizationModelViewSet):
    queryset = CreditNote.objects.select_related('invoice__lease__tenant', 'issued_by')
    serializer_class = CreditNoteSerializer
    search_fields = ('number', 'invoice__number', 'invoice__lease__tenant__name', 'reason')

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        candidate = serializer.validated_data['invoice']
        invoice = Invoice.objects.select_for_update().filter(pk=candidate.pk, organization=organization).first()
        if not invoice:
            raise ValidationError({'invoice': 'Invoice belongs to another organization.'})
        amount = serializer.validated_data['amount']
        if amount > invoice.balance:
            raise ValidationError({'amount': 'Credit note exceeds the invoice balance.'})
        serializer.save(organization=organization, invoice=invoice, issued_by=self.request.user)
        invoice.balance -= amount
        invoice.status = Invoice.Status.PAID if invoice.balance == 0 else Invoice.Status.PARTIAL
        invoice.save(update_fields=('balance', 'status', 'updated_at'))

    def perform_update(self, serializer):
        raise ValidationError({'credit_note': 'Issued credit notes are immutable.'})

    def perform_destroy(self, instance):
        raise ValidationError({'credit_note': 'Credit notes cannot be deleted.'})


class PropertyDashboardViewSet(ViewSet):
    permission_classes = (HasModuleSubscription,)
    required_module = Module.PROPERTY

    def list(self, request):
        organization = get_active_organization(request)
        properties = Property.objects.for_organization(organization)
        units = Unit.objects.for_organization(organization)
        leases = Lease.objects.for_organization(organization)
        invoices = Invoice.objects.for_organization(organization)
        receipts = Receipt.objects.for_organization(organization)
        expenses = Expense.objects.for_organization(organization)
        occupied = units.filter(status=Unit.Status.OCCUPIED).count()
        total_units = units.count()
        outstanding = invoices.exclude(status__in=(Invoice.Status.PAID, Invoice.Status.VOID)).aggregate(total=Sum('balance'))['total'] or 0
        collected = receipts.filter(received_on__year=timezone.localdate().year).aggregate(total=Sum('amount'))['total'] or 0
        spent = expenses.filter(incurred_on__year=timezone.localdate().year).aggregate(total=Sum('amount'))['total'] or 0
        return Response({
            'kpis': {
                'properties': properties.count(), 'units': total_units, 'occupiedUnits': occupied,
                'occupancyRate': round((occupied / total_units * 100), 1) if total_units else 0,
                'activeLeases': leases.filter(status=Lease.Status.ACTIVE).count(),
                'activeTenants': Tenant.objects.for_organization(organization).filter(status=Tenant.Status.ACTIVE).count(),
                'outstanding': outstanding, 'collectedYtd': collected, 'expensesYtd': spent,
            },
            'recentLeases': LeaseSerializer(leases[:5], many=True).data,
            'overdueInvoices': InvoiceSerializer(invoices.filter(status=Invoice.Status.OVERDUE)[:5], many=True).data,
            'propertyMix': list(properties.values('property_type').annotate(count=Count('id')).order_by('-count')),
        })
