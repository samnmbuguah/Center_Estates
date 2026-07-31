from django.db.models import Count, Sum
from time import time
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet

from core.models import Module
from core.permissions import HasModuleSubscription
from core.tenancy import get_active_organization

from .models import (
    BoQItem, CalendarEvent, DailyLog, EvidenceFile, MilestoneEntry,
    Project, ProjectApproval, ProjectDocument, QualityTest, Rfi, Risk,
    SafetyIncident, Ticket, Variation, WorkPlanTask,
)
from .serializers import (
    BoQItemSerializer, CalendarEventSerializer, DailyLogSerializer,
    EvidenceSerializer, MilestoneSerializer, ProjectApprovalSerializer,
    ProjectDocumentSerializer, ProjectSerializer, QualityTestSerializer,
    RfiSerializer, RiskSerializer, SafetyIncidentSerializer,
    TicketSerializer, VariationSerializer, WorkPlanTaskSerializer,
)


class ConstructionScopedViewSet(ModelViewSet):
    permission_classes = (HasModuleSubscription,)
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
        if self.request.headers.get("X-Client-Kind", "").lower() != "mobile":
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
    pass


class EvidenceViewSet(MobileCaptureMixin, ImmutableSubmittedMixin, EvidenceBaseViewSet):
    pass
DailyLogViewSet = scoped_viewset("DailyLogViewSet", DailyLog, DailyLogSerializer, ("notes", "weather"))
RiskViewSet = scoped_viewset("RiskViewSet", Risk, RiskSerializer, ("reference", "description"))
TicketViewSet = scoped_viewset("TicketViewSet", Ticket, TicketSerializer, ("title", "body"))
WorkPlanTaskViewSet = scoped_viewset("WorkPlanTaskViewSet", WorkPlanTask, WorkPlanTaskSerializer, ("task_name", "task_id"))
BoQItemViewSet = scoped_viewset("BoQItemViewSet", BoQItem, BoQItemSerializer, ("description", "item_number"))
VariationViewSet = scoped_viewset("VariationViewSet", Variation, VariationSerializer, ("description", "variation_number"))
QualityTestViewSet = scoped_viewset("QualityTestViewSet", QualityTest, QualityTestSerializer, ("test_type", "result"))
RfiViewSet = scoped_viewset("RfiViewSet", Rfi, RfiSerializer, ("title", "question", "number"))
SafetyIncidentViewSet = scoped_viewset("SafetyIncidentViewSet", SafetyIncident, SafetyIncidentSerializer, ("description", "action_taken"))
CalendarEventViewSet = scoped_viewset("CalendarEventViewSet", CalendarEvent, CalendarEventSerializer, ("title", "description"))
ProjectDocumentViewSet = scoped_viewset("ProjectDocumentViewSet", ProjectDocument, ProjectDocumentSerializer, ("title", "discipline"))
ProjectApprovalViewSet = scoped_viewset("ProjectApprovalViewSet", ProjectApproval, ProjectApprovalSerializer, ("approval_type", "authority", "reference"))


class DashboardViewSet(ViewSet):
    permission_classes = (HasModuleSubscription,)
    required_module = Module.MONITORING

    def list(self, request):
        organization = get_active_organization(request)
        projects = Project.objects.filter(organization=organization, archived=False)
        milestones = MilestoneEntry.objects.filter(organization=organization)
        tickets = Ticket.objects.filter(organization=organization)
        risks = Risk.objects.filter(organization=organization)
        variations = Variation.objects.filter(organization=organization)
        return Response({
            "kpis": {
                "activeProjects": projects.filter(stage="active").count(),
                "portfolioProjects": projects.count(),
                "openTickets": tickets.exclude(status__in=("closed", "resolved")).count(),
                "highRisks": risks.filter(likelihood__gte=4, impact__gte=4).exclude(status="closed").count(),
                "submittedMilestones": milestones.filter(submitted_at__isnull=False).count(),
                "approvedVariations": variations.filter(status="approved").aggregate(value=Sum("amount"))["value"] or 0,
            },
            "projects": ProjectSerializer(projects[:8], many=True).data,
            "projectStages": list(projects.values("stage").annotate(count=Count("id")).order_by("stage")),
            "recentTickets": TicketSerializer(tickets.order_by("-updated_at")[:6], many=True).data,
            "topRisks": RiskSerializer(risks.order_by("-created_at")[:6], many=True).data,
        })
