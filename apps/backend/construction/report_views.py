import datetime
from collections import defaultdict
from decimal import Decimal

from django.db.models import Sum
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from core.models import Module
from core.permissions import HasModuleSubscription
from core.tenancy import get_active_organization

from .models import (
    Certificate, ContingencyDrawdown, DailyLog, Disbursement, MaterialDelivery,
    MilestoneEntry, Observation, Project, Risk, SafetyIncident, Ticket,
)


class ConstructionSubscription(HasModuleSubscription):
    module = Module.MONITORING


def iso_week_from_ms(value):
    date = datetime.datetime.fromtimestamp(value / 1000, tz=datetime.timezone.utc).date()
    year, week, _ = date.isocalendar()
    return f"{year}-W{week:02d}"


def iso_week_from_date(value):
    try:
        year, week, _ = datetime.date.fromisoformat(value).isocalendar()
        return f"{year}-W{week:02d}"
    except (TypeError, ValueError):
        return None


@api_view(["GET"])
@permission_classes([ConstructionSubscription])
def project_report(request, project_id):
    organization = get_active_organization(request)
    project = Project.objects.filter(id=project_id, organization=organization).first()
    if not project:
        return Response({"detail": "Project not found."}, status=404)

    entries = list(MilestoneEntry.objects.filter(
        organization=organization, project_id=project.id,
        submitted_at__isnull=False, deleted_at__isnull=True,
    ).order_by("submitted_at"))
    weeks = defaultdict(lambda: {"values": [], "milestones": set(), "issues": 0, "urgent": 0, "deliveries": 0, "incidents": 0})
    entry_weeks = {}
    for entry in entries:
        week = iso_week_from_ms(entry.submitted_at)
        entry_weeks[entry.id] = week
        weeks[week]["values"].append(entry.percent_complete)
        weeks[week]["milestones"].add(entry.milestone_id)
    for item in Observation.objects.filter(organization=organization, milestone_entry_id__in=entry_weeks).exclude(flag="none"):
        week = entry_weeks.get(item.milestone_entry_id)
        if week and item.flag in ("issue", "urgent"):
            weeks[week][item.flag] += 1
    for delivery in MaterialDelivery.objects.filter(organization=organization, project_id=project.id):
        week = iso_week_from_date(delivery.delivery_date)
        if week:
            weeks[week]["deliveries"] += 1
    for incident in SafetyIncident.objects.filter(organization=organization, project_id=project.id):
        week = iso_week_from_date(incident.incident_date)
        if week:
            weeks[week]["incidents"] += 1
    weekly = [{
        "week": week, "submissions": len(bucket["values"]),
        "distinctMilestones": len(bucket["milestones"]),
        "averageProgress": round(sum(bucket["values"]) / len(bucket["values"]), 1) if bucket["values"] else 0,
        "issues": bucket["issues"], "urgentIssues": bucket["urgent"],
        "materialDeliveries": bucket["deliveries"], "safetyIncidents": bucket["incidents"],
    } for week, bucket in sorted(weeks.items())]

    certificates = Certificate.objects.filter(organization=organization, project_id=project.id).exclude(status="void")
    paid = Disbursement.objects.filter(organization=organization, project_id=project.id, status="paid").aggregate(total=Sum("amount"))["total"] or Decimal(0)
    contingency = ContingencyDrawdown.objects.filter(organization=organization, project=project, status="approved").aggregate(total=Sum("amount"))["total"] or Decimal(0)
    open_tickets = Ticket.objects.filter(organization=organization, project_id=project.id).exclude(status__in=("resolved", "closed"))
    return Response({
        "project": {"id": project.id, "code": project.code, "name": project.name},
        "weekly": weekly,
        "schedule": {"actualProgress": weekly[-1]["averageProgress"] if weekly else 0},
        "cost": {
            "budget": project.budget, "approvedVariations": project.approved_variations,
            "certifiedToDate": certificates.aggregate(total=Sum("net_payable"))["total"] or 0,
            "paidToDate": paid, "forecastFinalCost": project.budget + project.approved_variations + contingency,
        },
        "risk": {
            "openTickets": open_tickets.count(), "highRisks": Risk.objects.filter(
                organization=organization, project_id=project.id, likelihood__gte=4, impact__gte=4,
            ).exclude(status="closed").count(),
        },
        "compliance": {
            "dailyLogs": DailyLog.objects.filter(organization=organization, project_id=project.id).count(),
            "materialDeliveries": MaterialDelivery.objects.filter(organization=organization, project_id=project.id).count(),
            "safetyIncidents": SafetyIncident.objects.filter(organization=organization, project_id=project.id).count(),
        },
    })
