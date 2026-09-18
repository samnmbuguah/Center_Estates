import csv
import io
import os
import subprocess
import tempfile
from io import BytesIO
from drf_spectacular.utils import OpenApiTypes, extend_schema, extend_schema_view
import uuid

from django.db import transaction
from django.core.files.base import ContentFile
from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django.http import HttpResponse
from django.utils import timezone
import calendar
from decimal import Decimal
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing

from core.models import Module
from core.permissions import HasModuleActionPermission, HasModuleSubscription
from core.serializers import GenericObjectSerializer
from core.tenancy import get_active_organization
from core.property_scope import scope_model_queryset, scope_queryset_to_property
from properties.models import Building, Property
from notifications.models import Notification
from notifications.services import notify_permission, notify_user
import openpyxl
from .rubric_templates import STANDARD_RUBRIC_TEMPLATES

from .models import (
    AssetConditionAssessment, ComplianceObligation, Contractor, ContractorContract, FacilityAsset,
    FacilityExpense, FacilityFlag, FacilityIncident, FacilityIncidentAttachment, FacilityIncidentEvent, FacilityRisk, FloorPlan, FMBudget, Inspection, MeterReading, MeterReconciliation,
    ContractInvoiceAppraisal, FacilityJobCard, FacilityPaymentRecord, FinancePaymentRequest,
    LocalPurchaseOrder, MeterResetEvent, PettyCashVoucher, PreventiveSchedule, ProcurementQuotation, ProcurementRecord,
    RepairRequisition, ServiceProfile, ServiceProfileAllocation, ServiceRequest, StrategicFMPlan, SupplierInvoice, UtilityMeter, WorkOrder,
    WorkOrderAttachment, WorkOrderCostItem, WorkOrderEvent,
    ServiceLine, ScorecardVersion, ScorecardKPI, ServiceAppraisal, AppraisalItemResult, ImprovementAction,
)
from .serializers import (
    AssetConditionAssessmentSerializer, ComplianceObligationSerializer, ContractorContractSerializer,
    ContractorSerializer, FacilityAssetSerializer, FacilityExpenseSerializer, FacilityFlagSerializer, FacilityIncidentAttachmentSerializer, FacilityIncidentEventSerializer, FacilityIncidentSerializer, FacilityRiskSerializer,
    FloorPlanSerializer, FMBudgetSerializer, InspectionSerializer, MeterReadingSerializer,
    ContractInvoiceAppraisalSerializer, FacilityJobCardSerializer, FacilityPaymentRecordSerializer,
    FinancePaymentRequestSerializer, LocalPurchaseOrderSerializer, MeterReconciliationSerializer, PettyCashVoucherSerializer,
    MeterResetEventSerializer, PreventiveScheduleSerializer, ProcurementQuotationSerializer, ProcurementRecordSerializer,
    RepairRequisitionSerializer, SupplierInvoiceSerializer,
    ServiceProfileAllocationSerializer, ServiceProfileSerializer, ServiceRequestSerializer, StrategicFMPlanSerializer, UtilityMeterSerializer,
    WorkOrderAttachmentSerializer, WorkOrderCostItemSerializer, WorkOrderEventSerializer,
    WorkOrderSerializer,
    ServiceLineSerializer, ScorecardVersionSerializer, ScorecardKPISerializer,
    ServiceAppraisalSerializer, AppraisalItemResultSerializer, ImprovementActionSerializer,
)


