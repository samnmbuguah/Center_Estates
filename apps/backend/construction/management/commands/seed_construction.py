from decimal import Decimal
from time import time

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from organizations.models import Organization
from properties.models import Project as PortfolioProject

from construction.models import (
    BoQItem, DailyLog, MilestoneEntry, Project, Risk, Ticket, Variation,
    WorkPlanTask,
)


class Command(BaseCommand):
    help = "Create idempotent organization-scoped construction monitoring demo data."

    def handle(self, *args, **options):
        organization = Organization.objects.filter(slug="center-estates-demo").first()
        user = get_user_model().objects.filter(username="admin").first()
        portfolio_project = PortfolioProject.objects.filter(
            organization=organization, code="CE-REFURB-01"
        ).first()
        if not organization or not user or not portfolio_project:
            raise CommandError("Run seed_platform before seed_construction.")

        now_ms = int(time() * 1000)
        project, _ = Project.objects.update_or_create(
            id="ce-construction-001",
            defaults={
                "organization": organization,
                "portfolio_project": portfolio_project,
                "name": "Tower A Refurbishment",
                "code": "CE-REFURB-01",
                "client_name": "Center Estates",
                "location": "Westlands, Nairobi",
                "country": "Kenya",
                "county": "Nairobi",
                "town": "Westlands",
                "stage": "active",
                "project_type": "commercial",
                "description": "Occupied commercial tower refurbishment and services upgrade.",
                "modules": ["progress_tracking", "financials", "quality", "full_package"],
                "onboarding_complete": True,
                "wizard_step": 8,
                "created_at": now_ms,
                "planned_start_date": timezone.localdate() - timezone.timedelta(days=120),
                "planned_completion_date": timezone.localdate() + timezone.timedelta(days=210),
                "tender_amount": Decimal("185000000.00"),
                "budget": Decimal("192500000.00"),
                "approved_variations": Decimal("2750000.00"),
                "site_latitude": -1.2676,
                "site_longitude": 36.8108,
                "geofence_radius_m": 250,
            },
        )
        MilestoneEntry.objects.update_or_create(
            id="ce-ms-foundations-001",
            defaults={
                "organization": organization, "project_id": project.id,
                "milestone_id": "Structural strengthening", "percent_complete": 82,
                "submitted_at": now_ms - 86400000, "created_at": now_ms - 86400000,
                "updated_at": now_ms, "required_evidence_types": ["photo", "document"],
                "required_certifying_role": "project_manager", "payment_value": Decimal("18500000"),
            },
        )
        DailyLog.objects.update_or_create(
            organization=organization, project_id=project.id,
            log_date=str(timezone.localdate()),
            defaults={
                "weather": "Clear AM, light showers PM", "labour_count": 46,
                "notes": "Level 6 strengthening and MEP riser works progressed safely.",
                "details": {"plant": ["mobile crane", "concrete mixer"], "visitors": 3},
                "author": user, "created_at": now_ms,
            },
        )
        Risk.objects.update_or_create(
            organization=organization, project_id=project.id, reference="RSK-026",
            defaults={
                "description": "Long-lead switchgear may affect energisation milestone.",
                "category": "Procurement", "owner": user, "likelihood": 4, "impact": 5,
                "status": "in_progress", "mitigation": "Approve equivalent supplier and expedite factory inspection.",
                "next_review": timezone.localdate() + timezone.timedelta(days=4),
                "created_by": user, "created_at": now_ms - 172800000, "updated_at": now_ms,
            },
        )
        Ticket.objects.update_or_create(
            organization=organization, project_id=project.id,
            title="Fire stopping incomplete at Level 6 riser",
            defaults={
                "body": "Install approved fire stopping system before services inspection.",
                "priority": "high", "status": "open", "risk_level": "high",
                "sensitivity": "urgent", "due_date": str(timezone.localdate() + timezone.timedelta(days=3)),
                "raised_by": user, "assigned_to": user, "created_at": now_ms - 43200000,
                "updated_at": now_ms,
            },
        )
        WorkPlanTask.objects.update_or_create(
            project=project, task_id="WP-4.2.1",
            defaults={
                "organization": organization, "task_name": "Level 6 structural strengthening",
                "wbs_level": 3, "level1_name": "Construction", "level2_name": "Structure",
                "start_date": timezone.localdate() - timezone.timedelta(days=35),
                "end_date": timezone.localdate() + timezone.timedelta(days=8),
                "duration_days": 43, "responsible_party": "Main contractor",
                "percent_complete": Decimal("82.00"), "status": "in_progress",
                "approval_status": "approved", "approved_by": user, "approved_at": now_ms - 86400000,
            },
        )
        BoQItem.objects.update_or_create(
            project=project, section="Structural works", item_number="4.2.1",
            defaults={
                "organization": organization, "description": "Carbon-fibre strengthening to beams",
                "unit": "m2", "quantity": Decimal("840"), "rate": Decimal("18500"),
                "amount": Decimal("15540000"), "approval_status": "approved",
                "cost_state": "committed", "executed_quantity": Decimal("688.8"),
                "certified_quantity": Decimal("630"), "certified_amount": Decimal("11655000"),
                "progress_updated_at": now_ms, "progress_updated_by": user,
            },
        )
        Variation.objects.update_or_create(
            project=project, variation_number="VO-007",
            defaults={
                "organization": organization,
                "description": "Additional smoke extraction controls requested by fire consultant.",
                "variation_type": "addition", "target": "boq", "amount": Decimal("2750000"),
                "status": "approved", "justification": "Authority review requirement",
                "approved_by": user, "approved_at": now_ms - 259200000,
                "created_at": now_ms - 604800000, "updated_at": now_ms,
            },
        )
        self.stdout.write(self.style.SUCCESS(f"Seeded construction data for {organization.name}."))
