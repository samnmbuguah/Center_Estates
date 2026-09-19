"""
Site operations ViewSets:
  DailyLog, Risk, Ticket, TicketComment, WorkPlanTask, BoQItem, QualityTest,
  Rfi, SafetyIncident, CalendarEvent, ProjectDocument, DocumentVersion,
  ProjectApproval, RequirementWaiver, ProjectMembership, Lifecycle,
  MaterialDelivery, ConsultantPayment, Drone, Satellite, BIM, Variation,
  WorkOrder, Subcontractor, DashboardViewSet.
"""
from decimal import Decimal
from time import time

from django.db import transaction
from django.db.models import Count, Sum
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from core.models import Module
from core.permissions import HasModuleActionPermission
from core.tenancy import get_active_organization
from organizations.models import Membership

from ..models import (
    BimDiscrepancy, BimModel, BoQItem, CalendarEvent, Certificate,
    ConsultantPayment, DailyLog, Disbursement, DocumentVersion, DroneDataset,
    EvidenceFile, LifecycleRecord, MaterialDelivery, MilestoneEntry,
    Project, ProjectApproval, ProjectDocument, ProjectMembership,
    QualityTest, RequirementWaiver, Rfi, Risk, SafetyIncident,
    SatelliteDataset, Subcontractor, Ticket, TicketComment, Variation,
    WorkOrder, WorkPlanTask,
)
from ..serializers import (
    BimDiscrepancySerializer, BimModelSerializer, BoQItemSerializer,
    CalendarEventSerializer, CertificateSerializer, ConsultantPaymentSerializer,
    DailyLogSerializer, DocumentVersionSerializer, DroneDatasetSerializer,
    EvidenceSerializer, LifecycleSerializer, MaterialDeliverySerializer,
    MilestoneSerializer, ProjectApprovalSerializer, ProjectDocumentSerializer,
    ProjectMembershipSerializer, ProjectSerializer, QualityTestSerializer,
    RequirementWaiverSerializer, RfiSerializer, RiskSerializer,
    SafetyIncidentSerializer, SatelliteDatasetSerializer, SubcontractorSerializer,
    TicketCommentSerializer, TicketSerializer, VariationSerializer,
    WorkOrderSerializer, WorkPlanTaskSerializer,
)
from .base import ConstructionScopedViewSet, scoped_viewset

# ── Simple one-liner registers ────────────────────────────────────────────────

