from decimal import Decimal
from django.db import transaction
from django.db.models import Count, Sum
from time import time
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet

from core.models import Module
from core.permissions import HasModuleActionPermission
from core.tenancy import get_active_organization
from organizations.models import Membership

from .models import (
    AdminAuditLog, AdvancePayment, AdvanceRecovery, BimDiscrepancy, BimModel, BoQItem, CalendarEvent, ChatMessage,
    Certificate, ConsultantPayment, ContingencyDrawdown, DailyLog, DocumentVersion,
    Device, Disbursement, DrawdownRequest, DroneDataset, EvidenceFile, LifecycleRecord,
    MaterialDelivery, MaterialRequisition, MaterialRequisitionLine, MilestoneEntry, MilestoneVerification, Notification, Project, ProjectApproval, ProjectDocument, ProjectMembership,
    PurchaseOrder, PurchaseOrderLine,
    ProvisionalSum, QualityTest, RequirementWaiver, Requisition, Rfi, Risk, SafetyIncident,
    SatelliteDataset, StockMovement, StoreItem, StoreSupplier, Subcontractor, Ticket, TicketComment, Variation, WorkOrder, WorkPlanTask,
)
from .serializers import (
    AdminAuditLogSerializer, AdvancePaymentSerializer, AdvanceRecoverySerializer, BimDiscrepancySerializer, BimModelSerializer,
    BoQItemSerializer, CalendarEventSerializer, CertificateSerializer,
    ConsultantPaymentSerializer, ContingencyDrawdownSerializer,
    ChatMessageSerializer, DailyLogSerializer, DisbursementSerializer, DocumentVersionSerializer, DrawdownRequestSerializer,
    DroneDatasetSerializer, EvidenceSerializer, LifecycleSerializer,
    MaterialDeliverySerializer, MaterialRequisitionSerializer, MilestoneSerializer, MilestoneVerificationSerializer, NotificationSerializer, ProjectApprovalSerializer,
    ProjectDocumentSerializer, ProjectMembershipSerializer, ProjectSerializer, ProvisionalSumSerializer,
    QualityTestSerializer, RequirementWaiverSerializer, RequisitionSerializer, RfiSerializer, RiskSerializer,
    PurchaseOrderSerializer, SafetyIncidentSerializer, SatelliteDatasetSerializer, StockMovementSerializer,
    StoreItemSerializer, StoreSupplierSerializer, SubcontractorSerializer, TicketCommentSerializer, TicketSerializer, VariationSerializer,
    WorkOrderSerializer, WorkPlanTaskSerializer,
)


class ConstructionScopedViewSet(ModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.MONITORING
    organization_field = "organization"
    search_fields = ()

    def get_queryset(self):
        organization = get_active_organization(self.request)
        queryset = self.queryset.filter(**{self.organization_field: organization})
        search = self.request.query_params.get("search", "").strip()
        if search and self.search_fields:
            from django.db.models import Q
            query = Q()
            for field in self.search_fields:
                query |= Q(**{f"{field}__icontains": search})
            queryset = queryset.filter(query)
        project_id = self.request.query_params.get("project")
        if project_id and any(field.name == "project" for field in queryset.model._meta.fields):
            queryset = queryset.filter(project_id=project_id)
        return queryset

    def _validate_organization(self, serializer):
        organization = get_active_organization(self.request)
        for name, value in serializer.validated_data.items():
            related_organization = getattr(value, "organization_id", organization.id)
            if related_organization != organization.id:
                raise ValidationError({name: "The selected record belongs to another organization."})
        return organization

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer))

    def perform_update(self, serializer):
        self._validate_organization(serializer)
        serializer.save()


class MobileCaptureMixin:
    """Protect mobile-authoritative evidence from desktop/API impersonation."""

    def _require_mobile(self):
        token = getattr(self.request, "auth", None)
        try:
            is_mobile = token.get("client_kind") == "mobile"
        except AttributeError:
            is_mobile = False
        if not is_mobile:
            raise ValidationError({"client_kind": "This record is writable only by an enrolled mobile client."})

    def perform_create(self, serializer):
        self._require_mobile()
        super().perform_create(serializer)

    def perform_update(self, serializer):
        self._require_mobile()
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        self._require_mobile()
        super().perform_destroy(instance)


class ImmutableSubmittedMixin:
    """Submitted field records are append-only audit evidence."""

    def perform_update(self, serializer):
        if self.get_object().submitted_at is not None:
            raise ValidationError({"submitted_at": "Submitted records are immutable."})
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        if instance.submitted_at is not None:
            raise ValidationError({"submitted_at": "Submitted records cannot be deleted."})
        super().perform_destroy(instance)


class ProjectViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.project_admin'
    queryset = Project.objects.select_related("portfolio_project")
    serializer_class = ProjectSerializer
    search_fields = ("name", "code", "client_name", "location")

    def perform_create(self, serializer):
        serializer.save(
            organization=self._validate_organization(serializer),
            created_at=int(time() * 1000),
        )


def scoped_viewset(name, model, serializer, search_fields=()):
    return type(name, (ConstructionScopedViewSet,), {
        "queryset": model.objects.select_related("project") if any(
            field.name == "project" for field in model._meta.fields
        ) else model.objects.all(),
        "serializer_class": serializer,
        "search_fields": search_fields,
    })


MilestoneBaseViewSet = scoped_viewset("MilestoneBaseViewSet", MilestoneEntry, MilestoneSerializer, ("milestone_id",))
EvidenceBaseViewSet = scoped_viewset("EvidenceBaseViewSet", EvidenceFile, EvidenceSerializer, ("remote_url", "hash"))


class MilestoneViewSet(MobileCaptureMixin, ImmutableSubmittedMixin, MilestoneBaseViewSet):
    write_permission = 'monitoring.site'


class MilestoneVerificationViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.certify'
    queryset = MilestoneVerification.objects.select_related("milestone_entry", "verifier")
    serializer_class = MilestoneVerificationSerializer
    organization_field = "milestone_entry__organization"
    search_fields = ("milestone_entry__milestone_id", "decision", "note", "verifier__username")

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        entry = MilestoneEntry.objects.select_for_update().filter(
            pk=serializer.validated_data["milestone_entry"].pk, organization=organization,
        ).first()
        if not entry or entry.submitted_at is None or not hasattr(entry, "seal"):
            raise ValidationError({"milestone_entry": "Only a sealed submitted milestone can be verified."})
        if hasattr(entry, "verification"):
            raise ValidationError({"milestone_entry": "This milestone already has a verification decision."})
        if entry.signing_device_id and Device.objects.filter(
            pk=entry.signing_device_id, organization=organization, user=self.request.user,
        ).exists():
            raise ValidationError({"verifier": "The submitting device owner cannot verify the same milestone."})
        note = serializer.validated_data.get("note", "").strip()
        if serializer.validated_data["decision"] != "verified" and not note:
            raise ValidationError({"note": "A reason is required for rejection or clarification."})
        serializer.save(verifier=self.request.user, verified_at=int(time() * 1000))

    def perform_update(self, serializer):
        raise ValidationError({"verification": "Verification decisions are immutable."})

    def perform_destroy(self, instance):
        raise ValidationError({"verification": "Verification decisions cannot be deleted."})


class EvidenceViewSet(MobileCaptureMixin, ImmutableSubmittedMixin, EvidenceBaseViewSet):
    write_permission = 'monitoring.site'
    pass
DailyLogViewSet = scoped_viewset("DailyLogViewSet", DailyLog, DailyLogSerializer, ("notes", "weather"))
RiskViewSet = scoped_viewset("RiskViewSet", Risk, RiskSerializer, ("reference", "description"))
TicketViewSet = scoped_viewset("TicketViewSet", Ticket, TicketSerializer, ("title", "body"))
DailyLogViewSet.write_permission = 'monitoring.site'
RiskViewSet.write_permission = 'monitoring.site'
TicketViewSet.write_permission = 'monitoring.site'


class TicketCommentViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.site'
    queryset = TicketComment.objects.select_related("ticket", "author")
    serializer_class = TicketCommentSerializer
    organization_field = "ticket__organization"
    search_fields = ("ticket__title", "body", "author__username")

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        ticket = serializer.validated_data["ticket"]
        if ticket.organization_id != organization.id:
            raise ValidationError({"ticket": "The ticket belongs to another organization."})
        serializer.save(author=self.request.user, created_at=int(time() * 1000))

    def perform_update(self, serializer):
        raise ValidationError({"comment": "Issue comments are immutable."})

    def perform_destroy(self, instance):
        if instance.author_id != self.request.user.id:
            raise ValidationError({"comment": "Only the author can delete this comment."})
        instance.delete()
WorkPlanTaskViewSet = scoped_viewset("WorkPlanTaskViewSet", WorkPlanTask, WorkPlanTaskSerializer, ("task_name", "task_id"))
BoQItemViewSet = scoped_viewset("BoQItemViewSet", BoQItem, BoQItemSerializer, ("description", "item_number"))
VariationBaseViewSet = scoped_viewset("VariationBaseViewSet", Variation, VariationSerializer, ("description", "variation_number"))
WorkPlanTaskViewSet.write_permission = 'monitoring.site'
BoQItemViewSet.write_permission = 'monitoring.commercial'


