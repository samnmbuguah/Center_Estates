from decimal import Decimal
from time import time

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken
from django.core.files.uploadedfile import SimpleUploadedFile
from tempfile import TemporaryDirectory

from core.models import Module
from organizations.models import Membership, Organization, Role
from properties.models import Project as PortfolioProject
from subscriptions.models import Subscription

from .models import (
    AdvancePayment, AdvanceRecovery, BoQItem, Certificate, ChatMessage, ContingencyDrawdown, Disbursement,
    DocumentVersion, DrawdownRequest, EvidenceFile, MaterialDelivery, MilestoneBoQItem,
    MilestoneEntry, MilestoneVerification, Notification, Project, ProjectApproval, ProjectDocument,
    ProjectMembership, ProvisionalSum, PurchaseOrder, RequirementWaiver, Requisition, Risk, StockMovement, StoreItem,
    StoreSupplier, SubmissionRecord, Ticket, TicketComment, Variation, MaterialRequisition,
)
from .valuation import calculate_milestone_valuation


@override_settings(ALLOWED_HOSTS=["testserver"], DEBUG=True, SECURE_SSL_REDIRECT=False)
class ConstructionApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="monitor", password="test")
        self.organization = Organization.objects.create(name="Builder", slug="builder")
        self.other = Organization.objects.create(name="Other Builder", slug="other-builder")
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True, is_organization_admin=True)
        Subscription.objects.create(
            organization=self.organization, module=Module.MONITORING,
            status=Subscription.Status.ACTIVE,
        )
        portfolio = PortfolioProject.objects.create(
            organization=self.organization, code="P1", name="Project One"
        )
        self.other_portfolio = PortfolioProject.objects.create(
            organization=self.other, code="P2", name="Hidden Project"
        )
        self.project = Project.objects.create(
            id="construction-project-1", organization=self.organization,
            portfolio_project=portfolio, name="Project One", code="P1", stage="active",
            created_at=int(time() * 1000), budget=Decimal("5000000"),
            site_latitude=-1.2676, site_longitude=36.8108, geofence_radius_m=250,
        )
        now = int(time() * 1000)
        Risk.objects.create(
            organization=self.organization, project_id=self.project.id,
            reference="R1", description="Critical supply risk", likelihood=5, impact=4,
            created_by=self.user, created_at=now, updated_at=now,
        )
        Ticket.objects.create(
            organization=self.organization, project_id=self.project.id,
            title="Open defect", raised_by=self.user, created_at=now, updated_at=now,
        )
        Variation.objects.create(
            organization=self.organization, project=self.project, variation_number="V1",
            description="Approved addition", amount=Decimal("250000"), status="approved",
            created_at=now, updated_at=now,
        )
        self.milestone = MilestoneEntry.objects.create(
            id="milestone-1", organization=self.organization, project_id=self.project.id,
            milestone_id="Structure", percent_complete=80, submitted_at=now,
            created_at=now, updated_at=now,
        )
        self.certificate = Certificate.objects.create(
            organization=self.organization, project_id=self.project.id,
            number="IPC-001", contractor_name="Main Contractor",
            amount=Decimal("1000000"), net_payable=Decimal("900000"),
            issued_by=self.user, issued_at=now,
        )
        Disbursement.objects.create(
            organization=self.organization, project_id=self.project.id,
            certificate=self.certificate, amount=Decimal("900000"), status="paid",
            managed_by=self.user, created_at=now, paid_at=now,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.headers = {"HTTP_X_ORGANIZATION_ID": str(self.organization.id)}

    def mobile_client(self):
        token = AccessToken.for_user(self.user)
        token["client_kind"] = "mobile"
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client

    def test_dashboard_is_calculated_from_scoped_live_data(self):
        response = self.client.get("/api/v1/construction/dashboard/", **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["kpis"]["activeProjects"], 1)
        self.assertEqual(response.data["kpis"]["openTickets"], 1)
        self.assertEqual(response.data["kpis"]["highRisks"], 1)
        self.assertEqual(Decimal(response.data["kpis"]["approvedVariations"]), Decimal("250000"))
        self.assertEqual(Decimal(response.data["kpis"]["certifiedValue"]), Decimal("900000"))
        self.assertEqual(Decimal(response.data["kpis"]["paidValue"]), Decimal("900000"))
        self.assertEqual(response.data["kpis"]["budgetUtilization"], 18.0)

    def test_cost_dashboard_aggregates_commercial_position(self):
        now = int(time() * 1000)
        Variation.objects.create(
            organization=self.organization, project=self.project, variation_number="V2",
            description="Omitted finishes", variation_type="omission", amount=Decimal("50000"),
            status="approved", created_at=now, updated_at=now,
        )
        ProvisionalSum.objects.create(
            organization=self.organization, project=self.project, item_number="PS-1",
            description="PC sum", budgeted_amount=Decimal("200000"), ascertained_amount=Decimal("150000"),
            status="ascertained", created_at=now, updated_at=now,
        )
        ContingencyDrawdown.objects.create(
            organization=self.organization, project=self.project, drawdown_number="CD-1",
            reason="Unforeseen rock", amount=Decimal("100000"), status="approved",
            created_at=now, updated_at=now,
        )
        AdvancePayment.objects.create(
            organization=self.organization, project=self.project, contractor_name="Main Contractor",
            amount=Decimal("1000000"), recovered_amount=Decimal("200000"), status="paid",
            created_at=now, updated_at=now,
        )
        BoQItem.objects.create(
            organization=self.organization, project=self.project, section="Substructure",
            item_number="1.1", description="Excavation", quantity=Decimal("100"), rate=Decimal("30000"),
            amount=Decimal("3000000"), approval_status="approved", cost_state="budgeted",
        )
        BoQItem.objects.create(
            organization=self.organization, project=self.project, section="Superstructure",
            item_number="2.1", description="Frame", quantity=Decimal("50"), rate=Decimal("40000"),
            amount=Decimal("2000000"), approval_status="approved", cost_state="certified",
            certified_amount=Decimal("1500000"),
        )
        response = self.client.get(
            f"/api/v1/construction/projects/{self.project.id}/cost-dashboard", **self.headers,
        )
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        self.assertEqual(Decimal(data["budget"]), Decimal("5000000.00"))
        self.assertEqual(data["budget_source"], "project")
        self.assertEqual(Decimal(data["approved_variations"]), Decimal("200000.00"))
        self.assertEqual(Decimal(data["provisional_sums_budget"]), Decimal("200000.00"))
        self.assertEqual(Decimal(data["provisional_sums_ascertained"]), Decimal("150000.00"))
        self.assertEqual(Decimal(data["contingency_drawn"]), Decimal("100000.00"))
        self.assertEqual(Decimal(data["forecast_final_cost"]), Decimal("5300000.00"))
        self.assertEqual(Decimal(data["cost_variance"]), Decimal("300000.00"))
        self.assertEqual(Decimal(data["certified_to_date"]), Decimal("1000000.00"))
        self.assertEqual(Decimal(data["paid_to_date"]), Decimal("900000.00"))
        self.assertEqual(Decimal(data["advance_payments_outstanding"]), Decimal("800000.00"))
        self.assertEqual(Decimal(data["boq_total"]), Decimal("5000000.00"))
        self.assertEqual(data["boq_by_state"]["certified"]["total"], "2000000.00")
        self.assertEqual(data["boq_by_state"]["certified"]["certified_amount"], "1500000.00")
        self.assertEqual(Decimal(data["drawdown_eligibility"]["available"]), Decimal("150000.00"))

    def test_cash_flow_forecast_spreads_programme_months(self):
        import datetime
        WorkPlanTask = __import__("construction.models", fromlist=["WorkPlanTask"]).WorkPlanTask
        BoQItem.objects.create(
            organization=self.organization, project=self.project, section="Substructure works",
            item_number="1.1", description="Excavation", quantity=Decimal("10"), rate=Decimal("20000"),
            amount=Decimal("200000"), approval_status="approved", cost_state="budgeted",
        )
        BoQItem.objects.create(
            organization=self.organization, project=self.project, section="Superstructure frame",
            item_number="2.1", description="Frame", quantity=Decimal("10"), rate=Decimal("40000"),
            amount=Decimal("400000"), approval_status="approved", cost_state="budgeted",
        )
        WorkPlanTask.objects.create(
            organization=self.organization, project=self.project, task_id="T-1", task_name="Foundations",
            wbs_level=1, level1_name="Substructure works", start_date=datetime.date(2026, 1, 1),
            end_date=datetime.date(2026, 2, 28), duration_days=59, percent_complete=Decimal("0"),
            approval_status="approved",
        )
        WorkPlanTask.objects.create(
            organization=self.organization, project=self.project, task_id="T-2", task_name="Frame",
            wbs_level=1, level1_name="Superstructure frame", start_date=datetime.date(2026, 2, 1),
            end_date=datetime.date(2026, 3, 31), duration_days=59, percent_complete=Decimal("0"),
            approval_status="approved",
        )
        response = self.client.get(
            f"/api/v1/construction/projects/{self.project.id}/cash-flow-forecast", **self.headers,
        )
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        self.assertEqual([m["month"] for m in data["months"]], ["2026-01", "2026-02", "2026-03"])
        self.assertEqual(Decimal(data["months"][0]["planned"]), Decimal("100000.00"))
        self.assertEqual(Decimal(data["months"][1]["planned"]), Decimal("300000.00"))
        self.assertEqual(Decimal(data["total_planned"]), Decimal("600000.00"))
        self.assertEqual(Decimal(data["total_actual"]), Decimal("0.00"))
        self.assertEqual(data["forecast_completion"], "2026-03")

    def test_project_query_filters_charfield_and_fk_registers(self):
        other_portfolio = PortfolioProject.objects.create(
            organization=self.organization, code="P2-PORT", name="Project Two Portfolio",
        )
        other_project = Project.objects.create(
            id="construction-project-2", organization=self.organization,
            portfolio_project=other_portfolio, name="Project Two", code="P2",
            stage="planning", created_at=int(time() * 1000), budget=Decimal("1000000"),
        )
        now = int(time() * 1000)
        Ticket.objects.create(
            organization=self.organization, project_id=other_project.id,
            title="Other project issue", raised_by=self.user, created_at=now, updated_at=now,
        )
        scoped = self.client.get(
            f"/api/v1/construction/tickets/?project={self.project.id}", **self.headers,
        )
        self.assertEqual(scoped.status_code, 200)
        self.assertEqual(len(scoped.data), 1)
        self.assertEqual(scoped.data[0]["title"], "Open defect")
        variations = self.client.get(
            f"/api/v1/construction/variations/?project={self.project.id}", **self.headers,
        )
        self.assertEqual(variations.status_code, 200)
        self.assertEqual(len(variations.data), 1)

    def test_project_workspace_and_scurve_endpoints(self):
        workspace = self.client.get(
            f"/api/v1/construction/projects/{self.project.id}/workspace/", **self.headers,
        )
        self.assertEqual(workspace.status_code, 200, workspace.data)
        self.assertEqual(workspace.data["project"]["code"], "P1")
        self.assertIn("scurve", workspace.data)
        self.assertGreaterEqual(workspace.data["kpis"]["milestones"], 1)
        scurve = self.client.get(
            f"/api/v1/construction/reports/scurve/{self.project.id}/", **self.headers,
        )
        self.assertEqual(scurve.status_code, 200, scurve.data)
        self.assertIn("series", scurve.data)

    def test_issued_certificate_can_only_be_voided_with_a_reason(self):
        url = f"/api/v1/construction/certificates/{self.certificate.id}/"
        edit = self.client.patch(url, {"amount": "2000000"}, format="json", **self.headers)
        self.assertEqual(edit.status_code, 400)
        missing_reason = self.client.patch(url, {"status": "void"}, format="json", **self.headers)
        self.assertEqual(missing_reason.status_code, 400)
        voided = self.client.patch(
            url, {"status": "void", "void_reason": "Superseded by corrected IPC"},
            format="json", **self.headers,
        )
        self.assertEqual(voided.status_code, 200, voided.data)
        self.certificate.refresh_from_db()
        self.assertEqual(self.certificate.voided_by, self.user)
        self.assertIsNotNone(self.certificate.voided_at)
        self.assertEqual(self.client.delete(url, **self.headers).status_code, 400)

    def test_project_report_aggregates_scoped_field_and_finance_data(self):
        MaterialDelivery.objects.create(
            organization=self.organization, project_id=self.project.id,
            delivery_date="2026-07-31", material="Cement", quantity=20,
            received_by=self.user, created_at=int(time() * 1000),
        )
        response = self.client.get(
            f"/api/v1/construction/reports/{self.project.id}/", **self.headers,
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["project"]["code"], "P1")
        self.assertEqual(response.data["cost"]["paidToDate"], Decimal("900000"))
        self.assertEqual(sum(row["materialDeliveries"] for row in response.data["weekly"]), 1)

    def test_weekly_monthly_and_csv_reports_are_dynamic_and_tenant_scoped(self):
        BoQItem.objects.create(
            organization=self.organization, project=self.project, section="Electrical",
            item_number="E-01", description="Access control", quantity=2, rate=Decimal("50000"),
            amount=Decimal("100000"),
        )
        weekly = self.client.get(f"/api/v1/construction/reports/weekly/?project={self.project.id}", **self.headers)
        self.assertEqual(weekly.status_code, 200, weekly.data)
        self.assertEqual(weekly.data["project"]["code"], "P1")
        monthly = self.client.get(f"/api/v1/construction/reports/monthly/?project={self.project.id}&year=2026&month=8", **self.headers)
        self.assertEqual(monthly.status_code, 200, monthly.data)
        self.assertEqual(monthly.data["period"], {"year": 2026, "month": 8})
        boq = self.client.get(f"/api/v1/construction/exports/boq/{self.project.id}.csv", **self.headers)
        self.assertEqual(boq.status_code, 200)
        self.assertIn(b"Access control", boq.content)
        self.assertIn("attachment", boq["Content-Disposition"])
        cost = self.client.get(f"/api/v1/construction/exports/cost/{self.project.id}.csv", **self.headers)
        self.assertIn(b"Approved variations", cost.content)
        milestones = self.client.get(f"/api/v1/construction/exports/milestones/{self.project.id}.csv", **self.headers)
        self.assertIn(b"Structure", milestones.content)
        self.assertEqual(self.client.get(f"/api/v1/construction/exports/boq/construction-project-2.csv", **self.headers).status_code, 404)

    def test_chat_is_scoped_to_participants_and_organization(self):
        hidden_user = get_user_model().objects.create_user(username="hidden")
        ChatMessage.objects.create(
            organization=self.organization, project=self.project,
            sender=hidden_user, body="Not addressed to monitor", created_at=1,
        )
        posted = self.client.post("/api/v1/construction/chat/", {
            "project": self.project.id, "channel": "site-team", "body": "Inspection at 10:00",
        }, format="json", **self.headers)
        self.assertEqual(posted.status_code, 201, posted.data)
        response = self.client.get("/api/v1/construction/chat/", **self.headers)
        self.assertEqual([item["body"] for item in response.data], ["Inspection at 10:00"])

    def test_chat_and_notification_unread_counters_are_recipient_scoped(self):
        sender = get_user_model().objects.create_user(username="engineer")
        message = ChatMessage.objects.create(
            organization=self.organization, project=self.project, sender=sender,
            recipient=self.user, body="Please review RFI 12", created_at=2,
        )
        Notification.objects.create(organization=self.organization, recipient=self.user, title="RFI review", created_at=2)
        chat_count = self.client.get("/api/v1/construction/chat/unread-count/", **self.headers)
        self.assertEqual(chat_count.data["count"], 1)
        marked = self.client.post(f"/api/v1/construction/chat/{message.id}/mark-read/", {}, format="json", **self.headers)
        self.assertEqual(marked.status_code, 200, marked.data)
        self.assertEqual(self.client.get("/api/v1/construction/chat/unread-count/", **self.headers).data["count"], 0)
        self.assertEqual(self.client.get("/api/v1/construction/notifications/unread-count/", **self.headers).data["count"], 1)

    def test_project_register_is_organization_scoped(self):
        Project.objects.create(
            id="construction-project-2", organization=self.other,
            portfolio_project=self.other_portfolio, name="Hidden Project", code="P2", created_at=1,
        )
        response = self.client.get("/api/v1/construction/projects/", **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["code"] for row in response.data], ["P1"])

    def test_foreign_portfolio_project_is_rejected(self):
        response = self.client.post("/api/v1/construction/projects/", {
            "id": "construction-project-3", "portfolio_project": str(self.other_portfolio.id),
            "name": "Cross-organization", "code": "BAD", "stage": "planning", "created_at": 1,
        }, format="json", **self.headers)
        self.assertEqual(response.status_code, 400)

    def test_submitted_mobile_evidence_is_immutable(self):
        response = self.mobile_client().patch(
            f"/api/v1/construction/milestones/{self.milestone.id}/",
            {"percent_complete": 90}, format="json", **self.headers,
        )
        self.assertEqual(response.status_code, 400)
        self.milestone.refresh_from_db()
        self.assertEqual(self.milestone.percent_complete, 80)

    def test_mobile_authoritative_record_rejects_desktop_write(self):
        token = AccessToken.for_user(self.user)
        token["client_kind"] = "desktop"
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.patch(
            f"/api/v1/construction/milestones/{self.milestone.id}/",
            {"percent_complete": 90}, format="json", **self.headers,
        )
        self.assertEqual(response.status_code, 400)

    def test_subscription_is_required(self):
        Subscription.objects.filter(organization=self.organization, module=Module.MONITORING).update(is_active=False)
        self.assertEqual(self.client.get("/api/v1/construction/dashboard/", **self.headers).status_code, 403)

    def test_mobile_sync_seals_and_geofences_submitted_evidence(self):
        mobile = self.mobile_client()
        timestamp = int(time() * 1000)
        response = mobile.post("/api/v1/construction/sync/push", {"changes": {
            "milestone_entries": {"created": [{
                "id": "mobile-ms-1", "project_id": self.project.id,
                "milestone_id": "MEP first fix", "percent_complete": 64,
                "submitted_at": timestamp,
            }]},
            "evidence_files": {"created": [{
                "id": "mobile-ev-1", "milestone_entry_id": "mobile-ms-1",
                "media_type": "photo", "remote_url": "/media/evidence/demo.jpg",
                "hash": "a" * 64, "latitude": -1.2676, "longitude": 36.8108,
                "captured_at": timestamp, "submitted_at": timestamp,
            }]},
        }}, format="json", **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        evidence = EvidenceFile.objects.get(pk="mobile-ev-1")
        self.assertEqual(evidence.geofence_status, "inside")
        seal = SubmissionRecord.objects.get(milestone_entry_id="mobile-ms-1")
        self.assertEqual(seal.evidence_count, 1)
        verify = mobile.get("/api/v1/construction/audit/verify/mobile-ms-1", **self.headers)
        self.assertTrue(verify.data["integrity_valid"])

    def test_sync_pull_is_incremental_and_organization_scoped(self):
        mobile = self.mobile_client()
        response = mobile.get("/api/v1/construction/sync/pull?last_pulled_at=0", **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        milestone_ids = [row["id"] for row in response.data["changes"]["milestone_entries"]["created"]]
        self.assertEqual(milestone_ids, ["milestone-1"])
        self.assertGreater(response.data["timestamp"], 0)

    def test_desktop_token_cannot_push_mobile_authoritative_data(self):
        token = AccessToken.for_user(self.user)
        token["client_kind"] = "desktop"
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.post("/api/v1/construction/sync/push", {"changes": {}}, format="json", **self.headers)
        self.assertEqual(response.status_code, 403)

    def test_media_upload_is_content_hashed_and_idempotent(self):
        mobile = self.mobile_client()
        with TemporaryDirectory() as media_root, self.settings(MEDIA_ROOT=media_root):
            first = mobile.post("/api/v1/construction/media/upload", {
                "file": SimpleUploadedFile("site.jpg", b"verified-site-evidence", content_type="image/jpeg")
            }, format="multipart", **self.headers)
            second = mobile.post("/api/v1/construction/media/upload", {
                "file": SimpleUploadedFile("retry.jpg", b"verified-site-evidence", content_type="image/jpeg")
            }, format="multipart", **self.headers)
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(first.data["hash"], second.data["hash"])
        self.assertEqual(first.data["remote_url"], second.data["remote_url"])

    def test_mobile_token_contains_fail_closed_client_kind(self):
        response = APIClient().post("/api/v1/auth/mobile-token/", {
            "username": self.user.username, "password": "test"
        }, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["client_kind"], "mobile")
        self.assertEqual(AccessToken(response.data["access"])["client_kind"], "mobile")

    def test_purchase_order_receipt_posts_append_only_stock_ledger(self):
        item = StoreItem.objects.create(organization=self.organization, code="CEM-001", name="Cement", unit="bag", created_at=1)
        supplier = StoreSupplier.objects.create(organization=self.organization, name="Build Supply Ltd")
        created = self.client.post("/api/v1/construction/purchase-orders/", {
            "project": self.project.id, "supplier": supplier.id, "number": "PO-001",
            "lines": [{"item": item.id, "quantity": "50", "unit_price": "850"}],
        }, format="json", **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        order = PurchaseOrder.objects.get(number="PO-001")
        received = self.client.post(f"/api/v1/construction/purchase-orders/{order.id}/receive/", {}, format="json", **self.headers)
        self.assertEqual(received.status_code, 200, received.data)
        item.refresh_from_db(); order.refresh_from_db()
        self.assertEqual(item.quantity_on_hand, Decimal("50")); self.assertEqual(order.status, "received")
        movement = StockMovement.objects.get(item=item)
        self.assertEqual(movement.quantity, Decimal("50")); self.assertEqual(movement.reference, "PO-001")
        self.assertEqual(self.client.post(f"/api/v1/construction/purchase-orders/{order.id}/receive/", {}, format="json", **self.headers).status_code, 400)

    def test_stock_issue_prevents_negative_inventory_and_is_tenant_scoped(self):
        item = StoreItem.objects.create(organization=self.organization, code="REB-001", name="Rebar", unit="tonne", quantity_on_hand=Decimal("10"), created_at=1)
        hidden = StoreItem.objects.create(organization=self.other, code="HIDDEN", name="Hidden stock", created_at=1)
        rejected = self.client.post(f"/api/v1/construction/store-items/{item.id}/issue/", {"quantity":"11","project":self.project.id}, format="json", **self.headers)
        self.assertEqual(rejected.status_code, 400)
        accepted = self.client.post(f"/api/v1/construction/store-items/{item.id}/issue/", {"quantity":"4","project":self.project.id,"reference":"SITE-ISSUE-01"}, format="json", **self.headers)
        self.assertEqual(accepted.status_code, 200, accepted.data)
        item.refresh_from_db(); self.assertEqual(item.quantity_on_hand, Decimal("6"))
        listed = self.client.get("/api/v1/construction/store-items/", **self.headers)
        self.assertEqual([row["code"] for row in listed.data], ["REB-001"])
        self.assertFalse(StockMovement.objects.filter(item=hidden).exists())

    def test_material_requisition_workflow_issues_stock_on_fulfilment(self):
        item = StoreItem.objects.create(organization=self.organization, code="CEM-002", name="Cement", unit="bag", quantity_on_hand=Decimal("100"), created_at=1)
        created = self.client.post("/api/v1/construction/material-requisitions/", {
            "project": self.project.id, "reference": "MR-001",
            "lines": [{"item": item.id, "quantity": "30"}],
        }, format="json", **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        requisition = MaterialRequisition.objects.get(reference="MR-001")
        self.assertEqual(requisition.status, "submitted")
        # Cannot fulfil before approval.
        self.assertEqual(self.client.post(f"/api/v1/construction/material-requisitions/{requisition.id}/fulfill/", {}, format="json", **self.headers).status_code, 400)
        approved = self.client.post(f"/api/v1/construction/material-requisitions/{requisition.id}/approve/", {}, format="json", **self.headers)
        self.assertEqual(approved.status_code, 200, approved.data)
        requisition.refresh_from_db(); self.assertEqual(requisition.status, "approved")
        fulfilled = self.client.post(f"/api/v1/construction/material-requisitions/{requisition.id}/fulfill/", {}, format="json", **self.headers)
        self.assertEqual(fulfilled.status_code, 200, fulfilled.data)
        item.refresh_from_db(); requisition.refresh_from_db()
        self.assertEqual(item.quantity_on_hand, Decimal("70"))
        self.assertEqual(requisition.status, "fulfilled")
        movement = StockMovement.objects.get(item=item, movement_type="issue")
        self.assertEqual(movement.quantity, Decimal("-30"))

    def test_material_requisition_fulfilment_blocks_when_stock_short(self):
        item = StoreItem.objects.create(organization=self.organization, code="CEM-003", name="Cement", unit="bag", quantity_on_hand=Decimal("5"), created_at=1)
        self.client.post("/api/v1/construction/material-requisitions/", {
            "project": self.project.id, "reference": "MR-002",
            "lines": [{"item": item.id, "quantity": "20"}],
        }, format="json", **self.headers)
        requisition = MaterialRequisition.objects.get(reference="MR-002")
        self.client.post(f"/api/v1/construction/material-requisitions/{requisition.id}/approve/", {}, format="json", **self.headers)
        blocked = self.client.post(f"/api/v1/construction/material-requisitions/{requisition.id}/fulfill/", {}, format="json", **self.headers)
        self.assertEqual(blocked.status_code, 400)
        item.refresh_from_db(); requisition.refresh_from_db()
        self.assertEqual(item.quantity_on_hand, Decimal("5"))
        self.assertEqual(requisition.status, "approved")

    def test_document_versions_are_append_only_and_tenant_scoped(self):
        document = ProjectDocument.objects.create(organization=self.organization, project=self.project, title="Structural drawings", discipline="Structural", created_at=1)
        created = self.client.post("/api/v1/construction/document-versions/", {
            "document": document.id, "version": 1, "revision_number": "Rev A",
            "remote_url": "/media/docs/structural-rev-a.pdf", "file_format": "pdf",
        }, format="json", **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        version = DocumentVersion.objects.get(document=document)
        self.assertEqual(version.uploaded_by, self.user)
        self.assertEqual(self.client.patch(f"/api/v1/construction/document-versions/{version.id}/", {"revision_number":"Rev B"}, format="json", **self.headers).status_code, 400)
        self.assertEqual(self.client.delete(f"/api/v1/construction/document-versions/{version.id}/", **self.headers).status_code, 400)

    def test_ticket_comment_thread_assigns_author_and_is_immutable(self):
        ticket = Ticket.objects.filter(organization=self.organization).first()
        created = self.client.post("/api/v1/construction/ticket-comments/", {
            "ticket": ticket.id, "body": "Contractor has acknowledged the defect.",
        }, format="json", **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        comment = TicketComment.objects.get(ticket=ticket)
        self.assertEqual(comment.author, self.user)
        self.assertEqual(self.client.patch(f"/api/v1/construction/ticket-comments/{comment.id}/", {"body":"Changed"}, format="json", **self.headers).status_code, 400)

    def test_milestone_verification_requires_seal_and_is_immutable(self):
        url = "/api/v1/construction/milestone-verifications/"
        unsealed = self.client.post(url, {"milestone_entry": self.milestone.id, "decision": "verified"}, format="json", **self.headers)
        self.assertEqual(unsealed.status_code, 400)
        SubmissionRecord.objects.create(
            milestone_entry=self.milestone, integrity_hash="a" * 64,
            evidence_count=0, sealed_at=self.milestone.submitted_at,
        )
        missing_reason = self.client.post(url, {"milestone_entry": self.milestone.id, "decision": "rejected"}, format="json", **self.headers)
        self.assertEqual(missing_reason.status_code, 400)
        created = self.client.post(url, {"milestone_entry": self.milestone.id, "decision": "verified", "signature": "engineer-signature"}, format="json", **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        verification = MilestoneVerification.objects.get(milestone_entry=self.milestone)
        self.assertEqual(verification.verifier, self.user)
        # PATCH and DELETE return 405 (Method Not Allowed) because MilestoneVerificationViewSet
        # now correctly restricts http_method_names to GET/POST only (ISP fix from views refactor).
        # Previously these raised ValidationError(400) inside perform_update/perform_destroy;
        # returning 405 at the routing layer is the correct HTTP semantic.
        self.assertEqual(self.client.patch(f"{url}{verification.id}/", {"note": "Changed"}, format="json", **self.headers).status_code, 405)
        self.assertEqual(self.client.delete(f"{url}{verification.id}/", **self.headers).status_code, 405)

    def test_project_membership_requires_active_organization_member_and_role(self):
        candidate = get_user_model().objects.create_user(username="site-engineer")
        role = Role.objects.create(organization=self.organization, name="Site Engineer", slug="site-engineer")
        url = "/api/v1/construction/project-memberships/"
        rejected = self.client.post(url, {"project": self.project.id, "user": candidate.id, "role": role.id}, format="json", **self.headers)
        self.assertEqual(rejected.status_code, 400)
        Membership.objects.create(user=candidate, organization=self.organization)
        created = self.client.post(url, {"project": self.project.id, "user": candidate.id, "role": role.id, "label": "Resident engineer"}, format="json", **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        assignment = ProjectMembership.objects.get(project=self.project, user=candidate)
        self.assertEqual(assignment.role, role)
        self.assertGreater(assignment.created_at, 0)

    def test_requirement_waiver_is_server_authored_and_immutable(self):
        url = "/api/v1/construction/requirement-waivers/"
        created = self.client.post(url, {
            "project": self.project.id, "requirement_key": "TITLE_DEED",
            "requirement_type": "DOC", "reason": "Client-approved phased submission",
        }, format="json", **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        waiver = RequirementWaiver.objects.get(project=self.project)
        self.assertEqual(waiver.waived_by, self.user)
        self.assertGreater(waiver.waived_at, 0)
        self.assertEqual(self.client.patch(f"{url}{waiver.id}/", {"reason": "Changed"}, format="json", **self.headers).status_code, 400)
        self.assertEqual(self.client.delete(f"{url}{waiver.id}/", **self.headers).status_code, 400)

    def test_approval_decisions_use_controlled_actions(self):
        approval = ProjectApproval.objects.create(
            organization=self.organization, project=self.project,
            approval_type="NCA", authority="National Construction Authority",
        )
        url = f"/api/v1/construction/approvals/{approval.id}/"
        self.assertEqual(self.client.patch(url, {"status": "approved"}, format="json", **self.headers).status_code, 400)
        self.assertEqual(self.client.post(f"{url}reject/", {}, format="json", **self.headers).status_code, 400)
        rejected = self.client.post(f"{url}reject/", {"review_notes": "Permit drawing revision required"}, format="json", **self.headers)
        self.assertEqual(rejected.status_code, 200, rejected.data)
        approval.refresh_from_db()
        self.assertEqual(approval.status, "rejected")
        self.assertEqual(approval.review_notes, "Permit drawing revision required")
        self.assertIsNotNone(approval.issued_at)
        self.assertEqual(self.client.delete(url, **self.headers).status_code, 400)

    def test_notifications_can_only_be_read_by_the_recipient(self):
        notification = Notification.objects.create(
            organization=self.organization, recipient=self.user, title="Review required", created_at=1,
        )
        marked = self.client.post(f"/api/v1/construction/notifications/{notification.id}/mark-read/", {}, format="json", **self.headers)
        self.assertEqual(marked.status_code, 200, marked.data)
        notification.refresh_from_db()
        self.assertIsNotNone(notification.read_at)
        Notification.objects.create(organization=self.organization, recipient=self.user, title="Second", created_at=2)
        read_all = self.client.post("/api/v1/construction/notifications/read-all/", {}, format="json", **self.headers)
        self.assertEqual(read_all.status_code, 200, read_all.data)
        self.assertEqual(read_all.data["updated"], 1)

    def test_variation_uses_ordered_approval_transitions_and_recalculates_project(self):
        variation = Variation.objects.create(
            organization=self.organization, project=self.project, variation_number="V2",
            description="Additional access control", amount=Decimal("150000"), status="draft",
            created_at=1, updated_at=1,
        )
        url = f"/api/v1/construction/variations/{variation.id}/"
        self.assertEqual(self.client.patch(url, {"status": "approved"}, format="json", **self.headers).status_code, 400)
        self.assertEqual(self.client.post(f"{url}transition/", {"status": "approved"}, format="json", **self.headers).status_code, 400)
        self.assertEqual(self.client.post(f"{url}transition/", {"status": "submitted"}, format="json", **self.headers).status_code, 200)
        approved = self.client.post(f"{url}transition/", {"status": "approved"}, format="json", **self.headers)
        self.assertEqual(approved.status_code, 200, approved.data)
        variation.refresh_from_db(); self.project.refresh_from_db()
        self.assertEqual(variation.approved_by, self.user)
        self.assertEqual(self.project.approved_variations, Decimal("400000"))
        self.assertEqual(self.client.delete(url, **self.headers).status_code, 400)

    def test_requisition_requires_review_before_decision(self):
        created = self.client.post("/api/v1/construction/requisitions/", {
            "project_id": self.project.id, "title": "Site generator fuel", "amount": "75000",
        }, format="json", **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        requisition = Requisition.objects.get(title="Site generator fuel")
        url = f"/api/v1/construction/requisitions/{requisition.id}/"
        self.assertEqual(self.client.post(f"{url}decide/", {"decision": "approved"}, format="json", **self.headers).status_code, 400)
        self.assertEqual(self.client.post(f"{url}review/", {}, format="json", **self.headers).status_code, 200)
        decided = self.client.post(f"{url}decide/", {"decision": "approved"}, format="json", **self.headers)
        self.assertEqual(decided.status_code, 200, decided.data)
        requisition.refresh_from_db()
        self.assertEqual(requisition.reviewed_by, self.user)
        self.assertEqual(requisition.approved_by, self.user)
        self.assertEqual(self.client.delete(url, **self.headers).status_code, 400)

    def test_disbursement_pay_and_void_are_server_controlled(self):
        created = self.client.post("/api/v1/construction/disbursements/", {
            "project_id": self.project.id, "certificate": self.certificate.id, "amount": "100000",
        }, format="json", **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        disbursement = Disbursement.objects.get(amount=Decimal("100000"))
        url = f"/api/v1/construction/disbursements/{disbursement.id}/"
        self.assertEqual(self.client.patch(url, {"status": "paid"}, format="json", **self.headers).status_code, 400)
        paid = self.client.post(f"{url}pay/", {}, format="json", **self.headers)
        self.assertEqual(paid.status_code, 200, paid.data)
        self.assertEqual(self.client.post(f"{url}pay/", {}, format="json", **self.headers).status_code, 400)
        self.assertEqual(self.client.post(f"{url}void/", {}, format="json", **self.headers).status_code, 400)
        voided = self.client.post(f"{url}void/", {"reason": "Bank transfer reversed"}, format="json", **self.headers)
        self.assertEqual(voided.status_code, 200, voided.data)
        disbursement.refresh_from_db()
        self.assertEqual(disbursement.voided_by, self.user)
        self.assertEqual(self.client.delete(url, **self.headers).status_code, 400)

    def test_drawdown_follows_document_valuation_approval_and_disbursement_sequence(self):
        created = self.client.post("/api/v1/construction/drawdowns/", {
            "project_id": self.project.id, "request_number": "DD-TEST-01",
            "amount": "500000", "purpose": "Certified works",
        }, format="json", **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        drawdown = DrawdownRequest.objects.get(request_number="DD-TEST-01")
        url = f"/api/v1/construction/drawdowns/{drawdown.id}/transition/"
        self.assertEqual(self.client.post(url, {"action": "disburse"}, format="json", **self.headers).status_code, 400)
        for payload, expected in [
            ({"action": "review_documents"}, "document_review"),
            ({"action": "review_valuation", "valuation_amount": "490000"}, "valuation_review"),
            ({"action": "approve", "notes": "Valuation checked"}, "approved"),
            ({"action": "disburse"}, "disbursed"),
        ]:
            response = self.client.post(url, payload, format="json", **self.headers)
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data["status"], expected)
        drawdown.refresh_from_db()
        self.assertEqual(drawdown.reviewed_by, self.user)
        self.assertIsNotNone(drawdown.approved_at)
        self.assertIsNotNone(drawdown.disbursed_at)

    def test_provisional_sum_requires_ascertainment_before_close(self):
        created = self.client.post("/api/v1/construction/provisional-sums/", {
            "project": self.project.id, "item_number": "PS-TEST", "description": "Specialist signage",
            "budgeted_amount": "1000000",
        }, format="json", **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        item = ProvisionalSum.objects.get(item_number="PS-TEST")
        url = f"/api/v1/construction/provisional-sums/{item.id}/"
        self.assertEqual(self.client.post(f"{url}close/", {}, format="json", **self.headers).status_code, 400)
        ascertained = self.client.post(f"{url}ascertain/", {"ascertained_amount": "920000", "notes": "Competitive quotation"}, format="json", **self.headers)
        self.assertEqual(ascertained.status_code, 200, ascertained.data)
        closed = self.client.post(f"{url}close/", {}, format="json", **self.headers)
        self.assertEqual(closed.status_code, 200, closed.data)
        self.assertEqual(closed.data["status"], "closed")
        self.assertEqual(self.client.delete(url, **self.headers).status_code, 400)

    def test_contingency_approval_enforces_remaining_allowance(self):
        item = ContingencyDrawdown.objects.create(
            organization=self.organization, project=self.project, drawdown_number="CD-TEST",
            reason="Unforeseen services", amount=Decimal("260000"), status="requested", created_at=1, updated_at=1,
        )
        url = f"/api/v1/construction/contingency-drawdowns/{item.id}/decide/"
        rejected = self.client.post(url, {"decision": "approved"}, format="json", **self.headers)
        self.assertEqual(rejected.status_code, 400)
        item.amount = Decimal("200000"); item.save(update_fields=("amount",))
        approved = self.client.post(url, {"decision": "approved"}, format="json", **self.headers)
        self.assertEqual(approved.status_code, 200, approved.data)
        item.refresh_from_db(); self.assertEqual(item.approved_by, self.user)

    def test_advance_recovery_is_append_only_and_capped_at_outstanding(self):
        advance = AdvancePayment.objects.create(
            organization=self.organization, project=self.project, contractor_name="BuildCo",
            amount=Decimal("1000000"), recovered_amount=Decimal("250000"), status="active", created_at=1, updated_at=1,
        )
        url = f"/api/v1/construction/advance-payments/{advance.id}/recover/"
        self.assertEqual(self.client.post(url, {"amount_recovered": "800000"}, format="json", **self.headers).status_code, 400)
        recovered = self.client.post(url, {"amount_recovered": "750000", "certificate_number": "IPC-009"}, format="json", **self.headers)
        self.assertEqual(recovered.status_code, 200, recovered.data)
        advance.refresh_from_db(); self.assertEqual(advance.status, "fully_recovered")
        event = AdvanceRecovery.objects.get(advance_payment=advance)
        self.assertEqual(event.amount_recovered, Decimal("750000"))
        self.assertEqual(self.client.delete(f"/api/v1/construction/advance-recoveries/{event.id}/", **self.headers).status_code, 405)

    def test_milestone_mini_boq_valuation_and_certificate_generation(self):
        boq_item = BoQItem.objects.create(
            project=self.project,
            organization=self.organization,
            section="Substructure",
            item_number="1.1",
            description="Mass concrete blinding in foundation trenches",
            unit="m3",
            quantity=Decimal("100.00"),
            rate=Decimal("5000.00"),
            amount=Decimal("500000.00"),
        )
        MilestoneBoQItem.objects.create(
            project=self.project,
            organization=self.organization,
            milestone_id=self.milestone.milestone_id,
            boq_item=boq_item,
            allocated_quantity=Decimal("50.00"),
            created_at=int(time() * 1000),
            updated_at=int(time() * 1000),
        )

        # self.milestone has percent_complete = 80
        # Valuation:
        # Allocated value = 50 * 5,000 = 250,000
        # Gross certified = 250,000 * 0.80 = 200,000
        # Retention (5%) = 10,000
        # Advance Recovery (10%) = 20,000
        # Net certified payable = 200,000 - 10,000 - 20,000 = 170,000
        url = f"/api/v1/construction/milestones/{self.milestone.id}/mini-boq/"
        response = self.client.get(url, **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        self.assertEqual(len(data["items"]), 1)
        val = data["valuation"]
        self.assertEqual(Decimal(str(val["current_gross"])), Decimal("200000.00"))
        self.assertEqual(Decimal(str(val["retention_amount"])), Decimal("10000.00"))
        self.assertEqual(Decimal(str(val["advance_recovery"])), Decimal("20000.00"))
        self.assertEqual(Decimal(str(val["net_payable"])), Decimal("170000.00"))

        # Verify automated certificate creation via valuation engine
        calc = calculate_milestone_valuation(self.milestone, auto_create_certificate=True, verifier=self.user)
        self.assertIn("certificate_id", calc)
        self.assertIn("disbursement_id", calc)
        cert = Certificate.objects.get(id=calc["certificate_id"])
        self.assertEqual(cert.net_payable, Decimal("170000.00"))

    def test_auto_map_boq_allocations(self):
        MilestoneEntry.objects.create(
            id="ms-foundation",
            organization=self.organization,
            project_id=self.project.id,
            milestone_id="Foundation and Substructure",
            percent_complete=50,
            created_at=1,
            updated_at=1,
        )
        BoQItem.objects.create(
            project=self.project,
            organization=self.organization,
            section="substructure",
            item_number="1.2",
            description="Reinforced concrete slab foundation",
            unit="m2",
            quantity=Decimal("200.00"),
            rate=Decimal("3500.00"),
            amount=Decimal("700000.00"),
        )
        url = "/api/v1/construction/milestones/auto-map-boq/"
        response = self.client.post(url, {"project_id": self.project.id}, format="json", **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["mapped_allocations"] >= 1)

    def test_milestone_ai_audit_endpoint(self):
        url = f"/api/v1/construction/milestones/{self.milestone.id}/ai-audit/"
        response = self.client.post(url, {}, format="json", **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("confidence_score", response.data)
        self.assertIn("audit_status", response.data)
        self.assertIn("recommendation", response.data)
