"""Tenant move-in handover and move-out exit clearance workflows."""
import uuid

from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from rest_framework import viewsets as viewsets_base

from core.permissions import HasModuleActionPermission

from .models import ExitClearance, TenantHandover
from .serializers import ExitClearanceSerializer, TenantHandoverSerializer


class TenantHandoverViewSet(HasModuleActionPermission, viewsets_base.ModelViewSet):
    write_permission = 'property.leasing'
    permission_map = {'sign_caretaker': 'property.leasing', 'sign_tenant': 'property.leasing', 'acknowledge': 'property.approve'}
    queryset = TenantHandover.objects.select_related('lease', 'unit', 'tenant')
    serializer_class = TenantHandoverSerializer
    search_fields = ('code', 'lease__reference', 'tenant__name', 'unit__code')

    def get_queryset(self):
        from core.tenancy import get_active_organization
        from core.property_scope import scope_queryset_to_property
        organization = get_active_organization(self.request)
        return scope_queryset_to_property(
            self.queryset.filter(organization=organization), self.request, organization,
        )

    def _validate_organization(self, serializer):
        from core.tenancy import get_active_organization
        organization = get_active_organization(self.request)
        for name, value in serializer.validated_data.items():
            if getattr(value, 'organization_id', organization.id) != organization.id:
                raise ValidationError({name: 'The selected record belongs to another organization.'})
        return organization

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        code = f'HND-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}'
        while TenantHandover.objects.filter(organization=organization, code=code).exists():
            code = f'HND-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}'
        lease = serializer.validated_data.get('lease')
        serializer.save(
            organization=organization, code=code,
            unit=serializer.validated_data.get('unit') or getattr(lease, 'unit', None),
            tenant=serializer.validated_data.get('tenant') or getattr(lease, 'tenant', None),
        )

    def perform_update(self, serializer):
        if 'status' in serializer.validated_data:
            raise ValidationError({'status': 'Use the workflow actions so every status change is controlled.'})
        super().perform_update(serializer)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='sign-caretaker')
    def sign_caretaker(self, request, pk=None):
        handover = self.get_object()
        if handover.status not in (TenantHandover.Status.DRAFT, TenantHandover.Status.IN_PROGRESS):
            raise ValidationError({'status': 'Caretaker can only sign an open handover.'})
        name = str(request.data.get('caretaker_name', '')).strip()
        if not name:
            raise ValidationError({'caretaker_name': 'Caretaker name is required to sign.'})
        if not handover.condition_lines:
            raise ValidationError({'condition_lines': 'Capture at least one premises-condition line before signing.'})
        handover.caretaker_name = name
        handover.caretaker_signed_at = timezone.now()
        handover.status = TenantHandover.Status.COMPLETED if handover.tenant_signed_at else TenantHandover.Status.IN_PROGRESS
        handover.save(update_fields=('caretaker_name', 'caretaker_signed_at', 'status', 'updated_at'))
        return Response(TenantHandoverSerializer(handover).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='sign-tenant')
    def sign_tenant(self, request, pk=None):
        handover = self.get_object()
        if handover.status not in (TenantHandover.Status.DRAFT, TenantHandover.Status.IN_PROGRESS):
            raise ValidationError({'status': 'Tenant can only sign an open handover.'})
        if not handover.caretaker_signed_at:
            raise ValidationError({'status': 'The caretaker must sign before the tenant signs.'})
        handover.tenant_signed_at = timezone.now()
        handover.status = TenantHandover.Status.COMPLETED
        handover.save(update_fields=('tenant_signed_at', 'status', 'updated_at'))
        return Response(TenantHandoverSerializer(handover).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='acknowledge')
    def acknowledge(self, request, pk=None):
        handover = self.get_object()
        if handover.status != TenantHandover.Status.COMPLETED:
            raise ValidationError({'status': 'Both caretaker and tenant must sign before acknowledgement.'})
        handover.status = TenantHandover.Status.ACKNOWLEDGED
        handover.acknowledged_at = timezone.now()
        handover.save(update_fields=('status', 'acknowledged_at', 'updated_at'))
        return Response(TenantHandoverSerializer(handover).data)


