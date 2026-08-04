from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from django.test import TestCase, override_settings

from core.models import Module
from organizations.models import Membership, Organization, Role, Permission, MembershipRole
from subscriptions.models import Subscription

User = get_user_model()


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class CompanionApiTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Companion Test Org")
        self.admin = User.objects.create_user(username="admin", password="pw", first_name="Ad", last_name="Min")
        Membership.objects.create(organization=self.organization, user=self.admin, is_organization_admin=True)
        Subscription.objects.create(organization=self.organization, module=Module.COMPANION, is_active=True, status=Subscription.Status.ACTIVE)
        self.staff = User.objects.create_user(username="staff", password="pw", first_name="St", last_name="Aff")
        Membership.objects.create(organization=self.organization, user=self.staff, status=Membership.Status.ACTIVE)
        viewer_role = Role.objects.create(organization=self.organization, slug="companion-viewer", name="Companion Viewer", is_system=True)
        view_perm, _ = Permission.objects.update_or_create(key="companion.view", defaults={"label": "View Companion", "module": Module.COMPANION})
        viewer_role.permissions.set([view_perm])
        MembershipRole.objects.create(membership=self.organization.memberships.get(user=self.staff), role=viewer_role)
        self.client = APIClient()

    def login(self, user):
        self.client.force_authenticate(user=user)

    def test_admin_can_create_and_complete_task(self):
        self.login(self.admin)
        res = self.client.post("/api/v1/companion/tasks/", {
            "title": "Approve Payment Voucher",
            "assignee": str(self.staff.pk),
            "priority": "high",
        })
        self.assertEqual(res.status_code, 201, res.content)
        task = res.data
        self.assertEqual(task["reference"].startswith("CPN-"), True)
        self.assertEqual(task["status"], "pending")

        res = self.client.post(f"/api/v1/companion/tasks/{task['id']}/acknowledge/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data["status"], "acknowledged")

        res = self.client.post(f"/api/v1/companion/tasks/{task['id']}/complete/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data["status"], "completed")
        self.assertIsNotNone(res.data["completed_at"])

    def test_staff_can_see_only_own_dashboard(self):
        self.login(self.admin)
        self.client.post("/api/v1/companion/tasks/", {"title": "Task for staff", "assignee": str(self.staff.pk)})
        self.login(self.staff)
        res = self.client.get("/api/v1/companion/dashboard/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(len(res.data["recentTasks"]), 1)
        self.assertEqual(res.data["recentTasks"][0]["title"], "Task for staff")

    def test_performance_requires_manager(self):
        self.login(self.staff)
        res = self.client.get("/api/v1/companion/performance/")
        self.assertEqual(res.status_code, 400, res.content)

    def test_admin_can_view_performance(self):
        self.login(self.admin)
        self.client.post("/api/v1/companion/tasks/", {"title": "P", "assignee": str(self.staff.pk)})
        res = self.client.get("/api/v1/companion/performance/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertIn("staff", res.data)
        staff_rows = {s["user_id"]: s for s in res.data["staff"]}
        self.assertIn(str(self.staff.pk), staff_rows)