class VariationViewSet(VariationBaseViewSet):
    write_permission = 'monitoring.commercial'
    def get_action_permission(self, request, action):
        if action == "transition" and str(request.data.get("status", "")) in {"approved", "rejected"}:
            return "monitoring.approve"
        if action == "transition":
            return "monitoring.commercial"
        return self.permission_map.get(action) if hasattr(self, "permission_map") else None

    def perform_create(self, serializer):
        now = int(time() * 1000)
        serializer.save(organization=self._validate_organization(serializer), status="draft", created_at=now, updated_at=now)

    def perform_update(self, serializer):
        if "status" in serializer.validated_data:
            raise ValidationError({"status": "Use the controlled transition action."})
        if self.get_object().status != "draft":
            raise ValidationError({"variation": "Only draft variations can be edited."})
        serializer.save(updated_at=int(time() * 1000))

    def perform_destroy(self, instance):
        if instance.status != "draft":
            raise ValidationError({"variation": "Only draft variations can be deleted."})
        instance.delete()

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def transition(self, request, pk=None):
        variation = Variation.objects.select_for_update().select_related("project").filter(
            pk=pk, organization=get_active_organization(request),
        ).first()
        if not variation:
            return Response({"detail": "Variation not found."}, status=404)
        target = str(request.data.get("status", ""))
        allowed = {"draft": {"submitted"}, "submitted": {"approved", "rejected"}}
        if target not in allowed.get(variation.status, set()):
            raise ValidationError({"status": f"Cannot move a {variation.status} variation to {target}."})
        if target == "rejected" and not str(request.data.get("reason", "")).strip():
            raise ValidationError({"reason": "A rejection reason is required."})
        now = int(time() * 1000)
        variation.status = target
        variation.updated_at = now
        if target == "approved":
            variation.approved_by = request.user
            variation.approved_at = now
        if target == "rejected":
            variation.justification = str(request.data["reason"]).strip()
        variation.save()
        approved = Variation.objects.filter(project=variation.project, status="approved")
        additions = approved.exclude(variation_type="omission").aggregate(total=Sum("amount"))["total"] or Decimal(0)
        omissions = approved.filter(variation_type="omission").aggregate(total=Sum("amount"))["total"] or Decimal(0)
        variation.project.approved_variations = additions - omissions
        variation.project.save(update_fields=("approved_variations",))
        return Response(self.get_serializer(variation).data)
QualityTestViewSet = scoped_viewset("QualityTestViewSet", QualityTest, QualityTestSerializer, ("test_type", "result"))
RfiViewSet = scoped_viewset("RfiViewSet", Rfi, RfiSerializer, ("title", "question", "number"))
SafetyIncidentViewSet = scoped_viewset("SafetyIncidentViewSet", SafetyIncident, SafetyIncidentSerializer, ("description", "action_taken"))
CalendarEventViewSet = scoped_viewset("CalendarEventViewSet", CalendarEvent, CalendarEventSerializer, ("title", "description"))
ProjectDocumentViewSet = scoped_viewset("ProjectDocumentViewSet", ProjectDocument, ProjectDocumentSerializer, ("title", "discipline"))
QualityTestViewSet.write_permission = 'monitoring.site'
RfiViewSet.write_permission = 'monitoring.site'
SafetyIncidentViewSet.write_permission = 'monitoring.site'
CalendarEventViewSet.write_permission = 'monitoring.site'
ProjectDocumentViewSet.write_permission = 'monitoring.site'


class DocumentVersionViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.site'
    queryset = DocumentVersion.objects.select_related("document__project", "uploaded_by")
    serializer_class = DocumentVersionSerializer
    organization_field = "document__organization"
    search_fields = ("document__title", "revision_number", "file_format")

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        document = serializer.validated_data["document"]
        if document.organization_id != organization.id:
            raise ValidationError({"document": "The document belongs to another organization."})
        serializer.save(uploaded_by=self.request.user, uploaded_at=int(time() * 1000))

    def perform_update(self, serializer):
        raise ValidationError({"version": "Controlled document versions are immutable."})

    def perform_destroy(self, instance):
        raise ValidationError({"version": "Controlled document versions cannot be deleted."})
ProjectApprovalBaseViewSet = scoped_viewset("ProjectApprovalBaseViewSet", ProjectApproval, ProjectApprovalSerializer, ("approval_type", "authority", "reference", "review_notes"))


