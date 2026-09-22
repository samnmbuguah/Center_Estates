"""
Commercial cost aggregations: project cost dashboard and cash-flow forecast.

Response shapes mirror the MonitoringERP cost_views contract so the existing
CostDashboard/CashFlow workspace pages can consume them directly.
"""
from calendar import monthrange
from collections import defaultdict
from datetime import date
from decimal import Decimal

from django.db.models import Count, Sum
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from core.tenancy import get_active_organization

from ..models import (
    AdvancePayment, BoQItem, Certificate, ContingencyDrawdown, Disbursement,
    Project, ProvisionalSum, Variation, WorkPlanTask,
)
from ..report_views import ConstructionSubscription

COST_STATES = ("budgeted", "ascertained", "committed", "certified", "paid")
CENT = Decimal("0.01")


def _money(value):
    return (Decimal(str(value or 0))).quantize(CENT)


def _project_budget(project, organization):
    """Explicit project budget when set, otherwise the approved BoQ total.
    The source is reported so pages can label it."""
    if project.budget:
        return _money(project.budget), "project"
    total = BoQItem.objects.filter(
        project=project, organization=organization, approval_status="approved",
    ).aggregate(total=Sum("amount"))["total"]
    return _money(total), "boq"


def _contingency_eligibility(project, organization, budget):
    allowance = (budget * Decimal("5") / Decimal("100")).quantize(CENT)
    approved = ContingencyDrawdown.objects.filter(
        project=project, organization=organization, status="approved",
    ).aggregate(total=Sum("amount"))["total"]
    approved = _money(approved)
    return {
        "allowance": str(allowance),
        "approved": str(approved),
        "available": str((allowance - approved).quantize(CENT)),
    }


def _scoped_project(organization, project_id):
    return Project.objects.filter(id=project_id, organization=organization).first()


