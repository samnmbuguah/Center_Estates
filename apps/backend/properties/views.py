import csv
import calendar
import hashlib
import hmac
import json
import os
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema, extend_schema_view
import uuid
from datetime import date, datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Count, DecimalField, F, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet, ViewSet

from core.models import Module
from core.permissions import HasModuleActionPermission
from core.tenancy import get_active_organization
from core.property_scope import get_active_property, scope_model_queryset, scope_queryset_to_property

from .models import (
    BankTransaction, BillingItem, BillingProfile, BillingReadinessIssue, BillingRun,
    Building, Budget, CreditNote, Expense, Invoice, InvoiceLine,
    InvoiceReminder, Lease, PaymentGatewayConfiguration, PaymentIntent,
    PaymentWebhookEvent, Project, Property, Receipt, ReceiptAllocation,
    RentSchedule, ReportDefinition, ReportExecution, ScheduledReport, ServiceCharge,
    ServiceChargeAllocation, ServiceChargeReconciliation, Tenant, TenantDocument,
    TenantPortalAccess, TenantMovement, TaxConfiguration, Unit, UnitStatusHistory, LeaseEscalation,
)
from .serializers import (
    BankTransactionSerializer, BillingItemSerializer, BillingProfileSerializer,
    BillingReadinessIssueSerializer, BillingRunSerializer, BuildingSerializer, BudgetSerializer,
    CreditNoteSerializer, ExpenseSerializer, InvoiceReminderSerializer,
    InvoiceLineSerializer, InvoiceSerializer, LeaseEscalationSerializer, LeaseSerializer, PaymentGatewayConfigurationSerializer,
    PaymentIntentSerializer, ProjectSerializer, PropertySerializer,
    ReceiptAllocationSerializer, ReceiptSerializer, RentScheduleSerializer, ReportDefinitionSerializer,
    ReportExecutionSerializer, ScheduledReportSerializer,
    ServiceChargeAllocationSerializer, ServiceChargeReconciliationSerializer,
    ServiceChargeSerializer, TaxConfigurationSerializer, TenantDocumentSerializer,
    TenantMovementSerializer, TenantPortalAccessSerializer, TenantSerializer,
    UnitSerializer, UnitStatusHistorySerializer,
)
from .pdf_documents import (
    income_expenditure_pdf, invoice_pdf, receipt_pdf, tabular_report_pdf,
    tenant_payment_status_pdf, tenant_payment_status_rows, tenant_statement_pdf,
)
from .lease_billing import generate_rent_schedule, refresh_schedule_amount, validate_lease_billable


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

    @action(detail=False, methods=('post',), url_path=r'(?P<public_key>[0-9a-fA-F-]{36})')
    def receive(self, request, public_key=None):
        configuration = PaymentGatewayConfiguration.objects.select_related('organization').filter(
            public_key=public_key, is_enabled=True,
        ).first()
        if configuration is None:
            return Response({'detail': 'Payment gateway is not available.'}, status=404)
        secret = os.environ.get(configuration.webhook_secret_env, '')
        if not secret:
            return Response({'detail': 'Payment callback is not configured.'}, status=503)
        raw_body = request.body
        signature = request.headers.get('X-Ceest-Signature', '').removeprefix('sha256=')
        expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
        if not signature or not hmac.compare_digest(signature, expected):
            return Response({'detail': 'Invalid callback signature.'}, status=401)
        try:
            payload = json.loads(raw_body.decode('utf-8'))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return Response({'detail': 'Callback body must be valid JSON.'}, status=400)
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
            ReceiptAllocation.objects.create(
                organization=configuration.organization, receipt=receipt,
                invoice=intent.invoice, amount=intent.amount, allocated_by=receiver.user,
            )
            invoice = intent.invoice
            invoice.balance = max(Decimal('0'), invoice.balance - intent.amount)
            invoice.status = Invoice.Status.PAID if invoice.balance == 0 else Invoice.Status.PARTIAL
            invoice.save(update_fields=('balance', 'status', 'updated_at'))
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
                message=f'Your payment of KES {intent.amount:,.2f} for invoice {invoice.number} was received and reconciled.',
                level=Notification.Level.SUCCESS, action_url='/tenant-portal',
                metadata={
                    'payment_intent_id': str(intent.id), 'invoice_id': str(invoice.id),
                    'receipt_id': str(receipt.id), 'provider': configuration.provider,
                },
            )
            event.status = PaymentWebhookEvent.Status.PROCESSED
            event.processed_at = timezone.now()
            event.save(update_fields=('status', 'processed_at', 'updated_at'))
        return Response({'status': 'processed', 'receipt': receipt.number})


