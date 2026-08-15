from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from django.test import TestCase, override_settings
from django.db import connection
from django.test.utils import CaptureQueriesContext
from unittest.mock import patch
import os

from core.models import Module
from organizations.models import Membership, Organization, Role, Permission, MembershipRole
from subscriptions.models import Subscription
from companion.models import TaskEvent
from companion.qm_agent import QMAgentOrchestrator
from properties.models import Property

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

    def test_qm_uses_nvidia_nim_configuration(self):
        with patch.dict(os.environ, {
            'NVIDIA_API_KEY': 'test-key',
            'NVIDIA_API_URL': 'https://integrate.api.nvidia.com/v1',
            'NVIDIA_MODEL': 'meta/llama-3.1-8b-instruct',
            'NVIDIA_TIMEOUT_SECONDS': '24',
        }, clear=True):
            agent = QMAgentOrchestrator()
        self.assertTrue(agent.configured)
        self.assertEqual(agent.api_url, 'https://integrate.api.nvidia.com/v1/chat/completions')
        self.assertEqual(agent.model, 'meta/llama-3.1-8b-instruct')
        self.assertEqual(agent.timeout_seconds, 24)

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
        with CaptureQueriesContext(connection) as queries:
            res = self.client.get("/api/v1/companion/dashboard/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertLessEqual(len(queries), 10, f'Dashboard used {len(queries)} queries')
        self.assertEqual(len(res.data["recentTasks"]), 1)
        self.assertEqual(res.data["recentTasks"][0]["title"], "Task for staff")

    def test_tasks_and_dashboard_honor_selected_property(self):
        first = Property.objects.create(organization=self.organization, code='CP-1', name='Companion One')
        second = Property.objects.create(organization=self.organization, code='CP-2', name='Companion Two')
        headers = {'HTTP_X_PROPERTY_ID': str(first.id)}
        self.login(self.admin)
        created = self.client.post(
            '/api/v1/companion/tasks/',
            {'title': 'First property task', 'assignee': str(self.staff.pk)},
            format='json', **headers,
        )
        self.assertEqual(created.status_code, 201, created.content)
        self.assertEqual(str(created.data['property']), str(first.id))
        self.client.post(
            '/api/v1/companion/tasks/',
            {'title': 'Second property task', 'assignee': str(self.staff.pk), 'property': str(second.id)},
            format='json', HTTP_X_PROPERTY_ID=str(second.id),
        )

        self.login(self.staff)
        dashboard = self.client.get('/api/v1/companion/dashboard/', **headers)
        self.assertEqual(dashboard.status_code, 200)
        self.assertEqual([row['title'] for row in dashboard.data['recentTasks']], ['First property task'])

    def test_performance_requires_manager(self):
        self.login(self.staff)
        res = self.client.get("/api/v1/companion/performance/")
        self.assertEqual(res.status_code, 403, res.content)

    def test_admin_can_view_performance(self):
        self.login(self.admin)
        self.client.post("/api/v1/companion/tasks/", {"title": "P", "assignee": str(self.staff.pk)})
        with CaptureQueriesContext(connection) as queries:
            res = self.client.get("/api/v1/companion/performance/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertLessEqual(len(queries), 10, f'Performance dashboard used {len(queries)} queries')
        self.assertIn("staff", res.data)
        staff_rows = {s["user_id"]: s for s in res.data["staff"]}
        self.assertIn(str(self.staff.pk), staff_rows)

    def test_ai_chat_endpoint_with_rule_based_fallback(self):
        self.login(self.admin)
        with patch('companion.views.QMAgentOrchestrator.execute_agent', return_value={'agent': 'Quartermaster (QM)', 'status': 'local', 'response': ''}):
            response = self.client.post(
                '/api/v1/companion/dashboard/chat/',
                {'prompt': 'Show me rent collections'},
                format='json',
            )
        self.assertEqual(response.status_code, 200)
        self.assertIn('response', response.data)
        self.assertIn('suggestedActions', response.data)
        self.assertTrue(len(response.data['suggestedActions']) > 0)
        self.assertEqual(response.data['agentStatus'], 'local')
        self.assertNotIn('24 Portfolio Buildings', response.data['response'])

    def test_ai_chat_endpoint_default_prompt(self):
        self.login(self.admin)
        with patch('companion.views.QMAgentOrchestrator.execute_agent', return_value={'agent': 'Quartermaster (QM)', 'status': 'local', 'response': ''}):
            response = self.client.post(
                '/api/v1/companion/dashboard/chat/',
                {'prompt': ''},
                format='json',
            )
        self.assertEqual(response.status_code, 200)
        self.assertIn('response', response.data)

    def test_ai_daily_brief_is_grounded_and_role_aware(self):
        self.login(self.staff)
        with patch('companion.views.QMAgentOrchestrator.execute_agent', return_value={'agent': 'Quartermaster (QM)', 'status': 'local', 'response': ''}):
            response = self.client.post(
                '/api/v1/companion/dashboard/chat/',
                {'prompt': 'Brief me on today priorities'},
                format='json',
            )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn('operational briefing', response.data['response'])
        self.assertEqual(response.data['suggestedActions'][0]['label'], 'View My Tasks')

    def test_ai_chat_rejects_oversized_prompts(self):
        self.login(self.admin)
        response = self.client.post(
            '/api/v1/companion/dashboard/chat/',
            {'prompt': 'x' * 2001},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_telemetry_requires_authentication_and_accepts_batches(self):
        anonymous = self.client.post('/api/v1/companion/telemetry/', {
            'events': [{'event': 'page_view', 'module': 'property'}],
        }, format='json')
        self.assertEqual(anonymous.status_code, 401)

        self.login(self.admin)
        response = self.client.post('/api/v1/companion/telemetry/', {
            'events': [
                {'event': 'page_view', 'module': 'property', 'properties': {'path': '/property'}},
                {'event': 'user_click', 'module': 'facility', 'properties': {'element': 'button:Approve'}},
            ],
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data['accepted'], 2)
        events = TaskEvent.objects.filter(organization=self.organization, note__startswith='Telemetry [')
        self.assertEqual(events.count(), 2)
        self.assertTrue(events.filter(actor=self.admin, note__contains='button:Approve').exists())

    def test_telemetry_rejects_unbounded_batches(self):
        self.login(self.admin)
        response = self.client.post('/api/v1/companion/telemetry/', {
            'events': [{'event': 'click'} for _ in range(101)],
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(TaskEvent.objects.filter(organization=self.organization, note__startswith='Telemetry [').count(), 0)

    def test_telemetry_list_aggregates_per_user_stats(self):
        self.login(self.admin)
        self.client.post('/api/v1/companion/telemetry/', {
            'events': [
                {'event': 'page_view', 'module': 'property', 'properties': {'path': '/property'}},
                {'event': 'user_click', 'module': 'facility', 'properties': {'element': 'button:Approve'}},
            ],
        }, format='json')
        response = self.client.get('/api/v1/companion/telemetry/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('by_user', response.data)
        self.assertIn('by_module', response.data)
        self.assertIn('events', response.data)
        admin_stats = response.data['by_user'].get(self.admin.username)
        self.assertIsNotNone(admin_stats)
        self.assertEqual(admin_stats['events'], 2)
        self.assertIn('property', admin_stats['modules'])
        self.assertIn('facility', admin_stats['modules'])
        self.assertIsNotNone(admin_stats['last_seen'])