class ProjectApprovalViewSet(ProjectApprovalBaseViewSet):
    write_permission = 'monitoring.project_admin'
    def perform_create(self, serializer):
        if serializer.validated_data.get("status", "pending") != "pending":
            raise ValidationError({"status": "New approvals must enter the pending review queue."})
        super().perform_create(serializer)

    def perform_update(self, serializer):
        if "status" in serializer.validated_data:
            raise ValidationError({"status": "Use the controlled approve or reject action."})
        if self.get_object().status != "pending":
            raise ValidationError({"approval": "Completed approval decisions are immutable."})
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        raise ValidationError({"approval": "Approval records cannot be deleted."})

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        approval = self.get_object()
        if approval.status != "pending":
            raise ValidationError({"status": "Only pending approvals can be approved."})
        approval.status = "approved"
        approval.issued_at = int(time() * 1000)
        approval.review_notes = str(request.data.get("review_notes", "")).strip()
        approval.save(update_fields=("status", "issued_at", "review_notes"))
        return Response(self.get_serializer(approval).data)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        approval = self.get_object()
        reason = str(request.data.get("review_notes", "")).strip()
        if approval.status != "pending":
            raise ValidationError({"status": "Only pending approvals can be rejected."})
        if not reason:
            raise ValidationError({"review_notes": "A rejection reason is required."})
        approval.status = "rejected"
        approval.review_notes = reason
        approval.issued_at = int(time() * 1000)
        approval.save(update_fields=("status", "review_notes", "issued_at"))
        return Response(self.get_serializer(approval).data)


class RequirementWaiverViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.project_admin'
    queryset = RequirementWaiver.objects.select_related("project", "waived_by")
    serializer_class = RequirementWaiverSerializer
    organization_field = "project__organization"
    search_fields = ("project__name", "requirement_key", "requirement_type", "reason", "waived_by__username")

    def perform_create(self, serializer):
        self._validate_organization(serializer)
        serializer.save(waived_by=self.request.user, waived_at=int(time() * 1000))

    def perform_update(self, serializer):
        raise ValidationError({"waiver": "Requirement waivers are immutable audit records."})

    def perform_destroy(self, instance):
        raise ValidationError({"waiver": "Requirement waivers cannot be deleted."})


class ProjectMembershipViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.project_admin'
    queryset = ProjectMembership.objects.select_related("project", "user", "role")
    serializer_class = ProjectMembershipSerializer
    organization_field = "project__organization"
    search_fields = ("project__name", "user__username", "role__name", "label")

    def _validate_member(self, serializer):
        organization = self._validate_organization(serializer)
        user = serializer.validated_data.get("user", getattr(self.get_object() if self.kwargs.get("pk") else None, "user", None))
        role = serializer.validated_data.get("role", getattr(self.get_object() if self.kwargs.get("pk") else None, "role", None))
        if not Membership.objects.active().filter(organization=organization, user=user).exists():
            raise ValidationError({"user": "The user must be an active organization member."})
        if role and role.organization_id != organization.id:
            raise ValidationError({"role": "The role belongs to another organization."})

    def perform_create(self, serializer):
        self._validate_member(serializer)
        serializer.save(created_at=int(time() * 1000))

    def perform_update(self, serializer):
        self._validate_member(serializer)
        serializer.save()
LifecycleViewSet = scoped_viewset("LifecycleViewSet", LifecycleRecord, LifecycleSerializer, ("title", "reference", "record_type"))
MaterialDeliveryViewSet = scoped_viewset("MaterialDeliveryViewSet", MaterialDelivery, MaterialDeliverySerializer, ("material", "supplier"))
ConsultantPaymentViewSet = scoped_viewset("ConsultantPaymentViewSet", ConsultantPayment, ConsultantPaymentSerializer, ("consultant_name", "certificate_number"))
DroneDatasetViewSet = scoped_viewset("DroneDatasetViewSet", DroneDataset, DroneDatasetSerializer, ("data_type", "operator_id", "milestone_id"))
SatelliteDatasetViewSet = scoped_viewset("SatelliteDatasetViewSet", SatelliteDataset, SatelliteDatasetSerializer, ("sat_type", "source_provider", "milestone_id"))
ProvisionalSumBaseViewSet = scoped_viewset("ProvisionalSumBaseViewSet", ProvisionalSum, ProvisionalSumSerializer, ("item_number", "description"))
LifecycleViewSet.write_permission = 'monitoring.project_admin'
MaterialDeliveryViewSet.write_permission = 'monitoring.procurement'
ConsultantPaymentViewSet.write_permission = 'monitoring.commercial'
DroneDatasetViewSet.write_permission = 'monitoring.site'
SatelliteDatasetViewSet.write_permission = 'monitoring.site'


