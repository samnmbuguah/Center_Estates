"""
Financial ViewSets:
  ProvisionalSum, ContingencyDrawdown, AdvancePayment, AdvanceRecovery,
  Requisition, Certificate, Disbursement, DrawdownRequest,
  Chat, Notification, AdminAuditLog.
"""
from decimal import Decimal
from time import time

from django.db import transaction
from django.db.models import Sum
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.tenancy import get_active_organization

from ..models import (
    AdvancePayment, AdvanceRecovery, AdminAuditLog, Certificate, ChatMessage,
    ContingencyDrawdown, Disbursement, DrawdownRequest, Notification,
    ProvisionalSum, Requisition,
)
from ..serializers import (
    AdminAuditLogSerializer, AdvancePaymentSerializer, AdvanceRecoverySerializer,
    CertificateSerializer, ChatMessageSerializer, ContingencyDrawdownSerializer,
    DisbursementSerializer, DrawdownRequestSerializer, NotificationSerializer,
    ProvisionalSumSerializer, RequisitionSerializer,
)
from .base import ConstructionScopedViewSet, scoped_viewset

# ── Simple base ViewSets ──────────────────────────────────────────────────────

ProvisionalSumBaseViewSet = scoped_viewset(
    "ProvisionalSumBaseViewSet", ProvisionalSum, ProvisionalSumSerializer, ("item_number", "description")
)
ContingencyDrawdownBaseViewSet = scoped_viewset(
    "ContingencyDrawdownBaseViewSet", ContingencyDrawdown, ContingencyDrawdownSerializer, ("drawdown_number", "reason")
)
AdvancePaymentBaseViewSet = scoped_viewset(
    "AdvancePaymentBaseViewSet", AdvancePayment, AdvancePaymentSerializer, ("contractor_name", "notes")
)
RequisitionBaseViewSet = scoped_viewset(
    "RequisitionBaseViewSet", Requisition, RequisitionSerializer, ("title", "description")
)
CertificateBaseViewSet = scoped_viewset(
    "CertificateBaseViewSet", Certificate, CertificateSerializer, ("number", "contractor_name")
)
DisbursementBaseViewSet = scoped_viewset("DisbursementBaseViewSet", Disbursement, DisbursementSerializer)
DrawdownRequestBaseViewSet = scoped_viewset(
    "DrawdownRequestBaseViewSet", DrawdownRequest, DrawdownRequestSerializer, ("request_number", "purpose")
)


# ── Full ViewSets with business logic ─────────────────────────────────────────

class ProvisionalSumViewSet(ProvisionalSumBaseViewSet):
    write_permission = 'monitoring.commercial'

    def perform_create(self, serializer):
        now = int(time() * 1000)
        serializer.save(
            organization=self._validate_organization(serializer),
            status="pending", ascertained_amount=0, created_at=now, updated_at=now,
        )

    def perform_update(self, serializer):
        raise ValidationError({"provisional_sum": "Use the controlled ascertain or close action."})

    def perform_destroy(self, instance):
        if instance.status != "pending":
            raise ValidationError({"provisional_sum": "Only pending provisional sums can be deleted."})
        instance.delete()

    @action(detail=True, methods=("post",))
    def ascertain(self, request, pk=None):
        item = self.get_object()
        if item.status != "pending":
            raise ValidationError({"status": "Only pending provisional sums can be ascertained."})
        try:
            amount = Decimal(str(request.data.get("ascertained_amount", "")))
        except Exception:
            raise ValidationError({"ascertained_amount": "Enter a valid amount."})
        if amount < 0:
            raise ValidationError({"ascertained_amount": "The amount cannot be negative."})
        item.ascertained_amount = amount
        item.status = "ascertained"
        item.notes = str(request.data.get("notes", item.notes))
        item.updated_at = int(time() * 1000)
        item.save(update_fields=("ascertained_amount", "status", "notes", "updated_at"))
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=("post",))
    def close(self, request, pk=None):
        item = self.get_object()
        if item.status != "ascertained":
            raise ValidationError({"status": "Ascertain the provisional sum before closing it."})
        item.status = "closed"
        item.updated_at = int(time() * 1000)
        item.save(update_fields=("status", "updated_at"))
        return Response(self.get_serializer(item).data)