@extend_schema(request=None, responses={200: {"type": "object"}}, parameters=[OpenApiParameter("project_id", OpenApiTypes.STR, OpenApiParameter.PATH)])
@api_view(["GET"])
@permission_classes([ConstructionSubscription])
def cost_dashboard(request, project_id):
    """Aggregated cost overview: budget, variations, provisional sums,
    contingency, certificates (net of retention), disbursements, BoQ cost
    state breakdown, retention, and advance recovery status."""
    organization = get_active_organization(request)
    project = _scoped_project(organization, project_id)
    if not project:
        return Response({"detail": "Project not found."}, status=404)

    budget, budget_source = _project_budget(project, organization)
    tender = _money(project.tender_amount)

    additions = Variation.objects.filter(
        project=project, organization=organization, status="approved", variation_type="addition",
    ).aggregate(total=Sum("amount"))["total"]
    omissions = Variation.objects.filter(
        project=project, organization=organization, status="approved", variation_type="omission",
    ).aggregate(total=Sum("amount"))["total"]
    approved_vars = (_money(additions) - _money(omissions)).quantize(CENT)

    ps_agg = ProvisionalSum.objects.filter(
        project=project, organization=organization,
    ).aggregate(budgeted=Sum("budgeted_amount"), ascertained=Sum("ascertained_amount"))
    total_ps = _money(ps_agg["budgeted"])
    ascertained_ps = _money(ps_agg["ascertained"])

    total_contingency = _money(ContingencyDrawdown.objects.filter(
        project=project, organization=organization, status="approved",
    ).aggregate(total=Sum("amount"))["total"])
    drawdown_eligibility = _contingency_eligibility(project, organization, budget)

    cert_qs = Certificate.objects.filter(
        project_id=project.id, organization=organization,
    ).exclude(status="void")
    cert_agg = cert_qs.aggregate(total=Sum("amount"), ret_pct=Sum("retention_percent"))
    cert_total = _money(cert_agg["total"])
    cert_ret_pct = _money(cert_agg["ret_pct"])
    cert_retention = (cert_total * cert_ret_pct / Decimal(100)).quantize(CENT) if cert_ret_pct else Decimal("0.00")
    certified_to_date = (cert_total - cert_retention).quantize(CENT)

    retention_agg = cert_qs.aggregate(
        total_retention=Sum("retention_amount"),
        total_advance_recovery=Sum("advance_recovery"),
    )
    total_retention_held = _money(retention_agg["total_retention"])
    total_advance_recovery = _money(retention_agg["total_advance_recovery"])

    paid_to_date = _money(Disbursement.objects.filter(
        project_id=project.id, organization=organization, status="paid",
    ).aggregate(total=Sum("amount"))["total"])

    boq_qs = BoQItem.objects.filter(
        project=project, organization=organization, approval_status="approved",
    )
    boq_agg = boq_qs.aggregate(total_amount=Sum("amount"), total_certified=Sum("certified_amount"))
    boq_by_state = {}
    for state in COST_STATES:
        agg = boq_qs.filter(cost_state=state).aggregate(
            count=Count("id"), total=Sum("amount"), certified=Sum("certified_amount"),
        )
        boq_by_state[state] = {
            "count": agg["count"] or 0,
            "total": str(_money(agg["total"])),
            "certified_amount": str(_money(agg["certified"])),
        }

    advance_agg = AdvancePayment.objects.filter(
        project=project, organization=organization,
    ).aggregate(total_amount=Sum("amount"), total_recovered=Sum("recovered_amount"))
    total_advance = _money(advance_agg["total_amount"])
    total_recovered = _money(advance_agg["total_recovered"])
    advance_outstanding = (total_advance - total_recovered).quantize(CENT)

    forecast = (budget + approved_vars + total_contingency).quantize(CENT)
    return Response({
        "project_id": str(project.id),
        "tender_amount": str(tender),
        "budget": str(budget),
        "budget_source": budget_source,
        "budget_vs_tender": str((budget - tender).quantize(CENT)),
        "approved_variations": str(approved_vars),
        "provisional_sums_budget": str(total_ps),
        "provisional_sums_ascertained": str(ascertained_ps),
        "contingency_drawn": str(total_contingency),
        "forecast_final_cost": str(forecast),
        "cost_variance": str((forecast - budget).quantize(CENT)),
        "certified_to_date": str(certified_to_date),
        "paid_to_date": str(paid_to_date),
        "total_retention_held": str(total_retention_held),
        "total_advance_recovery": str(total_advance_recovery),
        "boq_total": str(_money(boq_agg["total_amount"])),
        "boq_certified_total": str(_money(boq_agg["total_certified"])),
        "boq_by_state": boq_by_state,
        "advance_payments_total": str(total_advance),
        "advance_payments_recovered": str(total_recovered),
        "advance_payments_outstanding": str(advance_outstanding),
        "drawdown_eligibility": drawdown_eligibility,
    })


SECTION_ALIASES = {
    "preliminaries": ["preliminaries", "preliminary", "site establishment", "general requirement"],
    "substructure": ["substructure", "sub-structure", "sub structure", "foundation", "ground work"],
    "superstructure": ["superstructure", "super-structure", "super structure", "structural", "frame"],
    "finishes": ["finishes", "finishing", "finish"],
    "mep": ["mep", "mechanical", "electrical", "plumbing", "hvac", "mechanical electrical plumbing"],
    "external": ["external", "external works", "site works", "drainage"],
}


def _normalize_section_name(name):
    """Map a raw section label through the alias table so BoQ sections and
    work-programme levels share the same keys (remote code compared raw BoQ
    labels against normalized task sections and silently mismatched)."""
    lowered = str(name or "").lower().strip()
    for section, aliases in SECTION_ALIASES.items():
        if lowered and any(alias in lowered for alias in aliases):
            return section
    return lowered or "general"