class ProvisionalSumViewSet(ProvisionalSumBaseViewSet):
    write_permission = 'monitoring.commercial'
    def perform_create(self, serializer):
        now = int(time() * 1000)
        serializer.save(organization=self._validate_organization(serializer), status="pending", ascertained_amount=0, created_at=now, updated_at=now)

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
        try: amount = Decimal(str(request.data.get("ascertained_amount", "")))
        except Exception: raise ValidationError({"ascertained_amount": "Enter a valid amount."})
        if amount < 0: raise ValidationError({"ascertained_amount": "The amount cannot be negative."})
        item.ascertained_amount = amount; item.status = "ascertained"; item.notes = str(request.data.get("notes", item.notes)); item.updated_at = int(time() * 1000)
        item.save(update_fields=("ascertained_amount", "status", "notes", "updated_at"))
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=("post",))
    def close(self, request, pk=None):
        item = self.get_object()
        if item.status != "ascertained": raise ValidationError({"status": "Ascertain the provisional sum before closing it."})
        item.status = "closed"; item.updated_at = int(time() * 1000); item.save(update_fields=("status", "updated_at"))
        return Response(self.get_serializer(item).data)


ContingencyDrawdownBaseViewSet = scoped_viewset("ContingencyDrawdownBaseViewSet", ContingencyDrawdown, ContingencyDrawdownSerializer, ("drawdown_number", "reason"))


class ContingencyDrawdownViewSet(ContingencyDrawdownBaseViewSet):
    write_permission = 'monitoring.commercial'
    def perform_create(self, serializer):
        now = int(time() * 1000)
        serializer.save(organization=self._validate_organization(serializer), status="requested", created_at=now, updated_at=now)

    def perform_update(self, serializer): raise ValidationError({"drawdown": "Use the controlled decision action."})
    def perform_destroy(self, instance): raise ValidationError({"drawdown": "Contingency requests cannot be deleted."})

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def decide(self, request, pk=None):
        item = ContingencyDrawdown.objects.select_for_update().select_related("project").filter(pk=pk, organization=get_active_organization(request)).first()
        if not item: return Response({"detail": "Contingency request not found."}, status=404)
        decision = str(request.data.get("decision", "")); reason = str(request.data.get("reason", "")).strip()
        if item.status != "requested" or decision not in ("approved", "rejected"):
            raise ValidationError({"decision": "A requested drawdown may be approved or rejected."})
        if decision == "rejected" and not reason: raise ValidationError({"reason": "A rejection reason is required."})
        if decision == "approved":
            allowance = (item.project.budget or Decimal(0)) * Decimal("0.05")
            approved = ContingencyDrawdown.objects.filter(project=item.project, status="approved").aggregate(total=Sum("amount"))["total"] or Decimal(0)
            if item.amount > allowance - approved:
                raise ValidationError({"amount": "The request exceeds the remaining 5% contingency allowance."})
            item.approved_by = request.user; item.approved_at = int(time() * 1000)
        elif reason: item.reason = f"{item.reason}\nRejection: {reason}"
        item.status = decision; item.updated_at = int(time() * 1000); item.save()
        return Response(self.get_serializer(item).data)


AdvancePaymentBaseViewSet = scoped_viewset("AdvancePaymentBaseViewSet", AdvancePayment, AdvancePaymentSerializer, ("contractor_name", "notes"))


class AdvancePaymentViewSet(AdvancePaymentBaseViewSet):
    write_permission = 'monitoring.commercial'
    def perform_create(self, serializer):
        now = int(time() * 1000)
        serializer.save(organization=self._validate_organization(serializer), status="active", recovered_amount=0, created_at=now, updated_at=now)

    def perform_update(self, serializer): raise ValidationError({"advance": "Post an append-only recovery event."})
    def perform_destroy(self, instance): raise ValidationError({"advance": "Advance payment history cannot be deleted."})

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def recover(self, request, pk=None):
        advance = AdvancePayment.objects.select_for_update().filter(pk=pk, organization=get_active_organization(request)).first()
        if not advance: return Response({"detail": "Advance payment not found."}, status=404)
        if advance.status != "active": raise ValidationError({"status": "Only active advances accept recoveries."})
        try: amount = Decimal(str(request.data.get("amount_recovered", "")))
        except Exception: raise ValidationError({"amount_recovered": "Enter a valid recovery amount."})
        outstanding = advance.amount - advance.recovered_amount
        if amount <= 0 or amount > outstanding: raise ValidationError({"amount_recovered": "Recovery must be positive and cannot exceed the outstanding balance."})
        now = int(time() * 1000)
        AdvanceRecovery.objects.create(advance_payment=advance, certificate_number=str(request.data.get("certificate_number", "")), amount_recovered=amount, created_at=now)
        advance.recovered_amount += amount; advance.updated_at = now
        if advance.recovered_amount == advance.amount: advance.status = "fully_recovered"
        advance.save(update_fields=("recovered_amount", "updated_at", "status"))
        return Response(self.get_serializer(advance).data)


class AdvanceRecoveryViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.finance'
    queryset = AdvanceRecovery.objects.select_related("advance_payment__project")
    serializer_class = AdvanceRecoverySerializer
    organization_field = "advance_payment__organization"
    search_fields = ("advance_payment__contractor_name", "certificate_number")
    http_method_names = ("get", "head", "options")
SubcontractorViewSet = scoped_viewset("SubcontractorViewSet", Subcontractor, SubcontractorSerializer, ("name", "contact_person", "email"))
WorkOrderViewSet = scoped_viewset("ConstructionWorkOrderViewSet", WorkOrder, WorkOrderSerializer, ("order_number", "description", "boq_section"))
BimModelViewSet = scoped_viewset("BimModelViewSet", BimModel, BimModelSerializer, ("name", "discipline", "version"))
BimDiscrepancyViewSet = scoped_viewset("BimDiscrepancyViewSet", BimDiscrepancy, BimDiscrepancySerializer, ("milestone_ref", "description"))
RequisitionBaseViewSet = scoped_viewset("RequisitionBaseViewSet", Requisition, RequisitionSerializer, ("title", "description"))
SubcontractorViewSet.write_permission = 'monitoring.procurement'
WorkOrderViewSet.write_permission = 'monitoring.procurement'
BimModelViewSet.write_permission = 'monitoring.site'
BimDiscrepancyViewSet.write_permission = 'monitoring.site'


class RequisitionViewSet(RequisitionBaseViewSet):
    write_permission = 'monitoring.finance'
    def perform_create(self, serializer):
        now = int(time() * 1000)
        serializer.save(organization=self._validate_organization(serializer), status="submitted", raised_by=self.request.user, created_at=now, updated_at=now)

    def perform_update(self, serializer):
        raise ValidationError({"requisition": "Use the controlled workflow actions."})

    def perform_destroy(self, instance):
        raise ValidationError({"requisition": "Finance requisitions cannot be deleted."})

    @action(detail=True, methods=("post",))
    def review(self, request, pk=None):
        requisition = self.get_object()
        if requisition.status != "submitted":
            raise ValidationError({"status": "Only submitted requisitions can be reviewed."})
        requisition.status = "reviewed"; requisition.reviewed_by = request.user; requisition.updated_at = int(time() * 1000)
        requisition.save(update_fields=("status", "reviewed_by", "updated_at"))
        return Response(self.get_serializer(requisition).data)

    @action(detail=True, methods=("post",))
    def decide(self, request, pk=None):
        requisition = self.get_object(); decision = str(request.data.get("decision", ""))
        if requisition.status != "reviewed" or decision not in ("approved", "rejected"):
            raise ValidationError({"decision": "A reviewed requisition may be approved or rejected."})
        requisition.status = decision; requisition.approved_by = request.user; requisition.updated_at = int(time() * 1000)
        requisition.save(update_fields=("status", "approved_by", "updated_at"))
        return Response(self.get_serializer(requisition).data)
CertificateBaseViewSet = scoped_viewset("CertificateBaseViewSet", Certificate, CertificateSerializer, ("number", "contractor_name"))


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
DisbursementBaseViewSet = scoped_viewset("DisbursementBaseViewSet", Disbursement, DisbursementSerializer)


class DisbursementViewSet(DisbursementBaseViewSet):
    write_permission = 'monitoring.finance'
    def perform_create(self, serializer):
        certificate = serializer.validated_data.get("certificate")
        organization = self._validate_organization(serializer)
        if certificate and (certificate.organization_id != organization.id or certificate.status == "void"):
            raise ValidationError({"certificate": "Select a current certificate from this organization."})
        serializer.save(organization=organization, status="pending", managed_by=self.request.user, created_at=int(time() * 1000))

    def perform_update(self, serializer):
        raise ValidationError({"disbursement": "Use the pay or void action."})

    def perform_destroy(self, instance):
        raise ValidationError({"disbursement": "Disbursements cannot be deleted; void the record instead."})

    @action(detail=True, methods=("post",))
    def pay(self, request, pk=None):
        disbursement = self.get_object()
        if disbursement.status != "pending":
            raise ValidationError({"status": "Only pending disbursements can be paid."})
        disbursement.status = "paid"; disbursement.paid_at = int(time() * 1000)
        disbursement.save(update_fields=("status", "paid_at"))
        return Response(self.get_serializer(disbursement).data)

    @action(detail=True, methods=("post",))
    def void(self, request, pk=None):
        disbursement = self.get_object(); reason = str(request.data.get("reason", "")).strip()
        if disbursement.status == "void" or not reason:
            raise ValidationError({"reason": "A non-void disbursement requires a void reason."})
        disbursement.status = "void"; disbursement.void_reason = reason; disbursement.voided_by = request.user; disbursement.voided_at = int(time() * 1000)
        disbursement.save(update_fields=("status", "void_reason", "voided_by", "voided_at"))
        return Response(self.get_serializer(disbursement).data)


