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

from .models import AgentCommission, Buyer, Installment, PropertySale, SaleListing, SalePayment, SalesAuditEvent


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
        self.installment = Installment.objects.create(
            organization=self.organization, sale=self.sale, sequence=1,
            description='Deposit balance', due_on=timezone.localdate(),
            amount=Decimal('1000000'), status=Installment.Status.DUE,
        )
        self.pending_payment = SalePayment.objects.create(
            organization=self.organization, reference='PAY-PENDING', sale=self.sale,
            installment=self.installment, paid_on=timezone.localdate(),
            amount=Decimal('1000000'), method='bank', external_reference='EXT-PENDING',
            status=SalePayment.Status.PENDING,
        )
        self.commission = AgentCommission.objects.create(
            organization=self.organization, reference='COM-1', sale=self.sale,
            agent=self.user, rate_percent=Decimal('2'), amount=Decimal('190000'),
            required_paid_percent=Decimal('20'), status=AgentCommission.Status.PENDING,
        )
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

    def test_pending_payment_verification_allocates_installment_and_unlocks_commission(self):
        response = self.client.post(
            f'/api/v1/sales/payments/{self.pending_payment.id}/verify/', {},
            format='json', **self.headers,
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.pending_payment.refresh_from_db(); self.installment.refresh_from_db(); self.commission.refresh_from_db()
        self.assertEqual(self.pending_payment.status, SalePayment.Status.VERIFIED)
        self.assertEqual(self.pending_payment.verified_by, self.user)
        self.assertEqual(self.installment.paid_amount, Decimal('1000000'))
        self.assertEqual(self.installment.status, Installment.Status.PAID)
        self.assertEqual(self.commission.status, AgentCommission.Status.ELIGIBLE)
        self.assertTrue(SalesAuditEvent.objects.filter(payment=self.pending_payment, event_type='payment_verified').exists())

    def test_verified_payment_reversal_rolls_back_allocation_and_eligibility(self):
        self.client.post(f'/api/v1/sales/payments/{self.pending_payment.id}/verify/', {}, format='json', **self.headers)
        response = self.client.post(
            f'/api/v1/sales/payments/{self.pending_payment.id}/reverse/',
            {'reason': 'Bank recalled duplicate transfer'}, format='json', **self.headers,
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.pending_payment.refresh_from_db(); self.installment.refresh_from_db(); self.commission.refresh_from_db()
        self.assertEqual(self.pending_payment.status, SalePayment.Status.REVERSED)
        self.assertEqual(self.installment.paid_amount, Decimal('0'))
        self.assertEqual(self.commission.status, AgentCommission.Status.PENDING)

    def test_api_cannot_create_preverified_or_delete_payment(self):
        response = self.client.post('/api/v1/sales/payments/', {
            'reference': 'PAY-NEW', 'sale': str(self.sale.id),
            'installment': str(self.installment.id), 'paid_on': str(timezone.localdate()),
            'amount': '100', 'method': 'bank', 'external_reference': 'EXT-NEW',
            'status': SalePayment.Status.VERIFIED,
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(SalePayment.objects.get(reference='PAY-NEW').status, SalePayment.Status.PENDING)
        self.assertEqual(self.client.delete(
            f'/api/v1/sales/payments/{self.pending_payment.id}/', **self.headers,
        ).status_code, 400)

    def test_sale_cannot_complete_before_full_verified_payment(self):
        response = self.client.post(
            f'/api/v1/sales/sales/{self.sale.id}/transition/',
            {'status': PropertySale.Status.COMPLETED}, format='json', **self.headers,
        )
        self.assertEqual(response.status_code, 400)
        self.sale.refresh_from_db()
        self.assertEqual(self.sale.status, PropertySale.Status.CONTRACTED)