class PropertyViewSet(OrganizationModelViewSet):
    write_permission = 'property.operations'
    queryset = Property.objects.annotate(buildings_count=Count('buildings'), units_count=Count('units'))
    serializer_class = PropertySerializer
    search_fields = ('name', 'code', 'city')

    @transaction.atomic
    @action(detail=False, methods=('post',), url_path='onboard')
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
        try:
            building_count = int(building_payload.get('count') or 0)
            floors = int(building_payload.get('floors') or 1)
        except (TypeError, ValueError):
            raise ValidationError({'building': 'Building and floor counts must be whole numbers.'})
        if not 0 <= building_count <= 100:
            raise ValidationError({'building': 'Create between 0 and 100 buildings.'})
        if not 1 <= floors <= 250:
            raise ValidationError({'building': 'Floors must be between 1 and 250.'})

        buildings = []
        building_metadata = {key: value for key, value in building_payload.items() if key not in {'count', 'floors'}}
        for index in range(1, building_count + 1):
            buildings.append(Building.objects.create(
                organization=organization,
                property=property_record,
                code=f'BLD-{index:03d}',
                name=f'Building {index}',
                floors=floors,
                metadata=building_metadata,
            ))

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
                    building = buildings[int(building_index) - 1]
                except (TypeError, ValueError, IndexError):
                    raise ValidationError({'units': f'Unit {code} references an invalid building.'})
            units.append(Unit.objects.create(
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
                },
            ))

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
            meter = UtilityMeter.objects.create(
                organization=organization, property=property_record, code=meter_code,
                name=f"{property_record.name} {utility_type.title()} {meter_code}", utility_type=utility_type,
                unit=str(utility.get('unit') or ('kWh' if utility_type == 'electricity' else 'm³'))[:20],
                tariff=tariff, is_active=str(utility.get('status', 'active')).lower() == 'active',
            )
            meters.append(meter)
            has_opening_reading = str(utility.get('initial_reading', '')).strip() != ''
            is_postpaid = utility_type != 'electricity' or utility.get('supply_mode', 'postpaid') == 'postpaid'
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

        return Response({
            'property': self.get_serializer(property_record).data,
            'buildings': BuildingSerializer(buildings, many=True).data,
            'units': UnitSerializer(units, many=True).data,
            'utility_meters_created': len(meters),
        }, status=201)

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

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        existing = Tenant.objects.filter(organization=organization, code__startswith='TNT-').values_list('code', flat=True)
        numbers = [int(code.rsplit('-', 1)[-1]) for code in existing if code.rsplit('-', 1)[-1].isdigit()]
        serializer.save(
            organization=organization,
            code=f"TNT-{(max(numbers) + 1) if numbers else 1:04d}",
            property=serializer.validated_data.get('property') or get_active_property(self.request, organization),
        )

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
        rent_rate = amount('rent_rate_per_sqft')
        service_rate = amount('service_charge_rate_per_sqft')
        security_deposit = amount('security_deposit')
        escalation_percent = amount('escalation_percent')
        try:
            escalation_interval = int(lease_data.get('escalation_interval_months', 12))
        except (ValueError, TypeError):
            raise ValidationError({'lease.escalation_interval_months': 'Select a valid escalation frequency.'})
        if escalation_percent and not 1 <= escalation_interval <= 120:
            raise ValidationError({'lease.escalation_interval_months': 'Escalation frequency must be between 1 and 120 months.'})
        vat_rate = amount('vat_rate', 16)
        if vat_rate not in (Decimal('0.00'), Decimal('16.00')):
            raise ValidationError({'lease.vat_rate': 'Supported VAT rates are 0% and 16%.'})
        monthly_rent = (area * rent_rate).quantize(Decimal('0.01'))
        if monthly_rent <= 0:
            raise ValidationError({'lease.rent_rate_per_sqft': 'Monthly rent must be greater than zero.'})
        monthly_service = (area * service_rate).quantize(Decimal('0.01'))
        utilities = request.data.get('utilities') if isinstance(request.data.get('utilities'), list) else []
        try:
            utility_deposit = sum(
                (Decimal(str(item.get('rate_per_unit', 0))) * area for item in utilities if item.get('applicable')),
                Decimal('0'),
            ).quantize(Decimal('0.01'))
        except Exception:
            raise ValidationError({'utilities': 'Utility rates must be valid non-negative amounts.'})
        if utility_deposit < 0:
            raise ValidationError({'utilities': 'Utility rates cannot be negative.'})
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
        return Response({
            'tenant': TenantSerializer(tenant).data, 'lease': LeaseSerializer(lease).data,
            'application_number': application_number, 'calculations': calculations,
        }, status=201)

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

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        validate_lease_billable(serializer.validated_data['lease'], timezone.localdate())
        amount = serializer.validated_data['amount']
        serializer.save(organization=organization, balance=amount, status=Invoice.Status.DRAFT, prepared_by=self.request.user)

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
            raise ValidationError({'status': 'Only invoices in review can be approved.'})
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

        invoice = Invoice.objects.select_for_update().get(pk=self.get_object().pk)
        if invoice.status != Invoice.Status.APPROVED:
            raise ValidationError({'status': 'Only approved invoices can be issued.'})
        validate_lease_billable(invoice.lease, timezone.localdate())
        invoice.status = Invoice.Status.ISSUED
        invoice.issued_by = request.user
        invoice.issued_at = timezone.now()
        invoice.save(update_fields=('status', 'issued_by', 'issued_at', 'updated_at'))
        tenant = invoice.lease.tenant
        preference = str(tenant.metadata.get('billing_preference', 'portal'))
        channel = preference if preference in InvoiceReminder.Channel.values else InvoiceReminder.Channel.PORTAL
        recipient = tenant.email if channel == InvoiceReminder.Channel.EMAIL else tenant.phone if channel == InvoiceReminder.Channel.SMS else tenant.name
        if recipient:
            message = f'Invoice {invoice.number} for {invoice.amount} is due {invoice.due_on}.'
            InvoiceReminder.objects.create(organization=invoice.organization, invoice=invoice, channel=channel, recipient=recipient, message=message, sent_at=timezone.now(), sent_by=request.user)
            access = TenantPortalAccess.objects.for_organization(invoice.organization).filter(tenant=tenant, is_active=True).select_related('user').first()
            if access:
                Notification.objects.create(organization=invoice.organization, recipient=access.user, title=f'New invoice: {invoice.number}', message=message, level=Notification.Level.INFO, action_url='/tenant-portal', metadata={'invoice_id': str(invoice.id)})
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