DrawdownRequestBaseViewSet = scoped_viewset("DrawdownRequestBaseViewSet", DrawdownRequest, DrawdownRequestSerializer, ("request_number", "purpose"))


class DrawdownRequestViewSet(DrawdownRequestBaseViewSet):
    write_permission = 'monitoring.finance'
    def perform_create(self, serializer):
        now = int(time() * 1000)
        serializer.save(organization=self._validate_organization(serializer), status="submitted", requested_by=self.request.user, created_at=now, updated_at=now)

    def perform_update(self, serializer):
        raise ValidationError({"drawdown": "Use the controlled workflow action."})

    def perform_destroy(self, instance):
        raise ValidationError({"drawdown": "Drawdown requests cannot be deleted."})

    @action(detail=True, methods=("post",))
    def transition(self, request, pk=None):
        drawdown = self.get_object(); action_name = str(request.data.get("action", ""))
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
        now = int(time() * 1000); drawdown.status = target; drawdown.reviewed_by = request.user; drawdown.updated_at = now
        if notes: drawdown.reviewer_notes = notes
        if "valuation_amount" in request.data: drawdown.valuation_amount = request.data["valuation_amount"] or None
        if target == "approved": drawdown.approved_at = now
        if target == "disbursed": drawdown.disbursed_at = now
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
            message.read_at = int(time() * 1000); message.save(update_fields=("read_at",))
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


class StoreItemViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.procurement'
    queryset = StoreItem.objects.all()
    serializer_class = StoreItemSerializer
    search_fields = ("code", "name", "category")

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), quantity_on_hand=0, created_at=int(time() * 1000))

    def perform_update(self, serializer):
        if "quantity_on_hand" in serializer.validated_data:
            raise ValidationError({"quantity_on_hand": "Stock changes must be posted through the movement controls."})
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        if instance.movements.exists():
            raise ValidationError({"item": "Items with stock history cannot be deleted."})
        instance.delete()

    def _movement(self, request, item, movement_type, signed_quantity, reference, project=None):
        organization = get_active_organization(request)
        locked = StoreItem.objects.select_for_update().get(pk=item.pk, organization=organization)
        new_balance = locked.quantity_on_hand + signed_quantity
        if new_balance < 0:
            raise ValidationError({"quantity": "The issue exceeds available stock."})
        locked.quantity_on_hand = new_balance
        locked.save(update_fields=("quantity_on_hand",))
        StockMovement.objects.create(organization=organization, project=project, item=locked, movement_type=movement_type, quantity=signed_quantity, reference=reference, created_by=request.user, created_at=int(time() * 1000))
        return Response(StoreItemSerializer(locked).data)

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def issue(self, request, pk=None):
        item = self.get_object(); quantity = Decimal(str(request.data.get("quantity", 0)))
        movement_type = str(request.data.get("type", "issue"))
        if movement_type not in ("issue", "return") or quantity <= 0:
            raise ValidationError({"quantity": "Use a positive quantity and type issue or return."})
        project = None
        if request.data.get("project"):
            project = Project.objects.filter(pk=request.data["project"], organization=get_active_organization(request)).first()
            if not project: raise ValidationError({"project": "Project not found in this organization."})
        signed = -quantity if movement_type == "issue" else quantity
        return self._movement(request, item, movement_type, signed, str(request.data.get("reference", "")), project)

    @action(detail=True, methods=("post",), url_path="stock-take")
    @transaction.atomic
    def stock_take(self, request, pk=None):
        item = self.get_object(); counted = Decimal(str(request.data.get("counted", -1)))
        if counted < 0: raise ValidationError({"counted": "Counted stock cannot be negative."})
        locked = StoreItem.objects.select_for_update().get(pk=item.pk, organization=get_active_organization(request))
        return self._movement(request, locked, "adjustment", counted - locked.quantity_on_hand, str(request.data.get("reason", "Stock take")))


class StoreSupplierViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.procurement'
    queryset = StoreSupplier.objects.all(); serializer_class = StoreSupplierSerializer; search_fields = ("name", "contact")


class MaterialRequisitionViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.procurement'
    queryset = MaterialRequisition.objects.select_related("project", "raised_by").prefetch_related("lines__item")
    serializer_class = MaterialRequisitionSerializer; search_fields = ("reference", "project__name")

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer); lines = serializer.validated_data.pop("lines", [])
        if not lines: raise ValidationError({"lines": "At least one requisition line is required."})
        for line in lines:
            if line["item"].organization_id != organization.id or line["quantity"] <= 0: raise ValidationError({"lines": "Every item must belong to this organization and have a positive quantity."})
        requisition = serializer.save(organization=organization, raised_by=self.request.user, status="submitted", created_at=int(time() * 1000))
        MaterialRequisitionLine.objects.bulk_create([MaterialRequisitionLine(requisition=requisition, **line) for line in lines])

    def perform_update(self, serializer):
        if "lines" in serializer.validated_data: raise ValidationError({"lines": "Submitted requisition lines are immutable."})
        super().perform_update(serializer)


class PurchaseOrderViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.procurement'
    queryset = PurchaseOrder.objects.select_related("project", "supplier", "created_by").prefetch_related("lines__item")
    serializer_class = PurchaseOrderSerializer; search_fields = ("number", "project__name", "supplier__name")

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer); lines = serializer.validated_data.pop("lines", [])
        if not lines: raise ValidationError({"lines": "At least one purchase-order line is required."})
        for line in lines:
            if line["item"].organization_id != organization.id or line["quantity"] <= 0: raise ValidationError({"lines": "Every item must belong to this organization and have a positive quantity."})
        order = serializer.save(organization=organization, created_by=self.request.user, status="sent", created_at=int(time() * 1000))
        PurchaseOrderLine.objects.bulk_create([PurchaseOrderLine(purchase_order=order, **line) for line in lines])

    def perform_update(self, serializer):
        if self.get_object().status in ("received", "closed"): raise ValidationError({"purchase_order": "Received orders are immutable."})
        if "lines" in serializer.validated_data: raise ValidationError({"lines": "Sent purchase-order lines are immutable."})
        super().perform_update(serializer)

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def receive(self, request, pk=None):
        organization = get_active_organization(request)
        order = PurchaseOrder.objects.select_for_update().prefetch_related("lines__item").filter(pk=pk, organization=organization).first()
        if not order: return Response({"detail": "Purchase order not found."}, status=404)
        if order.status != "sent": raise ValidationError({"status": "Only a sent purchase order can be received."})
        now = int(time() * 1000)
        for line in order.lines.all():
            item = StoreItem.objects.select_for_update().get(pk=line.item_id)
            item.quantity_on_hand += line.quantity; item.save(update_fields=("quantity_on_hand",))
            StockMovement.objects.create(organization=organization, project=order.project, item=item, movement_type="grn", quantity=line.quantity, reference=order.number, created_by=request.user, created_at=now)
        order.status="received"; order.received_at=now; order.save(update_fields=("status", "received_at"))
        return Response(PurchaseOrderSerializer(order).data)

    def perform_destroy(self, instance):
        if instance.status != "draft": raise ValidationError({"purchase_order": "Only draft purchase orders can be deleted."})
        instance.delete()


class StockMovementViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.procurement'
    queryset = StockMovement.objects.select_related("project", "item", "created_by")
    serializer_class = StockMovementSerializer; http_method_names = ("get", "head", "options"); search_fields = ("item__code", "item__name", "reference", "movement_type")


class DashboardViewSet(ViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.MONITORING

    def list(self, request):
        organization = get_active_organization(request)
        projects = Project.objects.filter(organization=organization, archived=False)
        milestones = MilestoneEntry.objects.filter(organization=organization)
        tickets = Ticket.objects.filter(organization=organization)
        risks = Risk.objects.filter(organization=organization)
        variations = Variation.objects.filter(organization=organization)
        certificates = Certificate.objects.filter(organization=organization).exclude(status="void")
        disbursements = Disbursement.objects.filter(organization=organization, status="paid")
        total_budget = projects.aggregate(value=Sum("budget"))["value"] or 0
        spent = disbursements.aggregate(value=Sum("amount"))["value"] or 0
        return Response({
            "kpis": {
                "activeProjects": projects.filter(stage="active").count(),
                "portfolioProjects": projects.count(),
                "openTickets": tickets.exclude(status__in=("closed", "resolved")).count(),
                "highRisks": risks.filter(likelihood__gte=4, impact__gte=4).exclude(status="closed").count(),
                "submittedMilestones": milestones.filter(submitted_at__isnull=False).count(),
                "approvedVariations": variations.filter(status="approved").aggregate(value=Sum("amount"))["value"] or 0,
                "certifiedValue": certificates.aggregate(value=Sum("net_payable"))["value"] or 0,
                "paidValue": spent,
                "budgetUtilization": round(float(spent / total_budget * 100), 1) if total_budget else 0,
            },
            "projects": ProjectSerializer(projects[:8], many=True).data,
            "projectStages": list(projects.values("stage").annotate(count=Count("id")).order_by("stage")),
            "recentTickets": TicketSerializer(tickets.order_by("-updated_at")[:6], many=True).data,
            "topRisks": RiskSerializer(risks.order_by("-created_at")[:6], many=True).data,
        })
