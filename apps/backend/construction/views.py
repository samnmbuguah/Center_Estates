from decimal import Decimal
from django.db import transaction
from django.db.models import Count, Sum
from time import time
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet

from core.models import Module
from core.permissions import HasModuleSubscription
from core.tenancy import get_active_organization

from .models import (
    AdminAuditLog, AdvancePayment, BimDiscrepancy, BimModel, BoQItem, CalendarEvent, ChatMessage,
    Certificate, ConsultantPayment, ContingencyDrawdown, DailyLog,
    Disbursement, DrawdownRequest, DroneDataset, EvidenceFile, LifecycleRecord,
    MaterialDelivery, MaterialRequisition, MaterialRequisitionLine, MilestoneEntry, Notification, Project, ProjectApproval, ProjectDocument,
    PurchaseOrder, PurchaseOrderLine,
    ProvisionalSum, QualityTest, Requisition, Rfi, Risk, SafetyIncident,
    SatelliteDataset, StockMovement, StoreItem, StoreSupplier, Subcontractor, Ticket, Variation, WorkOrder, WorkPlanTask,
)
from .serializers import (
    AdminAuditLogSerializer, AdvancePaymentSerializer, BimDiscrepancySerializer, BimModelSerializer,
    BoQItemSerializer, CalendarEventSerializer, CertificateSerializer,
    ConsultantPaymentSerializer, ContingencyDrawdownSerializer,
    ChatMessageSerializer, DailyLogSerializer, DisbursementSerializer, DrawdownRequestSerializer,
    DroneDatasetSerializer, EvidenceSerializer, LifecycleSerializer,
    MaterialDeliverySerializer, MaterialRequisitionSerializer, MilestoneSerializer, NotificationSerializer, ProjectApprovalSerializer,
    ProjectDocumentSerializer, ProjectSerializer, ProvisionalSumSerializer,
    QualityTestSerializer, RequisitionSerializer, RfiSerializer, RiskSerializer,
    PurchaseOrderSerializer, SafetyIncidentSerializer, SatelliteDatasetSerializer, StockMovementSerializer,
    StoreItemSerializer, StoreSupplierSerializer, SubcontractorSerializer, TicketSerializer, VariationSerializer,
    WorkOrderSerializer, WorkPlanTaskSerializer,
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
LifecycleViewSet = scoped_viewset("LifecycleViewSet", LifecycleRecord, LifecycleSerializer, ("title", "reference", "record_type"))
MaterialDeliveryViewSet = scoped_viewset("MaterialDeliveryViewSet", MaterialDelivery, MaterialDeliverySerializer, ("material", "supplier"))
ConsultantPaymentViewSet = scoped_viewset("ConsultantPaymentViewSet", ConsultantPayment, ConsultantPaymentSerializer, ("consultant_name", "certificate_number"))
DroneDatasetViewSet = scoped_viewset("DroneDatasetViewSet", DroneDataset, DroneDatasetSerializer, ("data_type", "operator_id", "milestone_id"))
SatelliteDatasetViewSet = scoped_viewset("SatelliteDatasetViewSet", SatelliteDataset, SatelliteDatasetSerializer, ("sat_type", "source_provider", "milestone_id"))
ProvisionalSumViewSet = scoped_viewset("ProvisionalSumViewSet", ProvisionalSum, ProvisionalSumSerializer, ("item_number", "description"))
ContingencyDrawdownViewSet = scoped_viewset("ContingencyDrawdownViewSet", ContingencyDrawdown, ContingencyDrawdownSerializer, ("drawdown_number", "reason"))
AdvancePaymentViewSet = scoped_viewset("AdvancePaymentViewSet", AdvancePayment, AdvancePaymentSerializer, ("contractor_name", "notes"))
SubcontractorViewSet = scoped_viewset("SubcontractorViewSet", Subcontractor, SubcontractorSerializer, ("name", "contact_person", "email"))
WorkOrderViewSet = scoped_viewset("ConstructionWorkOrderViewSet", WorkOrder, WorkOrderSerializer, ("order_number", "description", "boq_section"))
BimModelViewSet = scoped_viewset("BimModelViewSet", BimModel, BimModelSerializer, ("name", "discipline", "version"))
BimDiscrepancyViewSet = scoped_viewset("BimDiscrepancyViewSet", BimDiscrepancy, BimDiscrepancySerializer, ("milestone_ref", "description"))
RequisitionViewSet = scoped_viewset("RequisitionViewSet", Requisition, RequisitionSerializer, ("title", "description"))
CertificateBaseViewSet = scoped_viewset("CertificateBaseViewSet", Certificate, CertificateSerializer, ("number", "contractor_name"))


class CertificateViewSet(CertificateBaseViewSet):
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
DisbursementViewSet = scoped_viewset("DisbursementViewSet", Disbursement, DisbursementSerializer)
DrawdownRequestViewSet = scoped_viewset("DrawdownRequestViewSet", DrawdownRequest, DrawdownRequestSerializer, ("request_number", "purpose"))


class ChatMessageViewSet(ConstructionScopedViewSet):
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


class NotificationViewSet(ConstructionScopedViewSet):
    queryset = Notification.objects.select_related("recipient")
    serializer_class = NotificationSerializer
    http_method_names = ("get", "patch", "head", "options")

    def get_queryset(self):
        return super().get_queryset().filter(recipient=self.request.user)

    def perform_update(self, serializer):
        allowed = set(serializer.validated_data) <= {"read_at"}
        if not allowed:
            raise ValidationError({"notification": "Only read status may be changed."})
        serializer.save()


class AdminAuditLogViewSet(ConstructionScopedViewSet):
    queryset = AdminAuditLog.objects.select_related("user")
    serializer_class = AdminAuditLogSerializer
    search_fields = ("action", "category", "resource", "resource_id")
    http_method_names = ("get", "head", "options")


class StoreItemViewSet(ConstructionScopedViewSet):
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
    queryset = StoreSupplier.objects.all(); serializer_class = StoreSupplierSerializer; search_fields = ("name", "contact")


class MaterialRequisitionViewSet(ConstructionScopedViewSet):
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
    queryset = StockMovement.objects.select_related("project", "item", "created_by")
    serializer_class = StockMovementSerializer; http_method_names = ("get", "head", "options"); search_fields = ("item__code", "item__name", "reference", "movement_type")


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
