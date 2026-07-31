from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core.models import Module
from organizations.models import Membership, Organization
from subscriptions.models import Subscription

from .models import Building, Lease, Property, Tenant, Unit


class PropertyHierarchyTests(TestCase):
    def setUp(self):
        self.first = Organization.objects.create(name='First', slug='first')
        self.second = Organization.objects.create(name='Second', slug='second')
        self.property = Property.objects.create(organization=self.first, code='P-001', name='First Property')

    def test_building_cannot_cross_organization_boundary(self):
        building = Building(organization=self.second, property=self.property, code='A', name='Block A')
        with self.assertRaises(ValidationError):
            building.save()

    def test_unit_building_must_belong_to_selected_property(self):
        other_property = Property.objects.create(organization=self.first, code='P-002', name='Other')
        building = Building.objects.create(organization=self.first, property=other_property, code='B', name='Block B')
        unit = Unit(organization=self.first, property=self.property, building=building, code='101')

        with self.assertRaises(ValidationError):
            unit.save()


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class PropertyApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='property-user', password='test-password')
        self.organization = Organization.objects.create(name='Property Client', slug='property-client')
        self.other = Organization.objects.create(name='Other Client', slug='other-client')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True)
        Subscription.objects.create(
            organization=self.organization, module=Module.PROPERTY, status=Subscription.Status.ACTIVE,
        )
        self.property = Property.objects.create(
            organization=self.organization, code='OWN-001', name='Owned Property', status=Property.Status.ACTIVE,
        )
        self.unit = Unit.objects.create(
            organization=self.organization, property=self.property, code='101', status=Unit.Status.OCCUPIED,
        )
        self.tenant = Tenant.objects.create(
            organization=self.organization, code='TEN-1', name='A Tenant', status=Tenant.Status.ACTIVE,
        )
        Lease.objects.create(
            organization=self.organization, reference='LEASE-1', unit=self.unit, tenant=self.tenant,
            starts_on='2026-01-01', ends_on='2027-01-01', monthly_rent=Decimal('1000'),
            status=Lease.Status.ACTIVE,
        )
        Property.objects.create(organization=self.other, code='OTHER', name='Never Visible')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def test_list_is_scoped_to_active_organization(self):
        response = self.client.get('/api/v1/property/properties/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['code'] for row in response.data], ['OWN-001'])

    def test_dashboard_uses_live_organization_data(self):
        response = self.client.get('/api/v1/property/dashboard/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['kpis']['properties'], 1)
        self.assertEqual(response.data['kpis']['occupancyRate'], 100.0)
        self.assertEqual(response.data['kpis']['activeTenants'], 1)

    def test_create_assigns_organization_server_side(self):
        response = self.client.post(
            '/api/v1/property/properties/',
            {'code': 'OWN-002', 'name': 'Second Property', 'status': Property.Status.ACTIVE},
            format='json', **self.headers,
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Property.objects.filter(organization=self.organization, code='OWN-002').exists())

    def test_subscription_is_required(self):
        Subscription.objects.filter(organization=self.organization, module=Module.PROPERTY).update(is_active=False)
        response = self.client.get('/api/v1/property/properties/', **self.headers)
        self.assertEqual(response.status_code, 403)