class ContingencyDrawdownViewSet(ContingencyDrawdownBaseViewSet):
    write_permission = 'monitoring.commercial'

    def perform_create(self, serializer):
        now = int(time() * 1000)
        serializer.save(
            organization=self._validate_organization(serializer),
            status="requested", created_at=now, updated_at=now,
        )

    def perform_update(self, serializer):
        raise ValidationError({"drawdown": "Use the controlled decision action."})

    def perform_destroy(self, instance):
        raise ValidationError({"drawdown": "Contingency requests cannot be deleted."})

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def decide(self, request, pk=None):
        item = ContingencyDrawdown.objects.select_for_update().select_related("project").filter(
            pk=pk, organization=get_active_organization(request)
        ).first()
        if not item:
            return Response({"detail": "Contingency request not found."}, status=404)
        decision = str(request.data.get("decision", ""))
        reason = str(request.data.get("reason", "")).strip()
        if item.status != "requested" or decision not in ("approved", "rejected"):
            raise ValidationError({"decision": "A requested drawdown may be approved or rejected."})
        if decision == "rejected" and not reason:
            raise ValidationError({"reason": "A rejection reason is required."})
        if decision == "approved":
            allowance = (item.project.budget or Decimal(0)) * Decimal("0.05")
            approved = ContingencyDrawdown.objects.filter(
                project=item.project, status="approved"
            ).aggregate(total=Sum("amount"))["total"] or Decimal(0)
            if item.amount > allowance - approved:
                raise ValidationError({"amount": "The request exceeds the remaining 5% contingency allowance."})
            item.approved_by = request.user
            item.approved_at = int(time() * 1000)
        elif reason:
            item.reason = f"{item.reason}\nRejection: {reason}"
        item.status = decision
        item.updated_at = int(time() * 1000)
        item.save()
        return Response(self.get_serializer(item).data)


class AdvancePaymentViewSet(AdvancePaymentBaseViewSet):
    write_permission = 'monitoring.commercial'

    def perform_create(self, serializer):
        now = int(time() * 1000)
        serializer.save(
            organization=self._validate_organization(serializer),
            status="active", recovered_amount=0, created_at=now, updated_at=now,
        )

    def perform_update(self, serializer):
        raise ValidationError({"advance": "Post an append-only recovery event."})

    def perform_destroy(self, instance):
        raise ValidationError({"advance": "Advance payment history cannot be deleted."})

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def recover(self, request, pk=None):
        advance = AdvancePayment.objects.select_for_update().filter(
            pk=pk, organization=get_active_organization(request)
        ).first()
        if not advance:
            return Response({"detail": "Advance payment not found."}, status=404)
        if advance.status != "active":
            raise ValidationError({"status": "Only active advances accept recoveries."})
        try:
            amount = Decimal(str(request.data.get("amount_recovered", "")))
        except Exception:
            raise ValidationError({"amount_recovered": "Enter a valid recovery amount."})
        outstanding = advance.amount - advance.recovered_amount
        if amount <= 0 or amount > outstanding:
            raise ValidationError({"amount_recovered": "Recovery must be positive and cannot exceed the outstanding balance."})
        now = int(time() * 1000)
        AdvanceRecovery.objects.create(
            advance_payment=advance,
            certificate_number=str(request.data.get("certificate_number", "")),
            amount_recovered=amount,
            created_at=now,
        )
        advance.recovered_amount += amount
        advance.updated_at = now
        if advance.recovered_amount == advance.amount:
            advance.status = "fully_recovered"
        advance.save(update_fields=("recovered_amount", "updated_at", "status"))
        return Response(self.get_serializer(advance).data)


class AdvanceRecoveryViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.finance'
    queryset = AdvanceRecovery.objects.select_related("advance_payment__project")
    serializer_class = AdvanceRecoverySerializer
    organization_field = "advance_payment__organization"
    search_fields = ("advance_payment__contractor_name", "certificate_number")
    http_method_names = ("get", "head", "options")


