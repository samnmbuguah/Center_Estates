import csv
import uuid
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Count, DecimalField, F, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet, ViewSet

from core.models import Module
from core.permissions import HasModuleActionPermission
from core.tenancy import get_active_organization

from .models import (
    BankTransaction, Building, Budget, CreditNote, Expense, Invoice,
    InvoiceReminder, Lease, Project, Property, Receipt, ReceiptAllocation,
    RentSchedule, ServiceCharge,
    ServiceChargeAllocation, ServiceChargeReconciliation, Tenant, TenantDocument,
    TenantPortalAccess, Unit,
)
from .serializers import (
    BankTransactionSerializer, BuildingSerializer, BudgetSerializer,
    CreditNoteSerializer, ExpenseSerializer, InvoiceReminderSerializer,
    InvoiceSerializer, LeaseSerializer, ProjectSerializer, PropertySerializer,
    ReceiptAllocationSerializer, ReceiptSerializer, RentScheduleSerializer,
    ServiceChargeAllocationSerializer, ServiceChargeReconciliationSerializer,
    ServiceChargeSerializer, TenantDocumentSerializer, TenantPortalAccessSerializer,
    TenantSerializer, UnitSerializer,
)


class OrganizationModelViewSet(ModelViewSet):
    permission_classes = (HasModuleActionPermission,)
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
    write_permission = 'property.operations'
    queryset = Property.objects.annotate(buildings_count=Count('buildings'), units_count=Count('units'))
    serializer_class = PropertySerializer
    search_fields = ('name', 'code', 'city')

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='bulk-units')
    def bulk_units(self, request, pk=None):
        property_record = self.get_object()
        try:
            count = int(request.data.get('count', 0))
            start = int(request.data.get('start', 1))
        except (TypeError, ValueError):
            raise ValidationError({'count': 'Count and start must be whole numbers.'})
        if not 1 <= count <= 500:
            raise ValidationError({'count': 'Generate between 1 and 500 units at a time.'})
        prefix = str(request.data.get('prefix', '')).strip().upper()
        if len(prefix) > 20:
            raise ValidationError({'prefix': 'Prefix cannot exceed 20 characters.'})
        building = None
        building_id = request.data.get('building')
        if building_id:
            building = Building.objects.for_organization(property_record.organization).filter(
                pk=building_id, property=property_record,
            ).first()
            if not building:
                raise ValidationError({'building': 'Building must belong to this property.'})
        created = []
        for number in range(start, start + count):
            code = f'{prefix}{number}'
            unit, was_created = Unit.objects.get_or_create(
                organization=property_record.organization, property=property_record, code=code,
                defaults={
                    'building': building, 'floor': str(request.data.get('floor', '')).strip(),
                    'unit_type': str(request.data.get('unit_type', '')).strip(),
                    'area': request.data.get('area') or None, 'status': Unit.Status.AVAILABLE,
                },
            )
            if was_created:
                created.append(unit)
        return Response({'created': len(created), 'units': UnitSerializer(created, many=True).data}, status=201)


class BuildingViewSet(OrganizationModelViewSet):
    write_permission = 'property.operations'
    queryset = Building.objects.select_related('property')
    serializer_class = BuildingSerializer
    search_fields = ('name', 'code', 'property__name')


class UnitViewSet(OrganizationModelViewSet):
    write_permission = 'property.operations'
    queryset = Unit.objects.select_related('property', 'building')
    serializer_class = UnitSerializer
    search_fields = ('code', 'unit_type', 'property__name')


class ProjectViewSet(OrganizationModelViewSet):
    write_permission = 'property.operations'
    queryset = Project.objects.select_related('property')
    serializer_class = ProjectSerializer
    search_fields = ('name', 'code')


class TenantViewSet(OrganizationModelViewSet):
    write_permission = 'property.leasing'
    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
    search_fields = ('name', 'code', 'email', 'phone')


class TenantPortalAccessViewSet(OrganizationModelViewSet):
    write_permission = 'property.leasing'
    queryset = TenantPortalAccess.objects.select_related('user', 'tenant')
    serializer_class = TenantPortalAccessSerializer
    search_fields = ('user__username', 'tenant__name', 'tenant__code')