class InvoiceLineViewSet(ReadOnlyModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.PROPERTY
    serializer_class = InvoiceLineSerializer

    def get_queryset(self):
        organization = get_active_organization(self.request)
        return scope_queryset_to_property(
            InvoiceLine.objects.for_organization(organization).select_related('invoice__lease__unit__property', 'billing_item'),
            self.request, organization,
        )


class BillingRunViewSet(OrganizationModelViewSet):
    write_permission = 'property.finance'
    queryset = BillingRun.objects.select_related('property', 'created_by', 'approved_by').prefetch_related('issues')
    serializer_class = BillingRunSerializer

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), created_by=self.request.user)

    @action(detail=True, methods=('post',), url_path='resolve-issue')
    def resolve_issue(self, request, pk=None):
        issue = BillingReadinessIssue.objects.filter(
            billing_run=self.get_object(), pk=request.data.get('issue'), organization=get_active_organization(request),
        ).first()
        if not issue:
            raise ValidationError({'issue': 'Select an issue from this billing run.'})
        status = request.data.get('status', BillingReadinessIssue.Status.RESOLVED)
        if status not in (BillingReadinessIssue.Status.RESOLVED, BillingReadinessIssue.Status.OVERRIDDEN):
            raise ValidationError({'status': 'Issue status must be resolved or overridden.'})
        notes = str(request.data.get('notes', '')).strip()
        if status == BillingReadinessIssue.Status.OVERRIDDEN and not notes:
            raise ValidationError({'notes': 'An authorized override requires supporting notes.'})
        issue.status = status; issue.resolution_notes = notes
        issue.resolved_by = request.user; issue.resolved_at = timezone.now(); issue.save()
        return Response(BillingReadinessIssueSerializer(issue).data)


class ReportDefinitionViewSet(OrganizationModelViewSet):
    write_permission = 'property.reports'
    queryset = ReportDefinition.objects.select_related('created_by')
    serializer_class = ReportDefinitionSerializer
    search_fields = ('key', 'name', 'description')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), created_by=self.request.user)