class RequisitionViewSet(RequisitionBaseViewSet):
    write_permission = 'monitoring.finance'

    def perform_create(self, serializer):
        now = int(time() * 1000)
        serializer.save(
            organization=self._validate_organization(serializer),
            status="submitted", raised_by=self.request.user, created_at=now, updated_at=now,
        )

    def perform_update(self, serializer):
        raise ValidationError({"requisition": "Use the controlled workflow actions."})

    def perform_destroy(self, instance):
        raise ValidationError({"requisition": "Finance requisitions cannot be deleted."})

    @action(detail=True, methods=("post",))
    def review(self, request, pk=None):
        requisition = self.get_object()
        if requisition.status != "submitted":
            raise ValidationError({"status": "Only submitted requisitions can be reviewed."})
        requisition.status = "reviewed"
        requisition.reviewed_by = request.user
        requisition.updated_at = int(time() * 1000)
        requisition.save(update_fields=("status", "reviewed_by", "updated_at"))
        return Response(self.get_serializer(requisition).data)

    @action(detail=True, methods=("post",))
    def decide(self, request, pk=None):
        requisition = self.get_object()
        decision = str(request.data.get("decision", ""))
        if requisition.status != "reviewed" or decision not in ("approved", "rejected"):
            raise ValidationError({"decision": "A reviewed requisition may be approved or rejected."})
        requisition.status = decision
        requisition.approved_by = request.user
        requisition.updated_at = int(time() * 1000)
        requisition.save(update_fields=("status", "approved_by", "updated_at"))
        return Response(self.get_serializer(requisition).data)


class CertificateViewSet(CertificateBaseViewSet):
    write_permission = 'monitoring.finance'
    """Financial certificates are permanent audit records; they may only be voided."""

    def perform_update(self, serializer):
        current = self.get_object()
        requested_status = serializer.validated_data.get("status", current.status)
        if current.status == "void":
            raise ValidationError({"status": "A void certificate is immutable."})
        if requested_status != "void":
            raise ValidationError({"status": "Issued certificates may only be voided."})
        if not serializer.validated_data.get("void_reason", current.void_reason):
            raise ValidationError({"void_reason": "A reason is required to void a certificate."})
        serializer.save(voided_by=self.request.user, voided_at=int(time() * 1000))

    def perform_destroy(self, instance):
        raise ValidationError({"certificate": "Certificates cannot be deleted; void the record instead."})


class DisbursementViewSet(DisbursementBaseViewSet):
    write_permission = 'monitoring.finance'

    def perform_create(self, serializer):
        certificate = serializer.validated_data.get("certificate")
        organization = self._validate_organization(serializer)
        if certificate and (certificate.organization_id != organization.id or certificate.status == "void"):
            raise ValidationError({"certificate": "Select a current certificate from this organization."})
        serializer.save(
            organization=organization, status="pending",
            managed_by=self.request.user, created_at=int(time() * 1000),
        )

    def perform_update(self, serializer):
        raise ValidationError({"disbursement": "Use the pay or void action."})

    def perform_destroy(self, instance):
        raise ValidationError({"disbursement": "Disbursements cannot be deleted; void the record instead."})

    @action(detail=True, methods=("post",))
    def pay(self, request, pk=None):
        disbursement = self.get_object()
        if disbursement.status != "pending":
            raise ValidationError({"status": "Only pending disbursements can be paid."})
        disbursement.status = "paid"
        disbursement.paid_at = int(time() * 1000)
        disbursement.save(update_fields=("status", "paid_at"))
        return Response(self.get_serializer(disbursement).data)

    @action(detail=True, methods=("post",))
    def void(self, request, pk=None):
        disbursement = self.get_object()
        reason = str(request.data.get("reason", "")).strip()
        if disbursement.status == "void" or not reason:
            raise ValidationError({"reason": "A non-void disbursement requires a void reason."})
        disbursement.status = "void"
        disbursement.void_reason = reason
        disbursement.voided_by = request.user
        disbursement.voided_at = int(time() * 1000)
        disbursement.save(update_fields=("status", "void_reason", "voided_by", "voided_at"))
        return Response(self.get_serializer(disbursement).data)


