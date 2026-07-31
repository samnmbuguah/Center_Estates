from rest_framework import serializers

from .models import (
    BoQItem, CalendarEvent, DailyLog, EvidenceFile, MilestoneEntry,
    Project, ProjectApproval, ProjectDocument, QualityTest, Rfi, Risk,
    SafetyIncident, Ticket, Variation, WorkPlanTask,
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
