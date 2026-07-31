from decimal import Decimal
from time import time

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from organizations.models import Organization
from properties.models import Project as PortfolioProject

from construction.models import (
    AdminAuditLog, AdvancePayment, BimDiscrepancy, BimModel, BoQItem, Certificate, ChatMessage,
    ConsultantPayment, ContingencyDrawdown, DailyLog, Disbursement,
    DrawdownRequest, DroneDataset, LifecycleRecord, MaterialDelivery,
    MilestoneEntry, Notification, Project, ProvisionalSum, Requisition, Risk,
    SatelliteDataset, Subcontractor, Ticket, Variation, WorkOrder, WorkPlanTask,
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
        LifecycleRecord.objects.update_or_create(
            project=project, reference="PC-INS-014",
            defaults={
                "organization": organization, "stage": "practical_completion",
                "record_type": "inspection", "title": "Practical completion inspection",
                "description": "Joint inspection and close-out of the outstanding snag list.",
                "status": "under_review", "responsible_party": "Project manager",
                "authority": "Lead consultant", "due_date": timezone.localdate() + timezone.timedelta(days=21),
                "created_by": user, "created_at": now_ms - 86400000, "updated_at": now_ms,
            },
        )
        MaterialDelivery.objects.update_or_create(
            organization=organization, project_id=project.id, delivery_date=str(timezone.localdate()), material="Fire-rated sealant",
            defaults={"quantity": Decimal("240"), "unit": "cartridges", "supplier": "Nairobi Fire Systems", "remarks": "Batch certificates verified", "received_by": user, "created_at": now_ms},
        )
        ConsultantPayment.objects.update_or_create(
            project=project, certificate_number="CONS-IPC-006",
            defaults={"organization": organization, "consultant_name": "Vertex Cost Consultants", "consultant_role": "qs", "approved_fee": Decimal("12500000"), "amount": Decimal("875000"), "retention_percent": Decimal("0"), "status": "approved", "approved_by": user, "created_at": now_ms - 172800000, "updated_at": now_ms},
        )
        DroneDataset.objects.update_or_create(
            project=project, flight_date=str(timezone.localdate() - timezone.timedelta(days=2)), data_type="orthomosaic",
            defaults={"organization": organization, "operator_id": "KCAA-OPS-118", "classification": "verification", "external_url": "https://example.invalid/construction/drone/orthomosaic", "compliance_declared": True, "milestone_id": "ce-ms-foundations-001", "uploaded_by": user, "uploaded_at": now_ms - 172800000, "review_status": "reviewed", "reviewed_by": user, "reviewed_at": now_ms - 86400000},
        )
        SatelliteDataset.objects.update_or_create(
            project=project, capture_date=str(timezone.localdate() - timezone.timedelta(days=7)), sat_type="optical",
            defaults={"organization": organization, "resolution_cm": 30, "cloud_cover_pct": 4.5, "source_provider": "Commercial imagery provider", "license_type": "project", "milestone_id": "ce-ms-foundations-001", "notes": "Independent progress verification", "uploaded_by": user, "uploaded_at": now_ms - 604800000},
        )
        ProvisionalSum.objects.update_or_create(
            project=project, item_number="PS-04",
            defaults={"organization": organization, "description": "Tenant wayfinding and statutory signage", "budgeted_amount": Decimal("4500000"), "ascertained_amount": Decimal("3850000"), "status": "ascertained", "created_at": now_ms - 604800000, "updated_at": now_ms},
        )
        ContingencyDrawdown.objects.update_or_create(
            project=project, drawdown_number="CD-003",
            defaults={"organization": organization, "reason": "Uncharted services discovered above Level 6 ceiling", "category": "unforeseen", "amount": Decimal("1200000"), "status": "approved", "approved_by": user, "approved_at": now_ms - 86400000, "created_at": now_ms - 259200000, "updated_at": now_ms},
        )
        AdvancePayment.objects.update_or_create(
            project=project, contractor_name="Apex Refurbishment Ltd",
            defaults={"organization": organization, "amount": Decimal("18500000"), "recovery_rate": Decimal("10"), "recovered_amount": Decimal("9250000"), "status": "active", "notes": "Mobilisation advance secured by guarantee", "created_at": now_ms - 10368000000, "updated_at": now_ms},
        )
        subcontractor, _ = Subcontractor.objects.update_or_create(
            project=project, name="SafeSeal Contractors",
            defaults={"organization": organization, "contact_person": "M. Kamau", "email": "projects@safeseal.example", "phone": "+254700000000", "created_at": now_ms - 604800000},
        )
        WorkOrder.objects.update_or_create(
            project=project, order_number="WO-019",
            defaults={"organization": organization, "subcontractor": subcontractor, "boq_section": "Fire protection", "description": "Fire stopping to refurbished service risers", "unit_rate": Decimal("4250"), "quantity_cap": Decimal("640"), "total_value": Decimal("2720000"), "status": "issued", "issued_date": str(timezone.localdate() - timezone.timedelta(days=14)), "certified_quantity": Decimal("220"), "certified_value": Decimal("935000"), "created_by": user, "created_at": now_ms - 1209600000, "updated_at": now_ms},
        )
        bim, _ = BimModel.objects.update_or_create(
            id="ce-bim-model-001",
            defaults={"organization": organization, "project": project, "name": "Tower A coordinated services", "discipline": "mep", "file_format": "ifc", "version": "C07", "is_current": True, "uploaded_by": user, "uploaded_at": now_ms - 259200000, "processing_status": "completed", "element_count": 18420, "created_at": now_ms - 259200000, "updated_at": now_ms},
        )
        BimDiscrepancy.objects.update_or_create(
            id="ce-bim-disc-001",
            defaults={"organization": organization, "project": project, "bim_model": bim, "milestone_entry_id": "ce-ms-foundations-001", "milestone_ref": "Structural strengthening", "description": "Smoke extract duct conflicts with strengthened transfer beam zone.", "severity": "high", "status": "open", "confidence_score": 94, "created_at": now_ms - 86400000, "updated_at": now_ms},
        )
        Requisition.objects.update_or_create(
            organization=organization, project_id=project.id, title="Level 6 fire stopping materials",
            defaults={"description": "Procurement against approved work order WO-019", "amount": Decimal("1450000"), "status": "approved", "raised_by": user, "reviewed_by": user, "approved_by": user, "created_at": now_ms - 259200000, "updated_at": now_ms},
        )
        certificate, _ = Certificate.objects.update_or_create(
            organization=organization, project_id=project.id, number="IPC-011",
            defaults={"cert_type": "interim", "contractor_name": "Apex Refurbishment Ltd", "amount": Decimal("14250000"), "retention_percent": Decimal("5"), "milestone_entry_id": "ce-ms-foundations-001", "issued_by": user, "issued_at": now_ms - 172800000, "status": "issued", "previous_certified": Decimal("72600000"), "current_gross": Decimal("14250000"), "variations_amount": Decimal("2750000"), "advance_recovery": Decimal("1425000"), "retention_amount": Decimal("712500"), "net_payable": Decimal("14862500")},
        )
        Disbursement.objects.update_or_create(
            organization=organization, project_id=project.id, certificate=certificate,
            defaults={"amount": Decimal("14862500"), "status": "paid", "managed_by": user, "created_at": now_ms - 86400000, "paid_at": now_ms - 43200000},
        )
        DrawdownRequest.objects.update_or_create(
            organization=organization, project_id=project.id, request_number="DD-009",
            defaults={"amount": Decimal("14862500"), "purpose": "IPC-011 certified construction works", "status": "disbursed", "valuation_amount": Decimal("14862500"), "reviewer_notes": "Documents and valuation verified", "requested_by": user, "reviewed_by": user, "created_at": now_ms - 259200000, "updated_at": now_ms, "approved_at": now_ms - 172800000, "disbursed_at": now_ms - 43200000},
        )
        ChatMessage.objects.update_or_create(
            id="ce-chat-001",
            defaults={"organization": organization, "project": project, "sender": user, "channel": "site-team", "body": "Level 6 fire-stopping inspection confirmed for 10:00 tomorrow.", "created_at": now_ms - 3600000},
        )
        Notification.objects.update_or_create(
            id="ce-notification-001",
            defaults={"organization": organization, "recipient": user, "title": "IPC-011 disbursed", "body": "The certified amount has been paid and posted to the project cost report.", "type": "system", "link": "/monitoring", "created_at": now_ms - 1800000},
        )
        AdminAuditLog.objects.update_or_create(
            id="ce-audit-finance-001",
            defaults={"organization": organization, "timestamp": now_ms - 172800000, "user": user, "user_role": "Administrator", "action": "Issued interim payment certificate IPC-011", "category": "certificates", "resource": "Certificate", "resource_id": str(certificate.id), "details": {"net_payable": "14862500.00"}, "outcome": "success"},
        )
        self.stdout.write(self.style.SUCCESS(f"Seeded construction data for {organization.name}."))
