from rest_framework import serializers

from .models import (
    AdvancePayment, BimDiscrepancy, BimModel, BoQItem, CalendarEvent,
    Certificate, ConsultantPayment, ContingencyDrawdown, DailyLog,
    Disbursement, DrawdownRequest, DroneDataset, EvidenceFile, LifecycleRecord,
    MaterialDelivery, MilestoneEntry, Project, ProjectApproval, ProjectDocument,
    ProvisionalSum, QualityTest, Requisition, Rfi, Risk, SafetyIncident,
    SatelliteDataset, Subcontractor, Ticket, Variation, WorkOrder, WorkPlanTask,
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
