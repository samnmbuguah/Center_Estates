from decimal import Decimal
from time import time

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core.models import Module
from organizations.models import Membership, Organization
from properties.models import Project as PortfolioProject
from subscriptions.models import Subscription

from .models import MilestoneEntry, Project, Risk, Ticket, Variation


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
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.headers = {"HTTP_X_ORGANIZATION_ID": str(self.organization.id)}

    def test_dashboard_is_calculated_from_scoped_live_data(self):
        response = self.client.get("/api/v1/construction/dashboard/", **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["kpis"]["activeProjects"], 1)
        self.assertEqual(response.data["kpis"]["openTickets"], 1)
        self.assertEqual(response.data["kpis"]["highRisks"], 1)
        self.assertEqual(Decimal(response.data["kpis"]["approvedVariations"]), Decimal("250000"))

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
        response = self.client.patch(
            f"/api/v1/construction/milestones/{self.milestone.id}/",
            {"percent_complete": 90}, format="json", HTTP_X_CLIENT_KIND="mobile", **self.headers,
        )
        self.assertEqual(response.status_code, 400)
        self.milestone.refresh_from_db()
        self.assertEqual(self.milestone.percent_complete, 80)

    def test_mobile_authoritative_record_rejects_desktop_write(self):
        response = self.client.patch(
            f"/api/v1/construction/milestones/{self.milestone.id}/",
            {"percent_complete": 90}, format="json", HTTP_X_CLIENT_KIND="desktop", **self.headers,
        )
        self.assertEqual(response.status_code, 400)

    def test_subscription_is_required(self):
        Subscription.objects.filter(organization=self.organization, module=Module.MONITORING).update(is_active=False)
        self.assertEqual(self.client.get("/api/v1/construction/dashboard/", **self.headers).status_code, 403)
