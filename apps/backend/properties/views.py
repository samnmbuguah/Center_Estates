from __future__ import annotations

import csv
import calendar
import hashlib
import hmac
import json
import os
from io import BytesIO, StringIO
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema, extend_schema_view
import uuid
from datetime import date, datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.core.files.base import ContentFile
from django.db.models import Count, DecimalField, F, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.http import FileResponse, HttpResponse, QueryDict
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet, ViewSet

from core.models import Module
from core.permissions import HasModuleActionPermission, HasModuleSubscription
from core.serializers import GenericObjectSerializer
from core.tenancy import get_active_membership, get_active_organization
from core.property_scope import get_active_property, scope_model_queryset, scope_queryset_to_property

from .models import (
    BankTransaction, BillingCandidate, BillingItem, BillingProfile, BillingReadinessIssue, BillingRun,
    Building, Budget, CreditNote, Expense, Invoice, InvoiceLine,
    InvoiceReminder, Lease, PaymentGatewayConfiguration, PaymentIntent,
    PaymentWebhookEvent, Project, Property, Receipt, ReceiptAllocation,
    RentSchedule, ReportDefinition, ReportExecution, ScheduledReport, ServiceCharge,
    ServiceChargeAllocation, ServiceChargeReconciliation, Tenant, TenantDocument,
    TenantPortalAccess, TenantMovement, TaxConfiguration, Unit, UnitChargeRule, ParkingSpace, ParkingAssignment, UnitStatusHistory, LeaseEscalation,
    TenantHandover, ExitClearance, LandlordInvoice, Owner, PropertyCollectionAccount, PropertyFeeProfile,
)
from .serializers import (
    BankTransactionSerializer, BillingCandidateSerializer, BillingItemSerializer, BillingProfileSerializer,
    BillingReadinessIssueSerializer, BillingRunSerializer, BuildingSerializer, BudgetSerializer,
    CreditNoteSerializer, ExpenseSerializer, InvoiceReminderSerializer,
    InvoiceLineSerializer, InvoiceSerializer, LeaseEscalationSerializer, LeaseSerializer, PaymentGatewayConfigurationSerializer,
    PaymentIntentSerializer, ProjectSerializer, PropertySerializer,
    ReceiptAllocationSerializer, ReceiptSerializer, RentScheduleSerializer, ReportDefinitionSerializer,
    ReportExecutionSerializer, ScheduledReportSerializer,
    ServiceChargeAllocationSerializer, ServiceChargeReconciliationSerializer, ParkingSpaceSerializer, ParkingAssignmentSerializer,
    ServiceChargeSerializer, TaxConfigurationSerializer, TenantDocumentSerializer,
    TenantMovementSerializer, TenantPortalAccessSerializer, TenantSerializer,
    TenantHandoverSerializer, ExitClearanceSerializer, LandlordInvoiceSerializer,
    UnitSerializer, UnitChargeRuleSerializer, UnitStatusHistorySerializer,
    OwnerSerializer, PropertyCollectionAccountSerializer, PropertyFeeProfileSerializer,
)


def _parse_flexible_date(val):
    """Normalize ISO, DD/MM/YYYY, DD-MM-YYYY, Excel numbers, or text dates into a Python date."""
    if not val:
        return None
    val_str = str(val).strip()
    if not val_str:
        return None
    try:
        return date.fromisoformat(val_str)
    except Exception:
        pass
    for fmt in ('%d/%m/%Y', '%d-%m-%Y', '%d.%m.%Y', '%Y/%m/%d', '%d/%m/%y', '%d-%m-%y', '%Y.%m.%d', '%B %d, %Y', '%d %b %Y', '%d %B %Y'):
        try:
            return datetime.strptime(val_str, fmt).date()
        except Exception:
            pass
    if val_str.isdigit() and len(val_str) == 5:
        from datetime import timedelta
        try:
            return date(1899, 12, 30) + timedelta(days=int(val_str))
        except Exception:
            pass
    return None


def _payment_intent_invoices(intent, *, lock=False):
    """Return the audited invoice allocation encoded when an intent is created.

    PaymentIntent keeps its original invoice foreign key for compatibility while
    metadata carries a deterministic allocation for consolidated payments.
    """
    allocations = intent.metadata.get('invoice_allocations', []) if isinstance(intent.metadata, dict) else []
    invoice_ids = [str(row.get('invoice_id')) for row in allocations if row.get('invoice_id')]
    queryset = Invoice.objects.for_organization(intent.organization).filter(
        lease__tenant=intent.tenant,
        pk__in=invoice_ids or [intent.invoice_id],
    ).select_related('lease__unit__property')
    if lock:
        queryset = queryset.select_for_update()
    invoices_by_id = {str(invoice.pk): invoice for invoice in queryset}
    if not allocations:
        return [(intent.invoice if not lock else invoices_by_id[str(intent.invoice_id)], intent.amount)]
    resolved = []
    for row in allocations:
        invoice = invoices_by_id.get(str(row.get('invoice_id')))
        try:
            amount = Decimal(str(row.get('amount')))
        except Exception:
            raise ValidationError({'payment': 'The stored invoice allocation is invalid.'})
        if invoice is None or amount <= 0:
            raise ValidationError({'payment': 'A selected invoice is no longer available for this payment.'})
        resolved.append((invoice, amount))
    if sum((amount for _invoice, amount in resolved), Decimal('0')) != intent.amount:
        raise ValidationError({'payment': 'The invoice allocations do not equal the payment total.'})
    return resolved


def _allocate_payment_receipt(intent, receipt, user):
    allocations = _payment_intent_invoices(intent, lock=True)
    for invoice, amount in allocations:
        if amount > invoice.balance:
            raise ValidationError({'payment': f'Invoice {invoice.number} changed after checkout. Reconcile this payment manually.'})
        ReceiptAllocation.objects.create(
            organization=intent.organization, receipt=receipt,
            invoice=invoice, amount=amount, allocated_by=user,
        )
        invoice.balance = max(Decimal('0'), invoice.balance - amount)
        invoice.status = Invoice.Status.PAID if invoice.balance == 0 else Invoice.Status.PARTIAL
        invoice.save(update_fields=('balance', 'status', 'updated_at'))
    return [invoice for invoice, _amount in allocations]
from .pdf_documents import (
    arrears_aging_pdf, income_expenditure_pdf, invoice_pdf, receipt_pdf, service_charge_reconciliation_pdf,
    tabular_report_pdf, tenant_payment_status_pdf, tenant_payment_status_rows, tenant_statement_pdf,
)

REPORT_TITLES = {
    'tenant-payment-status': "Tenants Payment's Status Report",
    'income-expense': 'Receipts & Expenditure Account',
    'aging': 'Arrears Ageing Analysis',
    'billing-schedule': "Tenants Payment's Status Report",
    'expenses-schedule': 'Expense Schedule',
    'vat-schedule': 'VAT & Statutory Schedule',
    'occupancy': 'Portfolio Occupancy Register',
    'tenancy-schedule': 'Tenancy Schedule',
    'vacancy': 'Vacancy Register',
    'movements': 'Tenant Movements',
    'income-analysis': 'Income Analysis',
    'lease-expiry': 'Lease Expiry Register',
    'budget-actual': 'Budget versus Actual',
    'service-charge': 'Service Charge Allocations',
    'daily-collections': 'Daily Collections',
    'collections-property': 'Collections by Property',
    'collections-tenant': 'Collections by Tenant',
    'outstanding-balances': 'Outstanding Balances',
    'payment-reconciliation': 'Payment Reconciliation',
    'settlement': 'Settlement Report',
    'management-fee': 'Management Fee Report',
    'contractor-expiry': 'Service Provider Expiry',
    'work-order-spend': 'Work Order Spend',
    'tenant-compliance': 'Tenant Document Compliance',
    'critical-dates': 'Critical Dates Register',
    'stakeholder-directory': 'Master Contacts & Stakeholders Directory (Tenants, Landlords, Service Providers, PINs)',
}


