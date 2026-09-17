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
from core.models import ClientErrorEvent, FeatureTestProgress, Module
from core.views import TEST_CHECKLIST
from core.exceptions import custom_exception_handler


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class HealthEndpointTests(TestCase):
    def test_health_endpoint(self):
        response = self.client.get('/api/v1/health/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ok')


class ApiExceptionSafetyTests(TestCase):
    def test_unhandled_exception_hides_internal_details_and_returns_reference(self):
        request = RequestFactory().get('/api/v1/facility/dashboard/')
        request.request_id = 'safe-reference-123'
        internal_error = RuntimeError("Cannot resolve keyword 'trade' into field")

        response = custom_exception_handler(internal_error, {'request': request})

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.data['detail'], 'We could not complete this request right now. Please retry.')
        self.assertEqual(response.data['error_id'], 'safe-reference-123')
        self.assertNotIn('error', response.data)
        self.assertNotIn('trade', str(response.data))


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class ClientErrorDiagnosticsTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='error-admin', password='test')
        self.organization = Organization.objects.create(name='Error Client', slug='error-client')
        Membership.objects.create(
            user=self.user, organization=self.organization,
            is_default=True, is_organization_admin=True,
        )
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def test_client_errors_are_deduplicated_and_visible_to_org_admin(self):
        payload = {
            'message': 'Chunk failed to load',
            'url': '/facility',
            'release': 'production',
            'organizationId': str(self.organization.id),
            'extra': {'source': 'window.error'},
        }
        self.assertEqual(self.client.post('/api/v1/client-errors/', payload, format='json').status_code, 202)
        self.assertEqual(self.client.post('/api/v1/client-errors/', payload, format='json').status_code, 202)
        event = ClientErrorEvent.objects.get(organization=self.organization)
        self.assertEqual(event.occurrences, 2)

        client = APIClient(); client.force_authenticate(self.user)
        response = client.get('/api/v1/client-errors/health/', **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['open_count'], 1)
        self.assertEqual(response.data['results'][0]['occurrences'], 2)

        resolved = client.patch('/api/v1/client-errors/health/', {
            'id': str(event.id), 'status': 'resolved',
        }, format='json', **self.headers)
        self.assertEqual(resolved.status_code, 200, resolved.data)
        event.refresh_from_db()
        self.assertEqual(event.status, ClientErrorEvent.Status.RESOLVED)

        resolved_list = client.get('/api/v1/client-errors/health/?status=resolved', **self.headers)
        self.assertEqual(resolved_list.status_code, 200, resolved_list.data)
        self.assertEqual(resolved_list.data['open_count'], 0)
        self.assertEqual(len(resolved_list.data['results']), 1)


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class TestingChecklistTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='test-admin', password='test')
        self.organization = Organization.objects.create(name='Release Test Client', slug='release-test-client')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True, is_organization_admin=True)
        self.client = APIClient(); self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def test_admin_can_track_a_workflow_and_progress_is_organization_scoped(self):
        initial = self.client.get('/api/v1/testing/checklist/', **self.headers)
        self.assertEqual(initial.status_code, 200, initial.data)
        item = next(item for item in initial.data['results'] if item['key'] == 'invoicing.billing_candidates')
        self.assertEqual(item['status'], 'not_started')
        updated = self.client.patch('/api/v1/testing/checklist/invoicing.billing_candidates/', {
            'status': 'passed', 'notes': 'Invoice pipeline checked with a representative lease.',
        }, format='json', **self.headers)
        self.assertEqual(updated.status_code, 200, updated.data)
        progress = FeatureTestProgress.objects.get(organization=self.organization, feature_key='invoicing.billing_candidates')
        self.assertEqual(progress.status, FeatureTestProgress.Status.PASSED)
        self.assertEqual(progress.tested_by, self.user)

    def test_non_admin_cannot_access_checklist(self):
        user = get_user_model().objects.create_user(username='test-member', password='test')
        organization = Organization.objects.create(name='Member Client', slug='member-client')
        Membership.objects.create(user=user, organization=organization, is_default=True)
        client = APIClient(); client.force_authenticate(user)
        response = client.get('/api/v1/testing/checklist/', HTTP_X_ORGANIZATION_ID=str(organization.id))
        self.assertEqual(response.status_code, 403)

    def test_auto_scan_detects_live_organization_activity(self):
        Property.objects.create(
            organization=self.organization,
            name='Auto Scan Property',
            code='AUTO-SCAN',
        )

        response = self.client.post('/api/v1/testing/auto-scan/', {}, format='json', **self.headers)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'success')
        self.assertGreaterEqual(response.data['detected_features'], 2)
        self.assertTrue(
            FeatureTestProgress.objects.filter(
                organization=self.organization,
                feature_key='property.onboarding',
                status=FeatureTestProgress.Status.PASSED,
            ).exists()
        )
        self.assertTrue(
            FeatureTestProgress.objects.filter(
                organization=self.organization,
                feature_key='admin.organization',
                status=FeatureTestProgress.Status.PASSED,
            ).exists()
        )

    def test_checklist_covers_construction_procurement_and_reporting(self):
        response = self.client.get('/api/v1/testing/checklist/', **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        keys = {item['key'] for item in response.data['results']}
        for expected in (
            'construction.projects',
            'construction.progress_verification',
            'construction.suppliers',
            'construction.material_requisitions',
            'construction.purchase_orders',
            'construction.stock_ledger',
            'invoicing.management_fees',
            'reports.analytics',
        ):
            self.assertIn(expected, keys)
        # The advertised total must always match the curated catalogue.
        self.assertEqual(response.data['total'], len(TEST_CHECKLIST))

    def test_readiness_index_separates_verified_evidence_from_record_activity(self):
        self.client.patch('/api/v1/testing/checklist/finance.receipting/', {
            'status': 'passed', 'notes': 'Verified receipting against a live lease allocation.',
        }, format='json', **self.headers)
        FeatureTestProgress.objects.create(
            organization=self.organization,
            feature_key='property.onboarding',
            status=FeatureTestProgress.Status.PASSED,
            notes='Auto-verified: 1 property asset(s) active in organization.',
        )

        response = self.client.get('/api/v1/testing/checklist/', **self.headers)

        self.assertEqual(response.data['verified_by_testing'], 1)
        self.assertEqual(response.data['verified_by_activity'], 1)
        self.assertEqual(response.data['summary']['passed'], 2)
        total = response.data['total']
        self.assertEqual(response.data['readiness_index'], round((1 / total) * 100))
        self.assertEqual(response.data['usage_index'], round((2 / total) * 100))
        self.assertLess(response.data['readiness_index'], response.data['usage_index'])

    def test_auto_scan_verifies_construction_procurement_activity(self):
        from construction.models import StoreSupplier

        StoreSupplier.objects.create(organization=self.organization, name='Site Supplies Ltd')

        response = self.client.post('/api/v1/testing/auto-scan/', {}, format='json', **self.headers)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(
            FeatureTestProgress.objects.filter(
                organization=self.organization,
                feature_key='construction.suppliers',
                status=FeatureTestProgress.Status.PASSED,
            ).exists()
        )

    def test_get_checklist_does_not_write_on_auto_scan_param(self):
        from unittest.mock import patch
        with patch('core.views.auto_detect_organization_activity', side_effect=AssertionError('GET should not call auto_scan')):
            response = self.client.get('/api/v1/testing/checklist/?auto_scan=true', **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['auto_detected_count'], 0)


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class TestingCIStatusTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='test-admin', password='test')
        self.organization = Organization.objects.create(name='CI Test Org', slug='ci-test-org')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True, is_organization_admin=True)
        self.client = APIClient(); self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def test_ci_status_returns_github_run_data(self):
        from unittest.mock import patch, MagicMock
        mock_run = {
            'id': 12345,
            'run_number': 78,
            'conclusion': 'success',
            'head_sha': 'abc123def456',
            'html_url': 'https://github.com/test/repo/actions/runs/12345',
            'created_at': '2026-09-16T10:00:00Z',
            'event': 'schedule',
            'head_branch': 'main',
        }
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({'workflow_runs': [mock_run]}).encode('utf-8')
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)

        with patch('core.views.urllib.request.urlopen', return_value=mock_resp):
            response = self.client.get('/api/v1/testing/ci-status/', **self.headers)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'fetched')
        self.assertEqual(response.data['conclusion'], 'success')
        self.assertEqual(response.data['run_number'], 78)
        self.assertEqual(response.data['head_sha'], 'abc123def456')

    def test_ci_status_handles_no_runs(self):
        from unittest.mock import patch, MagicMock
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({'workflow_runs': []}).encode('utf-8')
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)

        with patch('core.views.urllib.request.urlopen', return_value=mock_resp):
            response = self.client.get('/api/v1/testing/ci-status/', **self.headers)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'unavailable')

    def test_ci_status_handles_network_error(self):
        import urllib.error
        from unittest.mock import patch
        with patch('core.views.urllib.request.urlopen', side_effect=urllib.error.URLError('timeout')):
            response = self.client.get('/api/v1/testing/ci-status/', **self.headers)

        self.assertEqual(response.status_code, 503, response.data)
        self.assertEqual(response.data['status'], 'unavailable')

    def test_non_admin_cannot_access_ci_status(self):
        user = get_user_model().objects.create_user(username='test-member', password='test')
        org = Organization.objects.create(name='Member', slug='member-ci')
        Membership.objects.create(user=user, organization=org, is_default=True)
        client = APIClient(); client.force_authenticate(user)
        response = client.get('/api/v1/testing/ci-status/', HTTP_X_ORGANIZATION_ID=str(org.id))
        self.assertEqual(response.status_code, 403)


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

    def test_calendar_feed_handles_owner_invoice_without_lease(self):
        # Sectional service-charge invoices are raised against a unit/owner and
        # carry no lease; the feed must not assume invoice.lease is present.
        from properties.models import Invoice, Owner, Unit
        unit = Unit.objects.create(organization=self.organization, property=self.property, code='A-99', area=80)
        owner = Owner.objects.create(organization=self.organization, code='OWN-CAL', name='Calendar Owner')
        invoice = Invoice.objects.create(
            organization=self.organization, number='INV-OWNER', owner=owner, unit=unit,
            issued_on=date(2026, 8, 1), due_on=date(2026, 8, 15),
            subtotal=Decimal('5000'), amount=Decimal('5000'), balance=Decimal('5000'),
            status=Invoice.Status.ISSUED, invoice_type='owner',
        )
        response = self.client.get('/api/v1/calendar-feed/?start=2026-07-01&end=2027-08-31', **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        owner_events = [e for e in response.data['results'] if e['id'] == f'invoice-due:{invoice.pk}']
        self.assertEqual(len(owner_events), 1)
        self.assertIn('Calendar Owner', owner_events[0]['title'])


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class TicketsFeedTests(TestCase):
    def test_facility_feed_includes_public_qr_helpdesk_threads_for_selected_property(self):
        from companion.models import TeamFeedbackThread, TeamFeedbackMessage
        user = get_user_model().objects.create_user(username='ticket-admin', password='test')
        organization = Organization.objects.create(name='Ticket Client', slug='ticket-client')
        Membership.objects.create(user=user, organization=organization, is_default=True, is_organization_admin=True)
        Subscription.objects.create(organization=organization, module=Module.FACILITY, status=Subscription.Status.ACTIVE)
        property_record = Property.objects.create(organization=organization, code='TK-1', name='Ticket Plaza')
        thread = TeamFeedbackThread.objects.create(
            organization=organization, property=property_record, title='Lift issue',
            issue_category='Lift', module='facility', requester_name='Public visitor',
        )
        TeamFeedbackMessage.objects.create(
            organization=organization, thread=thread, sender_name='Public visitor', message='Lift is stuck.'
        )
        client = APIClient(); client.force_authenticate(user)
        response = client.get('/api/v1/tickets-feed/', HTTP_X_ORGANIZATION_ID=str(organization.id), HTTP_X_PROPERTY_ID=str(property_record.id))
        self.assertEqual(response.status_code, 200, response.data)
        row = next(item for item in response.data['results'] if item['id'] == f'feedback:{thread.id}')
        self.assertEqual(row['reference'], thread.ticket_no)
        self.assertEqual(row['module'], 'facility')
        self.assertEqual(row['raised_by'], 'Public visitor')


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
    CORS_ALLOWED_ORIGINS=['https://centerestates.com', 'https://www.centerestates.com'],
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

    def test_preflight_echoes_www_frontend_origin_with_credentials(self):
        response = self.client.options(
            '/api/v1/auth/csrf/',
            HTTP_ORIGIN='https://www.centerestates.com',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='x-organization-id, x-property-id, x-csrftoken',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), 'https://www.centerestates.com')
        self.assertEqual(response.headers.get('Access-Control-Allow-Credentials'), 'true')

    def test_logout_endpoint_succeeds_without_prior_authentication(self):
        response = self.client.post('/api/v1/auth/logout/')
        self.assertEqual(response.status_code, 204)
        self.assertIn('ce_access', response.cookies)
        self.assertIn('ce_refresh', response.cookies)
        self.assertEqual(response.cookies['ce_access']['max-age'], 0)
        self.assertEqual(response.cookies['ce_access']['path'], '/api/v1/')
        self.assertEqual(response.cookies['ce_refresh']['path'], '/api/v1/auth/')

    def test_logout_can_clear_each_legacy_cookie_variant(self):
        response = self.client.post('/api/v1/auth/logout/?path=root&domain=host')
        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.cookies['ce_access']['path'], '/')
        self.assertEqual(response.cookies['ce_access']['domain'], '')

        response = self.client.post('/api/v1/auth/logout/?path=refresh&domain=parent')
        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.cookies['ce_refresh']['path'], '/api/v1/auth/')
        self.assertEqual(response.cookies['ce_refresh']['domain'], '.centerestates.com')

    def test_logout_rejects_unknown_cleanup_scope(self):
        response = self.client.post('/api/v1/auth/logout/?path=unknown&domain=host')
        self.assertEqual(response.status_code, 400)

    def test_expired_access_cookie_does_not_block_logout(self):
        self.client.cookies['ce_access'] = 'not-a-valid-jwt'
        response = self.client.post('/api/v1/auth/logout/?path=access&domain=host')
        self.assertEqual(response.status_code, 204)


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class PropertyManagerScopingTests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.org = Organization.objects.create(name='Scoping Test Org', slug='scoping-test-org')
        from subscriptions.models import Subscription
        Subscription.objects.create(organization=self.org, module=Module.PROPERTY, status=Subscription.Status.ACTIVE)
        
        # Permissions and PM role
        perm_view, _ = Permission.objects.get_or_create(key='property.view', defaults={'label': 'View', 'module': Module.PROPERTY})
        perm_ops, _ = Permission.objects.get_or_create(key='property.operations', defaults={'label': 'Ops', 'module': Module.PROPERTY})
        self.pm_role = Role.objects.create(organization=self.org, name='Property Manager', slug='property-manager')
        self.pm_role.permissions.add(perm_view, perm_ops)

        # Admin user
        self.admin_user = get_user_model().objects.create_user(username='admin-user', password='password')
        self.admin_membership = Membership.objects.create(
            user=self.admin_user, organization=self.org, is_organization_admin=True, is_default=True
        )

        # PM 1
        self.pm1_user = get_user_model().objects.create_user(username='pm1-user', password='password')
        self.pm1_membership = Membership.objects.create(
            user=self.pm1_user, organization=self.org, is_organization_admin=False, is_default=True
        )
        self.pm1_membership.roles.add(self.pm_role)

        # PM 2
        self.pm2_user = get_user_model().objects.create_user(username='pm2-user', password='password')
        self.pm2_membership = Membership.objects.create(
            user=self.pm2_user, organization=self.org, is_organization_admin=False, is_default=True
        )
        self.pm2_membership.roles.add(self.pm_role)

        # Properties created by PM 1 and PM 2
        self.prop1 = Property.objects.create(
            organization=self.org, code='PROP-0001', name='Lynx PM1', created_by=self.pm1_user
        )
        self.prop2 = Property.objects.create(
            organization=self.org, code='PROP-0002', name='Eagle PM2', created_by=self.pm2_user
        )

    def test_admin_sees_all_properties(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(
            '/api/v1/property/properties/',
            HTTP_X_ORGANIZATION_ID=str(self.org.id),
            HTTP_X_PROPERTY_SCOPE='portfolio',
        )
        self.assertEqual(response.status_code, 200)
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        property_ids = [str(p['id']) for p in results]
        self.assertIn(str(self.prop1.id), property_ids)
        self.assertIn(str(self.prop2.id), property_ids)

    def test_pm_only_sees_created_properties_by_default(self):
        self.client.force_authenticate(user=self.pm1_user)
        response = self.client.get(
            '/api/v1/property/properties/',
            HTTP_X_ORGANIZATION_ID=str(self.org.id),
            HTTP_X_PROPERTY_SCOPE='portfolio',
        )
        self.assertEqual(response.status_code, 200)
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        property_ids = [str(p['id']) for p in results]
        self.assertIn(str(self.prop1.id), property_ids)
        self.assertNotIn(str(self.prop2.id), property_ids)

    def test_pm_cannot_access_unassigned_property_via_header(self):
        self.client.force_authenticate(user=self.pm1_user)
        response = self.client.get(
            f'/api/v1/property/properties/{self.prop2.id}/',
            HTTP_X_ORGANIZATION_ID=str(self.org.id),
            HTTP_X_PROPERTY_ID=str(self.prop2.id),
        )
        # Should be forbidden or not found to access PM2's property
        self.assertIn(response.status_code, [403, 404])

    def test_admin_assigning_property_grants_access_to_pm(self):
        # Admin assigns prop2 to pm1
        self.pm1_membership.assigned_properties.add(self.prop2)

        self.client.force_authenticate(user=self.pm1_user)
        response = self.client.get(
            '/api/v1/property/properties/',
            HTTP_X_ORGANIZATION_ID=str(self.org.id),
            HTTP_X_PROPERTY_SCOPE='portfolio',
        )
        self.assertEqual(response.status_code, 200)
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        property_ids = [str(p['id']) for p in results]
        self.assertIn(str(self.prop1.id), property_ids)
        self.assertIn(str(self.prop2.id), property_ids)

    def test_pm_cannot_see_tickets_from_other_properties(self):
        from companion.models import TeamFeedbackThread, TeamFeedbackMessage
        # Thread for prop1 (PM1's property)
        t1 = TeamFeedbackThread.objects.create(
            organization=self.org, property=self.prop1, title='Prop1 AC Issue',
            category=TeamFeedbackThread.FeedbackType.OPERATIONAL, issue_category='HVAC', created_by=self.pm1_user,
        )
        # Thread for prop2 (PM2's property)
        t2 = TeamFeedbackThread.objects.create(
            organization=self.org, property=self.prop2, title='Prop2 Broken Window',
            category=TeamFeedbackThread.FeedbackType.OPERATIONAL, issue_category='Maintenance', created_by=self.pm2_user,
        )

        # PM1 calls /api/v1/companion/feedback/
        self.client.force_authenticate(user=self.pm1_user)
        resp = self.client.get(
            '/api/v1/companion/feedback/',
            HTTP_X_ORGANIZATION_ID=str(self.org.id),
            HTTP_X_PROPERTY_SCOPE='portfolio',
        )
        self.assertEqual(resp.status_code, 200)
        feedback_ids = [str(item['id']) for item in (resp.data if isinstance(resp.data, list) else resp.data.get('results', []))]
        self.assertIn(str(t1.id), feedback_ids)
        self.assertNotIn(str(t2.id), feedback_ids)

        # PM1 calls /api/v1/tickets-feed/
        resp_feed = self.client.get(
            '/api/v1/tickets-feed/',
            HTTP_X_ORGANIZATION_ID=str(self.org.id),
            HTTP_X_PROPERTY_SCOPE='portfolio',
        )
        self.assertEqual(resp_feed.status_code, 200)
        feed_ids = [str(item['id']) for item in resp_feed.data.get('results', [])]
        self.assertIn(f'feedback:{t1.id}', feed_ids)
        self.assertNotIn(f'feedback:{t2.id}', feed_ids)

    def test_pm_cannot_see_developer_bug_reports(self):
        from companion.models import TeamFeedbackThread
        # Confidential developer bug report assigned to developer / admin
        bug = TeamFeedbackThread.objects.create(
            organization=self.org, property=None, title='Internal Django DB deadlock',
            category=TeamFeedbackThread.FeedbackType.BUG, issue_category='System & Developer Bug',
            created_by=self.admin_user, assigned_to=self.admin_user,
        )

        # PM1 must NOT see the bug report in companion feedback
        self.client.force_authenticate(user=self.pm1_user)
        resp = self.client.get(
            '/api/v1/companion/feedback/',
            HTTP_X_ORGANIZATION_ID=str(self.org.id),
            HTTP_X_PROPERTY_SCOPE='portfolio',
        )
        self.assertEqual(resp.status_code, 200)
        feedback_ids = [str(item['id']) for item in (resp.data if isinstance(resp.data, list) else resp.data.get('results', []))]
        self.assertNotIn(str(bug.id), feedback_ids)

        # PM1 must NOT see the bug report in tickets feed
        resp_feed = self.client.get(
            '/api/v1/tickets-feed/',
            HTTP_X_ORGANIZATION_ID=str(self.org.id),
            HTTP_X_PROPERTY_SCOPE='portfolio',
        )
        self.assertEqual(resp_feed.status_code, 200)
        feed_ids = [str(item['id']) for item in resp_feed.data.get('results', [])]
        self.assertNotIn(f'feedback:{bug.id}', feed_ids)

        # Admin CAN see the bug report
        self.client.force_authenticate(user=self.admin_user)
        admin_resp = self.client.get(
            '/api/v1/companion/feedback/',
            HTTP_X_ORGANIZATION_ID=str(self.org.id),
            HTTP_X_PROPERTY_SCOPE='portfolio',
        )
        self.assertEqual(admin_resp.status_code, 200)
        admin_feedback_ids = [str(item['id']) for item in (admin_resp.data if isinstance(admin_resp.data, list) else admin_resp.data.get('results', []))]
        self.assertIn(str(bug.id), admin_feedback_ids)

    def test_reporter_can_see_their_own_submitted_bug_report(self):
        from companion.models import TeamFeedbackThread
        # PM1 reports a bug
        pm1_bug = TeamFeedbackThread.objects.create(
            organization=self.org, property=None, title='Button unresponsive on mobile',
            category=TeamFeedbackThread.FeedbackType.BUG, issue_category='System & Developer Bug',
            created_by=self.pm1_user, assigned_to=self.admin_user,
        )

        # PM1 CAN see their own bug report
        self.client.force_authenticate(user=self.pm1_user)
        resp1 = self.client.get(
            '/api/v1/companion/feedback/',
            HTTP_X_ORGANIZATION_ID=str(self.org.id),
            HTTP_X_PROPERTY_SCOPE='portfolio',
        )
        self.assertEqual(resp1.status_code, 200)
        pm1_ids = [str(item['id']) for item in (resp1.data if isinstance(resp1.data, list) else resp1.data.get('results', []))]
        self.assertIn(str(pm1_bug.id), pm1_ids)

        # PM2 must NOT see PM1's bug report
        self.client.force_authenticate(user=self.pm2_user)
        resp2 = self.client.get(
            '/api/v1/companion/feedback/',
            HTTP_X_ORGANIZATION_ID=str(self.org.id),
            HTTP_X_PROPERTY_SCOPE='portfolio',
        )
        self.assertEqual(resp2.status_code, 200)
        pm2_ids = [str(item['id']) for item in (resp2.data if isinstance(resp2.data, list) else resp2.data.get('results', []))]
        self.assertNotIn(str(pm1_bug.id), pm2_ids)
