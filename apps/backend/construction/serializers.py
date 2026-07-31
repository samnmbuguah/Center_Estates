from rest_framework import serializers

from .models import (
    AdminAuditLog, AdvancePayment, BimDiscrepancy, BimModel, BoQItem, CalendarEvent, ChatMessage,
    Certificate, ConsultantPayment, ContingencyDrawdown, DailyLog,
    Disbursement, DrawdownRequest, DroneDataset, EvidenceFile, LifecycleRecord,
    MaterialDelivery, MaterialRequisition, MaterialRequisitionLine, MilestoneEntry, Notification, Project, ProjectApproval, ProjectDocument,
    PurchaseOrder, PurchaseOrderLine,
    ProvisionalSum, QualityTest, Requisition, Rfi, Risk, SafetyIncident,
    SatelliteDataset, StockMovement, StoreItem, StoreSupplier, Subcontractor, Ticket, Variation, WorkOrder, WorkPlanTask,
)


class OrganizationScopedSerializer(serializers.ModelSerializer):
    def get_fields(self):
        fields = super().get_fields()
        fields.pop("organization", None)
        return fields


def serializer_for(model, extra_fields=None):
    meta = type("Meta", (), {"model": model, "fields": "__all__"})
    attrs = {"Meta": meta}
    if extra_fields:
        attrs.update(extra_fields)
    return type(f"{model.__name__}Serializer", (OrganizationScopedSerializer,), attrs)


ProjectSerializer = serializer_for(Project, {
    "id": serializers.CharField(read_only=True),
    "created_at": serializers.IntegerField(read_only=True),
    "portfolio_project_name": serializers.CharField(source="portfolio_project.name", read_only=True),
})
MilestoneSerializer = serializer_for(MilestoneEntry)
EvidenceSerializer = serializer_for(EvidenceFile)
DailyLogSerializer = serializer_for(DailyLog)
RiskSerializer = serializer_for(Risk)
TicketSerializer = serializer_for(Ticket)
WorkPlanTaskSerializer = serializer_for(WorkPlanTask)
BoQItemSerializer = serializer_for(BoQItem)
VariationSerializer = serializer_for(Variation)
QualityTestSerializer = serializer_for(QualityTest)
RfiSerializer = serializer_for(Rfi)
SafetyIncidentSerializer = serializer_for(SafetyIncident)
CalendarEventSerializer = serializer_for(CalendarEvent)
ProjectDocumentSerializer = serializer_for(ProjectDocument)
ProjectApprovalSerializer = serializer_for(ProjectApproval)
LifecycleSerializer = serializer_for(LifecycleRecord)
MaterialDeliverySerializer = serializer_for(MaterialDelivery)
ConsultantPaymentSerializer = serializer_for(ConsultantPayment)
DroneDatasetSerializer = serializer_for(DroneDataset)
SatelliteDatasetSerializer = serializer_for(SatelliteDataset)
ProvisionalSumSerializer = serializer_for(ProvisionalSum)
ContingencyDrawdownSerializer = serializer_for(ContingencyDrawdown)
AdvancePaymentSerializer = serializer_for(AdvancePayment)
SubcontractorSerializer = serializer_for(Subcontractor)
WorkOrderSerializer = serializer_for(WorkOrder)
BimModelSerializer = serializer_for(BimModel)
BimDiscrepancySerializer = serializer_for(BimDiscrepancy)
RequisitionSerializer = serializer_for(Requisition)
CertificateSerializer = serializer_for(Certificate)
DisbursementSerializer = serializer_for(Disbursement)
DrawdownRequestSerializer = serializer_for(DrawdownRequest)
ChatMessageSerializer = serializer_for(ChatMessage, {
    "sender": serializers.PrimaryKeyRelatedField(read_only=True),
    "created_at": serializers.IntegerField(read_only=True),
    "sender_name": serializers.CharField(source="sender.username", read_only=True),
})
NotificationSerializer = serializer_for(Notification)
AdminAuditLogSerializer = serializer_for(AdminAuditLog, {
    "user_name": serializers.CharField(source="user.username", read_only=True),
})


class RequisitionLineSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    class Meta:
        model = MaterialRequisitionLine
        fields = ("id", "item", "item_name", "quantity")


class MaterialRequisitionSerializer(OrganizationScopedSerializer):
    lines = RequisitionLineSerializer(many=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    raised_by_name = serializers.CharField(source="raised_by.username", read_only=True)
    class Meta:
        model = MaterialRequisition
        fields = "__all__"
        read_only_fields = ("raised_by", "created_at", "status")


class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    class Meta:
        model = PurchaseOrderLine
        fields = ("id", "item", "item_name", "quantity", "unit_price")


class PurchaseOrderSerializer(OrganizationScopedSerializer):
    lines = PurchaseOrderLineSerializer(many=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)
    total = serializers.SerializerMethodField()
    class Meta:
        model = PurchaseOrder
        fields = "__all__"
        read_only_fields = ("created_by", "created_at", "received_at", "status")
    def get_total(self, obj):
        return sum(line.quantity * line.unit_price for line in obj.lines.all())


StoreItemSerializer = serializer_for(StoreItem)
StoreSupplierSerializer = serializer_for(StoreSupplier)
StockMovementSerializer = serializer_for(StockMovement, {
    "item_name": serializers.CharField(source="item.name", read_only=True),
    "project_name": serializers.CharField(source="project.name", read_only=True),
    "created_by_name": serializers.CharField(source="created_by.username", read_only=True),
})