class LeaseViewSet(OrganizationModelViewSet):
    write_permission = 'property.leasing'
    queryset = Lease.objects.select_related('tenant', 'unit__property')
    serializer_class = LeaseSerializer
    search_fields = ('reference', 'tenant__name', 'unit__code')

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def activate(self, request, pk=None):
        lease = Lease.objects.select_for_update().get(pk=self.get_object().pk)
        if lease.status != Lease.Status.DRAFT:
            raise ValidationError({'status': 'Only draft leases can be activated.'})
        if lease.unit.status in (Unit.Status.SOLD, Unit.Status.UNAVAILABLE):
            raise ValidationError({'unit': 'This unit is not available for occupation.'})
        conflict = Lease.objects.for_organization(lease.organization).filter(
            unit=lease.unit, status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING),
        ).exclude(pk=lease.pk).exists()
        if conflict:
            raise ValidationError({'unit': 'This unit already has a current lease.'})
        lease.status = Lease.Status.ACTIVE
        lease.save(update_fields=('status', 'updated_at'))
        lease.unit.status = Unit.Status.OCCUPIED
        lease.unit.save(update_fields=('status', 'updated_at'))
        if lease.tenant.status == Tenant.Status.PROSPECT:
            lease.tenant.status = Tenant.Status.ACTIVE
            lease.tenant.save(update_fields=('status', 'updated_at'))
        return Response(self.get_serializer(lease).data)

    def _close(self, lease, status):
        if lease.status not in (Lease.Status.ACTIVE, Lease.Status.EXPIRING):
            raise ValidationError({'status': 'Only active or expiring leases can be closed.'})
        lease.status = status
        lease.save(update_fields=('status', 'updated_at'))
        has_current_lease = Lease.objects.for_organization(lease.organization).filter(
            unit=lease.unit, status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING),
        ).exclude(pk=lease.pk).exists()
        if not has_current_lease and lease.unit.status == Unit.Status.OCCUPIED:
            lease.unit.status = Unit.Status.AVAILABLE
            lease.unit.save(update_fields=('status', 'updated_at'))
        return Response(self.get_serializer(lease).data)

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def terminate(self, request, pk=None):
        lease = Lease.objects.select_for_update().get(pk=self.get_object().pk)
        return self._close(lease, Lease.Status.TERMINATED)

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def expire(self, request, pk=None):
        lease = Lease.objects.select_for_update().get(pk=self.get_object().pk)
        return self._close(lease, Lease.Status.EXPIRED)

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def renew(self, request, pk=None):
        lease = Lease.objects.select_for_update().get(pk=self.get_object().pk)
        if hasattr(lease, 'renewal'):
            return Response(self.get_serializer(lease.renewal).data)
        if lease.status not in (Lease.Status.ACTIVE, Lease.Status.EXPIRING):
            raise ValidationError({'status': 'Only active or expiring leases can be renewed.'})
        reference = str(request.data.get('reference', '')).strip()
        try:
            ends_on = date.fromisoformat(str(request.data.get('ends_on', '')))
            monthly_rent = Decimal(str(request.data.get('monthly_rent', '')))
        except (ValueError, ArithmeticError):
            raise ValidationError({'renewal': 'Reference, end date and monthly rent are required.'})
        if not reference:
            raise ValidationError({'reference': 'A renewal reference is required.'})
        if ends_on <= lease.ends_on or monthly_rent <= 0:
            raise ValidationError({'renewal': 'Renewal must extend the term and use a positive rent.'})
        renewed = Lease.objects.create(
            organization=lease.organization, reference=reference, unit=lease.unit,
            tenant=lease.tenant, starts_on=lease.ends_on, ends_on=ends_on,
            monthly_rent=monthly_rent, deposit=lease.deposit,
            escalation_percent=request.data.get('escalation_percent', lease.escalation_percent),
            billing_day=lease.billing_day, status=Lease.Status.ACTIVE,
            renewed_from=lease, metadata={'renewed_from': lease.reference},
        )
        lease.status = Lease.Status.EXPIRED
        lease.save(update_fields=('status', 'updated_at'))
        return Response(self.get_serializer(renewed).data, status=201)

    def perform_destroy(self, instance):
        if instance.status != Lease.Status.DRAFT:
            raise ValidationError({'lease': 'Only draft leases can be deleted.'})
        instance.delete()


class InvoiceViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
    queryset = Invoice.objects.select_related('lease__tenant')
    serializer_class = InvoiceSerializer
    search_fields = ('number', 'lease__tenant__name')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        amount = serializer.validated_data['amount']
        serializer.save(organization=organization, balance=amount, status=Invoice.Status.DRAFT)

    def perform_update(self, serializer):
        invoice = serializer.instance
        if invoice.status != Invoice.Status.DRAFT:
            raise ValidationError({'invoice': 'Only draft invoices can be edited.'})
        self._validate_organization(serializer)
        amount = serializer.validated_data.get('amount', invoice.amount)
        serializer.save(balance=amount)

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def issue(self, request, pk=None):
        invoice = Invoice.objects.select_for_update().get(pk=self.get_object().pk)
        if invoice.status != Invoice.Status.DRAFT:
            raise ValidationError({'status': 'Only draft invoices can be issued.'})
        invoice.status = Invoice.Status.OVERDUE if invoice.due_on < timezone.localdate() else Invoice.Status.ISSUED
        invoice.save(update_fields=('status', 'updated_at'))
        return Response(self.get_serializer(invoice).data)

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def void(self, request, pk=None):
        invoice = Invoice.objects.select_for_update().get(pk=self.get_object().pk)
        if invoice.status not in (Invoice.Status.DRAFT, Invoice.Status.ISSUED, Invoice.Status.OVERDUE):
            raise ValidationError({'status': 'Paid or partially paid invoices cannot be voided.'})
        invoice.status = Invoice.Status.VOID
        invoice.save(update_fields=('status', 'updated_at'))
        return Response(self.get_serializer(invoice).data)

    @action(detail=True, methods=('post',), url_path='send-reminder')
    def send_reminder(self, request, pk=None):
        from notifications.models import Notification

        invoice = self.get_object()
        if invoice.status in (Invoice.Status.DRAFT, Invoice.Status.PAID, Invoice.Status.VOID) or invoice.balance <= 0:
            raise ValidationError({'invoice': 'Only outstanding issued invoices can receive reminders.'})
        channel = str(request.data.get('channel', InvoiceReminder.Channel.PORTAL))
        if channel not in InvoiceReminder.Channel.values:
            raise ValidationError({'channel': 'Select email, SMS or tenant portal.'})
        tenant = invoice.lease.tenant
        recipient = tenant.email if channel == InvoiceReminder.Channel.EMAIL else tenant.phone if channel == InvoiceReminder.Channel.SMS else tenant.name
        if not recipient:
            raise ValidationError({'recipient': f'Tenant has no {channel} contact.'})
        message = str(request.data.get('message', '')).strip() or f'Invoice {invoice.number} has an outstanding balance of {invoice.balance} due {invoice.due_on}.'
        reminder = InvoiceReminder.objects.create(
            organization=invoice.organization, invoice=invoice, channel=channel,
            recipient=recipient, message=message, sent_at=timezone.now(), sent_by=request.user,
        )
        if channel == InvoiceReminder.Channel.PORTAL:
            access = TenantPortalAccess.objects.for_organization(invoice.organization).filter(
                tenant=tenant, is_active=True,
            ).select_related('user').first()
            if access:
                Notification.objects.create(
                    organization=invoice.organization, recipient=access.user,
                    title=f'Payment reminder: {invoice.number}', message=message,
                    level=Notification.Level.WARNING, action_url='/tenant-portal',
                    metadata={'invoice_id': str(invoice.id)},
                )
        return Response(InvoiceReminderSerializer(reminder).data, status=201)

    def perform_destroy(self, instance):
        if instance.status != Invoice.Status.DRAFT:
            raise ValidationError({'invoice': 'Only draft invoices can be deleted.'})
        instance.delete()


class ReceiptViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
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
            if invoice.status not in (Invoice.Status.ISSUED, Invoice.Status.PARTIAL, Invoice.Status.OVERDUE):
                raise ValidationError({'invoice': 'Only issued invoices can receive payments.'})
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

    def perform_update(self, serializer):
        raise ValidationError({'receipt': 'Posted receipts are immutable.'})

    def perform_destroy(self, instance):
        raise ValidationError({'receipt': 'Posted receipts cannot be deleted.'})


class InvoiceReminderViewSet(ReadOnlyModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.PROPERTY
    serializer_class = InvoiceReminderSerializer

    def get_queryset(self):
        return InvoiceReminder.objects.for_organization(
            get_active_organization(self.request),
        ).select_related('invoice__lease__tenant')


class BankTransactionViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
    queryset = BankTransaction.objects.select_related('receipt')
    serializer_class = BankTransactionSerializer
    search_fields = ('reference', 'description', 'receipt__number')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), status=BankTransaction.Status.UNMATCHED)

    def perform_update(self, serializer):
        if serializer.instance.status != BankTransaction.Status.UNMATCHED:
            raise ValidationError({'transaction': 'Matched bank transactions are immutable.'})
        super().perform_update(serializer)

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def match(self, request, pk=None):
        transaction_record = BankTransaction.objects.select_for_update().get(pk=self.get_object().pk)
        if transaction_record.status != BankTransaction.Status.UNMATCHED:
            raise ValidationError({'status': 'Only unmatched transactions can be reconciled.'})
        receipt = Receipt.objects.select_for_update().filter(
            pk=request.data.get('receipt'), organization=transaction_record.organization,
        ).first()
        if not receipt:
            raise ValidationError({'receipt': 'Select an organization receipt.'})
        if receipt.amount != transaction_record.amount:
            raise ValidationError({'receipt': 'Receipt and bank transaction amounts must match.'})
        if BankTransaction.objects.filter(receipt=receipt).exclude(pk=transaction_record.pk).exists():
            raise ValidationError({'receipt': 'Receipt is already matched.'})
        transaction_record.receipt = receipt
        transaction_record.status = BankTransaction.Status.MATCHED
        transaction_record.matched_by = request.user
        transaction_record.matched_at = timezone.now()
        transaction_record.save()
        return Response(self.get_serializer(transaction_record).data)


class ExpenseViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
    queryset = Expense.objects.select_related('property')
    serializer_class = ExpenseSerializer
    search_fields = ('supplier', 'category', 'invoice_number', 'property__name')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), status=Expense.Status.DRAFT)

    def perform_update(self, serializer):
        if serializer.instance.status != Expense.Status.DRAFT:
            raise ValidationError({'expense': 'Only draft expenses can be edited.'})
        super().perform_update(serializer)

    def _transition(self, expense, allowed, status):
        if expense.status not in allowed:
            raise ValidationError({'status': f'Expense cannot move from {expense.status} to {status}.'})
        expense.status = status
        expense.save(update_fields=('status', 'updated_at'))
        return Response(self.get_serializer(expense).data)

    def _locked(self):
        return Expense.objects.select_for_update().get(pk=self.get_object().pk)

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def submit(self, request, pk=None):
        return self._transition(self._locked(), (Expense.Status.DRAFT, Expense.Status.REJECTED), Expense.Status.PENDING)

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def approve(self, request, pk=None):
        return self._transition(self._locked(), (Expense.Status.PENDING,), Expense.Status.APPROVED)

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def reject(self, request, pk=None):
        return self._transition(self._locked(), (Expense.Status.PENDING,), Expense.Status.REJECTED)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        return self._transition(self._locked(), (Expense.Status.APPROVED,), Expense.Status.PAID)

    def perform_destroy(self, instance):
        if instance.status != Expense.Status.DRAFT:
            raise ValidationError({'expense': 'Only draft expenses can be deleted.'})
        instance.delete()


class BudgetViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
    actual_expenses = Expense.objects.filter(
        organization=OuterRef('organization'), property=OuterRef('property'),
        category=OuterRef('category'), incurred_on__year=OuterRef('year'),
        status__in=(Expense.Status.APPROVED, Expense.Status.PAID),
    ).values('property').annotate(total=Sum('amount')).values('total')
    queryset = Budget.objects.select_related('property').annotate(
        actual_amount=Coalesce(Subquery(actual_expenses), Value(Decimal('0')), output_field=DecimalField()),
    ).annotate(variance=F('amount') - F('actual_amount'))
    serializer_class = BudgetSerializer

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), status=Budget.Status.DRAFT)

    def perform_update(self, serializer):
        if serializer.instance.status not in (Budget.Status.DRAFT, Budget.Status.REJECTED):
            raise ValidationError({'budget': 'Only draft or rejected budgets can be edited.'})
        super().perform_update(serializer)

    def _transition(self, budget, allowed, status):
        if budget.status not in allowed:
            raise ValidationError({'status': f'Budget cannot move from {budget.status} to {status}.'})
        budget.status = status
        if status == Budget.Status.APPROVED:
            budget.approved_by = self.request.user
            budget.approved_at = timezone.now()
        else:
            budget.approved_by = None
            budget.approved_at = None
        budget.save(update_fields=('status', 'approved_by', 'approved_at', 'updated_at'))
        return Response(self.get_serializer(budget).data)

    @action(detail=True, methods=('post',))
    def submit(self, request, pk=None):
        return self._transition(self.get_object(), (Budget.Status.DRAFT, Budget.Status.REJECTED), Budget.Status.PENDING)

    @action(detail=True, methods=('post',))
    def approve(self, request, pk=None):
        return self._transition(self.get_object(), (Budget.Status.PENDING,), Budget.Status.APPROVED)

    @action(detail=True, methods=('post',))
    def reject(self, request, pk=None):
        return self._transition(self.get_object(), (Budget.Status.PENDING,), Budget.Status.REJECTED)


class ServiceChargeViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
    queryset = ServiceCharge.objects.select_related('property').annotate(allocation_count=Count('allocations'))
    serializer_class = ServiceChargeSerializer

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='generate-allocations')
    def generate_allocations(self, request, pk=None):
        charge = ServiceCharge.objects.select_for_update().get(pk=self.get_object().pk)
        units = list(Unit.objects.for_organization(charge.organization).filter(property=charge.property).order_by('code'))
        if not units:
            raise ValidationError({'property': 'The property has no units to allocate.'})
        if charge.method == ServiceCharge.Method.AREA:
            if any(unit.area is None or unit.area <= 0 for unit in units):
                raise ValidationError({'units': 'Every unit requires a positive floor area for area-based allocation.'})
            weights = [unit.area for unit in units]
        else:
            weights = [Decimal('1') for _unit in units]
        weight_total = sum(weights, Decimal('0'))
        allocated = Decimal('0')
        records = []
        for index, (unit, weight) in enumerate(zip(units, weights)):
            ratio = (weight / weight_total).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
            annual = (charge.annual_budget * weight / weight_total).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            if index == len(units) - 1:
                annual = charge.annual_budget - allocated
                ratio = Decimal('1') - sum((row.ratio for row in records), Decimal('0'))
            record, _ = ServiceChargeAllocation.objects.update_or_create(
                organization=charge.organization, service_charge=charge, unit=unit,
                defaults={
                    'ratio': ratio, 'annual_amount': annual,
                    'monthly_amount': (annual / Decimal('12')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                },
            )
            allocated += annual
            records.append(record)
        ServiceChargeAllocation.objects.filter(service_charge=charge).exclude(unit__in=units).delete()
        return Response(ServiceChargeAllocationSerializer(records, many=True).data)

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def reconcile(self, request, pk=None):
        charge = ServiceCharge.objects.select_for_update().get(pk=self.get_object().pk)
        try:
            period_start = date.fromisoformat(str(request.data.get('period_start', '')))
            period_end = date.fromisoformat(str(request.data.get('period_end', '')))
        except ValueError:
            raise ValidationError({'period': 'Valid period_start and period_end dates are required.'})
        if period_end < period_start:
            raise ValidationError({'period_end': 'Period end cannot be before period start.'})
        year_days = Decimal('366' if period_start.year % 4 == 0 else '365')
        days = Decimal((period_end - period_start).days + 1)
        budgeted = (charge.annual_budget * days / year_days).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        actual = Expense.objects.for_organization(charge.organization).filter(
            property=charge.property, incurred_on__range=(period_start, period_end),
            status__in=(Expense.Status.APPROVED, Expense.Status.PAID),
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        reconciliation, _ = ServiceChargeReconciliation.objects.update_or_create(
            organization=charge.organization, service_charge=charge,
            period_start=period_start, period_end=period_end,
            defaults={
                'budgeted_amount': budgeted, 'actual_amount': actual,
                'variance': budgeted - actual, 'status': ServiceChargeReconciliation.Status.DRAFT,
                'prepared_by': request.user, 'reviewed_by': None, 'reviewed_at': None,
            },
        )
        return Response(ServiceChargeReconciliationSerializer(reconciliation).data)


class ServiceChargeAllocationViewSet(ReadOnlyModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.PROPERTY
    serializer_class = ServiceChargeAllocationSerializer

    def get_queryset(self):
        return ServiceChargeAllocation.objects.for_organization(
            get_active_organization(self.request),
        ).select_related('service_charge__property', 'unit')


class ServiceChargeReconciliationViewSet(ReadOnlyModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.PROPERTY
    serializer_class = ServiceChargeReconciliationSerializer

    def get_queryset(self):
        return ServiceChargeReconciliation.objects.for_organization(
            get_active_organization(self.request),
        ).select_related('service_charge__property')


class TenantDocumentViewSet(OrganizationModelViewSet):
    write_permission = 'property.leasing'
    permission_map = {'verify': 'property.leasing', 'reject': 'property.leasing'}
    queryset = TenantDocument.objects.select_related('tenant', 'verified_by')
    serializer_class = TenantDocumentSerializer
    search_fields = ('tenant__name', 'document_type', 'document_number')

    def perform_create(self, serializer):
        serializer.save(
            organization=self._validate_organization(serializer), status=TenantDocument.Status.PENDING,
        )

    @action(detail=True, methods=('post',))
    def verify(self, request, pk=None):
        document = self.get_object()
        if document.status != TenantDocument.Status.PENDING:
            raise ValidationError({'status': 'Only pending documents can be verified.'})
        document.status = TenantDocument.Status.VERIFIED
        document.verified_by = request.user
        document.verified_at = timezone.now()
        document.rejection_reason = ''
        document.save()
        return Response(self.get_serializer(document).data)

    @action(detail=True, methods=('post',))
    def reject(self, request, pk=None):
        document = self.get_object()
        if document.status != TenantDocument.Status.PENDING:
            raise ValidationError({'status': 'Only pending documents can be rejected.'})
        reason = str(request.data.get('reason', '')).strip()
        if not reason:
            raise ValidationError({'reason': 'A rejection reason is required.'})
        document.status = TenantDocument.Status.REJECTED
        document.rejection_reason = reason
        document.verified_by = request.user
        document.verified_at = timezone.now()
        document.save()
        return Response(self.get_serializer(document).data)


class RentScheduleViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
    queryset = RentSchedule.objects.select_related('lease__tenant', 'invoice')
    serializer_class = RentScheduleSerializer
    search_fields = ('lease__reference', 'lease__tenant__name')

    def perform_update(self, serializer):
        if serializer.instance.status != RentSchedule.Status.UPCOMING:
            raise ValidationError({'rent_schedule': 'Only upcoming schedule items can be edited.'})
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        if instance.status != RentSchedule.Status.UPCOMING:
            raise ValidationError({'rent_schedule': 'Only upcoming schedule items can be deleted.'})
        instance.delete()

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='generate-invoice')
    def generate_invoice(self, request, pk=None):
        schedule = RentSchedule.objects.select_for_update().get(pk=self.get_object().pk)
        if schedule.status == RentSchedule.Status.WAIVED:
            raise ValidationError({'status': 'A waived rent schedule cannot be invoiced.'})
        if schedule.invoice_id:
            return Response(self.get_serializer(schedule).data)
        invoice = Invoice.objects.create(
            organization=schedule.organization,
            number=f'RENT-{schedule.lease.reference}-{schedule.period_start:%Y%m%d}',
            lease=schedule.lease,
            invoice_type='rent',
            issued_on=timezone.localdate(),
            due_on=schedule.due_on,
            amount=schedule.total,
            balance=schedule.total,
            status=Invoice.Status.OVERDUE if schedule.due_on < timezone.localdate() else Invoice.Status.ISSUED,
        )
        schedule.invoice = invoice
        schedule.status = RentSchedule.Status.INVOICED
        schedule.save(update_fields=('invoice', 'status', 'updated_at'))
        return Response(self.get_serializer(schedule).data, status=201)


class ReceiptAllocationViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
    queryset = ReceiptAllocation.objects.select_related('receipt__tenant', 'invoice')
    serializer_class = ReceiptAllocationSerializer
    http_method_names = ('get', 'head', 'options')
    search_fields = ('receipt__number', 'invoice__number', 'receipt__tenant__name')


class CreditNoteViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
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
        if invoice.status not in (Invoice.Status.ISSUED, Invoice.Status.OVERDUE, Invoice.Status.PARTIAL):
            raise ValidationError({'invoice': 'Credit notes can only be issued against an outstanding posted invoice.'})
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
    permission_classes = (HasModuleActionPermission,)
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
        today = timezone.localdate()
        collection_trend = []
        for month in range(1, today.month + 1):
            billed = invoices.filter(issued_on__year=today.year, issued_on__month=month).exclude(
                status=Invoice.Status.VOID,
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            month_collected = receipts.filter(received_on__year=today.year, received_on__month=month).aggregate(
                total=Sum('amount'),
            )['total'] or Decimal('0')
            collection_trend.append({'month': date(today.year, month, 1).strftime('%b'), 'billed': billed, 'collected': month_collected})
        expiry_ranges = ((0, 30, '0–30 days'), (31, 60, '31–60 days'), (61, 90, '61–90 days'))
        lease_expiry = [
            {'label': label, 'count': leases.filter(status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING), ends_on__range=(today + timedelta(days=start), today + timedelta(days=end))).count()}
            for start, end, label in expiry_ranges
        ]
        lease_expiry.append({'label': '90+ days', 'count': leases.filter(status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING), ends_on__gt=today + timedelta(days=90)).count()})
        aging = {'current': Decimal('0'), '31–60': Decimal('0'), '61–90': Decimal('0'), '90+': Decimal('0')}
        for invoice in invoices.exclude(status__in=(Invoice.Status.PAID, Invoice.Status.VOID)).filter(balance__gt=0):
            days = max((today - invoice.due_on).days, 0)
            bucket = 'current' if days <= 30 else '31–60' if days <= 60 else '61–90' if days <= 90 else '90+'
            aging[bucket] += invoice.balance
        portfolio = []
        for property_record in properties:
            property_units = units.filter(property=property_record)
            property_invoices = invoices.filter(lease__unit__property=property_record).exclude(status=Invoice.Status.VOID)
            count = property_units.count(); occupied_count = property_units.filter(status=Unit.Status.OCCUPIED).count()
            portfolio.append({
                'id': property_record.id, 'name': property_record.name, 'units': count, 'occupied': occupied_count,
                'vacant': max(count - occupied_count, 0), 'occupancy': round(occupied_count / count * 100, 1) if count else 0,
                'monthlyRent': leases.filter(unit__property=property_record, status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING)).aggregate(total=Sum('monthly_rent'))['total'] or Decimal('0'),
                'outstanding': property_invoices.aggregate(total=Sum('balance'))['total'] or Decimal('0'),
            })
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
            'collectionTrend': collection_trend,
            'leaseExpiry': lease_expiry,
            'aging': [{'label': label, 'amount': amount} for label, amount in aging.items()],
            'portfolio': portfolio,
        })