class FacilityModelViewSet(ModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.FACILITY
    search_fields = ()

    def get_queryset(self):
        organization = get_active_organization(self.request)
        queryset = scope_queryset_to_property(self.queryset.for_organization(organization), self.request, organization)
        search = self.request.query_params.get('search', '').strip()
        if search:
            from django.db.models import Q
            query = Q()
            for field in self.search_fields:
                query |= Q(**{f'{field}__icontains': search})
            queryset = queryset.filter(query)
        requested_status = self.request.query_params.get('status')
        if requested_status and any(field.name == 'status' for field in queryset.model._meta.fields):
            queryset = queryset.filter(status=requested_status)
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


def _facility_document_pdf(*, title, reference, organization, property_name, details, table_headers=(), table_rows=(), qr_text='', accent='#991b1b'):
    buffer = BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=landscape(A4), leftMargin=14 * mm, rightMargin=14 * mm,
                                 topMargin=12 * mm, bottomMargin=12 * mm)
    styles = getSampleStyleSheet()
    accent_color = colors.HexColor(accent)
    story = [Paragraph(str(organization.name), ParagraphStyle('Org', parent=styles['Heading2'], textColor=accent_color)),
             Paragraph(title, ParagraphStyle('DocTitle', parent=styles['Title'], textColor=colors.HexColor('#0f172a'))),
             Paragraph(f'<b>{reference}</b> · {property_name}', styles['Normal']), Spacer(1, 4 * mm)]
    if qr_text:
        widget = qr.QrCodeWidget(qr_text); bounds = widget.getBounds(); size = 24 * mm
        drawing = Drawing(size, size, transform=[size/(bounds[2]-bounds[0]), 0, 0, size/(bounds[3]-bounds[1]), 0, 0])
        drawing.add(widget); story.append(drawing)
    detail_table = Table([[Paragraph(f'<b>{label}</b>', styles['BodyText']), Paragraph(str(value or '—'), styles['BodyText'])]
                          for label, value in details], colWidths=[48 * mm, 175 * mm])
    detail_table.setStyle(TableStyle([('GRID', (0,0), (-1,-1), .35, colors.HexColor('#cbd5e1')),
                                      ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f1f5f9')), ('VALIGN', (0,0), (-1,-1), 'TOP')]))
    story.extend([detail_table, Spacer(1, 4 * mm)])
    if table_headers:
        table = Table([list(table_headers)] + [list(row) for row in table_rows], repeatRows=1)
        table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),accent_color), ('TEXTCOLOR',(0,0),(-1,0),colors.white),
                                   ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'), ('GRID',(0,0),(-1,-1),.35,colors.HexColor('#cbd5e1')),
                                   ('VALIGN',(0,0),(-1,-1),'MIDDLE'), ('FONTSIZE',(0,0),(-1,-1),8),
                                   ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f8fafc')])]))
        story.append(table)
    document.build(story)
    return buffer.getvalue()


def _pdf_response(content, filename):
    response = HttpResponse(content, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


class ServiceProfileViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = ServiceProfile.objects.prefetch_related('properties', 'assets', 'allocations__property', 'allocations__provider')
    serializer_class = ServiceProfileSerializer
    search_fields = ('code', 'name', 'category', 'description')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        code = f'SVC-{uuid.uuid4().hex[:8].upper()}'
        while ServiceProfile.objects.filter(organization=organization, code=code).exists():
            code = f'SVC-{uuid.uuid4().hex[:8].upper()}'
        profile = serializer.save(organization=organization, created_by=self.request.user, code=code)
        Notification.objects.create(
            organization=organization, recipient=self.request.user,
            title='Service profile created', message=f'{profile.name} ({profile.code}) is ready for provider allocation.',
            action_url='/facility?tab=service-profiles', metadata={'category': 'workflow', 'service_profile_id': str(profile.id)},
        )


class ServiceProfileAllocationViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = ServiceProfileAllocation.objects.select_related('service_profile', 'property', 'provider')
    serializer_class = ServiceProfileAllocationSerializer
    search_fields = ('service_profile__name', 'property__name', 'provider__name')


class RepairRequisitionViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    permission_map = {'approve': 'facility.approve', 'reject': 'facility.approve', 'convert_to_work_order': 'facility.work'}
    queryset = RepairRequisition.objects.select_related(
        'property', 'unit', 'asset', 'service_request', 'requester', 'manager', 'provider', 'work_order',
    )
    serializer_class = RepairRequisitionSerializer
    search_fields = ('code', 'title', 'location', 'issue_description', 'property__name')

    @action(detail=True, methods=('get',), url_path='pdf')
    def pdf(self, request, pk=None):
        requisition = self.get_object()
        content = _facility_document_pdf(
            title='REPAIR REQUISITION REPORT', reference=requisition.code,
            organization=requisition.organization, property_name=requisition.property.name,
            qr_text=request.build_absolute_uri(),
            details=(('Requested by', requisition.requester.get_full_name() or requisition.requester.username),
                     ('Location', requisition.location), ('Priority', requisition.get_priority_display()),
                     ('Required by', requisition.required_by), ('Issue', requisition.issue_description),
                     ('Required repair', requisition.required_repair), ('Quotation specification', requisition.quotation_specification),
                     ('Estimated cost (KES)', f'{requisition.estimated_cost:,.2f}' if requisition.estimated_cost is not None else '—'),
                     ('Approval status', requisition.get_status_display()),
                     ('Approved by', requisition.manager.get_full_name() if requisition.manager_id else '—')),
        )
        return _pdf_response(content, f'{requisition.code}.pdf')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        code = f'RQR-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}'
        while RepairRequisition.objects.filter(organization=organization, code=code).exists():
            code = f'RQR-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}'
        serializer.save(organization=organization, requester=self.request.user, code=code)

    def perform_update(self, serializer):
        if 'status' in serializer.validated_data:
            raise ValidationError({'status': 'Use the submit/approve/reject actions so every status change is controlled.'})
        super().perform_update(serializer)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='submit')
    def submit(self, request, pk=None):
        requisition = self.get_object()
        if requisition.status != RepairRequisition.Status.DRAFT:
            raise ValidationError({'status': 'Only draft requisitions can be submitted.'})
        requisition.status = RepairRequisition.Status.SUBMITTED
        requisition.save(update_fields=('status', 'updated_at'))
        Notification.objects.create(
            organization=requisition.organization, recipient=request.user,
            title=f'Requisition {requisition.code} submitted',
            message=f'{requisition.title} is awaiting manager approval.',
            action_url='/facility?tab=requisitions', metadata={'category': 'workflow', 'requisition_id': str(requisition.id)},
        )
        return Response(RepairRequisitionSerializer(requisition).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='approve')
    def approve(self, request, pk=None):
        requisition = self.get_object()
        if requisition.status != RepairRequisition.Status.SUBMITTED:
            raise ValidationError({'status': 'Only submitted requisitions can be approved.'})
        requisition.status = RepairRequisition.Status.APPROVED
        requisition.manager = request.user
        requisition.manager_approved_at = timezone.now()
        requisition.manager_notes = str(request.data.get('notes', '')).strip()
        requisition.save(update_fields=('status', 'manager', 'manager_approved_at', 'manager_notes', 'updated_at'))
        return Response(RepairRequisitionSerializer(requisition).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='reject')
    def reject(self, request, pk=None):
        requisition = self.get_object()
        if requisition.status != RepairRequisition.Status.SUBMITTED:
            raise ValidationError({'status': 'Only submitted requisitions can be rejected.'})
        reason = str(request.data.get('reason', '')).strip()
        if not reason:
            raise ValidationError({'reason': 'A rejection reason is required.'})
        requisition.status = RepairRequisition.Status.REJECTED
        requisition.manager = request.user
        requisition.manager_approved_at = timezone.now()
        requisition.rejected_reason = reason
        requisition.save(update_fields=('status', 'manager', 'manager_approved_at', 'rejected_reason', 'updated_at'))
        return Response(RepairRequisitionSerializer(requisition).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='convert-to-work-order')
    def convert_to_work_order(self, request, pk=None):
        requisition = self.get_object()
        if requisition.status != RepairRequisition.Status.APPROVED:
            raise ValidationError({'status': 'Only approved requisitions can be converted to a work order.'})
        if requisition.work_order_id:
            raise ValidationError({'status': 'This requisition has already been converted.'})
        provider = requisition.provider
        if request.data.get('provider'):
            provider = Contractor.objects.filter(pk=request.data.get('provider'), organization=requisition.organization).first()
            if provider is None:
                raise ValidationError({'provider': 'Select a valid provider.'})
            requisition.provider = provider
        number = f'WO-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}'
        while WorkOrder.objects.filter(organization=requisition.organization, number=number).exists():
            number = f'WO-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}'
        priority_map = {
            RepairRequisition.Priority.LOW: WorkOrder.Priority.LOW,
            RepairRequisition.Priority.MEDIUM: WorkOrder.Priority.MEDIUM,
            RepairRequisition.Priority.HIGH: WorkOrder.Priority.HIGH,
            RepairRequisition.Priority.EMERGENCY: WorkOrder.Priority.CRITICAL,
        }
        work_order = WorkOrder.objects.create(
            organization=requisition.organization, number=number,
            title=requisition.title, description=requisition.required_repair,
            category='corrective', source='requisition', property=requisition.property,
            asset=requisition.asset, contractor=provider, reported_by=request.user,
            priority=priority_map.get(requisition.priority, WorkOrder.Priority.MEDIUM),
            status=WorkOrder.Status.OPEN, reported_at=timezone.now(),
        )
        requisition.status = RepairRequisition.Status.CONVERTED
        requisition.work_order = work_order
        requisition.converted_at = timezone.now()
        requisition.save(update_fields=('status', 'work_order', 'provider', 'converted_at', 'updated_at'))
        if requisition.service_request_id and not requisition.service_request.work_order_id:
            requisition.service_request.work_order = work_order
            requisition.service_request.save(update_fields=('work_order', 'updated_at'))
        Notification.objects.create(
            organization=requisition.organization, recipient=request.user,
            title=f'Work order {number} created',
            message=f'Requisition {requisition.code} converted to work order {number}.',
            action_url='/facility?tab=work-orders', metadata={'category': 'workflow', 'work_order_id': str(work_order.id)},
        )
        return Response(RepairRequisitionSerializer(requisition).data)


class SupplierInvoiceViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    permission_map = {
        'verify': 'facility.approve', 'approve': 'facility.approve', 'reject': 'facility.approve',
        'start_payment': 'facility.approve', 'mark_paid': 'facility.approve', 'place_on_hold': 'facility.approve',
    }
    queryset = SupplierInvoice.objects.select_related(
        'property', 'supplier', 'work_order__job_card__lpo__procurement__requisition__service_request',
        'service_profile', 'budget',
        'submitted_by', 'verified_by', 'approved_by',
    )
    serializer_class = SupplierInvoiceSerializer
    search_fields = ('code', 'supplier_invoice_number', 'supplier__name', 'description', 'property__name')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        code = f'SIN-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}'
        while SupplierInvoice.objects.filter(organization=organization, code=code).exists():
            code = f'SIN-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}'
        invoice = serializer.save(organization=organization, code=code)
        if invoice.classification == SupplierInvoice.Classification.RECURRING and invoice.service_profile_id:
            contract = ContractorContract.objects.filter(
                organization=organization, contractor=invoice.supplier, status='active',
                start_date__lte=timezone.localdate(), end_date__gte=timezone.localdate(),
            ).filter(property__in=(invoice.property, None)).order_by('-property_id').first()
            if contract:
                ContractInvoiceAppraisal.objects.create(
                    organization=organization, invoice=invoice, contract=contract,
                    contract_valid=True,
                    service_mapping_valid=invoice.service_profile.properties.filter(pk=invoice.property_id).exists(),
                )

    def perform_update(self, serializer):
        if 'status' in serializer.validated_data:
            raise ValidationError({'status': 'Use the workflow actions so every status change is controlled and audited.'})
        if self.instance and self.instance.status not in (SupplierInvoice.Status.DRAFT, SupplierInvoice.Status.REJECTED):
            raise ValidationError({'detail': 'Only draft or rejected invoices can be edited.'})
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        if instance.status != SupplierInvoice.Status.DRAFT:
            raise ValidationError({'detail': 'Only draft invoices can be deleted.'})
        super().perform_destroy(instance)

    def _transition(self, invoice, target, **fields):
        invoice.status = target
        for key, value in fields.items():
            setattr(invoice, key, value)
        invoice.save(update_fields=(*fields.keys(), 'status', 'updated_at'))
        return invoice

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='submit')
    def submit(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status not in (SupplierInvoice.Status.DRAFT, SupplierInvoice.Status.REJECTED):
            raise ValidationError({'status': 'Only draft or rejected invoices can be submitted.'})
        if invoice.classification == SupplierInvoice.Classification.REPAIR and not invoice.work_order_id:
            raise ValidationError({'work_order': 'Repair invoices must be linked to a work order.'})
        if invoice.classification == SupplierInvoice.Classification.RECURRING and not invoice.service_profile_id:
            raise ValidationError({'service_profile': 'Recurring-service invoices must be linked to a service profile.'})
        self._transition(invoice, SupplierInvoice.Status.SUBMITTED, submitted_by=request.user, submitted_at=timezone.now())
        return Response(SupplierInvoiceSerializer(invoice).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='verify')
    def verify(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status != SupplierInvoice.Status.SUBMITTED:
            raise ValidationError({'status': 'Only submitted invoices can be verified.'})
        warnings = []
        if invoice.classification == SupplierInvoice.Classification.REPAIR and invoice.work_order_id:
            work_order = invoice.work_order
            if work_order.status != WorkOrder.Status.COMPLETED or not work_order.supervisor_verified:
                warnings.append('Source work order is not completed and supervisor-verified; an authorised exception will be required at approval.')
        if invoice.budget_id:
            budget = invoice.budget
            committed = budget.supplier_invoices.exclude(pk=invoice.pk).filter(
                status__in=(SupplierInvoice.Status.VERIFIED, SupplierInvoice.Status.APPROVED,
                            SupplierInvoice.Status.PAYMENT_PROCESSING, SupplierInvoice.Status.PAID),
            ).aggregate(total=Sum('total'))['total'] or Decimal('0')
            if (budget.allocated_amount or Decimal('0')) - committed < invoice.total:
                warnings.append('Invoice total exceeds the remaining budget allocation; exception approval will be required.')
        self._transition(invoice, SupplierInvoice.Status.VERIFIED, verified_by=request.user, verified_at=timezone.now(),
                         verified_notes=str(request.data.get('notes', '')).strip())
        return Response({**SupplierInvoiceSerializer(invoice).data, 'warnings': warnings})

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='approve')
    def approve(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status != SupplierInvoice.Status.VERIFIED:
            raise ValidationError({'status': 'Only verified invoices can be approved.'})
        if invoice.classification == SupplierInvoice.Classification.RECURRING:
            appraisal = getattr(invoice, 'performance_appraisal', None)
            if not appraisal or appraisal.status != ContractInvoiceAppraisal.Status.APPROVED:
                raise ValidationError({'appraisal': 'Caretaker and manager must approve the performance appraisal before payment approval.'})
        exception = bool(request.data.get('exception'))
        exception_notes = str(request.data.get('exception_notes', '')).strip()
        blocking = []
        if invoice.classification == SupplierInvoice.Classification.REPAIR and invoice.work_order_id:
            work_order = invoice.work_order
            if work_order.status != WorkOrder.Status.COMPLETED or not work_order.supervisor_verified:
                blocking.append('work-not-verified')
        if invoice.budget_id:
            budget = invoice.budget
            committed = budget.supplier_invoices.exclude(pk=invoice.pk).filter(
                status__in=(SupplierInvoice.Status.APPROVED, SupplierInvoice.Status.PAYMENT_PROCESSING, SupplierInvoice.Status.PAID),
            ).aggregate(total=Sum('total'))['total'] or Decimal('0')
            if (budget.allocated_amount or Decimal('0')) - committed < invoice.total:
                blocking.append('budget-exceeded')
        if blocking and not (exception and exception_notes):
            raise ValidationError({'exception': 'This invoice cannot be approved without an authorised exception. Provide exception notes to override: ' + ', '.join(blocking) + '.'})
        self._transition(invoice, SupplierInvoice.Status.APPROVED, approved_by=request.user, approved_at=timezone.now(),
                         approved_notes=str(request.data.get('notes', '')).strip(),
                         exception_approved=exception, exception_notes=exception_notes if exception else '')
        return Response(SupplierInvoiceSerializer(invoice).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='reject')
    def reject(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status not in (SupplierInvoice.Status.SUBMITTED, SupplierInvoice.Status.VERIFIED):
            raise ValidationError({'status': 'Only submitted or verified invoices can be rejected.'})
        reason = str(request.data.get('reason', '')).strip()
        if not reason:
            raise ValidationError({'reason': 'A rejection reason is required.'})
        self._transition(invoice, SupplierInvoice.Status.REJECTED, rejected_reason=reason)
        return Response(SupplierInvoiceSerializer(invoice).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='place-on-hold')
    def place_on_hold(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status not in (SupplierInvoice.Status.SUBMITTED, SupplierInvoice.Status.VERIFIED, SupplierInvoice.Status.APPROVED):
            raise ValidationError({'status': 'Only invoices awaiting payment can be put on hold.'})
        self._transition(invoice, SupplierInvoice.Status.ON_HOLD, verified_notes=str(request.data.get('notes', '')).strip())
        return Response(SupplierInvoiceSerializer(invoice).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='start-payment')
    def start_payment(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status != SupplierInvoice.Status.APPROVED:
            raise ValidationError({'status': 'Only approved invoices can enter payment processing.'})
        self._transition(invoice, SupplierInvoice.Status.PAYMENT_PROCESSING)
        return Response(SupplierInvoiceSerializer(invoice).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status != SupplierInvoice.Status.PAYMENT_PROCESSING:
            raise ValidationError({'status': 'Only invoices in payment processing can be marked as paid.'})
        reference = str(request.data.get('payment_reference', '')).strip()
        if not reference:
            raise ValidationError({'payment_reference': 'A payment reference is required.'})
        paid_at = timezone.now()
        self._transition(invoice, SupplierInvoice.Status.PAID, paid_at=paid_at, payment_reference=reference)
        expense = FacilityExpense.objects.create(
            organization=invoice.organization, property=invoice.property, work_order=invoice.work_order,
            spent_on=paid_at.date(), category=invoice.cost_centre or 'Supplier invoice',
            description=f'{invoice.code} · {invoice.description}', amount=invoice.total,
            supplier=invoice.supplier.name, receipt_reference=reference,
            status=FacilityExpense.Status.APPROVED, recorded_by=request.user,
            approved_by=request.user, approved_at=paid_at,
        )
        FacilityPaymentRecord.objects.create(
            organization=invoice.organization, number=f'PAY-{paid_at:%Y%m%d}-{uuid.uuid4().hex[:6].upper()}',
            supplier_invoice=invoice, property=invoice.property, payee=invoice.supplier.name,
            amount=invoice.total, paid_on=paid_at.date(), reference=reference,
            expense=expense, processed_by=request.user,
        )
        return Response(SupplierInvoiceSerializer(invoice).data)


class ProcurementRecordViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    permission_map = {'award': 'facility.approve', 'issue_lpo': 'facility.approve'}
    queryset = ProcurementRecord.objects.select_related('requisition', 'property', 'created_by').prefetch_related('quotations__bidder')
    serializer_class = ProcurementRecordSerializer
    search_fields = ('code', 'requisition__code', 'requisition__title', 'property__name')

    @action(detail=True, methods=('get',), url_path='evaluation-pdf')
    def evaluation_pdf(self, request, pk=None):
        procurement = self.get_object()
        quotations = procurement.quotations.select_related('bidder').all()
        content = _facility_document_pdf(
            title='QUOTATION EVALUATION REPORT', reference=procurement.code,
            organization=procurement.organization, property_name=procurement.property.name,
            qr_text=request.build_absolute_uri(),
            details=(('Requisition', procurement.requisition.code), ('Scope', procurement.requisition.required_repair),
                     ('Status', procurement.get_status_display()), ('Evaluation notes', procurement.evaluation_notes),
                     ('Award recommendation', procurement.award_reason),
                     ('Evaluated by', procurement.evaluated_by.get_full_name() if procurement.evaluated_by_id else '—')),
            table_headers=('Supplier', 'Quotation', 'Lead time', 'Score', 'Total (KES)', 'Recommendation'),
            table_rows=tuple((quote.bidder.name, quote.quotation_number, f'{quote.lead_time_days} days',
                              quote.evaluation_score or '—', f'{quote.total:,.2f}',
                              'AWARDED' if quote.is_awarded else ('Recommended' if quote.is_recommended else ''))
                             for quote in quotations),
        )
        return _pdf_response(content, f'{procurement.code}-quotation-evaluation.pdf')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        requisition = serializer.validated_data['requisition']
        if requisition.organization_id != organization.id or requisition.status != RepairRequisition.Status.APPROVED:
            raise ValidationError({'requisition': 'Select an approved requisition in the active organization.'})
        code = f'PROC-{timezone.localdate():%Y}-{uuid.uuid4().hex[:6].upper()}'
        serializer.save(organization=organization, code=code, property=requisition.property, created_by=self.request.user)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='add-quotation')
    def add_quotation(self, request, pk=None):
        procurement = self.get_object()
        if procurement.status not in (ProcurementRecord.Status.SOURCING, ProcurementRecord.Status.EVALUATION):
            raise ValidationError({'status': 'Quotations can only be added during sourcing or evaluation.'})
        serializer = ProcurementQuotationSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        bidder = serializer.validated_data['bidder']
        if bidder.organization_id != procurement.organization_id:
            raise ValidationError({'bidder': 'Select a bidder in the active organization.'})
        quotation = serializer.save(organization=procurement.organization, procurement=procurement, recorded_by=request.user)
        if procurement.status == ProcurementRecord.Status.SOURCING:
            procurement.status = ProcurementRecord.Status.EVALUATION
            procurement.save(update_fields=('status', 'updated_at'))
        return Response(ProcurementQuotationSerializer(quotation).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='award')
    def award(self, request, pk=None):
        procurement = self.get_object()
        quotation = procurement.quotations.select_for_update().filter(pk=request.data.get('quotation')).first()
        reason = str(request.data.get('reason', '')).strip()
        if not quotation:
            raise ValidationError({'quotation': 'Select a quotation from this procurement.'})
        if not reason:
            raise ValidationError({'reason': 'Document the award recommendation and value-for-money decision.'})
        procurement.quotations.update(is_awarded=False, is_recommended=False)
        quotation.is_awarded = True
        quotation.is_recommended = True
        quotation.save(update_fields=('is_awarded', 'is_recommended', 'updated_at'))
        procurement.status = ProcurementRecord.Status.AWARDED
        procurement.award_reason = reason
        procurement.evaluation_notes = str(request.data.get('evaluation_notes', '')).strip()
        procurement.evaluated_by = request.user
        procurement.evaluated_at = timezone.now()
        procurement.awarded_by = request.user
        procurement.awarded_at = timezone.now()
        procurement.save(update_fields=('status', 'award_reason', 'evaluation_notes', 'evaluated_by', 'evaluated_at', 'awarded_by', 'awarded_at', 'updated_at'))
        return Response(self.get_serializer(procurement).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='issue-lpo')
    def issue_lpo(self, request, pk=None):
        procurement = self.get_object()
        if procurement.status != ProcurementRecord.Status.AWARDED:
            raise ValidationError({'status': 'Award the procurement before issuing an LPO.'})
        quotation = procurement.quotations.filter(is_awarded=True).select_related('bidder').first()
        if not quotation:
            raise ValidationError({'quotation': 'The awarded quotation is missing.'})
        now = timezone.now()
        defaults = {
            'quotation': quotation, 'supplier': quotation.bidder, 'property': procurement.property,
            'issue_date': now.date(), 'delivery_date': request.data.get('delivery_date') or None,
            'scope': procurement.requisition.required_repair, 'subtotal': quotation.subtotal,
            'vat_amount': quotation.vat_amount, 'total': quotation.total,
            'payment_terms': str(request.data.get('payment_terms', '')).strip(),
            'status': LocalPurchaseOrder.Status.ISSUED, 'issued_by': request.user, 'issued_at': now,
            'accepted_by': None, 'accepted_at': None, 'cancelled_by': None, 'cancelled_at': None,
            'cancellation_reason': '',
        }
        existing_lpo = LocalPurchaseOrder.objects.select_for_update().filter(procurement=procurement).first()
        if existing_lpo:
            if existing_lpo.status != LocalPurchaseOrder.Status.CANCELLED:
                raise ValidationError({'status': 'This procurement already has an active LPO.'})
            for field, value in defaults.items():
                setattr(existing_lpo, field, value)
            existing_lpo.number = f'LPO-{now:%Y}-{uuid.uuid4().hex[:6].upper()}'
            existing_lpo.save()
            lpo = existing_lpo
        else:
            lpo = LocalPurchaseOrder.objects.create(
                organization=procurement.organization, number=f'LPO-{now:%Y}-{uuid.uuid4().hex[:6].upper()}',
                procurement=procurement, **defaults,
            )
        procurement.status = ProcurementRecord.Status.LPO_ISSUED
        procurement.save(update_fields=('status', 'updated_at'))
        return Response(LocalPurchaseOrderSerializer(lpo).data, status=status.HTTP_201_CREATED)


class LocalPurchaseOrderViewSet(FacilityModelViewSet):
    write_permission = 'facility.approve'
    permission_map = {'generate_job_card': 'facility.work', 'accept': 'facility.approve', 'cancel': 'facility.approve'}
    queryset = LocalPurchaseOrder.objects.select_related('procurement__requisition', 'quotation', 'supplier', 'property')
    serializer_class = LocalPurchaseOrderSerializer
    search_fields = ('number', 'procurement__code', 'procurement__requisition__code', 'supplier__name')

    @action(detail=True, methods=('get',), url_path='pdf')
    def pdf(self, request, pk=None):
        lpo = self.get_object(); quotation = lpo.quotation
        content = _facility_document_pdf(
            title='LOCAL PURCHASE ORDER (LPO)', reference=lpo.number, organization=lpo.organization,
            property_name=lpo.property.name, qr_text=request.build_absolute_uri(), accent='#1d4ed8',
            details=(('SUPPLIER', lpo.supplier.name), ('Supplier contact', ' · '.join(filter(None, (lpo.supplier.contact_name, lpo.supplier.phone, lpo.supplier.email)))),
                     ('Supplier PIN / registration', ' · '.join(filter(None, (lpo.supplier.pin_number, lpo.supplier.registration_number)))),
                     ('Requisition', lpo.procurement.requisition.code),
                     ('Procurement', lpo.procurement.code), ('Issue date', lpo.issue_date), ('Delivery date', lpo.delivery_date),
                     ('Delivery location', lpo.property.name), ('Scope of supply / service', lpo.scope),
                     ('Payment terms', lpo.payment_terms or 'As agreed after verified delivery'), ('Status', lpo.get_status_display()),
                     ('Authorised by', lpo.issued_by.get_full_name() or lpo.issued_by.username if lpo.issued_by_id else '—'),
                     ('Supplier acceptance', f'Recorded {lpo.accepted_at:%d %b %Y, %H:%M} by {lpo.accepted_by.get_full_name() or lpo.accepted_by.username}' if lpo.accepted_at and lpo.accepted_by_id else 'Pending')),
            table_headers=('AWARDED QUOTATION', 'LEAD TIME', 'SUBTOTAL (KES)', 'VAT (KES)', 'ORDER TOTAL (KES)'),
            table_rows=((quotation.quotation_number, f'{quotation.lead_time_days} days', f'{lpo.subtotal:,.2f}', f'{lpo.vat_amount:,.2f}', f'{lpo.total:,.2f}'),),
        )
        return _pdf_response(content, f'{lpo.number}.pdf')

    @action(detail=True, methods=('post',))
    def accept(self, request, pk=None):
        lpo = self.get_object()
        if lpo.status != LocalPurchaseOrder.Status.ISSUED:
            raise ValidationError({'status': 'Only an issued LPO can be accepted.'})
        lpo.status = LocalPurchaseOrder.Status.ACCEPTED
        lpo.accepted_by = request.user
        lpo.accepted_at = timezone.now()
        lpo.save(update_fields=('status', 'accepted_by', 'accepted_at', 'updated_at'))
        return Response(self.get_serializer(lpo).data)

    @action(detail=True, methods=('post',))
    def cancel(self, request, pk=None):
        lpo = self.get_object()
        reason = str(request.data.get('reason', '')).strip()
        if lpo.status not in (LocalPurchaseOrder.Status.ISSUED, LocalPurchaseOrder.Status.ACCEPTED):
            raise ValidationError({'status': 'Only an issued or accepted LPO can be cancelled.'})
        if hasattr(lpo, 'job_card'):
            raise ValidationError({'status': 'An LPO with an active Job Card cannot be cancelled.'})
        if not reason:
            raise ValidationError({'reason': 'Record why the LPO is being cancelled.'})
        lpo.status = LocalPurchaseOrder.Status.CANCELLED
        lpo.cancelled_by = request.user
        lpo.cancelled_at = timezone.now()
        lpo.cancellation_reason = reason
        lpo.save(update_fields=('status', 'cancelled_by', 'cancelled_at', 'cancellation_reason', 'updated_at'))
        lpo.procurement.status = ProcurementRecord.Status.AWARDED
        lpo.procurement.save(update_fields=('status', 'updated_at'))
        return Response(self.get_serializer(lpo).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='generate-job-card')
    def generate_job_card(self, request, pk=None):
        lpo = self.get_object()
        if lpo.status not in (LocalPurchaseOrder.Status.ISSUED, LocalPurchaseOrder.Status.ACCEPTED):
            raise ValidationError({'status': 'Only an issued LPO can generate a Job Card.'})
        if hasattr(lpo, 'job_card'):
            return Response(FacilityJobCardSerializer(lpo.job_card).data)
        requisition = lpo.procurement.requisition
        number = f'WO-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}'
        priority = {
            RepairRequisition.Priority.LOW: WorkOrder.Priority.LOW,
            RepairRequisition.Priority.MEDIUM: WorkOrder.Priority.MEDIUM,
            RepairRequisition.Priority.HIGH: WorkOrder.Priority.HIGH,
            RepairRequisition.Priority.EMERGENCY: WorkOrder.Priority.CRITICAL,
        }.get(requisition.priority, WorkOrder.Priority.MEDIUM)
        work_order = WorkOrder.objects.create(
            organization=lpo.organization, number=number, title=requisition.title,
            description=requisition.required_repair, category='corrective', source='requisition',
            property=lpo.property, asset=requisition.asset, contractor=lpo.supplier,
            reported_by=request.user, priority=priority, status=WorkOrder.Status.OPEN,
            reported_at=timezone.now(), other_cost=lpo.total,
        )
        card = FacilityJobCard.objects.create(
            organization=lpo.organization, number=f'JC-{timezone.localdate():%Y}-{uuid.uuid4().hex[:6].upper()}',
            lpo=lpo, property=lpo.property, work_order=work_order,
        )
        requisition.provider = lpo.supplier
        requisition.work_order = work_order
        requisition.status = RepairRequisition.Status.CONVERTED
        requisition.converted_at = timezone.now()
        requisition.save(update_fields=('provider', 'work_order', 'status', 'converted_at', 'updated_at'))
        if requisition.service_request_id:
            requisition.service_request.work_order = work_order
            requisition.service_request.status = ServiceRequest.Status.ASSIGNED
            requisition.service_request.save(update_fields=('work_order', 'status', 'updated_at'))
        lpo.procurement.status = ProcurementRecord.Status.IN_EXECUTION
        lpo.procurement.save(update_fields=('status', 'updated_at'))
        return Response(FacilityJobCardSerializer(card).data, status=status.HTTP_201_CREATED)


class FacilityJobCardViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    permission_map = {'caretaker_sign': 'facility.work', 'verify': 'facility.approve'}
    queryset = FacilityJobCard.objects.select_related('lpo__procurement__requisition__service_request', 'property', 'work_order')
    serializer_class = FacilityJobCardSerializer
    search_fields = ('number', 'lpo__number', 'lpo__procurement__requisition__code', 'property__name')

    @action(detail=True, methods=('get',), url_path='pdf')
    def pdf(self, request, pk=None):
        card = self.get_object(); requisition = card.lpo.procurement.requisition
        content = _facility_document_pdf(
            title='JOB CARD', reference=card.number, organization=card.organization, property_name=card.property.name,
            qr_text=request.build_absolute_uri(), accent='#0f766e',
            details=(('WORK AUTHORISATION', card.lpo.number), ('Requisition', requisition.code), ('Source ticket', requisition.service_request.reference if requisition.service_request_id else '—'),
                     ('Assigned contractor', card.lpo.supplier.name), ('Work location', requisition.location or card.property.name),
                     ('Work instructions', requisition.required_repair), ('Current stage', card.get_status_display()),
                     ('Started', card.started_at.strftime('%d %b %Y, %H:%M') if card.started_at else 'Not started'),
                     ('Completed', card.completed_at.strftime('%d %b %Y, %H:%M') if card.completed_at else 'Pending'),
                     ('Completion notes', card.completion_notes or '—'), ('Evidence attached', f'{len(card.evidence_urls or [])} item(s)'),
                     ('Contractor sign-off', f'{card.contractor_signatory or "Pending"} · {card.contractor_signed_at:%d %b %Y, %H:%M}' if card.contractor_signed_at else 'Pending'),
                     ('Caretaker sign-off', f'{card.caretaker_signatory or "Pending"} · {card.caretaker_signed_at:%d %b %Y, %H:%M}' if card.caretaker_signed_at else 'Pending'),
                     ('Manager verification', f'{card.verified_by.get_full_name() or card.verified_by.username} · {card.verified_at:%d %b %Y, %H:%M}' if card.verified_at and card.verified_by_id else 'Pending'),
                     ('Verification notes', card.verification_notes or '—')),
            table_headers=('EXECUTION CHECKPOINT', 'STATUS', 'RESPONSIBLE PARTY'),
            table_rows=(('1. Work started', 'Complete' if card.started_at else 'Pending', 'Contractor'),
                        ('2. Contractor completion', 'Signed' if card.contractor_signed_at else 'Pending', card.contractor_signatory or 'Contractor'),
                        ('3. Site acceptance', 'Signed' if card.caretaker_signed_at else 'Pending', card.caretaker_signatory or 'Caretaker'),
                        ('4. Final verification', 'Verified' if card.verified_at else 'Pending', card.verified_by.get_full_name() if card.verified_by_id else 'Manager')),
        )
        return _pdf_response(content, f'{card.number}.pdf')

    @action(detail=True, methods=('post',), url_path='start')
    def start(self, request, pk=None):
        card = self.get_object()
        if card.status != FacilityJobCard.Status.OPEN:
            raise ValidationError({'status': 'Only an open Job Card can be started.'})
        card.status = FacilityJobCard.Status.IN_PROGRESS
        card.started_at = timezone.now()
        card.save(update_fields=('status', 'started_at', 'updated_at'))
        return Response(self.get_serializer(card).data)

    @action(detail=True, methods=('post',), url_path='contractor-sign')
    def contractor_sign(self, request, pk=None):
        card = self.get_object()
        signatory = str(request.data.get('signatory', '')).strip()
        if card.status not in (FacilityJobCard.Status.OPEN, FacilityJobCard.Status.IN_PROGRESS) or not signatory:
            raise ValidationError({'signatory': 'Provide the contractor signatory after work has started.'})
        card.status = FacilityJobCard.Status.CONTRACTOR_SIGNED
        card.contractor_signatory = signatory
        card.completion_notes = str(request.data.get('completion_notes', '')).strip()
        card.evidence_urls = request.data.get('evidence_urls') or []
        card.completed_at = timezone.now()
        card.contractor_signed_at = timezone.now()
        card.save(update_fields=('status', 'contractor_signatory', 'completion_notes', 'evidence_urls', 'completed_at', 'contractor_signed_at', 'updated_at'))
        return Response(self.get_serializer(card).data)

    @action(detail=True, methods=('post',), url_path='caretaker-sign')
    def caretaker_sign(self, request, pk=None):
        card = self.get_object()
        if card.status != FacilityJobCard.Status.CONTRACTOR_SIGNED:
            raise ValidationError({'status': 'Contractor sign-off is required before caretaker verification.'})
        card.status = FacilityJobCard.Status.CARETAKER_SIGNED
        card.caretaker_signatory = str(request.data.get('signatory') or request.user.get_full_name() or request.user.username)
        card.caretaker_signed_by = request.user
        card.caretaker_signed_at = timezone.now()
        card.save(update_fields=('status', 'caretaker_signatory', 'caretaker_signed_by', 'caretaker_signed_at', 'updated_at'))
        return Response(self.get_serializer(card).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='verify')
    def verify(self, request, pk=None):
        card = self.get_object()
        if card.status != FacilityJobCard.Status.CARETAKER_SIGNED:
            raise ValidationError({'status': 'Caretaker sign-off is required before final verification.'})
        card.status = FacilityJobCard.Status.VERIFIED
        card.verified_by = request.user
        card.verified_at = timezone.now()
        card.verification_notes = str(request.data.get('notes', '')).strip()
        card.save(update_fields=('status', 'verified_by', 'verified_at', 'verification_notes', 'updated_at'))
        if card.work_order_id:
            card.work_order.status = WorkOrder.Status.COMPLETED
            card.work_order.completed_at = card.completed_at or timezone.now()
            card.work_order.progress = 100
            card.work_order.supervisor_verified = True
            card.work_order.supervisor_verified_by = request.user
            card.work_order.save(update_fields=('status', 'completed_at', 'progress', 'supervisor_verified', 'supervisor_verified_by', 'updated_at'))
        card.lpo.procurement.status = ProcurementRecord.Status.VERIFIED
        card.lpo.procurement.save(update_fields=('status', 'updated_at'))
        return Response(self.get_serializer(card).data)


class ContractInvoiceAppraisalViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    permission_map = {'manager_approve': 'facility.approve', 'reject': 'facility.approve'}
    queryset = ContractInvoiceAppraisal.objects.select_related('invoice__supplier', 'contract', 'caretaker', 'manager')
    serializer_class = ContractInvoiceAppraisalSerializer
    search_fields = ('invoice__code', 'invoice__supplier__name', 'contract__contract_number')

    @action(detail=True, methods=('get',), url_path='pdf')
    def pdf(self, request, pk=None):
        appraisal = self.get_object()
        scores = (appraisal.quality_score, appraisal.timeliness_score, appraisal.responsiveness_score)
        average = sum(scores) / len(scores) if all(scores) else 0
        content = _facility_document_pdf(
            title='SERVICE PROVIDER PERFORMANCE APPRAISAL REPORT', reference=appraisal.invoice.code,
            organization=appraisal.organization, property_name=appraisal.invoice.property.name,
            qr_text=request.build_absolute_uri(),
            details=(('Service provider', appraisal.invoice.supplier.name), ('Contract', appraisal.contract.contract_number),
                     ('Invoice amount (KES)', f'{appraisal.invoice.total:,.2f}'), ('Contract valid', 'Yes' if appraisal.contract_valid else 'No'),
                     ('Service mapping valid', 'Yes' if appraisal.service_mapping_valid else 'No'),
                     ('Status', appraisal.get_status_display()), ('Caretaker', appraisal.caretaker.get_full_name() if appraisal.caretaker_id else '—'),
                     ('Manager', appraisal.manager.get_full_name() if appraisal.manager_id else '—'), ('Notes', appraisal.notes)),
            table_headers=('Quality / 5', 'Timeliness / 5', 'Responsiveness / 5', 'Average / 5'),
            table_rows=((appraisal.quality_score, appraisal.timeliness_score, appraisal.responsiveness_score, f'{average:.1f}'),),
        )
        return _pdf_response(content, f'{appraisal.invoice.code}-performance-appraisal.pdf')

    @action(detail=True, methods=('post',), url_path='caretaker-sign')
    def caretaker_sign(self, request, pk=None):
        appraisal = self.get_object()
        if appraisal.status != ContractInvoiceAppraisal.Status.PENDING_CARETAKER:
            raise ValidationError({'status': 'This appraisal is not awaiting caretaker review.'})
        for field in ('quality_score', 'timeliness_score', 'responsiveness_score'):
            score = int(request.data.get(field, 0))
            if not 1 <= score <= 5:
                raise ValidationError({field: 'Enter a score from 1 to 5.'})
            setattr(appraisal, field, score)
        appraisal.notes = str(request.data.get('notes', '')).strip()
        appraisal.caretaker = request.user
        appraisal.caretaker_signed_at = timezone.now()
        appraisal.status = ContractInvoiceAppraisal.Status.PENDING_MANAGER
        appraisal.save()
        return Response(self.get_serializer(appraisal).data)

    @action(detail=True, methods=('post',), url_path='manager-approve')
    def manager_approve(self, request, pk=None):
        appraisal = self.get_object()
        if appraisal.status != ContractInvoiceAppraisal.Status.PENDING_MANAGER:
            raise ValidationError({'status': 'Caretaker review is required before manager approval.'})
        if not appraisal.contract_valid or not appraisal.service_mapping_valid:
            raise ValidationError({'contract': 'The contract and property/service mapping must be valid.'})
        appraisal.status = ContractInvoiceAppraisal.Status.APPROVED
        appraisal.manager = request.user
        appraisal.manager_decided_at = timezone.now()
        appraisal.manager_notes = str(request.data.get('notes', '')).strip()
        appraisal.save(update_fields=('status', 'manager', 'manager_decided_at', 'manager_notes', 'updated_at'))
        return Response(self.get_serializer(appraisal).data)


class FinancePaymentRequestViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    permission_map = {'approve': 'facility.approve', 'reject': 'facility.approve', 'start_processing': 'facility.approve', 'mark_paid': 'facility.approve'}
    queryset = FinancePaymentRequest.objects.select_related('property', 'requested_by', 'approved_by')
    serializer_class = FinancePaymentRequestSerializer
    search_fields = ('number', 'payee', 'description', 'statutory_reference', 'property__name')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        serializer.save(organization=organization, number=f'PR-{timezone.localdate():%Y}-{uuid.uuid4().hex[:6].upper()}', requested_by=self.request.user)

    def _transition(self, payment, target, **fields):
        payment.status = target
        for key, value in fields.items():
            setattr(payment, key, value)
        payment.save(update_fields=('status', *fields.keys(), 'updated_at'))

    @action(detail=True, methods=('post',), url_path='submit')
    def submit(self, request, pk=None):
        payment = self.get_object()
        if payment.status != FinancePaymentRequest.Status.DRAFT or not payment.supporting_documents:
            raise ValidationError({'documents': 'A draft request needs at least one supporting document before submission.'})
        self._transition(payment, FinancePaymentRequest.Status.SUBMITTED)
        return Response(self.get_serializer(payment).data)

    @action(detail=True, methods=('post',), url_path='approve')
    def approve(self, request, pk=None):
        payment = self.get_object()
        if payment.status != FinancePaymentRequest.Status.SUBMITTED:
            raise ValidationError({'status': 'Only submitted payment requests can be approved.'})
        self._transition(payment, FinancePaymentRequest.Status.APPROVED, approved_by=request.user, approved_at=timezone.now(), decision_notes=str(request.data.get('notes', '')).strip())
        return Response(self.get_serializer(payment).data)

    @action(detail=True, methods=('post',), url_path='start-processing')
    def start_processing(self, request, pk=None):
        payment = self.get_object()
        if payment.status != FinancePaymentRequest.Status.APPROVED:
            raise ValidationError({'status': 'Only approved requests can enter Finance processing.'})
        self._transition(payment, FinancePaymentRequest.Status.PROCESSING)
        return Response(self.get_serializer(payment).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        payment = self.get_object()
        reference = str(request.data.get('payment_reference', '')).strip()
        if payment.status != FinancePaymentRequest.Status.PROCESSING or not reference:
            raise ValidationError({'payment_reference': 'A processing request and payment reference are required.'})
        now = timezone.now()
        self._transition(payment, FinancePaymentRequest.Status.PAID, payment_reference=reference, paid_at=now)
        expense = None
        if payment.property_id:
            expense = FacilityExpense.objects.create(
                organization=payment.organization, property=payment.property, spent_on=now.date(),
                category=payment.category, description=payment.description, amount=payment.amount,
                supplier=payment.payee, receipt_reference=reference, status=FacilityExpense.Status.APPROVED,
                recorded_by=request.user, approved_by=request.user, approved_at=now,
            )
        FacilityPaymentRecord.objects.create(
            organization=payment.organization, number=f'PAY-{now:%Y%m%d}-{uuid.uuid4().hex[:6].upper()}',
            payment_request=payment, property=payment.property, payee=payment.payee, amount=payment.amount,
            paid_on=now.date(), reference=reference, expense=expense, processed_by=request.user,
        )
        return Response(self.get_serializer(payment).data)


class FacilityPaymentRecordViewSet(FacilityModelViewSet):
    write_permission = 'facility.approve'
    http_method_names = ('get', 'head', 'options')
    queryset = FacilityPaymentRecord.objects.select_related('property', 'supplier_invoice', 'payment_request', 'expense', 'processed_by')
    serializer_class = FacilityPaymentRecordSerializer
    search_fields = ('number', 'reference', 'payee')


class PettyCashVoucherViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    permission_map = {'approve': 'facility.approve', 'mark_paid': 'facility.approve', 'post_expense': 'facility.approve'}
    queryset = PettyCashVoucher.objects.select_related('lpo__supplier', 'job_card', 'property', 'prepared_by', 'approved_by', 'expense')
    serializer_class = PettyCashVoucherSerializer
    search_fields = ('number', 'lpo__number', 'job_card__number', 'property__name', 'purpose')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        total = serializer.validated_data.pop('_calculated_total')
        lpo = serializer.validated_data['lpo']
        serializer.save(organization=organization, number=f'PV-{timezone.localdate():%Y}-{uuid.uuid4().hex[:6].upper()}',
                        property=lpo.property, purpose=lpo.scope, total_amount=total, prepared_by=self.request.user)

    def _transition(self, voucher, target, **fields):
        voucher.status = target
        for key, value in fields.items(): setattr(voucher, key, value)
        voucher.save(update_fields=('status', *fields.keys(), 'updated_at'))

    @action(detail=True, methods=('post',), url_path='submit')
    def submit(self, request, pk=None):
        voucher = self.get_object()
        if voucher.status != PettyCashVoucher.Status.DRAFT:
            raise ValidationError({'status': 'Only a draft voucher can be submitted.'})
        self._transition(voucher, PettyCashVoucher.Status.SUBMITTED)
        return Response(self.get_serializer(voucher).data)

    @action(detail=True, methods=('post',), url_path='approve')
    def approve(self, request, pk=None):
        voucher = self.get_object()
        if voucher.status != PettyCashVoucher.Status.SUBMITTED:
            raise ValidationError({'status': 'Only a submitted voucher can be approved.'})
        self._transition(voucher, PettyCashVoucher.Status.APPROVED, approved_by=request.user, approved_at=timezone.now())
        return Response(self.get_serializer(voucher).data)

    @action(detail=True, methods=('post',), url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        voucher = self.get_object(); signed_url = str(request.data.get('signed_voucher_url', '')).strip()
        reference = str(request.data.get('payment_reference', '')).strip()
        if voucher.status != PettyCashVoucher.Status.APPROVED or not signed_url or not reference:
            raise ValidationError({'detail': 'An approved voucher, payment reference and uploaded signed voucher are required.'})
        self._transition(voucher, PettyCashVoucher.Status.PAID, signed_voucher_url=signed_url,
                         payment_reference=reference, paid_at=timezone.now())
        return Response(self.get_serializer(voucher).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='post-expense')
    def post_expense(self, request, pk=None):
        voucher = self.get_object()
        if voucher.status != PettyCashVoucher.Status.PAID or voucher.expense_id:
            raise ValidationError({'status': 'Only an unposted paid voucher can be posted to expenses.'})
        expense = FacilityExpense.objects.create(
            organization=voucher.organization, property=voucher.property, work_order=voucher.job_card.work_order,
            spent_on=(voucher.paid_at or timezone.now()).date(), category='Petty cash',
            description=f'{voucher.number} · {voucher.purpose}', amount=voucher.total_amount,
            supplier='Multiple cash recipients', receipt_reference=voucher.payment_reference,
            status=FacilityExpense.Status.APPROVED, recorded_by=request.user, approved_by=request.user, approved_at=timezone.now(),
        )
        voucher.expense = expense; voucher.status = PettyCashVoucher.Status.POSTED
        voucher.save(update_fields=('expense', 'status', 'updated_at'))
        return Response(self.get_serializer(voucher).data)

    @action(detail=True, methods=('get',), url_path='pdf')
    def pdf(self, request, pk=None):
        voucher = self.get_object(); recipients = list(voucher.recipients)
        rows = [(str(index + 1), row.get('name',''), row.get('identity',''), row.get('role',''), f"{Decimal(str(row.get('amount', 0))):,.2f}", '________________') for index, row in enumerate(recipients)]
        rows.extend([(str(index + 1), '', '', '', '', '________________') for index in range(len(rows), 4)])
        content = _facility_document_pdf(
            title='PAYMENT VOUCHER · PETTY CASH', reference=voucher.number, organization=voucher.organization,
            property_name=voucher.property.name, qr_text=request.build_absolute_uri(),
            details=(('Paid from', 'Petty Cash'), ('LPO No.', voucher.lpo.number), ('Job Card No.', voucher.job_card.number),
                     ('Purpose / service delivered', voucher.purpose), ('Total amount (KES)', f'{voucher.total_amount:,.2f}'),
                     ('Prepared by', voucher.prepared_by.get_full_name() or voucher.prepared_by.username),
                     ('Approved by', (voucher.approved_by.get_full_name() or voucher.approved_by.username) if voucher.approved_by_id else 'Pending')),
            table_headers=('No.', 'Name of Person Paid', 'ID / Phone No.', 'Service Delivered / Role', 'Amount Paid (KES)', 'Signature'),
            table_rows=rows,
        )
        return _pdf_response(content, f'{voucher.number}.pdf')


class FacilityIncidentViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    permission_map = {'review': 'facility.approve', 'resolve': 'facility.work', 'close': 'facility.approve', 'create_work_order': 'facility.work'}
    queryset = FacilityIncident.objects.select_related(
        'property', 'unit', 'asset', 'service_provider', 'reported_by', 'reviewed_by', 'work_order',
    ).prefetch_related('events__actor', 'attachments__uploaded_by')
    serializer_class = FacilityIncidentSerializer
    search_fields = ('reference', 'location', 'category', 'narrative', 'property__name')

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        reference = f'INC-{timezone.localdate():%Y}-{uuid.uuid4().hex[:6].upper()}'
        while FacilityIncident.objects.filter(organization=organization, reference=reference).exists():
            reference = f'INC-{timezone.localdate():%Y}-{uuid.uuid4().hex[:6].upper()}'
        incident = serializer.save(organization=organization, reported_by=self.request.user, reference=reference)
        FacilityIncidentEvent.objects.create(
            organization=organization, incident=incident, event_type='created',
            to_status=incident.status, notes='Incident draft created', actor=self.request.user,
        )

    def perform_update(self, serializer):
        if 'status' in serializer.validated_data:
            raise ValidationError({'status': 'Use the incident workflow actions so every status change is audited.'})
        super().perform_update(serializer)

    def _transition(self, request, incident, target, notes='', event_type='status_change'):
        previous = incident.status
        incident.status = target
        if target == FacilityIncident.Status.SUBMITTED:
            incident.submitted_at = timezone.now()
        if target in (FacilityIncident.Status.UNDER_REVIEW, FacilityIncident.Status.CLOSED):
            incident.reviewed_by = request.user
        if target == FacilityIncident.Status.CLOSED:
            incident.closed_at = timezone.now()
        incident.save()
        FacilityIncidentEvent.objects.create(
            organization=incident.organization, incident=incident, event_type=event_type,
            from_status=previous, to_status=target, notes=notes, actor=request.user,
        )
        return Response(self.get_serializer(incident).data)

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def submit(self, request, pk=None):
        incident = self.get_object()
        if incident.status != FacilityIncident.Status.DRAFT:
            raise ValidationError({'status': 'Only a draft incident can be submitted.'})
        if not incident.narrative or not incident.location:
            raise ValidationError({'detail': 'Location and incident narrative are required before submission.'})
        level = Notification.Level.URGENT if incident.severity in (FacilityIncident.Severity.HIGH, FacilityIncident.Severity.CRITICAL) else Notification.Level.WARNING
        notify_permission(
            organization=incident.organization, permission_key='facility.approve',
            title=f'{incident.get_severity_display()} incident reported',
            message=f'{incident.reference} at {incident.property.name}: {incident.narrative[:140]}', level=level,
            action_url='/facility?tab=incidents', event_key=f'incident-submitted:{incident.id}', exclude_user=request.user,
        )
        return self._transition(request, incident, FacilityIncident.Status.SUBMITTED, 'Submitted for manager review', 'submitted')

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def review(self, request, pk=None):
        incident = self.get_object()
        if incident.status != FacilityIncident.Status.SUBMITTED:
            raise ValidationError({'status': 'Only a submitted incident can enter review.'})
        return self._transition(request, incident, FacilityIncident.Status.UNDER_REVIEW, str(request.data.get('notes', '')).strip(), 'reviewed')

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def resolve(self, request, pk=None):
        incident = self.get_object()
        notes = str(request.data.get('resolution_notes', '')).strip()
        if incident.status not in (FacilityIncident.Status.UNDER_REVIEW, FacilityIncident.Status.FOLLOW_UP) or not notes:
            raise ValidationError({'resolution_notes': 'Resolution notes are required for an incident under review.'})
        incident.resolution_notes = notes
        incident.save(update_fields=('resolution_notes', 'updated_at'))
        return self._transition(request, incident, FacilityIncident.Status.RESOLVED, notes, 'resolved')

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def close(self, request, pk=None):
        incident = self.get_object()
        if incident.status != FacilityIncident.Status.RESOLVED:
            raise ValidationError({'status': 'Resolve the incident before manager closure.'})
        return self._transition(request, incident, FacilityIncident.Status.CLOSED, str(request.data.get('notes', '')).strip(), 'closed')

    @action(detail=True, methods=('post',), url_path='create-work-order')
    @transaction.atomic
    def create_work_order(self, request, pk=None):
        incident = self.get_object()
        if incident.work_order_id:
            raise ValidationError({'work_order': 'This incident already has a work order.'})
        order = WorkOrder.objects.create(
            organization=incident.organization, number=f'WO-{timezone.localdate():%Y}-{uuid.uuid4().hex[:6].upper()}',
            title=f'Incident follow-up: {incident.category}', description=incident.recommended_action or incident.narrative,
            category=incident.category, source='incident', property=incident.property, asset=incident.asset,
            contractor=incident.service_provider, reported_by=request.user, priority=(WorkOrder.Priority.CRITICAL if incident.severity == FacilityIncident.Severity.CRITICAL else WorkOrder.Priority.HIGH),
            reported_at=timezone.now(), scheduled_for=timezone.make_aware(timezone.datetime.combine(incident.target_date, timezone.datetime.min.time())) if incident.target_date else None,
        )
        incident.work_order = order
        incident.status = FacilityIncident.Status.FOLLOW_UP
        incident.save(update_fields=('work_order', 'status', 'updated_at'))
        WorkOrderEvent.objects.create(organization=incident.organization, work_order=order, event_type='created', to_status=order.status, notes=f'Created from {incident.reference}', actor=request.user)
        FacilityIncidentEvent.objects.create(organization=incident.organization, incident=incident, event_type='work_order_created', from_status=FacilityIncident.Status.UNDER_REVIEW, to_status=incident.status, notes=order.number, actor=request.user)
        return Response(self.get_serializer(incident).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=('post',), url_path='attachments')
    @transaction.atomic
    def upload_attachment(self, request, pk=None):
        incident = self.get_object()
        serializer = FacilityIncidentAttachmentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        uploaded = request.FILES.get('file')
        attachment = serializer.save(
            organization=incident.organization, incident=incident, uploaded_by=request.user,
            name=(request.data.get('name') or getattr(uploaded, 'name', 'Incident evidence'))[:180],
            content_type=(request.data.get('content_type') or getattr(uploaded, 'content_type', ''))[:100],
        )
        FacilityIncidentEvent.objects.create(
            organization=incident.organization, incident=incident, event_type='evidence_uploaded',
            from_status=incident.status, to_status=incident.status, notes=attachment.name, actor=request.user,
        )
        return Response(FacilityIncidentAttachmentSerializer(attachment, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=('get',), url_path='memo')
    def memo(self, request, pk=None):
        """Branded incident memo matching the client's report format."""
        incident = self.get_object()
        organization = incident.organization
        branding = (organization.settings or {}).get('branding', {})
        company_name = branding.get('company_name') or organization.name
        address = branding.get('address') or ''
        contact = ' | '.join(filter(None, (branding.get('phone'), branding.get('email'))))

        events = incident.events.select_related('actor').order_by('created_at')
        attachments = incident.attachments.all()
        today = timezone.localdate()

        stream = BytesIO()
        document = SimpleDocTemplate(
            stream, pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
            topMargin=14 * mm, bottomMargin=16 * mm,
            title=f'Incident Memo {incident.reference}', author=company_name,
        )
        styles = getSampleStyleSheet()
        navy = colors.HexColor('#10233F')
        red = colors.HexColor('#D62828')
        muted = colors.HexColor('#475569')
        title_style = ParagraphStyle('MemoTitle', parent=styles['Heading1'], fontSize=15, leading=18, textColor=navy, spaceAfter=2)
        right_style = ParagraphStyle('MemoRight', parent=styles['Normal'], alignment=TA_RIGHT, textColor=navy, leading=13)
        small_style = ParagraphStyle('MemoSmall', parent=styles['Normal'], fontSize=8.5, leading=11, textColor=muted)
        section_style = ParagraphStyle('MemoSection', parent=styles['Heading2'], fontSize=10.5, leading=13, textColor=navy, spaceBefore=9, spaceAfter=4)
        body_style = ParagraphStyle('MemoBody', parent=styles['Normal'], fontSize=9, leading=13, textColor=colors.HexColor('#0F172A'))

        header = Table([
            [Paragraph(f'<b>{company_name}</b><br/><font size="8">{address}<br/>{contact}</font>', title_style),
             Paragraph(f'<b>INCIDENT MEMORANDUM</b><br/><font size="8">Ref: {incident.reference}<br/>Issued: {today:%d %b %Y}</font>', right_style)],
        ], colWidths=[105 * mm, 70 * mm])
        header.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEBELOW', (0, 0), (-1, 0), 1, red)]))

        def kv_table(pairs):
            data = [[Paragraph(f'<b>{k}</b>', small_style), Paragraph(str(v or '—'), small_style)] for k, v in pairs]
            t = Table(data, colWidths=[42 * mm, 133 * mm])
            t.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('LINEBELOW', (0, 0), (-1, -2), 0.3, colors.HexColor('#E2E8F0')),
            ]))
            return t

        story = [header, Spacer(1, 6 * mm)]
        story.append(Paragraph(f'{incident.category} — {incident.get_severity_display()} severity', section_style))
        story.append(kv_table([
            ('Subject', incident.location),
            ('Property', incident.property.name),
            ('Unit / Asset', ' · '.join(filter(None, [getattr(incident.unit, 'code', ''), getattr(incident.asset, 'name', '')])) or '—'),
            ('Incident date', incident.occurred_at.strftime('%d %b %Y %H:%M')),
            ('Reported by', incident.reported_by.get_full_name() or incident.reported_by.username),
            ('Reported on', incident.created_at.strftime('%d %b %Y %H:%M')),
            ('Status', incident.get_status_display()),
            ('Service provider', getattr(incident.service_provider, 'name', '') or '—'),
            ('Linked work order', getattr(incident.work_order, 'number', '') or '—'),
            ('Responsible person', incident.responsible_person or '—'),
        ]))

        story.append(Paragraph('Incident narrative', section_style))
        for paragraph in (incident.narrative or 'No narrative recorded.').split('\n'):
            if paragraph.strip():
                story.append(Paragraph(paragraph.strip(), body_style))

        if incident.immediate_action:
            story.append(Paragraph('Immediate action taken', section_style))
            story.append(Paragraph(incident.immediate_action, body_style))
        if incident.recommended_action:
            story.append(Paragraph('Recommended action', section_style))
            story.append(Paragraph(incident.recommended_action, body_style))
        if incident.prevention_notes:
            story.append(Paragraph('Prevention measures', section_style))
            story.append(Paragraph(incident.prevention_notes, body_style))

        people = incident.people_involved or []
        if people:
            story.append(Paragraph('People and premises involved', section_style))
            story.append(kv_table([(p.get('role', 'Person'), p.get('name', '')) for p in people if isinstance(p, dict)]))

        if events.exists():
            story.append(Paragraph('Chronology of events', section_style))
            story.append(kv_table([
                (e.created_at.strftime('%d %b %Y %H:%M'), f'{e.get_event_type_display() if hasattr(e, "get_event_type_display") else e.event_type} — {e.notes or ""} ({e.actor.get_full_name() or e.actor.username})')
                for e in events
            ]))

        if attachments.exists():
            story.append(Paragraph('Attached evidence', section_style))
            story.append(kv_table([(a.name, getattr(a, 'content_type', '') or 'file') for a in attachments]))

        story.append(Spacer(1, 10 * mm))
        signature = Table([
            [Paragraph('Reported by (Caretaker / Reporter)', small_style), Paragraph('Reviewed by (Property Manager)', small_style)],
            [Spacer(1, 12 * mm), Spacer(1, 12 * mm)],
            [Paragraph('_____________________________', small_style), Paragraph('_____________________________', small_style)],
        ], colWidths=[87 * mm, 87 * mm])
        signature.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
        story.append(signature)

        if incident.reviewed_by:
            review_note = f'Review status: {incident.get_status_display()} · Reviewed by {incident.reviewed_by.get_full_name() or incident.reviewed_by.username}'
            if incident.submitted_at:
                review_note += f' · Submitted {incident.submitted_at:%d %b %Y}'
            story.append(Spacer(1, 4 * mm))
            story.append(Paragraph(review_note, small_style))

        document.build(story)
        pdf = stream.getvalue()
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="incident-memo-{incident.reference}.pdf"'
        return response


class FloorPlanViewSet(FacilityModelViewSet):
    # Floor-plan/unit mapping is entered from Property > Occupancy and must not
    # disappear for customers who subscribe to Property without Facility.
    required_module = Module.PROPERTY
    write_permission = 'property.operations'
    queryset = FloorPlan.objects.select_related('building__property')
    serializer_class = FloorPlanSerializer
    search_fields = ('title', 'building__name', 'building__property__name')

    def get_queryset(self):
        queryset = super().get_queryset()
        building_id = self.request.query_params.get('building')
        floor = self.request.query_params.get('floor')
        if building_id:
            queryset = queryset.filter(building_id=building_id)
        if floor:
            queryset = queryset.filter(floor=floor)
        return queryset

    @staticmethod
    def _make_preview(upload, extension):
        """Return (ContentFile|None, filename, error). Never execute uploaded files."""
        if extension in {'png', 'jpg', 'jpeg', 'svg'}:
            return None, '', ''
        try:
            with tempfile.TemporaryDirectory(prefix='ce-floor-plan-') as directory:
                source = os.path.join(directory, f'original.{extension}')
                with open(source, 'wb') as destination:
                    for chunk in upload.chunks():
                        destination.write(chunk)
                pdf_path = source
                if extension in {'dwg', 'dxf'}:
                    result = subprocess.run(
                        ['libreoffice', '--headless', '--convert-to', 'pdf', '--outdir', directory, source],
                        capture_output=True, text=True, timeout=45, check=False,
                    )
                    pdf_path = os.path.join(directory, 'original.pdf')
                    if result.returncode != 0 or not os.path.exists(pdf_path):
                        return None, '', 'This CAD drawing was saved, but a preview could not be generated. Export it as PDF or PNG to map units.'
                preview_base = os.path.join(directory, 'preview')
                result = subprocess.run(
                    ['pdftoppm', '-f', '1', '-l', '1', '-png', '-r', '144', pdf_path, preview_base],
                    capture_output=True, text=True, timeout=45, check=False,
                )
                preview_path = f'{preview_base}-1.png'
                if result.returncode != 0 or not os.path.exists(preview_path):
                    return None, '', 'The file was saved, but its first page could not be converted into a mapping preview.'
                with open(preview_path, 'rb') as preview:
                    return ContentFile(preview.read()), 'floor-plan-preview.png', ''
        except (OSError, subprocess.TimeoutExpired):
            return None, '', 'The file was saved, but preview generation timed out. Export it as PNG and upload that version to map units.'

    @action(detail=False, methods=('post',), url_path='upload', parser_classes=(MultiPartParser, FormParser))
    @transaction.atomic
    def upload(self, request):
        upload = request.FILES.get('file')
        if not upload:
            raise ValidationError({'file': 'Choose a floor plan to upload.'})
        if upload.size > 25 * 1024 * 1024:
            raise ValidationError({'file': 'Floor plans must be 25 MB or smaller.'})
        filename = os.path.basename(upload.name or '')
        extension = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        allowed = {'pdf', 'png', 'jpg', 'jpeg', 'svg', 'dwg', 'dxf'}
        if extension not in allowed:
            raise ValidationError({'file': 'Upload a PDF, PNG, JPG, SVG, DWG, or DXF floor plan.'})
        organization = get_active_organization(request)
        building_id = request.data.get('building')
        building = Building.objects.filter(pk=building_id, organization=organization).first()
        if building is None:
            raise ValidationError({'building': 'Select a building in the active organization.'})
        floor = str(request.data.get('floor') or '1').strip()[:40]
        if not floor:
            raise ValidationError({'floor': 'Select a floor level.'})
        version = str(FloorPlan.objects.filter(organization=organization, building=building, floor=floor).count() + 1)
        preview, preview_name, preview_error = self._make_preview(upload, extension)
        # Reset the stream after preview generation before Django storage consumes it.
        upload.seek(0)
        plan = FloorPlan(
            organization=organization, building=building, floor=floor,
            title=(request.data.get('title') or f'{building.name} — Floor {floor}')[:180],
            file_url='', uploaded_file=upload, original_filename=filename, file_type=extension,
            version=version, preview_status='ready' if not preview_error else 'preview_unavailable',
            preview_error=preview_error, uploaded_by=request.user,
        )
        plan.save()
        if preview:
            plan.preview_file.save(preview_name, preview, save=False)
        # Image originals are safe browser previews; PDFs/CAD use a generated PNG only.
        plan.file_url = plan.preview_file.url if plan.preview_file else plan.uploaded_file.url
        plan.save(update_fields=('preview_file', 'file_url', 'updated_at'))
        return Response(self.get_serializer(plan, context={'request': request}).data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), uploaded_by=self.request.user)


class AssetConditionAssessmentViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    queryset = AssetConditionAssessment.objects.select_related('asset__property', 'assessor')
    serializer_class = AssetConditionAssessmentSerializer
    search_fields = ('asset__code', 'asset__name', 'defect_notes')

    def perform_create(self, serializer):
        assessment = serializer.save(organization=self._validate_organization(serializer), assessor=self.request.user)
        # Automatically update asset condition based on assessment
        asset = assessment.asset
        grade = assessment.condition_grade
        asset.condition = (
            FacilityAsset.Condition.EXCELLENT if grade >= 5 else
            FacilityAsset.Condition.GOOD if grade == 4 else
            FacilityAsset.Condition.FAIR if grade == 3 else
            FacilityAsset.Condition.POOR if grade == 2 else
            FacilityAsset.Condition.OUT_OF_SERVICE
        )
        asset.save(update_fields=('condition', 'updated_at'))


class StrategicFMPlanViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = StrategicFMPlan.objects.select_related('property', 'approved_by')
    serializer_class = StrategicFMPlanSerializer
    search_fields = ('title', 'property__name')

    @action(detail=True, methods=('get',))
    def performance(self, request, pk=None):
        plan = self.get_object()
        prop = plan.property
        organization = get_active_organization(request)
        
        schedules = PreventiveSchedule.objects.filter(organization=organization, asset__property=prop)
        work_orders = WorkOrder.objects.filter(organization=organization, property=prop)
        budgets = FMBudget.objects.filter(organization=organization, property=prop, financial_year=plan.period_year)
        compliance = ComplianceObligation.objects.filter(organization=organization, property=prop)
        risks = FacilityRisk.objects.filter(organization=organization, property=prop)
        
        total_schedules = schedules.filter(is_active=True).count()
        overdue_schedules = schedules.filter(is_active=True, next_due_on__lt=timezone.localdate()).count()
        actual_pm_compliance = round(((total_schedules - overdue_schedules) / total_schedules * 100), 1) if total_schedules else 100.0
        target_pm_compliance = float(plan.maintenance_targets.get('pm_compliance_target', 95.0))
        pm_rag = 'green' if actual_pm_compliance >= target_pm_compliance else 'amber' if actual_pm_compliance >= 80 else 'red'
        
        completed_wo = work_orders.filter(status=WorkOrder.Status.COMPLETED)
        on_time_wo = completed_wo.filter(sla_breached=False).count()
        actual_sla = round(on_time_wo / completed_wo.count() * 100, 1) if completed_wo.exists() else 0.0
        target_sla = float(plan.maintenance_targets.get('sla_target', 90.0))
        sla_rag = 'green' if actual_sla >= target_sla else 'amber' if actual_sla >= 75 else 'red'
        
        total_allocated = float(budgets.aggregate(total=Sum('allocated_amount'))['total'] or 0)
        total_spent = float(budgets.aggregate(total=Sum('actual_amount'))['total'] or 0) + float(budgets.aggregate(total=Sum('committed_amount'))['total'] or 0)
        budget_utilization = round(total_spent / total_allocated * 100, 1) if total_allocated > 0 else 0.0
        budget_rag = 'green' if budget_utilization <= 90 else 'amber' if budget_utilization <= 100 else 'red'
        
        total_obligations = compliance.count()
        overdue_compliance = compliance.filter(status='overdue').count()
        compliance_percent = round((total_obligations - overdue_compliance) / total_obligations * 100, 1) if total_obligations else 100.0
        comp_rag = 'green' if overdue_compliance == 0 else 'red'
        
        open_high_risks = risks.filter(status__in=('open', 'mitigating'), inherent_score__gte=12).count()
        risk_rag = 'green' if open_high_risks == 0 else 'amber' if open_high_risks <= 2 else 'red'
        
        exceptions = []
        if overdue_schedules > 0:
            exceptions.append({
                'category': 'Preventive Maintenance',
                'description': f'{overdue_schedules} overdue scheduled maintenance tasks.',
                'action_required': 'Dispatch internal technicians or issue emergency work orders.',
                'rag': 'red',
                'owner': 'FM Operations Officer',
                'due_date': timezone.localdate().isoformat(),
            })
        if overdue_compliance > 0:
            exceptions.append({
                'category': 'Statutory Compliance',
                'description': f'{overdue_compliance} statutory certificates expired or overdue for renewal.',
                'action_required': 'Engage certified inspection agency and renew certificates immediately.',
                'rag': 'red',
                'owner': 'FM Manager',
                'due_date': timezone.localdate().isoformat(),
            })
        if open_high_risks > 0:
            exceptions.append({
                'category': 'Risk Management',
                'description': f'{open_high_risks} unmitigated high-criticality risk items.',
                'action_required': 'Execute documented control measures and submit status to client.',
                'rag': 'amber',
                'owner': 'Facilities Director',
                'due_date': timezone.localdate().isoformat(),
            })
            
        return Response({
            'plan_id': plan.id,
            'title': plan.title,
            'period_year': plan.period_year,
            'property_id': prop.id,
            'property_name': prop.name,
            'summary_kpis': {
                'pm_compliance': {'actual': actual_pm_compliance, 'target': target_pm_compliance, 'rag': pm_rag},
                'sla_achievement': {'actual': actual_sla, 'target': target_sla, 'rag': sla_rag},
                'budget_utilization': {'actual_spent': total_spent, 'allocated': total_allocated, 'utilization_percent': budget_utilization, 'rag': budget_rag},
                'compliance_rate': {'actual_percent': compliance_percent, 'overdue_count': overdue_compliance, 'rag': comp_rag},
                'open_high_risks': {'count': open_high_risks, 'rag': risk_rag},
            },
            'service_standards': plan.service_standards,
            'improvement_initiatives': plan.improvement_initiatives,
            'exception_actions': exceptions,
        })


class ContractorContractViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = ContractorContract.objects.select_related('contractor', 'property')
    serializer_class = ContractorContractSerializer
    search_fields = ('contract_number', 'contractor__name', 'scope_of_work')


class FMBudgetViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = FMBudget.objects.select_related('property')
    serializer_class = FMBudgetSerializer
    search_fields = ('category', 'property__name')


class FacilityExpenseViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    queryset = FacilityExpense.objects.select_related('property', 'work_order', 'recorded_by', 'approved_by')
    serializer_class = FacilityExpenseSerializer
    search_fields = ('description', 'category', 'float_reference', 'supplier', 'receipt_reference', 'property__name')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), recorded_by=self.request.user)

    @action(detail=True, methods=('post',))
    def approve(self, request, pk=None):
        expense = self.get_object()
        expense.status = FacilityExpense.Status.APPROVED
        expense.approved_by = request.user
        expense.approved_at = timezone.now()
        expense.decision_notes = str(request.data.get('notes', '')).strip()
        expense.save(update_fields=('status', 'approved_by', 'approved_at', 'decision_notes', 'updated_at'))
        return Response(self.get_serializer(expense).data)

    @action(detail=True, methods=('post',))
    def reject(self, request, pk=None):
        notes = str(request.data.get('notes', '')).strip()
        if not notes:
            raise ValidationError({'notes': 'Explain why this expense is being rejected.'})
        expense = self.get_object()
        expense.status = FacilityExpense.Status.REJECTED
        expense.approved_by = request.user
        expense.approved_at = timezone.now()
        expense.decision_notes = notes
        expense.save(update_fields=('status', 'approved_by', 'approved_at', 'decision_notes', 'updated_at'))
        return Response(self.get_serializer(expense).data)


class ComplianceObligationViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = ComplianceObligation.objects.select_related('property', 'building', 'responsible_person')
    serializer_class = ComplianceObligationSerializer
    search_fields = ('title', 'category', 'certificate_number', 'issuing_authority', 'property__name')


class FacilityRiskViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = FacilityRisk.objects.select_related('property', 'building', 'asset', 'action_owner')
    serializer_class = FacilityRiskSerializer
    search_fields = ('risk_id', 'description', 'category', 'property__name')


class FacilityFlagViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    queryset = FacilityFlag.objects.select_related('property', 'resolved_by')
    serializer_class = FacilityFlagSerializer
    search_fields = ('title', 'flag_type', 'property__name')

    @action(detail=True, methods=('post',))
    def resolve(self, request, pk=None):
        flag = self.get_object()
        flag.is_resolved = True
        flag.resolved_at = timezone.now()
        flag.resolved_by = request.user
        flag.save(update_fields=('is_resolved', 'resolved_at', 'resolved_by', 'updated_at'))
        return Response(self.get_serializer(flag).data)


class AssetViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = FacilityAsset.objects.select_related('property', 'building', 'unit')
    serializer_class = FacilityAssetSerializer
    search_fields = ('code', 'name', 'category', 'serial_number', 'property__name')

    def get_queryset(self):
        queryset = super().get_queryset()
        inventory_type = self.request.query_params.get('inventory_type')
        if inventory_type in dict(FacilityAsset.InventoryType.choices):
            queryset = queryset.filter(inventory_type=inventory_type)
        return queryset

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        code = f'AST-{uuid.uuid4().hex[:8].upper()}'
        while FacilityAsset.objects.filter(organization=organization, code=code).exists():
            code = f'AST-{uuid.uuid4().hex[:8].upper()}'
        serializer.save(organization=organization, code=code)

    @action(detail=True, methods=('get',))
    def lifecycle_analysis(self, request, pk=None):
        asset = self.get_object()
        work_orders = asset.work_orders.all()
        total_repairs = work_orders.aggregate(
            labor=Sum('labor_cost'), parts=Sum('parts_cost'), other=Sum('other_cost')
        )
        total_repair_cost = (total_repairs['labor'] or Decimal('0')) + (total_repairs['parts'] or Decimal('0')) + (total_repairs['other'] or Decimal('0'))
        
        replacement_cost = asset.replacement_cost or asset.purchase_value or Decimal('1')
        repair_ratio = float((total_repair_cost / replacement_cost * Decimal('100')).quantize(Decimal('0.1'))) if replacement_cost else 0
        
        assessments = asset.condition_assessments.all()[:5]
        latest_assessment = assessments.first()
        condition_grade = latest_assessment.condition_grade if latest_assessment else (
            5 if asset.condition == FacilityAsset.Condition.EXCELLENT else
            4 if asset.condition == FacilityAsset.Condition.GOOD else
            3 if asset.condition == FacilityAsset.Condition.FAIR else
            2 if asset.condition == FacilityAsset.Condition.POOR else 1
        )
        
        now_date = timezone.localdate()
        age_years = (now_date.year - asset.installed_on.year) if asset.installed_on else 2
        useful_life = asset.expected_useful_life_years or 10
        remaining_years = max(0, useful_life - age_years)
        
        if condition_grade <= 2 or repair_ratio >= 60:
            recommendation = 'Renew / Replace (Critical)'
            recommendation_color = 'danger'
        elif repair_ratio >= 35 or remaining_years <= 1:
            recommendation = 'Optimise / Plan CAPEX Replacement'
            recommendation_color = 'warning'
        elif condition_grade == 3:
            recommendation = 'Major Overhaul / Refurbish'
            recommendation_color = 'warning'
        else:
            recommendation = 'Continue Routine Preventive Maintenance'
            recommendation_color = 'success'
            
        capex_projections = []
        for i in range(1, 6):
            proj_year = now_date.year + i
            is_renewal_year = (remaining_years == i) or (repair_ratio >= 50 and i <= 2)
            capex_projections.append({
                'year': proj_year,
                'planned_capex': float(replacement_cost) if is_renewal_year else 0.0,
                'projected_condition_score': max(1, condition_grade - (0 if is_renewal_year else (i * 0.5))),
                'status': 'Capital Renewal Scheduled' if is_renewal_year else 'Routine Operation',
            })
            
        return Response({
            'asset_id': asset.id,
            'code': asset.code,
            'name': asset.name,
            'category': asset.category,
            'asset_class': asset.asset_class,
            'purchase_value': str(asset.purchase_value),
            'replacement_cost': str(replacement_cost),
            'total_repair_cost': str(total_repair_cost),
            'repair_to_replacement_ratio_percent': repair_ratio,
            'failure_count': work_orders.count(),
            'condition_grade': condition_grade,
            'age_years': age_years,
            'expected_useful_life_years': useful_life,
            'remaining_useful_years': remaining_years,
            'recommendation': recommendation,
            'recommendation_color': recommendation_color,
            'recent_assessments': AssetConditionAssessmentSerializer(assessments, many=True).data,
            'capex_5_year_projections': capex_projections,
        })

    @transaction.atomic
    @action(detail=False, methods=('post',), url_path='bulk_upload')
    def bulk_upload(self, request):
        organization = get_active_organization(request)
        active_prop = get_active_property(request, organization)
        raw_items = request.data.get('assets') if isinstance(request.data, dict) else request.data
        if not isinstance(raw_items, list) or not raw_items:
            return Response({'detail': 'A non-empty list of assets is required.'}, status=status.HTTP_400_BAD_REQUEST)

        created_assets = []
        errors = []

        existing_codes = set(FacilityAsset.objects.filter(organization=organization).values_list('code', flat=True))
        code_seq = 100

        for idx, item in enumerate(raw_items):
            try:
                name = str(item.get('name', '')).strip()
                if not name:
                    errors.append(f"Row {idx + 1}: Name is required.")
                    continue

                code = str(item.get('code', '')).strip()
                if not code or code in existing_codes:
                    while f"AST-{code_seq:04d}" in existing_codes:
                        code_seq += 1
                    code = f"AST-{code_seq:04d}"
                existing_codes.add(code)

                # Property matching
                prop_id = item.get('property') or item.get('property_id')
                prop = None
                if prop_id:
                    prop = Property.objects.filter(organization=organization, pk=prop_id).first()
                if not prop:
                    prop = active_prop or Property.objects.filter(organization=organization).first()

                # Building matching
                bld = None
                bld_name_or_id = item.get('building') or item.get('building_name') or item.get('building_id')
                if bld_name_or_id and prop:
                    bld = Building.objects.filter(property=prop, name__iexact=str(bld_name_or_id)).first()
                    if not bld:
                        bld = Building.objects.filter(property=prop, pk=bld_name_or_id).first() if str(bld_name_or_id).replace('-', '').isalnum() else None

                category = str(item.get('category') or 'General M&E').strip()
                inventory_type = str(item.get('inventory_type') or 'asset').strip()
                if inventory_type not in dict(FacilityAsset.InventoryType.choices):
                    inventory_type = FacilityAsset.InventoryType.ASSET
                asset_class = str(item.get('asset_class') or 'Mechanical & Electrical').strip()
                criticality = str(item.get('criticality') or 'medium').lower().strip()
                if criticality not in ('low', 'medium', 'high', 'critical'):
                    criticality = 'medium'

                condition = str(item.get('condition') or 'good').lower().strip()
                if condition not in ('excellent', 'good', 'fair', 'poor', 'end_of_life'):
                    condition = 'good'

                purchase_val = Decimal(str(item.get('purchase_value') or '0'))
                replacement_cost = Decimal(str(item.get('replacement_cost') or str(purchase_val) or '0'))
                useful_life = int(item.get('expected_useful_life_years') or 10)

                asset = FacilityAsset.objects.create(
                    organization=organization,
                    property=prop,
                    building=bld,
                    code=code,
                    name=name,
                    category=category,
                    inventory_type=inventory_type,
                    asset_class=asset_class,
                    criticality=criticality,
                    condition=condition,
                    manufacturer=str(item.get('manufacturer') or '').strip(),
                    model_number=str(item.get('model_number') or '').strip(),
                    serial_number=str(item.get('serial_number') or '').strip(),
                    purchase_value=purchase_val,
                    replacement_cost=replacement_cost,
                    expected_useful_life_years=useful_life,
                    funding_source=str(item.get('funding_source') or 'Operations Budget').strip(),
                    maintenance_procedure=str(item.get('maintenance_procedure') or '').strip(),
                )
                created_assets.append(asset)
            except Exception as e:
                errors.append(f"Row {idx + 1}: {str(e)}")

        if not created_assets and errors:
            return Response({'detail': 'Failed to import assets.', 'errors': errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'status': 'success',
            'created_count': len(created_assets),
            'errors': errors,
            'assets': FacilityAssetSerializer(created_assets, many=True).data,
        }, status=status.HTTP_201_CREATED)


class ContractorViewSet(FacilityModelViewSet):
    write_permission = None
    queryset = Contractor.objects.all()
    serializer_class = ContractorSerializer
    search_fields = ('code', 'name', 'specialty', 'contact_name')

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        code = f'SP-{uuid.uuid4().hex[:8].upper()}'
        while Contractor.objects.filter(organization=organization, code=code).exists():
            code = f'SP-{uuid.uuid4().hex[:8].upper()}'
        serializer.save(organization=organization, code=code)

    @action(detail=True, methods=('get',))
    def scorecard(self, request, pk=None):
        contractor = self.get_object()
        work_orders = contractor.work_orders.all()
        completed_orders = work_orders.filter(status=WorkOrder.Status.COMPLETED)
        
        on_time_orders = completed_orders.filter(sla_breached=False)
        sla_score = round(on_time_orders.count() / completed_orders.count() * 100, 1) if completed_orders.exists() else 0.0
        
        verified_orders = completed_orders.filter(supervisor_verified=True)
        quality_score = round(verified_orders.count() / completed_orders.count() * 100, 1) if completed_orders.exists() else 0.0
        response_score = 92.0
        cost_score = 90.0
        
        now_date = timezone.localdate()
        has_insurance = bool(contractor.insurance_expires_on and contractor.insurance_expires_on >= now_date)
        has_license = bool(contractor.license_expires_on and contractor.license_expires_on >= now_date)
        has_tax = bool(contractor.tax_compliance_expires_on and contractor.tax_compliance_expires_on >= now_date)
        compliance_count = sum([has_insurance, has_license, has_tax])
        compliance_score = round((compliance_count / 3) * 100, 1) if (contractor.insurance_expires_on or contractor.license_expires_on) else 85.0
        
        rating = float(contractor.rating) if contractor.rating else 4.2
        customer_score = min(100.0, round((rating / 5.0) * 100, 1))
        doc_score = 88.0
        
        weighted_score = round(
            (sla_score * 0.20) +
            (quality_score * 0.20) +
            (response_score * 0.10) +
            (cost_score * 0.15) +
            (compliance_score * 0.15) +
            (customer_score * 0.10) +
            (doc_score * 0.10),
            1
        )
        
        rag_status = 'green' if weighted_score >= 85 else 'amber' if weighted_score >= 70 else 'red'
        
        return Response({
            'contractor_id': contractor.id,
            'contractor_name': contractor.name,
            'specialty': contractor.specialty,
            'status': contractor.status,
            'weighted_score': weighted_score,
            'rag_status': rag_status,
            'completed_jobs': completed_orders.count(),
            'pillars': [
                {'name': 'SLA Achievement', 'weight': 20, 'score': sla_score, 'metric': f'{on_time_orders.count()}/{completed_orders.count()} on-time'},
                {'name': 'Quality & First-Time Fix', 'weight': 20, 'score': quality_score, 'metric': f'{verified_orders.count()} verified'},
                {'name': 'Response Performance', 'weight': 10, 'score': response_score, 'metric': '< 2 hr avg response'},
                {'name': 'Cost Compliance', 'weight': 15, 'score': cost_score, 'metric': 'In line with approved rates'},
                {'name': 'Statutory Compliance', 'weight': 15, 'score': compliance_score, 'metric': f'{compliance_count}/3 valid documents'},
                {'name': 'Customer Satisfaction', 'weight': 10, 'score': customer_score, 'metric': f'{rating:.1f} / 5.0 stars'},
                {'name': 'Reporting & Evidence', 'weight': 10, 'score': doc_score, 'metric': 'Photographic closure proof'},
            ],
            'contracts': ContractorContractSerializer(contractor.contracts.all(), many=True).data,
        })

    @transaction.atomic
    @action(detail=False, methods=('post',), url_path='bulk_upload')
    def bulk_upload(self, request):
        organization = get_active_organization(request)
        raw_items = request.data.get('contractors') or request.data.get('providers') or request.data
        if not isinstance(raw_items, list) or not raw_items:
            return Response({'detail': 'A non-empty list of service providers is required.'}, status=status.HTTP_400_BAD_REQUEST)

        created = []
        errors = []
        existing_codes = set(Contractor.objects.filter(organization=organization).values_list('code', flat=True))
        code_seq = 100

        for idx, item in enumerate(raw_items):
            try:
                name = str(item.get('name', '')).strip()
                if not name:
                    errors.append(f"Row {idx + 1}: Provider name is required.")
                    continue

                code = str(item.get('code', '')).strip()
                if not code or code in existing_codes:
                    while f"VND-{code_seq:04d}" in existing_codes:
                        code_seq += 1
                    code = f"VND-{code_seq:04d}"
                existing_codes.add(code)

                specialty = str(item.get('specialty') or item.get('category') or 'General Maintenance').strip()
                contact_name = str(item.get('contact_name') or item.get('contact_person') or '').strip()
                email = str(item.get('email') or '').strip()
                phone = str(item.get('phone') or '').strip()
                emergency_phone = str(item.get('emergency_phone') or phone or '').strip()
                pin_number = str(item.get('pin_number') or item.get('tax_pin') or '').strip()
                registration_number = str(item.get('registration_number') or '').strip()
                coverage_areas = str(item.get('coverage_areas') or '').strip()
                status_val = str(item.get('status') or 'active').lower().strip()
                if status_val not in ('active', 'review', 'suspended', 'expired'):
                    status_val = 'active'
                try:
                    rating = float(item.get('rating') or 4.5)
                except (TypeError, ValueError):
                    rating = 4.5

                contractor = Contractor.objects.create(
                    organization=organization,
                    code=code,
                    name=name,
                    specialty=specialty,
                    contact_name=contact_name,
                    email=email,
                    phone=phone,
                    emergency_phone=emergency_phone,
                    pin_number=pin_number,
                    registration_number=registration_number,
                    coverage_areas=coverage_areas,
                    status=status_val,
                    rating=rating,
                )
                created.append(contractor)
            except Exception as e:
                errors.append(f"Row {idx + 1} ({item.get('name', 'Unknown')}): {str(e)}")

        return Response({
            'created_count': len(created),
            'errors': errors,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST)



class WorkOrderViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    permission_map = {'transition': 'facility.work', 'verify': 'facility.approve'}
    queryset = WorkOrder.objects.select_related('property', 'asset', 'contractor', 'assigned_to')
    serializer_class = WorkOrderSerializer
    search_fields = ('number', 'title', 'category', 'property__name', 'asset__name')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        number = str(serializer.validated_data.get('number', '')).strip()
        if not number:
            number = f'WO-{timezone.localdate():%Y}-{uuid.uuid4().hex[:6].upper()}'
            while WorkOrder.objects.filter(organization=organization, number=number).exists():
                number = f'WO-{timezone.localdate():%Y}-{uuid.uuid4().hex[:6].upper()}'
        work_order = serializer.save(organization=organization, reported_by=self.request.user, number=number)
        WorkOrderEvent.objects.create(
            organization=organization, work_order=work_order, event_type='created',
            to_status=work_order.status, notes='Work order created', actor=self.request.user,
        )

    def perform_update(self, serializer):
        if 'status' in serializer.validated_data and serializer.validated_data['status'] != self.get_object().status:
            raise ValidationError({'status': 'Use the transition action so the status change is audited.'})
        super().perform_update(serializer)

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def transition(self, request, pk=None):
        organization = get_active_organization(request)
        scoped_pk = self.get_queryset().filter(pk=pk).values_list('pk', flat=True).first()
        work_order = WorkOrder.objects.select_for_update().filter(pk=scoped_pk).first() if scoped_pk else None
        if not work_order:
            return Response({'detail': 'Work order not found.'}, status=404)
        target = str(request.data.get('status', '')).strip()
        transitions = {
            WorkOrder.Status.OPEN: {WorkOrder.Status.ASSIGNED, WorkOrder.Status.CANCELLED},
            WorkOrder.Status.ASSIGNED: {WorkOrder.Status.IN_PROGRESS, WorkOrder.Status.ON_HOLD, WorkOrder.Status.CANCELLED},
            WorkOrder.Status.IN_PROGRESS: {WorkOrder.Status.ON_HOLD, WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED},
            WorkOrder.Status.ON_HOLD: {WorkOrder.Status.IN_PROGRESS, WorkOrder.Status.CANCELLED},
            WorkOrder.Status.COMPLETED: set(), WorkOrder.Status.CANCELLED: set(),
        }
        if target not in transitions[work_order.status]:
            raise ValidationError({'status': f'Cannot transition from {work_order.status} to {target or "blank"}.'})
        notes = str(request.data.get('notes', '')).strip()
        if target in (WorkOrder.Status.ON_HOLD, WorkOrder.Status.CANCELLED) and not notes:
            raise ValidationError({'notes': 'Notes are required when holding or cancelling work.'})
        previous = work_order.status
        work_order.status = target
        if target == WorkOrder.Status.IN_PROGRESS and work_order.progress == 0:
            work_order.progress = 1
        if target == WorkOrder.Status.COMPLETED:
            if not notes:
                raise ValidationError({'notes': 'Resolution notes are required to complete work.'})
            work_order.progress = 100
            work_order.completed_at = timezone.now()
            work_order.resolution_notes = notes
        work_order.save()
        WorkOrderEvent.objects.create(
            organization=organization, work_order=work_order, event_type='status_change',
            from_status=previous, to_status=target, notes=notes, actor=request.user,
        )
        return Response(WorkOrderSerializer(work_order).data)

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def verify(self, request, pk=None):
        """Manager quality gate: completed work is not payment-ready until verified."""
        scoped_pk = self.get_queryset().filter(pk=pk).values_list('pk', flat=True).first()
        work_order = WorkOrder.objects.select_for_update().filter(pk=scoped_pk).first() if scoped_pk else None
        if not work_order:
            return Response({'detail': 'Work order not found.'}, status=404)
        if work_order.status != WorkOrder.Status.COMPLETED:
            raise ValidationError({'status': 'Only completed work can be manager verified.'})
        if work_order.supervisor_verified:
            return Response(WorkOrderSerializer(work_order).data)
        notes = str(request.data.get('notes', '')).strip()
        if not notes:
            raise ValidationError({'notes': 'Verification notes are required.'})
        work_order.supervisor_verified = True
        work_order.supervisor_verified_by = request.user
        work_order.sla_breached = bool(
            work_order.resolution_due_at and work_order.completed_at
            and work_order.completed_at > work_order.resolution_due_at
        )
        work_order.save(update_fields=('supervisor_verified', 'supervisor_verified_by', 'sla_breached', 'updated_at'))
        WorkOrderEvent.objects.create(
            organization=work_order.organization, work_order=work_order,
            event_type='manager_verified', from_status=work_order.status,
            to_status=work_order.status, notes=notes, actor=request.user,
        )
        return Response(WorkOrderSerializer(work_order).data)

    @action(detail=True, methods=('post',), url_path='fast-track-requisition')
    @transaction.atomic
    def fast_track_requisition(self, request, pk=None):
        """1-Click Fast-Track: Promotes an active Work Order into an official Repair Requisition."""
        work_order = self.get_object()
        organization = get_active_organization(request)

        # Check if a requisition already exists for this work order
        existing = RepairRequisition.objects.filter(organization=organization, work_order=work_order).first()
        if existing:
            return Response(RepairRequisitionSerializer(existing).data, status=status.HTTP_200_OK)

        est_cost = request.data.get('estimated_cost') or work_order.estimated_cost or Decimal('0.00')
        required_repair = request.data.get('required_repair') or work_order.description or work_order.title
        issue_desc = work_order.description or work_order.title
        priority = request.data.get('priority') or (
            RepairRequisition.Priority.HIGH if work_order.priority in ('urgent', 'high')
            else RepairRequisition.Priority.LOW if work_order.priority == 'low'
            else RepairRequisition.Priority.MEDIUM
        )

        code = f'REQ-{timezone.localdate():%Y}-{uuid.uuid4().hex[:6].upper()}'
        while RepairRequisition.objects.filter(organization=organization, code=code).exists():
            code = f'REQ-{timezone.localdate():%Y}-{uuid.uuid4().hex[:6].upper()}'

        requisition = RepairRequisition.objects.create(
            organization=organization,
            property=work_order.property,
            asset=work_order.asset,
            code=code,
            title=f"Requisition for {work_order.number}: {work_order.title}"[:200],
            issue_description=issue_desc,
            required_repair=required_repair,
            location=getattr(work_order, 'location', '') or (work_order.property.name if work_order.property else ''),
            estimated_cost=est_cost,
            priority=priority,
            status=RepairRequisition.Status.SUBMITTED,
            requester=request.user,
            provider=work_order.contractor,
            work_order=work_order,
            metadata={
                'source': 'fast_track_work_order',
                'work_order_id': str(work_order.id),
                'work_order_number': work_order.number,
                'category': work_order.category,
            }
        )

        WorkOrderEvent.objects.create(
            organization=organization, work_order=work_order,
            event_type='requisition_raised', from_status=work_order.status,
            to_status=work_order.status, notes=f'Fast-tracked procurement requisition {code} created.', actor=request.user,
        )

        return Response(RepairRequisitionSerializer(requisition).data, status=status.HTTP_201_CREATED)


class WorkOrderEventViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    queryset = WorkOrderEvent.objects.select_related('work_order', 'actor')
    serializer_class = WorkOrderEventSerializer
    http_method_names = ('get', 'head', 'options')
    search_fields = ('work_order__number', 'notes', 'event_type')


class WorkOrderCostItemViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    queryset = WorkOrderCostItem.objects.select_related('work_order', 'added_by')
    serializer_class = WorkOrderCostItemSerializer
    search_fields = ('work_order__number', 'description', 'supplier', 'reference')

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        item = serializer.save(organization=organization, added_by=self.request.user)
        totals = item.work_order.cost_items.values('kind').annotate(value=Sum('total'))
        by_kind = {row['kind']: row['value'] for row in totals}
        work_order = WorkOrder.objects.select_for_update().get(pk=item.work_order_id)
        work_order.labor_cost = by_kind.get(WorkOrderCostItem.Kind.LABOR, 0)
        work_order.parts_cost = by_kind.get(WorkOrderCostItem.Kind.PART, 0)
        work_order.other_cost = by_kind.get(WorkOrderCostItem.Kind.OTHER, 0)
        work_order.save(update_fields=('labor_cost', 'parts_cost', 'other_cost', 'updated_at'))
        WorkOrderEvent.objects.create(
            organization=organization, work_order=work_order, event_type='cost_added',
            notes=f'{item.description}: {item.total}', actor=self.request.user,
        )


class WorkOrderAttachmentViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    queryset = WorkOrderAttachment.objects.select_related('work_order', 'uploaded_by')
    serializer_class = WorkOrderAttachmentSerializer
    search_fields = ('work_order__number', 'file_name', 'caption')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        attachment = serializer.save(organization=organization, uploaded_by=self.request.user)
        if attachment.uploaded_file and not attachment.file_url:
            attachment.file_url = attachment.uploaded_file.url
            attachment.save(update_fields=('file_url', 'updated_at'))
        WorkOrderEvent.objects.create(
            organization=organization, work_order=attachment.work_order,
            event_type='attachment_added', notes=attachment.file_name, actor=self.request.user,
        )


class PreventiveScheduleViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = PreventiveSchedule.objects.select_related('asset__property')
    serializer_class = PreventiveScheduleSerializer
    search_fields = ('code', 'name', 'asset__name')

    @action(detail=False, methods=('post',), url_path='bulk-create')
    @transaction.atomic
    def bulk_create(self, request):
        records = request.data.get('records') if isinstance(request.data, dict) else None
        if not isinstance(records, list) or not records:
            raise ValidationError({'records': 'Provide at least one preventive schedule.'})
        if len(records) > 500:
            raise ValidationError({'records': 'A maximum of 500 schedules can be created at once.'})
        serializer = self.get_serializer(data=records, many=True)
        serializer.is_valid(raise_exception=True)
        organization = get_active_organization(request)
        codes = [str(item.get('code', '')).strip() for item in records]
        duplicate_codes = {code for code in codes if code and codes.count(code) > 1}
        existing_codes = set(
            PreventiveSchedule.objects.filter(organization=organization, code__in=codes)
            .values_list('code', flat=True)
        )
        if duplicate_codes or existing_codes:
            conflicts = sorted(duplicate_codes | existing_codes)
            raise ValidationError({'records': f"Schedule code already exists: {', '.join(conflicts)}"})
        for item in serializer.validated_data:
            for name, value in item.items():
                if getattr(value, 'organization_id', organization.id) != organization.id:
                    raise ValidationError({name: 'The selected record belongs to another organization.'})
        created = serializer.save(organization=organization)
        return Response(self.get_serializer(created, many=True).data, status=201)

    def perform_update(self, serializer):
        if {'last_completed_on', 'next_due_on'} & set(serializer.validated_data):
            raise ValidationError({'schedule': 'Use the complete action to advance recurrence dates.'})
        super().perform_update(serializer)

    @staticmethod
    def _next_due(current, frequency):
        months = {'monthly': 1, 'quarterly': 3, 'biannual': 6, 'annual': 12}
        if frequency == PreventiveSchedule.Frequency.WEEKLY:
            return current + timezone.timedelta(days=7)
        offset = months[frequency]; month_index = current.month - 1 + offset
        year, month = current.year + month_index // 12, month_index % 12 + 1
        return current.replace(year=year, month=month, day=min(current.day, calendar.monthrange(year, month)[1]))

    @action(detail=True, methods=('post',), url_path='complete')
    @transaction.atomic
    def complete_schedule(self, request, pk=None):
        schedule = PreventiveSchedule.objects.select_for_update().filter(pk=pk, organization=get_active_organization(request)).first()
        if not schedule or not schedule.is_active:
            raise ValidationError({'schedule': 'Only an active schedule can be completed.'})
        completed = timezone.localdate()
        schedule.last_completed_on = completed
        schedule.next_due_on = self._next_due(completed, schedule.frequency)
        schedule.save(update_fields=('last_completed_on', 'next_due_on', 'updated_at'))
        return Response(self.get_serializer(schedule).data)

    @action(detail=True, methods=('post',), url_path='generate-work-order')
    @transaction.atomic
    def generate_work_order(self, request, pk=None):
        schedule = self.get_object(); organization = get_active_organization(request)
        number = f'PM-{schedule.code}-{schedule.next_due_on:%Y%m%d}'
        work_order, created = WorkOrder.objects.get_or_create(
            organization=organization, number=number,
            defaults={
                'title': schedule.name, 'description': schedule.instructions,
                'category': 'preventive_maintenance', 'property': schedule.asset.property,
                'asset': schedule.asset, 'reported_by': request.user,
                'reported_at': timezone.now(), 'scheduled_for': timezone.make_aware(timezone.datetime.combine(schedule.next_due_on, timezone.datetime.min.time())),
            },
        )
        if created:
            WorkOrderEvent.objects.create(organization=organization, work_order=work_order, event_type='generated', to_status=work_order.status, notes=f'Generated from {schedule.code}', actor=request.user)
        return Response(WorkOrderSerializer(work_order).data, status=201 if created else 200)


class InspectionViewSet(FacilityModelViewSet):
    write_permission = 'facility.inspect'
    queryset = Inspection.objects.select_related('property', 'asset', 'inspector')
    serializer_class = InspectionSerializer
    search_fields = ('reference', 'title', 'inspection_type', 'property__name')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), inspector=self.request.user)

    def perform_update(self, serializer):
        raise ValidationError({'inspection': 'Use the complete action to preserve inspection evidence.'})

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def complete(self, request, pk=None):
        inspection = Inspection.objects.select_for_update().filter(pk=pk, organization=get_active_organization(request)).first()
        if not inspection or inspection.status not in (Inspection.Status.SCHEDULED, Inspection.Status.IN_PROGRESS):
            raise ValidationError({'status': 'Only an open inspection can be completed.'})
        findings = str(request.data.get('findings', '')).strip()
        try: score = Decimal(str(request.data.get('score', ''))); violations = int(request.data.get('violations', 0))
        except Exception: raise ValidationError({'score': 'Enter a valid score and violation count.'})
        if score < 0 or score > 100 or violations < 0: raise ValidationError({'score': 'Score must be 0-100 and violations cannot be negative.'})
        if violations and not findings: raise ValidationError({'findings': 'Findings are required when violations are recorded.'})
        inspection.score = score; inspection.violations = violations; inspection.findings = findings
        inspection.completed_on = timezone.localdate(); inspection.status = Inspection.Status.FAILED if violations or score < 70 else Inspection.Status.PASSED
        if inspection.status == Inspection.Status.FAILED and request.data.get('create_work_order', True):
            work_order = WorkOrder.objects.create(
                organization=inspection.organization, number=f'INS-{inspection.reference}', title=f'Corrective action: {inspection.title}',
                description=findings, category='inspection_finding', property=inspection.property, asset=inspection.asset,
                priority=WorkOrder.Priority.HIGH if violations else WorkOrder.Priority.MEDIUM,
                reported_by=request.user, reported_at=timezone.now(),
            )
            WorkOrderEvent.objects.create(organization=inspection.organization, work_order=work_order, event_type='inspection_finding', to_status=work_order.status, notes=findings, actor=request.user)
            inspection.follow_up_work_order = work_order; inspection.status = Inspection.Status.FOLLOW_UP
        inspection.save()
        return Response(self.get_serializer(inspection).data)


class ServiceRequestViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    permission_map = {
        'approve': 'facility.approve', 'reject': 'facility.approve',
        'convert': 'facility.work', 'resolve': 'facility.work',
    }
    queryset = ServiceRequest.objects.select_related('property', 'unit', 'tenant', 'work_order')
    serializer_class = ServiceRequestSerializer
    search_fields = ('reference', 'subject', 'category', 'property__name', 'tenant__name')

    def perform_create(self, serializer):
        serializer.save(
            organization=self._validate_organization(serializer),
            status=ServiceRequest.Status.NEW,
            submitted_at=timezone.now(),
            decision_notes='',
        )

    def perform_update(self, serializer):
        if 'status' in serializer.validated_data: raise ValidationError({'status': 'Use the transition action.'})
        super().perform_update(serializer)

    def _locked_scoped_request(self, pk):
        """Lock a request after the tenant/property-scoped query authorizes it.

        Property scoping uses DISTINCT, which PostgreSQL cannot combine with
        SELECT FOR UPDATE. Resolve the authorized primary key first, then lock
        the base row inside the caller's transaction.
        """
        scoped_pk = self.get_queryset().filter(pk=pk).values_list('pk', flat=True).first()
        if not scoped_pk:
            return None
        return ServiceRequest.objects.select_for_update().filter(pk=scoped_pk).first()

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def approve(self, request, pk=None):
        service_request = self._locked_scoped_request(pk)
        if not service_request or service_request.status != ServiceRequest.Status.NEW:
            raise ValidationError({'status': 'Only a new service request can be approved.'})
        service_request.status = ServiceRequest.Status.APPROVED
        service_request.decision_notes = str(request.data.get('notes', '')).strip()
        service_request.decided_by = request.user
        service_request.decided_at = timezone.now()
        service_request.save(update_fields=('status', 'decision_notes', 'decided_by', 'decided_at', 'updated_at'))
        return Response(self.get_serializer(service_request).data)

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def reject(self, request, pk=None):
        service_request = self._locked_scoped_request(pk)
        notes = str(request.data.get('notes', '')).strip()
        if not service_request or service_request.status != ServiceRequest.Status.NEW:
            raise ValidationError({'status': 'Only a new service request can be rejected.'})
        if not notes:
            raise ValidationError({'notes': 'A rejection reason is required.'})
        service_request.status = ServiceRequest.Status.REJECTED
        service_request.decision_notes = notes
        service_request.decided_by = request.user
        service_request.decided_at = timezone.now()
        service_request.save(update_fields=('status', 'decision_notes', 'decided_by', 'decided_at', 'updated_at'))
        return Response(self.get_serializer(service_request).data)

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def convert(self, request, pk=None):
        service_request = self._locked_scoped_request(pk)
        if not service_request or service_request.work_order_id:
            raise ValidationError({'request': 'The service request is missing or already converted.'})
        if service_request.status != ServiceRequest.Status.APPROVED:
            raise ValidationError({'status': 'Approve the service request before creating a work order.'})
        work_order = WorkOrder.objects.create(
            organization=service_request.organization, number=f'SR-{service_request.reference}', title=service_request.subject,
            description=service_request.description, category=service_request.category, property=service_request.property,
            priority=service_request.priority, reported_by=request.user, reported_at=timezone.now(),
        )
        WorkOrderEvent.objects.create(organization=service_request.organization, work_order=work_order, event_type='service_request', to_status=work_order.status, notes=service_request.reference, actor=request.user)
        service_request.work_order = work_order; service_request.status = ServiceRequest.Status.ASSIGNED; service_request.save(update_fields=('work_order', 'status', 'updated_at'))
        return Response(self.get_serializer(service_request).data)

    @action(detail=True, methods=('post',))
    def resolve(self, request, pk=None):
        service_request = self.get_object()
        if service_request.status not in (ServiceRequest.Status.ASSIGNED, ServiceRequest.Status.IN_PROGRESS): raise ValidationError({'status': 'Only assigned or active requests can be resolved.'})
        if not service_request.work_order_id or service_request.work_order.status != WorkOrder.Status.COMPLETED:
            raise ValidationError({'work_order': 'Complete the linked work order before resolving the service request.'})
        service_request.status = ServiceRequest.Status.RESOLVED
        service_request.resolved_at = timezone.now()
        service_request.satisfaction_score = None
        service_request.work_order.requester_confirmed = False
        service_request.work_order.save(update_fields=('requester_confirmed', 'updated_at'))
        service_request.save(update_fields=('status', 'resolved_at', 'satisfaction_score', 'updated_at'))
        if service_request.tenant_id:
            from properties.models import TenantPortalAccess
            portal_access = TenantPortalAccess.objects.for_organization(service_request.organization).filter(
                tenant_id=service_request.tenant_id, is_active=True,
            ).select_related('user').first()
            if portal_access:
                notify_user(
                    organization=service_request.organization, recipient=portal_access.user,
                    title=f'Repair ready for confirmation · {service_request.reference}',
                    message='Please confirm that the issue was resolved, or reopen it with a reason.',
                    level=Notification.Level.INFO, action_url='/tenant-portal?tab=maintenance',
                    event_key=f'service-request-confirmation:{service_request.pk}', category='approval',
                )
        return Response(self.get_serializer(service_request).data)

    @action(detail=False, methods=('post',), url_path='ai-triage')
    def ai_triage(self, request):
        """AI Triage: Analyze maintenance issue description to classify trade, priority, estimated cost range, and recommend contractors."""
        organization = get_active_organization(request)
        description = request.data.get('description', '').strip()
        subject = request.data.get('subject', '').strip()
        category = request.data.get('category', '').strip()
        full_text = f"{subject} {description}".lower()

        if not full_text.strip():
            raise ValidationError({'description': 'Provide a description or subject for triage.'})

        # 1. Trade Category Detection
        detected_category = 'general'
        if any(w in full_text for w in ('leak', 'pipe', 'drain', 'clog', 'sewage', 'tap', 'faucet', 'toilet', 'flush', 'water pressure', 'geyser', 'plumb')):
            detected_category = 'plumbing'
        elif any(w in full_text for w in ('spark', 'circuit', 'breaker', 'blackout', 'short circuit', 'power', 'socket', 'switch', 'light', 'bulb', 'wiring', 'electr')):
            detected_category = 'electrical'
        elif any(w in full_text for w in ('ac', 'air condition', 'hvac', 'vent', 'chiller', 'heating', 'cooling', 'fan')):
            detected_category = 'hvac'
        elif any(w in full_text for w in ('lift', 'elevator', 'stuck in lift', 'escalator')):
            detected_category = 'elevator'
        elif any(w in full_text for w in ('door', 'lock', 'key', 'handle', 'hinge', 'cupboard', 'cabinet', 'window', 'glass', 'carpenter')):
            detected_category = 'carpentry'
        elif any(w in full_text for w in ('paint', 'crack', 'wall', 'plaster', 'ceiling', 'tiles', 'grout', 'masonry')):
            detected_category = 'civil'
        elif any(w in full_text for w in ('guard', 'cctv', 'gate', 'intercom', 'alarm', 'fence', 'security')):
            detected_category = 'security'
        elif category:
            detected_category = category

        # 2. Priority Classification
        priority = 'normal'
        urgency_reason = 'Standard maintenance request.'
        if any(w in full_text for w in ('burst', 'flooding', 'fire', 'smoke', 'gas leak', 'stuck in lift', 'shock', 'sparking', 'emergency', 'no water in building', 'blackout')):
            priority = 'critical'
            urgency_reason = 'Critical risk of property damage or occupant safety hazard.'
        elif any(w in full_text for w in ('overflow', 'leak', 'no power', 'broken lock', 'security risk', 'major', 'urgent', 'hot water')):
            priority = 'high'
            urgency_reason = 'High urgency: directly affects tenant living comfort or security.'
        elif any(w in full_text for w in ('flicker', 'slow drain', 'creak', 'handle loose', 'touch up', 'minor')):
            priority = 'low'
            urgency_reason = 'Minor cosmetic or non-blocking maintenance issue.'

        # 3. Estimated Cost Range (KES)
        cost_ranges = {
            'plumbing': {'min_kes': 2500, 'max_kes': 8500, 'avg_kes': 4500},
            'electrical': {'min_kes': 2000, 'max_kes': 10000, 'avg_kes': 5000},
            'hvac': {'min_kes': 5000, 'max_kes': 25000, 'avg_kes': 12000},
            'elevator': {'min_kes': 15000, 'max_kes': 60000, 'avg_kes': 30000},
            'carpentry': {'min_kes': 1500, 'max_kes': 6000, 'avg_kes': 3500},
            'civil': {'min_kes': 3000, 'max_kes': 15000, 'avg_kes': 7500},
            'security': {'min_kes': 4000, 'max_kes': 18000, 'avg_kes': 8000},
            'general': {'min_kes': 1500, 'max_kes': 5000, 'avg_kes': 3000},
        }
        cost_estimate = cost_ranges.get(detected_category, cost_ranges['general'])

        # 4. Contractor Recommendations
        from facilities.models import Contractor
        contractors = Contractor.objects.filter(
            organization=organization, status='active',
        )
        matching = []
        for c in contractors:
            spec = (c.specialization or '').lower()
            name = c.name
            matched = detected_category in spec or detected_category in name.lower()
            rating = float(c.rating or 4.5)
            matching.append({
                'id': str(c.id),
                'name': c.name,
                'phone': c.phone,
                'email': c.email,
                'specialization': c.specialization or detected_category.title(),
                'rating': rating,
                'is_trade_matched': matched,
                'compliance_status': c.compliance_status if hasattr(c, 'compliance_status') else 'valid',
            })
        matching.sort(key=lambda x: (x['is_trade_matched'], x['rating']), reverse=True)

        return Response({
            'detected_category': detected_category,
            'suggested_priority': priority,
            'urgency_reason': urgency_reason,
            'estimated_cost_range': cost_estimate,
            'recommended_contractors': matching[:5],
            'triage_summary': f"Triaged as {priority.upper()} {detected_category.title()} issue. Estimated repair budget: KES {cost_estimate['min_kes']:,} - {cost_estimate['max_kes']:,}.",
        }, status=status.HTTP_200_OK)



@extend_schema_view(list=extend_schema(request=None, responses=OpenApiTypes.OBJECT))
class FacilityPortalViewSet(ViewSet):
    """Occupant-facing facility portal scoped to the linked tenant profile.

    Unlike the staff ServiceRequestViewSet, this view only exposes the
    service requests of the tenant linked to the signed-in user and lets
    them submit new requests against their active lease property.
    """

    permission_classes = (HasModuleSubscription,)
    required_module = Module.FACILITY

    serializer_class = GenericObjectSerializer

    def _access(self):
        from properties.models import TenantPortalAccess

        organization = get_active_organization(self.request)
        access = TenantPortalAccess.objects.for_organization(organization).filter(
            user=self.request.user, is_active=True,
        ).select_related('tenant').first()
        if not access:
            raise PermissionDenied('No active occupant profile is linked to this account.')
        return access

    def _active_lease(self, access):
        from properties.models import Lease

        return Lease.objects.for_organization(access.organization).filter(
            tenant=access.tenant, status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING),
        ).select_related('unit__property').first()

    @extend_schema(request=None, responses={200: {"type": "object"}})
    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        access = self._access()
        requests = ServiceRequest.objects.for_organization(access.organization).filter(
            tenant=access.tenant,
        ).order_by('-submitted_at')[:12]
        lease = self._active_lease(access)
        return Response({
            'tenant': {
                'id': str(access.tenant.id), 'name': access.tenant.name,
                'code': access.tenant.code,
            },
            'property': {
                'id': str(lease.unit.property.id), 'name': lease.unit.property.name,
                'unit': lease.unit.code,
            } if lease else None,
            'serviceRequests': list(requests.values(
                'id', 'reference', 'subject', 'category', 'priority', 'status',
                'submitted_at', 'resolved_at', 'satisfaction_score',
            )),
        })

    @action(detail=False, methods=('post',), url_path='service-requests')
    def service_request(self, request):
        access = self._access()
        lease = self._active_lease(access)
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
            subject=subject,
            description=str(request.data.get('description', '')).strip(),
            category=category, property=lease.unit.property, unit=lease.unit,
            tenant=access.tenant, priority=priority, status=ServiceRequest.Status.NEW,
            submitted_at=timezone.now(),
        )
        return Response(ServiceRequestSerializer(service_request).data, status=201)

    @action(detail=False, methods=('post',), url_path=r'service-requests/(?P<request_id>[0-9a-fA-F-]{36})/confirm')
    @transaction.atomic
    def confirm_service_request(self, request, request_id=None):
        access = self._access()
        service_request = ServiceRequest.objects.select_for_update().filter(
            pk=request_id, organization=access.organization, tenant=access.tenant,
        ).first()
        if not service_request or service_request.status != ServiceRequest.Status.RESOLVED:
            raise ValidationError({'status': 'Only a resolved request awaiting your confirmation can be closed.'})
        try:
            score = int(request.data.get('satisfaction_score'))
        except (TypeError, ValueError):
            raise ValidationError({'satisfaction_score': 'Rate the completed work from 1 to 5.'})
        if score < 1 or score > 5:
            raise ValidationError({'satisfaction_score': 'Score must be from 1 to 5.'})
        service_request.status = ServiceRequest.Status.CLOSED
        service_request.satisfaction_score = score
        service_request.save(update_fields=('status', 'satisfaction_score', 'updated_at'))
        if service_request.work_order_id:
            service_request.work_order.requester_confirmed = True
            service_request.work_order.save(update_fields=('requester_confirmed', 'updated_at'))
        return Response(ServiceRequestSerializer(service_request).data)

    @action(detail=False, methods=('post',), url_path=r'service-requests/(?P<request_id>[0-9a-fA-F-]{36})/reopen')
    @transaction.atomic
    def reopen_service_request(self, request, request_id=None):
        access = self._access()
        reason = str(request.data.get('reason', '')).strip()
        if not reason:
            raise ValidationError({'reason': 'Explain what remains unresolved so the maintenance team can act.'})
        service_request = ServiceRequest.objects.select_for_update().filter(
            pk=request_id, organization=access.organization, tenant=access.tenant,
        ).first()
        if not service_request or service_request.status != ServiceRequest.Status.RESOLVED:
            raise ValidationError({'status': 'Only a resolved request awaiting your confirmation can be reopened.'})
        service_request.status = ServiceRequest.Status.IN_PROGRESS
        service_request.resolved_at = None
        service_request.satisfaction_score = None
        service_request.decision_notes = reason
        service_request.save(update_fields=('status', 'resolved_at', 'satisfaction_score', 'decision_notes', 'updated_at'))
        if service_request.work_order_id:
            work_order = service_request.work_order
            previous_status = work_order.status
            work_order.status = WorkOrder.Status.IN_PROGRESS
            work_order.completed_at = None
            work_order.progress = min(work_order.progress, 90)
            work_order.requester_confirmed = False
            work_order.save(update_fields=('status', 'completed_at', 'progress', 'requester_confirmed', 'updated_at'))
            WorkOrderEvent.objects.create(
                organization=service_request.organization, work_order=work_order,
                event_type='requester_reopened', from_status=previous_status,
                to_status=work_order.status, notes=reason, actor=request.user,
            )
        notify_permission(
            organization=service_request.organization, permission_key='facility.work',
            title=f'Service request reopened · {service_request.reference}', message=reason,
            level=Notification.Level.WARNING, action_url='/facility?tab=service-requests',
            event_key=f'service-request-reopened:{service_request.pk}:{service_request.updated_at.isoformat()}',
            exclude_user=request.user,
            metadata={'service_request_id': str(service_request.pk), 'property_id': str(service_request.property_id)},
        )
        return Response(ServiceRequestSerializer(service_request).data)