class ReportExecutionViewSet(ReadOnlyModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.PROPERTY
    serializer_class = ReportExecutionSerializer

    def get_queryset(self):
        organization = get_active_organization(self.request)
        return scope_queryset_to_property(
            ReportExecution.objects.for_organization(organization).select_related('definition', 'property', 'generated_by'),
            self.request, organization,
        )


class ScheduledReportViewSet(OrganizationModelViewSet):
    write_permission = 'property.reports'
    queryset = ScheduledReport.objects.select_related('definition', 'property', 'created_by', 'last_execution')
    serializer_class = ScheduledReportSerializer

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), created_by=self.request.user)


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
                'activeTenants': scope_model_queryset(Tenant, request, organization).filter(status=Tenant.Status.ACTIVE).count(),
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

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        return Response({'reports': [
            {'key': 'tenant-payment-status', 'name': 'Tenants Payments Status Report', 'category': 'Critical Financial', 'critical': True, 'description': 'Monthly tenant billings, receipts and balances carried forward.'},
            {'key': 'income-expense', 'name': 'Receipts & Expenditure Account', 'category': 'Critical Financial', 'critical': True, 'description': 'Property income, disbursements and cumulative performance.'},
            {'key': 'outstanding-balances', 'name': 'Outstanding Balances', 'category': 'Critical Financial', 'critical': True, 'description': 'Open tenant invoices and balances requiring collection.'},
            {'key': 'payment-reconciliation', 'name': 'Payment Reconciliation', 'category': 'Critical Financial', 'critical': True, 'description': 'Bank transactions matched to official receipts.'},
            {'key': 'aging', 'name': 'Outstanding Aging', 'category': 'Financial', 'description': 'Arrears grouped by age and tenant.'},
            {'key': 'budget-actual', 'name': 'Budget versus actual', 'category': 'Financial'},
            {'key': 'service-charge', 'name': 'Service charge allocations', 'category': 'Financial'},
            {'key': 'daily-collections', 'name': 'Daily collections', 'category': 'Collections & Reconciliation'},
            {'key': 'collections-property', 'name': 'Collections by property', 'category': 'Collections & Reconciliation'},
            {'key': 'collections-tenant', 'name': 'Collections by tenant', 'category': 'Collections & Reconciliation'},
            {'key': 'settlement', 'name': 'Settlement report', 'category': 'Collections & Reconciliation'},
            {'key': 'management-fee', 'name': 'Management fee report', 'category': 'Collections & Reconciliation'},
            {'key': 'occupancy', 'name': 'Portfolio occupancy', 'category': 'Tenants & Occupancy'},
            {'key': 'lease-expiry', 'name': 'Lease expiry', 'category': 'Tenants & Occupancy'},
            {'key': 'contractor-expiry', 'name': 'Service provider expiry', 'category': 'Service Providers'},
            {'key': 'work-order-spend', 'name': 'Work order spend', 'category': 'Service Providers'},
            {'key': 'tenant-compliance', 'name': 'Tenant document compliance', 'category': 'Compliance & Risk'},
            {'key': 'critical-dates', 'name': 'Critical dates register', 'category': 'Compliance & Risk'},
        ]})

    @extend_schema(request=None, responses={200: {"type": "string", "format": "binary"}}, parameters=[OpenApiParameter("report_kind", OpenApiTypes.STR, OpenApiParameter.PATH)])
    @action(detail=False, methods=('get',), url_path=r'exports/(?P<report_kind>[^/.]+)')
    def export(self, request, report_kind=None):
        organization = self._organization()
        output_pdf = request.query_params.get('output') == 'pdf'
        today = timezone.localdate()
        try:
            start = date.fromisoformat(request.query_params.get('start', today.replace(day=1).isoformat()))
            end = date.fromisoformat(request.query_params.get('end', today.isoformat()))
        except ValueError:
            raise ValidationError({'period': 'Use ISO dates in YYYY-MM-DD format.'})
        if start > end:
            raise ValidationError({'period': 'Start date cannot be after end date.'})
        if output_pdf and report_kind in ('income-expense', 'tenant-payment-status'):
            property_record = get_active_property(request, organization)
            if not property_record:
                raise ValidationError({'property': 'Select a property before generating this report.'})
            if report_kind == 'tenant-payment-status':
                return tenant_payment_status_pdf(organization, property_record, start, end, request.user.get_full_name() or request.user.get_username())
            return income_expenditure_pdf(organization, property_record, start, end, request.user.get_full_name() or request.user.get_username())
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="property-{report_kind}.csv"'
        writer = csv.writer(response)
        if report_kind == 'tenant-payment-status':
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
            for receipt in scope_model_queryset(Receipt, request, organization).select_related('tenant'):
                writer.writerow(('Income', receipt.received_on, receipt.tenant.name, receipt.payment_method, receipt.number, receipt.amount))
            for expense in scope_model_queryset(Expense, request, organization).select_related('property'):
                writer.writerow(('Expense', expense.incurred_on, expense.property.name, expense.category, expense.invoice_number, expense.amount))
        elif report_kind == 'occupancy':
            writer.writerow(('Property', 'Unit', 'Type', 'Area', 'Status'))
            for unit in scope_model_queryset(Unit, request, organization).select_related('property'):
                writer.writerow((unit.property.name, unit.code, unit.unit_type, unit.area or '', unit.status))
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
        else:
            raise ValidationError({'report': 'Unknown property report.'})
        if output_pdf:
            title = str(report_kind).replace('-', ' ').title()
            property_record = get_active_property(request, organization)
            period_start = request.query_params.get('start')
            period_end = request.query_params.get('end')
            period = f'{period_start} — {period_end}' if period_start and period_end else f'As at {timezone.localdate():%d %b %Y}'
            return tabular_report_pdf(
                organization, title, f'property-{report_kind}.pdf', response.content,
                property_name=property_record.name if property_record else 'Portfolio', period=period,
                generated_by=request.user.get_full_name() or request.user.get_username(),
            )
        return response


