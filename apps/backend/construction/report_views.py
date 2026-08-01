import datetime
import csv
from collections import defaultdict
from decimal import Decimal

from django.http import HttpResponse
from django.db.models import Sum
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from core.models import Module
from core.permissions import HasModuleSubscription
from core.tenancy import get_active_organization

from .models import (
    BoQItem, Certificate, ContingencyDrawdown, DailyLog, Disbursement, MaterialDelivery,
    MilestoneEntry, Observation, Project, Risk, SafetyIncident, Ticket, Variation,
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


def _scoped_project(request, project_id):
    return Project.objects.filter(id=project_id, organization=get_active_organization(request)).first()


@api_view(["GET"])
@permission_classes([ConstructionSubscription])
def weekly_report(request):
    project_id = request.query_params.get("project") or request.query_params.get("project_id")
    if not project_id:
        return Response({"project": "A project query parameter is required."}, status=400)
    return project_report(request._request, project_id)


@api_view(["GET"])
@permission_classes([ConstructionSubscription])
def monthly_report(request):
    project_id = request.query_params.get("project") or request.query_params.get("project_id")
    if not project_id:
        return Response({"project": "A project query parameter is required."}, status=400)
    response = project_report(request._request, project_id)
    if response.status_code != 200:
        return response
    year = int(request.query_params.get("year", datetime.date.today().year))
    month = int(request.query_params.get("month", datetime.date.today().month))
    def in_month(row):
        try:
            week_year, week_number = row["week"].split("-W")
            return datetime.date.fromisocalendar(int(week_year), int(week_number), 1).month == month and int(week_year) == year
        except (TypeError, ValueError):
            return False
    weeks = [row for row in response.data["weekly"] if in_month(row)]
    return Response({
        **response.data,
        "period": {"year": year, "month": month},
        "weekly": weeks,
        "summary": {
            "submissions": sum(row["submissions"] for row in weeks),
            "averageProgress": round(sum(row["averageProgress"] for row in weeks) / len(weeks), 1) if weeks else 0,
            "issues": sum(row["issues"] + row["urgentIssues"] for row in weeks),
            "deliveries": sum(row["materialDeliveries"] for row in weeks),
            "incidents": sum(row["safetyIncidents"] for row in weeks),
        },
    })


def _csv_response(filename):
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@api_view(["GET"])
@permission_classes([ConstructionSubscription])
def export_boq_csv(request, project_id):
    project = _scoped_project(request, project_id)
    if not project: return Response({"detail": "Project not found."}, status=404)
    response = _csv_response(f"boq-{project.code}.csv"); writer = csv.writer(response)
    writer.writerow(["Section", "Item", "Description", "Unit", "Quantity", "Rate", "Amount", "Cost state", "Certified"])
    for item in BoQItem.objects.filter(project=project, organization=project.organization).order_by("section", "item_number"):
        writer.writerow([item.section, item.item_number, item.description, item.unit, item.quantity, item.rate, item.amount, item.cost_state, item.certified_amount])
    return response


@api_view(["GET"])
@permission_classes([ConstructionSubscription])
def export_milestones_csv(request, project_id):
    project = _scoped_project(request, project_id)
    if not project: return Response({"detail": "Project not found."}, status=404)
    response = _csv_response(f"milestones-{project.code}.csv"); writer = csv.writer(response)
    writer.writerow(["Milestone", "Progress", "Submitted", "Certifying role", "Payment value"])
    for item in MilestoneEntry.objects.filter(project_id=project.id, organization=project.organization, deleted_at__isnull=True).order_by("milestone_id"):
        writer.writerow([item.milestone_id, item.percent_complete, item.submitted_at or "", item.required_certifying_role, item.payment_value])
    return response


@api_view(["GET"])
@permission_classes([ConstructionSubscription])
def export_cost_csv(request, project_id):
    project = _scoped_project(request, project_id)
    if not project: return Response({"detail": "Project not found."}, status=404)
    response = _csv_response(f"cost-{project.code}.csv"); writer = csv.writer(response)
    approved = Variation.objects.filter(project=project, organization=project.organization, status="approved")
    additions = approved.exclude(variation_type="omission").aggregate(total=Sum("amount"))["total"] or 0
    omissions = approved.filter(variation_type="omission").aggregate(total=Sum("amount"))["total"] or 0
    writer.writerow(["Cost report", project.name]); writer.writerow([]); writer.writerow(["Metric", "Value"])
    writer.writerow(["Budget", project.budget]); writer.writerow(["Tender amount", project.tender_amount])
    writer.writerow(["Approved variations", additions - omissions]); writer.writerow([])
    writer.writerow(["Section", "Item", "Description", "Amount", "Cost state", "Certified"])
    for item in BoQItem.objects.filter(project=project, organization=project.organization).order_by("section", "item_number"):
        writer.writerow([item.section, item.item_number, item.description, item.amount, item.cost_state, item.certified_amount])
    return response