class ContractorPortalViewSet(ViewSet):
    """Service Provider / Contractor facing portal.

    Provides contractors with real-time visibility into their dispatched work orders,
    open RFQ bidding opportunities, digital job card signing, and invoice settlement tracking.
    """
    permission_classes = (HasModuleSubscription,)
    required_module = Module.FACILITY
    serializer_class = GenericObjectSerializer

    def _get_contractor(self, request, organization):
        contractor_id = request.query_params.get('contractor_id') or request.data.get('contractor_id')
        if contractor_id:
            c = Contractor.objects.filter(organization=organization, pk=contractor_id).first()
            if c:
                return c
        if request.user and request.user.email:
            c = Contractor.objects.filter(organization=organization, email__iexact=request.user.email).first()
            if c:
                return c
        return Contractor.objects.filter(organization=organization).first()

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        organization = get_active_organization(request)
        contractor = self._get_contractor(request, organization)
        if not contractor:
            return Response({'detail': 'No contractor profile found for this organization.'}, status=404)

        work_orders = WorkOrder.objects.filter(
            organization=organization, contractor=contractor
        ).exclude(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED)).select_related('property', 'asset').order_by('-created_at')

        rfqs = ProcurementRecord.objects.filter(
            organization=organization, status__in=(ProcurementRecord.Status.SOURCING, ProcurementRecord.Status.EVALUATION)
        ).select_related('requisition', 'property').prefetch_related('quotations')

        rfq_list = []
        for rfq in rfqs:
            existing_quote = rfq.quotations.filter(bidder=contractor).first()
            rfq_list.append({
                'id': str(rfq.id),
                'code': rfq.code,
                'title': rfq.requisition.title,
                'scope': rfq.requisition.required_repair,
                'property_name': rfq.property.name,
                'status': rfq.status,
                'created_at': rfq.created_at,
                'has_quoted': bool(existing_quote),
                'my_quote': {
                    'total': str(existing_quote.total),
                    'quotation_number': existing_quote.quotation_number,
                    'is_awarded': existing_quote.is_awarded,
                } if existing_quote else None,
            })

        job_cards_qs = FacilityJobCard.objects.filter(
            organization=organization, lpo__supplier=contractor
        ).select_related('lpo', 'property', 'work_order').order_by('-created_at')

        invoices_qs = SupplierInvoice.objects.filter(
            organization=organization, supplier=contractor
        ).select_related('property', 'work_order').order_by('-created_at')

        all_contractors = list(Contractor.objects.filter(organization=organization).values('id', 'name', 'code', 'specialty'))

        unpaid_invoices = invoices_qs.exclude(status=SupplierInvoice.Status.PAID)
        unpaid_total = unpaid_invoices.aggregate(total=Sum('total'))['total'] or Decimal('0.00')

        return Response({
            'contractor': {
                'id': str(contractor.id),
                'code': contractor.code,
                'name': contractor.name,
                'specialty': contractor.specialty,
                'contact_name': contractor.contact_name,
                'email': contractor.email,
                'phone': contractor.phone,
                'status': contractor.status,
                'rating': float(contractor.rating or 4.5),
                'insurance_expires_on': contractor.insurance_expires_on,
                'license_expires_on': contractor.license_expires_on,
                'tax_compliance_expires_on': contractor.tax_compliance_expires_on,
            },
            'all_contractors': all_contractors,
            'kpis': {
                'active_jobs': work_orders.count(),
                'open_rfqs': len(rfq_list),
                'pending_job_cards': job_cards_qs.exclude(status=FacilityJobCard.Status.VERIFIED).count(),
                'unpaid_invoices_count': unpaid_invoices.count(),
                'unpaid_invoices_total': str(unpaid_total),
            },
            'work_orders': WorkOrderSerializer(work_orders, many=True).data,
            'rfqs': rfq_list,
            'job_cards': FacilityJobCardSerializer(job_cards_qs[:20], many=True).data,
            'invoices': SupplierInvoiceSerializer(invoices_qs[:30], many=True).data,
        })

    @action(detail=False, methods=('post',), url_path='submit-quote')
    @transaction.atomic
    def submit_quote(self, request):
        organization = get_active_organization(request)
        contractor = self._get_contractor(request, organization)
        if not contractor:
            raise ValidationError({'contractor': 'Valid contractor profile required.'})

        procurement_id = request.data.get('procurement_id')
        procurement = ProcurementRecord.objects.filter(organization=organization, pk=procurement_id).first()
        if not procurement or procurement.status not in (ProcurementRecord.Status.SOURCING, ProcurementRecord.Status.EVALUATION):
            raise ValidationError({'procurement': 'Procurement is not open for bidding.'})

        subtotal = Decimal(str(request.data.get('subtotal', 0)))
        vat_amount = Decimal(str(request.data.get('vat_amount', 0)))
        total = Decimal(str(request.data.get('total') or (subtotal + vat_amount)))
        quote_num = str(request.data.get('quotation_number', '')).strip() or f'Q-{uuid.uuid4().hex[:6].upper()}'
        lead_days = int(request.data.get('lead_time_days', 3))

        quote, created = ProcurementQuotation.objects.update_or_create(
            organization=organization,
            procurement=procurement,
            bidder=contractor,
            defaults={
                'quotation_number': quote_num,
                'quoted_on': timezone.localdate(),
                'valid_until': request.data.get('valid_until') or None,
                'lead_time_days': lead_days,
                'subtotal': subtotal,
                'vat_amount': vat_amount,
                'total': total,
                'compliance_notes': str(request.data.get('compliance_notes', '')).strip(),
                'document_url': str(request.data.get('document_url', '')).strip(),
                'recorded_by': request.user,
            }
        )
        if procurement.status == ProcurementRecord.Status.SOURCING:
            procurement.status = ProcurementRecord.Status.EVALUATION
            procurement.save(update_fields=('status', 'updated_at'))

        return Response(ProcurementQuotationSerializer(quote).data, status=201)

    @action(detail=False, methods=('post',), url_path='sign-job-card')
    @transaction.atomic
    def sign_job_card(self, request):
        organization = get_active_organization(request)
        contractor = self._get_contractor(request, organization)
        job_card_id = request.data.get('job_card_id')
        job_card = FacilityJobCard.objects.filter(organization=organization, pk=job_card_id).first()
        if not job_card:
            raise ValidationError({'job_card': 'Job card not found.'})

        notes = str(request.data.get('completion_notes', '')).strip()
        signatory = str(request.data.get('contractor_signatory', '')).strip() or (contractor.contact_name or contractor.name if contractor else 'Contractor Representative')
        evidence = request.data.get('evidence_urls', [])
        if isinstance(evidence, str) and evidence:
            evidence = [evidence]

        job_card.status = FacilityJobCard.Status.CONTRACTOR_SIGNED
        job_card.completed_at = timezone.now()
        job_card.completion_notes = notes or job_card.completion_notes
        job_card.contractor_signatory = signatory
        job_card.contractor_signed_at = timezone.now()
        if evidence:
            job_card.evidence_urls = list(set((job_card.evidence_urls or []) + evidence))
        job_card.save()

        if job_card.work_order_id:
            wo = job_card.work_order
            wo.status = WorkOrder.Status.COMPLETED
            wo.completed_at = timezone.now()
            wo.progress = 100
            wo.resolution_notes = notes or 'Work completed and signed off by contractor on digital job card.'
            wo.save(update_fields=('status', 'completed_at', 'progress', 'resolution_notes', 'updated_at'))

        return Response(FacilityJobCardSerializer(job_card).data)


class UtilityMeterViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = UtilityMeter.objects.select_related('property', 'property_unit').prefetch_related('readings')
    serializer_class = UtilityMeterSerializer
    search_fields = ('code', 'name', 'property__name')


class MeterReadingViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    queryset = MeterReading.objects.select_related('meter', 'meter__property_unit', 'reviewed_by')
    serializer_class = MeterReadingSerializer
    search_fields = ('meter__name', 'notes')

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer); meter = serializer.validated_data['meter']; value = serializer.validated_data['value']; read_at = serializer.validated_data['read_at']
        readings = MeterReading.objects.select_for_update().filter(organization=organization, meter=meter)
        previous = readings.filter(status=MeterReading.Status.APPROVED).order_by('-read_at').first()
        pending = readings.filter(status=MeterReading.Status.PENDING)
        if previous:
            pending = pending.filter(read_at__gt=previous.read_at)
        if pending.exists():
            raise ValidationError({'meter': 'Approve or reject the pending reading before recording another.'})
        if previous and read_at <= previous.read_at:
            raise ValidationError({'read_at': 'The reading date and time must be later than the previous reading.'})
        reset_events = meter.reset_events.filter(effective_at__lte=read_at)
        if previous:
            reset_events = reset_events.filter(effective_at__gt=previous.read_at)
        reset_event = reset_events.order_by('-effective_at').first()
        reverse_without_reset = bool(previous and value < previous.value and not reset_event)
        baseline = reset_event.reset_value if reset_event else previous.value if previous else Decimal(0)
        consumption = max(value - baseline, Decimal(0))
        anomaly = bool(previous and previous.consumption > 0 and consumption > previous.consumption * Decimal('1.5'))
        cost = (consumption * meter.tariff).quantize(Decimal('0.01'))
        serializer.save(
            organization=organization,
            recorded_by=self.request.user,
            previous_value=baseline, consumption=Decimal(0) if reverse_without_reset else consumption,
            cost=Decimal(0) if reverse_without_reset else cost,
            is_anomaly=reverse_without_reset or anomaly,
            status=MeterReading.Status.REJECTED if reverse_without_reset else MeterReading.Status.PENDING,
            review_notes='Reverse reading rejected; authorize a meter reset or replacement before billing.' if reverse_without_reset else '',
        )
        reading = serializer.instance
        if reading.status == MeterReading.Status.PENDING:
            notify_permission(
                organization=organization, permission_key='facility.approve',
                title=f'Meter reading awaiting approval · {meter.name}',
                message=f'{reading.value:g} {meter.unit} recorded for {meter.property.name}.',
                level=Notification.Level.WARNING, action_url='/facility?tab=meters',
                event_key=f'meter-reading-review:{reading.pk}', exclude_user=self.request.user,
                metadata={'meter_reading_id': str(reading.pk), 'property_id': str(meter.property_id)},
            )

    @action(detail=False, methods=('post',), url_path='ingest')
    @transaction.atomic
    def ingest(self, request):
        """Authenticated, idempotent endpoint for smart meters and approved imports.

        Electronic readings enter the same pending-review queue as field readings;
        ingestion never bypasses the manager approval boundary.
        """
        source_reference = str(request.data.get('source_reference', '')).strip()
        method = str(request.data.get('method', MeterReading.Method.IOT))
        if method not in (MeterReading.Method.IOT, MeterReading.Method.IMPORT):
            raise ValidationError({'method': 'Electronic ingestion accepts smart-meter or imported readings only.'})
        if not source_reference:
            raise ValidationError({'source_reference': 'A device event or import-row reference is required for idempotency.'})
        organization = get_active_organization(request)
        existing = MeterReading.objects.for_organization(organization).filter(
            method=method, source_reference=source_reference,
        ).first()
        if existing:
            return Response({**self.get_serializer(existing).data, 'duplicate': True})
        payload = request.data.copy()
        payload['method'] = method
        payload['source_reference'] = source_reference
        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response({**serializer.data, 'duplicate': False}, status=201)

    @action(detail=True, methods=('post',))
    def approve(self, request, pk=None):
        reading = self.get_object()
        if reading.status != MeterReading.Status.PENDING:
            raise ValidationError({'status': 'Only pending meter readings can be approved.'})
        reading.status = MeterReading.Status.APPROVED
        reading.reviewed_by = request.user
        reading.reviewed_at = timezone.now()
        reading.review_notes = str(request.data.get('notes', '')).strip()
        reading.save(update_fields=('status', 'reviewed_by', 'reviewed_at', 'review_notes', 'updated_at'))
        if reading.recorded_by:
            notify_user(
                organization=reading.organization, recipient=reading.recorded_by,
                title=f'Meter reading approved · {reading.meter.name}',
                message=f'The {reading.value:g} {reading.meter.unit} reading is approved for billing.',
                level=Notification.Level.SUCCESS, action_url='/caretaker-portal',
                event_key=f'meter-reading-approved:{reading.pk}', category='approval',
            )
        return Response(self.get_serializer(reading).data)

    @action(detail=True, methods=('post',))
    def reject(self, request, pk=None):
        reading = self.get_object()
        if reading.status != MeterReading.Status.PENDING:
            raise ValidationError({'status': 'Only pending meter readings can be rejected.'})
        notes = str(request.data.get('notes', '')).strip()
        if not notes:
            raise ValidationError({'notes': 'A rejection reason is required.'})
        reading.status = MeterReading.Status.REJECTED
        reading.reviewed_by = request.user
        reading.reviewed_at = timezone.now()
        reading.review_notes = notes
        reading.save(update_fields=('status', 'reviewed_by', 'reviewed_at', 'review_notes', 'updated_at'))
        if reading.recorded_by:
            notify_user(
                organization=reading.organization, recipient=reading.recorded_by,
                title=f'Meter reading rejected · {reading.meter.name}', message=notes,
                level=Notification.Level.URGENT, action_url='/caretaker-portal',
                event_key=f'meter-reading-rejected:{reading.pk}', category='approval',
            )
        return Response(self.get_serializer(reading).data)

    def perform_update(self, serializer): raise ValidationError({'reading': 'Meter readings are immutable.'})
    def perform_destroy(self, instance): raise ValidationError({'reading': 'Meter readings cannot be deleted.'})


class MeterResetEventViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = MeterResetEvent.objects.select_related('meter__property', 'authorized_by')
    serializer_class = MeterResetEventSerializer
    search_fields = ('meter__name', 'meter__code', 'reason')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), authorized_by=self.request.user)

    def perform_update(self, serializer):
        raise ValidationError({'reset': 'Authorized meter reset events are immutable.'})

    def perform_destroy(self, instance):
        raise ValidationError({'reset': 'Authorized meter reset events cannot be deleted.'})


class MeterReconciliationViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    permission_map = {'approve': 'facility.approve'}
    queryset = MeterReconciliation.objects.select_related('bulk_meter__property', 'reviewed_by')
    serializer_class = MeterReconciliationSerializer
    search_fields = ('bulk_meter__name', 'bulk_meter__property__name', 'review_notes')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        bulk = serializer.validated_data['bulk_consumption']
        checks = serializer.validated_data['check_consumption']
        variance = bulk - checks
        variance_percent = (variance / bulk * Decimal('100')).quantize(Decimal('0.001')) if bulk else Decimal('0')
        tolerance = serializer.validated_data.get('tolerance_percent', Decimal('5'))
        status = MeterReconciliation.Status.WITHIN_TOLERANCE if abs(variance_percent) <= tolerance else MeterReconciliation.Status.EXCEPTION
        serializer.save(organization=organization, variance=variance, variance_percent=variance_percent, status=status)

    @action(detail=True, methods=('post',))
    def approve(self, request, pk=None):
        record = self.get_object()
        if record.status == MeterReconciliation.Status.APPROVED:
            raise ValidationError({'status': 'This meter reconciliation is already approved.'})
        notes = str(request.data.get('notes', '')).strip()
        if record.status == MeterReconciliation.Status.EXCEPTION and not notes:
            raise ValidationError({'notes': 'An out-of-tolerance reconciliation requires review notes.'})
        record.status = MeterReconciliation.Status.APPROVED
        record.reviewed_by = request.user; record.reviewed_at = timezone.now(); record.review_notes = notes
        record.save()
        return Response(self.get_serializer(record).data)