@extend_schema_view(list=extend_schema(request=None, responses=OpenApiTypes.OBJECT))
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

    @extend_schema(request=None, responses={200: {"type": "object"}})
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
        property_ids = leases.values_list('unit__property_id', flat=True)
        gateways = PaymentGatewayConfiguration.objects.for_organization(tenant.organization).filter(
            property_id__in=property_ids, is_enabled=True,
        ).values('id', 'property_id', 'provider', 'display_name')
        outstanding = invoices.exclude(status__in=(Invoice.Status.PAID, Invoice.Status.VOID)).aggregate(
            total=Sum('balance'),
        )['total'] or Decimal('0')
        return Response({
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
            ).values('id', 'reference', 'subject', 'category', 'priority', 'status', 'submitted_at', 'resolved_at')[:12]),
            'notices': list(Notification.objects.for_organization(tenant.organization).filter(
                recipient=request.user,
            ).values('id', 'title', 'message', 'level', 'created_at', 'read_at')[:12]),
        })

    @action(detail=False, methods=('post',), url_path='payments/initiate')
    def initiate_payment(self, request):
        access = self._access()
        invoice_id = request.data.get('invoice')
        provider = str(request.data.get('provider') or PaymentGatewayConfiguration.Provider.ECITIZEN)
        invoice = Invoice.objects.for_organization(access.organization).select_related(
            'lease__unit__property', 'lease__tenant',
        ).filter(pk=invoice_id, lease__tenant=access.tenant).first()
        if invoice is None:
            raise ValidationError({'invoice': 'Select one of your invoices.'})
        if invoice.status not in (Invoice.Status.ISSUED, Invoice.Status.PARTIAL, Invoice.Status.OVERDUE):
            raise ValidationError({'invoice': 'Only issued, partially paid, or overdue invoices can be paid.'})
        if invoice.balance <= 0:
            raise ValidationError({'invoice': 'This invoice has no outstanding balance.'})
        configuration = PaymentGatewayConfiguration.objects.for_organization(access.organization).filter(
            property=invoice.lease.unit.property, provider=provider, is_enabled=True,
        ).first()
        if configuration is None:
            raise ValidationError({'provider': 'This payment method is not enabled for the property.'})
        reference = f'PAY-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:10].upper()}'
        values = {
            'reference': reference,
            'amount': f'{invoice.balance:.2f}',
            'invoice': invoice.number,
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
            amount=invoice.balance, status=PaymentIntent.Status.REDIRECTED,
            checkout_url=checkout_url, expires_at=timezone.now() + timedelta(minutes=30),
        )
        return Response(PaymentIntentSerializer(intent).data, status=201)

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
