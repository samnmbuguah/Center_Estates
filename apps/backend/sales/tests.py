from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Module
from organizations.models import Membership, Organization
from properties.models import Project, Property, Unit
from subscriptions.models import Subscription

from .models import Buyer, PropertySale, SaleListing, SalePayment


class SalesIntegrityTests(TestCase):
    def test_listing_cannot_cross_organization_boundary(self):
        first = Organization.objects.create(name='First', slug='sales-first')
        second = Organization.objects.create(name='Second', slug='sales-second')
        prop = Property.objects.create(organization=first, code='P1', name='First')
        unit = Unit.objects.create(organization=first, property=prop, code='U1')
        project = Project.objects.create(organization=first, property=prop, code='PR1', name='Project')
        listing = SaleListing(organization=second, unit=unit, project=project, list_price=1)
        with self.assertRaises(ValidationError):
            listing.save()


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class SalesApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='sales-user', password='test')
        self.organization = Organization.objects.create(name='Sales Client', slug='sales-client')
        self.other = Organization.objects.create(name='Other Sales Client', slug='other-sales-client')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True)
        Subscription.objects.create(organization=self.organization, module=Module.SALES, status=Subscription.Status.ACTIVE)
        prop = Property.objects.create(organization=self.organization, code='P1', name='Development')
        unit = Unit.objects.create(organization=self.organization, property=prop, code='A-01')
        project = Project.objects.create(organization=self.organization, property=prop, code='PR1', name='Development Project')
        self.listing = SaleListing.objects.create(organization=self.organization, unit=unit, project=project, list_price=Decimal('10000000'))
        self.buyer = Buyer.objects.create(organization=self.organization, reference='B1', full_name='Buyer One', email='buyer@example.com', phone='0700', id_number='ID1', status=Buyer.Status.ACTIVE)
        self.sale = PropertySale.objects.create(organization=self.organization, reference='S1', buyer=self.buyer, listing=self.listing, agent=self.user, agreed_price=Decimal('9500000'), status=PropertySale.Status.CONTRACTED)
        SalePayment.objects.create(organization=self.organization, reference='PAY1', sale=self.sale, paid_on=timezone.localdate(), amount=Decimal('1000000'), method='bank', external_reference='EXT1', status=SalePayment.Status.VERIFIED)
        other_prop = Property.objects.create(organization=self.other, code='OP', name='Hidden')
        other_unit = Unit.objects.create(organization=self.other, property=other_prop, code='OU')
        other_project = Project.objects.create(organization=self.other, property=other_prop, code='OPR', name='Hidden')
        SaleListing.objects.create(organization=self.other, unit=other_unit, project=other_project, list_price=1)
        self.client = APIClient(); self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def test_inventory_is_tenant_scoped(self):
        response = self.client.get('/api/v1/sales/inventory/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_dashboard_aggregates_verified_revenue(self):
        response = self.client.get('/api/v1/sales/dashboard/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Decimal(response.data['kpis']['verifiedPayments']), Decimal('1000000'))
        self.assertEqual(response.data['kpis']['activeBuyers'], 1)

    def test_duplicate_external_payment_reference_is_rejected(self):
        response = self.client.post('/api/v1/sales/payments/', {
            'reference': 'PAY2', 'sale': str(self.sale.id), 'paid_on': str(timezone.localdate()),
            'amount': '500', 'method': 'bank', 'external_reference': 'EXT1', 'status': 'pending',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 400)

    def test_sales_subscription_is_required(self):
        Subscription.objects.filter(organization=self.organization, module=Module.SALES).update(is_active=False)
        self.assertEqual(self.client.get('/api/v1/sales/dashboard/', **self.headers).status_code, 403)
