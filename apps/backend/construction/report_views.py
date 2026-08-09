import datetime
import csv
from collections import defaultdict
from decimal import Decimal

from django.http import HttpResponse
from django.db.models import Sum
from rest_framework.decorators import api_view, permission_classes
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes
from rest_framework.response import Response

from core.models import Module
from core.permissions import HasModuleSubscription
from core.tenancy import get_active_organization

from .models import (
    BimModel, BoQItem, Certificate, ContingencyDrawdown, DailyLog, Disbursement, MaterialDelivery,
    MilestoneEntry, Observation, ProgressPlan, Project, ProjectDocument, Risk, SafetyIncident,
    Ticket, Variation, WorkPlanTask,
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


@extend_schema(request=None, responses={200: {"type": "object"}}, parameters=[OpenApiParameter("project_id", OpenApiTypes.STR, OpenApiParameter.PATH)])
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


@extend_schema(request=None, responses={200: {"type": "object"}}, )
@api_view(["GET"])
@permission_classes([ConstructionSubscription])
def weekly_report(request):
    project_id = request.query_params.get("project") or request.query_params.get("project_id")
    if not project_id:
        return Response({"project": "A project query parameter is required."}, status=400)
    return project_report(request._request, project_id)


@extend_schema(request=None, responses={200: {"type": "object"}}, )
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


@extend_schema(request=None, responses={200: {"type": "string", "format": "binary"}}, parameters=[OpenApiParameter("project_id", OpenApiTypes.STR, OpenApiParameter.PATH)])
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


@extend_schema(request=None, responses={200: {"type": "string", "format": "binary"}}, parameters=[OpenApiParameter("project_id", OpenApiTypes.STR, OpenApiParameter.PATH)])
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


@extend_schema(request=None, responses={200: {"type": "string", "format": "binary"}}, parameters=[OpenApiParameter("project_id", OpenApiTypes.STR, OpenApiParameter.PATH)])
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


def build_scurve(project, organization):
    planned = {
        row.week: row.planned_percent
        for row in ProgressPlan.objects.filter(project_id=project.id).order_by("week")
    }
    entries = list(
        MilestoneEntry.objects.filter(
            organization=organization, project_id=project.id, submitted_at__isnull=False, deleted_at__isnull=True,
        ).order_by("submitted_at")
    )
    actual_by_week = {}
    for entry in entries:
        week = iso_week_from_ms(entry.submitted_at)
        actual_by_week.setdefault(week, []).append(entry.percent_complete)
    actual = {
        week: round(sum(values) / len(values), 1)
        for week, values in actual_by_week.items()
    }
    weeks = sorted(set(planned) | set(actual))
    series = [
        {
            "week": week,
            "planned_percent": planned.get(week),
            "actual_percent": actual.get(week),
        }
        for week in weeks
    ]
    if not series and entries:
        series = [
            {
                "week": f"M{index + 1}",
                "planned_percent": min(100, int(round((index + 1) / max(len(entries), 1) * 100))),
                "actual_percent": entry.percent_complete,
            }
            for index, entry in enumerate(entries)
        ]
    return {
        "project_id": project.id,
        "project_code": project.code,
        "series": series,
        "latest_actual": series[-1]["actual_percent"] if series else 0,
        "latest_planned": series[-1]["planned_percent"] if series else 0,
    }


@extend_schema(request=None, responses={200: {"type": "object"}}, parameters=[OpenApiParameter("project_id", OpenApiTypes.STR, OpenApiParameter.PATH)])
@api_view(["GET"])
@permission_classes([ConstructionSubscription])
def project_scurve(request, project_id):
    """Planned vs actual progress series for the project S-curve chart."""
    project = _scoped_project(request, project_id)
    if not project:
        return Response({"detail": "Project not found."}, status=404)
    return Response(build_scurve(project, get_active_organization(request)))


@extend_schema(request=None, responses={200: {"type": "object"}}, parameters=[OpenApiParameter("project_id", OpenApiTypes.STR, OpenApiParameter.PATH)])
@api_view(["GET"])
@permission_classes([ConstructionSubscription])
def project_workspace(request, project_id):
    """Unified project command-center payload (MonitoringERP ProjectWorkspace parity)."""
    project = _scoped_project(request, project_id)
    if not project:
        return Response({"detail": "Project not found."}, status=404)
    organization = get_active_organization(request)
    milestones = list(
        MilestoneEntry.objects.filter(organization=organization, project_id=project.id, deleted_at__isnull=True)
        .order_by("-submitted_at", "milestone_id")[:20]
    )
    average_progress = (
        round(sum(item.percent_complete for item in milestones) / len(milestones), 1) if milestones else 0
    )
    certificates = Certificate.objects.filter(organization=organization, project_id=project.id).exclude(status="void")
    paid = Disbursement.objects.filter(
        organization=organization, project_id=project.id, status="paid",
    ).aggregate(total=Sum("amount"))["total"] or Decimal(0)
    certified = certificates.aggregate(total=Sum("net_payable"))["total"] or Decimal(0)
    budget = project.budget or Decimal(0)
    util = round(float(paid / budget * 100), 1) if budget else 0
    return Response({
        "project": {
            "id": project.id,
            "code": project.code,
            "name": project.name,
            "stage": project.stage,
            "location": project.location,
            "client_name": project.client_name,
            "budget": project.budget,
            "planned_completion_date": project.planned_completion_date,
            "site_latitude": getattr(project, "site_latitude", None),
            "site_longitude": getattr(project, "site_longitude", None),
        },
        "kpis": {
            "averageProgress": average_progress,
            "milestones": len(milestones),
            "milestonesComplete": sum(1 for item in milestones if item.percent_complete >= 100),
            "openTickets": Ticket.objects.filter(organization=organization, project_id=project.id)
            .exclude(status__in=("resolved", "closed")).count(),
            "openRisks": Risk.objects.filter(organization=organization, project_id=project.id)
            .exclude(status="closed").count(),
            "budgetUtilization": util,
            "certifiedValue": certified,
            "paidValue": paid,
            "documents": ProjectDocument.objects.filter(organization=organization, project=project).count(),
            "workPlanTasks": WorkPlanTask.objects.filter(project=project).count(),
            "bimModels": BimModel.objects.filter(project=project).count(),
        },
        "scurve": build_scurve(project, organization),
        "milestones": [
            {
                "id": item.id,
                "milestone_id": item.milestone_id,
                "percent_complete": item.percent_complete,
                "submitted_at": item.submitted_at,
                "required_certifying_role": item.required_certifying_role,
                "payment_value": item.payment_value,
            }
            for item in milestones
        ],
    })