def _unit_rule_amount(rule, unit):
    if rule.calculation == BillingItem.Calculation.AREA_RATE:
        return ((unit.area or Decimal('0')) * rule.rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    return rule.amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def _unit_deposit_amount(unit):
    """Return refundable deposits configured on the unit billing schedule."""
    rules = unit.charge_rules.filter(is_active=True).select_related('billing_item')
    return sum(
        (_unit_rule_amount(rule, unit) for rule in rules
         if 'DEPOSIT' in rule.billing_item.code.upper()),
        Decimal('0.00'),
    ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def _inherit_unit_charge_profiles(lease):
    """Snapshot unit defaults onto a lease; future unit edits never rewrite signed terms."""
    profiles = [
        BillingProfile(
            organization=lease.organization, lease=lease, billing_item=rule.billing_item,
            frequency=rule.frequency, calculation=rule.calculation,
            amount=rule.amount, rate=rule.rate, effective_from=lease.starts_on,
            effective_to=lease.ends_on, billing_day=rule.billing_day,
            custom_interval_months=rule.custom_interval_months,
            instructions=rule.instructions,
        )
        for rule in lease.unit.charge_rules.filter(is_active=True).select_related('billing_item')
    ]
    if profiles:
        BillingProfile.objects.bulk_create(profiles, ignore_conflicts=True)
from .lease_billing import generate_rent_schedule, refresh_schedule_amount, validate_lease_billable


def next_invoice_number(organization, year):
    """Allocate an invoice number while holding the organization row lock."""
    organization.__class__.objects.select_for_update().get(pk=organization.pk)
    values = Invoice.objects.for_organization(organization).filter(number__startswith=f'INV-{year}-').values_list('number', flat=True)
    sequences = [int(value.rsplit('-', 1)[-1]) for value in values if value.rsplit('-', 1)[-1].isdigit()]
    return f'INV-{year}-{max(sequences, default=0) + 1:06d}'


def next_credit_note_number(organization, year):
    """Allocate a credit note number while holding the organization row lock."""
    organization.__class__.objects.select_for_update().get(pk=organization.pk)
    values = CreditNote.objects.for_organization(organization).filter(number__startswith=f'CN-{year}-').values_list('number', flat=True)
    sequences = [int(value.rsplit('-', 1)[-1]) for value in values if value.rsplit('-', 1)[-1].isdigit()]
    return f'CN-{year}-{max(sequences, default=0) + 1:04d}'


def activate_lease_allocations(lease, user):
    """Promote reserved operational/financial records when a draft lease becomes active."""
    for allocation in lease.parking_assignments.filter(status=ParkingAssignment.Status.RESERVED).select_related('parking_space'):
        allocation.status = ParkingAssignment.Status.ACTIVE
        allocation.save(update_fields=('status', 'updated_at'))
        allocation.parking_space.status = ParkingSpace.Status.ASSIGNED
        allocation.parking_space.save(update_fields=('status', 'updated_at'))
    Invoice.objects.filter(lease=lease, invoice_type='opening_balance', status=Invoice.Status.DRAFT).update(
        status=Invoice.Status.ISSUED, issued_by=user, issued_at=timezone.now(), updated_at=timezone.now()
    )


class OrganizationModelViewSet(ModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.PROPERTY
    search_fields = ()

    def get_queryset(self):
        organization = get_active_organization(self.request)
        queryset = scope_queryset_to_property(self.queryset.for_organization(organization), self.request, organization)
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
        organization = self._validate_organization(serializer)
        model_name = serializer.Meta.model.__name__.upper()
        prefix = "PROP" if model_name == "PROPERTY" else "TNT" if model_name == "TENANT" else model_name[:4]
        from django.db.models import Max
        existing = serializer.Meta.model.objects.filter(organization=organization, code__startswith=f"{prefix}-").values_list("code", flat=True)
        numbers = [int(code.rsplit("-", 1)[-1]) for code in existing if code.rsplit("-", 1)[-1].isdigit()]
        serializer.save(organization=organization, code=f"{prefix}-{(max(numbers) + 1) if numbers else 1:04d}")

    def perform_update(self, serializer):
        self._validate_organization(serializer)
        serializer.save()


class PaymentGatewayConfigurationViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
    queryset = PaymentGatewayConfiguration.objects.select_related('property')
    serializer_class = PaymentGatewayConfigurationSerializer
    search_fields = ('display_name', 'merchant_reference', 'property__name')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        serializer.save(organization=organization)

    @action(detail=True, methods=('post',), url_path='test-stk')
    @extend_schema(request=None, responses={200: {"type": "object"}})
    def test_stk(self, request, pk=None):
        gateway = self.get_object()
        phone_number = str(request.data.get('phone_number') or request.user.username or '').strip()
        amount_val = request.data.get('amount') or 1
        try:
            amount = Decimal(str(amount_val))
            if amount <= 0:
                amount = Decimal('1')
        except Exception:
            amount = Decimal('1')

        if not phone_number:
            return Response({'success': False, 'error': 'Phone number is required for STK push.'}, status=400)

        cfg_settings = gateway.settings or {}
        consumer_key = cfg_settings.get('consumer_key') or os.environ.get('MPESA_CONSUMER_KEY', '')
        consumer_secret = cfg_settings.get('consumer_secret') or os.environ.get('MPESA_CONSUMER_SECRET', '')
        shortcode = cfg_settings.get('shortcode') or os.environ.get('MPESA_SHORTCODE', '')
        passkey = cfg_settings.get('passkey') or os.environ.get('MPESA_PASSKEY', '')
        environment = cfg_settings.get('environment', 'sandbox')

        from .mpesa_client import DEFAULT_SANDBOX_PASSKEY, initiate_stk_push
        if environment == 'sandbox' and not passkey:
            passkey = DEFAULT_SANDBOX_PASSKEY

        if not consumer_key or not consumer_secret:
            return Response({
                'success': False,
                'error': 'Daraja Consumer Key and Consumer Secret are required. Click "Edit" on the gateway to enter your Safaricom Daraja API credentials.'
            }, status=400)

        if not shortcode:
            return Response({
                'success': False,
                'error': 'Business Shortcode / Paybill number is missing in gateway settings.'
            }, status=400)

        callback_url = f"https://api.centerestates.com/api/v1/property/payment-webhooks/{gateway.public_key}/"
        result = initiate_stk_push(
            consumer_key=consumer_key,
            consumer_secret=consumer_secret,
            shortcode=shortcode,
            passkey=passkey,
            phone_number=phone_number,
            amount=amount,
            callback_url=callback_url,
            account_reference="TEST-STK",
            transaction_desc=f"Test Gateway {gateway.display_name}",
            environment=environment,
        )
        status_code = 200 if result.get('success') else 400
        return Response(result, status=status_code)


class PaymentIntentViewSet(ReadOnlyModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.PROPERTY
    queryset = PaymentIntent.objects.select_related('configuration', 'invoice', 'tenant')
    serializer_class = PaymentIntentSerializer

    def get_queryset(self):
        organization = get_active_organization(self.request)
        return scope_queryset_to_property(
            self.queryset.for_organization(organization), self.request, organization,
        )


class PaymentWebhookViewSet(ViewSet):
    """Signed, idempotent callback boundary for approved payment providers."""
    authentication_classes = ()
    permission_classes = (AllowAny,)

    serializer_class = GenericObjectSerializer

    @action(detail=False, methods=('post',), url_path=r'(?P<public_key>[0-9a-fA-F-]{36})')
    @extend_schema(request=None, responses={200: {"type": "object"}})
    def receive(self, request, public_key=None):
        configuration = PaymentGatewayConfiguration.objects.select_related('organization').filter(
            public_key=public_key, is_enabled=True,
        ).first()
        if configuration is None:
            return Response({'detail': 'Payment gateway is not available.'}, status=404)

        raw_body = request.body
        try:
            payload = json.loads(raw_body.decode('utf-8'))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return Response({'detail': 'Callback body must be valid JSON.'}, status=400)

        # Detect Safaricom STK Push callback format
        stk_callback = payload.get("Body", {}).get("stkCallback", {})
        is_safaricom = bool(stk_callback)

        if is_safaricom:
            return self._handle_safaricom_callback(configuration, payload, stk_callback, raw_body)
        else:
            return self._handle_generic_callback(configuration, payload, raw_body, request)

    def _handle_safaricom_callback(self, configuration, payload, stk_callback, raw_body):
        """Process Safaricom STK Push callback."""
        from .mpesa_client import parse_stk_callback
        parsed = parse_stk_callback(payload)
        event_id = parsed.get('checkout_request_id') or parsed.get('merchant_request_id', '')
        if not event_id:
            return Response({'detail': 'Missing Safaricom event identifiers.'}, status=400)

        payload_hash = hashlib.sha256(raw_body).hexdigest()
        with transaction.atomic():
            event, created = PaymentWebhookEvent.objects.get_or_create(
                organization=configuration.organization, configuration=configuration, event_id=event_id,
                defaults={'payload_hash': payload_hash, 'payload': payload},
            )
            if not created:
                return Response({'status': event.status, 'duplicate': True})

            # Find intent by checkout_request_id stored in external_reference
            intent = PaymentIntent.objects.select_for_update().select_related('invoice', 'tenant').filter(
                organization=configuration.organization, configuration=configuration,
                external_reference=parsed.get('checkout_request_id', ''),
            ).first()
            if not intent:
                # Fallback: try matching by merchant_request_id in metadata
                intent = PaymentIntent.objects.select_for_update().select_related('invoice', 'tenant').filter(
                    organization=configuration.organization, configuration=configuration,
                    metadata__merchant_request_id=parsed.get('merchant_request_id', ''),
                ).first()

            if not parsed.get('is_success'):
                event.status = PaymentWebhookEvent.Status.REJECTED
                event.error_message = parsed.get('result_desc', 'STK Push failed or was cancelled.')
                event.processed_at = timezone.now()
                event.save(update_fields=('status', 'error_message', 'processed_at', 'updated_at'))
                if intent and intent.status == PaymentIntent.Status.PENDING:
                    intent.status = PaymentIntent.Status.FAILED
                    intent.error_message = parsed.get('result_desc', 'STK Push failed')
                    intent.save(update_fields=('status', 'error_message', 'updated_at'))
                return Response({'status': 'rejected', 'detail': parsed.get('result_desc', 'Payment failed.')}, status=400)

            if intent is None:
                event.status = PaymentWebhookEvent.Status.REJECTED
                event.error_message = 'No matching payment intent found.'
                event.processed_at = timezone.now()
                event.save(update_fields=('status', 'error_message', 'processed_at', 'updated_at'))
                return Response({'status': 'rejected', 'detail': 'No matching payment intent.'}, status=400)

            if intent.status == PaymentIntent.Status.PAID:
                event.status = PaymentWebhookEvent.Status.PROCESSED
                event.processed_at = timezone.now()
                event.save(update_fields=('status', 'processed_at', 'updated_at'))
                return Response({'status': event.status, 'duplicate': True})

            receiver = TenantPortalAccess.objects.filter(
                organization=configuration.organization, tenant=intent.tenant, is_active=True,
            ).select_related('user').first()
            if receiver is None:
                event.status = PaymentWebhookEvent.Status.REJECTED
                event.error_message = 'No active tenant portal account can own the receipt.'
                event.processed_at = timezone.now()
                event.save(update_fields=('status', 'error_message', 'processed_at', 'updated_at'))
                return Response({'status': 'rejected', 'detail': event.error_message}, status=400)

            receipt = Receipt.objects.create(
                organization=configuration.organization,
                number=f'RCT-MP-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:8].upper()}',
                tenant=intent.tenant, invoice=intent.invoice, received_on=timezone.localdate(),
                amount=intent.amount, payment_method='M-Pesa',
                external_reference=parsed.get('mpesa_receipt_number', event_id), received_by=receiver.user,
            )
            paid_invoices = _allocate_payment_receipt(intent, receipt, receiver.user)
            invoice = paid_invoices[0]
            BankTransaction.objects.create(
                organization=configuration.organization,
                reference=parsed.get('mpesa_receipt_number', event_id), transacted_on=timezone.localdate(),
                description=f'M-Pesa payment {intent.reference}',
                amount=intent.amount, status=BankTransaction.Status.MATCHED, receipt=receipt,
                matched_by=receiver.user, matched_at=timezone.now(),
            )
            intent.status = PaymentIntent.Status.PAID
            intent.external_reference = parsed.get('mpesa_receipt_number', event_id)
            intent.paid_at = timezone.now()
            intent.metadata = {**intent.metadata, 'mpesa_receipt': parsed.get('mpesa_receipt_number', ''), 'result_code': parsed.get('result_code')}
            intent.save(update_fields=('status', 'external_reference', 'paid_at', 'metadata', 'updated_at'))
            from notifications.models import Notification
            Notification.objects.create(
                organization=configuration.organization, recipient=receiver.user,
                title=f'M-Pesa payment received: {receipt.number}',
                message=f'Your M-Pesa payment of KES {intent.amount:,.2f} for {len(paid_invoices)} invoice(s) was received. Receipt: {parsed.get("mpesa_receipt_number", "")}',
                level=Notification.Level.SUCCESS, action_url='/tenant-portal',
                metadata={'payment_intent_id': str(intent.id), 'invoice_id': str(invoice.id), 'receipt_id': str(receipt.id), 'provider': 'MPESA'},
            )
            event.status = PaymentWebhookEvent.Status.PROCESSED
            event.processed_at = timezone.now()
            event.save(update_fields=('status', 'processed_at', 'updated_at'))
        return Response({'status': 'processed', 'receipt': receipt.number})

    def _handle_generic_callback(self, configuration, payload, raw_body, request):
        """Process generic (non-Safaricom) payment callbacks with HMAC verification."""
        secret = os.environ.get(configuration.webhook_secret_env, '')
        if not secret:
            return Response({'detail': 'Payment callback is not configured.'}, status=503)
        signature = request.headers.get('X-Ceest-Signature', '').removeprefix('sha256=')
        expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
        if not signature or not hmac.compare_digest(signature, expected):
            return Response({'detail': 'Invalid callback signature.'}, status=401)

        event_id = str(payload.get('event_id') or payload.get('eventId') or '').strip()
        reference = str(payload.get('reference') or '').strip()
        external_reference = str(payload.get('transaction_reference') or payload.get('transactionReference') or '').strip()
        if not event_id or not reference:
            return Response({'detail': 'event_id and reference are required.'}, status=400)

        payload_hash = hashlib.sha256(raw_body).hexdigest()
        with transaction.atomic():
            event, created = PaymentWebhookEvent.objects.get_or_create(
                organization=configuration.organization, configuration=configuration, event_id=event_id,
                defaults={'payload_hash': payload_hash, 'payload': payload},
            )
            if not created:
                return Response({'status': event.status, 'duplicate': True})
            intent = PaymentIntent.objects.select_for_update().select_related('invoice', 'tenant').filter(
                organization=configuration.organization, configuration=configuration, reference=reference,
            ).first()
            try:
                callback_amount = Decimal(str(payload.get('amount')))
            except Exception:
                callback_amount = None
            paid = str(payload.get('status', '')).lower() in {'paid', 'success', 'successful', 'completed'}
            if intent is None or not paid or callback_amount != (intent.amount if intent else None):
                event.status = PaymentWebhookEvent.Status.REJECTED
                event.error_message = 'Unknown reference, unsuccessful status, or amount mismatch.'
                event.processed_at = timezone.now()
                event.save(update_fields=('status', 'error_message', 'processed_at', 'updated_at'))
                return Response({'status': event.status, 'detail': event.error_message}, status=400)
            if intent.status == PaymentIntent.Status.PAID:
                event.status = PaymentWebhookEvent.Status.PROCESSED
                event.processed_at = timezone.now()
                event.save(update_fields=('status', 'processed_at', 'updated_at'))
                return Response({'status': event.status, 'duplicate': True})
            receiver = TenantPortalAccess.objects.filter(
                organization=configuration.organization, tenant=intent.tenant, is_active=True,
            ).select_related('user').first()
            if receiver is None:
                event.status = PaymentWebhookEvent.Status.REJECTED
                event.error_message = 'No active tenant portal account can own the receipt.'
                event.processed_at = timezone.now()
                event.save(update_fields=('status', 'error_message', 'processed_at', 'updated_at'))
                return Response({'status': event.status, 'detail': event.error_message}, status=400)
            receipt = Receipt.objects.create(
                organization=configuration.organization,
                number=f'RCT-GW-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:8].upper()}',
                tenant=intent.tenant, invoice=intent.invoice, received_on=timezone.localdate(),
                amount=intent.amount, payment_method=configuration.get_provider_display(),
                external_reference=external_reference or event_id, received_by=receiver.user,
            )
            paid_invoices = _allocate_payment_receipt(intent, receipt, receiver.user)
            invoice = paid_invoices[0]
            BankTransaction.objects.create(
                organization=configuration.organization,
                reference=external_reference or event_id, transacted_on=timezone.localdate(),
                description=f'{configuration.get_provider_display()} payment {reference}',
                amount=intent.amount, status=BankTransaction.Status.MATCHED, receipt=receipt,
                matched_by=receiver.user, matched_at=timezone.now(),
            )
            intent.status = PaymentIntent.Status.PAID
            intent.external_reference = external_reference or event_id
            intent.paid_at = timezone.now()
            intent.save(update_fields=('status', 'external_reference', 'paid_at', 'updated_at'))
            from notifications.models import Notification
            Notification.objects.create(
                organization=configuration.organization, recipient=receiver.user,
                title=f'Payment received: {receipt.number}',
                message=f'Your payment of KES {intent.amount:,.2f} for {len(paid_invoices)} invoice(s) was received and reconciled.',
                level=Notification.Level.SUCCESS, action_url='/tenant-portal',
                metadata={'payment_intent_id': str(intent.id), 'invoice_id': str(invoice.id), 'receipt_id': str(receipt.id), 'provider': configuration.provider},
            )
            event.status = PaymentWebhookEvent.Status.PROCESSED
            event.processed_at = timezone.now()
            event.save(update_fields=('status', 'processed_at', 'updated_at'))
        return Response({'status': 'processed', 'receipt': receipt.number})


def _sync_property_service_providers(property_record, user=None):
    """Synchronize service providers in property metadata to Contractor, ServiceProfile and Allocation records."""
    providers_payload = property_record.metadata.get('service_providers') or []
    if not isinstance(providers_payload, list):
        return
    from facilities.models import Contractor, ServiceProfile, ServiceProfileAllocation
    import uuid
    organization = property_record.organization
    for prov in providers_payload:
        if not isinstance(prov, dict):
            continue
        prov_name = str(prov.get('name') or prov.get('provider_name') or '').strip()
        service_name = str(prov.get('service') or prov.get('service_name') or prov_name or 'Facility Service').strip()
        category = str(prov.get('category') or 'General Maintenance').strip()
        frequency = str(prov.get('frequency') or 'monthly').strip()
        criticality = str(prov.get('criticality') or 'medium').strip().lower()
        if criticality not in ('critical', 'high', 'medium', 'low'):
            criticality = 'medium'
        contact_name = str(prov.get('contact') or prov.get('contact_person') or '').strip()
        email = str(prov.get('email') or '').strip()
        phone = str(prov.get('phone') or '').strip()

        contractor = None
        if prov_name:
            contractor = Contractor.objects.filter(
                organization=organization, name__iexact=prov_name
            ).first()
            if not contractor:
                code = f'SP-{uuid.uuid4().hex[:8].upper()}'
                while Contractor.objects.filter(organization=organization, code=code).exists():
                    code = f'SP-{uuid.uuid4().hex[:8].upper()}'
                contractor = Contractor.objects.create(
                    organization=organization,
                    code=code,
                    name=prov_name,
                    specialty=category,
                    contact_name=contact_name,
                    email=email,
                    phone=phone,
                    status=Contractor.Status.ACTIVE,
                    approval_status=Contractor.ApprovalStatus.APPROVED,
                )
            contractor.assigned_properties.add(property_record)

        service_profile = ServiceProfile.objects.filter(
            organization=organization,
            name__iexact=service_name,
            properties=property_record,
        ).first()

        if not service_profile:
            service_profile = ServiceProfile.objects.filter(
                organization=organization,
                name__iexact=service_name,
            ).first()

        if not service_profile:
            prof_code = f'SRV-{uuid.uuid4().hex[:8].upper()}'
            while ServiceProfile.objects.filter(organization=organization, code=prof_code).exists():
                prof_code = f'SRV-{uuid.uuid4().hex[:8].upper()}'

            from django.contrib.auth import get_user_model
            User = get_user_model()
            creator = user if (user and getattr(user, 'is_authenticated', False)) else None
            if not creator:
                first_member = organization.memberships.select_related('user').first()
                creator = first_member.user if first_member else User.objects.filter(is_superuser=True).first()
            if not creator:
                creator = User.objects.first()

            service_profile = ServiceProfile.objects.create(
                organization=organization,
                code=prof_code,
                name=service_name,
                category=category,
                service_type=ServiceProfile.ServiceType.ROUTINE,
                status=ServiceProfile.Status.ACTIVE,
                criticality=criticality,
                coverage=ServiceProfile.Coverage.PROPERTY,
                default_frequency=frequency,
                description=f'{category} service line for {property_record.name}',
                created_by=creator,
            )
        service_profile.properties.add(property_record)
        if contractor:
            ServiceProfileAllocation.objects.get_or_create(
                organization=organization,
                service_profile=service_profile,
                property=property_record,
                provider=contractor,
                defaults={'starts_on': timezone.localdate()},
            )


class PropertyViewSet(OrganizationModelViewSet):
    write_permission = 'property.operations'
    queryset = Property.objects.annotate(buildings_count=Count('buildings'), units_count=Count('units'))
    serializer_class = PropertySerializer
    search_fields = ('name', 'code', 'city')

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        data = request.data
        if isinstance(data.get('property'), dict):
            prop_data = dict(data.get('property'))
            metadata = prop_data.get('metadata')
            if isinstance(metadata, dict):
                current_meta = dict(instance.metadata or {})
                current_meta.update(metadata)
                prop_data['metadata'] = current_meta
            data = prop_data

        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        _sync_property_service_providers(instance, request.user)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    @action(detail=False, methods=('post',))
    @transaction.atomic
    def onboard(self, request):
        """Create a property and its initial buildings/units as one transaction."""
        organization = get_active_organization(request)
        property_payload = request.data.get('property')
        if not isinstance(property_payload, dict):
            raise ValidationError({'property': 'Property details are required.'})

        serializer = self.get_serializer(data=property_payload)
        serializer.is_valid(raise_exception=True)
        existing_codes = Property.objects.filter(
            organization=organization, code__startswith='PROP-'
        ).values_list('code', flat=True)
        numbers = [int(code.rsplit('-', 1)[-1]) for code in existing_codes if code.rsplit('-', 1)[-1].isdigit()]
        property_record = serializer.save(
            organization=organization,
            code=f"PROP-{(max(numbers) + 1) if numbers else 1:04d}",
        )

        building_payload = request.data.get('building') or {}
        if not isinstance(building_payload, dict):
            raise ValidationError({'building': 'Building details must be an object.'})

        buildings = []
        buildings_list = building_payload.get('buildings')

        if isinstance(buildings_list, list) and buildings_list:
            # New format: array of individual buildings with per-building details
            if len(buildings_list) > 100:
                raise ValidationError({'building': 'Maximum 100 buildings allowed.'})
            for index, bld in enumerate(buildings_list, 1):
                if not isinstance(bld, dict):
                    raise ValidationError({'building': f'Building {index} must be an object.'})
                name = str(bld.get('name', '')).strip() or f'Building {index}'
                try:
                    bld_floors = int(bld.get('floors') or 1)
                except (TypeError, ValueError):
                    raise ValidationError({'building': f'Building "{name}" floors must be a whole number.'})
                if not 1 <= bld_floors <= 250:
                    raise ValidationError({'building': f'Building "{name}" floors must be between 1 and 250.'})
                bld_metadata = {k: v for k, v in bld.items() if k not in ('name', 'floors')}
                buildings.append(Building.objects.create(
                    organization=organization,
                    property=property_record,
                    code=f'BLD-{index:03d}',
                    name=name,
                    floors=bld_floors,
                    metadata=bld_metadata,
                ))
        else:
            # Legacy format: count + shared floors (backward compatible)
            try:
                building_count = int(building_payload.get('count') or 0)
                floors = int(building_payload.get('floors') or 1)
            except (TypeError, ValueError):
                raise ValidationError({'building': 'Building and floor counts must be whole numbers.'})
            if not 0 <= building_count <= 100:
                raise ValidationError({'building': 'Create between 0 and 100 buildings.'})
            if not 1 <= floors <= 250:
                raise ValidationError({'building': 'Floors must be between 1 and 250.'})
            building_metadata = {key: value for key, value in building_payload.items() if key not in {'count', 'floors', 'buildings'}}
            for index in range(1, building_count + 1):
                buildings.append(Building.objects.create(
                    organization=organization,
                    property=property_record,
                    code=f'BLD-{index:03d}',
                    name=f'Building {index}',
                    floors=floors,
                    metadata=building_metadata,
                ))

        parking_payload = request.data.get('parking_spaces') or []
        if not isinstance(parking_payload, list) or len(parking_payload) > 2000:
            raise ValidationError({'parking_spaces': 'Parking spaces must be a list containing at most 2,000 records.'})
        seen_parking_codes = set()
        for index, raw_space in enumerate(parking_payload, 1):
            if not isinstance(raw_space, dict):
                raise ValidationError({'parking_spaces': f'Parking space {index} must be an object.'})
            code = str(raw_space.get('code') or '').strip().upper()
            if not code or code in seen_parking_codes:
                raise ValidationError({'parking_spaces': f'Parking space {index} needs a unique code.'})
            seen_parking_codes.add(code)
            building = None
            building_index = raw_space.get('building_index')
            if building_index not in (None, ''):
                try:
                    building = buildings[int(building_index) - 1]
                except (TypeError, ValueError, IndexError):
                    raise ValidationError({'parking_spaces': f'Parking space {code} references an invalid building.'})
            ParkingSpace.objects.create(
                organization=organization,
                property=property_record,
                building=building,
                code=code,
                floor_or_zone=str(raw_space.get('floor_or_zone') or '').strip(),
                space_type=raw_space.get('space_type') or ParkingSpace.SpaceType.STANDARD,
                status=raw_space.get('status') or ParkingSpace.Status.AVAILABLE,
                metadata={'unit_code': raw_space.get('unit_code', ''), 'notes': raw_space.get('notes', '')},
            )

        units_payload = request.data.get('units') or []
        if not isinstance(units_payload, list) or len(units_payload) > 500:
            raise ValidationError({'units': 'Units must be a list containing at most 500 records.'})
        units = []
        seen_codes = set()
        for index, raw_unit in enumerate(units_payload, start=1):
            if not isinstance(raw_unit, dict):
                raise ValidationError({'units': f'Unit {index} must be an object.'})
            code = str(raw_unit.get('unit_no') or '').strip().upper()
            if not code:
                raise ValidationError({'units': f'Unit {index} requires a unit number.'})
            if code in seen_codes:
                raise ValidationError({'units': f'Unit number {code} is duplicated.'})
            seen_codes.add(code)
            building_index = raw_unit.get('building_index')
            building = None
            if building_index not in (None, ''):
                try:
                    idx = int(building_index) - 1
                    if idx < 0 or idx >= len(buildings):
                        available = ', '.join(f'{i+1}: {b.name}' for i, b in enumerate(buildings)) or 'none'
                        raise ValidationError({'units': f'Unit {code} references building #{building_index}, but only {len(buildings)} building(s) exist ({available}). Use a building number between 1 and {len(buildings)}, or leave blank.'})
                    building = buildings[idx]
                except (TypeError, ValueError):
                    raise ValidationError({'units': f'Unit {code} has an invalid building number "{building_index}". Use a whole number (1, 2, 3…) or leave blank.'})
            unit = Unit.objects.create(
                organization=organization,
                property=property_record,
                building=building,
                code=code,
                floor=str(raw_unit.get('floor') or '').strip(),
                unit_type=str(raw_unit.get('unit_type') or '').strip(),
                area=raw_unit.get('area') or None,
                status=Unit.Status.AVAILABLE,
                metadata={
                    'use': str(raw_unit.get('use') or '').strip(),
                    'rateable_area': raw_unit.get('rateable_area') or None,
                    'description': str(raw_unit.get('description') or '').strip(),
                    'billing_setup': {
                        'service_charge_rate': str(raw_unit.get('service_charge_rate') or '0'),
                    },
                },
            )
            units.append(unit)
            try:
                service_rate = Decimal(str(raw_unit.get('service_charge_rate') or 0))
            except Exception:
                raise ValidationError({'units': f'Unit {code} has an invalid service charge rate.'})
            if service_rate < 0:
                raise ValidationError({'units': f'Unit {code} service charge rate cannot be negative.'})
            if service_rate:
                service_item, _ = BillingItem.objects.get_or_create(
                    organization=organization, code='SERVICE_CHARGE',
                    defaults={'name': 'Service charge', 'calculation': BillingItem.Calculation.AREA_RATE, 'income_category': 'service_charge'},
                )
                UnitChargeRule.objects.create(
                    organization=organization, unit=unit, billing_item=service_item,
                    frequency=UnitChargeRule.Frequency.MONTHLY, calculation=BillingItem.Calculation.AREA_RATE,
                    rate=service_rate, billing_day=1,
                )

        # Utility accounts remain part of the property profile, while metered
        # water/electricity/gas supplies are also registered in Facility
        # Management so opening readings are operational rather than decorative.
        utilities_payload = property_record.metadata.get('utilities', [])
        if not isinstance(utilities_payload, list) or len(utilities_payload) > 100:
            raise ValidationError({'utilities': 'Utilities must be a list containing at most 100 records.'})
        from facilities.models import MeterReading, UtilityMeter
        meters = []
        for index, utility in enumerate(utilities_payload, start=1):
            if not isinstance(utility, dict):
                raise ValidationError({'utilities': f'Utility {index} must be an object.'})
            utility_type = str(utility.get('type', '')).lower()
            meter_code = str(utility.get('meter_code', '')).strip().upper()
            if not meter_code or utility_type not in {choice for choice, _ in UtilityMeter.Utility.choices}:
                continue
            if UtilityMeter.objects.filter(organization=organization, code=meter_code).exists():
                raise ValidationError({'utilities': f'Meter number {meter_code} already exists.'})
            try:
                tariff = Decimal(str(utility.get('tariff') or 0))
                opening_value = Decimal(str(utility.get('initial_reading') or 0))
            except Exception:
                raise ValidationError({'utilities': f'Utility {index} has an invalid tariff or opening reading.'})
            if tariff < 0 or opening_value < 0:
                raise ValidationError({'utilities': f'Utility {index} tariff and opening reading cannot be negative.'})
            assigned_unit = next((row for row in units if row.code == str(utility.get('unit_code') or '').strip().upper()), None)
            is_postpaid = utility_type != 'electricity' or utility.get('supply_mode', 'postpaid') == 'postpaid'
            meter = UtilityMeter.objects.create(
                organization=organization, property=property_record, property_unit=assigned_unit, code=meter_code,
                name=f"{property_record.name} {utility_type.title()} {meter_code}", utility_type=utility_type,
                unit=str(utility.get('unit') or ('kWh' if utility_type == 'electricity' else 'm³'))[:20],
                tariff=tariff, is_active=str(utility.get('status', 'active')).lower() == 'active',
            )
            meters.append(meter)
            if assigned_unit and tariff > 0 and is_postpaid:
                item_code = utility_type.upper()
                billing_item, _ = BillingItem.objects.get_or_create(
                    organization=organization, code=item_code,
                    defaults={'name': f'{utility_type.title()} consumption', 'calculation': BillingItem.Calculation.METERED, 'income_category': 'utilities'},
                )
                UnitChargeRule.objects.update_or_create(
                    organization=organization, unit=assigned_unit, billing_item=billing_item,
                    defaults={'frequency': UnitChargeRule.Frequency.METERED, 'calculation': BillingItem.Calculation.METERED, 'rate': tariff, 'billing_day': 1, 'is_active': True},
                )
            has_opening_reading = str(utility.get('initial_reading', '')).strip() != ''
            if has_opening_reading and is_postpaid:
                try:
                    reading_date = date.fromisoformat(str(utility.get('reading_date'))) if utility.get('reading_date') else timezone.localdate()
                except ValueError:
                    raise ValidationError({'utilities': f'Utility {index} has an invalid reading date.'})
                MeterReading.objects.create(
                    organization=organization, meter=meter,
                    read_at=timezone.make_aware(datetime.combine(reading_date, time(hour=12))),
                    value=opening_value, previous_value=opening_value, consumption=Decimal('0'), cost=Decimal('0'),
                    status=MeterReading.Status.APPROVED, reviewed_by=request.user, reviewed_at=timezone.now(),
                    review_notes='Opening reading captured during property onboarding.',
                )

        # Service profiles and service lines submitted during onboarding are registered as ServiceProfiles & Contractors in Facility Management
        _sync_property_service_providers(property_record, request.user)

        return Response({
            'property': self.get_serializer(property_record).data,
            'buildings': BuildingSerializer(buildings, many=True).data,
            'units': UnitSerializer(units, many=True).data,
            'utility_meters_created': len(meters),
        }, status=201)

    @action(detail=False, methods=('post',), url_path='onboard-sectional-title')
    @transaction.atomic
    def onboard_sectional_title(self, request):
        """Complete 12-step Sectional Title property onboarding in a single atomic transaction."""
        organization = get_active_organization(request)
        data = request.data

        # 1. Create Property
        prop_data = data.get('property') or {}
        if not isinstance(prop_data, dict) or not prop_data.get('name'):
            raise ValidationError({'property': 'Property name is required.'})

        existing_codes = Property.objects.filter(
            organization=organization, code__startswith='PROP-'
        ).values_list('code', flat=True)
        numbers = [int(code.rsplit('-', 1)[-1]) for code in existing_codes if code.rsplit('-', 1)[-1].isdigit()]
        prop_code = f"PROP-{(max(numbers) + 1) if numbers else 1:04d}"

        commence_date = _parse_flexible_date(prop_data.get('management_commencement_date') or prop_data.get('commencement_date'))

        property_record = Property.objects.create(
            organization=organization,
            code=prop_code,
            name=str(prop_data.get('name')).strip(),
            property_type='sectional_title',
            is_sectional_title=True,
            scheme_registration_number=str(prop_data.get('scheme_registration_number') or prop_data.get('scheme_number') or '').strip(),
            total_blocks=int(prop_data.get('total_blocks') or 1),
            total_units_count=int(prop_data.get('total_units_count') or prop_data.get('total_units') or 1),
            estate_manager_name=str(prop_data.get('estate_manager_name') or prop_data.get('estate_manager') or '').strip(),
            management_commencement_date=commence_date,
            address=str(prop_data.get('address') or '').strip(),
            city=str(prop_data.get('city') or 'Nairobi').strip(),
            status=Property.Status.ACTIVE if data.get('activate_immediately') else Property.Status.DRAFT,
            metadata=prop_data.get('metadata') or {},
        )

        # 2. Create Buildings / Blocks
        buildings_map = {}
        blocks_data = data.get('blocks') or data.get('buildings') or []
        if isinstance(blocks_data, list):
            for i, b_item in enumerate(blocks_data, 1):
                b_name = b_item if isinstance(b_item, str) else (b_item.get('name') or f'Block {i}')
                b_code = f"BLK-{i:02d}"
                b_floors = int(b_item.get('floors', 1)) if isinstance(b_item, dict) else 1
                b_obj = Building.objects.create(
                    organization=organization,
                    property=property_record,
                    code=b_code,
                    name=b_name,
                    floors=b_floors,
                )
                buildings_map[b_name.upper()] = b_obj
                buildings_map[b_code.upper()] = b_obj

        # 3. Create Owners / Landlords map
        owners_map = {}
        owners_data = data.get('owners') or []
        if isinstance(owners_data, list):
            for i, o_item in enumerate(owners_data, 1):
                if isinstance(o_item, dict) and o_item.get('name'):
                    o_name = str(o_item['name']).strip()
                    existing_o_codes = Owner.objects.filter(
                        organization=organization, code__startswith='OWN-'
                    ).values_list('code', flat=True)
                    o_nums = [int(c.rsplit('-', 1)[-1]) for c in existing_o_codes if c.rsplit('-', 1)[-1].isdigit()]
                    o_code = f"OWN-{(max(o_nums) + 1) if o_nums else 1:04d}"
                    o_obj = Owner.objects.create(
                        organization=organization,
                        code=o_code,
                        name=o_name,
                        email=str(o_item.get('email') or '').strip(),
                        phone=str(o_item.get('phone') or '').strip(),
                        id_or_registration_number=str(o_item.get('id_or_registration_number') or o_item.get('id_number') or '').strip(),
                        pin_number=str(o_item.get('pin_number') or o_item.get('pin') or '').strip(),
                        settlement_bank_name=str(o_item.get('settlement_bank_name') or o_item.get('bank_name') or '').strip(),
                        settlement_bank_account=str(o_item.get('settlement_bank_account') or o_item.get('bank_account') or '').strip(),
                        settlement_bank_branch=str(o_item.get('settlement_bank_branch') or o_item.get('branch') or '').strip(),
                        settlement_paybill_or_till=str(o_item.get('settlement_paybill_or_till') or o_item.get('paybill') or '').strip(),
                        notes=str(o_item.get('notes') or '').strip(),
                    )
                    owners_map[o_name.upper()] = o_obj
                    if o_item.get('id'):
                        owners_map[str(o_item['id'])] = o_obj

        # 4. Create Units
        units_data = data.get('units') or []
        created_units = []
        if isinstance(units_data, list):
            for index, u_item in enumerate(units_data, 1):
                if not isinstance(u_item, dict):
                    continue
                u_code = str(u_item.get('code') or f"U-{index:03d}").strip()
                b_name_key = str(u_item.get('building_name') or u_item.get('block') or '').strip().upper()
                b_instance = buildings_map.get(b_name_key) or (list(buildings_map.values())[0] if buildings_map else None)

                # Link owner
                o_key = str(u_item.get('owner_name') or u_item.get('owner_id') or '').strip().upper()
                o_instance = owners_map.get(o_key) or (Owner.objects.filter(organization=organization, id=u_item.get('owner_id')).first() if u_item.get('owner_id') else None)

                mandate = u_item.get('management_mandate') or Unit.ManagementMandate.BOTH
                sc_payer = u_item.get('service_charge_payer') or Unit.PayerChoice.OWNER
                water_payer = u_item.get('water_payer') or Unit.PayerChoice.TENANT
                
                commission_rate = Decimal(str(u_item.get('rental_commission_rate') or '10.00'))
                common_area_fee = Decimal(str(u_item.get('common_area_fee_amount') or '0.00'))
                letting_fee = Decimal(str(u_item.get('letting_fee_amount') or '0.00'))
                area_val = Decimal(str(u_item['area'])) if u_item.get('area') else None
                ownership_share = Decimal(str(u_item.get('ownership_share') or '1.0000'))

                unit_obj = Unit.objects.create(
                    organization=organization,
                    property=property_record,
                    building=b_instance,
                    owner=o_instance,
                    code=u_code,
                    floor=str(u_item.get('floor') or '').strip(),
                    unit_type=str(u_item.get('unit_type') or 'apartment').strip(),
                    status=Unit.Status.AVAILABLE,
                    area=area_val,
                    sectional_title_number=str(u_item.get('sectional_title_number') or u_item.get('title_deed_number') or '').strip(),
                    ownership_share=ownership_share,
                    management_mandate=mandate,
                    service_charge_payer=sc_payer,
                    water_payer=water_payer,
                    rental_commission_rate=commission_rate,
                    common_area_fee_amount=common_area_fee,
                    letting_fee_amount=letting_fee,
                )
                created_units.append(unit_obj)

        # 5. Create Fee Profiles
        fee_profiles_data = data.get('fee_profiles') or []
        if isinstance(fee_profiles_data, list):
            for fp in fee_profiles_data:
                if isinstance(fp, dict) and fp.get('fee_type'):
                    ft = str(fp['fee_type']).strip().lower()
                    if ft == 'common_area':
                        ft = PropertyFeeProfile.FeeType.COMMON_AREA_FEE
                    PropertyFeeProfile.objects.create(
                        organization=organization,
                        property=property_record,
                        fee_type=ft,
                        calculation_basis=fp.get('calculation_basis', PropertyFeeProfile.Basis.FIXED),
                        amount=Decimal(str(fp.get('amount') or '0.00')),
                        percentage_rate=Decimal(str(fp.get('percentage_rate') or '0.00')),
                        billing_frequency=fp.get('billing_frequency', 'monthly'),
                        billed_to=fp.get('billed_to', PropertyFeeProfile.BilledTo.UNIT_OWNER),
                        vat_applicable=bool(fp.get('vat_applicable', True)),
                        vat_rate=Decimal(str(fp.get('vat_rate') or '16.00')),
                        effective_from=_parse_flexible_date(fp.get('effective_from')) or timezone.localdate(),
                    )

        # 6. Create Collection Accounts
        accounts_data = data.get('collection_accounts') or []
        if isinstance(accounts_data, list):
            for ca in accounts_data:
                if isinstance(ca, dict) and ca.get('charge_type'):
                    PropertyCollectionAccount.objects.create(
                        organization=organization,
                        property=property_record,
                        charge_type=ca['charge_type'],
                        bank_name=str(ca.get('bank_name') or '').strip(),
                        account_name=str(ca.get('account_name') or '').strip(),
                        account_number=str(ca.get('account_number') or '').strip(),
                        branch=str(ca.get('branch') or '').strip(),
                        mpesa_paybill=str(ca.get('mpesa_paybill') or '').strip(),
                        mpesa_reference_format=str(ca.get('mpesa_reference_format') or '{CHARGE}-{UNIT}-{MONTH}-{YEAR}').strip(),
                    )

        return Response(PropertySerializer(property_record).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=('get',), url_path='readiness-check')
    def readiness_check(self, request, pk=None):
        property_obj = self.get_object()
        checks = []
        issues = []

        # 1. Scheme Registration Check
        if property_obj.is_sectional_title:
            if property_obj.scheme_registration_number:
                checks.append({'title': 'Sectional Scheme Registration', 'passed': True, 'detail': property_obj.scheme_registration_number})
            else:
                checks.append({'title': 'Sectional Scheme Registration', 'passed': False, 'detail': 'Missing sectional scheme registration number.'})
                issues.append('Missing sectional scheme registration number.')

        # 2. Units Check
        units = property_obj.units.all()
        if units.exists():
            checks.append({'title': 'Units Registered', 'passed': True, 'detail': f'{units.count()} units registered.'})
        else:
            checks.append({'title': 'Units Registered', 'passed': False, 'detail': 'No units created under this property.'})
            issues.append('No units registered.')

        # 3. Unit Owners Check (for sectional properties)
        if property_obj.is_sectional_title:
            unassigned_units = units.filter(owner__isnull=True)
            if not unassigned_units.exists():
                checks.append({'title': 'Unit Landlords / Owners Assigned', 'passed': True, 'detail': f'All {units.count()} units have assigned owners.'})
            else:
                detail = f'{unassigned_units.count()} unit(s) do not have an owner assigned.'
                checks.append({'title': 'Unit Landlords / Owners Assigned', 'passed': False, 'detail': detail})
                issues.append(detail)

        # 4. Collection Accounts Check
        accounts = property_obj.collection_accounts.filter(is_active=True)
        req_types = {'rent', 'service_charge'} if property_obj.is_sectional_title else {'rent'}
        existing_types = set(accounts.values_list('charge_type', flat=True))
        missing_accts = req_types - existing_types
        if not missing_accts:
            checks.append({'title': 'Collection Bank Accounts', 'passed': True, 'detail': f'{accounts.count()} active collection route(s).'})
        else:
            detail = f'Missing collection accounts for: {", ".join(missing_accts)}.'
            checks.append({'title': 'Collection Bank Accounts', 'passed': False, 'detail': detail})
            issues.append(detail)

        # 5. Settlement Details Check for Managed Units
        if property_obj.is_sectional_title:
            managed_units = units.filter(management_mandate__in=[Unit.ManagementMandate.RENTAL_MANAGEMENT, Unit.ManagementMandate.BOTH], owner__isnull=False)
            missing_settlements = [u.code for u in managed_units if not u.owner.settlement_bank_account and not u.owner.settlement_paybill_or_till]
            if not missing_settlements:
                checks.append({'title': 'Owner Settlement Bank Accounts', 'passed': True, 'detail': 'All rental-managed unit owners have settlement bank details.'})
            else:
                detail = f'Units under rental management missing owner settlement details: {", ".join(missing_settlements[:5])}.'
                checks.append({'title': 'Owner Settlement Bank Accounts', 'passed': False, 'detail': detail})
                issues.append(detail)

        is_ready = len(issues) == 0
        return Response({
            'property_id': str(property_obj.id),
            'property_name': property_obj.name,
            'is_ready': is_ready,
            'total_checks': len(checks),
            'passed_checks': sum(1 for c in checks if c['passed']),
            'checks': checks,
            'issues': issues,
        })

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


class ParkingSpaceViewSet(OrganizationModelViewSet):
    write_permission = 'property.operations'
    queryset = ParkingSpace.objects.select_related('property', 'building', 'unit')
    serializer_class = ParkingSpaceSerializer
    search_fields = ('code', 'floor_or_zone', 'property__name', 'building__name', 'unit__code')

    def get_queryset(self):
        queryset = super().get_queryset()
        status_value = self.request.query_params.get('status')
        property_id = self.request.query_params.get('property')
        if status_value:
            queryset = queryset.filter(status=status_value)
        if property_id:
            queryset = queryset.filter(property_id=property_id)
        return queryset


class ParkingAssignmentViewSet(OrganizationModelViewSet):
    write_permission = 'property.operations'
    queryset = ParkingAssignment.objects.select_related('parking_space__property', 'lease__tenant', 'lease__unit')
    serializer_class = ParkingAssignmentSerializer
    search_fields = ('parking_space__code', 'lease__tenant__name', 'lease__unit__code')


class OwnerViewSet(OrganizationModelViewSet):
    write_permission = 'property.operations'
    queryset = Owner.objects.all().prefetch_related('units')
    serializer_class = OwnerSerializer
    search_fields = ('name', 'code', 'email', 'phone', 'pin_number', 'id_or_registration_number')

    def perform_create(self, serializer):
        organization = get_active_organization(self.request)
        existing_codes = Owner.objects.filter(
            organization=organization, code__startswith='OWN-'
        ).values_list('code', flat=True)
        numbers = [int(code.rsplit('-', 1)[-1]) for code in existing_codes if code.rsplit('-', 1)[-1].isdigit()]
        code = f"OWN-{(max(numbers) + 1) if numbers else 1:04d}"
        serializer.save(organization=organization, code=code)

    @action(detail=True, methods=('get',), url_path='financial-summary')
    def financial_summary(self, request, pk=None):
        owner = self.get_object()
        units = owner.units.all()
        owner_invoices = Invoice.objects.filter(owner=owner)
        total_invoiced = owner_invoices.aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
        total_balance = owner_invoices.aggregate(s=Sum('balance'))['s'] or Decimal('0.00')
        total_paid = total_invoiced - total_balance

        leases = Lease.objects.filter(unit__in=units, status=Lease.Status.ACTIVE)
        active_rent_roll = sum(l.monthly_rent for l in leases)

        return Response({
            'owner_id': str(owner.id),
            'owner_name': owner.name,
            'owner_code': owner.code,
            'units_count': units.count(),
            'total_invoiced': total_invoiced,
            'total_paid': total_paid,
            'outstanding_balance': total_balance,
            'active_rent_roll': active_rent_roll,
            'settlement_details': {
                'bank_name': owner.settlement_bank_name,
                'account_number': owner.settlement_bank_account,
                'branch': owner.settlement_bank_branch,
                'paybill': owner.settlement_paybill_or_till,
            }
        })


class PropertyCollectionAccountViewSet(OrganizationModelViewSet):
    write_permission = 'property.operations'
    queryset = PropertyCollectionAccount.objects.all().select_related('property')
    serializer_class = PropertyCollectionAccountSerializer
    search_fields = ('bank_name', 'account_name', 'account_number', 'mpesa_paybill')

    def get_queryset(self):
        qs = super().get_queryset()
        prop_id = self.request.query_params.get('property')
        return qs.filter(property_id=prop_id) if prop_id else qs


class PropertyFeeProfileViewSet(OrganizationModelViewSet):
    write_permission = 'property.operations'
    queryset = PropertyFeeProfile.objects.all().select_related('property')
    serializer_class = PropertyFeeProfileSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        prop_id = self.request.query_params.get('property')
        return qs.filter(property_id=prop_id) if prop_id else qs


class UnitViewSet(OrganizationModelViewSet):
    write_permission = 'property.operations'
    queryset = Unit.objects.select_related('property', 'building', 'owner')
    serializer_class = UnitSerializer
    search_fields = ('code', 'unit_type', 'property__name', 'owner__name')

    def get_queryset(self):
        qs = super().get_queryset()
        owner_id = self.request.query_params.get('owner')
        if owner_id:
            qs = qs.filter(owner_id=owner_id)
        prop_id = self.request.query_params.get('property')
        if prop_id:
            qs = qs.filter(property_id=prop_id)
        return qs


class UnitChargeRuleViewSet(OrganizationModelViewSet):
    write_permission = 'property.operations'
    queryset = UnitChargeRule.objects.select_related('unit__property', 'billing_item')
    serializer_class = UnitChargeRuleSerializer
    search_fields = ('unit__code', 'billing_item__name', 'billing_item__code')

    def get_queryset(self):
        queryset = super().get_queryset()
        unit_id = self.request.query_params.get('unit')
        return queryset.filter(unit_id=unit_id) if unit_id else queryset

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer))


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

    def get_queryset(self):
        return super().get_queryset().prefetch_related('leases__unit')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        existing = Tenant.objects.filter(organization=organization, code__startswith='TNT-').values_list('code', flat=True)
        numbers = [int(code.rsplit('-', 1)[-1]) for code in existing if code.rsplit('-', 1)[-1].isdigit()]
        serializer.save(
            organization=organization,
            code=f"TNT-{(max(numbers) + 1) if numbers else 1:04d}",
            property=serializer.validated_data.get('property') or get_active_property(self.request, organization),
        )

    @action(detail=False, methods=('get',), url_path='deposit-arrears-exposure')
    def deposit_arrears_exposure(self, request):
        """Compare refundable deposit cover with live arrears for current leases."""
        organization = get_active_organization(request)
        active_property = get_active_property(request, organization)
        leases = Lease.objects.for_organization(organization).filter(
            status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING),
        ).select_related('tenant', 'unit__property')
        if active_property:
            leases = leases.filter(unit__property=active_property)

        rows = []
        for lease in leases:
            invoices = list(Invoice.objects.for_organization(organization).filter(
                lease=lease,
            ).exclude(status__in=(Invoice.Status.DRAFT, Invoice.Status.VOID)).order_by('due_on'))
            deposit_invoices = [
                invoice for invoice in invoices
                if 'deposit' in invoice.invoice_type.lower()
                or invoice.lines.filter(billing_item__code__icontains='deposit').exists()
            ]
            deposit_ids = {invoice.id for invoice in deposit_invoices}
            outstanding_invoices = [
                invoice for invoice in invoices if invoice.balance > 0 and invoice.id not in deposit_ids
            ]
            arrears = sum((invoice.balance for invoice in outstanding_invoices), Decimal('0.00'))
            deposit_billed = sum((invoice.amount for invoice in deposit_invoices), Decimal('0.00'))
            deposit_paid = sum((invoice.amount - invoice.balance for invoice in deposit_invoices), Decimal('0.00'))
            oldest = outstanding_invoices[0] if outstanding_invoices else None
            oldest_days = max((timezone.localdate() - oldest.due_on).days, 0) if oldest else 0
            rows.append({
                'tenant_id': str(lease.tenant_id), 'tenant': lease.tenant.name,
                'lease_id': str(lease.id), 'lease_reference': lease.reference,
                'unit': lease.unit.code, 'property': lease.unit.property.name,
                'deposit_required': lease.deposit, 'deposit_billed': deposit_billed,
                'deposit_paid': deposit_paid, 'arrears': arrears,
                'net_exposure': max(arrears - deposit_paid, Decimal('0.00')),
                'oldest_days': oldest_days,
                'oldest_invoice_id': str(oldest.id) if oldest else None,
                'oldest_invoice_number': oldest.number if oldest else None,
                'recommended_action': (
                    'notice_to_vacate' if oldest_days >= 90 else
                    'formal_demand' if oldest_days >= 60 else
                    'payment_reminder' if arrears > 0 else 'none'
                ),
            })
        return Response({'results': rows})

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        tenant = self.get_object()
        organization = get_active_organization(request)
        
        # Check for financial records or active leases that must be protected
        has_invoices = Invoice.objects.filter(organization=organization, lease__tenant=tenant).exists()
        has_receipts = Receipt.objects.filter(organization=organization, tenant=tenant).exists()
        has_payments = PaymentIntent.objects.filter(organization=organization, tenant=tenant, status=PaymentIntent.Status.PAID).exists()
        active_leases = Lease.objects.filter(organization=organization, tenant=tenant).exclude(status=Lease.Status.DRAFT)
        
        if has_invoices or has_receipts or has_payments or active_leases.exists():
            return Response({
                'detail': f"Cannot delete tenant '{tenant.name}' ({tenant.code}) because active leases or financial transactions (invoices/receipts) exist. Mark status as 'Former' or 'Suspended' instead."
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Clean up draft leases and release any bays reserved by an abandoned application.
        draft_leases = Lease.objects.filter(organization=organization, tenant=tenant, status=Lease.Status.DRAFT)
        reserved_spaces = ParkingSpace.objects.filter(
            assignments__lease__in=draft_leases,
            assignments__status=ParkingAssignment.Status.RESERVED,
        ).distinct()
        reserved_spaces.update(status=ParkingSpace.Status.AVAILABLE, unit=None, updated_at=timezone.now())
        draft_leases.delete()
        TenantMovement.objects.filter(organization=organization, tenant=tenant).delete()
        TenantDocument.objects.filter(organization=organization, tenant=tenant).delete()
        TenantPortalAccess.objects.filter(organization=organization, tenant=tenant).delete()
        
        tenant_name = tenant.name
        tenant_code = tenant.code
        tenant.delete()
        
        return Response({
            'status': 'deleted',
            'detail': f"Tenant '{tenant_name}' ({tenant_code}) was deleted successfully."
        }, status=status.HTTP_200_OK)

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def activate(self, request, pk=None):
        tenant = self.get_object()
        organization = get_active_organization(request)
        tenant.status = Tenant.Status.ACTIVE
        tenant.save(update_fields=('status', 'updated_at'))

        draft_leases = Lease.objects.select_for_update().filter(
            organization=organization, tenant=tenant, status=Lease.Status.DRAFT
        ).select_related('unit')

        activated_leases = []
        for lease in draft_leases:
            if lease.unit.status not in (Unit.Status.SOLD, Unit.Status.UNAVAILABLE):
                conflict = Lease.objects.for_organization(organization).filter(
                    unit=lease.unit, status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING)
                ).exclude(pk=lease.pk).exists()
                if not conflict:
                    lease.status = Lease.Status.ACTIVE
                    lease.save(update_fields=('status', 'updated_at'))
                    generate_rent_schedule(lease)
                    lease.unit.status = Unit.Status.OCCUPIED
                    lease.unit.save(update_fields=('status', 'updated_at'))
                    activate_lease_allocations(lease, request.user)
                    activated_leases.append(lease.reference)

        return Response({
            'status': 'active',
            'tenant': TenantSerializer(tenant).data,
            'activated_leases_count': len(activated_leases),
            'activated_leases': activated_leases,
            'detail': f"Tenant '{tenant.name}' and {len(activated_leases)} lease(s) activated successfully."
        })

    @transaction.atomic
    @action(detail=False, methods=('post',), url_path='bulk-activate')
    def bulk_activate(self, request):
        organization = get_active_organization(request)
        tenant_ids = request.data.get('tenant_ids') if isinstance(request.data.get('tenant_ids'), list) else []
        if not tenant_ids:
            raise ValidationError({'tenant_ids': 'Select at least one tenant to activate.'})

        tenants = Tenant.objects.select_for_update().filter(organization=organization, pk__in=tenant_ids)
        total_activated_tenants = 0
        total_activated_leases = 0

        for tenant in tenants:
            if tenant.status != Tenant.Status.ACTIVE:
                tenant.status = Tenant.Status.ACTIVE
                tenant.save(update_fields=('status', 'updated_at'))
                total_activated_tenants += 1

            draft_leases = Lease.objects.select_for_update().filter(
                organization=organization, tenant=tenant, status=Lease.Status.DRAFT
            ).select_related('unit')

            for lease in draft_leases:
                if lease.unit.status not in (Unit.Status.SOLD, Unit.Status.UNAVAILABLE):
                    conflict = Lease.objects.for_organization(organization).filter(
                        unit=lease.unit, status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING)
                    ).exclude(pk=lease.pk).exists()
                    if not conflict:
                        lease.status = Lease.Status.ACTIVE
                        lease.save(update_fields=('status', 'updated_at'))
                        generate_rent_schedule(lease)
                        lease.unit.status = Unit.Status.OCCUPIED
                        lease.unit.save(update_fields=('status', 'updated_at'))
                        activate_lease_allocations(lease, request.user)
                        total_activated_leases += 1

        return Response({
            'activated_tenants_count': total_activated_tenants,
            'activated_leases_count': total_activated_leases,
            'detail': f"Activated {total_activated_tenants} tenant(s) and {total_activated_leases} lease(s) successfully."
        })

    @transaction.atomic
    @action(detail=False, methods=('post',), url_path='onboard')
    def onboard(self, request):
        """Create a tenant application and its initial draft lease atomically."""
        organization = get_active_organization(request)
        tenant_data = request.data.get('tenant') or {}
        lease_data = request.data.get('lease') or {}
        if not str(tenant_data.get('name', '')).strip():
            raise ValidationError({'tenant.name': 'Tenant name is required.'})

        try:
            unit = Unit.objects.select_for_update().for_organization(organization).select_related('property').get(
                pk=lease_data.get('unit')
            )
        except (Unit.DoesNotExist, ValueError, TypeError):
            raise ValidationError({'lease.unit': 'Select a valid unit.'})
        active_property = get_active_property(request, organization)
        if active_property and unit.property_id != active_property.id:
            raise ValidationError({'lease.unit': 'The unit must belong to the active property.'})
        if Lease.objects.for_organization(organization).filter(
            unit=unit, status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING)
        ).exists():
            raise ValidationError({'lease.unit': 'This unit already has a current lease.'})

        try:
            starts_on = date.fromisoformat(str(lease_data.get('starts_on', '')))
            term_months = int(lease_data.get('term_months', 0))
            if term_months < 1 or term_months > 240:
                raise ValueError
            end_month = starts_on.month - 1 + term_months
            end_year = starts_on.year + end_month // 12
            end_month = end_month % 12 + 1
            ends_on = starts_on.replace(year=end_year, month=end_month, day=min(starts_on.day, calendar.monthrange(end_year, end_month)[1]))
        except (ValueError, TypeError):
            raise ValidationError({'lease': 'A valid commencement date and lease term are required.'})

        def amount(name, default='0'):
            try:
                value = Decimal(str(lease_data.get(name, default))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            except Exception:
                raise ValidationError({f'lease.{name}': 'Enter a valid amount.'})
            if value < 0:
                raise ValidationError({f'lease.{name}': 'Amount cannot be negative.'})
            return value

        area = Decimal(str(unit.area)).quantize(Decimal('0.01')) if unit.area is not None else amount('area')
        rent_rate = amount('rent_rate_per_sqft', '0')
        direct_rent = amount('monthly_rent', '0') or amount('fixed_monthly_rent', '0')
        rent_type = str(lease_data.get('rent_type', 'rate_per_sqft' if rent_rate > 0 else 'fixed')).lower()
        service_rate = amount('service_charge_rate_per_sqft', '0')
        security_deposit = _unit_deposit_amount(unit)
        escalation_percent = amount('escalation_percent', '0')
        try:
            escalation_interval = int(lease_data.get('escalation_interval_months', 12))
        except (ValueError, TypeError):
            raise ValidationError({'lease.escalation_interval_months': 'Select a valid escalation frequency.'})
        if escalation_percent and not 1 <= escalation_interval <= 120:
            raise ValidationError({'lease.escalation_interval_months': 'Escalation frequency must be between 1 and 120 months.'})
        vat_rate = amount('vat_rate', 16)
        if vat_rate not in (Decimal('0.00'), Decimal('16.00')):
            raise ValidationError({'lease.vat_rate': 'Supported VAT rates are 0% and 16%.'})
        
        if rent_type in ('fixed', 'flat', 'fixed_monthly') or (direct_rent > 0 and rent_rate == 0):
            monthly_rent = direct_rent
            if area > 0:
                rent_rate = (monthly_rent / area).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        elif rent_rate > 0:
            monthly_rent = (area * rent_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if area > 0 else rent_rate
        else:
            monthly_rent = direct_rent

        tenant_status = str(tenant_data.get('status', 'prospect')).lower()
        if monthly_rent <= 0 and tenant_status not in ('prospect', 'pending', 'applicant') and rent_type != 'prospect':
            raise ValidationError({'lease.monthly_rent': 'Monthly rent must be greater than zero.'})
        monthly_service = (area * service_rate).quantize(Decimal('0.01'))
        utilities = []
        utility_deposit = Decimal('0.00')
        subtotal = monthly_rent + monthly_service
        vat_amount = (subtotal * vat_rate / 100).quantize(Decimal('0.01'))
        total_inc_vat = subtotal + vat_amount

        def next_reference(model, field, prefix):
            values = model.objects.filter(organization=organization, **{f'{field}__startswith': f'{prefix}-'}).values_list(field, flat=True)
            numbers = [int(value.rsplit('-', 1)[-1]) for value in values if value.rsplit('-', 1)[-1].isdigit()]
            return f'{prefix}-{(max(numbers) + 1) if numbers else 1:04d}'

        tenant_code = next_reference(Tenant, 'code', 'TNT')
        application_number = f"APP-{timezone.localdate().year}-{tenant_code.rsplit('-', 1)[-1]}"
        lease_reference = next_reference(Lease, 'reference', 'LEASE')
        application = {
            'application_number': application_number,
            'status': 'open',
            'document_date': timezone.localdate().isoformat(),
            'contact_name': tenant_data.get('contact_name', ''),
            'contact_phone': tenant_data.get('contact_phone', ''),
            'contact_email': tenant_data.get('contact_email', ''),
            'address_2': tenant_data.get('address_2', ''),
            'city': tenant_data.get('city', ''),
            'utilities': utilities,
            'charges': request.data.get('charges') if isinstance(request.data.get('charges'), list) else [],
            'created_by': request.user.get_username(),
        }
        tenant_serializer = TenantSerializer(data={
            'name': str(tenant_data['name']).strip(), 'tenant_type': tenant_data.get('tenant_type', 'company'),
            'email': tenant_data.get('email', ''), 'phone': tenant_data.get('phone', ''),
            'tax_id': tenant_data.get('tax_id', ''), 'registration_number': tenant_data.get('registration_number', ''),
            'billing_address': tenant_data.get('address_1', ''), 'status': Tenant.Status.PROSPECT,
            'metadata': {'tenant_application': application},
        })
        tenant_serializer.is_valid(raise_exception=True)
        tenant = tenant_serializer.save(organization=organization, property=unit.property, code=tenant_code)
        calculations = {
            'area': str(area), 'rent_rate_per_sqft': str(rent_rate),
            'service_charge_rate_per_sqft': str(service_rate), 'monthly_rent_excl_vat': str(monthly_rent),
            'monthly_service_charge_excl_vat': str(monthly_service), 'total_excl_vat': str(subtotal),
            'vat_rate': str(vat_rate), 'vat_amount': str(vat_amount), 'total_inc_vat': str(total_inc_vat),
            'security_deposit': str(security_deposit), 'utilities_security_deposit': str(utility_deposit),
            'total_amount_payable': str(total_inc_vat + security_deposit + utility_deposit),
        }
        lease = Lease.objects.create(
            organization=organization, reference=lease_reference, unit=unit, tenant=tenant,
            starts_on=starts_on, ends_on=ends_on, monthly_rent=monthly_rent,
            deposit=security_deposit, billing_day=int(lease_data.get('billing_day', 1)),
            escalation_percent=escalation_percent,
            escalation_interval_months=escalation_interval,
            status=Lease.Status.DRAFT,
            metadata={'application_number': application_number, 'term_months': term_months, **calculations},
        )

        _inherit_unit_charge_profiles(lease)
        # Service charge is the canonical recurring billing source. Ensure a
        # BillingProfile exists so both single and bulk invoicing read from the
        # same place — no more lease.metadata drift.
        if monthly_service > 0:
            service_item, _ = BillingItem.objects.get_or_create(
                organization=organization, code='SERVICE_CHARGE',
                defaults={'name': 'Service charge', 'calculation': BillingItem.Calculation.AREA_RATE, 'income_category': 'service_charge'},
            )
            BillingProfile.objects.get_or_create(
                organization=organization, lease=lease, billing_item=service_item,
                effective_from=lease.starts_on,
                defaults={
                    'calculation': BillingItem.Calculation.AREA_RATE,
                    'rate': service_rate, 'amount': monthly_service,
                    'frequency': BillingProfile.Frequency.MONTHLY, 'billing_day': lease.billing_day,
                    'effective_to': lease.ends_on, 'instructions': 'Recurring service charge from onboarding.',
                },
            )

        # Parking is a separately billed service, while allocation remains traceable by bay.
        parking_payload = request.data.get('parking_assignments') if isinstance(request.data.get('parking_assignments'), list) else []
        parking_total = Decimal('0.00')
        seen_spaces = set()
        for index, allocation in enumerate(parking_payload, 1):
            try:
                monthly_fee = Decimal(str(allocation.get('monthly_fee', 0))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            except Exception:
                raise ValidationError({'parking_assignments': f'Parking row {index} has an invalid monthly fee.'})
            if monthly_fee < 0:
                raise ValidationError({'parking_assignments': f'Parking row {index} fee cannot be negative.'})
            space_id = allocation.get('parking_space')
            new_code = str(allocation.get('new_code', '')).strip().upper()
            if space_id:
                try:
                    space = ParkingSpace.objects.select_for_update().for_organization(organization).get(
                        pk=space_id, property=unit.property,
                    )
                except (ParkingSpace.DoesNotExist, ValueError, TypeError):
                    raise ValidationError({'parking_assignments': f'Parking row {index} does not reference an available bay at this property.'})
            elif new_code:
                if ParkingSpace.objects.for_organization(organization).filter(property=unit.property, code__iexact=new_code).exists():
                    raise ValidationError({'parking_assignments': f'Parking bay code {new_code} already exists; select it from the available bays.'})
                space = ParkingSpace.objects.create(
                    organization=organization, property=unit.property, code=new_code,
                    floor_or_zone=str(allocation.get('floor_or_zone', '')).strip(),
                    status=ParkingSpace.Status.AVAILABLE,
                )
            else:
                raise ValidationError({'parking_assignments': f'Parking row {index} needs a selected bay or a new bay code.'})
            if space.pk in seen_spaces or space.status != ParkingSpace.Status.AVAILABLE:
                raise ValidationError({'parking_assignments': f'Parking bay {space.code} is no longer available.'})
            seen_spaces.add(space.pk)
            ParkingAssignment.objects.create(
                organization=organization, parking_space=space, lease=lease,
                monthly_fee=monthly_fee, starts_on=starts_on, ends_on=ends_on,
                status=ParkingAssignment.Status.RESERVED,
                notes=str(allocation.get('notes', '')).strip(),
            )
            space.status = ParkingSpace.Status.RESERVED
            space.unit = unit
            space.save(update_fields=('status', 'unit', 'updated_at'))
            parking_total += monthly_fee

        if parking_total > 0:
            parking_item, _ = BillingItem.objects.get_or_create(
                organization=organization, code='PARKING',
                defaults={'name': 'Parking fee', 'calculation': BillingItem.Calculation.FIXED, 'income_category': 'Parking', 'is_recurring': True},
            )
            BillingProfile.objects.create(
                organization=organization, lease=lease, billing_item=parking_item,
                frequency=BillingProfile.Frequency.MONTHLY, calculation=BillingItem.Calculation.FIXED,
                amount=parking_total, effective_from=starts_on, effective_to=ends_on,
                billing_day=lease.billing_day, instructions='Recurring parking fees from allocated bays.',
            )

        # Imported debt is its own draft opening-balance document, not current-period rent income.
        opening_payload = request.data.get('opening_balance') if isinstance(request.data.get('opening_balance'), dict) else {}
        try:
            opening_amount = Decimal(str(opening_payload.get('amount', 0))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        except Exception:
            raise ValidationError({'opening_balance.amount': 'Enter a valid opening arrears amount.'})
        if opening_amount < 0:
            raise ValidationError({'opening_balance.amount': 'Opening arrears cannot be negative.'})
        if opening_amount > 0:
            try:
                balance_date = date.fromisoformat(str(opening_payload.get('as_of') or starts_on.isoformat()))
            except ValueError:
                raise ValidationError({'opening_balance.as_of': 'Enter a valid opening balance date.'})
            opening_item, _ = BillingItem.objects.get_or_create(
                organization=organization, code='OPENING_BALANCE',
                defaults={'name': 'Opening arrears', 'calculation': BillingItem.Calculation.MANUAL, 'income_category': 'Opening balances', 'is_recurring': False},
            )
            invoice = Invoice.objects.create(
                organization=organization, number=next_invoice_number(organization, balance_date.year), lease=lease,
                invoice_type='opening_balance', issued_on=balance_date, due_on=max(balance_date, starts_on),
                subtotal=opening_amount, tax_rate=0, tax_amount=0, amount=opening_amount, balance=opening_amount,
                status=Invoice.Status.DRAFT, prepared_by=request.user,
                metadata={'legacy_balance': True, 'previous_agent': str(opening_payload.get('previous_agent', '')).strip(),
                          'reference': str(opening_payload.get('reference', '')).strip(),
                          'notes': str(opening_payload.get('notes', '')).strip()},
            )
            InvoiceLine.objects.create(
                organization=organization, invoice=invoice, billing_item=opening_item,
                description='Opening arrears brought forward', quantity=1, unit_rate=opening_amount,
                subtotal=opening_amount, tax_rate=0, tax_amount=0, total=opening_amount,
                source_type='opening_balance', source_id=str(tenant.pk), metadata=invoice.metadata,
            )

        created_leases = [lease]
        additional_leases_data = request.data.get('additional_leases') if isinstance(request.data.get('additional_leases'), list) else []
        for extra in additional_leases_data:
            extra_unit_id = extra.get('unit')
            if not extra_unit_id:
                continue
            try:
                extra_unit = Unit.objects.select_for_update().for_organization(organization).select_related('property').get(pk=extra_unit_id)
            except Unit.DoesNotExist:
                continue
            if Lease.objects.for_organization(organization).filter(unit=extra_unit, status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING)).exists():
                continue
            
            try:
                e_starts = date.fromisoformat(str(extra.get('starts_on', starts_on.isoformat())))
                e_term = int(extra.get('term_months', term_months))
                e_end_m = e_starts.month - 1 + e_term
                e_end_y = e_starts.year + e_end_m // 12
                e_end_m = e_end_m % 12 + 1
                e_ends = e_starts.replace(year=e_end_y, month=e_end_m, day=min(e_starts.day, calendar.monthrange(e_end_y, e_end_m)[1]))
            except Exception:
                e_starts, e_ends, e_term = starts_on, ends_on, term_months
            
            e_area = Decimal(str(extra_unit.area)).quantize(Decimal('0.01')) if extra_unit.area is not None else Decimal('0.00')
            e_rent_rate = Decimal(str(extra.get('rent_rate_per_sqft', '0'))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            e_direct_rent = Decimal(str(extra.get('monthly_rent', '0') or extra.get('fixed_monthly_rent', '0'))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            if e_direct_rent > 0 and e_rent_rate == 0:
                e_monthly_rent = e_direct_rent
                e_rent_rate = (e_monthly_rent / e_area).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if e_area > 0 else Decimal('0.00')
            elif e_rent_rate > 0:
                e_monthly_rent = (e_area * e_rent_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if e_area > 0 else e_rent_rate
            else:
                e_monthly_rent = e_direct_rent
            
            e_service_rate = Decimal(str(extra.get('service_charge_rate_per_sqft', '0'))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            e_service = (e_area * e_service_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            e_subtotal = (e_monthly_rent + e_service).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            e_vat_rate = Decimal(str(extra.get('vat_rate', vat_rate))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            e_vat_amount = ((e_subtotal * e_vat_rate) / Decimal('100')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if e_vat_rate > 0 else Decimal('0.00')
            e_total_inc_vat = e_subtotal + e_vat_amount
            e_deposit = _unit_deposit_amount(extra_unit)

            extra_lease_ref = next_reference(Lease, 'reference', 'LEASE')
            extra_app_num = f"APP-{timezone.localdate().year}-{extra_lease_ref.rsplit('-', 1)[-1]}"
            extra_calc = {
                'area': str(e_area), 'rent_rate_per_sqft': str(e_rent_rate),
                'service_charge_rate_per_sqft': str(e_service_rate), 'monthly_rent_excl_vat': str(e_monthly_rent),
                'monthly_service_charge_excl_vat': str(e_service), 'total_excl_vat': str(e_subtotal),
                'vat_rate': str(e_vat_rate), 'vat_amount': str(e_vat_amount), 'total_inc_vat': str(e_total_inc_vat),
                'security_deposit': str(e_deposit),
            }
            extra_lease = Lease.objects.create(
                organization=organization, reference=extra_lease_ref, unit=extra_unit, tenant=tenant,
                starts_on=e_starts, ends_on=e_ends, monthly_rent=e_monthly_rent,
                deposit=e_deposit, billing_day=int(extra.get('billing_day', lease.billing_day)),
                escalation_percent=Decimal(str(extra.get('escalation_percent', '0'))),
                escalation_interval_months=int(extra.get('escalation_interval_months', 12)),
                status=Lease.Status.DRAFT,
                metadata={'application_number': extra_app_num, 'term_months': e_term, **extra_calc},
            )
            _inherit_unit_charge_profiles(extra_lease)
            created_leases.append(extra_lease)

        return Response({
            'tenant': TenantSerializer(tenant).data,
            'lease': LeaseSerializer(lease).data,
            'leases': LeaseSerializer(created_leases, many=True).data,
            'application_number': application_number, 'calculations': calculations,
        }, status=201)

    @action(detail=False, methods=('post',), url_path='bulk-onboard')
    def bulk_onboard(self, request):
        """
        Bulk-create tenants and draft leases from a JSON list with unit auto-creation and friendly error reporting.
        """
        import re
        organization = get_active_organization(request)
        active_property = get_active_property(request, organization)
        rows = request.data.get('rows') if isinstance(request.data.get('rows'), list) else []
        auto_create_units = request.data.get('auto_create_units', True)

        if not rows:
            raise ValidationError({'rows': 'Provide at least one tenant row.'})
        if len(rows) > 500:
            raise ValidationError({'rows': 'Maximum 500 tenants per bulk upload.'})

        succeeded = []
        failed = []

        def _clean_err(err_val):
            if isinstance(err_val, dict):
                return {k.replace('lease.', '').replace('tenant.', ''): _clean_err(v) for k, v in err_val.items()}
            if isinstance(err_val, list):
                return [_clean_err(x) for x in err_val]
            return str(err_val)

        for index, row in enumerate(rows):
            tenant_data = row.get('tenant') or {}
            lease_data = row.get('lease') or {}
            utilities = row.get('utilities') if isinstance(row.get('utilities'), list) else []

            try:
                with transaction.atomic():
                    t_name = str(tenant_data.get('name', '')).strip()
                    if not t_name:
                        raise ValidationError({'tenant.name': 'Tenant name is required.'})

                    # Accept unit by PK or by unit_code
                    unit_qs = Unit.objects.select_for_update().for_organization(organization).select_related('property')
                    unit = None
                    if lease_data.get('unit'):
                        try:
                            unit = unit_qs.get(pk=lease_data['unit'])
                        except (Unit.DoesNotExist, ValueError, TypeError):
                            pass
                    
                    unit_code = str(lease_data.get('unit_code', '')).strip()
                    if unit is None and unit_code:
                        unit = unit_qs.filter(code__iexact=unit_code).first()

                    # Auto-create unit if missing under active property
                    if unit is None and unit_code:
                        if auto_create_units and active_property:
                            floor_match = re.search(r'(?:FL|FLOOR|LEVEL|L|F)?\s*(\d+)', unit_code, re.IGNORECASE)
                            floor_str = floor_match.group(1) if floor_match else ('Ground' if 'GR' in unit_code.upper() or 'G' in unit_code.upper() else '1')
                            raw_area = str(lease_data.get('area', '') or '').strip()
                            try:
                                parsed_area = Decimal(raw_area).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if raw_area else None
                            except Exception:
                                parsed_area = None
                            
                            unit = Unit.objects.create(
                                organization=organization,
                                property=active_property,
                                code=unit_code,
                                floor=floor_str,
                                unit_type='commercial',
                                area=parsed_area,
                                status=Unit.Status.AVAILABLE,
                            )
                        else:
                            prop_hint = f" for '{active_property.name}'" if active_property else ""
                            raise ValidationError({'lease.unit': f'Unit code "{unit_code}" not found{prop_hint}. Please register this unit under Property -> Units or provide unit area.'})

                    if unit is None:
                        raise ValidationError({'lease.unit': 'Unit code is missing or could not be determined.'})

                    if active_property and unit.property_id != active_property.id:
                        raise ValidationError({'lease.unit': f'Unit "{unit.code}" belongs to {unit.property.name}, not the active property ({active_property.name}).'})
                    if Lease.objects.for_organization(organization).filter(
                        unit=unit, status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING)
                    ).exists():
                        raise ValidationError({'lease.unit': f'Unit "{unit.code}" already has an active lease.'})

                    try:
                        starts_on = _parse_flexible_date(lease_data.get('starts_on'))
                        if starts_on is None:
                            raise ValueError('Missing or invalid lease start date.')

                        term_months = int(lease_data.get('term_months', 12))
                        if term_months < 1 or term_months > 240:
                            raise ValueError('Term months must be between 1 and 240.')
                        end_month = starts_on.month - 1 + term_months
                        end_year = starts_on.year + end_month // 12
                        end_month = end_month % 12 + 1
                        ends_on = starts_on.replace(
                            year=end_year, month=end_month,
                            day=min(starts_on.day, calendar.monthrange(end_year, end_month)[1]),
                        )
                    except Exception:
                        raise ValidationError({'lease.starts_on': f'Invalid lease start date ("{lease_data.get("starts_on")}") or term ({lease_data.get("term_months")} months). Accepted formats: YYYY-MM-DD or DD/MM/YYYY (e.g. 2026-01-01 or 01/01/2026).'})

                    def _amount(name, default='0'):
                        try:
                            val = Decimal(str(lease_data.get(name, default) or default)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                        except Exception:
                            raise ValidationError({f'lease.{name}': 'Enter a valid number.'})
                        if val < 0:
                            raise ValidationError({f'lease.{name}': 'Amount cannot be negative.'})
                        return val

                    area = Decimal(str(unit.area)).quantize(Decimal('0.01')) if unit.area else _amount('area', '0')
                    rent_rate = _amount('rent_rate_per_sqft', '0')
                    direct_rent = _amount('monthly_rent', '0') or _amount('rent', '0')
                    service_rate = _amount('service_charge_rate_per_sqft', '0')
                    security_deposit = _unit_deposit_amount(unit)
                    escalation_percent = _amount('escalation_percent', '0')
                    vat_rate = _amount('vat_rate', '16')

                    if direct_rent > 0 and rent_rate == 0:
                        monthly_rent = direct_rent
                        rent_rate = (monthly_rent / area).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if area > 0 else Decimal('0.00')
                    elif rent_rate > 0:
                        if area <= 0:
                            if direct_rent > 0:
                                monthly_rent = direct_rent
                            else:
                                raise ValidationError({'lease.area': f'Unit "{unit.code}" has rent rate Ksh {rent_rate}/sqft, but area is 0. Please specify unit area (sq ft) or direct monthly rent.'})
                        else:
                            monthly_rent = (area * rent_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    else:
                        monthly_rent = direct_rent

                    monthly_service = (area * service_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if area > 0 else Decimal('0.00')
                    subtotal = (monthly_rent + monthly_service).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    vat_amount = ((subtotal * vat_rate) / Decimal('100')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if vat_rate > 0 else Decimal('0.00')
                    total_inc_vat = subtotal + vat_amount

                    utility_deposit = Decimal('0.00')

                    def _next_ref(model, field, prefix):
                        vals = model.objects.filter(
                            organization=organization, **{f'{field}__startswith': f'{prefix}-'}
                        ).values_list(field, flat=True)
                        nums = [int(v.rsplit('-', 1)[-1]) for v in vals if v.rsplit('-', 1)[-1].isdigit()]
                        return f'{prefix}-{(max(nums) + 1) if nums else 1:04d}'

                    t_tax = str(tenant_data.get('tax_id', '')).strip().upper()
                    t_reg = str(tenant_data.get('registration_number', '')).strip().upper()

                    # Check for existing tenant in organization (for multi-floor / multi-unit occupancy)
                    existing_tenant = None
                    if t_tax:
                        existing_tenant = Tenant.objects.for_organization(organization).filter(tax_id__iexact=t_tax).first()
                    if not existing_tenant and t_reg:
                        existing_tenant = Tenant.objects.for_organization(organization).filter(registration_number__iexact=t_reg).first()
                    if not existing_tenant and t_name:
                        existing_tenant = Tenant.objects.for_organization(organization).filter(name__iexact=t_name).first()

                    if existing_tenant:
                        tenant = existing_tenant
                        tenant_code = tenant.code
                    else:
                        tenant_code = _next_ref(Tenant, 'code', 'TNT')
                        application_number = f"APP-{timezone.localdate().year}-{tenant_code.rsplit('-', 1)[-1]}"
                        tenant_serializer = TenantSerializer(data={
                            'name': t_name,
                            'tenant_type': tenant_data.get('tenant_type', 'company'),
                            'email': tenant_data.get('email', ''),
                            'phone': tenant_data.get('phone', ''),
                            'tax_id': t_tax,
                            'registration_number': t_reg,
                            'billing_address': tenant_data.get('billing_address', ''),
                            'status': Tenant.Status.PROSPECT,
                            'metadata': {'tenant_application': {'application_number': application_number, 'source': 'bulk_import'}},
                        })
                        tenant_serializer.is_valid(raise_exception=True)
                        tenant = tenant_serializer.save(organization=organization, property=unit.property, code=tenant_code)

                    lease_reference = _next_ref(Lease, 'reference', 'LEASE')
                    application_number = f"APP-{timezone.localdate().year}-{lease_reference.rsplit('-', 1)[-1]}"

                    calculations = {
                        'area': str(area), 'rent_rate_per_sqft': str(rent_rate),
                        'service_charge_rate_per_sqft': str(service_rate), 'monthly_rent_excl_vat': str(monthly_rent),
                        'monthly_service_charge_excl_vat': str(monthly_service), 'total_excl_vat': str(subtotal),
                        'vat_rate': str(vat_rate), 'vat_amount': str(vat_amount), 'total_inc_vat': str(total_inc_vat),
                        'security_deposit': str(security_deposit), 'utilities_security_deposit': str(utility_deposit),
                        'total_amount_payable': str(total_inc_vat + security_deposit + utility_deposit),
                    }
                    lease = Lease.objects.create(
                        organization=organization, reference=lease_reference, unit=unit, tenant=tenant,
                        starts_on=starts_on, ends_on=ends_on, monthly_rent=monthly_rent,
                        deposit=security_deposit, billing_day=int(lease_data.get('billing_day', 1)),
                        escalation_percent=escalation_percent,
                        escalation_interval_months=int(lease_data.get('escalation_interval_months', 12)),
                        status=Lease.Status.DRAFT,
                        metadata={'application_number': application_number, 'term_months': term_months, 'source': 'bulk_import', **calculations},
                    )
                    _inherit_unit_charge_profiles(lease)
                    succeeded.append({
                        'row': index + 1,
                        'tenant_code': tenant_code,
                        'tenant_name': tenant.name,
                        'lease_reference': lease_reference,
                        'unit_code': unit.code,
                    })
            except Exception as exc:
                raw_errors = exc.detail if hasattr(exc, 'detail') else {'detail': str(exc)}
                cleaned = _clean_err(raw_errors)
                failed.append({'row': index + 1, 'name': str(tenant_data.get('name', '')), 'unit_code': str(lease_data.get('unit_code', '')), 'errors': cleaned})

        return Response({
            'total': len(rows),
            'succeeded_count': len(succeeded),
            'failed_count': len(failed),
            'succeeded': succeeded,
            'failed': failed,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=('get',), url_path='statement.pdf')
    def statement_pdf(self, request, pk=None):
        tenant = self.get_object()
        try:
            start = date.fromisoformat(request.query_params['start']) if request.query_params.get('start') else None
            end = date.fromisoformat(request.query_params['end']) if request.query_params.get('end') else None
        except ValueError:
            raise ValidationError({'period': 'Use ISO dates in YYYY-MM-DD format.'})
        if start and end and start > end:
            raise ValidationError({'period': 'Start date cannot be after end date.'})
        return tenant_statement_pdf(tenant, start, end, request.user.get_full_name() or request.user.get_username())


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
    @action(detail=False, methods=('post',), url_path='bulk-import')
    def bulk_import(self, request):
        """Preview or import leases for existing tenants and units without accepting deposits."""
        organization = get_active_organization(request)
        active_property = get_active_property(request, organization)
        source_rows = request.data.get('rows') if isinstance(request.data.get('rows'), list) else []
        commit = str(request.data.get('mode', 'preview')).lower() == 'commit'
        if not source_rows:
            raise ValidationError({'rows': 'Upload at least one lease row.'})
        if len(source_rows) > 1000:
            raise ValidationError({'rows': 'A maximum of 1,000 leases can be imported at once.'})

        existing_refs = Lease.objects.for_organization(organization).filter(reference__startswith='LEASE-').values_list('reference', flat=True)
        ref_numbers = [int(ref.rsplit('-', 1)[-1]) for ref in existing_refs if ref.rsplit('-', 1)[-1].isdigit()]
        next_number = max(ref_numbers, default=0)
        results, created = [], []
        for index, raw in enumerate(source_rows, start=2):
            row = {str(key).strip().lower(): value for key, value in (raw or {}).items()}
            errors = {}
            tenant_key = str(row.get('tenant_code') or row.get('tenant') or '').strip()
            unit_code = str(row.get('unit_code') or row.get('unit') or '').strip()
            tenant = Tenant.objects.for_organization(organization).filter(
                Q(code__iexact=tenant_key) | Q(email__iexact=tenant_key) | Q(name__iexact=tenant_key)
            ).first() if tenant_key else None
            units = Unit.objects.for_organization(organization).filter(code__iexact=unit_code).select_related('property')
            if active_property:
                units = units.filter(property=active_property)
            unit = units.first()
            if not tenant:
                errors['tenant'] = 'Match an existing tenant by code, email or exact name.'
            if not unit:
                errors['unit'] = 'Match an existing unit in the selected property.'
            starts_on = _parse_flexible_date(row.get('starts_on') or row.get('commencement_date'))
            if not starts_on:
                errors['starts_on'] = 'Invalid date. Use YYYY-MM-DD or DD/MM/YYYY.'
            ends_on = _parse_flexible_date(row.get('ends_on') or row.get('expiry_date'))
            if not ends_on:
                errors['ends_on'] = 'Invalid date. Use YYYY-MM-DD or DD/MM/YYYY.'
            elif starts_on and ends_on <= starts_on:
                errors['ends_on'] = 'Expiry date must be after commencement date.'
            try:
                monthly_rent = Decimal(str(row.get('monthly_rent') or '')).quantize(Decimal('0.01'))
                if monthly_rent <= 0:
                    raise ValueError
            except Exception:
                monthly_rent = Decimal('0.00')
                errors['monthly_rent'] = 'Enter an amount greater than zero.'
            try:
                billing_day = int(row.get('billing_day') or 1)
                if not 1 <= billing_day <= 28:
                    raise ValueError
            except Exception:
                billing_day = 1
                errors['billing_day'] = 'Use a day from 1 to 28.'
            try:
                escalation_percent = Decimal(str(row.get('escalation_percent') or 0)).quantize(Decimal('0.01'))
                escalation_interval = int(row.get('escalation_interval_months') or 12)
                if escalation_percent < 0 or not 1 <= escalation_interval <= 120:
                    raise ValueError
            except Exception:
                escalation_percent, escalation_interval = Decimal('0.00'), 12
            try:
                service_charge = Decimal(str(row.get('service_charge') or 0)).quantize(Decimal('0.01'))
                if service_charge < 0:
                    raise ValueError
            except Exception:
                service_charge = Decimal('0.00')
                errors['service_charge'] = 'Service charge must be zero or positive.'
            if unit and Lease.objects.for_organization(organization).filter(
                unit=unit, status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING),
            ).exists():
                errors['unit'] = 'Unit already has a current lease.'

            normalized = {
                'tenant': tenant.name if tenant else tenant_key, 'tenant_code': tenant.code if tenant else '',
                'unit_code': unit.code if unit else unit_code,
                'starts_on': starts_on.isoformat() if starts_on else '', 'ends_on': ends_on.isoformat() if ends_on else '',
                'monthly_rent': str(monthly_rent), 'service_charge': str(service_charge), 'billing_day': billing_day,
                'escalation_percent': str(escalation_percent),
                'escalation_interval_months': escalation_interval,
                'deposit': str(_unit_deposit_amount(unit)) if unit else '0.00',
            }
            if commit and not errors:
                next_number += 1
                lease = Lease.objects.create(
                    organization=organization, reference=f'LEASE-{next_number:04d}', tenant=tenant, unit=unit,
                    starts_on=starts_on, ends_on=ends_on, monthly_rent=monthly_rent,
                    deposit=_unit_deposit_amount(unit), billing_day=billing_day,
                    escalation_percent=escalation_percent, escalation_interval_months=escalation_interval,
                    status=Lease.Status.DRAFT, metadata={'source': 'lease_import', 'imported_by': request.user.get_username(), 'service_charge': str(service_charge)},
                )
                _inherit_unit_charge_profiles(lease)
                if service_charge > 0:
                    sc_item, _ = BillingItem.objects.get_or_create(
                        organization=organization, code='SERVICE_CHARGE',
                        defaults={'name': 'Service charge', 'calculation': BillingItem.Calculation.FIXED, 'income_category': 'service_charge', 'is_recurring': True},
                    )
                    BillingProfile.objects.update_or_create(
                        organization=organization, lease=lease, billing_item=sc_item, effective_from=starts_on,
                        defaults={
                            'amount': service_charge, 'effective_to': ends_on, 'frequency': BillingProfile.Frequency.MONTHLY,
                            'calculation': BillingItem.Calculation.FIXED, 'billing_day': billing_day, 'is_active': True,
                        },
                    )
                created.append(str(lease.id))
            results.append({'row': index, 'data': normalized, 'errors': errors})
        return Response({
            'mode': 'commit' if commit else 'preview', 'rows': results,
            'valid_count': sum(1 for row in results if not row['errors']),
            'error_count': sum(1 for row in results if row['errors']),
            'created_count': len(created), 'created_ids': created,
        }, status=status.HTTP_201_CREATED if commit and created else status.HTTP_200_OK)

    @transaction.atomic
    @action(detail=False, methods=('post',), url_path='bulk-update')
    def bulk_update(self, request):
        organization = get_active_organization(request)
        lease_ids = request.data.get('lease_ids') or []
        property_id = request.data.get('property_id')

        leases = Lease.objects.filter(organization=organization)
        if lease_ids:
            leases = leases.filter(id__in=lease_ids)
        elif property_id:
            leases = leases.filter(unit__property_id=property_id)
        else:
            raise ValidationError({'lease_ids': 'Select at least one lease or specify a property.'})

        updated_count = 0
        escalation_percent = request.data.get('escalation_percent')
        escalation_interval_months = request.data.get('escalation_interval_months')
        service_charge_rate_per_sqft = request.data.get('service_charge_rate_per_sqft')
        billing_day = request.data.get('billing_day')
        target_status = request.data.get('status')

        for lease in leases:
            dirty = False
            metadata = dict(lease.metadata or {})

            if escalation_percent is not None and str(escalation_percent).strip() != '':
                try:
                    lease.escalation_percent = Decimal(str(escalation_percent))
                    dirty = True
                except Exception:
                    pass

            if escalation_interval_months is not None and str(escalation_interval_months).strip() != '':
                try:
                    lease.escalation_interval_months = int(escalation_interval_months)
                    dirty = True
                except Exception:
                    pass

            if billing_day is not None and str(billing_day).strip() != '':
                try:
                    lease.billing_day = int(billing_day)
                    dirty = True
                except Exception:
                    pass

            if service_charge_rate_per_sqft is not None and str(service_charge_rate_per_sqft).strip() != '':
                try:
                    sc_rate = Decimal(str(service_charge_rate_per_sqft))
                    unit_area = Decimal(str(lease.unit.area or 0))
                    monthly_sc = (unit_area * sc_rate).quantize(Decimal('0.01'))
                    metadata['service_charge_rate_per_sqft'] = str(sc_rate)
                    metadata['monthly_service_charge_excl_vat'] = str(monthly_sc)
                    lease.metadata = metadata
                    dirty = True
                except Exception:
                    pass

            if target_status == 'active' and lease.status == Lease.Status.DRAFT:
                lease.status = Lease.Status.ACTIVE
                lease.unit.status = Unit.Status.OCCUPIED
                lease.unit.save(update_fields=('status', 'updated_at'))
                if lease.tenant.status == Tenant.Status.PROSPECT:
                    lease.tenant.status = Tenant.Status.ACTIVE
                    lease.tenant.save(update_fields=('status', 'updated_at'))
                activate_lease_allocations(lease, request.user)
                dirty = True

            if dirty:
                lease.save()
                generate_rent_schedule(lease)
                updated_count += 1

        return Response({'updated_count': updated_count, 'message': f'Successfully updated {updated_count} leases.'})

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
        generate_rent_schedule(lease)
        lease.unit.status = Unit.Status.OCCUPIED
        lease.unit.save(update_fields=('status', 'updated_at'))
        if lease.tenant.status == Tenant.Status.PROSPECT:
            lease.tenant.status = Tenant.Status.ACTIVE
            lease.tenant.save(update_fields=('status', 'updated_at'))
        activate_lease_allocations(lease, request.user)
        return Response(self.get_serializer(lease).data)

    @transaction.atomic
    @action(detail=False, methods=('post',), url_path='bulk-activate')
    def bulk_activate(self, request):
        organization = get_active_organization(request)
        lease_ids = request.data.get('lease_ids') if isinstance(request.data.get('lease_ids'), list) else []
        if not lease_ids:
            raise ValidationError({'lease_ids': 'Select at least one lease to activate.'})

        leases = Lease.objects.select_for_update().filter(
            organization=organization, pk__in=lease_ids, status=Lease.Status.DRAFT
        ).select_related('unit', 'tenant')

        activated_count = 0
        for lease in leases:
            if lease.unit.status not in (Unit.Status.SOLD, Unit.Status.UNAVAILABLE):
                conflict = Lease.objects.for_organization(organization).filter(
                    unit=lease.unit, status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING)
                ).exclude(pk=lease.pk).exists()
                if not conflict:
                    lease.status = Lease.Status.ACTIVE
                    lease.save(update_fields=('status', 'updated_at'))
                    generate_rent_schedule(lease)
                    lease.unit.status = Unit.Status.OCCUPIED
                    lease.unit.save(update_fields=('status', 'updated_at'))
                    if lease.tenant.status == Tenant.Status.PROSPECT:
                        lease.tenant.status = Tenant.Status.ACTIVE
                        lease.tenant.save(update_fields=('status', 'updated_at'))
                    activate_lease_allocations(lease, request.user)
                    activated_count += 1

        return Response({
            'activated_count': activated_count,
            'detail': f"Activated {activated_count} lease(s) successfully."
        })

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
        if lease.status not in (Lease.Status.ACTIVE, Lease.Status.EXPIRING, Lease.Status.EXPIRED):
            raise ValidationError({'status': 'Only active, expiring or expired leases can be renewed.'})
        reference = str(request.data.get('reference', '')).strip()
        try:
            ends_on = date.fromisoformat(str(request.data.get('ends_on', '')))
            starts_on = date.fromisoformat(str(request.data.get('starts_on') or lease.ends_on))
            monthly_rent = Decimal(str(request.data.get('monthly_rent', '')))
            escalation_interval = int(request.data.get('escalation_interval_months', lease.escalation_interval_months))
        except (ValueError, TypeError, ArithmeticError):
            raise ValidationError({'renewal': 'Reference, end date and monthly rent are required.'})
        if not reference:
            raise ValidationError({'reference': 'A renewal reference is required.'})
        if starts_on < lease.ends_on or ends_on <= starts_on or monthly_rent <= 0:
            raise ValidationError({'renewal': 'Renewal must start on or after the old expiry, end after commencement and use a positive rent.'})
        if not 1 <= escalation_interval <= 120:
            raise ValidationError({'escalation_interval_months': 'Escalation frequency must be between 1 and 120 months.'})
        renewed = Lease.objects.create(
            organization=lease.organization, reference=reference, unit=lease.unit,
            tenant=lease.tenant, starts_on=starts_on, ends_on=ends_on,
            monthly_rent=monthly_rent, deposit=lease.deposit,
            escalation_percent=request.data.get('escalation_percent', lease.escalation_percent),
            escalation_interval_months=escalation_interval,
            billing_day=lease.billing_day, status=Lease.Status.ACTIVE,
            renewed_from=lease, metadata={'renewed_from': lease.reference},
        )
        lease.status = Lease.Status.EXPIRED
        lease.save(update_fields=('status', 'updated_at'))
        generate_rent_schedule(renewed)
        return Response(self.get_serializer(renewed).data, status=201)

    def perform_destroy(self, instance):
        if instance.status != Lease.Status.DRAFT:
            raise ValidationError({'lease': 'Only draft leases can be deleted.'})
        instance.delete()


class InvoiceViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
    permission_map = {
        'submit_review': 'property.finance', 'approve': 'property.approve',
        'reject': 'property.approve', 'issue': 'property.approve',
    }
    queryset = Invoice.objects.select_related('lease__tenant')
    serializer_class = InvoiceSerializer
    search_fields = ('number', 'lease__tenant__name')

    @action(detail=True, methods=('get',), url_path='pdf')
    def pdf(self, request, pk=None):
        return invoice_pdf(self.get_object(), request.user.get_full_name() or request.user.get_username())

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        validate_lease_billable(serializer.validated_data['lease'], timezone.localdate())
        amount = serializer.validated_data['amount']
        issued_on = serializer.validated_data.get('issued_on', timezone.localdate())
        serializer.save(organization=organization, number=next_invoice_number(organization, issued_on.year), balance=amount, status=Invoice.Status.DRAFT, prepared_by=self.request.user)

    def perform_update(self, serializer):
        invoice = serializer.instance
        if invoice.status != Invoice.Status.DRAFT:
            raise ValidationError({'invoice': 'Only draft invoices can be edited.'})
        self._validate_organization(serializer)
        amount = serializer.validated_data.get('amount', invoice.amount)
        serializer.save(balance=amount)

    @action(detail=False, methods=('post',))
    def preview(self, request):
        organization = get_active_organization(request)
        lease = Lease.objects.for_organization(organization).select_related('tenant', 'unit__property').filter(pk=request.data.get('lease')).first()
        if not lease:
            raise ValidationError({'lease': 'Select a lease in the active organization.'})
        validate_lease_billable(lease, timezone.localdate())
        subtotal = Decimal(str(request.data.get('subtotal') or request.data.get('amount') or '0'))
        tax_rate = Decimal(str(request.data.get('tax_rate', '0')))
        if subtotal <= 0:
            raise ValidationError({'subtotal': 'Invoice subtotal must be greater than zero.'})
        if tax_rate not in (0, 16):
            raise ValidationError({'tax_rate': 'Supported VAT rates are 0% and 16%.'})
        tax_amount = (subtotal * tax_rate / Decimal('100')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        return Response({
            'lease': str(lease.pk), 'tenant': lease.tenant.name, 'property': lease.unit.property.name,
            'unit': lease.unit.code, 'invoice_type': request.data.get('invoice_type', 'rent'),
            'subtotal': subtotal, 'tax_rate': tax_rate, 'tax_amount': tax_amount,
            'total': subtotal + tax_amount, 'due_on': request.data.get('due_on'),
        })

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='submit-review')
    def submit_review(self, request, pk=None):
        invoice = Invoice.objects.select_for_update().get(pk=self.get_object().pk)
        if invoice.status != Invoice.Status.DRAFT:
            raise ValidationError({'status': 'Only draft invoices can be submitted for review.'})
        invoice.status = Invoice.Status.REVIEW
        invoice.save(update_fields=('status', 'updated_at'))
        return Response(self.get_serializer(invoice).data)

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def approve(self, request, pk=None):
        invoice = Invoice.objects.select_for_update().get(pk=self.get_object().pk)
        if invoice.status != Invoice.Status.REVIEW:
            raise ValidationError({'status': 'Only invoices in review can be confirmed.'})
        invoice.status = Invoice.Status.APPROVED
        invoice.reviewed_by = request.user
        invoice.reviewed_at = timezone.now()
        invoice.save(update_fields=('status', 'reviewed_by', 'reviewed_at', 'updated_at'))
        return Response(self.get_serializer(invoice).data)

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def reject(self, request, pk=None):
        invoice = Invoice.objects.select_for_update().get(pk=self.get_object().pk)
        if invoice.status != Invoice.Status.REVIEW:
            raise ValidationError({'status': 'Only invoices in review can be returned.'})
        reason = str(request.data.get('reason', '')).strip()
        if not reason:
            raise ValidationError({'reason': 'A return reason is required.'})
        invoice.status = Invoice.Status.DRAFT
        invoice.metadata = {**invoice.metadata, 'review_return_reason': reason}
        invoice.save(update_fields=('status', 'metadata', 'updated_at'))
        return Response(self.get_serializer(invoice).data)

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def issue(self, request, pk=None):
        from notifications.models import Notification
        from notifications.services import send_email_notification

        invoice = Invoice.objects.select_for_update().get(pk=self.get_object().pk)
        if invoice.status != Invoice.Status.APPROVED:
            raise ValidationError({'status': 'Only confirmed invoices can be issued.'})
        validate_lease_billable(invoice.lease, timezone.localdate())
        invoice.status = Invoice.Status.ISSUED
        invoice.issued_by = request.user
        invoice.issued_at = timezone.now()
        invoice.save(update_fields=('status', 'issued_by', 'issued_at', 'updated_at'))
        tenant = invoice.lease.tenant
        preference = str(tenant.metadata.get('billing_preference', 'email' if tenant.email else 'portal'))
        channel = preference if preference in InvoiceReminder.Channel.values else (InvoiceReminder.Channel.EMAIL if tenant.email else InvoiceReminder.Channel.PORTAL)
        recipient = tenant.email if channel == InvoiceReminder.Channel.EMAIL else tenant.phone if channel == InvoiceReminder.Channel.SMS else tenant.name
        if recipient:
            message = f'Invoice {invoice.number} for KES {invoice.amount:,.2f} is due on {invoice.due_on}.'
            InvoiceReminder.objects.create(organization=invoice.organization, invoice=invoice, channel=channel, recipient=recipient, message=message, sent_at=timezone.now(), sent_by=request.user)
            access = TenantPortalAccess.objects.for_organization(invoice.organization).filter(tenant=tenant, is_active=True).select_related('user').first()
            if access:
                Notification.objects.create(organization=invoice.organization, recipient=access.user, title=f'New invoice: {invoice.number}', message=message, level=Notification.Level.INFO, action_url='/tenant-portal', metadata={'invoice_id': str(invoice.id)})
            if tenant.email:
                try:
                    send_email_notification(
                        recipient_email=tenant.email,
                        recipient_name=tenant.name,
                        subject=f'Invoice {invoice.number} from Center Estates — KES {invoice.amount:,.2f}',
                        message=f'Your invoice {invoice.number} for KES {invoice.amount:,.2f} has been issued and is due on {invoice.due_on}. You can view the breakdown, download your PDF invoice, or pay instantly via M-Pesa on the tenant portal.',
                        action_url='/tenant-portal',
                        organization=invoice.organization,
                    )
                except Exception:
                    pass
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
        from notifications.services import send_email_notification

        invoice = self.get_object()
        if invoice.status in (Invoice.Status.DRAFT, Invoice.Status.PAID, Invoice.Status.VOID) or invoice.balance <= 0:
            raise ValidationError({'invoice': 'Only outstanding issued invoices can receive reminders.'})
        channel = str(request.data.get('channel', InvoiceReminder.Channel.PORTAL))
        if channel not in InvoiceReminder.Channel.values:
            raise ValidationError({'channel': 'Select email, SMS or tenant portal.'})
        notice_type = str(request.data.get('notice_type', InvoiceReminder.NoticeType.PAYMENT_REMINDER))
        if notice_type not in InvoiceReminder.NoticeType.values:
            raise ValidationError({'notice_type': 'Select payment reminder, formal demand or notice to vacate.'})
        tenant = invoice.lease.tenant
        recipient = tenant.email if channel == InvoiceReminder.Channel.EMAIL else tenant.phone if channel == InvoiceReminder.Channel.SMS else tenant.name
        if not recipient:
            raise ValidationError({'recipient': f'Tenant has no {channel} contact.'})
        message = str(request.data.get('message', '')).strip() or f'Invoice {invoice.number} has an outstanding balance of KES {invoice.balance:,.2f} due on {invoice.due_on}.'
        reminder = InvoiceReminder.objects.create(
            organization=invoice.organization, invoice=invoice, channel=channel,
            notice_type=notice_type, recipient=recipient, message=message,
            sent_at=timezone.now(), sent_by=request.user,
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
        elif channel == InvoiceReminder.Channel.EMAIL and tenant.email:
            try:
                send_email_notification(
                    recipient_email=tenant.email,
                    recipient_name=tenant.name,
                    subject=f'Payment Reminder: Invoice {invoice.number} — KES {invoice.balance:,.2f} outstanding',
                    message=message,
                    action_url='/tenant-portal',
                    organization=invoice.organization,
                )
            except Exception:
                pass
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

    @action(detail=True, methods=('get',), url_path='pdf')
    def pdf(self, request, pk=None):
        return receipt_pdf(self.get_object(), request.user.get_full_name() or request.user.get_username())

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
        number = str(serializer.validated_data.get('number') or '').strip()
        if not number:
            prefix = f'RCPT-{timezone.localdate():%Y}-'
            sequence = Receipt.objects.filter(organization=organization, number__startswith=prefix).count() + 1
            number = f'{prefix}{sequence:05d}'
        receipt = serializer.save(organization=organization, received_by=self.request.user, number=number)
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


@extend_schema_view(retrieve=extend_schema(parameters=[OpenApiParameter("pk", OpenApiTypes.UUID, OpenApiParameter.PATH)]))
class InvoiceReminderViewSet(ReadOnlyModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.PROPERTY
    serializer_class = InvoiceReminderSerializer

    queryset = InvoiceReminder.objects.all()


    def get_queryset(self):
        return InvoiceReminder.objects.for_organization(
            get_active_organization(self.request),
        ).select_related('invoice__lease__tenant')


class BankTransactionViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
    queryset = BankTransaction.objects.select_related('receipt', 'receipt__invoice', 'receipt__invoice__lease', 'receipt__invoice__lease__tenant', 'receipt__invoice__lease__unit')
    serializer_class = BankTransactionSerializer
    search_fields = ('reference', 'description', 'receipt__number', 'extracted_mpesa_ref', 'extracted_payer_name', 'extracted_account')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), status=BankTransaction.Status.UNMATCHED)

    def perform_update(self, serializer):
        if serializer.instance.status != BankTransaction.Status.UNMATCHED:
            raise ValidationError({'transaction': 'Matched bank transactions are immutable.'})
        super().perform_update(serializer)

    @action(detail=False, methods=('get',), url_path='summary')
    def summary(self, request):
        org = get_active_organization(request)
        qs = BankTransaction.objects.for_organization(org)
        matched_qs = qs.filter(status=BankTransaction.Status.MATCHED)
        unmatched_qs = qs.filter(status=BankTransaction.Status.UNMATCHED)
        unreceipted_qs = unmatched_qs.filter(Q(money_in__gt=0) | Q(transaction_type__in=(BankTransaction.TransactionType.MPESA_SWEEP, BankTransaction.TransactionType.DIRECT_DEPOSIT, BankTransaction.TransactionType.CHEQUE)))
        charges_qs = qs.filter(transaction_type__in=(BankTransaction.TransactionType.BANK_FEE, BankTransaction.TransactionType.TAX))

        total_in = qs.aggregate(s=Sum('money_in'))['s'] or Decimal('0')
        total_out = qs.aggregate(s=Sum('money_out'))['s'] or Decimal('0')
        matched_amt = matched_qs.aggregate(s=Sum('amount'))['s'] or Decimal('0')
        unreceipted_amt = unreceipted_qs.aggregate(s=Sum('amount'))['s'] or Decimal('0')
        charges_amt = charges_qs.aggregate(s=Sum('amount'))['s'] or Decimal('0')

        return Response({
            'total_count': qs.count(),
            'total_money_in': str(total_in),
            'total_money_out': str(total_out),
            'matched_count': matched_qs.count(),
            'matched_amount': str(matched_amt),
            'unreceipted_count': unreceipted_qs.count(),
            'unreceipted_amount': str(unreceipted_amt),
            'bank_charges_count': charges_qs.count(),
            'bank_charges_amount': str(charges_amt),
        })

    @transaction.atomic
    @action(detail=False, methods=('post',), url_path='import-statement')
    def import_statement(self, request):
        """Multi-format bank statement import engine (.xlsx, .xls, .csv).

        Parses bank statement lines across all Kenyan commercial banks, extracts
        embedded M-Pesa codes, account/unit numbers and payer names, auto-matches
        against existing receipts, and flags unreceipted credits.
        """
        from properties.bank_parser import parse_bank_statement_file

        upload = request.FILES.get('file')
        if not upload:
            raise ValidationError({'file': 'Please select a bank statement file (.xlsx, .xls, or .csv).'})
        if upload.size > 15 * 1024 * 1024:
            raise ValidationError({'file': 'Bank statement file must be 15 MB or smaller.'})

        try:
            content = upload.read()
            parsed = parse_bank_statement_file(content, upload.name)
        except Exception as exc:
            raise ValidationError({'file': f'Could not parse bank statement: {str(exc)}'})

        if not parsed:
            raise ValidationError({'file': 'No valid transaction lines could be found in the uploaded statement.'})

        organization = get_active_organization(request)
        seen_refs = [line['reference'] for line in parsed]
        existing_txs = {
            tx.reference: tx
            for tx in BankTransaction.objects.filter(organization=organization, reference__in=seen_refs)
        }

        # Prefetch available unlinked receipts for auto-matching
        unlinked_receipts = list(
            Receipt.objects.for_organization(organization).filter(bank_transaction__isnull=True).select_related('invoice')
        )
        receipts_by_ref = {r.external_reference.strip().upper(): r for r in unlinked_receipts if r.external_reference}
        receipts_by_number = {r.number.strip().upper(): r for r in unlinked_receipts if r.number}

        created_count = 0
        skipped_count = 0
        auto_matched_count = 0
        unreceipted_count = 0

        to_create = []

        for line in parsed:
            ref = line['reference']
            if ref in existing_txs:
                skipped_count += 1
                continue

            tx = BankTransaction(
                organization=organization,
                reference=ref,
                transacted_on=line['transacted_on'],
                description=line['description'],
                amount=line['amount'],
                money_in=line['money_in'],
                money_out=line['money_out'],
                transaction_type=line['transaction_type'],
                extracted_mpesa_ref=line['extracted_mpesa_ref'],
                extracted_account=line['extracted_account'],
                extracted_payer_name=line['extracted_payer_name'],
                extracted_phone=line['extracted_phone'],
                raw_details=line['raw_details'],
                balance_after=line['balance_after'],
                status=BankTransaction.Status.UNMATCHED,
            )

            # Auto-Match Rule 1: M-Pesa Receipt Code Match
            matched_rcpt = None
            if tx.extracted_mpesa_ref and tx.extracted_mpesa_ref.upper() in receipts_by_ref:
                cand = receipts_by_ref[tx.extracted_mpesa_ref.upper()]
                if cand.amount == tx.amount:
                    matched_rcpt = cand
            # Auto-Match Rule 2: Bank Reference / Receipt Number Match
            elif tx.reference.upper() in receipts_by_ref:
                cand = receipts_by_ref[tx.reference.upper()]
                if cand.amount == tx.amount:
                    matched_rcpt = cand
            elif tx.reference.upper() in receipts_by_number:
                cand = receipts_by_number[tx.reference.upper()]
                if cand.amount == tx.amount:
                    matched_rcpt = cand

            if matched_rcpt:
                tx.receipt = matched_rcpt
                tx.status = BankTransaction.Status.MATCHED
                tx.matched_by = request.user
                tx.matched_at = timezone.now()
                auto_matched_count += 1
                # Consume this receipt so it isn't matched twice
                if matched_rcpt.external_reference:
                    receipts_by_ref.pop(matched_rcpt.external_reference.strip().upper(), None)
            else:
                if tx.money_in > 0 or tx.transaction_type in (
                    BankTransaction.TransactionType.MPESA_SWEEP,
                    BankTransaction.TransactionType.DIRECT_DEPOSIT,
                    BankTransaction.TransactionType.CHEQUE
                ):
                    unreceipted_count += 1

            to_create.append(tx)
            created_count += 1

        if to_create:
            BankTransaction.objects.bulk_create(to_create)

        return Response({
            'total_parsed': len(parsed),
            'created': created_count,
            'skipped': skipped_count,
            'auto_matched': auto_matched_count,
            'unreceipted_credits': unreceipted_count,
        }, status=status.HTTP_201_CREATED)

    @transaction.atomic
    @action(detail=False, methods=('post',), url_path='import-csv')
    def import_csv(self, request):
        """Backwards-compatible CSV alias forwarding to import_statement."""
        res = self.import_statement(request)
        return Response({'created': res.data['created'], 'skipped': res.data['skipped']}, status=res.status_code)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='quick-receipt')
    def quick_receipt(self, request, pk=None):
        """1-Click Receipting: Instantly posts a Receipt for an unreceipted bank transaction and reconciles it."""
        transaction_record = BankTransaction.objects.select_for_update().get(pk=self.get_object().pk)
        if transaction_record.status != BankTransaction.Status.UNMATCHED:
            raise ValidationError({'status': 'Only unmatched bank transactions can be receipted.'})

        organization = transaction_record.organization
        invoice_id = request.data.get('invoice_id')
        if not invoice_id:
            raise ValidationError({'invoice_id': 'Select an invoice to apply this receipt to.'})

        invoice = Invoice.objects.select_for_update().filter(pk=invoice_id, organization=organization).first()
        if not invoice:
            raise ValidationError({'invoice_id': 'Invoice was not found.'})

        if invoice.status not in (Invoice.Status.ISSUED, Invoice.Status.PARTIAL, Invoice.Status.OVERDUE):
            raise ValidationError({'invoice_id': 'Only issued or overdue invoices can receive payment receipts.'})

        amount = transaction_record.amount
        if amount > invoice.balance:
            raise ValidationError({'amount': f'Transaction amount (KES {amount:,.2f}) exceeds invoice balance (KES {invoice.balance:,.2f}).'})

        # Generate receipt number
        prefix = f'RCPT-{timezone.localdate():%Y}-'
        sequence = Receipt.objects.filter(organization=organization, number__startswith=prefix).count() + 1
        receipt_number = f'{prefix}{sequence:05d}'

        payer_name = request.data.get('payer_name') or transaction_record.extracted_payer_name or invoice.lease.tenant.name
        channel = request.data.get('payment_channel')
        if not channel:
            channel = 'mpesa' if transaction_record.transaction_type == BankTransaction.TransactionType.MPESA_SWEEP else 'bank_transfer'

        ext_ref = transaction_record.extracted_mpesa_ref or transaction_record.reference

        receipt = Receipt.objects.create(
            organization=organization,
            number=receipt_number,
            tenant=invoice.lease.tenant,
            invoice=invoice,
            amount=amount,
            received_on=transaction_record.transacted_on,
            payment_method=channel,
            external_reference=ext_ref,
            received_by=request.user,
        )

        ReceiptAllocation.objects.create(
            organization=organization,
            receipt=receipt,
            invoice=invoice,
            amount=amount,
            allocated_by=request.user,
        )

        invoice.balance -= amount
        invoice.status = Invoice.Status.PAID if invoice.balance == 0 else Invoice.Status.PARTIAL
        invoice.save(update_fields=('balance', 'status', 'updated_at'))

        transaction_record.receipt = receipt
        transaction_record.status = BankTransaction.Status.MATCHED
        transaction_record.matched_by = request.user
        transaction_record.matched_at = timezone.now()
        transaction_record.save()

        return Response(self.get_serializer(transaction_record).data, status=status.HTTP_201_CREATED)

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

    @action(detail=True, methods=('get',), url_path='export-allocations')
    def export_allocations(self, request, pk=None):
        charge = self.get_object()
        allocations = ServiceChargeAllocation.objects.for_organization(charge.organization).filter(
            service_charge=charge
        ).select_related('unit__building', 'unit__property')

        output = StringIO()
        writer = csv.writer(output)
        writer.writerow([
            'Scheme Name', 'Property', 'Building', 'Unit Code', 'Floor Area (m2)',
            'Share Ratio (%)', 'Annual Allocation (KES)', 'Monthly Allocation (KES)'
        ])
        for a in allocations:
            writer.writerow([
                charge.name,
                charge.property.name,
                a.unit.building.name if a.unit.building else '—',
                a.unit.code,
                f"{a.unit.area:.2f}" if a.unit.area else '0.00',
                f"{(a.ratio * 100):.4f}%",
                f"{a.annual_amount:.2f}",
                f"{a.monthly_amount:.2f}",
            ])
        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="service-charge-allocations-{charge.id}.csv"'
        return response


@extend_schema_view(retrieve=extend_schema(parameters=[OpenApiParameter("pk", OpenApiTypes.UUID, OpenApiParameter.PATH)]))
class ServiceChargeAllocationViewSet(ReadOnlyModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.PROPERTY
    serializer_class = ServiceChargeAllocationSerializer

    queryset = ServiceChargeAllocation.objects.all()

    def get_queryset(self):
        return ServiceChargeAllocation.objects.for_organization(
            get_active_organization(self.request),
        ).select_related('service_charge__property', 'unit')


@extend_schema_view(retrieve=extend_schema(parameters=[OpenApiParameter("pk", OpenApiTypes.UUID, OpenApiParameter.PATH)]))
class ServiceChargeReconciliationViewSet(OrganizationModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.PROPERTY
    write_permission = 'property.finance'
    permission_map = {
        'review': 'property.finance',
        'approve': 'property.finance',
        'download_pdf': 'property.view',
    }
    serializer_class = ServiceChargeReconciliationSerializer

    queryset = ServiceChargeReconciliation.objects.all()

    def get_queryset(self):
        return ServiceChargeReconciliation.objects.for_organization(
            get_active_organization(self.request),
        ).select_related('service_charge__property', 'prepared_by', 'reviewed_by')

    @action(detail=True, methods=('post',))
    def review(self, request, pk=None):
        rec = self.get_object()
        if rec.status != ServiceChargeReconciliation.Status.DRAFT:
            raise ValidationError({'status': 'Only draft reconciliations can be marked as reviewed.'})
        rec.status = ServiceChargeReconciliation.Status.REVIEWED
        rec.reviewed_by = request.user
        rec.reviewed_at = timezone.now()
        rec.save(update_fields=('status', 'reviewed_by', 'reviewed_at', 'updated_at'))
        return Response(self.get_serializer(rec).data)

    @action(detail=True, methods=('post',))
    def approve(self, request, pk=None):
        rec = self.get_object()
        if rec.status == ServiceChargeReconciliation.Status.APPROVED:
            raise ValidationError({'status': 'This reconciliation is already approved.'})
        rec.status = ServiceChargeReconciliation.Status.APPROVED
        if not rec.reviewed_by:
            rec.reviewed_by = request.user
            rec.reviewed_at = timezone.now()
        rec.save(update_fields=('status', 'reviewed_by', 'reviewed_at', 'updated_at'))
        return Response(self.get_serializer(rec).data)

    @action(detail=True, methods=('get',), url_path='pdf')
    def download_pdf(self, request, pk=None):
        rec = self.get_object()
        user_name = request.user.get_full_name() or request.user.get_username()
        return service_charge_reconciliation_pdf(rec, generated_by=user_name)


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


class TaxConfigurationViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
    queryset = TaxConfiguration.objects.all()
    serializer_class = TaxConfigurationSerializer
    search_fields = ('code', 'name')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer))


class BillingItemViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
    queryset = BillingItem.objects.select_related('tax_configuration')
    serializer_class = BillingItemSerializer
    search_fields = ('code', 'name', 'income_category')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer))


class BillingProfileViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
    queryset = BillingProfile.objects.select_related('lease__tenant', 'lease__unit__property', 'billing_item')
    serializer_class = BillingProfileSerializer
    search_fields = ('lease__reference', 'lease__tenant__name', 'billing_item__name')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer))


class LeaseEscalationViewSet(OrganizationModelViewSet):
    write_permission = 'property.leasing'
    queryset = LeaseEscalation.objects.select_related('lease__tenant', 'lease__unit__property', 'approved_by')
    serializer_class = LeaseEscalationSerializer
    search_fields = ('lease__reference', 'lease__tenant__name')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), status=LeaseEscalation.Status.PLANNED)

    @action(detail=True, methods=('post',))
    def approve(self, request, pk=None):
        escalation = self.get_object()
        if escalation.status != LeaseEscalation.Status.PLANNED:
            raise ValidationError({'status': 'Only planned escalations can be approved.'})
        escalation.status = LeaseEscalation.Status.APPROVED
        escalation.approved_by = request.user
        escalation.approved_at = timezone.now()
        escalation.save()
        return Response(self.get_serializer(escalation).data)


class UnitStatusHistoryViewSet(OrganizationModelViewSet):
    write_permission = 'property.operations'
    queryset = UnitStatusHistory.objects.select_related('unit__property', 'recorded_by')
    serializer_class = UnitStatusHistorySerializer
    search_fields = ('unit__code', 'unit__property__name', 'reason', 'marketing_status')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), recorded_by=self.request.user)

    def perform_update(self, serializer):
        raise ValidationError({'history': 'Unit status history is immutable.'})

    def perform_destroy(self, instance):
        raise ValidationError({'history': 'Unit status history is immutable.'})


class TenantMovementViewSet(OrganizationModelViewSet):
    write_permission = 'property.leasing'
    queryset = TenantMovement.objects.select_related('tenant', 'lease', 'unit__property', 'recorded_by')
    serializer_class = TenantMovementSerializer
    search_fields = ('tenant__name', 'lease__reference', 'unit__code', 'reason')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), recorded_by=self.request.user)

    def perform_update(self, serializer):
        raise ValidationError({'movement': 'Tenant movement history is immutable.'})

    def perform_destroy(self, instance):
        raise ValidationError({'movement': 'Tenant movement history is immutable.'})


@extend_schema_view(retrieve=extend_schema(parameters=[OpenApiParameter("pk", OpenApiTypes.UUID, OpenApiParameter.PATH)]))
class InvoiceLineViewSet(ReadOnlyModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.PROPERTY
    serializer_class = InvoiceLineSerializer

    queryset = InvoiceLine.objects.all()


    def get_queryset(self):
        organization = get_active_organization(self.request)
        return scope_queryset_to_property(
            InvoiceLine.objects.for_organization(organization).select_related('invoice__lease__unit__property', 'billing_item'),
            self.request, organization,
        )


class BillingRunViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
    permission_map = {
        'prepare': 'property.finance', 'exclude': 'property.finance',
        'generate': 'property.finance', 'approve': 'property.approve',
        'resolve_issue': 'property.approve',
    }
    queryset = BillingRun.objects.select_related('property', 'created_by', 'approved_by').prefetch_related('issues')
    serializer_class = BillingRunSerializer

    @staticmethod
    def _profile_is_due(profile, period_start):
        """Return whether a recurring profile is billable in the selected month.

        Effective dates are already constrained by the caller. Frequencies are
        anchored to the profile's effective month so quarterly, annual and
        custom schedules remain deterministic across billing runs.
        """
        frequency = profile.frequency
        if frequency in (BillingProfile.Frequency.MONTHLY, BillingProfile.Frequency.METERED):
            return True
        month_delta = (
            (period_start.year - profile.effective_from.year) * 12
            + period_start.month
            - profile.effective_from.month
        )
        # A profile beginning later in the same billing month is still due.
        month_delta = max(month_delta, 0)
        intervals = {
            BillingProfile.Frequency.QUARTERLY: 3,
            BillingProfile.Frequency.BIANNUAL: 6,
            BillingProfile.Frequency.ANNUAL: 12,
            BillingProfile.Frequency.CUSTOM: max(profile.custom_interval_months, 1),
        }
        if frequency in intervals:
            return month_delta % intervals[frequency] == 0
        if frequency in (BillingProfile.Frequency.ONE_OFF, BillingProfile.Frequency.EVENT):
            return month_delta == 0
        return False

    def _execute_prepare(self, run, invoice_types: set[str] | None = None):
        run.issues.all().delete()
        leases = Lease.objects.for_organization(run.organization).filter(
            status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING),
            starts_on__lte=run.period_end, ends_on__gt=run.period_start,
        ).select_related('tenant', 'unit__property')
        if run.property_id:
            leases = leases.filter(unit__property=run.property)
        created = 0; ready = 0; issue_count = 0
        amount_ready = Decimal('0'); amount_issues = Decimal('0'); amount_generated = Decimal('0')
        from facilities.models import MeterReading, UtilityMeter

        # Calculate month multiplier for quarterly or multi-month periods
        start_year, start_month = run.period_start.year, run.period_start.month
        end_year, end_month = run.period_end.year, run.period_end.month
        months_count = max(1, (end_year - start_year) * 12 + (end_month - start_month) + 1)

        if months_count > 1:
            if months_count == 3 and start_month in (1, 4, 7, 10):
                q_num = (start_month - 1) // 3 + 1
                period_suffix = f"Q{q_num} {start_year} ({run.period_start:%b} – {run.period_end:%b %Y})"
            else:
                period_suffix = f"{months_count} Months ({run.period_start:%b %Y} – {run.period_end:%b %Y})"
        else:
            period_suffix = f"{run.period_start:%B %Y}"

        qty = Decimal(str(months_count))
        period_key = f"{run.period_start:%Y-%m}_to_{run.period_end:%Y-%m}" if months_count > 1 else run.period_start.strftime('%Y-%m')

        # Prefetch existing non-void invoices for this billing period
        existing_invoices = Invoice.objects.for_organization(run.organization).filter(
            metadata__billing_period=period_key,
        ).exclude(status=Invoice.Status.VOID).values('id', 'number', 'lease_id', 'invoice_type', 'amount')

        lease_invoices_map: dict[str, dict[str, dict]] = {}
        for inv in existing_invoices:
            lid = str(inv['lease_id'])
            if lid not in lease_invoices_map:
                lease_invoices_map[lid] = {}
            itype = str(inv['invoice_type']).lower()
            lease_invoices_map[lid][itype] = inv

        existing_candidate_map = {str(c.lease_id): c for c in run.candidates.all()}
        current_lease_ids = set()

        for lease in leases:
            current_lease_ids.add(str(lease.id))
            issue_rows = []
            items = []
            profiles = lease.billing_profiles.filter(
                is_active=True, effective_from__lte=run.period_end,
            ).filter(Q(effective_to__isnull=True) | Q(effective_to__gte=run.period_start)).select_related('billing_item__tax_configuration')
            due_profiles = [profile for profile in profiles if self._profile_is_due(profile, run.period_start)]
            if invoice_types is not None:
                def _profile_matches(profile) -> bool:
                    code = str(profile.billing_item.code or "").strip().lower()
                    if code == "rent" and "rent" in invoice_types:
                        return True
                    if code in ("service_charge", "sc") and "service_charge" in invoice_types:
                        return True
                    if code in ("water", "electricity", "utility") and "utility" in invoice_types:
                        return True
                    if "other" in invoice_types and code not in ("rent", "service_charge", "sc", "water", "electricity", "utility"):
                        return True
                    return code in invoice_types
                due_profiles = [p for p in due_profiles if _profile_matches(p)]
            for profile in due_profiles:
                monthly_val = profile.amount
                if profile.calculation == BillingItem.Calculation.AREA_RATE:
                    if not lease.unit.area:
                        issue_rows.append(('missing_unit_area', 'Unit area is required for area-based billing.', profile))
                        continue
                    monthly_val = (profile.rate * lease.unit.area).quantize(Decimal('0.01'))
                elif profile.calculation == BillingItem.Calculation.METERED:
                    readings = MeterReading.objects.for_organization(run.organization).filter(
                        meter__property_unit=lease.unit, meter__utility_type=UtilityMeter.Utility.WATER,
                        read_at__date__range=(run.period_start, run.period_end), status=MeterReading.Status.APPROVED,
                    ).select_related('meter')
                    if not readings.exists():
                        issue_rows.append(('missing_water_reading', 'A valid water meter reading is required.', profile))
                        continue
                    monthly_val = sum((row.cost for row in readings), Decimal('0'))
                elif profile.billing_item.code.upper() == 'RENT':
                    monthly_val = lease.effective_rent(run.period_start)
                elif profile.calculation == BillingItem.Calculation.PERCENTAGE:
                    monthly_val = (lease.effective_rent(run.period_start) * profile.rate / Decimal('100')).quantize(Decimal('0.01'))
                if monthly_val <= 0:
                    issue_rows.append(('missing_rate', f'{profile.billing_item.name} has no billable amount.', profile))
                    continue
                
                line_qty = Decimal('1') if profile.calculation == BillingItem.Calculation.METERED else qty
                line_subtotal = (monthly_val * line_qty).quantize(Decimal('0.01'))
                tax = profile.billing_item.tax_configuration
                tax_rate = tax.rate if tax and tax.is_active and tax.effective_from <= run.period_end and (not tax.effective_to or tax.effective_to >= run.period_start) else Decimal('0')
                tax_amount = (line_subtotal * tax_rate / Decimal('100')).quantize(Decimal('0.01'))
                
                desc = f"{profile.billing_item.name} ({period_suffix})" if months_count > 1 and profile.calculation != BillingItem.Calculation.METERED else profile.billing_item.name
                items.append({
                    'billing_item': str(profile.billing_item_id), 'code': profile.billing_item.code, 'description': desc,
                    'quantity': str(line_qty), 'unit_rate': str(monthly_val), 'subtotal': str(line_subtotal),
                    'tax_code': tax.code if tax else '', 'tax_rate': str(tax_rate), 'tax_amount': str(tax_amount),
                    'total': str(line_subtotal + tax_amount), 'source_type': 'billing_profile', 'source_id': str(profile.id)
                })

            if (invoice_types is None or "rent" in invoice_types) and not any(item['code'].upper() == 'RENT' for item in items):
                rent = lease.effective_rent(run.period_start)
                if rent > 0:
                    line_subtotal = (rent * qty).quantize(Decimal('0.01'))
                    desc = f"Rent ({period_suffix})" if months_count > 1 else "Rent"
                    items.insert(0, {
                        'billing_item': None, 'code': 'RENT', 'description': desc,
                        'quantity': str(qty), 'unit_rate': str(rent), 'subtotal': str(line_subtotal),
                        'tax_code': '', 'tax_rate': '0', 'tax_amount': '0', 'total': str(line_subtotal),
                        'source_type': 'lease', 'source_id': str(lease.id)
                    })
                elif invoice_types is None or "rent" in invoice_types:
                    issue_rows.append(('missing_rent', 'The lease has no effective rent for this period.', None))

            allocation = ServiceChargeAllocation.objects.for_organization(run.organization).filter(
                unit=lease.unit, service_charge__is_active=True, service_charge__starts_on__lte=run.period_end,
            ).select_related('service_charge').order_by('-service_charge__starts_on').first()
            if (invoice_types is None or "service_charge" in invoice_types) and allocation and not any(item['code'].upper() in ('SERVICE_CHARGE', 'SC') for item in items):
                monthly_sc = allocation.monthly_amount
                line_subtotal = (monthly_sc * qty).quantize(Decimal('0.01'))
                desc = f"{allocation.service_charge.name} ({period_suffix})" if months_count > 1 else allocation.service_charge.name
                items.append({
                    'billing_item': None, 'code': 'SERVICE_CHARGE', 'description': desc,
                    'quantity': str(qty), 'unit_rate': str(monthly_sc), 'subtotal': str(line_subtotal),
                    'tax_code': '', 'tax_rate': '0', 'tax_amount': '0', 'total': str(line_subtotal),
                    'source_type': 'service_charge_allocation', 'source_id': str(allocation.id)
                })
            if (invoice_types is None or "service_charge" in invoice_types) and not any(item['code'].upper() in ('SERVICE_CHARGE', 'SC') for item in items):
                meta = lease.metadata or {}
                monthly_sc_meta = meta.get('monthly_service_charge_excl_vat') or meta.get('service_charge')
                if monthly_sc_meta is not None:
                    try:
                        monthly_sc = Decimal(str(monthly_sc_meta))
                    except Exception:
                        monthly_sc = Decimal('0')
                    if monthly_sc > 0:
                        line_subtotal = (monthly_sc * qty).quantize(Decimal('0.01'))
                        desc = f"Service charge ({period_suffix})" if months_count > 1 else "Service charge"
                        items.append({
                            'billing_item': None, 'code': 'SERVICE_CHARGE', 'description': desc,
                            'quantity': str(qty), 'unit_rate': str(monthly_sc), 'subtotal': str(line_subtotal),
                            'tax_code': '', 'tax_rate': '0', 'tax_amount': '0', 'total': str(line_subtotal),
                            'source_type': 'lease_metadata', 'source_id': str(lease.id)
                        })
                else:
                    try:
                        rate = Decimal(str(meta.get('service_charge_rate_per_sqft') or '0'))
                        area = Decimal(str(lease.unit.area or '0')) if lease.unit and lease.unit.area else Decimal('0')
                        if rate > 0 and area > 0:
                            monthly_sc = (rate * area).quantize(Decimal('0.01'))
                            line_subtotal = (monthly_sc * qty).quantize(Decimal('0.01'))
                            desc = f"Service charge ({period_suffix})" if months_count > 1 else "Service charge"
                            items.append({
                                'billing_item': None, 'code': 'SERVICE_CHARGE', 'description': desc,
                                'quantity': str(qty), 'unit_rate': str(monthly_sc), 'subtotal': str(line_subtotal),
                                'tax_code': '', 'tax_rate': '0', 'tax_amount': '0', 'total': str(line_subtotal),
                                'source_type': 'lease_metadata', 'source_id': str(lease.id)
                            })
                    except Exception:
                        pass

            if not items:
                continue

            # Tag each item as billed or unbilled
            lease_invs = lease_invoices_map.get(str(lease.id), {})
            unbilled_items = []
            unbilled_total = Decimal('0')
            billed_total = Decimal('0')
            for it in items:
                c_code = str(it.get('code') or 'charge').strip().lower()
                itype = {'rent': 'rent', 'service_charge': 'service_charge', 'sc': 'service_charge', 'water': 'water', 'electricity': 'electricity'}.get(c_code, c_code)
                existing_inv = lease_invs.get(itype)
                if existing_inv:
                    it['billed'] = True
                    it['invoice_id'] = str(existing_inv['id'])
                    it['invoice_number'] = str(existing_inv['number'])
                    billed_total += Decimal(str(it['total']))
                else:
                    it['billed'] = False
                    unbilled_items.append(it)
                    unbilled_total += Decimal(str(it['total']))

            if lease.ends_on <= run.period_end + timedelta(days=90):
                issue_rows.append(('lease_expiring', f'Lease expires on {lease.ends_on:%d %b %Y}.', None, BillingReadinessIssue.Severity.WARNING))

            subtotal = sum((Decimal(item['subtotal']) for item in items), Decimal('0'))
            tax_amount = sum((Decimal(item['tax_amount']) for item in items), Decimal('0'))
            blocking = any(len(row) < 4 or row[3] == BillingReadinessIssue.Severity.BLOCKING for row in issue_rows)

            if len(unbilled_items) == 0:
                cand_status = BillingCandidate.Status.GENERATED
            elif blocking:
                cand_status = BillingCandidate.Status.ISSUE
            else:
                cand_status = BillingCandidate.Status.READY

            issue_summary = [{'code': row[0], 'message': row[1], 'severity': row[3] if len(row) > 3 else BillingReadinessIssue.Severity.BLOCKING} for row in issue_rows]

            candidate = existing_candidate_map.get(str(lease.id))
            if candidate:
                candidate.invoice_date = run.period_start
                candidate.due_date = run.period_start.replace(day=min(lease.billing_day, 28))
                candidate.billing_items = items
                candidate.subtotal = subtotal
                candidate.tax_amount = tax_amount
                candidate.total = subtotal + tax_amount
                candidate.status = cand_status
                candidate.issue_summary = issue_summary
                candidate.save()
            else:
                candidate = BillingCandidate.objects.create(
                    organization=run.organization, billing_run=run, lease=lease,
                    invoice_date=run.period_start, due_date=run.period_start.replace(day=min(lease.billing_day, 28)),
                    billing_items=items, subtotal=subtotal, tax_amount=tax_amount, total=subtotal + tax_amount,
                    status=cand_status,
                    issue_summary=issue_summary,
                )
            for row in issue_rows:
                BillingReadinessIssue.objects.create(
                    organization=run.organization, billing_run=run, lease=lease,
                    billing_profile=row[2], code=row[0], message=row[1],
                    severity=row[3] if len(row) > 3 else BillingReadinessIssue.Severity.BLOCKING,
                )
            created += 1
            if cand_status == BillingCandidate.Status.READY:
                ready += 1
                amount_ready += unbilled_total
            elif cand_status == BillingCandidate.Status.ISSUE:
                issue_count += 1
                amount_issues += unbilled_total
            else:
                amount_generated += billed_total

        # Delete any dangling candidates that no longer belong to active leases
        for lid, cand in existing_candidate_map.items():
            if lid not in current_lease_ids and not cand.invoice_id:
                cand.delete()

        run.status = BillingRun.Status.REVIEW if (ready > 0 or issue_count > 0) else BillingRun.Status.GENERATED
        run.approved_by = None
        run.approved_at = None
        run.totals = {
            'candidates': created,
            'ready': ready,
            'with_issues': issue_count,
            'amount_ready': str(amount_ready),
            'amount_with_issues': str(amount_issues),
            'amount_generated': str(amount_generated),
            'total_amount': str(amount_ready + amount_issues + amount_generated),
        }
        run.save(update_fields=('status', 'approved_by', 'approved_at', 'totals', 'updated_at'))

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        organization = self._validate_organization(serializer)
        active_property = get_active_property(self.request, organization)
        prop = serializer.validated_data.get('property') or active_property
        period_start = serializer.validated_data.get('period_start')
        period_end = serializer.validated_data.get('period_end')

        existing = BillingRun.objects.filter(
            organization=organization,
            property=prop,
            period_start=period_start,
        ).first()

        if existing:
            if existing.period_end != period_end:
                existing.period_end = period_end
                existing.save(update_fields=('period_end',))
            return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)

        run = serializer.save(
            organization=organization,
            created_by=self.request.user,
            property=prop,
        )
        return Response(self.get_serializer(run).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def prepare(self, request, pk=None):
        run = BillingRun.objects.select_for_update().get(pk=self.get_object().pk)
        raw_types = request.data.get('invoice_types')
        invoice_types: set[str] | None = None
        if isinstance(raw_types, list) and raw_types:
            normalized: set[str] = set()
            for t in raw_types:
                key = str(t).strip().lower().replace("-", "_")
                if key == "utility":
                    normalized.update({"water", "electricity", "utility"})
                elif key in {"servicecharge", "service_charge", "sc"}:
                    normalized.add("service_charge")
                elif key:
                    normalized.add(key)
            invoice_types = normalized or None
        self._execute_prepare(run, invoice_types=invoice_types)
        return Response(self.get_serializer(run).data)

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def approve(self, request, pk=None):
        run = BillingRun.objects.select_for_update().get(pk=self.get_object().pk)
        if run.status not in (BillingRun.Status.REVIEW, BillingRun.Status.PREPARING, BillingRun.Status.GENERATED):
            raise ValidationError({'status': 'Prepare and review the billing run before confirmation.'})
        if run.issues.filter(severity=BillingReadinessIssue.Severity.BLOCKING, status=BillingReadinessIssue.Status.OPEN).exists():
            raise ValidationError({'issues': 'Resolve or authorize every blocking issue before confirmation.'})
        run.status = BillingRun.Status.APPROVED; run.approved_by = request.user; run.approved_at = timezone.now()
        run.save(update_fields=('status', 'approved_by', 'approved_at', 'updated_at'))
        return Response(self.get_serializer(run).data)

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def exclude(self, request, pk=None):
        candidate = self.get_object().candidates.filter(pk=request.data.get('candidate')).first()
        reason = str(request.data.get('reason', '')).strip()
        if not candidate or candidate.invoice_id:
            raise ValidationError({'candidate': 'Select an ungenerated candidate from this run.'})
        if not reason:
            raise ValidationError({'reason': 'Document why this tenancy is excluded from billing.'})
        candidate.status = BillingCandidate.Status.EXCLUDED; candidate.exclusion_reason = reason; candidate.excluded_by = request.user
        candidate.save()
        return Response(BillingCandidateSerializer(candidate).data)

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def generate(self, request, pk=None):
        from notifications.models import Notification

        run = BillingRun.objects.select_for_update().get(pk=self.get_object().pk)
        requested = request.data.get('candidate_ids')
        if requested is not None and not isinstance(requested, list):
            raise ValidationError({'candidate_ids': 'Candidate IDs must be supplied as a list.'})
        if isinstance(requested, list) and run.candidates.filter(pk__in=requested).count() != len(set(requested)):
            raise ValidationError({'candidate_ids': 'Every selected candidate must belong to this billing run.'})
        
        candidates = run.candidates.select_for_update().select_related('lease')
        if isinstance(requested, list):
            candidates = candidates.filter(pk__in=requested)
        candidates = list(candidates)
        if not candidates:
            raise ValidationError({'candidates': 'Select at least one ready billing candidate.'})

        year = run.period_start.year
        raw_types = request.data.get('invoice_types')
        selected_types: set[str] | None = None
        if isinstance(raw_types, list) and raw_types:
            normalized: set[str] = set()
            for t in raw_types:
                key = str(t).strip().lower().replace("-", "_")
                if key == "utility":
                    normalized.update({"water", "electricity", "utility"})
                elif key in {"servicecharge", "service_charge", "sc"}:
                    normalized.add("service_charge")
                elif key:
                    normalized.add(key)
            selected_types = normalized or None

        def _item_type(item: dict) -> str:
            c = str(item.get('code') or 'charge').strip().lower()
            return {'rent': 'rent', 'service_charge': 'service_charge', 'sc': 'service_charge', 'water': 'water', 'electricity': 'electricity'}.get(c, c[:40])

        period_key = f"{run.period_start:%Y-%m}_to_{run.period_end:%Y-%m}" if (run.period_end.year - run.period_start.year)*12 + (run.period_end.month - run.period_start.month) >= 1 else run.period_start.strftime('%Y-%m')

        generated: list[Invoice] = []
        skipped_duplicate = 0
        for candidate in candidates:
            items_for_candidate = candidate.billing_items
            if selected_types is not None:
                items_for_candidate = [it for it in items_for_candidate if _item_type(it) in selected_types or (it.get('code','').lower() == 'sc' and 'service_charge' in selected_types)]
            if not items_for_candidate:
                continue
            candidate_invoices: list[Invoice] = []
            for item in items_for_candidate:
                code = str(item.get('code') or 'charge').strip().lower()
                invoice_type = {
                    'rent': 'rent', 'service_charge': 'service_charge', 'sc': 'service_charge',
                    'water': 'water', 'electricity': 'electricity',
                }.get(code, code[:40])
                if Invoice.objects.for_organization(run.organization).filter(
                    lease=candidate.lease, invoice_type=invoice_type,
                    metadata__billing_period=period_key,
                ).exclude(status=Invoice.Status.VOID).exists():
                    skipped_duplicate += 1
                    item['billed'] = True
                    continue
                line_subtotal = Decimal(item['subtotal'])
                line_tax = Decimal(item['tax_amount'])
                line_total = Decimal(item['total'])

                unit_obj = candidate.lease.unit if candidate.lease else None
                owner_obj = None
                recipient_type = Invoice.RecipientType.TENANT
                if unit_obj and unit_obj.property and unit_obj.property.is_sectional_title:
                    if invoice_type == 'service_charge' and unit_obj.service_charge_payer == Unit.PayerChoice.OWNER:
                        recipient_type = Invoice.RecipientType.OWNER
                        owner_obj = unit_obj.owner

                collection_acct = None
                if unit_obj and unit_obj.property:
                    collection_acct = PropertyCollectionAccount.objects.filter(
                        property=unit_obj.property, charge_type=invoice_type, is_active=True
                    ).first()

                mpesa_ref = ''
                if unit_obj:
                    fmt = (collection_acct.mpesa_reference_format if collection_acct else None) or '{CHARGE}-{UNIT}-{MONTH}-{YEAR}'
                    c_prefix = 'RENT' if invoice_type == 'rent' else ('SC' if invoice_type == 'service_charge' else ('WATER' if invoice_type == 'water' else 'MF'))
                    try:
                        mpesa_ref = fmt.format(
                            CHARGE=c_prefix,
                            UNIT=unit_obj.code,
                            MONTH=f"{run.period_start:%m}",
                            YEAR=f"{run.period_start:%Y}"
                        )
                    except Exception:
                        mpesa_ref = f"{c_prefix}-{unit_obj.code}-{run.period_start:%m}-{run.period_start:%Y}"

                invoice = Invoice.objects.create(
                    organization=run.organization, number=next_invoice_number(run.organization, year), lease=candidate.lease,
                    recipient_type=recipient_type, owner=owner_obj, unit=unit_obj, charge_type=invoice_type,
                    collection_account=collection_acct, mpesa_reference=mpesa_ref,
                    invoice_type=invoice_type, issued_on=candidate.invoice_date, due_on=candidate.due_date,
                    subtotal=line_subtotal, tax_amount=line_tax,
                    tax_rate=(line_tax / line_subtotal * Decimal('100')).quantize(Decimal('0.01')) if line_subtotal else 0,
                    amount=line_total, balance=line_total, status=Invoice.Status.ISSUED,
                    prepared_by=run.created_by, reviewed_by=request.user, reviewed_at=timezone.now(),
                    issued_by=request.user, issued_at=timezone.now(), metadata={
                        'source': 'billing_run', 'billing_run_id': str(run.id),
                        'billing_candidate_id': str(candidate.id), 'billing_period': period_key,
                        'period_start': str(run.period_start), 'period_end': str(run.period_end),
                        'charge_code': item.get('code', ''),
                    },
                )
                InvoiceLine.objects.create(
                    organization=run.organization, invoice=invoice,
                    billing_item_id=item.get('billing_item') or None, description=item['description'],
                    quantity=Decimal(item['quantity']), unit_rate=Decimal(item['unit_rate']), subtotal=line_subtotal,
                    tax_code=item.get('tax_code', ''), tax_rate=Decimal(item['tax_rate']), tax_amount=line_tax, total=line_total,
                    source_type=item.get('source_type', ''), source_id=item.get('source_id', ''),
                )
                item['billed'] = True
                item['invoice_id'] = str(invoice.id)
                item['invoice_number'] = invoice.number
                candidate_invoices.append(invoice)
                generated.append(invoice)
            if candidate_invoices:
                candidate.generated_invoices.add(*candidate_invoices)
                primary = next((row for row in candidate_invoices if row.invoice_type == 'rent'), candidate_invoices[0])
                if not candidate.invoice_id:
                    candidate.invoice = primary
                # Check if all billing items are now billed
                if all(it.get('billed') for it in candidate.billing_items):
                    candidate.status = BillingCandidate.Status.GENERATED
                candidate.save(update_fields=('invoice', 'status', 'billing_items', 'updated_at'))
                portal_access = TenantPortalAccess.objects.for_organization(run.organization).filter(
                    tenant=candidate.lease.tenant, is_active=True,
                ).select_related('user').first()
                if portal_access:
                    Notification.objects.create(
                        organization=run.organization,
                        recipient=portal_access.user,
                        title=f'{len(candidate_invoices)} new invoice(s) for {period_key}',
                        message=f'Rent and recurring charges totalling KES {candidate.total:,.2f} are due on {candidate.due_date:%d %b %Y}. You may pay them together.',
                        level=Notification.Level.INFO,
                        action_url='/tenant-portal',
                        metadata={
                            'invoice_ids': [str(row.id) for row in candidate_invoices],
                            'billing_run_id': str(run.id),
                            'billing_period': run.period_start.strftime('%Y-%m'),
                        },
                    )

        # Recompute run totals and status
        self._execute_prepare(run)

        resp: dict = {'generated_count': len(generated), 'invoices': InvoiceSerializer(generated, many=True).data}
        if skipped_duplicate:
            resp['skipped_duplicate'] = skipped_duplicate
        if not generated and skipped_duplicate:
            resp['replayed'] = True
            return Response(resp, status=200)
        return Response(resp, status=201)

    @action(detail=True, methods=('post',), url_path='resolve-issue')
    def resolve_issue(self, request, pk=None):
        issue = BillingReadinessIssue.objects.filter(
            billing_run=self.get_object(), pk=request.data.get('issue'), organization=get_active_organization(request),
        ).first()
        if not issue:
            raise ValidationError({'issue': 'Select an issue from this billing run.'})
        status = request.data.get('status', BillingReadinessIssue.Status.OVERRIDDEN)
        if status != BillingReadinessIssue.Status.OVERRIDDEN:
            raise ValidationError({'status': 'Correct source data and run readiness again. Only an authorized override can be recorded manually.'})
        notes = str(request.data.get('notes', '')).strip()
        if not notes:
            raise ValidationError({'notes': 'An authorized override requires supporting notes.'})
        issue.status = status; issue.resolution_notes = notes
        issue.resolved_by = request.user; issue.resolved_at = timezone.now(); issue.save()
        if issue.lease_id and not issue.billing_run.issues.filter(
            lease=issue.lease, severity=BillingReadinessIssue.Severity.BLOCKING,
            status=BillingReadinessIssue.Status.OPEN,
        ).exists():
            issue.billing_run.candidates.filter(
                lease=issue.lease, status=BillingCandidate.Status.ISSUE,
            ).update(status=BillingCandidate.Status.READY, updated_at=timezone.now())
        candidates = issue.billing_run.candidates.all()
        ready_rows = candidates.filter(status=BillingCandidate.Status.READY)
        issue_rows = candidates.filter(status=BillingCandidate.Status.ISSUE)
        issue.billing_run.totals = {
            'candidates': candidates.count(), 'ready': ready_rows.count(), 'with_issues': issue_rows.count(),
            'amount_ready': str(ready_rows.aggregate(value=Sum('total'))['value'] or Decimal('0')),
            'amount_with_issues': str(issue_rows.aggregate(value=Sum('total'))['value'] or Decimal('0')),
            'total_amount': str(candidates.exclude(status=BillingCandidate.Status.EXCLUDED).aggregate(value=Sum('total'))['value'] or Decimal('0')),
        }
        issue.billing_run.save(update_fields=('totals', 'updated_at'))
        return Response(BillingReadinessIssueSerializer(issue).data)


class ReportDefinitionViewSet(OrganizationModelViewSet):
    write_permission = 'property.report'
    queryset = ReportDefinition.objects.select_related('created_by')
    serializer_class = ReportDefinitionSerializer
    search_fields = ('key', 'name', 'description')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), created_by=self.request.user)


