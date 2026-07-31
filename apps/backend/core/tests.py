from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from django.test import RequestFactory, TestCase, override_settings

from organizations.models import Membership, Organization

from .tenancy import get_active_organization, scope_to_request
from properties.models import Property


@override_settings(ALLOWED_HOSTS=['testserver'])
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

# Create your tests here.