def _match_section(task):
    levels = [str(getattr(task, f"level{i}_name", "") or "").lower().strip() for i in range(1, 7)]
    for section, aliases in SECTION_ALIASES.items():
        for level_name in levels:
            if level_name and any(alias in level_name for alias in aliases):
                return section
    return "general"


@extend_schema(request=None, responses={200: {"type": "object"}}, parameters=[OpenApiParameter("project_id", OpenApiTypes.STR, OpenApiParameter.PATH)])
@api_view(["GET"])
@permission_classes([ConstructionSubscription])
def cash_flow_forecast(request, project_id):
    """Monthly planned-vs-actual cash flow spread from the approved work
    programme and approved BoQ sections."""
    organization = get_active_organization(request)
    project = _scoped_project(organization, project_id)
    if not project:
        return Response({"detail": "Project not found."}, status=404)

    tasks = list(WorkPlanTask.objects.filter(
        project=project, organization=organization, approval_status="approved",
        start_date__isnull=False, end_date__isnull=False,
    ).order_by("start_date"))
    boq_items = BoQItem.objects.filter(
        project=project, organization=organization, approval_status="approved",
    )
    if not tasks:
        return Response({
            "project_id": str(project.id),
            "months": [],
            "total_planned": "0.00", "total_actual": "0.00",
            "remaining": "0.00", "forecast_completion": None,
        })

    boq_by_section: dict = defaultdict(Decimal)
    actual_by_section: dict = defaultdict(Decimal)
    for item in boq_items:
        key = _normalize_section_name(item.section)
        boq_by_section[key] += item.amount or Decimal(0)
        actual_by_section[key] += (item.executed_quantity or Decimal(0)) * (item.rate or Decimal(0))

    section_task_count: dict = defaultdict(int)
    for task in tasks:
        section_task_count[_match_section(task)] += 1

    task_shares = []
    for task in tasks:
        section = _match_section(task)
        count = section_task_count.get(section, 1)
        task_shares.append({
            "task": task,
            "value": (boq_by_section.get(section, Decimal(0)) / count) if count else Decimal(0),
            "actual": (actual_by_section.get(section, Decimal(0)) / count) if count else Decimal(0),
        })

    months = []
    cur = date(tasks[0].start_date.year, tasks[0].start_date.month, 1)
    last = tasks[-1].end_date
    end = date(last.year, last.month, 1)
    cum_planned = Decimal(0)
    cum_actual = Decimal(0)
    while cur <= end:
        _, last_day = monthrange(cur.year, cur.month)
        month_end = date(cur.year, cur.month, last_day)
        planned = Decimal(0)
        actual = Decimal(0)
        active_count = 0
        for share in task_shares:
            task = share["task"]
            if task.end_date < cur or task.start_date > month_end:
                continue
            active_count += 1
            task_months = max(1, (task.end_date.year - task.start_date.year) * 12
                              + task.end_date.month - task.start_date.month + 1)
            planned += share["value"] / task_months
            actual += share["actual"] / task_months
        planned = planned.quantize(CENT)
        actual = actual.quantize(CENT)
        cum_planned += planned
        cum_actual += actual
        months.append({
            "month": cur.strftime("%Y-%m"),
            "planned": str(planned),
            "actual": str(actual),
            "cumulative_planned": str(cum_planned.quantize(CENT)),
            "cumulative_actual": str(cum_actual.quantize(CENT)),
            "task_count": active_count,
        })
        cur = date(cur.year + 1, 1, 1) if cur.month == 12 else date(cur.year, cur.month + 1, 1)

    total_planned = cum_planned.quantize(CENT)
    total_actual = cum_actual.quantize(CENT)
    return Response({
        "project_id": str(project.id),
        "months": months,
        "total_planned": str(total_planned),
        "total_actual": str(total_actual),
        "remaining": str((total_planned - total_actual).quantize(CENT)),
        "forecast_completion": months[-1]["month"] if months else None,
    })
