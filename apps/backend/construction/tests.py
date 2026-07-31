from decimal import Decimal
from time import time

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken
from django.core.files.uploadedfile import SimpleUploadedFile
from tempfile import TemporaryDirectory

from core.models import Module
from organizations.models import Membership, Organization
from properties.models import Project as PortfolioProject
from subscriptions.models import Subscription

from .models import (
    Certificate, Disbursement, EvidenceFile, MilestoneEntry, Project, Risk,
    SubmissionRecord, Ticket, Variation,
)


@override_settings(ALLOWED_HOSTS=["testserver"], DEBUG=True, SECURE_SSL_REDIRECT=False)
class ConstructionApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="monitor", password="test")
        self.organization = Organization.objects.create(name="Builder", slug="builder")
        self.other = Organization.objects.create(name="Other Builder", slug="other-builder")
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True)
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
