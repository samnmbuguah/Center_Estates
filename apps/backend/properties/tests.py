from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core.models import Module
from organizations.models import Membership, Organization
from subscriptions.models import Subscription

from .models import Building, CreditNote, Invoice, Lease, Property, ReceiptAllocation, Tenant, TenantDocument, Unit


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
        self.lease = Lease.objects.create(
            organization=self.organization, reference='LEASE-1', unit=self.unit, tenant=self.tenant,
            starts_on='2026-01-01', ends_on='2027-01-01', monthly_rent=Decimal('1000'),
            status=Lease.Status.ACTIVE,
        )
        self.invoice = Invoice.objects.create(
            organization=self.organization, number='INV-1', lease=self.lease,
            issued_on='2026-07-01', due_on='2026-07-07', amount=Decimal('1000'),
            balance=Decimal('1000'), status=Invoice.Status.OVERDUE,
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

    def test_receipt_is_atomically_allocated_and_updates_invoice(self):
        response = self.client.post('/api/v1/property/receipts/', {
            'number': 'RCT-1', 'tenant': str(self.tenant.id),
            'invoice': str(self.invoice.id), 'received_on': '2026-07-31',
            'amount': '400.00', 'payment_method': 'bank_transfer',
            'external_reference': 'BANK-001',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.balance, Decimal('600.00'))
        self.assertEqual(self.invoice.status, Invoice.Status.PARTIAL)
        allocation = ReceiptAllocation.objects.get(invoice=self.invoice)
        self.assertEqual(allocation.amount, Decimal('400.00'))
        self.assertEqual(allocation.allocated_by, self.user)

    def test_receipt_overpayment_is_rejected_without_partial_records(self):
        response = self.client.post('/api/v1/property/receipts/', {
            'number': 'RCT-BAD', 'tenant': str(self.tenant.id),
            'invoice': str(self.invoice.id), 'received_on': '2026-07-31',
            'amount': '1000.01', 'payment_method': 'cash',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(ReceiptAllocation.objects.filter(invoice=self.invoice).exists())
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.balance, Decimal('1000.00'))

    def test_credit_note_reduces_balance_and_is_immutable(self):
        response = self.client.post('/api/v1/property/credit-notes/', {
            'number': 'CN-001', 'invoice': str(self.invoice.id),
            'issued_on': '2026-07-31', 'amount': '250.00',
            'reason': 'Approved rent abatement', 'status': 'issued',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.balance, Decimal('750.00'))
        note = CreditNote.objects.get(number='CN-001')
        self.assertEqual(note.issued_by, self.user)
        self.assertEqual(self.client.patch(
            f'/api/v1/property/credit-notes/{note.id}/', {'amount': '100'},
            format='json', **self.headers,
        ).status_code, 400)

    def test_tenant_document_verification_is_scoped_and_audited(self):
        response = self.client.post('/api/v1/property/tenant-documents/', {
            'tenant': str(self.tenant.id), 'document_type': 'tax_certificate',
            'document_number': 'P0001', 'file_url': '/media/tenants/P0001.pdf',
            'issued_on': '2026-01-01', 'expires_on': '2027-01-01',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        verified = self.client.post(
            f"/api/v1/property/tenant-documents/{response.data['id']}/verify/",
            {}, format='json', **self.headers,
        )
        self.assertEqual(verified.status_code, 200, verified.data)
        document = TenantDocument.objects.get(pk=response.data['id'])
        self.assertEqual(document.status, TenantDocument.Status.VERIFIED)
        self.assertEqual(document.verified_by, self.user)
