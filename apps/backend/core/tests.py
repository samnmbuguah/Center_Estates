import json
from datetime import date
from decimal import Decimal

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


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class ApiSchemaAuthenticationTests(TestCase):
    def test_schema_documents_bearer_and_cookie_authentication_as_alternatives(self):
        response = self.client.get('/api/v1/schema/', HTTP_ACCEPT='application/json')

        self.assertEqual(response.status_code, 200)
        schema = json.loads(response.content)
        schemes = schema['components']['securitySchemes']
        self.assertEqual(schemes['jwtAuth']['scheme'], 'bearer')
        self.assertEqual(schemes['cookieAuth']['name'], 'ce_access')
        self.assertIn('X-CSRFToken', schemes['cookieAuth']['description'])
        self.assertEqual(
            schema['paths']['/api/v1/auth/me/']['get']['security'],
            [{'jwtAuth': []}, {'cookieAuth': []}],
        )


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
class CalendarFeedTests(TestCase):
    def setUp(self):
        from properties.models import Invoice, Lease, Tenant, Unit
        self.user = get_user_model().objects.create_user(username='calendar-admin', password='test')
        self.organization = Organization.objects.create(name='Calendar Client', slug='calendar-client')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True, is_organization_admin=True)
        Subscription.objects.create(organization=self.organization, module=Module.PROPERTY, status=Subscription.Status.ACTIVE)
        self.property = Property.objects.create(organization=self.organization, code='CAL-001', name='Calendar Plaza')
        unit = Unit.objects.create(organization=self.organization, property=self.property, code='A-01', area=100)
        tenant = Tenant.objects.create(organization=self.organization, property=self.property, code='TNT-CAL', name='Calendar Tenant')
        lease = Lease.objects.create(
            organization=self.organization, reference='LEASE-CAL', unit=unit, tenant=tenant,
            starts_on=date(2026, 8, 1), ends_on=date(2027, 7, 31), monthly_rent=Decimal('10000'),
            status=Lease.Status.ACTIVE,
        )
        Invoice.objects.create(
            organization=self.organization, number='INV-CAL', lease=lease, issued_on=date(2026, 8, 1),
            due_on=date(2026, 8, 10), subtotal=Decimal('10000'), amount=Decimal('10000'),
            balance=Decimal('10000'), status=Invoice.Status.ISSUED,
        )
        self.client = APIClient(); self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def test_calendar_feed_aggregates_property_records_and_honors_property_scope(self):
        response = self.client.get(
            '/api/v1/calendar-feed/?start=2026-07-01&end=2027-08-31',
            HTTP_X_PROPERTY_ID=str(self.property.id), **self.headers,
        )
        self.assertEqual(response.status_code, 200, response.data)
        event_types = {event['event_type'] for event in response.data['results']}
        self.assertIn('lease_start', event_types)
        self.assertIn('lease_expiry', event_types)
        self.assertIn('invoice_due', event_types)
        self.assertTrue(all(event['property_name'] == 'Calendar Plaza' for event in response.data['results']))
        self.assertTrue(all(event['source_url'] for event in response.data['results']))

    def test_calendar_feed_rejects_excessive_date_range(self):
        response = self.client.get('/api/v1/calendar-feed/?start=2020-01-01&end=2026-01-01', **self.headers)
        self.assertEqual(response.status_code, 400)


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
        module_slugs = [m['slug'] for m in me.data['modules']]
        self.assertIn(Module.PROPERTY, module_slugs)

    def test_login_succeeds_without_csrf_by_design(self):
        """Login is intentionally csrf_exempt — protected by CORS headers and rate limiting instead."""
        response = self.client.post(
            '/api/v1/auth/login/', {'username': 'api-user', 'password': 'correct-password'}, format='json'
        )
        self.assertEqual(response.status_code, 200)

    def test_login_cookie_domain_can_be_host_only_for_non_production_domains(self):
        with self.settings(JWT_COOKIE_DOMAIN=None):
            response = self.client.post(
                '/api/v1/auth/login/', {'username': 'api-user', 'password': 'correct-password'}, format='json'
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.cookies['ce_access']['domain'], '')

    def test_login_attempts_are_rate_limited(self):
        csrf_token = self._csrf()
        responses = [self.client.post(
            '/api/v1/auth/login/', {'username': 'api-user', 'password': 'wrong-password'},
            format='json', HTTP_X_CSRFTOKEN=csrf_token, REMOTE_ADDR='198.51.100.24',
        ) for _ in range(11)]
        self.assertTrue(all(response.status_code != 429 for response in responses[:10]))
        self.assertEqual(responses[-1].status_code, 429)

    def test_superuser_receives_all_module_entitlements(self):
        superuser = get_user_model().objects.create_superuser(
            username='super-module-user',
            email='super-module-user@example.com',
            password='Correct-Horse-2026!',
        )
        organization = Organization.objects.create(name='Superuser Modules Org', slug='superuser-modules-org')
        Membership.objects.create(user=superuser, organization=organization, is_default=True)
        Subscription.objects.create(
            organization=organization,
            module=Module.PROPERTY,
            status=Subscription.Status.ACTIVE,
        )
        self.client.force_authenticate(superuser)
        response = self.client.get(
            '/api/v1/auth/me/',
            HTTP_X_ORGANIZATION_ID=str(organization.id),
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(
            {item['slug'] for item in response.data['modules']},
            {module for module, _label in Module.choices},
        )

    def test_workspace_pulse_returns_one_entitlement_scoped_payload(self):
        self.client.force_authenticate(self.user)
        response = self.client.get(
            '/api/v1/workspace/pulse/', HTTP_X_ORGANIZATION_ID=str(self.organization.id),
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn(Module.PROPERTY, response.data['pulse'])
        self.assertIn(Module.COMPANION, response.data['pulse'])
        self.assertEqual(response.data['pulse'][Module.PROPERTY]['properties'], 0)
        self.assertEqual(response.data['pulse'][Module.PROPERTY]['occupancy'], 0)

    def test_register_attaches_new_user_to_center_estates_with_property_manager_role(self):
        from organizations.models import Membership, Role

        center_org = Organization.objects.create(name='Center Estates Demo', slug='center-estates-demo')
        pm_role = Role.objects.create(organization=center_org, name='Property Manager', slug='property-manager')

        response = self.client.post(
            '/api/v1/auth/register/',
            {'email': 'new.signup@example.com', 'password': 'Correct-Horse-2026!'},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        user = get_user_model().objects.get(email='new.signup@example.com')
        self.assertEqual(user.username, 'new.signup')
        membership = Membership.objects.get(user=user, organization=center_org)
        self.assertTrue(membership.is_default)
        self.assertFalse(membership.is_organization_admin)
        self.assertIn(pm_role, membership.roles.all())

    def test_register_derives_unique_username_when_email_prefix_is_taken(self):
        get_user_model().objects.create_user(username='taken.user', email='other.person@example.com', password='x')
        response = self.client.post(
            '/api/v1/auth/register/',
            {'email': 'taken.user@example.com', 'password': 'Correct-Horse-2026!'},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['username'], 'taken.user-1')

    def test_register_rejects_duplicate_email(self):
        response = self.client.post(
            '/api/v1/auth/register/',
            {'email': 'dup.email@example.com', 'password': 'Correct-Horse-2026!'},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        response = self.client.post(
            '/api/v1/auth/register/',
            {'email': 'dup.email@example.com', 'password': 'Correct-Horse-2026!'},
            format='json',
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('email', response.data)

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
            view, _ = Permission.objects.get_or_create(
                key=f'{module}.view', defaults={'label': f'View {label}', 'module': module},
            )
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
            permission, _ = Permission.objects.get_or_create(
                key=f'{module}.{domain}', defaults={'label': f'{domain} {module}', 'module': module},
            )
            self.roles[module].permissions.add(permission)
            with self.subTest(module=module):
                self.assertEqual(self.client.post(collection, {}, format='json', **self.headers).status_code, 400)

    def test_unrelated_domain_permission_does_not_authorize_mutation(self):
        leasing, _ = Permission.objects.get_or_create(
            key='property.leasing', defaults={'label': 'Leasing', 'module': Module.PROPERTY},
        )
        self.roles[Module.PROPERTY].permissions.add(leasing)
        self.assertEqual(
            self.client.post('/api/v1/property/properties/', {}, format='json', **self.headers).status_code,
            403,
        )

    def test_workspace_pulse_includes_every_entitled_module(self):
        response = self.client.get('/api/v1/workspace/pulse/', **self.headers)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(set(response.data['pulse']), {module for module, _label in Module.choices})
        self.assertEqual(response.data['pulse'][Module.FACILITY]['compliance'], 100)

    def test_approval_action_requires_separate_approval_permission(self):
        manage, _ = Permission.objects.get_or_create(
            key='sales.manage', defaults={'label': 'Manage sales', 'module': Module.SALES},
        )
        self.roles[Module.SALES].permissions.add(manage)
        url = '/api/v1/sales/payments/00000000-0000-0000-0000-000000000001/verify/'
        self.assertEqual(self.client.post(url, {}, format='json', **self.headers).status_code, 403)
        approve, _ = Permission.objects.get_or_create(
            key='sales.approve', defaults={'label': 'Approve sales', 'module': Module.SALES},
        )
        self.roles[Module.SALES].permissions.add(approve)
        self.assertEqual(self.client.post(url, {}, format='json', **self.headers).status_code, 404)


@override_settings(
    ALLOWED_HOSTS=['testserver', 'api.centerestates.com', 'centerestates.com'],
    CORS_ALLOWED_ORIGINS=['https://centerestates.com'],
    SECURE_SSL_REDIRECT=False,
)
class CorsAndPreflightContractTests(TestCase):
    def test_preflight_allows_all_frontend_headers_including_x_tenant_id(self):
        response = self.client.options(
            '/api/v1/construction/projects/',
            HTTP_ORIGIN='https://centerestates.com',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='x-tenant-id, x-organization-id, x-property-id, authorization, x-requested-with, x-csrftoken',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), 'https://centerestates.com')
        self.assertEqual(response.headers.get('Access-Control-Allow-Credentials'), 'true')
        allowed_headers = response.headers.get('Access-Control-Allow-Headers', '').lower()
        self.assertIn('x-tenant-id', allowed_headers)
        self.assertIn('x-organization-id', allowed_headers)
        self.assertIn('authorization', allowed_headers)

    def test_logout_endpoint_succeeds_without_prior_authentication(self):
        response = self.client.post('/api/v1/auth/logout/')
        self.assertEqual(response.status_code, 204)
        self.assertIn('ce_access', response.cookies)
        self.assertIn('ce_refresh', response.cookies)
        self.assertEqual(response.cookies['ce_access']['max-age'], 0)