class PropertyAnalyticsViewSet(ViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.PROPERTY

    def _organization(self):
        return get_active_organization(self.request)

    @action(detail=False, methods=('get',))
    def aging(self, request):
        today = timezone.localdate()
        invoices = Invoice.objects.for_organization(self._organization()).exclude(
            status__in=(Invoice.Status.PAID, Invoice.Status.VOID),
        ).filter(balance__gt=0).select_related('lease__tenant', 'lease__unit__property')
        bucket_names = ('current', '31_60', '61_90', '91_120', 'over_120')
        summary = {name: Decimal('0') for name in bucket_names}
        tenants = {}
        for invoice in invoices:
            days = max((today - invoice.due_on).days, 0)
            bucket = 'current' if days <= 30 else '31_60' if days <= 60 else '61_90' if days <= 90 else '91_120' if days <= 120 else 'over_120'
            summary[bucket] += invoice.balance
            tenant = invoice.lease.tenant
            row = tenants.setdefault(str(tenant.id), {
                'tenant': tenant.name, 'property': invoice.lease.unit.property.name,
                'unit': invoice.lease.unit.code, 'outstanding': Decimal('0'),
                'oldest_days': 0, 'invoice_count': 0,
            })
            row['outstanding'] += invoice.balance
            row['oldest_days'] = max(row['oldest_days'], days)
            row['invoice_count'] += 1
        return Response({
            'as_of': today, 'summary': summary, 'total': sum(summary.values(), Decimal('0')),
            'tenants': sorted(tenants.values(), key=lambda row: row['outstanding'], reverse=True),
        })

    @action(detail=False, methods=('get',), url_path='income-expenses')
    def income_expenses(self, request):
        organization = self._organization()
        today = timezone.localdate()
        year_start = today.replace(month=1, day=1)
        receipts = Receipt.objects.for_organization(organization).filter(received_on__gte=year_start)
        expenses = Expense.objects.for_organization(organization).filter(
            incurred_on__gte=year_start, status__in=(Expense.Status.APPROVED, Expense.Status.PAID),
        )
        income = receipts.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        spent = expenses.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        income_by_method = list(receipts.values('payment_method').annotate(total=Sum('amount')).order_by('-total'))
        expense_by_category = list(expenses.values('category').annotate(total=Sum('amount')).order_by('-total'))
        return Response({
            'period': {'start': year_start, 'end': today},
            'kpis': {'income': income, 'expenses': spent, 'net': income - spent},
            'incomeByMethod': income_by_method, 'expensesByCategory': expense_by_category,
        })

    def list(self, request):
        return Response({'reports': [
            {'key': 'aging', 'name': 'Outstanding aging', 'category': 'Financial'},
            {'key': 'income-expense', 'name': 'Income and expenses', 'category': 'Financial'},
            {'key': 'occupancy', 'name': 'Portfolio occupancy', 'category': 'Property'},
            {'key': 'lease-expiry', 'name': 'Lease expiry', 'category': 'Tenant'},
            {'key': 'budget-actual', 'name': 'Budget versus actual', 'category': 'Executive'},
            {'key': 'service-charge', 'name': 'Service charge allocations', 'category': 'Service charge'},
        ]})

    @action(detail=False, methods=('get',), url_path=r'exports/(?P<report_kind>[^/.]+)')
    def export(self, request, report_kind=None):
        organization = self._organization()
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="property-{report_kind}.csv"'
        writer = csv.writer(response)
        if report_kind == 'aging':
            writer.writerow(('Invoice', 'Tenant', 'Property', 'Unit', 'Due date', 'Balance', 'Days outstanding'))
            today = timezone.localdate()
            rows = Invoice.objects.for_organization(organization).exclude(
                status__in=(Invoice.Status.PAID, Invoice.Status.VOID),
            ).filter(balance__gt=0).select_related('lease__tenant', 'lease__unit__property')
            for invoice in rows:
                writer.writerow((invoice.number, invoice.lease.tenant.name, invoice.lease.unit.property.name,
                                 invoice.lease.unit.code, invoice.due_on, invoice.balance,
                                 max((today - invoice.due_on).days, 0)))
        elif report_kind == 'income-expense':
            writer.writerow(('Type', 'Date', 'Property / tenant', 'Category / method', 'Reference', 'Amount'))
            for receipt in Receipt.objects.for_organization(organization).select_related('tenant'):
                writer.writerow(('Income', receipt.received_on, receipt.tenant.name, receipt.payment_method, receipt.number, receipt.amount))
            for expense in Expense.objects.for_organization(organization).select_related('property'):
                writer.writerow(('Expense', expense.incurred_on, expense.property.name, expense.category, expense.invoice_number, expense.amount))
        elif report_kind == 'occupancy':
            writer.writerow(('Property', 'Unit', 'Type', 'Area', 'Status'))
            for unit in Unit.objects.for_organization(organization).select_related('property'):
                writer.writerow((unit.property.name, unit.code, unit.unit_type, unit.area or '', unit.status))
        elif report_kind == 'lease-expiry':
            writer.writerow(('Lease', 'Tenant', 'Property', 'Unit', 'End date', 'Status', 'Monthly rent'))
            for lease in Lease.objects.for_organization(organization).select_related('tenant', 'unit__property'):
                writer.writerow((lease.reference, lease.tenant.name, lease.unit.property.name, lease.unit.code,
                                 lease.ends_on, lease.status, lease.monthly_rent))
        elif report_kind == 'budget-actual':
            writer.writerow(('Property', 'Year', 'Category', 'Budget', 'Actual', 'Variance', 'Status'))
            budgets = BudgetViewSet.actual_expenses
            rows = Budget.objects.for_organization(organization).select_related('property').annotate(
                actual_amount=Coalesce(Subquery(budgets), Value(Decimal('0')), output_field=DecimalField()),
            ).annotate(variance=F('amount') - F('actual_amount'))
            for budget in rows:
                writer.writerow((budget.property.name, budget.year, budget.category, budget.amount,
                                 budget.actual_amount, budget.variance, budget.status))
        elif report_kind == 'service-charge':
            writer.writerow(('Scheme', 'Property', 'Unit', 'Ratio', 'Annual amount', 'Monthly amount'))
            rows = ServiceChargeAllocation.objects.for_organization(organization).select_related('service_charge__property', 'unit')
            for allocation in rows:
                writer.writerow((allocation.service_charge.name, allocation.service_charge.property.name,
                                 allocation.unit.code, allocation.ratio, allocation.annual_amount,
                                 allocation.monthly_amount))
        else:
            raise ValidationError({'report': 'Unknown property report.'})
        return response


class TenantPortalViewSet(ViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.PROPERTY

    def _access(self):
        organization = get_active_organization(self.request)
        access = TenantPortalAccess.objects.for_organization(organization).filter(
            user=self.request.user, is_active=True,
        ).select_related('tenant').first()
        if not access:
            raise PermissionDenied('No active tenant portal profile is linked to this account.')
        return access

    def list(self, request):
        from facilities.models import ServiceRequest
        from notifications.models import Notification

        access = self._access()
        tenant = access.tenant
        leases = Lease.objects.for_organization(tenant.organization).filter(tenant=tenant).select_related(
            'unit__property',
        ).order_by('-starts_on')
        current_lease = leases.filter(status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING)).first()
        invoices = Invoice.objects.for_organization(tenant.organization).filter(
            lease__tenant=tenant,
        ).select_related('lease').order_by('-issued_on')
        receipts = Receipt.objects.for_organization(tenant.organization).filter(tenant=tenant).order_by('-received_on')
        outstanding = invoices.exclude(status__in=(Invoice.Status.PAID, Invoice.Status.VOID)).aggregate(
            total=Sum('balance'),
        )['total'] or Decimal('0')
        return Response({
            'tenant': TenantSerializer(tenant).data,
            'currentLease': LeaseSerializer(current_lease).data if current_lease else None,
            'balance': outstanding,
            'invoices': InvoiceSerializer(invoices[:12], many=True).data,
            'receipts': ReceiptSerializer(receipts[:12], many=True).data,
            'documents': TenantDocumentSerializer(
                TenantDocument.objects.for_organization(tenant.organization).filter(tenant=tenant)[:12], many=True,
            ).data,
            'serviceRequests': list(ServiceRequest.objects.for_organization(tenant.organization).filter(
                tenant=tenant,
            ).values('id', 'reference', 'subject', 'category', 'priority', 'status', 'submitted_at', 'resolved_at')[:12]),
            'notices': list(Notification.objects.for_organization(tenant.organization).filter(
                recipient=request.user,
            ).values('id', 'title', 'message', 'level', 'created_at', 'read_at')[:12]),
        })

    @action(detail=False, methods=('post',), url_path='service-requests')
    def service_request(self, request):
        from facilities.models import ServiceRequest, WorkOrder

        access = self._access()
        lease = Lease.objects.for_organization(access.organization).filter(
            tenant=access.tenant, status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING),
        ).select_related('unit__property').first()
        if not lease:
            raise ValidationError({'lease': 'An active lease is required to report a maintenance issue.'})
        subject = str(request.data.get('subject', '')).strip()
        category = str(request.data.get('category', '')).strip()
        if not subject or not category:
            raise ValidationError({'request': 'Subject and category are required.'})
        priority = str(request.data.get('priority', WorkOrder.Priority.MEDIUM))
        if priority not in WorkOrder.Priority.values:
            raise ValidationError({'priority': 'Select a valid priority.'})
        service_request = ServiceRequest.objects.create(
            organization=access.organization,
            reference=f'REQ-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}',
            subject=subject, description=str(request.data.get('description', '')).strip(),
            category=category, property=lease.unit.property, unit=lease.unit,
            tenant=access.tenant, priority=priority, status=ServiceRequest.Status.NEW,
            submitted_at=timezone.now(),
        )
        return Response({
            'id': service_request.id, 'reference': service_request.reference,
            'subject': service_request.subject, 'status': service_request.status,
        }, status=201)
