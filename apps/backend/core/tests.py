from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from django.test import RequestFactory, TestCase, override_settings
from rest_framework.test import APIClient

from organizations.models import Membership, MembershipRole, Organization, Permission, Role

from .tenancy import get_active_organization, scope_to_request
from properties.models import Property
from subscriptions.models import Subscription
from core.models import Module


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class HealthEndpointTests(TestCase):
    def test_health_endpoint(self):
        response = self.client.get('/api/v1/health/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ok')


class OrganizationContextTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='member', password='test')
        self.first = Organization.objects.create(name='First', slug='first')
        self.second = Organization.objects.create(name='Second', slug='second')
        Membership.objects.create(user=self.user, organization=self.first, is_default=True)
        self.request = RequestFactory().get('/', HTTP_X_ORGANIZATION_ID=str(self.first.id))
        self.request.user = self.user
        self.request.requested_organization_id = str(self.first.id)

    def test_member_can_select_owned_organization(self):
        self.assertEqual(get_active_organization(self.request), self.first)

    def test_member_cannot_select_another_organization(self):
        self.request.requested_organization_id = str(self.second.id)
        with self.assertRaises(PermissionDenied):
            get_active_organization(self.request)

    def test_scope_to_request_never_returns_other_organization_rows(self):
        Property.objects.create(organization=self.first, code='ONE', name='One')
        Property.objects.create(organization=self.second, code='TWO', name='Two')

        self.assertEqual(list(scope_to_request(Property.objects.all(), self.request).values_list('code', flat=True)), ['ONE'])


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class AuthenticationApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='api-user', password='correct-password')
        self.organization = Organization.objects.create(name='API Organization', slug='api-organization')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True, is_organization_admin=True)
        Subscription.objects.create(
            organization=self.organization, module=Module.PROPERTY, status=Subscription.Status.ACTIVE
        )
        self.client = APIClient(enforce_csrf_checks=True)

    def _csrf(self):
        response = self.client.get('/api/v1/auth/csrf/')
        return response.cookies['csrftoken'].value

    def test_login_sets_http_only_tokens_and_me_returns_dynamic_entitlements(self):
        csrf_token = self._csrf()
        response = self.client.post(
            '/api/v1/auth/login/', {'username': 'api-user', 'password': 'correct-password'},
            format='json', HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.cookies['ce_access']['httponly'])

        me = self.client.get(
            '/api/v1/auth/me/', HTTP_X_ORGANIZATION_ID=str(self.organization.id)
        )
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data['organizations'][0]['name'], 'API Organization')
        self.assertEqual(me.data['modules'][0]['slug'], Module.PROPERTY)

    def test_login_succeeds_without_csrf_by_design(self):
        """Login is intentionally csrf_exempt — protected by CORS headers and rate limiting instead."""
        response = self.client.post(
            '/api/v1/auth/login/', {'username': 'api-user', 'password': 'correct-password'}, format='json'
        )
        self.assertEqual(response.status_code, 200)

    def test_login_attempts_are_rate_limited(self):
        csrf_token = self._csrf()
        responses = [self.client.post(
            '/api/v1/auth/login/', {'username': 'api-user', 'password': 'wrong-password'},
            format='json', HTTP_X_CSRFTOKEN=csrf_token, REMOTE_ADDR='198.51.100.24',
        ) for _ in range(11)]
        self.assertTrue(all(response.status_code != 429 for response in responses[:10]))
        self.assertEqual(responses[-1].status_code, 429)

# Create your tests here.


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class ModuleRolePermissionApiTests(TestCase):
    routes = {
        Module.PROPERTY: ('/api/v1/property/dashboard/', '/api/v1/property/properties/', 'operations'),
        Module.FACILITY: ('/api/v1/facility/dashboard/', '/api/v1/facility/assets/', 'administer'),
        Module.SALES: ('/api/v1/sales/dashboard/', '/api/v1/sales/buyers/', 'selling'),
        Module.TENDER: ('/api/v1/tender/dashboard/', '/api/v1/tender/tenders/', 'intake'),
        Module.VALUATION: ('/api/v1/valuation/dashboard/', '/api/v1/valuation/clients/', 'coordinate'),
        Module.MONITORING: ('/api/v1/construction/dashboard/', '/api/v1/construction/projects/', 'project_admin'),
    }

    def setUp(self):
        self.user = get_user_model().objects.create_user(username='role-viewer', password='test')
        self.organization = Organization.objects.create(name='Role Client', slug='role-client')
        self.membership = Membership.objects.create(
            user=self.user, organization=self.organization, is_default=True,
        )
        self.roles = {}
        for module, label in Module.choices:
            Subscription.objects.create(organization=self.organization, module=module, status=Subscription.Status.ACTIVE)
            role = Role.objects.create(organization=self.organization, name=f'{label} role', slug=f'{module}-role')
            view = Permission.objects.create(key=f'{module}.view', label=f'View {label}', module=module)
            role.permissions.add(view); MembershipRole.objects.create(membership=self.membership, role=role)
            self.roles[module] = role
        self.client = APIClient(); self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def test_viewer_can_read_each_module_but_cannot_mutate(self):
        for module, (dashboard, collection, _domain) in self.routes.items():
            with self.subTest(module=module):
                self.assertEqual(self.client.get(dashboard, **self.headers).status_code, 200)
                self.assertEqual(self.client.post(collection, {}, format='json', **self.headers).status_code, 403)

    def test_resource_permission_allows_request_to_reach_domain_validation(self):
        for module, (_dashboard, collection, domain) in self.routes.items():
            permission = Permission.objects.create(key=f'{module}.{domain}', label=f'{domain} {module}', module=module)
            self.roles[module].permissions.add(permission)
            with self.subTest(module=module):
                self.assertEqual(self.client.post(collection, {}, format='json', **self.headers).status_code, 400)

    def test_unrelated_domain_permission_does_not_authorize_mutation(self):
        leasing = Permission.objects.create(key='property.leasing', label='Leasing', module=Module.PROPERTY)
        self.roles[Module.PROPERTY].permissions.add(leasing)
        self.assertEqual(
            self.client.post('/api/v1/property/properties/', {}, format='json', **self.headers).status_code,
            403,
        )

    def test_approval_action_requires_separate_approval_permission(self):
        manage = Permission.objects.create(key='sales.manage', label='Manage sales', module=Module.SALES)
        self.roles[Module.SALES].permissions.add(manage)
        url = '/api/v1/sales/payments/00000000-0000-0000-0000-000000000001/verify/'
        self.assertEqual(self.client.post(url, {}, format='json', **self.headers).status_code, 403)
        approve = Permission.objects.create(key='sales.approve', label='Approve sales', module=Module.SALES)
        self.roles[Module.SALES].permissions.add(approve)
        self.assertEqual(self.client.post(url, {}, format='json', **self.headers).status_code, 404)