class DrawdownRequestViewSet(DrawdownRequestBaseViewSet):
    write_permission = 'monitoring.finance'

    def perform_create(self, serializer):
        now = int(time() * 1000)
        serializer.save(
            organization=self._validate_organization(serializer),
            status="submitted", requested_by=self.request.user, created_at=now, updated_at=now,
        )

    def perform_update(self, serializer):
        raise ValidationError({"drawdown": "Use the controlled workflow action."})

    def perform_destroy(self, instance):
        raise ValidationError({"drawdown": "Drawdown requests cannot be deleted."})

    @action(detail=True, methods=("post",))
    def transition(self, request, pk=None):
        drawdown = self.get_object()
        action_name = str(request.data.get("action", ""))
        transitions = {
            "submitted": {"review_documents": "document_review", "reject": "rejected"},
            "document_review": {"review_valuation": "valuation_review", "reject": "rejected"},
            "valuation_review": {"approve": "approved", "reject": "rejected"},
            "approved": {"disburse": "disbursed"},
        }
        target = transitions.get(drawdown.status, {}).get(action_name)
        if not target:
            raise ValidationError({"action": f"Action {action_name or '(missing)'} is not valid from {drawdown.status}."})
        notes = str(request.data.get("notes", "")).strip()
        if target == "rejected" and not notes:
            raise ValidationError({"notes": "A rejection reason is required."})
        now = int(time() * 1000)
        drawdown.status = target
        drawdown.reviewed_by = request.user
        drawdown.updated_at = now
        if notes:
            drawdown.reviewer_notes = notes
        if "valuation_amount" in request.data:
            drawdown.valuation_amount = request.data["valuation_amount"] or None
        if target == "approved":
            drawdown.approved_at = now
        if target == "disbursed":
            drawdown.disbursed_at = now
        drawdown.save()
        return Response(self.get_serializer(drawdown).data)


class ChatMessageViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.site'
    queryset = ChatMessage.objects.select_related("sender", "recipient", "project")
    serializer_class = ChatMessageSerializer
    search_fields = ("body", "channel", "attachment_name")

    def get_queryset(self):
        from django.db.models import Q
        return super().get_queryset().filter(Q(sender=self.request.user) | Q(recipient=self.request.user))

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        project = serializer.validated_data.get("project")
        if project and project.organization_id != organization.id:
            raise ValidationError({"project": "The project belongs to another organization."})
        serializer.save(organization=organization, sender=self.request.user, created_at=int(time() * 1000))

    def perform_update(self, serializer):
        raise ValidationError({"message": "Messages are immutable; use the read action."})

    def perform_destroy(self, instance):
        if instance.sender_id != self.request.user.id:
            raise ValidationError({"message": "Only the sender can delete an unread message."})
        if instance.read_at is not None:
            raise ValidationError({"message": "Read messages are retained in the conversation history."})
        instance.delete()

    @action(detail=True, methods=("post",), url_path="mark-read")
    def mark_read(self, request, pk=None):
        message = self.get_object()
        if message.recipient_id != request.user.id:
            raise ValidationError({"message": "Only the recipient can mark this message read."})
        if message.read_at is None:
            message.read_at = int(time() * 1000)
            message.save(update_fields=("read_at",))
        return Response(self.get_serializer(message).data)

    @action(detail=False, methods=("get",), url_path="unread-count")
    def unread_count(self, request):
        return Response({"count": self.get_queryset().filter(recipient=request.user, read_at__isnull=True).count()})


class NotificationViewSet(ConstructionScopedViewSet):
    queryset = Notification.objects.select_related("recipient")
    serializer_class = NotificationSerializer
    http_method_names = ("get", "post", "patch", "head", "options")

    def get_queryset(self):
        return super().get_queryset().filter(recipient=self.request.user)

    def perform_update(self, serializer):
        allowed = set(serializer.validated_data) <= {"read_at"}
        if not allowed:
            raise ValidationError({"notification": "Only read status may be changed."})
        serializer.save(read_at=int(time() * 1000))

    @action(detail=True, methods=("post",), url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if notification.read_at is None:
            notification.read_at = int(time() * 1000)
            notification.save(update_fields=("read_at",))
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=("post",), url_path="read-all")
    def read_all(self, request):
        read_at = int(time() * 1000)
        count = self.get_queryset().filter(read_at__isnull=True).update(read_at=read_at)
        return Response({"updated": count, "read_at": read_at})

    @action(detail=False, methods=("get",), url_path="unread-count")
    def unread_count(self, request):
        return Response({"count": self.get_queryset().filter(read_at__isnull=True).count()})


class AdminAuditLogViewSet(ConstructionScopedViewSet):
    queryset = AdminAuditLog.objects.select_related("user")
    serializer_class = AdminAuditLogSerializer
    search_fields = ("action", "category", "resource", "resource_id")
    http_method_names = ("get", "head", "options")