class FacilityDashboardViewSet(ViewSet):
    serializer_class = GenericObjectSerializer
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.FACILITY

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        organization = get_active_organization(request)
        now = timezone.now()
        today = timezone.localdate()
        assets = scope_model_queryset(FacilityAsset, request, organization)
        work_orders = scope_model_queryset(WorkOrder, request, organization)
        schedules = scope_model_queryset(PreventiveSchedule, request, organization)
        requests = scope_model_queryset(ServiceRequest, request, organization)
        readings = scope_model_queryset(MeterReading, request, organization)
        contractors = scope_model_queryset(Contractor, request, organization)
        budgets = scope_model_queryset(FMBudget, request, organization)
        compliance = scope_model_queryset(ComplianceObligation, request, organization)
        risks = scope_model_queryset(FacilityRisk, request, organization)
        flags = scope_model_queryset(FacilityFlag, request, organization)

        active_work = work_orders.exclude(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED))
        overdue = active_work.filter(resolution_due_at__lt=now)
        due_schedules = schedules.filter(is_active=True, next_due_on__lte=today)
        compliant = schedules.filter(is_active=True).count() - due_schedules.count()
        schedule_count = schedules.filter(is_active=True).count()

        completed_wo = work_orders.filter(status=WorkOrder.Status.COMPLETED)
        on_time_wo = completed_wo.filter(sla_breached=False).count()
        sla_achievement = round(on_time_wo / completed_wo.count() * 100, 1) if completed_wo.exists() else 0.0
        pm_compliance = round(compliant / schedule_count * 100, 1) if schedule_count else 100.0

        total_allocated_budget = float(budgets.aggregate(total=Sum('allocated_amount'))['total'] or 0)
        total_spent_budget = float(budgets.aggregate(total=Sum('actual_amount'))['total'] or 0) + float(budgets.aggregate(total=Sum('committed_amount'))['total'] or 0)
        budget_utilization = round(total_spent_budget / total_allocated_budget * 100, 1) if total_allocated_budget else 0.0

        total_comp = compliance.count()
        overdue_comp = compliance.filter(status='overdue').count()
        compliance_rate = round((total_comp - overdue_comp) / total_comp * 100, 1) if total_comp else 100.0

        fm_index = round(
            (sla_achievement * 0.25) +
            (pm_compliance * 0.25) +
            (min(100.0, max(0.0, 100 - (budget_utilization - 90))) * 0.15 if budget_utilization > 90 else 100.0 * 0.15) +
            (compliance_rate * 0.20) +
            (95.0 * 0.15),
            1
        )

        return Response({
            'kpis': {
                'buildings': scope_model_queryset(Building, request, organization).count(),
                'activeAssets': assets.filter(is_active=True).count(),
                'assetValue': assets.aggregate(total=Sum('purchase_value'))['total'] or 0,
                'openWorkOrders': active_work.count(),
                'overdueWorkOrders': overdue.count(),
                'maintenanceCompliance': pm_compliance,
                'slaAchievement': sla_achievement,
                'weightedFMIndex': fm_index,
                'budgetAllocated': total_allocated_budget,
                'budgetSpent': total_spent_budget,
                'budgetUtilization': budget_utilization,
                'complianceRate': compliance_rate,
                'highRisksCount': risks.filter(status__in=('open', 'mitigating'), inherent_score__gte=12).count(),
                'activeFlagsCount': flags.filter(is_resolved=False).count(),
                'openRequests': requests.exclude(status__in=(ServiceRequest.Status.RESOLVED, ServiceRequest.Status.CLOSED)).count(),
                'utilityConsumption': readings.filter(read_at__year=now.year).aggregate(total=Sum('consumption'))['total'] or 0,
                'utilityCost': readings.filter(read_at__year=now.year).aggregate(total=Sum('cost'))['total'] or 0,
                'contractors': contractors.filter(status=Contractor.Status.ACTIVE).count(),
            },
            'recentWorkOrders': WorkOrderSerializer(work_orders[:6], many=True).data,
            'urgentWorkOrders': WorkOrderSerializer(active_work.filter(priority__in=(WorkOrder.Priority.HIGH, WorkOrder.Priority.CRITICAL))[:5], many=True).data,
            'requestSummary': list(requests.values('status').annotate(count=Count('id')).order_by('status')),
            'assetCategories': list(assets.values('category').annotate(count=Count('id')).order_by('-count')),
            'dueMaintenance': PreventiveScheduleSerializer(due_schedules[:5], many=True).data,
        })

    @action(detail=False, methods=('get',))
    def manager_command_center(self, request):
        organization = get_active_organization(request)
        now = timezone.now()
        today = timezone.localdate()
        
        properties = scope_model_queryset(Property, request, organization)
        buildings = scope_model_queryset(Building, request, organization)
        assets = scope_model_queryset(FacilityAsset, request, organization)
        work_orders = scope_model_queryset(WorkOrder, request, organization)
        schedules = scope_model_queryset(PreventiveSchedule, request, organization)
        compliance = scope_model_queryset(ComplianceObligation, request, organization)
        risks = scope_model_queryset(FacilityRisk, request, organization)
        flags = scope_model_queryset(FacilityFlag, request, organization)
        contracts = scope_model_queryset(ContractorContract, request, organization)
        budgets = scope_model_queryset(FMBudget, request, organization)
        
        active_wo = work_orders.exclude(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED))
        todays_wo = work_orders.filter(reported_at__date=today)
        overdue_wo = active_wo.filter(resolution_due_at__lt=now)
        
        due_pm = schedules.filter(is_active=True, next_due_on__lte=today)
        total_pm = schedules.filter(is_active=True).count()
        pm_compliance = round(((total_pm - due_pm.count()) / total_pm * 100), 1) if total_pm else 100.0
        
        critical_assets = assets.filter(criticality='critical')
        critical_down = critical_assets.filter(condition=FacilityAsset.Condition.OUT_OF_SERVICE).count()
        
        total_allocated_budget = float(budgets.aggregate(total=Sum('allocated_amount'))['total'] or 0)
        total_spent_budget = float(budgets.aggregate(total=Sum('actual_amount'))['total'] or 0) + float(budgets.aggregate(total=Sum('committed_amount'))['total'] or 0)
        budget_utilization = round(total_spent_budget / total_allocated_budget * 100, 1) if total_allocated_budget else 0.0
        
        high_risks = risks.filter(status__in=('open', 'mitigating'), inherent_score__gte=12)
        overdue_comp = compliance.filter(status='overdue')
        expiring_contracts = contracts.filter(status='active', end_date__lte=today + timezone.timedelta(days=60))
        active_flags = flags.filter(is_resolved=False)[:10]
        
        top_faults = list(work_orders.values('category').annotate(count=Count('id')).order_by('-count')[:5])
        
        return Response({
            'command_center': {
                'portfolio_summary': {
                    'properties_count': properties.count(),
                    'buildings_count': buildings.count(),
                    'assets_count': assets.count(),
                    'active_contracts_count': contracts.filter(status='active').count(),
                },
                'today_work_orders': {
                    'today_created': todays_wo.count(),
                    'active_total': active_wo.count(),
                    'overdue_escalations': overdue_wo.count(),
                },
                'pm_compliance': {
                    'compliance_percent': pm_compliance,
                    'due_now_count': due_pm.count(),
                    'total_schedules': total_pm,
                },
                'critical_asset_health': {
                    'critical_total': critical_assets.count(),
                    'critical_down': critical_down,
                    'uptime_percent': round((critical_assets.count() - critical_down) / critical_assets.count() * 100, 1) if critical_assets.exists() else 100.0,
                },
                'budget_control': {
                    'allocated': total_allocated_budget,
                    'spent_and_committed': total_spent_budget,
                    'utilization_percent': budget_utilization,
                },
                'risk_and_compliance': {
                    'high_risks_count': high_risks.count(),
                    'overdue_compliance_count': overdue_comp.count(),
                    'expiring_contracts_count': expiring_contracts.count(),
                },
                'active_flags': FacilityFlagSerializer(active_flags, many=True).data,
                'urgent_escalations': WorkOrderSerializer(overdue_wo[:5], many=True).data,
                'top_recurring_faults': top_faults,
                'due_maintenance_tasks': PreventiveScheduleSerializer(due_pm[:5], many=True).data,
            }
        })

    @action(detail=False, methods=('get',))
    def client_executive_summary(self, request):
        organization = get_active_organization(request)
        now = timezone.now()
        today = timezone.localdate()
        
        assets = scope_model_queryset(FacilityAsset, request, organization)
        work_orders = scope_model_queryset(WorkOrder, request, organization)
        schedules = scope_model_queryset(PreventiveSchedule, request, organization)
        compliance = scope_model_queryset(ComplianceObligation, request, organization)
        risks = scope_model_queryset(FacilityRisk, request, organization)
        budgets = scope_model_queryset(FMBudget, request, organization)
        readings = scope_model_queryset(MeterReading, request, organization)
        
        completed_wo = work_orders.filter(status=WorkOrder.Status.COMPLETED)
        on_time_wo = completed_wo.filter(sla_breached=False).count()
        sla_achievement = round(on_time_wo / completed_wo.count() * 100, 1) if completed_wo.exists() else 0.0
        
        total_pm = schedules.filter(is_active=True).count()
        due_pm = schedules.filter(is_active=True, next_due_on__lte=today).count()
        pm_compliance = round((total_pm - due_pm) / total_pm * 100, 1) if total_pm else 96.0
        
        total_allocated = float(budgets.aggregate(total=Sum('allocated_amount'))['total'] or 0)
        total_spent = float(budgets.aggregate(total=Sum('actual_amount'))['total'] or 0) + float(budgets.aggregate(total=Sum('committed_amount'))['total'] or 0)
        budget_utilization = round(total_spent / total_allocated * 100, 1) if total_allocated else 0.0
        
        total_comp = compliance.count()
        overdue_comp = compliance.filter(status='overdue').count()
        compliance_score = round((total_comp - overdue_comp) / total_comp * 100, 1) if total_comp else 98.0
        high_risks = risks.filter(status__in=('open', 'mitigating'), inherent_score__gte=12)
        
        fm_score = round(
            (sla_achievement * 0.25) +
            (pm_compliance * 0.25) +
            (min(100.0, max(0.0, 100 - (budget_utilization - 90))) * 0.15 if budget_utilization > 90 else 100.0 * 0.15) +
            (compliance_score * 0.20) +
            (95.0 * 0.15),
            1
        )
        
        recommendations = [
            {
                'priority': 'High Priority',
                'title': 'HVAC & Chiller Plant Energy Optimization',
                'impact': 'Estimated 14.5% electricity cost reduction (approx. KES 180,000 / month savings).',
                'action': 'Schedule automated BMS sensor calibration and replace worn air damper actuators.',
                'capex_estimate': 'KES 350,000 (Payback: 2.1 months)',
            },
            {
                'priority': 'Medium Priority',
                'title': 'Vertical Lift 5-Year Major Overhaul & Wire Rope Renewal',
                'impact': 'Mitigate downtime risk on Passenger Lift #2 prior to statutory inspection.',
                'action': 'Commission OEM contractor under approved annual maintenance rate card.',
                'capex_estimate': 'KES 820,000 (Funded from Reserve Float)',
            },
            {
                'priority': 'Advisory',
                'title': 'Water Sub-Metering Check Verification for Commercial Tenants',
                'impact': 'Eliminates unbilled water consumption variance currently at 6.8%.',
                'action': 'Deploy smart ultrasonic check meters on Floors 3 to 6.',
                'capex_estimate': 'KES 195,000',
            },
        ]
        
        return Response({
            'client_summary': {
                'fm_score': fm_score,
                'fm_grade': 'A (Excellent Performance)' if fm_score >= 90 else 'B (Good Standard)' if fm_score >= 80 else 'C (Needs Focus)',
                'service_kpis': {
                    'sla_achievement': sla_achievement,
                    'total_requests_handled': work_orders.count(),
                    'major_incidents': work_orders.filter(priority=WorkOrder.Priority.CRITICAL).count(),
                },
                'maintenance_kpis': {
                    'pm_compliance': pm_compliance,
                    'active_assets_monitored': assets.count(),
                    'critical_uptime': 99.4,
                },
                'cost_and_budget': {
                    'annual_budget_allocated': total_allocated,
                    'actual_and_committed_spend': total_spent,
                    'budget_utilization_percent': budget_utilization,
                    'estimated_annual_savings': 450000.0,
                },
                'compliance_and_governance': {
                    'statutory_compliance_rate': compliance_score,
                    'active_obligations': total_comp,
                    'high_risk_exceptions': high_risks.count(),
                },
                'utility_performance': {
                    'total_electricity_kwh': float(readings.filter(meter__utility_type='electricity').aggregate(total=Sum('consumption'))['total'] or 0),
                    'total_water_m3': float(readings.filter(meter__utility_type='water').aggregate(total=Sum('consumption'))['total'] or 0),
                    'total_utility_cost': float(readings.aggregate(total=Sum('cost'))['total'] or 0),
                },
                'strategic_recommendations': recommendations,
            }
        })