@extend_schema_view(retrieve=extend_schema(parameters=[OpenApiParameter("pk", OpenApiTypes.UUID, OpenApiParameter.PATH)]))
class ReportExecutionViewSet(ReadOnlyModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.PROPERTY
    serializer_class = ReportExecutionSerializer

    queryset = ReportExecution.objects.all()


    def get_queryset(self):
        organization = get_active_organization(self.request)
        return scope_queryset_to_property(
            ReportExecution.objects.for_organization(organization).select_related('definition', 'property', 'generated_by'),
            self.request, organization,
        )

    @action(detail=True, methods=('get',))
    def download(self, request, pk=None):
        execution = self.get_object()
        if execution.status != ReportExecution.Status.COMPLETED or not execution.file:
            raise ValidationError({'report': 'This report artifact is not available for download.'})
        execution.file.open('rb')
        return FileResponse(execution.file, as_attachment=True, filename=os.path.basename(execution.file.name))


class ScheduledReportViewSet(OrganizationModelViewSet):
    write_permission = 'property.report'
    queryset = ScheduledReport.objects.select_related('definition', 'property', 'created_by', 'last_execution')
    serializer_class = ScheduledReportSerializer

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        recipients = serializer.validated_data.get('recipients', [])
        if recipients:
            from organizations.models import Membership
            authorized = set(Membership.objects.active().filter(
                organization=organization, user__email__in=recipients,
            ).values_list('user__email', flat=True))
            unauthorized = sorted(set(recipients) - authorized)
            if unauthorized:
                raise ValidationError({'recipients': f'Only active organization members can receive scheduled reports: {", ".join(unauthorized)}'})
        serializer.save(
            organization=organization, created_by=self.request.user,
            property=serializer.validated_data.get('property') or get_active_property(self.request, organization),
        )

    @staticmethod
    def _next_run(schedule, from_time=None):
        current = from_time or timezone.now()
        if schedule.frequency == ScheduledReport.Frequency.DAILY:
            return current + timedelta(days=1)
        if schedule.frequency == ScheduledReport.Frequency.WEEKLY:
            return current + timedelta(days=7)
        months = 3 if schedule.frequency == ScheduledReport.Frequency.QUARTERLY else 1
        month_index = current.month - 1 + months
        year = current.year + month_index // 12; month = month_index % 12 + 1
        day = min(current.day, calendar.monthrange(year, month)[1])
        return current.replace(year=year, month=month, day=day)

    @staticmethod
    def _deliver(schedule, execution):
        if not schedule.recipients:
            schedule.last_delivery_status = 'generated'
            schedule.last_delivery_error = ''
            return
        from django.core.mail import EmailMessage
        try:
            message = EmailMessage(
                subject=f'Center Estates report: {schedule.definition.name}',
                body=f'The scheduled {schedule.definition.name} report is attached. Reporting period: {execution.period_start or "default"} to {execution.period_end or "default"}.',
                to=schedule.recipients,
            )
            execution.file.open('rb')
            message.attach(execution.file.name.rsplit('/', 1)[-1], execution.file.read())
            message.send(fail_silently=False)
            schedule.last_delivery_status = 'delivered'
            schedule.last_delivery_at = timezone.now()
            schedule.last_delivery_error = ''
        except Exception as exc:
            schedule.last_delivery_status = 'delivery_failed'
            schedule.last_delivery_error = str(exc)[:1000]

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def run(self, request, pk=None):
        schedule = ScheduledReport.objects.select_for_update().get(pk=self.get_object().pk)
        filters = {**schedule.definition.default_filters, **schedule.filters}
        report_key = filters.pop('_report_key', schedule.definition.key)
        query = QueryDict('', mutable=True)
        for key, value in filters.items():
            if isinstance(value, list): query.setlist(key, [str(item) for item in value])
            elif value is not None: query[key] = str(value)
        query['output'] = schedule.output_format
        original_query = request._request.GET
        original_property = request._request.META.get('HTTP_X_PROPERTY_ID')
        request._request.GET = query
        if schedule.property_id:
            request._request.META['HTTP_X_PROPERTY_ID'] = str(schedule.property_id)
        try:
            analytics = PropertyAnalyticsViewSet(); analytics.request = request
            response = analytics.export(request, report_kind=report_key)
        finally:
            request._request.GET = original_query
            if original_property is None: request._request.META.pop('HTTP_X_PROPERTY_ID', None)
            else: request._request.META['HTTP_X_PROPERTY_ID'] = original_property
        execution = ReportExecution.objects.get(pk=response['X-Report-Execution-ID'])
        if execution.definition_id != schedule.definition_id:
            execution.definition = schedule.definition
            execution.save(update_fields=('definition', 'updated_at'))
        self._deliver(schedule, execution)
        schedule.last_execution = execution
        # Failed email delivery is retried on a short cadence; successful runs advance
        # to the next reporting period so operators do not miss a missed delivery.
        if schedule.last_delivery_status == 'delivery_failed':
            schedule.next_run_at = timezone.now() + timedelta(hours=1)
        else:
            schedule.next_run_at = self._next_run(schedule)
        schedule.save(update_fields=('last_execution', 'next_run_at', 'last_delivery_status', 'last_delivery_at', 'last_delivery_error', 'updated_at'))
        return Response(ReportExecutionSerializer(execution).data, status=201)

    @action(detail=False, methods=('post',), url_path='run-due')
    def run_due(self, request):
        due = list(self.get_queryset().filter(is_active=True, next_run_at__lte=timezone.now()).values_list('id', flat=True))
        created = []
        for schedule_id in due:
            response = self.run(request, pk=schedule_id)
            created.append(response.data)
        return Response({'queued': len(created), 'executions': created})


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

    def _draft_invoice(self, schedule, tax_rate, actor):
        if tax_rate not in (0, 16):
            raise ValidationError({'tax_rate': 'Supported VAT rates are 0% and 16%.'})
        if schedule.status == RentSchedule.Status.WAIVED:
            raise ValidationError({'status': 'A waived rent schedule cannot be invoiced.'})
        if schedule.invoice_id:
            return schedule.invoice, False
        today = timezone.localdate()
        lease = schedule.lease
        validate_lease_billable(lease, today)
        if schedule.period_start < lease.starts_on or schedule.period_start >= lease.ends_on or schedule.period_end > lease.ends_on:
            raise ValidationError({'rent_schedule': 'The billing period falls outside the active lease term.'})
        refresh_schedule_amount(schedule)
        tax_amount = (schedule.total * tax_rate / Decimal('100')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        invoice = Invoice.objects.create(
            organization=schedule.organization,
            number=f'RENT-{schedule.lease.reference}-{schedule.period_start:%Y%m%d}',
            lease=schedule.lease, invoice_type='rent', issued_on=timezone.localdate(),
            due_on=max(schedule.due_on, timezone.localdate()), subtotal=schedule.total,
            tax_rate=tax_rate, tax_amount=tax_amount, amount=schedule.total + tax_amount,
            balance=schedule.total + tax_amount, status=Invoice.Status.DRAFT,
            prepared_by=actor,
            metadata={'source': 'rent_schedule', 'schedule_id': str(schedule.pk)},
        )
        schedule.invoice = invoice
        schedule.status = RentSchedule.Status.INVOICED
        schedule.save(update_fields=('invoice', 'status', 'updated_at'))
        return invoice, True

    @action(detail=True, methods=('post',))
    def preview(self, request, pk=None):
        schedule = self.get_object()
        tax_rate = Decimal(str(request.data.get('tax_rate', '0')))
        if tax_rate not in (0, 16):
            raise ValidationError({'tax_rate': 'Supported VAT rates are 0% and 16%.'})
        tax_amount = (schedule.total * tax_rate / Decimal('100')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        return Response({
            'schedule': str(schedule.pk), 'lease': schedule.lease.reference,
            'tenant': schedule.lease.tenant.name, 'period_start': schedule.period_start,
            'period_end': schedule.period_end, 'base_rent': schedule.base_rent,
            'escalation_amount': schedule.escalation_amount, 'service_charge': schedule.service_charge,
            'subtotal': schedule.total, 'tax_rate': tax_rate, 'tax_amount': tax_amount,
            'total': schedule.total + tax_amount,
        })

    @transaction.atomic
    @action(detail=False, methods=('post',), url_path='bulk-generate-invoices')
    def bulk_generate_invoices(self, request):
        ids = request.data.get('schedule_ids')
        if not isinstance(ids, list) or not ids:
            raise ValidationError({'schedule_ids': 'Select at least one rent schedule.'})
        tax_rate = Decimal(str(request.data.get('tax_rate', '0')))
        if tax_rate not in (0, 16):
            raise ValidationError({'tax_rate': 'Supported VAT rates are 0% and 16%.'})
        # Lock only rent-schedule rows. The list queryset joins the nullable
        # invoice relation for display, which PostgreSQL cannot lock through an
        # outer join.
        schedules = list(
            self.filter_queryset(self.get_queryset())
            .select_related(None)
            .select_for_update()
            .filter(pk__in=ids)
        )
        if len(schedules) != len(set(map(str, ids))):
            raise ValidationError({'schedule_ids': 'One or more schedules are unavailable in the selected property.'})
        created = []
        existing = []
        for schedule in schedules:
            invoice, was_created = self._draft_invoice(schedule, tax_rate, request.user)
            (created if was_created else existing).append(InvoiceSerializer(invoice).data)
        return Response({'created': created, 'existing': existing, 'created_count': len(created), 'existing_count': len(existing)}, status=201 if created else 200)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='generate-invoice')
    def generate_invoice(self, request, pk=None):
        schedule = RentSchedule.objects.select_for_update().get(pk=self.get_object().pk)
        _, created = self._draft_invoice(schedule, Decimal(str(request.data.get('tax_rate', '0'))), request.user)
        return Response(self.get_serializer(schedule).data, status=201 if created else 200)


class ReceiptAllocationViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
    queryset = ReceiptAllocation.objects.select_related('receipt__tenant', 'invoice')
    serializer_class = ReceiptAllocationSerializer
    http_method_names = ('get', 'post', 'head', 'options')
    search_fields = ('receipt__number', 'invoice__number', 'receipt__tenant__name')

    @transaction.atomic
    @action(detail=False, methods=('post',), url_path='auto-allocate')
    def auto_allocate(self, request):
        organization = get_active_organization(request)
        unapplied_receipts = Receipt.objects.select_for_update().filter(
            organization=organization,
            invoice__isnull=True
        ).order_by('received_on', 'id')
        
        allocated_count = 0
        total_allocated = Decimal('0.00')

        for receipt in unapplied_receipts:
            already_allocated = ReceiptAllocation.objects.filter(receipt=receipt).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            remaining_receipt_amount = receipt.amount - already_allocated
            if remaining_receipt_amount <= Decimal('0.00'):
                continue
            
            open_invoices = Invoice.objects.select_for_update().filter(
                organization=organization,
                lease__tenant=receipt.tenant,
                status__in=(Invoice.Status.ISSUED, Invoice.Status.PARTIAL, Invoice.Status.OVERDUE),
                balance__gt=0
            ).order_by('due_on', 'id')

            for invoice in open_invoices:
                if remaining_receipt_amount <= Decimal('0.00'):
                    break
                alloc_amount = min(remaining_receipt_amount, invoice.balance)
                if alloc_amount > Decimal('0.00'):
                    ReceiptAllocation.objects.create(
                        organization=organization,
                        receipt=receipt,
                        invoice=invoice,
                        amount=alloc_amount,
                        allocated_by=request.user
                    )
                    invoice.balance -= alloc_amount
                    invoice.status = Invoice.Status.PAID if invoice.balance == 0 else Invoice.Status.PARTIAL
                    invoice.save(update_fields=('balance', 'status', 'updated_at'))
                    remaining_receipt_amount -= alloc_amount
                    total_allocated += alloc_amount
                    allocated_count += 1
            
            if remaining_receipt_amount == Decimal('0.00'):
                last_alloc = ReceiptAllocation.objects.filter(receipt=receipt).last()
                if last_alloc:
                    receipt.invoice = last_alloc.invoice
                    receipt.save(update_fields=('invoice', 'updated_at'))

        return Response({
            'detail': f'Auto-allocated {allocated_count} receipt allocations totaling KES {total_allocated:,.2f}.',
            'allocated_count': allocated_count,
            'total_allocated': str(total_allocated)
        }, status=status.HTTP_200_OK)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='reverse')
    def reverse(self, request, pk=None):
        allocation = self.get_object()
        invoice = Invoice.objects.select_for_update().filter(pk=allocation.invoice_id, organization=allocation.organization).first()
        receipt = Receipt.objects.select_for_update().filter(pk=allocation.receipt_id, organization=allocation.organization).first()
        
        if invoice:
            invoice.balance += allocation.amount
            if invoice.balance == invoice.amount:
                invoice.status = Invoice.Status.ISSUED
            elif invoice.balance > 0:
                invoice.status = Invoice.Status.PARTIAL
            invoice.save(update_fields=('balance', 'status', 'updated_at'))
        
        if receipt and receipt.invoice_id == allocation.invoice_id:
            receipt.invoice = None
            receipt.save(update_fields=('invoice', 'updated_at'))
            
        allocation.delete()
        return Response({'detail': 'Allocation reversed successfully. Funds restored to unapplied receipt.'}, status=status.HTTP_200_OK)


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
        issued_on = serializer.validated_data.get('issued_on', timezone.localdate())
        number = serializer.validated_data.get('number')
        if not number or not str(number).strip():
            number = next_credit_note_number(organization, issued_on.year)
        serializer.save(organization=organization, invoice=invoice, number=number, issued_on=issued_on, issued_by=self.request.user)
        invoice.balance -= amount
        invoice.status = Invoice.Status.PAID if invoice.balance == 0 else Invoice.Status.PARTIAL
        invoice.save(update_fields=('balance', 'status', 'updated_at'))

    def perform_update(self, serializer):
        raise ValidationError({'credit_note': 'Issued credit notes are immutable.'})

    def perform_destroy(self, instance):
        raise ValidationError({'credit_note': 'Credit notes cannot be deleted.'})

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='void')
    def void(self, request, pk=None):
        credit_note = self.get_object()
        if credit_note.status == CreditNote.Status.VOID:
            raise ValidationError({'credit_note': 'This credit note is already void.'})
        reason = str(request.data.get('reason', '')).strip()
        if not reason:
            raise ValidationError({'reason': 'A reason is required to void a credit note.'})
        credit_note.status = CreditNote.Status.VOID
        credit_note.void_reason = reason
        credit_note.save(update_fields=('status', 'void_reason', 'updated_at'))
        invoice = Invoice.objects.select_for_update().filter(pk=credit_note.invoice_id, organization=credit_note.organization).first()
        if invoice:
            invoice.balance += credit_note.amount
            if invoice.balance == invoice.amount:
                invoice.status = Invoice.Status.ISSUED
            elif invoice.balance > 0:
                invoice.status = Invoice.Status.PARTIAL
            invoice.save(update_fields=('balance', 'status', 'updated_at'))
        return Response({'detail': 'Credit note voided successfully.'}, status=status.HTTP_200_OK)


class LandlordInvoiceViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
    queryset = LandlordInvoice.objects.select_related('property')
    serializer_class = LandlordInvoiceSerializer
    search_fields = ('number', 'landlord_name', 'property__name', 'billing_period')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        prop = serializer.validated_data.get('property')
        billing_period = serializer.validated_data.get('billing_period', '')
        fee_type = serializer.validated_data.get('fee_type', LandlordInvoice.FeeType.MANAGEMENT)
        gross = serializer.validated_data.get('gross_collections', 0)
        rate = serializer.validated_data.get('fee_rate', 0)
        fee_amount = (gross * rate / 100).quantize(Decimal('0.01'))
        vat_rate = serializer.validated_data.get('vat_rate', Decimal('16.00'))
        vat_amount = (fee_amount * vat_rate / 100).quantize(Decimal('0.01'))
        total = fee_amount + vat_amount
        deductions = serializer.validated_data.get('deductions', 0)
        net_payout = gross - fee_amount - vat_amount - deductions

        # Auto-generate number
        year = billing_period[:4] if billing_period else str(timezone.localdate().year)
        existing = LandlordInvoice.objects.filter(
            organization=organization, number__startswith=f'LB-{year}-'
        ).values_list('number', flat=True)
        numbers = [int(n.rsplit('-', 1)[-1]) for n in existing if n.rsplit('-', 1)[-1].isdigit()]
        number = f'LB-{year}-{(max(numbers) + 1) if numbers else 1:06d}'

        serializer.save(
            organization=organization, number=number,
            fee_amount=fee_amount, vat_amount=vat_amount,
            total_amount=total, net_payout=net_payout,
            issued_on=timezone.localdate(),
            status=LandlordInvoice.Status.DRAFT,
        )

    @transaction.atomic
    @action(detail=True, methods=('post',))
    def send(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status != LandlordInvoice.Status.DRAFT:
            raise ValidationError({'status': 'Only draft invoices can be sent.'})
        invoice.status = LandlordInvoice.Status.SENT
        invoice.save(update_fields=('status', 'updated_at'))
        return Response(LandlordInvoiceSerializer(invoice).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status not in (LandlordInvoice.Status.SENT, LandlordInvoice.Status.PARTIAL, LandlordInvoice.Status.OVERDUE):
            raise ValidationError({'status': 'Only sent invoices can be marked as paid.'})
        payment_ref = str(request.data.get('payment_reference', '')).strip()
        if not payment_ref:
            raise ValidationError({'payment_reference': 'Payment reference is required.'})
        invoice.status = LandlordInvoice.Status.PAID
        invoice.paid_at = timezone.now()
        invoice.payment_reference = payment_ref
        invoice.save(update_fields=('status', 'paid_at', 'payment_reference', 'updated_at'))
        return Response(LandlordInvoiceSerializer(invoice).data)


class PropertyDashboardViewSet(ViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.PROPERTY

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        organization = get_active_organization(request)
        properties = scope_model_queryset(Property, request, organization)
        units = scope_model_queryset(Unit, request, organization)
        leases = scope_model_queryset(Lease, request, organization)
        invoices = scope_model_queryset(Invoice, request, organization)
        receipts = scope_model_queryset(Receipt, request, organization)
        expenses = scope_model_queryset(Expense, request, organization)
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
            collection_trend.append({
                'month': date(today.year, month, 1).strftime('%b'),
                # Expected collection is the value posted for the month. Keep the
                # original keys during the API transition for older clients.
                'expected': billed,
                'actual': month_collected,
                'billed': billed,
                'collected': month_collected,
            })
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
        active_property = get_active_property(request, organization)
        property_summary = next(
            (row for row in portfolio if active_property and str(row['id']) == str(active_property.id)),
            None,
        )
        return Response({
            'kpis': {
                'properties': properties.count(), 'units': total_units, 'occupiedUnits': occupied,
                'occupancyRate': round((occupied / total_units * 100), 1) if total_units else 0,
                'activeLeases': leases.filter(status=Lease.Status.ACTIVE).count(),
                'activeTenants': scope_model_queryset(Tenant, request, organization).filter(status=Tenant.Status.ACTIVE).count(),
                'outstanding': outstanding, 'collectedYtd': collected, 'expensesYtd': spent,
            },
            'recentLeases': LeaseSerializer(leases[:5], many=True).data,
            'overdueInvoices': InvoiceSerializer(invoices.filter(status=Invoice.Status.OVERDUE)[:5], many=True).data,
            'propertyMix': list(properties.values('property_type').annotate(count=Count('id')).order_by('-count')),
            'collectionTrend': collection_trend,
            'leaseExpiry': lease_expiry,
            'aging': [{'label': label, 'amount': amount} for label, amount in aging.items()],
            # Module workspaces consume one explicitly selected property. The
            # portfolio collection remains available only to callers that
            # deliberately request X-Property-Scope: portfolio (for /overview).
            'propertySummary': property_summary,
            'portfolio': portfolio,
        })


class PropertyAnalyticsViewSet(ViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.PROPERTY

    def _organization(self):
        return get_active_organization(self.request)

    @staticmethod
    def _service_charge_for_lease(lease):
        """Return the monthly service charge for a lease.
        Priority: 1) active billing profile lines tagged 'service'
                  2) explicit metadata['monthly_service_charge_excl_vat']
                  3) area × metadata['service_charge_rate_per_sqft']
        """
        # 1. Billing profiles
        from_profiles = Decimal('0')
        for profile in lease.billing_profiles.all():
            try:
                if profile.is_active and 'service' in profile.billing_item.income_category.lower():
                    from_profiles += profile.amount
            except Exception:
                pass
        if from_profiles > 0:
            return from_profiles

        # 2. Explicit metadata value
        meta = lease.metadata or {}
        explicit = meta.get('monthly_service_charge_excl_vat') or meta.get('service_charge')
        if explicit:
            try:
                val = Decimal(str(explicit))
                if val > 0:
                    return val
            except Exception:
                pass

        # 3. Area × rate
        try:
            rate = Decimal(str(meta.get('service_charge_rate_per_sqft', '0') or '0'))
            area = Decimal(str(lease.unit.area or '0'))
            if rate > 0 and area > 0:
                return (area * rate).quantize(Decimal('0.01'))
        except Exception:
            pass

        return Decimal('0')

    def _complete_export(self, request, report_kind, response, start, end, output_format, row_count=0):
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
        from openpyxl.utils import get_column_letter

        organization = self._organization()
        property_record = get_active_property(request, organization)
        definition = ReportDefinition.objects.for_organization(organization).filter(key=report_kind, is_active=True).first()
        friendly = REPORT_TITLES.get(report_kind, report_kind.replace('-', ' ').title())
        filename = f'{report_kind}-{start:%Y%m%d}-{end:%Y%m%d}.{output_format}'
        content = response.content
        if output_format == 'xlsx':
            workbook = Workbook()
            sheet = workbook.active
            sheet.title = friendly[:31]
            decoded = content.decode('utf-8-sig')
            parsed_rows = list(csv.reader(StringIO(decoded)))
            header_fill = PatternFill('solid', fgColor='17243B')
            header_font = Font(color='FFFFFF', bold=True, name='Calibri', size=11)
            body_font = Font(name='Calibri', size=10)
            zebra = PatternFill('solid', fgColor='F4F7FA')
            thin = Border(
                left=Side(style='thin', color='DBE3EC'),
                right=Side(style='thin', color='DBE3EC'),
                top=Side(style='thin', color='DBE3EC'),
                bottom=Side(style='thin', color='DBE3EC'),
            )
            sheet['A1'] = friendly
            sheet['A1'].font = Font(name='Calibri', size=14, bold=True, color='17243B')
            sheet['A2'] = f"{property_record.name if property_record else 'Portfolio'} · {start:%d %b %Y} — {end:%d %b %Y}"
            sheet['A2'].font = Font(name='Calibri', size=10, color='64748B')
            sheet['A3'] = f"Prepared by {request.user.get_full_name() or request.user.get_username()} · Generated {timezone.localtime():%d %b %Y %H:%M}"
            sheet['A3'].font = Font(name='Calibri', size=9, color='64748B')
            start_row = 5
            headers = parsed_rows[0] if parsed_rows else []
            money_headers = {
                index for index, header in enumerate(headers)
                if any(token in str(header).lower() for token in (
                    'amount', 'rent', 'balance', 'billed', 'collected', 'outstanding', 'vat', 'tax',
                    'total', 'cost', 'fee', 'income', 'expense', 'subtotal', 'variance', 'budget', 'paid', 'net', 'charge',
                )) and 'rate' not in str(header).lower()
            }
            # Per-column type classification for smart formatting
            PERCENT_TOKENS = ('escalation %', 'escalation_percent', 'occupancy', 'rate', 'ratio', 'vat %', 'tax %', '% ')
            DATE_TOKENS = ('date', 'start', 'end', '_on', 'since', 'expiry', 'generated')
            percent_headers = {
                index for index, h in enumerate(headers)
                if any(t in str(h).lower() for t in PERCENT_TOKENS)
            }
            date_headers = {
                index for index, h in enumerate(headers)
                if any(t in str(h).lower() for t in DATE_TOKENS) and index not in money_headers
            }
            narrow_headers = {
                index for index, h in enumerate(headers)
                if any(t in str(h).lower() for t in ('floor', 'use', 'status', 'unit', 'type', 'interval'))
            }

            # Column width hints per report type (header label -> width)
            REPORT_WIDTHS = {
                'tenancy-schedule': {
                    'Floor': 7, 'Unit': 12, 'Tenant': 32, 'Property': 22,
                    'Area': 10, 'Use': 12, 'Lease Start': 13, 'Lease End': 13,
                    'Rent': 16, 'Service Charge': 16, 'Escalation %': 13,
                    'Escalation Interval (Months)': 14, 'Next Effective Rent': 18,
                },
                'income-analysis': {
                    'Property': 24, 'Unit': 12, 'Tenant': 32, 'Use': 12,
                    'Current rent': 16, 'Service charge': 16, 'Annualized income': 18,
                    'Escalation %': 13, 'Projected rent': 16, 'Lease status': 12,
                },
            }
            col_widths = REPORT_WIDTHS.get(report_kind, {})

            for row_index, csv_row in enumerate(parsed_rows, start=start_row):
                is_header = row_index == start_row
                sheet.row_dimensions[row_index].height = 20 if is_header else 16
                for col_index, value in enumerate(csv_row, start=1):
                    zero_idx = col_index - 1
                    cell = sheet.cell(row=row_index, column=col_index, value=value)
                    cell.font = header_font if is_header else body_font
                    cell.border = thin
                    if is_header:
                        cell.fill = header_fill
                        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
                    else:
                        if (row_index - start_row) % 2 == 0:
                            cell.fill = zebra
                        cell.alignment = Alignment(vertical='center')
                        if zero_idx in money_headers and value not in (None, '', '—'):
                            try:
                                cell.value = Decimal(str(value).replace(',', '').replace('KES', '').strip())
                                cell.number_format = '#,##0.00'
                                cell.alignment = Alignment(horizontal='right', vertical='center')
                            except Exception:
                                pass
                        elif zero_idx in percent_headers and value not in (None, '', '—'):
                            try:
                                cell.value = float(str(value).replace('%', '').strip())
                                cell.number_format = '0.00"%"'
                                cell.alignment = Alignment(horizontal='right', vertical='center')
                            except Exception:
                                pass
                        elif zero_idx in date_headers and value not in (None, '', '—'):
                            try:
                                from datetime import date as dt_date
                                if not isinstance(cell.value, dt_date):
                                    import datetime
                                    cell.value = datetime.date.fromisoformat(str(value))
                                cell.number_format = 'DD-MMM-YYYY'
                                cell.alignment = Alignment(horizontal='center', vertical='center')
                            except Exception:
                                pass
                        elif zero_idx in narrow_headers:
                            cell.alignment = Alignment(horizontal='center', vertical='center')

            if parsed_rows:
                for col_index in range(1, len(parsed_rows[0]) + 1):
                    letter = get_column_letter(col_index)
                    header_label = str(parsed_rows[0][col_index - 1]) if col_index - 1 < len(parsed_rows[0]) else ''
                    # Use explicit hint if available, else auto-size from content
                    if header_label in col_widths:
                        width = col_widths[header_label]
                    else:
                        samples = [header_label]
                        samples.extend(str(row[col_index - 1]) for row in parsed_rows[1:40] if col_index - 1 < len(row))
                        width = min(max(max(len(s) for s in samples if s), 8) + 3, 45)
                    sheet.column_dimensions[letter].width = width

                # Add totals row for money columns if tenancy-schedule
                if report_kind in ('tenancy-schedule', 'income-analysis') and len(parsed_rows) > 1:
                    total_row = start_row + len(parsed_rows)
                    sheet.row_dimensions[total_row].height = 18
                    totals_fill = PatternFill('solid', fgColor='17243B')
                    totals_font = Font(color='FFFFFF', bold=True, name='Calibri', size=10)
                    for col_index in range(1, len(parsed_rows[0]) + 1):
                        zero_idx = col_index - 1
                        cell = sheet.cell(row=total_row, column=col_index)
                        cell.fill = totals_fill
                        cell.border = thin
                        cell.font = totals_font
                        if zero_idx in money_headers and len(parsed_rows) > 1:
                            data_start = start_row + 1
                            data_end = start_row + len(parsed_rows) - 1
                            col_letter = get_column_letter(col_index)
                            cell.value = f'=SUM({col_letter}{data_start}:{col_letter}{data_end})'
                            cell.number_format = '#,##0.00'
                            cell.alignment = Alignment(horizontal='right', vertical='center')
                        elif zero_idx == 0:
                            cell.value = 'TOTALS'
                            cell.alignment = Alignment(horizontal='left', vertical='center')

                sheet.auto_filter.ref = f"A{start_row}:{get_column_letter(len(parsed_rows[0]))}{start_row + len(parsed_rows) - 1}"
                sheet.freeze_panes = f'A{start_row + 1}'
            row_count = max(len(parsed_rows) - 1, 0)
            buffer = BytesIO(); workbook.save(buffer); content = buffer.getvalue()
            response = HttpResponse(content, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
        execution = ReportExecution.objects.create(
            organization=organization, definition=definition, report_key=report_kind,
            property=property_record, period_start=start, period_end=end,
            filters={key: request.query_params.getlist(key) if len(request.query_params.getlist(key)) > 1 else request.query_params.get(key) for key in request.query_params if key not in ('output',)},
            output_format=output_format, status=ReportExecution.Status.COMPLETED,
            generated_by=request.user, generated_at=timezone.now(), row_count=row_count,
        )
        execution.file.save(filename, ContentFile(content), save=True)
        response['X-Report-Execution-ID'] = str(execution.id)
        response['X-Report-Generated-At'] = execution.generated_at.isoformat()
        response['X-Report-Title'] = friendly
        return response

    @extend_schema(request=None, responses={200: {'type': 'object'}})
    @action(detail=False, methods=('get',), url_path='tenancy-occupancy')
    def tenancy_occupancy(self, request):
        """Live, property-scoped tenancy and occupancy reporting dataset."""
        organization = self._organization()
        today = timezone.localdate()
        try:
            start = date.fromisoformat(request.query_params.get('start', (today - timedelta(days=365)).isoformat()))
            end = date.fromisoformat(request.query_params.get('end', today.isoformat()))
        except ValueError:
            raise ValidationError({'period': 'Use ISO dates in YYYY-MM-DD format.'})
        if start > end:
            raise ValidationError({'period': 'Start date cannot be after end date.'})

        units = scope_model_queryset(Unit, request, organization).select_related('property', 'building')
        leases = scope_model_queryset(Lease, request, organization).select_related('tenant', 'unit__property')
        unit_type = request.query_params.get('unit_type', '').strip()
        unit_status = request.query_params.get('unit_status', '').strip()
        lease_status = request.query_params.get('lease_status', '').strip()
        if unit_type:
            units = units.filter(unit_type=unit_type); leases = leases.filter(unit__unit_type=unit_type)
        if unit_status:
            units = units.filter(status=unit_status); leases = leases.filter(unit__status=unit_status)
        if lease_status:
            leases = leases.filter(status=lease_status)

        active_statuses = (lease_status,) if lease_status else (Lease.Status.ACTIVE, Lease.Status.EXPIRING, Lease.Status.DRAFT)
        active_leases = leases.filter(
            status__in=active_statuses, starts_on__lte=end, ends_on__gte=start,
        ).prefetch_related('billing_profiles__billing_item', 'escalations')
        occupied = units.filter(status=Unit.Status.OCCUPIED).count()
        total_units = units.count(); vacant = units.filter(status=Unit.Status.AVAILABLE).count()
        current_income = sum((lease.effective_rent(today) for lease in active_leases), Decimal('0'))
        projected_income = sum((lease.effective_rent(min(lease.ends_on - timedelta(days=1), today + timedelta(days=90))) for lease in active_leases), Decimal('0'))
        overdue = scope_model_queryset(Invoice, request, organization).filter(
            balance__gt=0, due_on__lt=today,
        ).exclude(status__in=(Invoice.Status.PAID, Invoice.Status.VOID))

        schedule = [{
            'lease': lease.reference, 'tenant': lease.tenant.name, 'property': lease.unit.property.name,
            'floor': lease.unit.floor, 'unit': lease.unit.code, 'unit_type': lease.unit.unit_type,
            'use': lease.unit.metadata.get('use', lease.unit.unit_type),
            'area': lease.unit.area, 'monthly_rent': lease.effective_rent(today),
            'service_charge': self._service_charge_for_lease(lease),
            'escalation_percent': lease.escalation_percent,
            'escalation_interval_months': lease.escalation_interval_months,
            'next_effective_rent': lease.effective_rent(min(lease.ends_on - timedelta(days=1), today + timedelta(days=365))),
            'lease_start': lease.starts_on, 'lease_end': lease.ends_on,
        } for lease in active_leases.order_by('unit__code')]

        vacant_rows = []
        histories = scope_model_queryset(UnitStatusHistory, request, organization).filter(
            unit__in=units, status=Unit.Status.AVAILABLE,
        ).select_related('unit__property').order_by('unit_id', '-effective_from')
        latest_vacancy = {}
        for history in histories:
            latest_vacancy.setdefault(history.unit_id, history)
        for unit in units.filter(status=Unit.Status.AVAILABLE):
            history = latest_vacancy.get(unit.id)
            available_since = history.effective_from if history else None
            vacant_rows.append({
                'property': unit.property.name, 'unit': unit.code, 'unit_type': unit.unit_type,
                'area': unit.area, 'available_since': available_since,
                'days_vacant': (today - available_since).days if available_since else None,
                'expected_rent': history.expected_monthly_rent if history else Decimal('0'),
                'marketing_status': history.marketing_status if history else '',
            })

        movements = scope_model_queryset(TenantMovement, request, organization).filter(
            effective_on__range=(start, end),
        ).select_related('tenant', 'unit__property').order_by('-effective_on')
        movement_rows = [{
            'kind': row.kind, 'date': row.effective_on, 'tenant': row.tenant.name,
            'property': row.unit.property.name, 'unit': row.unit.code, 'reason': row.reason,
        } for row in movements]
        expiries = [{
            'lease': lease.reference, 'tenant': lease.tenant.name, 'property': lease.unit.property.name,
            'unit': lease.unit.code, 'ends_on': lease.ends_on,
            'days_remaining': (lease.ends_on - today).days, 'monthly_rent': lease.effective_rent(today),
        } for lease in active_leases.filter(ends_on__lte=today + timedelta(days=365)).order_by('ends_on')]

        distribution = list(units.values('status').annotate(count=Count('id')).order_by('status'))
        return Response({
            'period': {'start': start, 'end': end},
            'kpis': {
                'total_units': total_units, 'occupied_units': occupied, 'vacant_units': vacant,
                'occupancy_rate': round(occupied / total_units * 100, 1) if total_units else 0,
                'vacancy_rate': round(vacant / total_units * 100, 1) if total_units else 0,
                'current_monthly_income': current_income, 'projected_monthly_income_90_days': projected_income,
                'overdue_tenants': overdue.values('lease__tenant').distinct().count(),
                'overdue_amount': overdue.aggregate(total=Sum('balance'))['total'] or Decimal('0'),
            },
            'unit_status_distribution': distribution, 'tenancy_schedule': schedule,
            'vacant_units': vacant_rows, 'movements': movement_rows, 'lease_expiry': expiries,
            'filter_options': {
                'unit_types': list(scope_model_queryset(Unit, request, organization).exclude(unit_type='').values_list('unit_type', flat=True).distinct()),
                'unit_statuses': list(Unit.Status.values), 'lease_statuses': list(Lease.Status.values),
            },
        })

    @extend_schema(request=None, responses={200: {'type': 'object'}})
    @action(detail=False, methods=('get',))
    def aging(self, request):
        today = timezone.localdate()
        organization = self._organization()
        invoices = scope_model_queryset(Invoice, request, organization).exclude(
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

    @extend_schema(request=None, responses={200: {'type': 'object'}})
    @action(detail=False, methods=('get',), url_path='income-expenses')
    def income_expenses(self, request):
        organization = self._organization()
        today = timezone.localdate()
        year_start = today.replace(month=1, day=1)
        receipts = scope_model_queryset(Receipt, request, organization).filter(received_on__gte=year_start)
        expenses = scope_model_queryset(Expense, request, organization).filter(
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

    @extend_schema(request=None, responses={200: {'type': 'object'}})
    @action(detail=False, methods=('get',), url_path='financial-reports')
    def financial_reports(self, request):
        """Reconciled financial reporting dataset derived from transaction ledgers."""
        organization = self._organization(); today = timezone.localdate()
        try:
            start = date.fromisoformat(request.query_params.get('start', today.replace(day=1).isoformat()))
            end = date.fromisoformat(request.query_params.get('end', today.isoformat()))
        except ValueError:
            raise ValidationError({'period': 'Use ISO dates in YYYY-MM-DD format.'})
        if start > end:
            raise ValidationError({'period': 'Start date cannot be after end date.'})

        invoices = scope_model_queryset(Invoice, request, organization).filter(
            issued_on__range=(start, end),
        ).exclude(status=Invoice.Status.VOID).select_related('lease__tenant', 'lease__unit__property').prefetch_related('lines')
        receipts = scope_model_queryset(Receipt, request, organization).filter(
            received_on__range=(start, end),
        ).select_related('tenant', 'invoice__lease__unit__property')
        expenses = scope_model_queryset(Expense, request, organization).filter(
            incurred_on__range=(start, end), status__in=(Expense.Status.APPROVED, Expense.Status.PAID),
        ).select_related('property')
        budgets = scope_model_queryset(Budget, request, organization).filter(
            year__range=(start.year, end.year), status=Budget.Status.APPROVED,
        ).select_related('property')
        billed = invoices.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        collected = receipts.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        expense_total = expenses.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        open_invoices = scope_model_queryset(Invoice, request, organization).filter(
            balance__gt=0, due_on__lte=end,
        ).exclude(status__in=(Invoice.Status.PAID, Invoice.Status.VOID)).select_related('lease__tenant', 'lease__unit__property')
        arrears = open_invoices.aggregate(total=Sum('balance'))['total'] or Decimal('0')

        aging = {key: Decimal('0') for key in ('current', '31_60', '61_90', '90_plus')}
        arrears_rows = []
        for invoice in open_invoices:
            days = max((end - invoice.due_on).days, 0)
            bucket = 'current' if days <= 30 else '31_60' if days <= 60 else '61_90' if days <= 90 else '90_plus'
            aging[bucket] += invoice.balance
            last_payment = invoice.receipts.order_by('-received_on').values_list('received_on', flat=True).first()
            arrears_rows.append({
                'invoice': invoice.number, 'tenant': invoice.lease.tenant.name,
                'property': invoice.lease.unit.property.name, 'unit': invoice.lease.unit.code,
                'billed': invoice.amount, 'paid': invoice.amount - invoice.balance, 'balance': invoice.balance,
                'due_on': invoice.due_on, 'days_overdue': days, 'ageing_bucket': bucket,
                'last_payment': last_payment, 'status': invoice.status,
            })

        billing_rows = []
        output_vat = Decimal('0'); income_categories = {}
        for invoice in invoices:
            collected_for_invoice = invoice.receipts.filter(received_on__range=(start, end)).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            lines = list(invoice.lines.all()); output_vat += invoice.tax_amount
            for line in lines:
                code = line.billing_item.income_category if line.billing_item_id and line.billing_item.income_category else line.description
                income_categories[code] = income_categories.get(code, Decimal('0')) + line.subtotal
            billing_rows.append({
                'invoice': invoice.number, 'tenant': invoice.lease.tenant.name,
                'property': invoice.lease.unit.property.name, 'unit': invoice.lease.unit.code,
                'billing_period': invoice.metadata.get('billing_period', ''), 'issued_on': invoice.issued_on,
                'due_on': invoice.due_on, 'subtotal': invoice.subtotal, 'vat': invoice.tax_amount,
                'total_billed': invoice.amount, 'collected': collected_for_invoice,
                'outstanding': invoice.balance, 'status': invoice.status,
            })

        expense_categories = list(expenses.values('category').annotate(total=Sum('amount')).order_by('-total'))
        input_vat = expenses.aggregate(total=Sum('tax_amount'))['total'] or Decimal('0')
        vat_rows = [{'type': 'output', 'date': row.issued_on, 'reference': row.number,
                     'party': row.lease.tenant.name, 'property': row.lease.unit.property.name,
                     'taxable_value': row.subtotal, 'tax_amount': row.tax_amount}
                    for row in invoices.filter(tax_amount__gt=0)]
        vat_rows += [{'type': 'input', 'date': row.incurred_on, 'reference': row.invoice_number,
                      'party': row.supplier, 'property': row.property.name,
                      'taxable_value': row.taxable_amount, 'tax_amount': row.tax_amount}
                     for row in expenses.filter(tax_amount__gt=0)]
        expense_rows = [{'date': row.incurred_on, 'supplier': row.supplier, 'property': row.property.name,
                         'category': row.category, 'description': row.description, 'reference': row.invoice_number,
                         'net': row.taxable_amount or row.amount - row.tax_amount, 'vat': row.tax_amount,
                         'total': row.amount, 'status': row.status, 'budget_code': row.budget_code,
                         'cost_centre': row.cost_centre} for row in expenses]

        budget_rows = []
        for budget in budgets:
            actual = expenses.filter(property=budget.property, category=budget.category).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            approved = budget.revised_amount if budget.revised_amount is not None else budget.amount
            variance = actual - approved
            budget_rows.append({'property': budget.property.name, 'year': budget.year, 'category': budget.category,
                                'version': budget.version, 'approved': approved, 'actual': actual,
                                'variance': variance, 'variance_percent': (variance / approved * 100).quantize(Decimal('0.1')) if approved else Decimal('0'),
                                'forecast': budget.forecast_amount})

        service_charge_rows = []
        for scheme in scope_model_queryset(ServiceCharge, request, organization).filter(starts_on__lte=end).select_related('property'):
            sc_lines = InvoiceLine.objects.for_organization(organization).filter(
                invoice__in=invoices,
            ).filter(Q(billing_item__income_category__icontains='service') | Q(description__icontains='service charge'))
            sc_billed = sc_lines.aggregate(total=Sum('total'))['total'] or Decimal('0')
            sc_expenses = expenses.filter(Q(category__icontains='service') | Q(cost_centre__icontains='service')).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            service_charge_rows.append({'property': scheme.property.name, 'scheme': scheme.name,
                                        'budget': scheme.annual_budget, 'billed': sc_billed,
                                        'actual_expenditure': sc_expenses, 'variance': scheme.annual_budget - sc_expenses,
                                        'utilization_rate': (sc_expenses / scheme.annual_budget * 100).quantize(Decimal('0.1')) if scheme.annual_budget else Decimal('0')})

        properties = scope_model_queryset(Property, request, organization)
        performance = []
        for prop in properties:
            prop_billed = invoices.filter(lease__unit__property=prop).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            prop_collected = receipts.filter(Q(invoice__lease__unit__property=prop) | Q(invoice__isnull=True, tenant__property=prop)).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            performance.append({'property': prop.name, 'billed': prop_billed, 'collected': prop_collected,
                                'outstanding': max(prop_billed - prop_collected, Decimal('0')),
                                'collection_rate': (prop_collected / prop_billed * 100).quantize(Decimal('0.1')) if prop_billed else Decimal('0')})
        performance.sort(key=lambda row: row['collection_rate'], reverse=True)

        return Response({
            'period': {'start': start, 'end': end},
            'kpis': {'total_billed': billed, 'total_collected': collected,
                     'collection_rate': (collected / billed * 100).quantize(Decimal('0.1')) if billed else Decimal('0'),
                     'total_arrears': arrears, 'total_expenses': expense_total, 'net_income': collected - expense_total},
            'collection_performance': performance, 'arrears_ageing': aging,
            'income_summary': [{'category': key, 'total': value} for key, value in income_categories.items()],
            'expense_summary': expense_categories, 'billing_collection': billing_rows, 'arrears': arrears_rows,
            'vat': {'output_vat': output_vat, 'input_vat': input_vat, 'net_vat': output_vat - input_vat, 'transactions': vat_rows},
            'expenses': expense_rows, 'budgets': budget_rows, 'service_charge': service_charge_rows,
        })

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        return Response({'reports': [
            {'key': 'tenant-payment-status', 'name': "Tenants Payment's Status Report", 'category': 'Financial', 'section': 'Critical reports', 'critical': True, 'description': 'Monthly tenant billings, receipts and balances carried forward.'},
            {'key': 'income-expense', 'name': 'Receipts & Expenditure Account', 'category': 'Financial', 'section': 'Critical reports', 'critical': True, 'description': 'Property income, disbursements and cumulative performance.'},
            {'key': 'outstanding-balances', 'name': 'Outstanding Balances', 'category': 'Financial', 'section': 'Critical reports', 'critical': True, 'description': 'Open tenant invoices and balances requiring collection.'},
            {'key': 'payment-reconciliation', 'name': 'Payment Reconciliation', 'category': 'Financial', 'section': 'Critical reports', 'critical': True, 'description': 'Bank transactions matched to official receipts.'},
            {'key': 'aging', 'name': 'Outstanding Aging', 'category': 'Financial', 'description': 'Arrears grouped by age and tenant.'},
            {'key': 'budget-actual', 'name': 'Budget versus actual', 'category': 'Financial'},
            {'key': 'service-charge', 'name': 'Service charge allocations', 'category': 'Financial'},
            {'key': 'daily-collections', 'name': 'Daily collections', 'category': 'Financial', 'section': 'Collections & reconciliation'},
            {'key': 'collections-property', 'name': 'Collections by property', 'category': 'Financial', 'section': 'Collections & reconciliation'},
            {'key': 'collections-tenant', 'name': 'Collections by tenant', 'category': 'Financial', 'section': 'Collections & reconciliation'},
            {'key': 'settlement', 'name': 'Settlement report', 'category': 'Financial', 'section': 'Collections & reconciliation'},
            {'key': 'management-fee', 'name': 'Management fee report', 'category': 'Financial', 'section': 'Collections & reconciliation'},
            {'key': 'occupancy', 'name': 'Portfolio occupancy', 'category': 'Tenants & Occupancy'},
            {'key': 'lease-expiry', 'name': 'Lease expiry', 'category': 'Tenants & Occupancy'},
            {'key': 'contractor-expiry', 'name': 'Service provider expiry', 'category': 'Service Providers'},
            {'key': 'work-order-spend', 'name': 'Work order spend', 'category': 'Service Providers'},
            {'key': 'tenant-compliance', 'name': 'Tenant document compliance', 'category': 'Compliance & Risk'},
            {'key': 'critical-dates', 'name': 'Critical dates register', 'category': 'Compliance & Risk'},
            {'key': 'stakeholder-directory', 'name': 'Master Contacts & Stakeholders Directory', 'category': 'Directory & Contacts', 'section': 'Operational directory', 'critical': True, 'description': 'Complete contacts register for all Tenants, Landlords, Service Providers/Contractors, Contact Persons, Phone, Email, and KRA PIN numbers.'},
        ]})

    @extend_schema(request=None, responses={200: {"type": "string", "format": "binary"}}, parameters=[OpenApiParameter("report_kind", OpenApiTypes.STR, OpenApiParameter.PATH)])
    @action(detail=False, methods=('get',), url_path=r'exports/(?P<report_kind>[^/.]+)')
    def export(self, request, report_kind=None):
        organization = self._organization()
        output_format = request.query_params.get('output', 'csv').lower()
        if output_format not in ('csv', 'xlsx', 'pdf'):
            raise ValidationError({'output': 'Output format must be csv, xlsx or pdf.'})
        output_pdf = output_format == 'pdf'
        today = timezone.localdate()
        try:
            start = date.fromisoformat(request.query_params.get('start', today.replace(day=1).isoformat()))
            end = date.fromisoformat(request.query_params.get('end', today.isoformat()))
        except ValueError:
            raise ValidationError({'period': 'Use ISO dates in YYYY-MM-DD format.'})
        if start > end:
            raise ValidationError({'period': 'Start date cannot be after end date.'})
        generated_by = request.user.get_full_name() or request.user.get_username()
        if output_pdf and report_kind in ('income-expense', 'tenant-payment-status', 'billing-schedule', 'aging'):
            property_record = get_active_property(request, organization)
            if report_kind in ('income-expense', 'tenant-payment-status', 'billing-schedule') and not property_record:
                raise ValidationError({'property': 'Select a property before generating this report.'})
            if report_kind in ('tenant-payment-status', 'billing-schedule'):
                response = tenant_payment_status_pdf(organization, property_record, start, end, generated_by)
            elif report_kind == 'income-expense':
                response = income_expenditure_pdf(organization, property_record, start, end, generated_by)
            else:
                financial = self.financial_reports(request).data
                response = arrears_aging_pdf(
                    organization,
                    property_record.name if property_record else 'Portfolio',
                    financial.get('arrears') or [],
                    financial.get('arrears_ageing') or {},
                    period=f'{start:%d %b %Y} — {end:%d %b %Y}',
                    generated_by=generated_by,
                )
            return self._complete_export(request, report_kind, response, start, end, output_format)
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="property-{report_kind}.csv"'
        writer = csv.writer(response)
        if report_kind in ('tenant-payment-status', 'billing-schedule'):
            property_record = get_active_property(request, organization)
            if not property_record:
                raise ValidationError({'property': 'Select a property before generating this report.'})
            writer.writerow(('Tenant', 'Unit / no.', 'Rent / month', 'Payment mode', 'Billings up to', 'Balance B/F', 'Current billings', 'Total billings', 'Receipts', 'Outstanding C/F'))
            for row in tenant_payment_status_rows(organization, property_record, start, end):
                writer.writerow((row['tenant'], row['unit'], row['rent'], row['payment_mode'], row['billed_to'], row['opening'], row['current'], row['total'], row['receipts'], row['closing']))
        elif report_kind == 'aging':
            writer.writerow(('Invoice', 'Tenant', 'Property', 'Unit', 'Due date', 'Balance', 'Days outstanding'))
            today = timezone.localdate()
            rows = scope_model_queryset(Invoice, request, organization).exclude(
                status__in=(Invoice.Status.PAID, Invoice.Status.VOID),
            ).filter(balance__gt=0).select_related('lease__tenant', 'lease__unit__property')
            for invoice in rows:
                writer.writerow((invoice.number, invoice.lease.tenant.name, invoice.lease.unit.property.name,
                                 invoice.lease.unit.code, invoice.due_on, invoice.balance,
                                 max((today - invoice.due_on).days, 0)))
        elif report_kind == 'income-expense':
            writer.writerow(('Type', 'Date', 'Property / tenant', 'Category / method', 'Reference', 'Amount'))
            for receipt in scope_model_queryset(Receipt, request, organization).filter(received_on__range=(start, end)).select_related('tenant'):
                writer.writerow(('Income', receipt.received_on, receipt.tenant.name, receipt.payment_method, receipt.number, receipt.amount))
            for expense in scope_model_queryset(Expense, request, organization).filter(incurred_on__range=(start, end)).select_related('property'):
                writer.writerow(('Expense', expense.incurred_on, expense.property.name, expense.category, expense.invoice_number, expense.amount))
        elif report_kind == 'expenses-schedule':
            writer.writerow(('Date', 'Supplier', 'Property', 'Category', 'Description', 'Reference', 'Net', 'VAT', 'Total', 'Status', 'Budget code', 'Cost centre'))
            rows = scope_model_queryset(Expense, request, organization).filter(incurred_on__range=(start, end)).select_related('property')
            for expense in rows:
                writer.writerow((expense.incurred_on, expense.supplier, expense.property.name, expense.category,
                                 expense.description, expense.invoice_number, expense.taxable_amount or expense.amount - expense.tax_amount,
                                 expense.tax_amount, expense.amount, expense.status, expense.budget_code, expense.cost_centre))
        elif report_kind == 'vat-schedule':
            writer.writerow(('Type', 'Date', 'Reference', 'Party', 'Property', 'Taxable value', 'VAT amount'))
            invoices = scope_model_queryset(Invoice, request, organization).filter(issued_on__range=(start, end), tax_amount__gt=0).exclude(status=Invoice.Status.VOID).select_related('lease__tenant', 'lease__unit__property')
            for invoice in invoices:
                writer.writerow(('Output VAT', invoice.issued_on, invoice.number, invoice.lease.tenant.name,
                                 invoice.lease.unit.property.name, invoice.subtotal, invoice.tax_amount))
            expenses = scope_model_queryset(Expense, request, organization).filter(incurred_on__range=(start, end), tax_amount__gt=0).select_related('property')
            for expense in expenses:
                writer.writerow(('Input VAT', expense.incurred_on, expense.invoice_number, expense.supplier,
                                 expense.property.name, expense.taxable_amount, expense.tax_amount))
        elif report_kind == 'occupancy':
            writer.writerow(('Property', 'Unit', 'Type', 'Area', 'Status'))
            for unit in scope_model_queryset(Unit, request, organization).select_related('property'):
                writer.writerow((unit.property.name, unit.code, unit.unit_type, unit.area or '', unit.status))
        elif report_kind == 'tenancy-schedule':
            writer.writerow(('Floor', 'Unit', 'Tenant', 'Property', 'Area', 'Use', 'Lease Start', 'Lease End', 'Rent', 'Service Charge', 'Escalation %', 'Escalation Interval (Months)', 'Next Effective Rent'))
            rows = scope_model_queryset(Lease, request, organization).filter(starts_on__lte=end, ends_on__gte=start).select_related('tenant', 'unit__property').prefetch_related('billing_profiles__billing_item')
            for lease in rows:
                service_charge = self._service_charge_for_lease(lease)
                writer.writerow((lease.unit.floor, lease.unit.code, lease.tenant.name, lease.unit.property.name,
                                 lease.unit.area or '', lease.unit.metadata.get('use', lease.unit.unit_type), lease.starts_on,
                                 lease.ends_on, lease.effective_rent(end), service_charge, lease.escalation_percent,
                                 lease.escalation_interval_months, lease.effective_rent(min(lease.ends_on - timedelta(days=1), end + timedelta(days=365)))))
        elif report_kind == 'vacancy':
            writer.writerow(('Property', 'Unit', 'Type', 'Use', 'Area', 'Available since', 'Days vacant', 'Expected rent', 'Vacancy reason', 'Marketing status'))
            units = scope_model_queryset(Unit, request, organization).filter(status=Unit.Status.AVAILABLE).select_related('property')
            for unit in units:
                history = unit.status_history.filter(status=Unit.Status.AVAILABLE, effective_from__lte=end).order_by('-effective_from').first()
                available_since = history.effective_from if history else None
                writer.writerow((unit.property.name, unit.code, unit.unit_type, unit.metadata.get('use', unit.unit_type),
                                 unit.area or '', available_since or '', (end - available_since).days if available_since else '',
                                 history.expected_monthly_rent if history else 0, history.reason if history else '',
                                 history.marketing_status if history else ''))
        elif report_kind == 'movements':
            writer.writerow(('Movement', 'Date', 'Tenant', 'Property', 'Unit', 'Rent', 'Reason'))
            rows = scope_model_queryset(TenantMovement, request, organization).filter(effective_on__range=(start, end)).select_related('tenant', 'unit__property', 'lease')
            for movement in rows:
                writer.writerow((movement.kind, movement.effective_on, movement.tenant.name, movement.unit.property.name,
                                 movement.unit.code, movement.lease.effective_rent(movement.effective_on), movement.reason))
        elif report_kind == 'income-analysis':
            writer.writerow(('Property', 'Unit', 'Tenant', 'Use', 'Current rent', 'Service charge', 'Annualized income', 'Escalation %', 'Projected rent', 'Lease status'))
            rows = scope_model_queryset(Lease, request, organization).filter(status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING), starts_on__lte=end, ends_on__gte=start).select_related('tenant', 'unit__property').prefetch_related('billing_profiles__billing_item')
            for lease in rows:
                current_rent = lease.effective_rent(end)
                service_charge = self._service_charge_for_lease(lease)
                writer.writerow((lease.unit.property.name, lease.unit.code, lease.tenant.name,
                                 lease.unit.metadata.get('use', lease.unit.unit_type), current_rent, service_charge,
                                 (current_rent + service_charge) * 12, lease.escalation_percent,
                                 lease.effective_rent(min(lease.ends_on - timedelta(days=1), end + timedelta(days=365))), lease.status))
        elif report_kind == 'lease-expiry':
            writer.writerow(('Lease', 'Tenant', 'Property', 'Unit', 'End date', 'Status', 'Monthly rent'))
            for lease in scope_model_queryset(Lease, request, organization).select_related('tenant', 'unit__property'):
                writer.writerow((lease.reference, lease.tenant.name, lease.unit.property.name, lease.unit.code,
                                 lease.ends_on, lease.status, lease.monthly_rent))
        elif report_kind == 'budget-actual':
            writer.writerow(('Property', 'Year', 'Category', 'Budget', 'Actual', 'Variance', 'Status'))
            budgets = BudgetViewSet.actual_expenses
            rows = scope_model_queryset(Budget, request, organization).select_related('property').annotate(
                actual_amount=Coalesce(Subquery(budgets), Value(Decimal('0')), output_field=DecimalField()),
            ).annotate(variance=F('amount') - F('actual_amount'))
            for budget in rows:
                writer.writerow((budget.property.name, budget.year, budget.category, budget.amount,
                                 budget.actual_amount, budget.variance, budget.status))
        elif report_kind == 'service-charge':
            writer.writerow(('Scheme', 'Property', 'Unit', 'Ratio', 'Annual amount', 'Monthly amount'))
            rows = scope_model_queryset(ServiceChargeAllocation, request, organization).select_related('service_charge__property', 'unit')
            for allocation in rows:
                writer.writerow((allocation.service_charge.name, allocation.service_charge.property.name,
                                 allocation.unit.code, allocation.ratio, allocation.annual_amount,
                                 allocation.monthly_amount))
        elif report_kind == 'daily-collections':
            writer.writerow(('Date', 'Receipt', 'Tenant', 'Property', 'Invoice', 'Method', 'External reference', 'Amount'))
            rows = scope_model_queryset(Receipt, request, organization).select_related('tenant__property', 'invoice__lease__unit__property')
            for row in rows:
                prop = row.invoice.lease.unit.property if row.invoice else row.tenant.property
                writer.writerow((row.received_on, row.number, row.tenant.name, prop.name if prop else '', row.invoice.number if row.invoice else '', row.payment_method, row.external_reference, row.amount))
        elif report_kind == 'collections-property':
            writer.writerow(('Property', 'Receipt count', 'Total collected'))
            totals = {}
            for row in scope_model_queryset(Receipt, request, organization).select_related('tenant__property', 'invoice__lease__unit__property'):
                prop = row.invoice.lease.unit.property if row.invoice else row.tenant.property
                key = prop.name if prop else 'Unassigned'; current = totals.setdefault(key, [0, Decimal('0')]); current[0] += 1; current[1] += row.amount
            for name, (count, total) in sorted(totals.items()): writer.writerow((name, count, total))
        elif report_kind == 'collections-tenant':
            writer.writerow(('Tenant', 'Tenant no.', 'Property', 'Receipt count', 'Total collected'))
            rows = scope_model_queryset(Receipt, request, organization).values('tenant__name', 'tenant__code', 'tenant__property__name').annotate(count=Count('id'), total=Sum('amount')).order_by('tenant__name')
            for row in rows: writer.writerow((row['tenant__name'], row['tenant__code'], row['tenant__property__name'] or '', row['count'], row['total']))
        elif report_kind == 'outstanding-balances':
            writer.writerow(('Tenant', 'Tenant no.', 'Property', 'Unit', 'Invoice', 'Due date', 'Original amount', 'Balance', 'Status'))
            rows = scope_model_queryset(Invoice, request, organization).filter(balance__gt=0).exclude(status=Invoice.Status.VOID).select_related('lease__tenant', 'lease__unit__property')
            for row in rows: writer.writerow((row.lease.tenant.name, row.lease.tenant.code, row.lease.unit.property.name, row.lease.unit.code, row.number, row.due_on, row.amount, row.balance, row.status))
        elif report_kind in ('payment-reconciliation', 'settlement'):
            writer.writerow(('Transaction date', 'Bank reference', 'Description', 'Amount', 'Status', 'Receipt', 'Matched at'))
            rows = scope_model_queryset(BankTransaction, request, organization).select_related('receipt')
            if report_kind == 'settlement': rows = rows.filter(status=BankTransaction.Status.MATCHED)
            for row in rows: writer.writerow((row.transacted_on, row.reference, row.description, row.amount, row.status, row.receipt.number if row.receipt else '', row.matched_at or ''))
        elif report_kind == 'management-fee':
            writer.writerow(('Property', 'Date', 'Supplier / payee', 'Invoice', 'Description', 'Amount', 'Status'))
            rows = scope_model_queryset(Expense, request, organization).filter(category__icontains='management').select_related('property')
            for row in rows: writer.writerow((row.property.name, row.incurred_on, row.supplier, row.invoice_number, row.description, row.amount, row.status))
        elif report_kind == 'contractor-expiry':
            from facilities.models import Contractor
            writer.writerow(('Provider', 'Specialty', 'Status', 'Insurance expiry', 'License expiry', 'Contact'))
            for contractor in Contractor.objects.for_organization(organization):
                writer.writerow((contractor.name, contractor.specialty, contractor.status,
                                 contractor.insurance_expires_on or '', contractor.license_expires_on or '',
                                 contractor.contact_name))
        elif report_kind == 'work-order-spend':
            from facilities.models import WorkOrder
            writer.writerow(('Work order', 'Property', 'Contractor', 'Status', 'Labor', 'Parts', 'Other', 'Total'))
            for order in scope_model_queryset(WorkOrder, request, organization).select_related('property', 'contractor'):
                total = order.labor_cost + order.parts_cost + order.other_cost
                writer.writerow((order.number, order.property.name, order.contractor.name if order.contractor else '',
                                 order.status, order.labor_cost, order.parts_cost, order.other_cost, total))
        elif report_kind == 'tenant-compliance':
            writer.writerow(('Tenant', 'Document type', 'Document number', 'Status', 'Issued', 'Expires'))
            for document in scope_model_queryset(TenantDocument, request, organization).select_related('tenant'):
                writer.writerow((document.tenant.name, document.document_type, document.document_number,
                                 document.status, document.issued_on or '', document.expires_on or ''))
        elif report_kind == 'critical-dates':
            from facilities.models import Contractor
            writer.writerow(('Type', 'Reference', 'Party / Property', 'Date', 'Status'))
            for lease in scope_model_queryset(Lease, request, organization).select_related('tenant', 'unit__property'):
                writer.writerow(('Lease expiry', lease.reference, f'{lease.tenant.name} / {lease.unit.property.name}', lease.ends_on, lease.status))
            for document in scope_model_queryset(TenantDocument, request, organization).exclude(expires_on=None).select_related('tenant'):
                writer.writerow(('Tenant document', document.document_number or document.document_type,
                                 document.tenant.name, document.expires_on, document.status))
            for contractor in Contractor.objects.for_organization(organization):
                if contractor.insurance_expires_on:
                    writer.writerow(('Provider insurance', contractor.code, contractor.name,
                                     contractor.insurance_expires_on, contractor.status))
                if contractor.license_expires_on:
                    writer.writerow(('Provider license', contractor.code, contractor.name,
                                     contractor.license_expires_on, contractor.status))
        elif report_kind == 'stakeholder-directory':
            from facilities.models import Contractor
            writer.writerow(('Category', 'Property / Site', 'Entity Name', 'Contact Person / Rep', 'Phone', 'Email', 'KRA PIN / Tax ID', 'Status / Ref'))
            # 1. Tenants
            for t in scope_model_queryset(Tenant, request, organization).select_related('property'):
                contact_p = ""
                if t.directors and isinstance(t.directors, list) and len(t.directors) > 0:
                    d0 = t.directors[0]
                    contact_p = d0.get('name') if isinstance(d0, dict) else str(d0)
                prop_name = t.property.name if t.property else "Portfolio-wide"
                writer.writerow(('Tenant', prop_name, t.name, contact_p or t.name, t.phone or '', t.email or '', t.tax_id or '', f"{t.status.title()} ({t.code})"))
            # 2. Service Providers / Contractors
            for c in Contractor.objects.for_organization(organization):
                writer.writerow(('Service Provider', 'Portfolio-wide', c.name, c.contact_name or c.name, c.phone or '', c.email or '', getattr(c, 'tax_pin', '') or '', f"{c.specialty} ({c.status})"))
            # 3. Landlords / Property Owners
            for p in scope_model_queryset(Property, request, organization):
                meta = p.metadata or {}
                landlord = meta.get('landlord') or {}
                if isinstance(landlord, dict) and landlord.get('name'):
                    writer.writerow(('Landlord / Owner', p.name, landlord.get('name', ''), landlord.get('contact_person') or landlord.get('name', ''), landlord.get('phone', ''), landlord.get('email', ''), landlord.get('pin', '') or landlord.get('tax_id', ''), f"Owner ({p.code})"))
                else:
                    writer.writerow(('Landlord / Owner', p.name, f"{p.name} Ownership", 'Property Owner', '', '', '', f"Owner ({p.code})"))
        else:
            raise ValidationError({'report': 'Unknown property report.'})
        if output_pdf:
            title = REPORT_TITLES.get(report_kind, str(report_kind).replace('-', ' ').title())
            property_record = get_active_property(request, organization)
            period = f'{start:%d %b %Y} — {end:%d %b %Y}'
            response = tabular_report_pdf(
                organization, title, f'{report_kind}.pdf', response.content,
                property_name=property_record.name if property_record else 'Portfolio', period=period,
                generated_by=generated_by,
                subtitle='Authoritative ledger extract',
            )
            return self._complete_export(request, report_kind, response, start, end, output_format)
        row_count = max(response.content.count(b'\n') - 1, 0)
        return self._complete_export(request, report_kind, response, start, end, output_format, row_count=row_count)


class TenantPortalViewSet(ViewSet):
    permission_classes = (HasModuleSubscription,)
    required_module = Module.PROPERTY

    serializer_class = GenericObjectSerializer

    def _access(self, tenant_id=None):
        organization = get_active_organization(self.request)
        membership = get_active_membership(self.request, organization)
        can_support = (
            self.request.user.is_staff or self.request.user.is_superuser
            or bool(membership and (
                membership.is_organization_admin
                or membership.has_permission('property.leasing')
                or membership.has_permission('property.view')
            ))
        )
        if tenant_id:
            if not can_support:
                raise PermissionDenied('Tenant portal support view requires property leasing permission.')
            tenant = Tenant.objects.for_organization(organization).filter(pk=tenant_id).first()
            if tenant:
                class ScopedAccess:
                    def __init__(self, org, t):
                        self.organization = org
                        self.tenant = t
                return ScopedAccess(organization, tenant)
            raise PermissionDenied('Specified tenant was not found in active organization.')
        access = TenantPortalAccess.objects.for_organization(organization).filter(
            user=self.request.user, is_active=True,
        ).select_related('tenant').first()
        if not access:
            raise PermissionDenied('No active tenant portal profile is linked to this account.')
        return access

    def _selected_payment_invoices(self, access):
        raw_ids = self.request.data.get('invoices') or [self.request.data.get('invoice')]
        if not isinstance(raw_ids, list):
            raise ValidationError({'invoices': 'Select one or more invoices.'})
        invoice_ids = list(dict.fromkeys(str(value) for value in raw_ids if value))
        if not invoice_ids:
            raise ValidationError({'invoices': 'Select one or more invoices.'})
        invoices = list(Invoice.objects.for_organization(access.organization).select_related(
            'lease__unit__property', 'lease__tenant',
        ).filter(pk__in=invoice_ids, lease__tenant=access.tenant).order_by('issued_on', 'number'))
        if len(invoices) != len(invoice_ids):
            raise ValidationError({'invoices': 'One or more selected invoices are not available in your account.'})
        property_ids = {invoice.lease.unit.property_id for invoice in invoices}
        if len(property_ids) != 1:
            raise ValidationError({'invoices': 'A combined payment can only include invoices from the same property.'})
        allowed = (Invoice.Status.ISSUED, Invoice.Status.PARTIAL, Invoice.Status.OVERDUE)
        invalid = [invoice.number for invoice in invoices if invoice.status not in allowed or invoice.balance <= 0]
        if invalid:
            raise ValidationError({'invoices': f'Only outstanding issued invoices can be paid: {", ".join(invalid)}.'})
        return invoices

    @action(detail=False, methods=('get',), url_path=r'invoices/(?P<invoice_id>[0-9a-fA-F-]{36})/pdf')
    def invoice_document(self, request, invoice_id=None):
        access = self._access()
        invoice = Invoice.objects.for_organization(access.organization).select_related(
            'lease__tenant', 'lease__unit__property',
        ).filter(pk=invoice_id, lease__tenant=access.tenant).first()
        if invoice is None:
            raise PermissionDenied('This invoice is not available in your tenant account.')
        return invoice_pdf(invoice, request.user.get_full_name() or request.user.get_username())

    @action(detail=False, methods=('get',), url_path=r'receipts/(?P<receipt_id>[0-9a-fA-F-]{36})/pdf')
    def receipt_document(self, request, receipt_id=None):
        access = self._access()
        receipt = Receipt.objects.for_organization(access.organization).select_related(
            'tenant', 'invoice__lease__unit__property', 'received_by',
        ).filter(pk=receipt_id, tenant=access.tenant).first()
        if receipt is None:
            raise PermissionDenied('This receipt is not available in your tenant account.')
        return receipt_pdf(receipt, request.user.get_full_name() or request.user.get_username())

    @action(detail=False, methods=('get',), url_path='statement.pdf')
    def statement_document(self, request):
        access = self._access()
        try:
            start = date.fromisoformat(request.query_params['start']) if request.query_params.get('start') else None
            end = date.fromisoformat(request.query_params['end']) if request.query_params.get('end') else None
        except ValueError:
            raise ValidationError({'period': 'Use ISO dates in YYYY-MM-DD format.'})
        if start and end and start > end:
            raise ValidationError({'period': 'Start date cannot be after end date.'})
        return tenant_statement_pdf(
            access.tenant, start, end,
            request.user.get_full_name() or request.user.get_username(),
        )

    def _build_portal_data(self, access, request):
        from facilities.models import ServiceRequest
        from notifications.models import Notification

        tenant = access.tenant
        leases = Lease.objects.for_organization(tenant.organization).filter(tenant=tenant).select_related(
            'unit__property',
        ).order_by('-starts_on')
        current_lease = leases.filter(status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING)).first() or leases.first()
        invoices = Invoice.objects.for_organization(tenant.organization).filter(
            lease__tenant=tenant,
        ).select_related('lease').order_by('-issued_on')
        receipts = Receipt.objects.for_organization(tenant.organization).filter(tenant=tenant).order_by('-received_on')
        property_ids = leases.values_list('unit__property_id', flat=True)
        gateways = PaymentGatewayConfiguration.objects.for_organization(tenant.organization).filter(
            property_id__in=property_ids, is_enabled=True,
        ).values('id', 'property_id', 'provider', 'display_name')
        outstanding = invoices.exclude(status__in=(Invoice.Status.PAID, Invoice.Status.VOID)).aggregate(
            total=Sum('balance'),
        )['total'] or Decimal('0')
        return {
            'tenant': TenantSerializer(tenant).data,
            'currentLease': LeaseSerializer(current_lease).data if current_lease else None,
            'balance': outstanding,
            'invoices': InvoiceSerializer(invoices[:12], many=True).data,
            'receipts': ReceiptSerializer(receipts[:12], many=True).data,
            'paymentGateways': list(gateways),
            'documents': TenantDocumentSerializer(
                TenantDocument.objects.for_organization(tenant.organization).filter(tenant=tenant)[:12], many=True,
            ).data,
            'serviceRequests': list(ServiceRequest.objects.for_organization(tenant.organization).filter(
                tenant=tenant,
            ).values(
                'id', 'reference', 'subject', 'category', 'priority', 'status',
                'submitted_at', 'resolved_at', 'satisfaction_score',
            )[:12]),
            'notices': list(Notification.objects.for_organization(tenant.organization).filter(
                recipient=request.user,
            ).values('id', 'title', 'message', 'level', 'created_at', 'read_at')[:12]),
        }

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        tenant_id = request.query_params.get('tenant')
        access = self._access(tenant_id=tenant_id)
        return Response(self._build_portal_data(access, request))

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def retrieve(self, request, pk=None):
        access = self._access(tenant_id=pk)
        return Response(self._build_portal_data(access, request))

    @action(detail=False, methods=('post',), url_path='payments/initiate')
    def initiate_payment(self, request):
        access = self._access()
        provider = str(request.data.get('provider') or PaymentGatewayConfiguration.Provider.ECITIZEN)
        invoices = self._selected_payment_invoices(access)
        invoice = invoices[0]
        total_amount = sum((item.balance for item in invoices), Decimal('0'))
        configuration = PaymentGatewayConfiguration.objects.for_organization(access.organization).filter(
            property=invoice.lease.unit.property, provider=provider, is_enabled=True,
        ).first()
        if configuration is None:
            raise ValidationError({'provider': 'This payment method is not enabled for the property.'})
        reference = f'PAY-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:10].upper()}'
        values = {
            'reference': reference,
            'amount': f'{total_amount:.2f}',
            'invoice': invoice.number if len(invoices) == 1 else f'{len(invoices)}-INVOICES',
            'merchant': configuration.merchant_reference,
        }
        try:
            checkout_url = configuration.checkout_url_template.format(**values)
        except (KeyError, ValueError):
            raise ValidationError({'provider': 'The payment checkout URL template is invalid.'})
        if not checkout_url.lower().startswith('https://'):
            raise ValidationError({'provider': 'Payment checkout must use HTTPS.'})
        intent = PaymentIntent.objects.create(
            organization=access.organization, configuration=configuration,
            invoice=invoice, tenant=access.tenant, reference=reference,
            amount=total_amount, status=PaymentIntent.Status.REDIRECTED,
            checkout_url=checkout_url, expires_at=timezone.now() + timedelta(minutes=30),
            metadata={'invoice_allocations': [
                {'invoice_id': str(item.id), 'invoice_number': item.number, 'amount': str(item.balance)}
                for item in invoices
            ]},
        )
        return Response(PaymentIntentSerializer(intent).data, status=201)

    @action(detail=False, methods=('post',), url_path='payments/stk-push')
    def stk_push(self, request):
        from .mpesa_client import initiate_stk_push

        access = self._access()
        raw_phone = str(request.data.get('phone_number') or access.tenant.phone or '').strip().replace('+', '').replace(' ', '')
        if not raw_phone:
            raise ValidationError({'phone_number': 'Provide a valid M-Pesa phone number (e.g. 2547XXXXXXXX).'})
        phone_number = f'254{raw_phone[1:]}' if raw_phone.startswith('0') else raw_phone

        invoices = self._selected_payment_invoices(access)
        invoice = invoices[0]
        total_amount = sum((item.balance for item in invoices), Decimal('0'))

        configuration = PaymentGatewayConfiguration.objects.for_organization(access.organization).filter(
            property=invoice.lease.unit.property, provider=PaymentGatewayConfiguration.Provider.MPESA, is_enabled=True,
        ).first()
        if not configuration:
            raise ValidationError({'gateway': 'No M-Pesa payment gateway configured for this property. Contact your administrator.'})

        stk_settings = configuration.settings if configuration else {}
        shortcode = stk_settings.get('shortcode', '')
        passkey = stk_settings.get('passkey', '')
        consumer_key = stk_settings.get('consumer_key', '')
        consumer_secret = stk_settings.get('consumer_secret', '')
        environment = stk_settings.get('environment', 'sandbox')
        account_ref = stk_settings.get('bank_account_number') or stk_settings.get('till_number') or invoice.lease.unit.code

        if not all([shortcode, passkey, consumer_key, consumer_secret]):
            raise ValidationError({'gateway': 'M-Pesa gateway is missing required configuration (shortcode, passkey, or API keys). Contact your administrator.'})

        # Build callback URL from the gateway's public_key
        callback_url = f'{request.scheme}://{request.get_host()}/api/v1/property/payment-webhooks/{configuration.public_key}/'

        reference = f'STK-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:8].upper()}'
        intent = PaymentIntent.objects.create(
            organization=access.organization,
            configuration=configuration,
            invoice=invoice,
            tenant=access.tenant,
            reference=reference,
            amount=total_amount,
            status=PaymentIntent.Status.PENDING,
            expires_at=timezone.now() + timedelta(minutes=15),
            metadata={
                'phone_number': phone_number,
                'shortcode': shortcode,
                'account_number': account_ref,
                'invoice_allocations': [
                    {'invoice_id': str(item.id), 'invoice_number': item.number, 'amount': str(item.balance)}
                    for item in invoices
                ],
            }
        )

        # Call Safaricom Daraja API
        result = initiate_stk_push(
            consumer_key=consumer_key,
            consumer_secret=consumer_secret,
            shortcode=shortcode,
            passkey=passkey,
            phone_number=phone_number,
            amount=total_amount,
            callback_url=callback_url,
            account_reference=account_ref,
            transaction_desc=f'{len(invoices)} Center Estates invoice(s)',
            environment=environment,
        )

        if result.get('success'):
            intent.external_reference = result.get('checkout_request_id', '')
            intent.metadata = {
                **intent.metadata,
                'checkout_request_id': result.get('checkout_request_id', ''),
                'merchant_request_id': result.get('merchant_request_id', ''),
                'daraja_response': result.get('response_description', ''),
            }
            intent.save(update_fields=('external_reference', 'metadata', 'updated_at'))
            return Response({
                'status': 'success',
                'message': result.get('customer_message', f'M-Pesa STK Push prompt sent to {phone_number}. Enter M-Pesa PIN on your phone to complete payment.'),
                'reference': reference,
                'phone_number': phone_number,
                'amount': str(total_amount),
                'intent_id': str(intent.id),
            }, status=201)
        else:
            intent.status = PaymentIntent.Status.FAILED
            intent.error_message = result.get('error', 'STK Push failed')
            intent.metadata = {**intent.metadata, 'daraja_error': result.get('error', ''), 'daraja_response': result.get('response_description', '')}
            intent.save(update_fields=('status', 'error_message', 'metadata', 'updated_at'))
            raise ValidationError({'detail': result.get('error', 'M-Pesa STK Push failed. Please try again.')})

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