class ExitClearanceViewSet(HasModuleActionPermission, viewsets_base.ModelViewSet):
    write_permission = 'property.leasing'
    permission_map = {'approve_manager': 'property.approve', 'approve_finance': 'property.finance', 'issue_gate_pass': 'property.approve'}
    queryset = ExitClearance.objects.select_related('lease', 'tenant', 'manager_approved_by', 'finance_approved_by')
    serializer_class = ExitClearanceSerializer
    search_fields = ('code', 'lease__reference', 'tenant__name')

    def get_queryset(self):
        from core.tenancy import get_active_organization
        from core.property_scope import scope_queryset_to_property
        organization = get_active_organization(self.request)
        return scope_queryset_to_property(
            self.queryset.filter(organization=organization), self.request, organization,
        )

    def _validate_organization(self, serializer):
        from core.tenancy import get_active_organization
        organization = get_active_organization(self.request)
        for name, value in serializer.validated_data.items():
            if getattr(value, 'organization_id', organization.id) != organization.id:
                raise ValidationError({name: 'The selected record belongs to another organization.'})
        return organization

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        code = f'EXC-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}'
        while ExitClearance.objects.filter(organization=organization, code=code).exists():
            code = f'EXC-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}'
        lease = serializer.validated_data.get('lease')
        serializer.save(
            organization=organization, code=code,
            tenant=serializer.validated_data.get('tenant') or getattr(lease, 'tenant', None),
        )

    def perform_update(self, serializer):
        if 'status' in serializer.validated_data:
            raise ValidationError({'status': 'Use the workflow actions so every status change is controlled.'})
        super().perform_update(serializer)

    def _clearance_ready(self, clearance):
        missing = []
        if not clearance.utilities_cleared:
            missing.append('utilities')
        if not clearance.inspection_passed:
            missing.append('inspection')
        if not clearance.rent_cleared:
            missing.append('rent')
        if not clearance.service_charge_cleared:
            missing.append('service charge')
        return missing

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='mark-cleared')
    def mark_cleared(self, request, pk=None):
        clearance = self.get_object()
        if clearance.status not in (ExitClearance.Status.DRAFT, ExitClearance.Status.IN_PROGRESS):
            raise ValidationError({'status': 'Only open clearances can be marked cleared.'})
        missing = self._clearance_ready(clearance)
        if missing:
            raise ValidationError({'detail': f'Complete these sections before clearing: {", ".join(missing)}.'})
        total_deductions = sum(Decimal(str(d.get('amount', 0))) for d in (clearance.deductions or []) if isinstance(d, dict))
        if clearance.deposit_amount is not None:
            clearance.refund_amount = clearance.deposit_amount - total_deductions
        clearance.status = ExitClearance.Status.CLEARED
        clearance.save(update_fields=('refund_amount', 'status', 'updated_at'))
        return Response(ExitClearanceSerializer(clearance).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='approve-manager')
    def approve_manager(self, request, pk=None):
        clearance = self.get_object()
        if clearance.status != ExitClearance.Status.CLEARED:
            raise ValidationError({'status': 'Mark the clearance complete before manager approval.'})
        clearance.manager_approved_by = request.user
        clearance.manager_approved_at = timezone.now()
        clearance.save(update_fields=('manager_approved_by', 'manager_approved_at', 'updated_at'))
        return Response(ExitClearanceSerializer(clearance).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='approve-finance')
    def approve_finance(self, request, pk=None):
        clearance = self.get_object()
        if not clearance.manager_approved_at:
            raise ValidationError({'status': 'Manager approval is required before finance approval.'})
        clearance.finance_approved_by = request.user
        clearance.finance_approved_at = timezone.now()
        clearance.status = ExitClearance.Status.APPROVED
        clearance.save(update_fields=('finance_approved_by', 'finance_approved_at', 'status', 'updated_at'))
        return Response(ExitClearanceSerializer(clearance).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='reject')
    def reject(self, request, pk=None):
        clearance = self.get_object()
        if clearance.status not in (ExitClearance.Status.IN_PROGRESS, ExitClearance.Status.CLEARED):
            raise ValidationError({'status': 'Only open clearances can be rejected.'})
        reason = str(request.data.get('reason', '')).strip()
        if not reason:
            raise ValidationError({'reason': 'A rejection reason is required.'})
        clearance.status = ExitClearance.Status.REJECTED
        clearance.rejected_reason = reason
        clearance.save(update_fields=('status', 'rejected_reason', 'updated_at'))
        return Response(ExitClearanceSerializer(clearance).data)

    @transaction.atomic
    @action(detail=True, methods=('post',), url_path='issue-gate-pass')
    def issue_gate_pass(self, request, pk=None):
        clearance = self.get_object()
        if clearance.status != ExitClearance.Status.APPROVED:
            raise ValidationError({'status': 'Manager and finance approval are required before the gate pass.'})
        if not clearance.gate_pass_number:
            clearance.gate_pass_number = f'GP-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}'
        clearance.gate_pass_issued_at = timezone.now()
        clearance.status = ExitClearance.Status.GATE_PASS_ISSUED
        clearance.save(update_fields=('gate_pass_number', 'gate_pass_issued_at', 'status', 'updated_at'))
        return Response(ExitClearanceSerializer(clearance).data)