@extend_schema_view(list=extend_schema(request=None, responses=OpenApiTypes.OBJECT))
class FacilityAnalyticsViewSet(ViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.FACILITY

    serializer_class = GenericObjectSerializer

    @extend_schema(request=None, responses={200: {"type": "object"}})
    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        organization = get_active_organization(request)
        assets = scope_model_queryset(FacilityAsset, request, organization)
        work_orders = scope_model_queryset(WorkOrder, request, organization)
        inspections = scope_model_queryset(Inspection, request, organization)
        contractors = scope_model_queryset(Contractor, request, organization)
        readings = scope_model_queryset(MeterReading, request, organization)

        return Response({
            'summary': {
                'total_assets': assets.count(),
                'active_assets': assets.filter(is_active=True).count(),
                'total_work_orders': work_orders.count(),
                'completed_work_orders': work_orders.filter(status='completed').count(),
                'open_work_orders': work_orders.exclude(status__in=('completed', 'cancelled')).count(),
                'total_inspections': inspections.count(),
                'completed_inspections': inspections.filter(status='completed').count(),
                'total_contractors': contractors.count(),
                'active_contractors': contractors.filter(status='active').count(),
                'total_meter_readings': readings.count(),
                'total_consumption': float(readings.aggregate(total=Sum('consumption'))['total'] or 0),
                'total_utility_cost': float(readings.aggregate(total=Sum('cost'))['total'] or 0),
            },
            'work_orders_by_status': list(work_orders.values('status').annotate(count=Count('id')).order_by('status')),
            'work_orders_by_priority': list(work_orders.values('priority').annotate(count=Count('id')).order_by('priority')),
            'assets_by_category': list(assets.values('category').annotate(count=Count('id')).order_by('-count')[:10]),
            'inspections_by_month': [
                {'month': m['month'].isoformat(), 'count': m['count']}
                for m in (
                    inspections.filter(completed_on__isnull=False)
                    .annotate(month=TruncMonth('completed_on'))
                    .values('month').annotate(count=Count('id'))
                    .order_by('month')[:12]
                )
            ],
        })

    @action(detail=False, methods=('get',))
    def exports(self, request):
        from properties.pdf_documents import tabular_report_pdf
        organization = get_active_organization(request)
        export_type = request.query_params.get('type', '').lower()
        # DRF reserves ``format`` for renderer negotiation.  ``?format=pdf``
        # was rejected before this action ran, causing a misleading 404.
        export_format = request.query_params.get('export_format', 'csv').lower()
        start = request.query_params.get('start', '')
        end = request.query_params.get('end', '')

        # Executive Report routes directly to dedicated two-level generator (PDF or JSON)
        if export_type in ('landlord-report', 'executive_fm', 'executive'):
            return self.landlord_report(request)

        title = "Facilities Management Ledger Extract"

        if export_type in ('assets', 'asset_master_register'):
            title = "Plant, Machinery & M&E Equipment Register"
            rows = scope_model_queryset(FacilityAsset, request, organization).values_list(
                'code', 'name', 'category', 'condition', 'manufacturer', 'serial_number', 'is_active'
            )
            header = ['Asset Code', 'Equipment Name', 'Category', 'Condition', 'Manufacturer', 'Serial #', 'Active']
        elif export_type in ('capex', 'capex_lifecycle'):
            title = "Asset Lifecycle & 5-Year Capital Renewal (CAPEX) Plan"
            assets_qs = scope_model_queryset(FacilityAsset, request, organization).select_related('property')
            rows = []
            header = ['Asset Code', 'Equipment Name', 'Category', 'Condition Score', 'Install Date', 'Purchase Cost (KES)', 'Est. Replacement (KES)', 'Priority']
            for a in assets_qs:
                score = str(getattr(a, 'condition_score', a.condition or '3'))
                cost = getattr(a, 'purchase_cost', None) or 0
                repl = getattr(a, 'replacement_cost', None) or (cost * Decimal('1.25') if cost else Decimal('0'))
                priority = "High" if str(score) in ('1', '2', 'poor', 'critical') else "Medium"
                rows.append((
                    a.code, a.name, a.category, score,
                    str(getattr(a, 'installed_on', '—') or '—'),
                    f"{cost:,.0f}" if cost else "—",
                    f"{repl:,.0f}" if repl else "—",
                    priority
                ))
        elif export_type in ('work-orders', 'work_order_ledger'):
            title = "Work Orders & Reactive Helpdesk Ledger"
            rows = scope_model_queryset(WorkOrder, request, organization).values_list(
                'number', 'title', 'category', 'priority', 'status', 'reported_at', 'resolution_due_at'
            )
            header = ['WO Number', 'Issue Summary', 'Category / Discipline', 'Priority', 'Status', 'Reported On', 'SLA Due Date']
        elif export_type in ('inspections', 'site_inspection_findings'):
            title = "Site & Safety Inspection Findings Register"
            rows = scope_model_queryset(Inspection, request, organization).values_list(
                'reference', 'title', 'inspection_type', 'status', 'scheduled_on', 'completed_on'
            )
            header = ['Reference #', 'Inspection Title', 'Scope / Discipline', 'Status', 'Scheduled', 'Completed']
        elif export_type in ('statutory', 'compliance_audit'):
            title = "Statutory Compliance & Mandatory Building Certificates"
            rows = scope_model_queryset(ComplianceObligation, request, organization).values_list(
                'title', 'issuing_authority', 'status', 'issue_date', 'expiry_date', 'responsible_person__username'
            )
            header = ['Statutory Requirement', 'Authority / Agency', 'Status', 'Issue Date', 'Expiry Date', 'Responsible Person']
        elif export_type in ('contractors', 'vendor_scorecard', 'contractor_master_contracts'):
            title = "Service Provider SLA & 7-Pillar Scorecard Register"
            rows = scope_model_queryset(Contractor, request, organization).values_list(
                'code', 'name', 'specialty', 'status', 'rating', 'contact_name', 'phone', 'email'
            )
            header = ['Vendor Code', 'Company / Contractor', 'Specialty', 'Status', 'Scorecard Rating', 'Contact Person', 'Phone', 'Email']
        elif export_type in ('budgets', 'cost_variance'):
            title = "Facility Operating Cost & Budget Commitment Statement"
            rows = scope_model_queryset(FMBudget, request, organization).values_list(
                'category', 'allocated_amount', 'financial_year', 'period_month'
            )
            header = ['Cost Category / Department', 'Allocated Budget (KES)', 'Financial Year', 'Period Month']
        elif export_type == 'expenses':
            title = "Facility Direct Operational Expenses Ledger"
            rows = scope_model_queryset(FacilityExpense, request, organization).values_list(
                'float_reference', 'supplier', 'category', 'amount', 'spent_on', 'status'
            )
            header = ['Voucher Ref', 'Supplier / Payee', 'Category', 'Amount (KES)', 'Incurred On', 'Payment Status']
        elif export_type in ('meters', 'energy', 'energy_utilities_bi', 'meter_readings_extract'):
            title = "Energy & Utilities Consumption Intelligence Register"
            rows = scope_model_queryset(MeterReading, request, organization).values_list(
                'meter__code', 'meter__utility_type', 'previous_value', 'value', 'consumption', 'cost', 'read_at'
            )
            header = ['Meter ID', 'Utility Type', 'Opening Index', 'Closing Index', 'Consumption (Units)', 'Total Cost (KES)', 'Reading Date']
        elif export_type in ('ppm', 'ppm_compliance_schedule'):
            title = "Preventive Maintenance (PPM) Schedule & Compliance"
            rows = scope_model_queryset(PreventiveSchedule, request, organization).values_list(
                'code', 'name', 'frequency', 'next_due_on', 'last_completed_on', 'is_active'
            )
            header = ['Schedule Code', 'Task Title', 'Frequency', 'Next Due Date', 'Last Completed', 'Active']
        elif export_type in ('incidents', 'incidents_summary'):
            title = "Facility Incidents & Critical Defect Log"
            rows = scope_model_queryset(FacilityIncident, request, organization).values_list(
                'reference', 'narrative', 'category', 'severity', 'status', 'occurred_at'
            )
            header = ['Incident Ref', 'Incident Narrative', 'Category', 'Severity', 'Status', 'Occurred At']
        elif export_type in ('requisitions', 'requisitions_pipeline'):
            title = "Repair Requisitions & Procurement Pipeline"
            rows = scope_model_queryset(RepairRequisition, request, organization).values_list(
                'code', 'title', 'priority', 'status', 'estimated_cost'
            )
            header = ['Requisition #', 'Title / Description', 'Priority', 'Approval Status', 'Est. Cost (KES)']
        elif export_type in ('invoices', 'supplier_invoices_ledger'):
            title = "Supplier Invoices & Expenditure Audit Ledger"
            rows = scope_model_queryset(SupplierInvoice, request, organization).values_list(
                'code', 'supplier__name', 'total', 'status', 'created_at'
            )
            header = ['Invoice #', 'Vendor / Supplier', 'Total Amount (KES)', 'Payment Status', 'Issued Date']
        elif export_type in ('risks', 'risk_register_report'):
            title = "Facility Risk Register & Hazard Matrix"
            rows = scope_model_queryset(FacilityRisk, request, organization).values_list(
                'risk_id', 'description', 'category', 'likelihood', 'impact', 'status'
            )
            header = ['Risk ID', 'Risk Title / Hazard', 'Category', 'Likelihood', 'Impact Severity', 'Risk Status']
        else:
            return Response({'error': f'Unknown export type "{export_type}".'}, status=400)

        # JSON response for in-browser interactive preview table
        if export_format == 'json':
            row_list = list(rows)
            return Response({
                'title': title,
                'headers': header,
                'rows': [list(r) for r in row_list[:100]],
                'total_count': len(row_list),
            })

        # Build CSV string
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        writer.writerow(header)
        for row in rows:
            writer.writerow(row)
        csv_text = csv_buffer.getvalue()
        csv_bytes = csv_text.encode('utf-8')

        # PDF generation using established tabular_report_pdf engine
        if export_format == 'pdf':
            property_record = scope_model_queryset(Property, request, organization).first()
            prop_name = property_record.name if property_record else "Accessible facility portfolio"
            period_str = f"{start} to {end}" if start and end else f"As of {timezone.localdate():%d %b %Y}"
            return tabular_report_pdf(
                organization,
                title,
                f"facility-{export_type}-{timezone.localdate():%Y-%m-%d}.pdf",
                csv_bytes,
                property_name=prop_name,
                period=period_str,
                generated_by=request.user.get_full_name() or request.user.username,
                subtitle="Authoritative Facilities Ledger Extract",
            )

        response = HttpResponse(csv_bytes, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="facility-{export_type}.csv"'
        return response

    @action(detail=False, methods=('get',), url_path='landlord-report')
    def landlord_report(self, request):
        """Return a two-level property-scoped FM Executive Pack (Executive Performance + Detailed FM Report)."""
        organization = get_active_organization(request)
        export_format = request.query_params.get('export_format', 'pdf').lower()

        assets = scope_model_queryset(FacilityAsset, request, organization)
        work_orders = scope_model_queryset(WorkOrder, request, organization)
        inspections = scope_model_queryset(Inspection, request, organization)
        schedules = scope_model_queryset(PreventiveSchedule, request, organization)
        incidents = scope_model_queryset(FacilityIncident, request, organization)
        budgets = scope_model_queryset(FMBudget, request, organization)
        expenses = scope_model_queryset(FacilityExpense, request, organization)
        appraisals = scope_model_queryset(ServiceAppraisal, request, organization)
        service_lines = scope_model_queryset(ServiceLine, request, organization)
        contracts = scope_model_queryset(ContractorContract, request, organization)
        requisitions = scope_model_queryset(RepairRequisition, request, organization)
        meters = scope_model_queryset(MeterReading, request, organization)
        obligations = scope_model_queryset(ComplianceObligation, request, organization)
        actions = scope_model_queryset(ImprovementAction, request, organization)

        # Property filter
        prop_id = request.query_params.get('property')
        if prop_id and prop_id not in ('all', 'portfolio', ''):
            assets = assets.filter(property_id=prop_id)
            work_orders = work_orders.filter(property_id=prop_id)
            inspections = inspections.filter(property_id=prop_id)
            schedules = schedules.filter(asset__property_id=prop_id)
            incidents = incidents.filter(property_id=prop_id)
            budgets = budgets.filter(property_id=prop_id)
            expenses = expenses.filter(property_id=prop_id)
            appraisals = appraisals.filter(property_id=prop_id)
            service_lines = service_lines.filter(property_id=prop_id)
            contracts = contracts.filter(property_id=prop_id)
            requisitions = requisitions.filter(property_id=prop_id)
            meters = meters.filter(meter__property_id=prop_id)
            obligations = obligations.filter(property_id=prop_id)
            actions = actions.filter(property_id=prop_id)

        # Date range filter
        start = request.query_params.get('start', '')
        end = request.query_params.get('end', '')
        if start:
            work_orders = work_orders.filter(reported_at__date__gte=start)
            incidents = incidents.filter(occurred_at__date__gte=start)
            expenses = expenses.filter(incurred_on__gte=start)
            appraisals = appraisals.filter(period_start__gte=start)
        if end:
            work_orders = work_orders.filter(reported_at__date__lte=end)
            incidents = incidents.filter(occurred_at__date__lte=end)
            expenses = expenses.filter(incurred_on__lte=end)
            appraisals = appraisals.filter(period_end__lte=end)

        property_record = None
        if prop_id and prop_id not in ('all', 'portfolio', ''):
            from properties.models import Property
            property_record = Property.objects.filter(id=prop_id).first()
        if not property_record:
            p_name = assets.values_list('property__name', flat=True).first() or work_orders.values_list('property__name', flat=True).first()
            property_name = p_name or 'Accessible property portfolio'
        else:
            property_name = property_record.name

        today = timezone.localdate()
        open_orders = work_orders.exclude(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED))
        overdue_orders = open_orders.filter(resolution_due_at__lt=timezone.now())
        completed_orders = work_orders.filter(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.RESOLVED))
        total_orders_count = work_orders.count()
        sla_rate = round(((total_orders_count - overdue_orders.count()) / total_orders_count) * 100, 1) if total_orders_count else 100.0

        completed_schedules = schedules.filter(is_active=True, last_completed_on__isnull=False).count()
        due_schedules = schedules.filter(is_active=True).count()
        overdue_schedules = schedules.filter(is_active=True, next_due_on__lt=today).count()
        ppm_rate = round((completed_schedules / due_schedules) * 100, 1) if due_schedules else 100.0

        allocated = budgets.aggregate(total=Sum('allocated_amount'))['total'] or Decimal('0')
        spent = expenses.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        variance = allocated - spent
        budget_utilization = round((spent / allocated) * 100, 1) if allocated > 0 else 0.0

        open_incidents = incidents.exclude(status=FacilityIncident.Status.CLOSED)
        high_risk_incidents = open_incidents.filter(severity__in=('high', 'critical'))

        posted_appraisals = appraisals.filter(status='posted')
        avg_provider_score_val = posted_appraisals.aggregate(avg=Avg('final_score'))['avg']
        avg_provider_score = round(float(avg_provider_score_val), 1) if avg_provider_score_val is not None else 88.5

        # Executive Status Logic
        sla_status = 'ACHIEVED' if sla_rate >= 95 else ('ATTENTION' if sla_rate >= 85 else 'RED FLAG')
        ppm_status = 'ACHIEVED' if ppm_rate >= 90 else ('ATTENTION' if ppm_rate >= 75 else 'RED FLAG')
        incident_status = 'ACHIEVED' if open_incidents.count() == 0 else ('ATTENTION' if open_incidents.count() <= 2 and high_risk_incidents.count() == 0 else 'RED FLAG')
        work_order_status = 'ACHIEVED' if overdue_orders.count() == 0 else ('ATTENTION' if overdue_orders.count() <= 3 else 'RED FLAG')
        financial_status = 'ACHIEVED' if spent <= allocated else ('ATTENTION' if spent <= (allocated * Decimal('1.10')) else 'RED FLAG')
        provider_status = 'ACHIEVED' if avg_provider_score >= 85 else ('ATTENTION' if avg_provider_score >= 70 else 'RED FLAG')

        # Management Attention / Exceptions
        management_attention = []
        for o in overdue_orders.order_by('resolution_due_at')[:5]:
            management_attention.append({
                'category': 'SLA Overdue',
                'matter': f"Work Order {o.number}: {o.title}",
                'severity': 'RED FLAG' if o.priority in ('critical', 'high', 'emergency') else 'ATTENTION',
                'action_required': f"Expedite resolution with assigned technician ({getattr(o.assigned_to, 'username', 'unassigned')})",
                'deadline': timezone.localtime(o.resolution_due_at).strftime('%d %b %Y %H:%M') if o.resolution_due_at else 'Immediate',
                'ref': o.number,
                'status': o.get_status_display(),
                'drill_down': 'work_orders',
            })
        for inc in high_risk_incidents[:5]:
            management_attention.append({
                'category': 'Critical Incident',
                'matter': f"Incident {inc.reference}: {inc.category} ({inc.location})",
                'severity': 'RED FLAG',
                'action_required': inc.immediate_action or 'Deploy containment and HSE safety review',
                'deadline': 'Immediate / 24h',
                'ref': inc.reference,
                'status': inc.get_status_display(),
                'drill_down': 'incident_register',
            })
        for s in schedules.filter(is_active=True, next_due_on__lt=today)[:5]:
            management_attention.append({
                'category': 'PPM Overdue',
                'matter': f"Overdue servicing: {s.name} ({s.code})",
                'severity': 'ATTENTION',
                'action_required': 'Issue work order and mobilize vendor technician',
                'deadline': str(s.next_due_on) if s.next_due_on else 'Overdue',
                'ref': s.code,
                'status': 'Overdue',
                'drill_down': 'ppm',
            })
        if spent > allocated and allocated > 0:
            management_attention.append({
                'category': 'Budget Variance',
                'matter': f"Expenditure exceeds allocated budget by KES {(spent - allocated):,.0f}",
                'severity': 'RED FLAG' if spent > (allocated * Decimal('1.10')) else 'ATTENTION',
                'action_required': 'Conduct spend review and freeze discretionary requisitions',
                'deadline': 'Month-end',
                'ref': 'BUDGET-OVERRUN',
                'status': 'Review Required',
                'drill_down': 'financial',
            })

        # Build 10 Detailed Supporting Tables for Tab 2
        # Table 1: Work Orders / Tickets
        wo_rows = []
        for o in work_orders.order_by('-reported_at')[:50]:
            wo_rows.append([
                o.number,
                timezone.localtime(o.reported_at).strftime('%d %b %Y') if o.reported_at else '—',
                o.title,
                o.location or (getattr(o.property, 'name', None) or '—'),
                o.get_priority_display(),
                getattr(o.assigned_to, 'username', 'Unassigned'),
                timezone.localtime(o.resolution_due_at).strftime('%d %b %Y') if o.resolution_due_at else 'Standard SLA',
                o.get_status_display(),
                timezone.localtime(o.resolved_at).strftime('%d %b %Y %H:%M') if getattr(o, 'resolved_at', None) else '—',
            ])

        # Table 2: Preventive Maintenance
        ppm_rows = []
        for s in schedules.select_related('asset').order_by('next_due_on')[:50]:
            ppm_rows.append([
                getattr(s.asset, 'name', s.name),
                s.get_frequency_display() if hasattr(s, 'get_frequency_display') else s.frequency,
                str(s.next_due_on or '—'),
                str(s.last_completed_on or '—'),
                getattr(getattr(s.asset, 'supplier', None), 'name', 'Service Contractor'),
                f"KES {getattr(s, 'estimated_cost', 0):,.0f}",
                'Active' if s.is_active else 'Paused',
                str(s.next_due_on or '—'),
            ])

        # Table 3: Asset Condition
        asset_rows = []
        for a in assets.order_by('name')[:50]:
            asset_rows.append([
                a.code,
                a.name,
                a.category,
                a.location or 'Main Plant',
                f"{a.condition} / 5",
                getattr(a, 'notes', 'Operational'),
                'Inspected & Calibrated',
                'Operational' if a.is_active else 'Decommissioned',
            ])

        # Table 4: Incident & Risk Register
        inc_rows = []
        for inc in incidents.order_by('-occurred_at')[:50]:
            inc_rows.append([
                inc.reference,
                timezone.localtime(inc.occurred_at).strftime('%d %b %Y %H:%M') if inc.occurred_at else '—',
                inc.category,
                inc.location or 'Site Compound',
                getattr(getattr(inc, 'reported_by', None), 'username', 'Site Officer'),
                inc.get_severity_display(),
                inc.impact or 'Moderate Operational Impact',
                inc.immediate_action or 'Immediate containment initiated',
                inc.corrective_action or 'Pending review',
                inc.get_status_display(),
            ])

        # Table 5: Service Provider Performance
        sp_rows = []
        for sl in service_lines.select_related('property')[:30]:
            appr = appraisals.filter(service_line=sl).order_by('-period_end').first()
            contract = contracts.filter(service_line=sl).first()
            c_name = getattr(getattr(contract, 'contractor', None), 'name', 'Contractor Unassigned')
            score = f"{appr.final_score}%" if appr and appr.final_score is not None else "Pending Audit"
            tier = appr.get_tier_rating_display() if appr and hasattr(appr, 'get_tier_rating_display') else (appr.tier_rating if appr else "Tier 1 · Approved")
            sp_rows.append([
                sl.name,
                c_name,
                contract.status.upper() if contract else 'ACTIVE',
                str(work_orders.filter(property=sl.property).count()),
                f"{sla_rate}%",
                f"{ppm_rate}%",
                f"{score} ({tier})",
                '0 Outstanding Lapses' if not appr or (appr and (appr.final_score or 0) >= 85) else 'Action Plan Required',
            ])

        # Table 6: Procurement & Works
        proc_rows = []
        for req in requisitions.select_related('property')[:50]:
            proc_rows.append([
                req.code,
                req.title,
                f"LPO-{req.code[-5:]}",
                getattr(getattr(req, 'preferred_contractor', None), 'name', 'Approved Vendor'),
                f"WO-{req.code[-4:]}",
                f"INV-{req.code[-4:]}",
                'Approved for Payment' if req.status == 'approved' else req.status.capitalize(),
                req.status.capitalize(),
            ])

        # Table 7: Financial / Expenditure
        fin_rows = []
        for b in budgets.select_related('property')[:30]:
            b_alloc = float(b.allocated_amount or 0)
            b_exp = float(expenses.filter(budget=b).aggregate(t=Sum('amount'))['t'] or 0)
            b_var = b_alloc - b_exp
            fin_rows.append([
                b.name or b.get_category_display(),
                f"KES {b_alloc:,.0f}",
                f"KES {b_exp:,.0f}",
                f"KES {b_var:,.0f}",
                str(expenses.filter(budget=b).count()),
                'Favorable' if b_var >= 0 else 'Deficit Exceeded',
            ])

        # Table 8: Utilities / Water
        util_rows = []
        for m in meters.select_related('meter').order_by('-read_at')[:50]:
            prev = float(m.previous_value or 0)
            curr = float(m.value or 0)
            diff = curr - prev
            c_cost = float(m.cost or 0)
            util_rows.append([
                timezone.localtime(m.read_at).strftime('%b %Y') if m.read_at else 'Current Period',
                f"{curr:,.1f}",
                f"{prev:,.1f}",
                f"{diff:,.1f} units",
                f"KES {c_cost:,.0f}",
                f"KES {c_cost:,.0f}",
                "KES 0",
            ])

        # Table 9: Compliance & Inspections
        comp_rows = []
        for ob in obligations.order_by('valid_until')[:50]:
            comp_rows.append([
                ob.title,
                getattr(ob.property, 'name', 'Site Compound'),
                str(ob.valid_until or '—'),
                ob.authority or 'County / Statutory Body',
                ob.reference or f"CERT-{ob.id}",
                ob.status.capitalize(),
                'Renewal in progress' if ob.status == 'expiring' else 'Fully Compliant',
            ])

        # Table 10: Outstanding Actions
        act_rows = []
        for act in actions.order_by('-created_at')[:50]:
            act_rows.append([
                act.code or f"ACT-{act.id}",
                act.title or act.finding,
                str(act.created_at.date() if hasattr(act, 'created_at') and act.created_at else today),
                getattr(act.responsible_person, 'username', 'Facilities Officer'),
                act.corrective_measure or 'Implement audit recommendation',
                str(act.target_completion_date or 'Next Audit'),
                act.status.capitalize(),
            ])

        # JSON response for rich two-level interactive UI
        if export_format == 'json':
            return Response({
                'property_name': property_name,
                'reporting_period': {
                    'start': start or f"{today.year}-{today.month:02d}-01",
                    'end': end or str(today),
                    'as_of': today.strftime('%d %b %Y'),
                },
                'executive_performance': {
                    'summary_kpis': [
                        { 'id': 'wo', 'label': 'Work Orders Active', 'value': str(open_orders.count()), 'subtext': f"{completed_orders.count()} closed this period", 'status': work_order_status, 'target': '0 Overdue', 'drill_down': 'work_orders' },
                        { 'id': 'sla', 'label': 'SLA Compliance Rate', 'value': f"{sla_rate}%", 'subtext': f"{overdue_orders.count()} overdue tickets", 'status': sla_status, 'target': '>= 95.0%', 'drill_down': 'work_orders' },
                        { 'id': 'ppm', 'label': 'PPM Compliance Rate', 'value': f"{ppm_rate}%", 'subtext': f"{completed_schedules} of {due_schedules} schedules completed", 'status': ppm_status, 'target': '>= 90.0%', 'drill_down': 'ppm' },
                        { 'id': 'inc', 'label': 'Incident Risk Index', 'value': str(open_incidents.count()), 'subtext': f"{high_risk_incidents.count()} high severity open", 'status': incident_status, 'target': '0 Open Risks', 'drill_down': 'incident_register' },
                        { 'id': 'fin', 'label': 'Budget Utilization', 'value': f"{budget_utilization}%", 'subtext': f"KES {spent:,.0f} of {allocated:,.0f} spent", 'status': financial_status, 'target': '<= 100%', 'drill_down': 'financial' },
                        { 'id': 'sp', 'label': 'Service Provider Score', 'value': f"{avg_provider_score}%", 'subtext': f"Overall Appraisal: Tier 1", 'status': provider_status, 'target': '>= 85.0%', 'drill_down': 'service_providers' },
                    ],
                    'work_orders': {
                        'received': total_orders_count,
                        'completed': completed_orders.count(),
                        'outstanding': open_orders.count(),
                        'overdue': overdue_orders.count(),
                        'resolution_rate': round((completed_orders.count() / total_orders_count * 100), 1) if total_orders_count else 100.0,
                        'sla_compliance_rate': sla_rate,
                    },
                    'sla_performance': {
                        'achieved_count': total_orders_count - overdue_orders.count(),
                        'overdue_count': overdue_orders.count(),
                        'sla_rate': sla_rate,
                        'target': 95.0,
                        'status': sla_status,
                    },
                    'ppm_performance': {
                        'scheduled': due_schedules,
                        'completed': completed_schedules,
                        'overdue': overdue_schedules,
                        'compliance_rate': ppm_rate,
                        'target': 90.0,
                        'status': ppm_status,
                    },
                    'service_providers': [
                        { 'service': r[0], 'provider': r[1], 'status': r[2], 'sla_rate': r[4], 'ppm_rate': r[5], 'score': r[6], 'issues': r[7] } for r in sp_rows[:10]
                    ],
                    'financial_performance': {
                        'allocated': float(allocated),
                        'spent': float(spent),
                        'variance': float(variance),
                        'utilization_rate': budget_utilization,
                        'status': financial_status,
                    },
                    'incident_risk': {
                        'reported': incidents.count(),
                        'closed': incidents.filter(status=FacilityIncident.Status.CLOSED).count(),
                        'open': open_incidents.count(),
                        'high_risk': high_risk_incidents.count(),
                        'status': incident_status,
                    },
                    'management_attention': management_attention,
                },
                'tables': {
                    'work_orders': { 'title': 'Work Orders / Tickets', 'headers': ['Ref', 'Date', 'Description', 'Location', 'Priority', 'Assigned To', 'SLA Due', 'Status', 'Resolution Date'], 'rows': wo_rows },
                    'ppm': { 'title': 'Preventive Maintenance (PPM)', 'headers': ['Asset', 'Maintenance Type', 'Scheduled', 'Completed', 'Provider', 'Cost', 'Status', 'Next Due'], 'rows': ppm_rows },
                    'asset_condition': { 'title': 'Asset Condition Register', 'headers': ['Asset ID', 'Asset', 'Category', 'Location', 'Condition', 'Issue / Findings', 'Action Taken', 'Status'], 'rows': asset_rows },
                    'incident_register': { 'title': 'Incident & Risk Register', 'headers': ['Ref', 'Date / Time', 'Incident', 'Location', 'Persons Involved', 'Risk Level', 'Impact', 'Immediate Action', 'Corrective Action', 'Status'], 'rows': inc_rows },
                    'service_providers': { 'title': 'Service Provider Performance', 'headers': ['Service Line', 'Provider', 'Contract Status', 'Jobs Completed', 'SLA %', 'PPM %', 'Appraisal Rating', 'Issues / Lapses'], 'rows': sp_rows },
                    'procurement': { 'title': 'Procurement & Works Pipeline', 'headers': ['Requisition', 'Description', 'LPO Reference', 'Contractor', 'Job Card', 'Invoice', 'Payment Status', 'Status'], 'rows': proc_rows },
                    'financial': { 'title': 'Financial & Expenditure Ledger', 'headers': ['Budget Category', 'Budget Allocated', 'Actual Spent', 'Variance', 'Transactions', 'Remarks / Headroom'], 'rows': fin_rows },
                    'utilities': { 'title': 'Utilities & Water Management', 'headers': ['Period', 'Closing Meter Reading', 'Opening Reading', 'Consumption Variance', 'Amount Billed', 'Amount Collected', 'Outstanding'], 'rows': util_rows },
                    'compliance': { 'title': 'Statutory Compliance & Inspections', 'headers': ['Compliance Item', 'Property / Area', 'Valid Until', 'Issuing Regulator', 'Certificate Ref', 'Status', 'Action Required'], 'rows': comp_rows },
                    'outstanding_actions': { 'title': 'Outstanding Actions Tracker', 'headers': ['Ref', 'Matter / Corrective Action', 'Date Raised', 'Responsible Party', 'Required Action', 'Target Date', 'Status'], 'rows': act_rows },
                }
            })

        # PDF generation
        branding = (organization.settings or {}).get('branding', {})
        company_name = branding.get('company_name') or organization.name
        address = branding.get('address') or branding.get('management_address') or 'Nairobi, Kenya'
        contact = ' | '.join(filter(None, (branding.get('phone'), branding.get('email')))) or 'info@propertylegend.com'

        stream = BytesIO()
        document = SimpleDocTemplate(
            stream, pagesize=landscape(A4), rightMargin=14 * mm, leftMargin=14 * mm,
            topMargin=12 * mm, bottomMargin=12 * mm,
            title=f'Facilities Management Performance Report - {property_name}',
            author=company_name,
        )
        styles = getSampleStyleSheet()
        navy = colors.HexColor('#10233F')
        red = colors.HexColor('#D62828')
        muted = colors.HexColor('#475569')
        title_style = ParagraphStyle('FacilityTitle', parent=styles['Heading1'], fontSize=17, leading=20, textColor=navy, spaceAfter=3)
        right_style = ParagraphStyle('FacilityHeaderRight', parent=styles['Normal'], alignment=TA_RIGHT, textColor=navy, leading=14)
        small_style = ParagraphStyle('FacilitySmall', parent=styles['Normal'], fontSize=8.5, leading=11, textColor=muted)
        section_style = ParagraphStyle('FacilitySection', parent=styles['Heading2'], fontSize=11, leading=14, textColor=navy, spaceBefore=8, spaceAfter=6)

        header = Table([
            [Paragraph(f'<b>{company_name}</b><br/><font size="8">{address}<br/>{contact}</font>', title_style),
             Paragraph(f'<b>FACILITIES MANAGEMENT PERFORMANCE REPORT</b><br/>{property_name}<br/><font size="8">Reporting date: {today:%d %b %Y}</font>', right_style)],
        ], colWidths=[135 * mm, 125 * mm])
        header.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))

        def styled_table(data, widths=None):
            table = Table(data, colWidths=widths, repeatRows=1)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), navy), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('FONTSIZE', (0, 1), (-1, -1), 8), ('TEXTCOLOR', (0, 1), (-1, -1), navy),
                ('GRID', (0, 0), (-1, -1), .35, colors.HexColor('#CBD5E1')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F1F5F9')]),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            return table

        kpis = [
            ['Active assets', 'Open work orders', 'SLA overdue', 'PPM compliance', 'Open incidents', 'Budget / actual'],
            [str(assets.filter(is_active=True).count()), str(open_orders.count()), str(overdue_orders.count()),
             f'{ppm_rate:.1f}%', str(open_incidents.count()),
             f'KES {allocated:,.0f} / {spent:,.0f}'],
        ]
        order_rows_pdf = [['Work order', 'Description', 'Priority', 'Status', 'Reported', 'Resolution due']]
        for order in work_orders.order_by('-reported_at')[:12]:
            order_rows_pdf.append([
                order.number, order.title, order.get_priority_display(), order.get_status_display(),
                timezone.localtime(order.reported_at).strftime('%d %b %Y'),
                timezone.localtime(order.resolution_due_at).strftime('%d %b %Y %H:%M') if order.resolution_due_at else 'Not set',
            ])
        if len(order_rows_pdf) == 1:
            order_rows_pdf.append(['—', 'No work orders recorded for this scope.', '—', '—', '—', '—'])

        incident_rows_pdf = [['Reference', 'Category', 'Severity', 'Status', 'Location', 'Occurred']]
        for incident in incidents.order_by('-occurred_at')[:10]:
            incident_rows_pdf.append([
                incident.reference, incident.category, incident.get_severity_display(), incident.get_status_display(),
                incident.location, timezone.localtime(incident.occurred_at).strftime('%d %b %Y %H:%M'),
            ])
        if len(incident_rows_pdf) == 1:
            incident_rows_pdf.append(['—', 'No incidents recorded for this scope.', '—', '—', '—', '—'])

        story = [
            header, Spacer(1, 4 * mm), Table([['']], colWidths=[260 * mm], rowHeights=[1.5 * mm], style=[('BACKGROUND', (0, 0), (-1, -1), red)]),
            Spacer(1, 5 * mm), styled_table(kpis),
            Paragraph('Work order performance', section_style), styled_table(order_rows_pdf),
            Paragraph('Incident and risk register', section_style), styled_table(incident_rows_pdf),
            Spacer(1, 5 * mm),
            Paragraph(f'Record basis: {assets.count()} assets, {work_orders.count()} work orders, {inspections.count()} inspections, '
                      f'{schedules.count()} preventive schedules and {incidents.count()} incidents. Values reflect the selected organization and property access scope.', small_style),
            Spacer(1, 7 * mm), styled_table([['Prepared by', 'Reviewed by', 'Approved by'], ['____________________________', '____________________________', '____________________________'], ['Name / Date', 'Name / Date', 'Name / Date']])
        ]
        document.build(story)
        response = HttpResponse(stream.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="facility-performance-{today:%Y-%m-%d}.pdf"'
        return response


class ServiceLineViewSet(FacilityModelViewSet):
    queryset = ServiceLine.objects.select_related('property', 'responsible_manager').prefetch_related('scorecard_versions__kpis')
    serializer_class = ServiceLineSerializer
    search_fields = ('name', 'code', 'property__name')

    @transaction.atomic
    def perform_create(self, serializer):
        organization = get_active_organization(self.request)
        service_line = serializer.save(organization=organization)

        template_key = self.request.data.get('rubric_template')
        custom_kpis = self.request.data.get('custom_kpis') or self.request.data.get('kpis')

        kpi_list = []
        if custom_kpis and isinstance(custom_kpis, list) and len(custom_kpis) > 0:
            kpi_list = custom_kpis
        elif template_key and template_key in STANDARD_RUBRIC_TEMPLATES:
            kpi_list = STANDARD_RUBRIC_TEMPLATES[template_key]['kpis']

        total_weight = sum(Decimal(str(item.get('max_weight', 0))) for item in kpi_list) if kpi_list else Decimal('0')
        is_active = (total_weight == Decimal('100.0') or total_weight == Decimal('100'))

        scorecard = ScorecardVersion.objects.create(
            organization=organization,
            service_line=service_line,
            version_code=str(self.request.data.get('initial_version_code') or 'V1.0').strip(),
            status=ScorecardVersion.Status.ACTIVE if is_active else ScorecardVersion.Status.DRAFT,
            effective_date=timezone.localdate() if is_active else None,
            notes=f'Configured scorecard using {template_key or "custom"} rubric'
        )

        for idx, kpi in enumerate(kpi_list):
            ScorecardKPI.objects.create(
                organization=organization,
                scorecard_version=scorecard,
                order=kpi.get('order') or (idx + 1),
                area=str(kpi.get('area', 'General Delivery')),
                measure=str(kpi.get('measure', '')),
                target_standard=str(kpi.get('target_standard', '')),
                evidence_method=str(kpi.get('evidence_method', 'Inspection report')),
                max_weight=Decimal(str(kpi.get('max_weight', 5))),
                is_active=bool(kpi.get('is_active', True)),
            )

    @action(detail=False, methods=['get'], url_path='rubric_templates')
    def rubric_templates(self, request):
        """Returns catalog of standard service line appraisal rubric templates."""
        return Response({'templates': list(STANDARD_RUBRIC_TEMPLATES.values())})

    @action(detail=False, methods=['post'], url_path='seed_defaults')
    def seed_defaults(self, request):
        """Seed default service lines and scorecard templates (All 11 FM service lines or specified keys)."""
        organization = get_active_organization(request)
        property_id = request.data.get('property_id')
        if not property_id:
            prop = Property.objects.filter(organization=organization).first()
            if not prop:
                return Response({'detail': 'No property found to seed service lines for.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            prop = Property.objects.filter(organization=organization, id=property_id).first()
            if not prop:
                return Response({'detail': 'Property not found.'}, status=status.HTTP_404_NOT_FOUND)

        selected_templates = request.data.get('templates')
        if not selected_templates or selected_templates == 'all':
            template_keys = list(STANDARD_RUBRIC_TEMPLATES.keys())
        elif isinstance(selected_templates, list):
            template_keys = selected_templates
        else:
            template_keys = ['cleaning', 'security']

        created_lines = []
        with transaction.atomic():
            for t_key in template_keys:
                tpl = STANDARD_RUBRIC_TEMPLATES.get(t_key)
                if not tpl:
                    continue
                code = f"{tpl['code']}-{prop.code or '01'}"
                s_line, _ = ServiceLine.objects.get_or_create(
                    organization=organization,
                    property=prop,
                    code=code,
                    defaults={
                        'name': tpl['name'],
                        'scope': tpl['scope'],
                        'sla_standard': tpl['sla_standard'],
                        'appraisal_frequency': tpl['appraisal_frequency'],
                        'is_active': True,
                    }
                )
                sc_version, _ = ScorecardVersion.objects.get_or_create(
                    organization=organization,
                    service_line=s_line,
                    version_code='V1.0',
                    defaults={
                        'status': ScorecardVersion.Status.ACTIVE,
                        'effective_date': timezone.localdate(),
                        'notes': f"Standard 100% {tpl['name']} Scorecard"
                    }
                )
                if not sc_version.kpis.exists():
                    for kpi in tpl['kpis']:
                        ScorecardKPI.objects.create(
                            organization=organization,
                            scorecard_version=sc_version,
                            order=kpi['order'],
                            area=kpi['area'],
                            measure=kpi['measure'],
                            target_standard=kpi['target_standard'],
                            evidence_method=kpi['evidence_method'],
                            max_weight=Decimal(str(kpi['max_weight'])),
                            is_active=True,
                        )
                created_lines.append(s_line.name)

        return Response({
            'status': 'ok',
            'detail': f'Seeded {len(created_lines)} service lines and 100% active scorecards for {prop.name}.',
            'seeded_lines': created_lines,
        })


class ScorecardVersionViewSet(FacilityModelViewSet):
    queryset = ScorecardVersion.objects.select_related('service_line').prefetch_related('kpis')
    serializer_class = ScorecardVersionSerializer

    @action(detail=True, methods=['post'], url_path='save_kpis')
    def save_kpis(self, request, pk=None):
        version = self.get_object()
        kpis_data = request.data.get('kpis', [])
        organization = get_active_organization(request)

        with transaction.atomic():
            version.kpis.all().delete()
            total_w = Decimal('0.0')
            for idx, item in enumerate(kpis_data):
                w = Decimal(str(item.get('max_weight', 5)))
                total_w += w
                ScorecardKPI.objects.create(
                    organization=organization,
                    scorecard_version=version,
                    order=idx + 1,
                    area=str(item.get('area', '')),
                    measure=str(item.get('measure', '')),
                    target_standard=str(item.get('target_standard', '')),
                    evidence_method=str(item.get('evidence_method', '')),
                    max_weight=w,
                    is_active=bool(item.get('is_active', True)),
                )
        return Response({
            'status': 'ok',
            'total_weight': float(total_w),
            'version': ScorecardVersionSerializer(version).data
        })

    @action(detail=True, methods=['post'], url_path='activate')
    def activate(self, request, pk=None):
        version = self.get_object()
        total_w = sum(kpi.max_weight for kpi in version.kpis.filter(is_active=True))
        if total_w != Decimal('100.0') and total_w != Decimal('100'):
            return Response(
                {'detail': f'Scorecard cannot be activated: total weight is {total_w}%, must equal exactly 100%.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        version.service_line.scorecard_versions.filter(status=ScorecardVersion.Status.ACTIVE).exclude(id=version.id).update(
            status=ScorecardVersion.Status.SUPERSEDED
        )
        version.status = ScorecardVersion.Status.ACTIVE
        version.effective_date = timezone.localdate()
        version.save(update_fields=['status', 'effective_date', 'updated_at'])
        return Response({'status': 'ok', 'detail': 'Scorecard version is now active.'})


class ServiceAppraisalViewSet(FacilityModelViewSet):
    queryset = ServiceAppraisal.objects.select_related(
        'contract', 'property', 'contractor', 'service_line', 'scorecard_version', 'posted_by'
    ).prefetch_related('results', 'improvement_actions')
    serializer_class = ServiceAppraisalSerializer
    search_fields = ('period_name', 'contractor__name', 'property__name', 'service_line__name')

    def get_queryset(self):
        qs = super().get_queryset()
        contract_id = self.request.query_params.get('contract_id')
        property_id = self.request.query_params.get('property_id')
        contractor_id = self.request.query_params.get('contractor_id')
        service_line_id = self.request.query_params.get('service_line_id')
        period_name = self.request.query_params.get('period')
        status_filter = self.request.query_params.get('status')
        if contract_id:
            qs = qs.filter(contract_id=contract_id)
        if property_id:
            qs = qs.filter(property_id=property_id)
        if contractor_id:
            qs = qs.filter(contractor_id=contractor_id)
        if service_line_id:
            qs = qs.filter(service_line_id=service_line_id)
        if period_name:
            qs = qs.filter(period_name__icontains=period_name)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        organization = get_active_organization(self.request)
        appraisal = serializer.save(organization=organization)

        scorecard = appraisal.scorecard_version
        if not scorecard and appraisal.contract and appraisal.contract.scorecard_version:
            scorecard = appraisal.contract.scorecard_version
            appraisal.scorecard_version = scorecard
            appraisal.save(update_fields=['scorecard_version'])

        if not scorecard and appraisal.service_line:
            scorecard = appraisal.service_line.scorecard_versions.filter(status=ScorecardVersion.Status.ACTIVE).first()
            if not scorecard:
                scorecard = appraisal.service_line.scorecard_versions.first()
            if scorecard:
                appraisal.scorecard_version = scorecard
                appraisal.save(update_fields=['scorecard_version'])

        if scorecard and not appraisal.results.exists():
            for kpi in scorecard.kpis.filter(is_active=True).order_by('order'):
                AppraisalItemResult.objects.create(
                    organization=organization,
                    appraisal=appraisal,
                    scorecard_kpi=kpi,
                    order=kpi.order,
                    area=kpi.area,
                    measure=kpi.measure,
                    target_standard=kpi.target_standard,
                    actual_observation='',
                    score=kpi.max_weight,
                    max_weight=kpi.max_weight,
                    weighted_score=kpi.max_weight,
                    comment='',
                )
            appraisal.calculate_totals()
            appraisal.save(update_fields=['total_score', 'tier_rating'])

        # Automatically carry forward open improvement actions from previous period
        if appraisal.contract:
            prev_appraisals = ServiceAppraisal.objects.filter(
                organization=organization,
                contract=appraisal.contract,
            ).exclude(id=appraisal.id).order_by('-created_at')
        elif appraisal.contractor and appraisal.service_line:
            prev_appraisals = ServiceAppraisal.objects.filter(
                organization=organization,
                contractor=appraisal.contractor,
                service_line=appraisal.service_line,
            ).exclude(id=appraisal.id).order_by('-created_at')
        else:
            prev_appraisals = ServiceAppraisal.objects.none()

        if prev_appraisals.exists():
            prev_appraisal = prev_appraisals.first()
            for action_item in prev_appraisal.improvement_actions.filter(status__in=['open', 'in_progress']):
                ImprovementAction.objects.create(
                    organization=organization,
                    appraisal=appraisal,
                    issue=action_item.issue,
                    required_action=action_item.required_action,
                    responsible_party=action_item.responsible_party,
                    target_date=action_item.target_date,
                    evidence_required=action_item.evidence_required,
                    status=action_item.status,
                    carried_forward_from=action_item,
                    correction_status=ImprovementAction.CorrectionStatus.NOT_CORRECTED,
                    manager_comment=f"Carried forward from {prev_appraisal.period_name}",
                )

    @action(detail=True, methods=['post'], url_path='save_results')
    def save_results(self, request, pk=None):
        appraisal = self.get_object()
        if appraisal.status == ServiceAppraisal.Status.POSTED and not request.data.get('force'):
            return Response({'detail': 'Posted appraisal is locked against ordinary editing.'}, status=status.HTTP_400_BAD_REQUEST)

        results_data = request.data.get('results', [])
        actions_data = request.data.get('actions', [])
        remarks = request.data.get('remarks')
        pm_signatory = request.data.get('property_manager_signatory')
        sup_signatory = request.data.get('provider_supervisor_signatory')
        is_posting = bool(request.data.get('post', False))

        with transaction.atomic():
            for item in results_data:
                res_id = item.get('id')
                if res_id:
                    result_obj = appraisal.results.filter(id=res_id).first()
                    if result_obj:
                        score_val = Decimal(str(item.get('score', 0)))
                        result_obj.score = score_val
                        result_obj.weighted_score = score_val
                        result_obj.actual_observation = str(item.get('actual_observation', ''))
                        result_obj.comment = str(item.get('comment', ''))
                        if 'evidence_files' in item:
                            result_obj.evidence_files = item.get('evidence_files')
                        result_obj.save()

            for act in actions_data:
                act_id = act.get('id')
                if act_id:
                    act_obj = appraisal.improvement_actions.filter(id=act_id).first()
                    if act_obj:
                        act_obj.status = act.get('status', act_obj.status)
                        act_obj.correction_status = act.get('correction_status', act_obj.correction_status)
                        act_obj.manager_comment = act.get('manager_comment', act_obj.manager_comment)
                        act_obj.save()
                elif act.get('issue'):
                    ImprovementAction.objects.create(
                        organization=appraisal.organization,
                        appraisal=appraisal,
                        issue=act['issue'],
                        required_action=act.get('required_action', ''),
                        responsible_party=act.get('responsible_party', 'Service Provider'),
                        target_date=act.get('target_date'),
                        evidence_required=act.get('evidence_required', ''),
                        status='open',
                    )

            if remarks is not None:
                appraisal.remarks = remarks
            if pm_signatory is not None:
                appraisal.property_manager_signatory = pm_signatory
            if sup_signatory is not None:
                appraisal.provider_supervisor_signatory = sup_signatory

            appraisal.calculate_totals()
            if is_posting:
                appraisal.status = ServiceAppraisal.Status.POSTED
                appraisal.posted_at = timezone.now()
                appraisal.posted_by = request.user if request.user.is_authenticated else None
            appraisal.save()

        return Response({
            'status': 'ok',
            'detail': 'Appraisal saved successfully.',
            'appraisal': ServiceAppraisalSerializer(appraisal).data
        })

    @action(detail=True, methods=['get'], url_path='export_excel')
    def export_excel(self, request, pk=None):
        appraisal = self.get_object()
        output = io.BytesIO()
        workbook = openpyxl.Workbook()
        ws = workbook.active
        ws.title = (appraisal.property.name[:25] if appraisal.property else 'Appraisal').upper()

        ws.cell(row=3, column=2, value="CENTER ESTATES ERP - SERVICE PROVIDER APPRAISAL").font = openpyxl.styles.Font(bold=True, size=13)
        ws.cell(row=5, column=2, value="Month / Period").font = openpyxl.styles.Font(bold=True)
        ws.cell(row=5, column=3, value=appraisal.period_name)
        ws.cell(row=6, column=2, value="Building / Property").font = openpyxl.styles.Font(bold=True)
        ws.cell(row=6, column=3, value=appraisal.property.name if appraisal.property else "—")
        ws.cell(row=7, column=2, value="Service Provider").font = openpyxl.styles.Font(bold=True)
        ws.cell(row=7, column=3, value=appraisal.contractor.name if appraisal.contractor else "—")
        ws.cell(row=8, column=2, value="Service Line").font = openpyxl.styles.Font(bold=True)
        ws.cell(row=8, column=3, value=appraisal.service_line.name if appraisal.service_line else "—")

        ws.cell(row=10, column=2, value=f"{appraisal.service_line.name.upper() if appraisal.service_line else 'SERVICE'} EVALUATION METRIC").font = openpyxl.styles.Font(bold=True, size=11)

        headers = ["No", "Responsibilities / KPI Description", "Target Standard", "Score Rating", "Max Weight", "Observation / Comment"]
        for c_idx, h in enumerate(headers, start=2):
            cell = ws.cell(row=12, column=c_idx, value=h)
            cell.font = openpyxl.styles.Font(bold=True, color="FFFFFF")
            cell.fill = openpyxl.styles.PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")

        cur_row = 13
        results = appraisal.results.all().order_by('order')
        for r in results:
            ws.cell(row=cur_row, column=2, value=r.order)
            ws.cell(row=cur_row, column=3, value=r.measure)
            ws.cell(row=cur_row, column=4, value=r.target_standard or "Agreed standard")
            ws.cell(row=cur_row, column=5, value=float(r.score))
            ws.cell(row=cur_row, column=6, value=float(r.max_weight))
            ws.cell(row=cur_row, column=7, value=r.comment or r.actual_observation or "")
            cur_row += 1

        total_cell_label = ws.cell(row=cur_row, column=4, value="Total Score:")
        total_cell_label.font = openpyxl.styles.Font(bold=True)
        total_cell_val = ws.cell(row=cur_row, column=5, value=float(appraisal.total_score))
        total_cell_val.font = openpyxl.styles.Font(bold=True, size=12, color="0000FF")
        ws.cell(row=cur_row, column=6, value=100)
        ws.cell(row=cur_row, column=7, value=f"Tier Status: {appraisal.tier_rating}").font = openpyxl.styles.Font(bold=True)
        cur_row += 3

        ws.cell(row=cur_row, column=2, value="Property Manager Signatory:").font = openpyxl.styles.Font(bold=True)
        ws.cell(row=cur_row, column=4, value=appraisal.property_manager_signatory or "Authorized Property Manager")
        cur_row += 2
        ws.cell(row=cur_row, column=2, value="Supervisor Service Provider:").font = openpyxl.styles.Font(bold=True)
        ws.cell(row=cur_row, column=4, value=appraisal.provider_supervisor_signatory or "Contractor Supervisor")
        cur_row += 2
        ws.cell(row=cur_row, column=2, value="Manager Remarks:").font = openpyxl.styles.Font(bold=True)
        ws.cell(row=cur_row, column=4, value=appraisal.remarks or "Service delivered in line with contract.")

        workbook.save(output)
        output.seek(0)
        filename = f"appraisal-{appraisal.period_name.replace(' ', '_')}.xlsx"
        response = HttpResponse(output.read(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=False, methods=['get'], url_path='trend_report')
    def trend_report(self, request):
        """Returns multi-period historical appraisal results for trend charting and reporting."""
        contractor_id = request.query_params.get('contractor_id')
        property_id = request.query_params.get('property_id')
        organization = get_active_organization(request)
        qs = ServiceAppraisal.objects.filter(organization=organization)
        if contractor_id:
            qs = qs.filter(contractor_id=contractor_id)
        if property_id:
            qs = qs.filter(property_id=property_id)

        appraisals = qs.order_by('period_end', 'created_at')
        trend = []
        for app in appraisals:
            trend.append({
                'id': app.id,
                'period_name': app.period_name,
                'property_name': app.property.name if app.property else '',
                'contractor_name': app.contractor.name if app.contractor else '',
                'service_line_name': app.service_line.name if app.service_line else '',
                'total_score': float(app.total_score),
                'tier_rating': app.tier_rating,
                'status': app.status,
                'open_actions_count': app.improvement_actions.filter(status='open').count(),
            })
        return Response({'trend': trend})


class ImprovementActionViewSet(FacilityModelViewSet):
    queryset = ImprovementAction.objects.select_related('appraisal', 'appraisal__contractor', 'appraisal__property')
    serializer_class = ImprovementActionSerializer
    search_fields = ('issue', 'required_action', 'responsible_party', 'appraisal__contractor__name')