DailyLogViewSet = scoped_viewset("DailyLogViewSet", DailyLog, DailyLogSerializer, ("notes", "weather"))
RiskViewSet = scoped_viewset("RiskViewSet", Risk, RiskSerializer, ("reference", "description"))
WorkPlanTaskViewSet = scoped_viewset("WorkPlanTaskViewSet", WorkPlanTask, WorkPlanTaskSerializer, ("task_name", "task_id"))
BoQItemViewSet = scoped_viewset("BoQItemViewSet", BoQItem, BoQItemSerializer, ("description", "item_number"))
QualityTestViewSet = scoped_viewset("QualityTestViewSet", QualityTest, QualityTestSerializer, ("test_type", "result"))
RfiViewSet = scoped_viewset("RfiViewSet", Rfi, RfiSerializer, ("title", "question", "number"))
SafetyIncidentViewSet = scoped_viewset("SafetyIncidentViewSet", SafetyIncident, SafetyIncidentSerializer, ("description", "action_taken"))
CalendarEventViewSet = scoped_viewset("CalendarEventViewSet", CalendarEvent, CalendarEventSerializer, ("title", "description"))
ProjectDocumentViewSet = scoped_viewset("ProjectDocumentViewSet", ProjectDocument, ProjectDocumentSerializer, ("title", "discipline"))
LifecycleViewSet = scoped_viewset("LifecycleViewSet", LifecycleRecord, LifecycleSerializer, ("title", "reference", "record_type"))
MaterialDeliveryViewSet = scoped_viewset("MaterialDeliveryViewSet", MaterialDelivery, MaterialDeliverySerializer, ("material", "supplier"))
ConsultantPaymentViewSet = scoped_viewset("ConsultantPaymentViewSet", ConsultantPayment, ConsultantPaymentSerializer, ("consultant_name", "certificate_number"))
DroneDatasetViewSet = scoped_viewset("DroneDatasetViewSet", DroneDataset, DroneDatasetSerializer, ("data_type", "operator_id", "milestone_id"))
SatelliteDatasetViewSet = scoped_viewset("SatelliteDatasetViewSet", SatelliteDataset, SatelliteDatasetSerializer, ("sat_type", "source_provider", "milestone_id"))
BimModelViewSet = scoped_viewset("BimModelViewSet", BimModel, BimModelSerializer, ("name", "discipline", "version"))
BimDiscrepancyViewSet = scoped_viewset("BimDiscrepancyViewSet", BimDiscrepancy, BimDiscrepancySerializer, ("milestone_ref", "description"))
SubcontractorViewSet = scoped_viewset("SubcontractorViewSet", Subcontractor, SubcontractorSerializer, ("name", "contact_person", "email"))
WorkOrderViewSet = scoped_viewset("ConstructionWorkOrderViewSet", WorkOrder, WorkOrderSerializer, ("order_number", "description", "boq_section"))
VariationBaseViewSet = scoped_viewset("VariationBaseViewSet", Variation, VariationSerializer, ("description", "variation_number"))

# Permission assignments
WorkPlanTaskViewSet.write_permission = 'monitoring.site'
BoQItemViewSet.write_permission = 'monitoring.commercial'
QualityTestViewSet.write_permission = 'monitoring.site'
RfiViewSet.write_permission = 'monitoring.site'
SafetyIncidentViewSet.write_permission = 'monitoring.site'
CalendarEventViewSet.write_permission = 'monitoring.site'
ProjectDocumentViewSet.write_permission = 'monitoring.site'
LifecycleViewSet.write_permission = 'monitoring.project_admin'
MaterialDeliveryViewSet.write_permission = 'monitoring.procurement'
ConsultantPaymentViewSet.write_permission = 'monitoring.commercial'
DroneDatasetViewSet.write_permission = 'monitoring.site'
SatelliteDatasetViewSet.write_permission = 'monitoring.site'
BimModelViewSet.write_permission = 'monitoring.site'
BimDiscrepancyViewSet.write_permission = 'monitoring.site'
SubcontractorViewSet.write_permission = 'monitoring.procurement'
WorkOrderViewSet.write_permission = 'monitoring.procurement'


# ── Full ViewSets with business logic ────────────────────────────────────────

class TicketViewSet(ConstructionScopedViewSet):
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer
    search_fields = ("title", "body")

    @action(detail=True, methods=["post"])
    def acknowledge(self, request, pk=None):
        ticket = self.get_object()
        ticket.status = "acknowledged"
        ticket.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        ticket = self.get_object()
        ticket.status = "resolved"
        ticket.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        ticket = self.get_object()
        ticket.status = "closed"
        ticket.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(ticket).data)


class TicketCommentViewSet(ConstructionScopedViewSet):
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


ProjectApprovalBaseViewSet = scoped_viewset(
    "ProjectApprovalBaseViewSet", ProjectApproval, ProjectApprovalSerializer,
    ("approval_type", "authority", "reference", "review_notes"),
)


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
        user = serializer.validated_data.get(
            "user",
            getattr(self.get_object() if self.kwargs.get("pk") else None, "user", None),
        )
        role = serializer.validated_data.get(
            "role",
            getattr(self.get_object() if self.kwargs.get("pk") else None, "role", None),
        )
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


class DashboardViewSet(ViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.MONITORING

    from drf_spectacular.utils import extend_schema

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        from django.db.models import Count, Sum
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
