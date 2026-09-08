from datetime import date, datetime, timedelta
from decimal import Decimal
import hashlib
import hmac
import json
import os
import tempfile
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Module
from organizations.models import Membership, MembershipRole, Organization, Permission, Role
from subscriptions.models import Subscription
from facilities.models import MeterReading, ServiceRequest, UtilityMeter
from notifications.models import Notification

from .models import (
    BankTransaction, BillingCandidate, BillingItem, BillingProfile, BillingReadinessIssue, BillingRun,
    Budget, Building, CreditNote, Expense, Invoice, InvoiceLine,
    InvoiceReminder, Lease, PaymentGatewayConfiguration, PaymentIntent,
    PaymentWebhookEvent, Property, Receipt, ReceiptAllocation, RentSchedule,
    ReportDefinition, ReportExecution, ScheduledReport, ServiceCharge, ServiceChargeAllocation,
    ServiceChargeReconciliation, Tenant, TenantDocument, TenantPortalAccess,
    TaxConfiguration, TenantMovement, Unit, UnitChargeRule, UnitStatusHistory, ParkingSpace, ParkingAssignment,
    Owner, PropertyCollectionAccount, PropertyFeeProfile, PayerWallet,
    LandlordInvoice,
)


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
        self.user = get_user_model().objects.create_user(
            username='property-user', email='manager@example.com', password='test-password',
        )
        self.organization = Organization.objects.create(name='Property Client', slug='property-client')
        self.other = Organization.objects.create(name='Other Client', slug='other-client')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True, is_organization_admin=True)
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

    def test_owner_register_and_unit_counts_follow_active_property(self):
        current_owner = Owner.objects.create(
            organization=self.organization, code='OWN-0101', name='Current Property Owner',
        )
        self.unit.owner = current_owner
        self.unit.save(update_fields=('owner', 'updated_at'))
        other_property = Property.objects.create(
            organization=self.organization, code='OWN-002', name='Second Property', status=Property.Status.ACTIVE,
        )
        other_owner = Owner.objects.create(
            organization=self.organization, code='OWN-0102', name='Other Property Owner',
        )
        Unit.objects.create(
            organization=self.organization, property=other_property, owner=other_owner, code='101',
        )
        Unit.objects.create(
            organization=self.organization, property=other_property, owner=current_owner, code='102',
        )

        response = self.client.get(
            '/api/v1/property/owners/',
            **{**self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id)},
        )

        self.assertEqual(response.status_code, 200, response.data)
        rows = response.data if isinstance(response.data, list) else response.data['results']
        self.assertEqual([row['name'] for row in rows], ['Current Property Owner'])
        self.assertEqual(rows[0]['units_count'], 1)
        self.assertEqual([unit['property_id'] for unit in rows[0]['units_list']], [str(self.property.id)])

    def test_tenant_register_searches_by_house_or_unit_number(self):
        response = self.client.get(
            '/api/v1/property/tenants/?search=101',
            **{**self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id)},
        )

        self.assertEqual(response.status_code, 200, response.data)
        rows = response.data if isinstance(response.data, list) else response.data['results']
        self.assertEqual([row['id'] for row in rows], [str(self.tenant.id)])

    def test_owner_service_charge_invoice_uses_unit_owner_and_collection_route(self):
        owner = Owner.objects.create(
            organization=self.organization, code='OWN-0201', name='Unit 101 Owner',
        )
        self.unit.owner = owner
        self.unit.service_charge_payer = Unit.PayerChoice.OWNER
        self.unit.common_area_fee_amount = Decimal('5000.00')
        self.unit.save(update_fields=('owner', 'service_charge_payer', 'common_area_fee_amount', 'updated_at'))
        account = PropertyCollectionAccount.objects.create(
            organization=self.organization, property=self.property,
            charge_type='service_charge', bank_name='NCBA', account_name='Service Charge',
            account_number='100200', mpesa_paybill='522522', mpesa_reference_format='SC-{UNIT}-{MONTH}-{YEAR}',
        )

        response = self.client.post(
            '/api/v1/property/invoices/',
            {
                'recipient_type': 'owner', 'owner': str(owner.id), 'unit': str(self.unit.id),
                'invoice_type': 'service_charge', 'charge_type': 'service_charge',
                'subtotal': '5000.00', 'tax_rate': '0.00',
                'issued_on': '2026-09-01', 'due_on': '2026-09-30',
            },
            format='json', **{**self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id)},
        )

        self.assertEqual(response.status_code, 201, response.data)
        invoice = Invoice.objects.get(pk=response.data['id'])
        self.assertEqual(invoice.owner, owner)
        self.assertEqual(invoice.recipient_type, Invoice.RecipientType.OWNER)
        self.assertEqual(invoice.collection_account, account)
        self.assertEqual(invoice.mpesa_reference, 'SC-101-09-2026')

    def test_list_is_scoped_to_active_organization(self):
        response = self.client.get('/api/v1/property/properties/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['code'] for row in response.data], ['OWN-001'])

    def test_unallocated_receipt_remains_visible_in_its_property_ledger(self):
        receipt = Receipt.objects.create(
            organization=self.organization,
            number='RCPT-UNALLOCATED-1',
            tenant=self.tenant,
            received_on='2026-08-01',
            amount=Decimal('500.00'),
            payment_method='bank_transfer',
            received_by=self.user,
        )
        response = self.client.get(
            '/api/v1/property/receipts/',
            **{**self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id)},
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn(str(receipt.id), [row['id'] for row in response.data])

    def test_receipt_auto_allocates_by_charge_priority_and_keeps_excess_as_credit(self):
        utilities = Invoice.objects.create(
            organization=self.organization, number='INV-UTIL-1', lease=self.lease,
            charge_type='utilities', invoice_type='utilities', issued_on='2026-07-01', due_on='2026-07-02',
            subtotal=Decimal('100.00'), tax_rate=Decimal('16.00'), tax_amount=Decimal('16.00'),
            amount=Decimal('116.00'), balance=Decimal('116.00'), status=Invoice.Status.ISSUED,
        )
        response = self.client.post('/api/v1/property/receipts/', {
            'tenant': str(self.tenant.id), 'payer_type': 'tenant', 'paying_for': 'rent',
            'received_on': '2026-08-01', 'amount': '1216.00', 'payment_method': 'bank_transfer',
            'external_reference': 'TEST-PRIORITY-1',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['paying_for'], Receipt.PayingFor.AUTOMATIC)
        utilities.refresh_from_db()
        self.invoice.refresh_from_db()
        self.assertEqual(utilities.status, Invoice.Status.PAID)
        self.assertEqual(self.invoice.status, Invoice.Status.PAID)
        wallet = PayerWallet.objects.get(organization=self.organization, tenant=self.tenant)
        components = list(ReceiptAllocation.objects.filter(receipt_id=response.data['id']).values_list('component', flat=True))
        self.assertEqual(components[0], ReceiptAllocation.Component.VAT)

    def test_receipt_automatically_allocates_overpayment_and_credits_wallet(self):
        # Invoice balance is 1000.00 (from setUp), receipt amount is 1500.00
        response = self.client.post('/api/v1/property/receipts/', {
            'tenant': str(self.tenant.id),
            'payer_type': 'tenant', 'paying_for': 'rent',
            'received_on': '2026-08-01', 'amount': '1500.00', 'payment_method': 'mpesa',
            'external_reference': 'TEST-OVERPAY-1',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, Invoice.Status.PAID)
        self.assertEqual(self.invoice.balance, Decimal('0.00'))
        wallet = PayerWallet.objects.get(organization=self.organization, tenant=self.tenant)
        self.assertEqual(wallet.balance, Decimal('500.00'))

    def test_receipt_rejects_duplicate_payment_reference_case_insensitively(self):
        first = self.client.post('/api/v1/property/receipts/', {
            'tenant': str(self.tenant.id), 'payer_type': 'tenant',
            'received_on': '2026-08-01', 'amount': '500.00', 'payment_method': 'mpesa',
            'external_reference': ' UI6L15UYKG ',
        }, format='json', **self.headers)
        self.assertEqual(first.status_code, 201, first.data)

        duplicate = self.client.post('/api/v1/property/receipts/', {
            'tenant': str(self.tenant.id), 'payer_type': 'tenant',
            'received_on': '2026-08-02', 'amount': '500.00', 'payment_method': 'mpesa',
            'external_reference': 'ui6l15uykg',
        }, format='json', **self.headers)
        self.assertEqual(duplicate.status_code, 400, duplicate.data)
        self.assertIn('already been receipted', str(duplicate.data['external_reference'][0]))
        self.assertEqual(Receipt.objects.filter(external_reference_key='UI6L15UYKG').count(), 1)

    def test_mpesa_receipt_requires_transaction_code(self):
        response = self.client.post('/api/v1/property/receipts/', {
            'tenant': str(self.tenant.id), 'payer_type': 'tenant',
            'received_on': '2026-08-01', 'amount': '500.00', 'payment_method': 'mpesa',
            'external_reference': '',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('M-Pesa transaction code', str(response.data['external_reference'][0]))

    def test_dashboard_uses_live_organization_data(self):

        response = self.client.get('/api/v1/property/dashboard/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['kpis']['properties'], 1)
        self.assertEqual(response.data['kpis']['occupancyRate'], 100.0)
        self.assertEqual(response.data['kpis']['activeTenants'], 1)
        self.assertEqual(response.data['portfolio'][0]['name'], 'Owned Property')
        self.assertEqual(response.data['portfolio'][0]['occupied'], 1)
        self.assertIsNone(response.data['propertySummary'])
        self.assertEqual(len(response.data['aging']), 4)
        self.assertTrue(response.data['collectionTrend'])
        july = next(point for point in response.data['collectionTrend'] if point['month'] == 'Jul')
        self.assertEqual(july['expected'], Decimal('1000'))
        self.assertEqual(july['actual'], Decimal('0'))

    def test_dashboard_separates_selected_property_from_portfolio_scope(self):
        second = Property.objects.create(
            organization=self.organization, code='OWN-002', name='Second Property', status=Property.Status.ACTIVE,
        )
        Unit.objects.create(
            organization=self.organization, property=second, code='201', status=Unit.Status.AVAILABLE,
        )

        scoped = self.client.get(
            '/api/v1/property/dashboard/',
            **{**self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id)},
        )
        self.assertEqual(scoped.status_code, 200)
        self.assertEqual(scoped.data['kpis']['properties'], 1)
        self.assertEqual(scoped.data['kpis']['units'], 1)
        self.assertEqual(scoped.data['propertySummary']['name'], 'Owned Property')
        self.assertEqual([row['name'] for row in scoped.data['portfolio']], ['Owned Property'])

        portfolio = self.client.get(
            '/api/v1/property/dashboard/',
            **{**self.headers, 'HTTP_X_PROPERTY_SCOPE': 'portfolio'},
        )
        self.assertEqual(portfolio.status_code, 200)
        self.assertEqual(portfolio.data['kpis']['properties'], 2)
        self.assertIsNone(portfolio.data['propertySummary'])
        self.assertCountEqual([row['name'] for row in portfolio.data['portfolio']], ['Owned Property', 'Second Property'])

    def test_effective_dated_billing_and_reporting_foundation_is_scoped_and_persisted(self):
        tax = self.client.post('/api/v1/property/tax-configurations/', {
            'code': 'VAT16', 'name': 'Output VAT', 'rate': '16.0000',
            'effective_from': '2026-01-01', 'is_active': True,
        }, format='json', **self.headers)
        self.assertEqual(tax.status_code, 201, tax.data)
        item = self.client.post('/api/v1/property/billing-items/', {
            'code': 'RENT', 'name': 'Monthly rent', 'calculation': 'fixed',
            'income_category': 'rent', 'tax_configuration': tax.data['id'],
            'is_recurring': True, 'is_active': True,
        }, format='json', **self.headers)
        self.assertEqual(item.status_code, 201, item.data)
        profile = self.client.post('/api/v1/property/billing-profiles/', {
            'lease': str(self.lease.id), 'billing_item': item.data['id'], 'frequency': 'monthly',
            'calculation': 'fixed', 'amount': '1000.00', 'rate': '0',
            'effective_from': '2026-01-01', 'billing_day': 1, 'custom_interval_months': 1,
        }, format='json', **self.headers)
        self.assertEqual(profile.status_code, 201, profile.data)
        self.assertEqual(profile.data['tenant_name'], self.tenant.name)
        run = self.client.post('/api/v1/property/billing-runs/', {
            'property': str(self.property.id), 'period_start': '2026-08-01', 'period_end': '2026-08-31',
        }, format='json', **self.headers)
        self.assertEqual(run.status_code, 201, run.data)
        self.assertEqual(run.data['status'], BillingRun.Status.PREPARING)
        definition = self.client.post('/api/v1/property/report-definitions/', {
            'key': 'monthly-tenancy', 'name': 'Monthly tenancy schedule', 'domain': 'tenancy',
            'selected_fields': ['tenant', 'unit', 'rent'], 'default_filters': {},
        }, format='json', **self.headers)
        self.assertEqual(definition.status_code, 201, definition.data)
        scheduled = self.client.post('/api/v1/property/scheduled-reports/', {
            'definition': definition.data['id'], 'property': str(self.property.id),
            'frequency': 'monthly', 'next_run_at': '2026-09-01T06:00:00Z',
            'recipients': ['manager@example.com'], 'filters': {}, 'output_format': 'pdf',
        }, format='json', **self.headers)
        self.assertEqual(scheduled.status_code, 201, scheduled.data)
        self.assertEqual(BillingProfile.objects.count(), 1)
        self.assertEqual(ScheduledReport.objects.count(), 1)

    def test_unit_status_and_tenant_movements_are_immutable_history(self):
        status = self.client.post('/api/v1/property/unit-status-history/', {
            'unit': str(self.unit.id), 'status': Unit.Status.OCCUPIED,
            'effective_from': '2026-01-01', 'reason': 'Lease commenced',
            'expected_monthly_rent': '1000.00', 'expected_service_charge': '100.00',
        }, format='json', **self.headers)
        self.assertEqual(status.status_code, 201, status.data)
        movement = self.client.post('/api/v1/property/tenant-movements/', {
            'tenant': str(self.tenant.id), 'lease': str(self.lease.id), 'unit': str(self.unit.id),
            'kind': TenantMovement.Kind.MOVE_IN, 'effective_on': '2026-01-01',
        }, format='json', **self.headers)
        self.assertEqual(movement.status_code, 201, movement.data)
        self.assertEqual(self.client.patch(
            f"/api/v1/property/tenant-movements/{movement.data['id']}/", {'reason': 'Changed'}, format='json', **self.headers,
        ).status_code, 400)
        self.assertEqual(UnitStatusHistory.objects.count(), 1)

    def test_scheduled_billing_run_prepares_approves_and_generates_itemized_invoice(self):
        tax = TaxConfiguration.objects.create(
            organization=self.organization, code='VAT16', name='Output VAT', rate=Decimal('16'),
            effective_from='2026-01-01', is_active=True,
        )
        rent_item = BillingItem.objects.create(
            organization=self.organization, code='RENT', name='Rent',
            calculation=BillingItem.Calculation.FIXED, income_category='rent', tax_configuration=tax,
        )
        BillingProfile.objects.create(
            organization=self.organization, lease=self.lease, billing_item=rent_item,
            frequency=BillingProfile.Frequency.MONTHLY, calculation=BillingItem.Calculation.FIXED,
            amount=Decimal('1000'), effective_from='2026-01-01', billing_day=5,
        )
        created = self.client.post('/api/v1/property/billing-runs/', {
            'property': str(self.property.id), 'period_start': '2026-08-01', 'period_end': '2026-08-31',
        }, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        run_url = f"/api/v1/property/billing-runs/{created.data['id']}/"
        prepared = self.client.post(f'{run_url}prepare/', {}, format='json', **self.headers)
        self.assertEqual(prepared.status_code, 200, prepared.data)
        self.assertEqual(prepared.data['totals']['ready'], 1)
        self.assertEqual(prepared.data['totals']['amount_ready'], '1160.00')
        candidate = prepared.data['candidates'][0]
        self.assertEqual(candidate['status'], BillingCandidate.Status.READY)
        approved = self.client.post(f'{run_url}approve/', {}, format='json', **self.headers)
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data['status'], BillingRun.Status.APPROVED)
        self.assertEqual(BillingRun.objects.get(pk=created.data['id']).approved_by, self.user)
        generated = self.client.post(f'{run_url}generate/', {
            'candidate_ids': [candidate['id']],
        }, format='json', **self.headers)
        self.assertEqual(generated.status_code, 201, generated.data)
        self.assertEqual(generated.data['generated_count'], 1)
        invoice = Invoice.objects.get(number='INV-2026-000001')
        self.assertEqual(invoice.status, Invoice.Status.ISSUED)
        self.assertEqual(invoice.amount, Decimal('1160.00'))
        self.assertEqual(invoice.metadata['billing_period'], '2026-08')
        self.assertEqual(InvoiceLine.objects.get(invoice=invoice).description, 'Rent')
        replayed = self.client.post(f'{run_url}generate/', {
            'candidate_ids': [candidate['id']],
        }, format='json', **self.headers)
        self.assertEqual(replayed.status_code, 200, replayed.data)
        self.assertTrue(replayed.data['replayed'])
        self.assertEqual(replayed.data['generated_count'], 0)
        self.assertEqual(Invoice.objects.filter(metadata__billing_run_id=str(created.data['id'])).count(), 1)

    def test_direct_landlord_occupancy_is_utility_only_even_with_inherited_charge_rules(self):
        """A sold-unit tenant remains occupied and utility-billable, not rent/SC billable."""
        owner = Owner.objects.create(
            organization=self.organization, code='OWN-DIRECT-1', name='Direct Rent Owner',
        )
        direct_unit = Unit.objects.create(
            organization=self.organization, property=self.property, code='DIRECT-101', owner=owner,
            status=Unit.Status.OCCUPIED, service_charge_payer=Unit.PayerChoice.OWNER,
        )
        direct_tenant = Tenant.objects.create(
            organization=self.organization, code='TEN-DIRECT-1', name='Utility-only Occupant', status=Tenant.Status.ACTIVE,
        )
        direct_lease = Lease.objects.create(
            organization=self.organization, reference='LEASE-DIRECT-1', unit=direct_unit, tenant=direct_tenant,
            starts_on='2026-01-01', ends_on='2027-01-01', monthly_rent=Decimal('0.00'), status=Lease.Status.ACTIVE,
            metadata={'rent_collection_mode': 'direct_landlord', 'bill_rent': False, 'bill_service_charge': False, 'bill_utilities': True},
        )
        rent = BillingItem.objects.create(
            organization=self.organization, code='RENT', name='Rent', calculation=BillingItem.Calculation.FIXED,
        )
        service_charge = BillingItem.objects.create(
            organization=self.organization, code='SERVICE_CHARGE', name='Service charge', calculation=BillingItem.Calculation.FIXED,
        )
        water = BillingItem.objects.create(
            organization=self.organization, code='WATER', name='Water', calculation=BillingItem.Calculation.FIXED,
        )
        for item, amount in ((rent, '45000'), (service_charge, '5000'), (water, '1200')):
            BillingProfile.objects.create(
                organization=self.organization, lease=direct_lease, billing_item=item,
                frequency=BillingProfile.Frequency.MONTHLY, calculation=BillingItem.Calculation.FIXED,
                amount=Decimal(amount), effective_from='2026-01-01', billing_day=1,
            )

        run = BillingRun.objects.create(
            organization=self.organization, property=self.property,
            period_start=date(2026, 8, 1), period_end=date(2026, 8, 31), created_by=self.user,
        )
        prepared = self.client.post(f'/api/v1/property/billing-runs/{run.id}/prepare/', {}, format='json', **self.headers)
        self.assertEqual(prepared.status_code, 200, prepared.data)
        candidate = BillingCandidate.objects.get(billing_run=run, lease=direct_lease)
        self.assertEqual(candidate.status, BillingCandidate.Status.READY)
        self.assertEqual([item['code'] for item in candidate.billing_items], ['SERVICE_CHARGE', 'WATER'])
        self.assertEqual(candidate.billing_items[0]['payer'], 'owner')
        self.assertEqual(candidate.billing_items[1]['payer'], 'tenant')
        self.assertEqual(candidate.total, Decimal('6200.00'))

        approved = self.client.post(f'/api/v1/property/billing-runs/{run.id}/approve/', {}, format='json', **self.headers)
        self.assertEqual(approved.status_code, 200, approved.data)
        generated = self.client.post(f'/api/v1/property/billing-runs/{run.id}/generate/', {
            'candidate_ids': [str(candidate.id)],
        }, format='json', **self.headers)
        self.assertEqual(generated.status_code, 201, generated.data)
        owner_invoice = Invoice.objects.get(lease=direct_lease, invoice_type='service_charge')
        utility_invoice = Invoice.objects.get(lease=direct_lease, invoice_type='water')
        self.assertEqual(owner_invoice.recipient_type, Invoice.RecipientType.OWNER)
        self.assertEqual(owner_invoice.owner_id, owner.id)
        self.assertEqual(utility_invoice.recipient_type, Invoice.RecipientType.TENANT)

        occupancy = self.client.get(f'/api/v1/property/units/{direct_unit.id}/', **self.headers)
        self.assertEqual(occupancy.status_code, 200, occupancy.data)
        self.assertEqual(occupancy.data['tenant_name'], 'Utility-only Occupant')
        self.assertEqual(occupancy.data['occupancy_state'], 'sold_tenant_unmanaged')
        self.assertFalse(occupancy.data['billing_isolation']['bill_rent'])
        self.assertTrue(occupancy.data['billing_isolation']['bill_utilities_to_tenant'])

    def test_unit_charge_rules_are_inherited_and_charges_generate_separate_invoices(self):
        water = BillingItem.objects.create(
            organization=self.organization, code='WATER', name='Water consumption',
            calculation=BillingItem.Calculation.FIXED, income_category='utilities',
        )
        deposit_item = BillingItem.objects.create(
            organization=self.organization, code='SECURITY_DEPOSIT', name='Security deposit',
            calculation=BillingItem.Calculation.FIXED, income_category='refundable_deposits', is_recurring=False,
        )
        unit = Unit.objects.create(
            organization=self.organization, property=self.property, code='RULE-01',
            status=Unit.Status.AVAILABLE, area=Decimal('500'),
        )
        rule = self.client.post('/api/v1/property/unit-charge-rules/', {
            'unit': str(unit.id), 'billing_item': str(water.id), 'frequency': 'monthly',
            'calculation': 'fixed', 'amount': '750.00', 'rate': '0', 'billing_day': 5,
        }, format='json', **self.headers)
        self.assertEqual(rule.status_code, 201, rule.data)
        UnitChargeRule.objects.create(
            organization=self.organization, unit=unit, billing_item=deposit_item,
            frequency=UnitChargeRule.Frequency.ONE_OFF, calculation='fixed', amount=Decimal('100000'),
        )

        onboarded = self.client.post('/api/v1/property/tenants/onboard/', {
            'tenant': {'name': 'Unit Rule Tenant', 'tenant_type': 'company'},
            'lease': {
                'unit': str(unit.id), 'starts_on': '2026-09-01', 'term_months': 12,
                'monthly_rent': '50000', 'billing_day': 5, 'vat_rate': 0,
            },
        }, format='json', **self.headers)
        self.assertEqual(onboarded.status_code, 201, onboarded.data)
        lease = Lease.objects.get(pk=onboarded.data['lease']['id'])
        inherited = lease.billing_profiles.get(billing_item=water)
        self.assertEqual(inherited.amount, Decimal('750'))
        self.assertEqual(inherited.effective_from, date(2026, 9, 1))
        self.assertEqual(lease.deposit, Decimal('100000'))
        self.assertTrue(lease.billing_profiles.filter(billing_item=deposit_item, frequency='one_off').exists())

        lease.status = Lease.Status.ACTIVE
        lease.save(update_fields=('status',))
        created = self.client.post('/api/v1/property/billing-runs/', {
            'property': str(self.property.id), 'period_start': '2026-09-01', 'period_end': '2026-09-30',
        }, format='json', **self.headers)
        run_url = f"/api/v1/property/billing-runs/{created.data['id']}/"
        prepared = self.client.post(f'{run_url}prepare/', {}, format='json', **self.headers)
        candidate = next(row for row in prepared.data['candidates'] if row['lease_reference'] == lease.reference)
        approver = self._create_billing_approver()
        self.client.force_authenticate(approver)
        self.assertEqual(self.client.post(f'{run_url}approve/', {}, format='json', **self.headers).status_code, 200)
        self.client.force_authenticate(self.user)
        generated = self.client.post(f'{run_url}generate/', {'candidate_ids': [candidate['id']]}, format='json', **self.headers)
        self.assertEqual(generated.status_code, 201, generated.data)
        self.assertEqual(generated.data['generated_count'], 3)
        invoices = Invoice.objects.filter(metadata__billing_candidate_id=candidate['id'])
        self.assertEqual(set(invoices.values_list('invoice_type', flat=True)), {'rent', 'water', 'security_deposit'})
        self.assertEqual(sum(invoices.values_list('amount', flat=True), Decimal('0')), Decimal('150750'))

    def _create_billing_approver(self):
        approver = get_user_model().objects.create_user(
            username=f'billing-approver-{get_user_model().objects.count()}',
            password='test-password',
        )
        Membership.objects.create(user=approver, organization=self.organization, is_organization_admin=True)
        return approver

    def _create_role_user(self, username, *permission_keys):
        user = get_user_model().objects.create_user(username=username, password='test-password')
        membership = Membership.objects.create(user=user, organization=self.organization, is_organization_admin=False)
        role = Role.objects.create(
            organization=self.organization, name=f'Role {username}', slug=f'role-{username}',
        )
        MembershipRole.objects.create(membership=membership, role=role)
        for key in permission_keys:
            permission, _ = Permission.objects.get_or_create(
                key=key, defaults={'label': key, 'module': key.split('.')[0]},
            )
            role.permissions.add(permission)
        return user

    def _prepare_run(self, period_start='2026-08-01', period_end='2026-08-31', property_id=None):
        property_pk = property_id or self.property.id
        BillingRun.objects.filter(
            organization=self.organization, property_id=property_pk, period_start=period_start,
        ).delete()
        created = self.client.post('/api/v1/property/billing-runs/', {
            'property': str(property_pk),
            'period_start': period_start, 'period_end': period_end,
        }, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        run_url = f"/api/v1/property/billing-runs/{created.data['id']}/"
        prepared = self.client.post(f'{run_url}prepare/', {}, format='json', **self.headers)
        self.assertEqual(prepared.status_code, 200, prepared.data)
        return created.data['id'], run_url, prepared.data

    def test_readiness_issue_override_requires_approver_notes_and_unlocks_run(self):
        sc_item = BillingItem.objects.create(
            organization=self.organization, code='SERVICE_CHARGE', name='Service charge',
            calculation=BillingItem.Calculation.FIXED, income_category='service_charge',
        )
        BillingProfile.objects.create(
            organization=self.organization, lease=self.lease, billing_item=sc_item,
            frequency=BillingProfile.Frequency.MONTHLY, calculation=BillingItem.Calculation.FIXED,
            amount=Decimal('0'), effective_from='2026-01-01', billing_day=1,
        )
        run_id, run_url, prepared = self._prepare_run()
        self.assertEqual(prepared['totals']['with_issues'], 1)
        self.assertEqual(prepared['candidates'][0]['status'], BillingCandidate.Status.ISSUE)
        issue = next(row for row in prepared['issues'] if row['code'] == 'missing_rate')

        resolved = self.client.post(f'{run_url}resolve-issue/', {
            'issue': issue['id'], 'status': 'resolved', 'notes': 'Source corrected offline',
        }, format='json', **self.headers)
        self.assertEqual(resolved.status_code, 400)
        self.assertIn('Correct source data', str(resolved.data))

        missing_notes = self.client.post(f'{run_url}resolve-issue/', {
            'issue': issue['id'], 'status': 'overridden', 'notes': '   ',
        }, format='json', **self.headers)
        self.assertEqual(missing_notes.status_code, 400)
        self.assertIn('notes', missing_notes.data)

        finance_only = self._create_role_user(
            'billing-finance-only', 'property.view', 'property.finance',
        )
        self.client.force_authenticate(finance_only)
        forbidden = self.client.post(f'{run_url}resolve-issue/', {
            'issue': issue['id'], 'status': 'overridden',
            'notes': 'Finance-only attempt without approve permission',
        }, format='json', **self.headers)
        self.assertEqual(forbidden.status_code, 403)

        approver = self._create_role_user(
            'billing-issue-approver', 'property.view', 'property.approve',
        )
        self.client.force_authenticate(approver)
        overridden = self.client.post(f'{run_url}resolve-issue/', {
            'issue': issue['id'], 'status': 'overridden',
            'notes': 'Verified zero service charge for vacant amenity month; follow-up with FM.',
        }, format='json', **self.headers)
        self.assertEqual(overridden.status_code, 200, overridden.data)
        self.assertEqual(overridden.data['status'], BillingReadinessIssue.Status.OVERRIDDEN)

        refreshed = self.client.get(run_url, **self.headers)
        self.assertEqual(refreshed.status_code, 200, refreshed.data)
        self.assertEqual(refreshed.data['totals']['ready'], 1)
        self.assertEqual(refreshed.data['totals']['with_issues'], 0)
        self.assertEqual(refreshed.data['candidates'][0]['status'], BillingCandidate.Status.READY)
        self.assertEqual(Decimal(refreshed.data['totals']['amount_ready']), Decimal('1000.00'))

        approved = self.client.post(f'{run_url}approve/', {}, format='json', **self.headers)
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data['status'], BillingRun.Status.APPROVED)
        self.client.force_authenticate(self.user)

    def test_billing_frequencies_effective_dates_escalation_and_expired_leases(self):
        fee_item = BillingItem.objects.create(
            organization=self.organization, code='MGMT_FEE', name='Management fee',
            calculation=BillingItem.Calculation.FIXED, income_category='other',
        )
        BillingProfile.objects.create(
            organization=self.organization, lease=self.lease, billing_item=fee_item,
            frequency=BillingProfile.Frequency.MONTHLY, calculation=BillingItem.Calculation.FIXED,
            amount=Decimal('50'), effective_from='2026-01-01', billing_day=1,
        )
        _, _, monthly = self._prepare_run('2026-08-01', '2026-08-31')
        self.assertTrue(any(item['code'] == 'MGMT_FEE' for item in monthly['candidates'][0]['billing_items']))

        BillingProfile.objects.filter(billing_item=fee_item).delete()
        BillingProfile.objects.create(
            organization=self.organization, lease=self.lease, billing_item=fee_item,
            frequency=BillingProfile.Frequency.QUARTERLY, calculation=BillingItem.Calculation.FIXED,
            amount=Decimal('150'), effective_from='2026-01-01', billing_day=1,
        )
        _, _, quarterly_due = self._prepare_run('2026-07-01', '2026-07-31')
        self.assertTrue(any(item['code'] == 'MGMT_FEE' for item in quarterly_due['candidates'][0]['billing_items']))
        _, _, quarterly_skip = self._prepare_run('2026-08-01', '2026-08-31')
        self.assertFalse(any(item['code'] == 'MGMT_FEE' for item in quarterly_skip['candidates'][0]['billing_items']))

        BillingProfile.objects.filter(billing_item=fee_item).delete()
        BillingProfile.objects.create(
            organization=self.organization, lease=self.lease, billing_item=fee_item,
            frequency=BillingProfile.Frequency.BIANNUAL, calculation=BillingItem.Calculation.FIXED,
            amount=Decimal('300'), effective_from='2026-01-01', billing_day=1,
        )
        _, _, biannual_due = self._prepare_run('2026-07-01', '2026-07-31')
        self.assertTrue(any(item['code'] == 'MGMT_FEE' for item in biannual_due['candidates'][0]['billing_items']))
        _, _, biannual_skip = self._prepare_run('2026-08-01', '2026-08-31')
        self.assertFalse(any(item['code'] == 'MGMT_FEE' for item in biannual_skip['candidates'][0]['billing_items']))

        BillingProfile.objects.filter(billing_item=fee_item).delete()
        BillingProfile.objects.create(
            organization=self.organization, lease=self.lease, billing_item=fee_item,
            frequency=BillingProfile.Frequency.ANNUAL, calculation=BillingItem.Calculation.FIXED,
            amount=Decimal('600'), effective_from='2026-01-01', billing_day=1,
        )
        _, _, annual_due = self._prepare_run('2026-01-01', '2026-01-31')
        self.assertTrue(any(item['code'] == 'MGMT_FEE' for item in annual_due['candidates'][0]['billing_items']))
        _, _, annual_skip = self._prepare_run('2026-08-01', '2026-08-31')
        self.assertFalse(any(item['code'] == 'MGMT_FEE' for item in annual_skip['candidates'][0]['billing_items']))

        BillingProfile.objects.filter(billing_item=fee_item).delete()
        BillingProfile.objects.create(
            organization=self.organization, lease=self.lease, billing_item=fee_item,
            frequency=BillingProfile.Frequency.CUSTOM, calculation=BillingItem.Calculation.FIXED,
            amount=Decimal('75'), effective_from='2026-01-01', billing_day=1, custom_interval_months=2,
        )
        _, _, custom_due = self._prepare_run('2026-07-01', '2026-07-31')
        self.assertTrue(any(item['code'] == 'MGMT_FEE' for item in custom_due['candidates'][0]['billing_items']))
        _, _, custom_skip = self._prepare_run('2026-08-01', '2026-08-31')
        self.assertFalse(any(item['code'] == 'MGMT_FEE' for item in custom_skip['candidates'][0]['billing_items']))

        BillingProfile.objects.filter(billing_item=fee_item).delete()
        BillingProfile.objects.create(
            organization=self.organization, lease=self.lease, billing_item=fee_item,
            frequency=BillingProfile.Frequency.ONE_OFF, calculation=BillingItem.Calculation.FIXED,
            amount=Decimal('250'), effective_from='2026-08-01', billing_day=1,
        )
        _, _, one_off_due = self._prepare_run('2026-08-01', '2026-08-31')
        self.assertTrue(any(item['code'] == 'MGMT_FEE' for item in one_off_due['candidates'][0]['billing_items']))
        _, _, one_off_skip = self._prepare_run('2026-09-01', '2026-09-30')
        self.assertFalse(any(item['code'] == 'MGMT_FEE' for item in one_off_skip['candidates'][0]['billing_items']))

        BillingProfile.objects.filter(billing_item=fee_item).delete()
        water_item = BillingItem.objects.create(
            organization=self.organization, code='WATER', name='Water',
            calculation=BillingItem.Calculation.METERED, income_category='utilities',
        )
        BillingProfile.objects.create(
            organization=self.organization, lease=self.lease, billing_item=water_item,
            frequency=BillingProfile.Frequency.METERED, calculation=BillingItem.Calculation.METERED,
            amount=Decimal('0'), effective_from='2026-01-01', billing_day=1,
        )
        _, _, metered_missing = self._prepare_run('2026-08-01', '2026-08-31')
        self.assertEqual(metered_missing['candidates'][0]['status'], BillingCandidate.Status.ISSUE)
        self.assertTrue(any(issue['code'] == 'missing_water_reading' for issue in metered_missing['issues']))
        meter = UtilityMeter.objects.create(
            organization=self.organization, property=self.property, property_unit=self.unit,
            code='W-101', name='Unit 101 water', utility_type=UtilityMeter.Utility.WATER,
        )
        MeterReading.objects.create(
            organization=self.organization, meter=meter,
            read_at=timezone.make_aware(datetime(2026, 8, 15, 10, 0)),
            value=Decimal('120'), previous_value=Decimal('100'), consumption=Decimal('20'),
            cost=Decimal('400'), status=MeterReading.Status.APPROVED,
        )
        _, _, metered_ready = self._prepare_run('2026-08-01', '2026-08-31')
        water_line = next(item for item in metered_ready['candidates'][0]['billing_items'] if item['code'] == 'WATER')
        self.assertEqual(water_line['total'], '400.00')
        self.assertEqual(metered_ready['candidates'][0]['status'], BillingCandidate.Status.READY)

        BillingProfile.objects.filter(billing_item=water_item).delete()
        BillingProfile.objects.create(
            organization=self.organization, lease=self.lease, billing_item=fee_item,
            frequency=BillingProfile.Frequency.MONTHLY, calculation=BillingItem.Calculation.FIXED,
            amount=Decimal('40'), effective_from='2026-01-01', effective_to='2026-08-14', billing_day=1,
        )
        BillingProfile.objects.create(
            organization=self.organization, lease=self.lease, billing_item=fee_item,
            frequency=BillingProfile.Frequency.MONTHLY, calculation=BillingItem.Calculation.FIXED,
            amount=Decimal('80'), effective_from='2026-08-15', billing_day=1,
        )
        _, _, mid_period = self._prepare_run('2026-08-01', '2026-08-31')
        fee_lines = [item for item in mid_period['candidates'][0]['billing_items'] if item['code'] == 'MGMT_FEE']
        self.assertEqual(len(fee_lines), 2)
        self.assertEqual({line['unit_rate'] for line in fee_lines}, {'40.00', '80.00'})

        self.lease.escalation_percent = Decimal('10')
        self.lease.escalation_interval_months = 12
        self.lease.ends_on = date(2028, 1, 1)
        self.lease.save(update_fields=('escalation_percent', 'escalation_interval_months', 'ends_on'))
        _, _, escalated = self._prepare_run('2027-02-01', '2027-02-28')
        rent_line = next(
            item for item in escalated['candidates'][0]['billing_items']
            if item['code'].upper() == 'RENT'
        )
        self.assertEqual(rent_line['unit_rate'], '1100.00')

        expired = Lease.objects.create(
            organization=self.organization, reference='LEASE-EXPIRED', unit=self.unit, tenant=self.tenant,
            starts_on='2025-01-01', ends_on='2026-01-01', monthly_rent=Decimal('900'),
            status=Lease.Status.ACTIVE,
        )
        BillingProfile.objects.create(
            organization=self.organization, lease=expired, billing_item=fee_item,
            frequency=BillingProfile.Frequency.MONTHLY, calculation=BillingItem.Calculation.FIXED,
            amount=Decimal('10'), effective_from='2025-01-01', billing_day=1,
        )
        _, _, live_period = self._prepare_run('2026-08-01', '2026-08-31')
        references = {candidate['lease_reference'] for candidate in live_period['candidates']}
        self.assertIn('LEASE-1', references)
        self.assertNotIn('LEASE-EXPIRED', references)

    def test_water_meter_reading_required_before_billing_rent_consolidated(self):
        water_item = BillingItem.objects.create(
            organization=self.organization, code='WATER', name='Water consumption',
            calculation=BillingItem.Calculation.METERED, income_category='utilities',
        )
        BillingProfile.objects.create(
            organization=self.organization, lease=self.lease, billing_item=water_item,
            frequency=BillingProfile.Frequency.METERED, calculation=BillingItem.Calculation.METERED,
            amount=Decimal('0'), effective_from='2026-01-01', billing_day=1,
        )

        # 1. Prepare run without meter reading: candidate is ISSUE with missing_water_reading
        run_id, run_url, run_data = self._prepare_run('2026-08-01', '2026-08-31')
        candidate_id = run_data['candidates'][0]['id']
        self.assertEqual(run_data['candidates'][0]['status'], BillingCandidate.Status.ISSUE)

        # Attempting to generate candidate is blocked
        gen_resp = self.client.post(f'{run_url}generate/', {
            'candidate_ids': [candidate_id]
        }, format='json', **self.headers)
        self.assertEqual(gen_resp.status_code, 400)
        self.assertIn('water meter reading is required', str(gen_resp.data).lower())

        # 2. Attempt to draft rent schedule directly: blocked with water_meter ValidationError
        schedule = RentSchedule.objects.create(
            organization=self.organization, lease=self.lease,
            period_start=date(2026, 8, 1), period_end=date(2026, 8, 31),
            due_on=date(2026, 8, 5), base_rent=Decimal('1000'),
            escalation_amount=Decimal('0'), service_charge=Decimal('0'), total=Decimal('1000'),
            status=RentSchedule.Status.UPCOMING,
        )
        schedule_resp = self.client.post(f'/api/v1/property/rent-schedules/{schedule.id}/generate-invoice/', {
            'tax_rate': '0'
        }, format='json', **self.headers)
        self.assertEqual(schedule_resp.status_code, 400)
        self.assertIn('water_meter', schedule_resp.data)

        # 3. Create approved meter reading: candidate becomes READY and generates consolidated invoices
        meter = UtilityMeter.objects.create(
            organization=self.organization, property=self.property, property_unit=self.unit,
            code='W-MTR-TEST', name='Unit Water Meter', utility_type=UtilityMeter.Utility.WATER,
        )
        MeterReading.objects.create(
            organization=self.organization, meter=meter,
            read_at=timezone.make_aware(datetime(2026, 8, 20, 9, 0)),
            value=Decimal('150'), previous_value=Decimal('100'), consumption=Decimal('50'),
            cost=Decimal('500'), status=MeterReading.Status.APPROVED,
        )
        # Re-prepare run
        _, ready_url, ready_data = self._prepare_run('2026-08-01', '2026-08-31')
        self.assertEqual(ready_data['candidates'][0]['status'], BillingCandidate.Status.READY)

        # Generate invoices successfully
        success_gen = self.client.post(f'{ready_url}generate/', {
            'candidate_ids': [ready_data['candidates'][0]['id']]
        }, format='json', **self.headers)
        self.assertEqual(success_gen.status_code, 201)
        invoice_types = {inv['invoice_type'] for inv in success_gen.data['invoices']}
        self.assertIn('rent', invoice_types)
        self.assertIn('water', invoice_types)

    @mock.patch.dict(os.environ, {'ECITIZEN_TEST_SECRET': 'client-supplied-signing-secret'})
    def test_tenant_payment_is_signed_idempotent_and_fully_reconciled(self):
        TenantPortalAccess.objects.create(
            organization=self.organization, tenant=self.tenant, user=self.user, is_active=True,
        )
        gateway = PaymentGatewayConfiguration.objects.create(
            organization=self.organization, property=self.property,
            provider=PaymentGatewayConfiguration.Provider.ECITIZEN,
            display_name='eCitizen', merchant_reference='CE-TEST',
            checkout_url_template='https://payments.example.test/checkout?ref={reference}&amount={amount}&invoice={invoice}',
            webhook_secret_env='ECITIZEN_TEST_SECRET', is_enabled=True,
        )
        initiated = self.client.post('/api/v1/property/portal/payments/initiate/', {
            'invoice': str(self.invoice.id), 'provider': 'ecitizen',
        }, format='json', **self.headers)
        self.assertEqual(initiated.status_code, 201, initiated.data)
        intent = PaymentIntent.objects.get(id=initiated.data['id'])
        self.assertEqual(intent.amount, Decimal('1000'))
        self.assertTrue(intent.checkout_url.startswith('https://payments.example.test/'))
        invoice_document = self.client.get(
            f'/api/v1/property/portal/invoices/{self.invoice.id}/pdf/', **self.headers,
        )
        self.assertEqual(invoice_document.status_code, 200)
        self.assertEqual(invoice_document['Content-Type'], 'application/pdf')
        self.assertTrue(invoice_document.content.startswith(b'%PDF-'))
        self.assertIn(b'%%EOF', invoice_document.content[-1024:])
        statement_document = self.client.get(
            '/api/v1/property/portal/statement.pdf/?start=2026-01-01&end=2026-12-31', **self.headers,
        )
        self.assertEqual(statement_document.status_code, 200)
        self.assertEqual(statement_document['Content-Type'], 'application/pdf')
        self.assertTrue(statement_document.content.startswith(b'%PDF-'))
        self.assertIn(b'%%EOF', statement_document.content[-1024:])

        # An administrator previewing a tenant portal must be able to download
        # that tenant's documents without being linked as the tenant user.
        TenantPortalAccess.objects.filter(user=self.user).delete()
        preview_query = f'?tenant={self.tenant.id}'
        preview_invoice = self.client.get(
            f'/api/v1/property/portal/invoices/{self.invoice.id}/pdf/{preview_query}', **self.headers,
        )
        self.assertEqual(preview_invoice.status_code, 200)
        self.assertTrue(preview_invoice.content.startswith(b'%PDF-'))
        preview_statement = self.client.get(
            f'/api/v1/property/portal/statement.pdf/{preview_query}', **self.headers,
        )
        self.assertEqual(preview_statement.status_code, 200)
        self.assertTrue(preview_statement.content.startswith(b'%PDF-'))
        TenantPortalAccess.objects.create(
            organization=self.organization, tenant=self.tenant, user=self.user, is_active=True,
        )

        payload = json.dumps({
            'event_id': 'evt-001', 'reference': intent.reference,
            'transaction_reference': 'ECZ-12345', 'status': 'paid', 'amount': '1000.00',
        }, separators=(',', ':')).encode()
        signature = hmac.new(b'client-supplied-signing-secret', payload, hashlib.sha256).hexdigest()
        callback_url = f'/api/v1/property/payment-webhooks/{gateway.public_key}/'
        invalid = self.client.generic(
            'POST', callback_url, payload, content_type='application/json',
            HTTP_X_CEEST_SIGNATURE='invalid',
        )
        self.assertEqual(invalid.status_code, 401)
        processed = self.client.generic(
            'POST', callback_url, payload, content_type='application/json',
            HTTP_X_CEEST_SIGNATURE=f'sha256={signature}',
        )
        self.assertEqual(processed.status_code, 200, processed.data)
        self.invoice.refresh_from_db()
        intent.refresh_from_db()
        self.assertEqual(self.invoice.balance, Decimal('0'))
        self.assertEqual(self.invoice.status, Invoice.Status.PAID)
        self.assertEqual(intent.status, PaymentIntent.Status.PAID)
        receipt = Receipt.objects.get(external_reference='ECZ-12345')
        self.assertEqual(receipt.amount, Decimal('1000'))
        receipt_document = self.client.get(
            f'/api/v1/property/portal/receipts/{receipt.id}/pdf/', **self.headers,
        )
        self.assertEqual(receipt_document.status_code, 200)
        self.assertTrue(ReceiptAllocation.objects.filter(receipt=receipt, invoice=self.invoice).exists())
        self.assertTrue(BankTransaction.objects.filter(receipt=receipt, status=BankTransaction.Status.MATCHED).exists())
        self.assertTrue(Notification.objects.filter(
            recipient=self.user, metadata__receipt_id=str(receipt.id), level=Notification.Level.SUCCESS,
        ).exists())
        self.assertEqual(PaymentWebhookEvent.objects.get(event_id='evt-001').status, PaymentWebhookEvent.Status.PROCESSED)

        duplicate = self.client.generic(
            'POST', callback_url, payload, content_type='application/json',
            HTTP_X_CEEST_SIGNATURE=signature,
        )
        self.assertEqual(duplicate.status_code, 200, duplicate.data)
        self.assertTrue(duplicate.data['duplicate'])
        self.assertEqual(Receipt.objects.filter(external_reference='ECZ-12345').count(), 1)

    @mock.patch.dict(os.environ, {'ECITIZEN_TEST_SECRET': 'client-supplied-signing-secret'})
    def test_tenant_can_pay_and_reconcile_multiple_invoices_in_one_transaction(self):
        TenantPortalAccess.objects.create(
            organization=self.organization, tenant=self.tenant, user=self.user, is_active=True,
        )
        gateway = PaymentGatewayConfiguration.objects.create(
            organization=self.organization, property=self.property,
            provider=PaymentGatewayConfiguration.Provider.ECITIZEN,
            display_name='eCitizen', merchant_reference='CE-TEST',
            checkout_url_template='https://payments.example.test/checkout?ref={reference}&amount={amount}&invoice={invoice}',
            webhook_secret_env='ECITIZEN_TEST_SECRET', is_enabled=True,
        )
        second_invoice = Invoice.objects.create(
            organization=self.organization, number='INV-2', lease=self.lease,
            issued_on='2026-08-01', due_on='2026-08-07', amount=Decimal('350'),
            balance=Decimal('350'), status=Invoice.Status.ISSUED,
        )
        initiated = self.client.post('/api/v1/property/portal/payments/initiate/', {
            'invoices': [str(self.invoice.id), str(second_invoice.id)], 'provider': 'ecitizen',
        }, format='json', **self.headers)
        self.assertEqual(initiated.status_code, 201, initiated.data)
        intent = PaymentIntent.objects.get(id=initiated.data['id'])
        self.assertEqual(intent.amount, Decimal('1350'))
        self.assertEqual(len(intent.metadata['invoice_allocations']), 2)

        payload = json.dumps({
            'event_id': 'evt-consolidated', 'reference': intent.reference,
            'transaction_reference': 'ECZ-CONSOLIDATED', 'status': 'paid', 'amount': '1350.00',
        }, separators=(',', ':')).encode()
        signature = hmac.new(b'client-supplied-signing-secret', payload, hashlib.sha256).hexdigest()
        processed = self.client.generic(
            'POST', f'/api/v1/property/payment-webhooks/{gateway.public_key}/', payload,
            content_type='application/json', HTTP_X_CEEST_SIGNATURE=f'sha256={signature}',
        )
        self.assertEqual(processed.status_code, 200, processed.data)
        self.invoice.refresh_from_db(); second_invoice.refresh_from_db()
        self.assertEqual(self.invoice.balance, Decimal('0'))
        self.assertEqual(second_invoice.balance, Decimal('0'))
        receipt = Receipt.objects.get(external_reference='ECZ-CONSOLIDATED')
        self.assertEqual(receipt.amount, Decimal('1350'))
        self.assertEqual(ReceiptAllocation.objects.filter(receipt=receipt).count(), 2)

    def test_report_catalogue_uses_client_categories_and_exports_each_family(self):
        catalogue = self.client.get('/api/v1/property/analytics/', **self.headers)
        self.assertEqual(catalogue.status_code, 200)
        categories = {row['category'] for row in catalogue.data['reports']}
        self.assertEqual(categories, {
            'Financial', 'Tenants & Occupancy', 'Service Providers', 'Compliance & Risk', 'Directory & Contacts',
        })
        financial_sections = {
            row.get('section') for row in catalogue.data['reports'] if row['category'] == 'Financial'
        }
        self.assertTrue({'Critical reports', 'Collections & reconciliation'}.issubset(financial_sections))
        keys = {row['key'] for row in catalogue.data['reports']}
        self.assertTrue({'tenant-payment-status', 'daily-collections', 'collections-property', 'collections-tenant', 'outstanding-balances', 'payment-reconciliation', 'settlement', 'management-fee'}.issubset(keys))
        for key in ('aging', 'occupancy', 'contractor-expiry', 'tenant-compliance', 'critical-dates'):
            self.assertIn(key, keys)
            exported = self.client.get(f'/api/v1/property/analytics/exports/{key}/', **self.headers)
            self.assertEqual(exported.status_code, 200)
            self.assertEqual(exported['Content-Type'], 'text/csv')
            self.assertIn(f'property-{key}.csv', exported['Content-Disposition'])

    def test_create_assigns_organization_server_side(self):
        response = self.client.post(
            '/api/v1/property/properties/',
            {'code': 'OWN-002', 'name': 'Second Property', 'status': Property.Status.ACTIVE},
            format='json', **self.headers,
        )
        self.assertEqual(response.status_code, 201)
        created_property = Property.objects.get(organization=self.organization, name='Second Property')
        self.assertTrue(created_property.code.startswith('PROP-'))

    def test_tenant_application_onboarding_creates_tenant_and_draft_lease_atomically(self):
        available_unit = Unit.objects.create(
            organization=self.organization, property=self.property, code='202', floor='2',
            area=Decimal('1000'), status=Unit.Status.AVAILABLE,
        )
        deposit_item = BillingItem.objects.create(
            organization=self.organization, code='SECURITY_DEPOSIT', name='Security deposit',
            calculation=BillingItem.Calculation.FIXED, is_recurring=False,
        )
        UnitChargeRule.objects.create(
            organization=self.organization, unit=available_unit, billing_item=deposit_item,
            frequency=UnitChargeRule.Frequency.ONE_OFF, amount=Decimal('200000'),
        )
        response = self.client.post('/api/v1/property/tenants/onboard/', {
            'tenant': {
                'name': 'Acme Kenya Limited', 'tenant_type': 'company', 'address_1': 'Moi Avenue',
                'address_2': 'Suite 4', 'city': 'Mombasa', 'phone': '+254700000001',
                'email': 'accounts@acme.test', 'tax_id': 'P051234567X',
                'contact_name': 'Jane Wanjiku', 'contact_phone': '+254700000002',
                'contact_email': 'jane@acme.test',
            },
            'lease': {
                'unit': str(available_unit.id), 'term_months': 72, 'starts_on': '2027-01-01',
                'area': 1000, 'rent_rate_per_sqft': 100, 'service_charge_rate_per_sqft': 15,
                'vat_rate': 16, 'security_deposit': 999999, 'billing_day': 1,
                'escalation_percent': 5, 'escalation_interval_months': 12,
            },
            'utilities': [
                {'utility': 'Electricity', 'applicable': True, 'rate_per_unit': 10, 'deposit_amount': 10000},
                {'utility': 'Water', 'applicable': False, 'rate_per_unit': 0, 'deposit_amount': 0},
            ],
            'charges': [{'code': 'RENT', 'name': 'Rent', 'amount': 100000}],
        }, format='json', HTTP_X_PROPERTY_ID=str(self.property.id), **self.headers)

        self.assertEqual(response.status_code, 201, response.data)
        tenant = Tenant.objects.get(pk=response.data['tenant']['id'])
        lease = Lease.objects.get(pk=response.data['lease']['id'])
        self.assertTrue(tenant.code.startswith('TNT-'))
        self.assertEqual(tenant.property, self.property)
        self.assertEqual(tenant.metadata['tenant_application']['contact_name'], 'Jane Wanjiku')
        self.assertEqual(lease.status, Lease.Status.DRAFT)
        self.assertTrue(lease.reference.startswith('LEASE-'))
        self.assertEqual(lease.ends_on.isoformat(), '2033-01-01')  # 72 months from 2027-01-01
        self.assertEqual(lease.monthly_rent, Decimal('100000.00'))
        self.assertEqual(lease.deposit, Decimal('200000.00'))
        self.assertEqual(lease.escalation_percent, Decimal('5.00'))
        self.assertEqual(lease.escalation_interval_months, 12)
        self.assertEqual(lease.metadata['monthly_service_charge_excl_vat'], '15000.00')
        self.assertEqual(response.data['calculations']['total_amount_payable'], '333400.00')
        activated = self.client.post(f'/api/v1/property/leases/{lease.id}/activate/', {}, format='json', **self.headers)
        self.assertEqual(activated.status_code, 200, activated.data)
        schedules = RentSchedule.objects.filter(lease=lease).order_by('period_start')
        self.assertEqual(schedules.count(), 72)
        self.assertEqual(schedules[12].period_start.isoformat(), '2028-01-01')  # 12 months from 2027-01-01
        self.assertEqual(schedules[12].base_rent, Decimal('100000.00'))
        self.assertEqual(schedules[12].escalation_amount, Decimal('5000.00'))
        self.assertEqual(schedules[24].escalation_amount, Decimal('10250.00'))
        # Attempting to generate an invoice before the lease commences must be rejected.
        # schedules[0].period_start = '2027-01-01' which is in the future (as_of=today < starts_on).
        premature = self.client.post(f'/api/v1/property/rent-schedules/{schedules[0].id}/generate-invoice/', {}, format='json', **self.headers)
        self.assertEqual(premature.status_code, 400)
        self.assertIn('commencement', str(premature.data).lower())


    def test_tenant_onboarding_reserves_parking_and_records_opening_arrears_separately(self):
        unit = Unit.objects.create(
            organization=self.organization, property=self.property, code='PARK-UNIT',
            area=Decimal('500'), status=Unit.Status.AVAILABLE,
        )
        bay = ParkingSpace.objects.create(
            organization=self.organization, property=self.property, code='B2-014',
            floor_or_zone='Basement 2', status=ParkingSpace.Status.AVAILABLE,
        )
        response = self.client.post('/api/v1/property/tenants/onboard/', {
            'tenant': {'name': 'Opening Balance Tenant', 'tenant_type': 'company'},
            'lease': {
                'unit': str(unit.id), 'starts_on': '2026-09-01', 'term_months': 12,
                'monthly_rent': '50000', 'billing_day': 5, 'vat_rate': 0,
            },
            'parking_assignments': [{'parking_space': str(bay.id), 'monthly_fee': '7500'}],
            'opening_balance': {
                'amount': '125000', 'as_of': '2026-08-31',
                'previous_agent': 'Previous Agency Ltd', 'reference': 'STATEMENT-2026-08',
                'notes': 'Verified handover balance',
            },
        }, format='json', HTTP_X_PROPERTY_ID=str(self.property.id), **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        lease = Lease.objects.get(pk=response.data['lease']['id'])
        allocation = ParkingAssignment.objects.get(lease=lease)
        self.assertEqual(allocation.status, ParkingAssignment.Status.RESERVED)
        self.assertEqual(allocation.monthly_fee, Decimal('7500'))
        bay.refresh_from_db()
        self.assertEqual(bay.status, ParkingSpace.Status.RESERVED)
        self.assertEqual(lease.billing_profiles.get(billing_item__code='PARKING').amount, Decimal('7500'))
        opening = Invoice.objects.get(lease=lease, invoice_type='opening_balance')
        self.assertEqual(opening.status, Invoice.Status.DRAFT)
        self.assertEqual(opening.balance, Decimal('125000'))
        self.assertEqual(opening.metadata['previous_agent'], 'Previous Agency Ltd')
        self.assertEqual(opening.lines.get().source_type, 'opening_balance')

        activated = self.client.post(f'/api/v1/property/leases/{lease.id}/activate/', {}, format='json', **self.headers)
        self.assertEqual(activated.status_code, 200, activated.data)
        allocation.refresh_from_db(); bay.refresh_from_db(); opening.refresh_from_db()
        self.assertEqual(allocation.status, ParkingAssignment.Status.ACTIVE)
        self.assertEqual(bay.status, ParkingSpace.Status.ASSIGNED)
        self.assertEqual(opening.status, Invoice.Status.ISSUED)

    def test_delete_duplicate_tenant_and_protected_tenant(self):
        # 1. Create a duplicate/erroneous tenant with no active leases or invoices
        dupe_tenant = Tenant.objects.create(
            organization=self.organization, property=self.property,
            name='Duplicate Tenant By Mistake', code='TNT-9999',
            status=Tenant.Status.PROSPECT,
        )
        # Deleting the duplicate tenant succeeds
        delete_res = self.client.delete(f'/api/v1/property/tenants/{dupe_tenant.id}/', **self.headers)
        self.assertEqual(delete_res.status_code, 200, delete_res.data)
        self.assertFalse(Tenant.objects.filter(id=dupe_tenant.id).exists())

        # 2. Attempting to delete a tenant with active leases or invoices is blocked
        protected_res = self.client.delete(f'/api/v1/property/tenants/{self.tenant.id}/', **self.headers)
        self.assertEqual(protected_res.status_code, 400)
        self.assertIn('Cannot delete tenant', str(protected_res.data))
        self.assertTrue(Tenant.objects.filter(id=self.tenant.id).exists())

    def test_onboarding_creates_property_buildings_units_and_metadata_atomically(self):
        response = self.client.post('/api/v1/property/properties/onboard/', {
            'property': {
                'name': 'Palm Court', 'property_type': 'mixed_use', 'status': 'draft',
                'address': 'Links Road', 'city': 'Mombasa', 'country': 'KE',
                'metadata': {
                    'landlord': {'name': 'Example Landlord', 'vat_registered': True},
                    'location': {'county': 'Mombasa'},
                    'utilities': [{
                        'type': 'electricity', 'account_no': 'KPLC-100', 'provider': 'KPLC',
                        'meter_code': 'MTR-KPLC-100', 'supply_mode': 'postpaid', 'unit': 'kWh',
                        'tariff': '28.50', 'initial_reading': '1500', 'reading_date': '2026-08-01',
                        'status': 'active',
                    }],
                },
            },
            'building': {'count': 2, 'floors': 4, 'use': 'Mixed use'},
            'units': [
                {'unit_no': 'G-01', 'unit_type': 'Retail', 'floor': 'G', 'use': 'Shop', 'area': '850', 'building_index': 1},
                {'unit_no': '1-A', 'unit_type': 'Two bedroom', 'floor': '1', 'use': 'Residential', 'area': '1100', 'rateable_area': '980', 'building_index': 2},
            ],
        }, format='json', **self.headers)

        self.assertEqual(response.status_code, 201, response.content)
        created = Property.objects.get(name='Palm Court')
        self.assertTrue(created.code.startswith('PROP-'))
        self.assertNotIn('lr_number', created.metadata)
        self.assertEqual(created.buildings.count(), 2)
        self.assertEqual(created.units.count(), 2)
        self.assertEqual(created.units.get(code='1-A').metadata['rateable_area'], '980')
        meter = UtilityMeter.objects.get(property=created, code='MTR-KPLC-100')
        self.assertEqual(meter.tariff, Decimal('28.5000'))
        reading = MeterReading.objects.get(meter=meter)
        self.assertEqual(reading.value, Decimal('1500'))
        self.assertEqual(reading.status, MeterReading.Status.APPROVED)
        self.assertEqual(response.data['utility_meters_created'], 1)

    def test_onboard_property_with_unit_allocated_meter_and_location(self):
        response = self.client.post('/api/v1/property/properties/onboard/', {
            'property': {
                'name': 'Kilimani Heights', 'property_type': 'residential', 'status': 'draft',
                'address': 'Argwings Kodhek', 'city': 'Nairobi', 'country': 'KE',
                'metadata': {
                    'landlord': {'name': 'Kilimani Landlord'},
                    'location': {'county': 'Nairobi'},
                    'utilities': [{
                        'type': 'water', 'account_no': 'WTR-ACC-101',
                        'meter_code': 'MTR-WTR-A101', 'unit_code': 'A101',
                        'location': 'Outside Door Floor 1',
                        'tariff': '200', 'bill_cycle': 'monthly',
                        'status': 'active',
                    }],
                },
            },
            'units': [
                {'unit_no': 'A101', 'unit_type': 'Apartment', 'floor': '1', 'use': 'Residential', 'area': '1200'},
            ],
        }, format='json', **self.headers)

        self.assertEqual(response.status_code, 201, response.content)
        prop = Property.objects.get(name='Kilimani Heights')
        unit = prop.units.get(code='A101')
        from facilities.models import UtilityMeter
        meter = UtilityMeter.objects.get(property=prop, code='MTR-WTR-A101')
        self.assertEqual(meter.property_unit, unit)
        self.assertEqual(meter.location, 'Outside Door Floor 1')
        self.assertEqual(meter.tariff, Decimal('200'))

    def test_edit_onboarding_persists_uploaded_buildings_and_units(self):

        response = self.client.patch(f'/api/v1/property/properties/{self.property.id}/', {
            'property': {
                'name': 'Owned Property', 'property_type': 'commercial', 'status': 'active',
                'address': 'Mombasa Road', 'city': 'Nairobi', 'country': 'KE',
                'metadata': {'landlord': {'name': 'Property Owner'}},
            },
            'building': {'buildings': [{'name': 'Main Block', 'floors': 6, 'use': 'Commercial'}]},
            'units': [
                {'unit_no': 'G-01', 'unit_type': 'Retail', 'floor': 'Ground', 'use': 'Shop', 'area': '800', 'building_index': 1, 'service_charge_rate': '12.50'},
                {'unit_no': '1-A', 'unit_type': 'Office', 'floor': '1', 'use': 'Office', 'area': '650', 'building_index': 1},
            ],
        }, format='json', **self.headers)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['onboarding_sync'], {'buildings_created': 1, 'units_created': 2, 'units_updated': 0})
        self.property.refresh_from_db()
        self.assertEqual(self.property.buildings.count(), 1)
        self.assertEqual(self.property.units.count(), 3)  # Existing unit is retained.
        created = self.property.units.get(code='G-01')
        self.assertEqual(created.metadata['use'], 'Shop')
        service_rule = created.charge_rules.get(billing_item__code='SERVICE_CHARGE')
        self.assertEqual(service_rule.calculation, BillingItem.Calculation.FIXED)
        self.assertEqual(service_rule.amount, Decimal('12.50'))
        self.assertEqual(created.common_area_fee_amount, Decimal('12.50'))

        updated = self.client.patch(f'/api/v1/property/properties/{self.property.id}/', {
            'units': [
                {'unit_no': 'G-01', 'unit_type': 'Retail Updated', 'floor': 'Ground', 'use': 'Shop', 'area': '810', 'service_charge_rate': '3500'},
            ],
        }, format='json', **self.headers)
        self.assertEqual(updated.status_code, 200, updated.data)
        created.refresh_from_db(); service_rule.refresh_from_db()
        self.assertEqual(created.unit_type, 'Retail Updated')
        self.assertEqual(created.common_area_fee_amount, Decimal('3500'))
        self.assertEqual(service_rule.amount, Decimal('3500'))
        self.assertEqual(self.property.units.filter(code='G-01').count(), 1)

        detail = self.client.get(f'/api/v1/property/properties/{self.property.id}/', **self.headers)
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(len(detail.data['buildings']), 1)
        self.assertIn('G-01', [unit['code'] for unit in detail.data['units']])

    def test_building_delete_allows_empty_buildings_and_protects_units(self):
        empty = Building.objects.create(
            organization=self.organization, property=self.property,
            code='BLD-EMPTY', name='Empty Annex', floors=1,
        )
        deleted = self.client.delete(f'/api/v1/property/buildings/{empty.id}/', **self.headers)
        self.assertEqual(deleted.status_code, 204, deleted.data)
        self.assertFalse(Building.objects.filter(id=empty.id).exists())

        occupied_structure = Building.objects.create(
            organization=self.organization, property=self.property,
            code='BLD-USED', name='Occupied Block', floors=1,
        )
        self.unit.building = occupied_structure
        self.unit.save(update_fields=('building', 'updated_at'))
        blocked = self.client.delete(f'/api/v1/property/buildings/{occupied_structure.id}/', **self.headers)
        self.assertEqual(blocked.status_code, 400, blocked.data)
        self.assertIn('cannot be deleted', str(blocked.data))
        self.assertTrue(Building.objects.filter(id=occupied_structure.id).exists())

    def test_tenant_company_card_is_validated_and_assigned_to_selected_property(self):
        scoped_headers = {**self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id)}
        response = self.client.post('/api/v1/property/tenants/', {
            'code': 'TEN-CARD-1', 'name': 'Lakeview Trading Limited', 'tenant_type': 'company',
            'email': 'accounts@lakeview.example', 'phone': '+254700555444',
            'tax_id': 'p051234567x', 'registration_number': 'cpr/2020/11223',
            'directors': ['Mary Njeri', 'David Ouma'], 'status': Tenant.Status.PROSPECT,
        }, format='json', **scoped_headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['tax_id'], 'P051234567X')
        self.assertEqual(response.data['registration_number'], 'CPR/2020/11223')
        self.assertEqual(response.data['directors'], ['Mary Njeri', 'David Ouma'])
        self.assertEqual(str(response.data['property']), str(self.property.id))

        invalid = self.client.post('/api/v1/property/tenants/', {
            'code': 'TEN-CARD-BAD', 'name': 'Invalid PIN Limited', 'tenant_type': 'company',
            'tax_id': '12345', 'registration_number': 'CPR/2020/99',
            'directors': ['Mary Njeri'],
        }, format='json', **scoped_headers)
        self.assertEqual(invalid.status_code, 400, invalid.data)
        self.assertIn('tax_id', invalid.data)
        self.assertFalse(Tenant.objects.filter(code='TEN-CARD-BAD').exists())

    def test_property_scope_includes_unleased_prospects_without_leaking_other_properties(self):
        other_property = Property.objects.create(
            organization=self.organization, code='OWN-002', name='Second Property', status=Property.Status.ACTIVE,
        )
        Tenant.objects.create(
            organization=self.organization, property=self.property, code='TEN-OWN', name='Own Prospect',
        )
        Tenant.objects.create(
            organization=self.organization, property=other_property, code='TEN-OTHER', name='Other Prospect',
        )
        response = self.client.get(
            '/api/v1/property/tenants/', **{**self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id)},
        )
        self.assertEqual(response.status_code, 200, response.data)
        codes = {row['code'] for row in response.data}
        self.assertIn('TEN-OWN', codes)
        self.assertNotIn('TEN-OTHER', codes)

    def test_subscription_is_required(self):
        Subscription.objects.filter(organization=self.organization, module=Module.PROPERTY).update(is_active=False)
        response = self.client.get('/api/v1/property/properties/', **self.headers)
        self.assertEqual(response.status_code, 403)

    def test_receipt_is_atomically_allocated_and_updates_invoice(self):
        response = self.client.post('/api/v1/property/receipts/', {
            'number': 'RCT-1', 'tenant': str(self.tenant.id),
            'received_on': '2026-07-31',
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
        changed = self.client.patch(
            f"/api/v1/property/receipts/{response.data['id']}/", {'amount': '1.00'},
            format='json', **self.headers,
        )
        self.assertEqual(changed.status_code, 400)
        self.assertEqual(self.client.delete(
            f"/api/v1/property/receipts/{response.data['id']}/", **self.headers,
        ).status_code, 400)

    def test_financial_documents_generate_tenant_scoped_pdfs(self):
        receipt = Receipt.objects.create(
            organization=self.organization, number='RCT-PDF-1', tenant=self.tenant,
            invoice=self.invoice, received_on='2026-07-03', amount=Decimal('250.00'),
            payment_method='bank_transfer', external_reference='BANK-PDF-1', received_by=self.user,
        )
        cases = (
            f'/api/v1/property/invoices/{self.invoice.id}/pdf/',
            f'/api/v1/property/receipts/{receipt.id}/pdf/',
            f'/api/v1/property/tenants/{self.tenant.id}/statement.pdf/?start=2026-01-01&end=2026-12-31',
            f'/api/v1/property/analytics/exports/income-expense/?output=pdf&start=2026-07-01&end=2026-07-31',
            f'/api/v1/property/analytics/exports/aging/?output=pdf',
        )
        scoped_headers = {**self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id)}
        for url in cases:
            response = self.client.get(url, **scoped_headers)
            self.assertEqual(response.status_code, 200, (url, getattr(response, 'data', b'')))
            self.assertEqual(response['Content-Type'], 'application/pdf')
            self.assertIn('.pdf', response['Content-Disposition'])
            self.assertTrue(response.content.startswith(b'%PDF-'))
            self.assertGreater(len(response.content), 1500)

        catalogue = self.client.get('/api/v1/property/analytics/', **scoped_headers).data['reports']
        for report in catalogue:
            response = self.client.get(
                f"/api/v1/property/analytics/exports/{report['key']}/?output=pdf",
                **scoped_headers,
            )
            self.assertEqual(response.status_code, 200, (report['key'], getattr(response, 'data', b'')))
            self.assertEqual(response['Content-Type'], 'application/pdf')
            self.assertTrue(response.content.startswith(b'%PDF-'))

        other_user = get_user_model().objects.create_user(username='other-pdf-user')
        Membership.objects.create(user=other_user, organization=self.other, is_default=True, is_organization_admin=True)
        Subscription.objects.create(organization=self.other, module=Module.PROPERTY, status=Subscription.Status.ACTIVE)
        self.client.force_authenticate(other_user)
        denied = self.client.get(f'/api/v1/property/invoices/{self.invoice.id}/pdf/', HTTP_X_ORGANIZATION_ID=str(self.other.id))
        self.assertEqual(denied.status_code, 404)

    def test_receipt_overpayment_is_accepted_and_credits_wallet(self):
        response = self.client.post('/api/v1/property/receipts/', {
            'number': 'RCT-BAD', 'tenant': str(self.tenant.id),
            'received_on': '2026-07-31',
            'amount': '1000.01', 'payment_method': 'cash',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.balance, Decimal('0.00'))
        self.assertEqual(self.invoice.status, Invoice.Status.PAID)
        wallet = PayerWallet.objects.get(organization=self.organization, tenant=self.tenant)
        self.assertEqual(wallet.balance, Decimal('0.01'))

    def test_bank_transaction_ai_match_and_batch_receipt(self):
        tx = BankTransaction.objects.create(
            organization=self.organization,
            reference='MPESA-QW1293',
            transacted_on=date(2026, 8, 1),
            amount=Decimal('1000.00'),
            money_in=Decimal('1000.00'),
            description=f'Rent payment for {self.unit.code} by {self.tenant.name}',
            extracted_payer_name=self.tenant.name,
        )

        response = self.client.get('/api/v1/property/bank-transactions/ai-match/', **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertGreaterEqual(response.data['matched_count'], 1)
        match_item = response.data['matches'][0]
        self.assertEqual(match_item['transaction_id'], str(tx.id))
        self.assertEqual(match_item['suggested_invoice']['id'], str(self.invoice.id))

        # Test batch receipt execution
        batch_res = self.client.post('/api/v1/property/bank-transactions/batch-quick-receipt/', {
            'items': [{'transaction_id': str(tx.id), 'invoice_id': str(self.invoice.id)}],
        }, format='json', **self.headers)
        self.assertEqual(batch_res.status_code, 200, batch_res.data)
        self.assertEqual(batch_res.data['processed_count'], 1)
        tx.refresh_from_db()
        self.assertEqual(tx.status, BankTransaction.Status.MATCHED)
        self.assertIsNotNone(tx.receipt)

    def test_manual_receipt_with_code_auto_matches_unmatched_bank_transaction(self):
        tx = BankTransaction.objects.create(
            organization=self.organization,
            reference='KCB-TX-998811',
            transacted_on=date(2026, 8, 1),
            amount=Decimal('1000.00'),
            money_in=Decimal('1000.00'),
            description='Direct Bank Deposit',
            status=BankTransaction.Status.UNMATCHED,
        )
        # Create manual receipt with transaction reference
        response = self.client.post('/api/v1/property/receipts/', {
            'tenant': str(self.tenant.id),
            'amount': '1000.00',
            'payment_method': 'bank_transfer',
            'external_reference': 'KCB-TX-998811',
            'received_on': '2026-08-01',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        tx.refresh_from_db()
        self.assertEqual(tx.status, BankTransaction.Status.MATCHED)
        self.assertEqual(str(tx.receipt_id), str(response.data['id']))




    def test_lease_document_extraction_endpoint(self):
        raw_text = (
            "Tenancy Agreement between Center Estates and Tenant Jane Mwangi (ID: 30129844, Tel: 0722123456) "
            "for Unit B204 at Lynx Apartments. Monthly rent KES 55,000, Security deposit KES 110,000. "
            "Term: 2026-09-01 to 2027-08-31 with 10% annual escalation."
        )
        response = self.client.post('/api/v1/property/leases/extract-document/', {
            'raw_text': raw_text,
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data['extracted_data']
        self.assertIn('Jane Mwangi', data['tenant_name'])
        self.assertEqual(data['national_id'], '30129844')
        self.assertEqual(data['monthly_rent'], '55000')
        self.assertEqual(data['deposit'], '110000')
        self.assertEqual(data['starts_on'], '2026-09-01')
        self.assertEqual(data['ends_on'], '2027-08-31')
        self.assertEqual(data['escalation_percent'], '10')




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

    def test_credit_note_rejects_unposted_invoice(self):
        self.invoice.status = Invoice.Status.DRAFT
        self.invoice.save(update_fields=('status',))
        response = self.client.post('/api/v1/property/credit-notes/', {
            'number': 'CN-DRAFT', 'invoice': str(self.invoice.id),
            'issued_on': '2026-07-31', 'amount': '250.00',
            'reason': 'Must not adjust an unposted invoice',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('invoice', response.data)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.balance, Decimal('1000.00'))

    def test_tenant_document_verification_is_scoped_and_audited(self):
        response = self.client.post('/api/v1/property/tenant-documents/', {
            'tenant': str(self.tenant.id), 'document_type': 'tax_certificate',
            'document_number': 'P0001', 'file_url': '/media/tenants/P0001.pdf',
            'issued_on': '2026-01-01', 'expires_on': '2027-01-01', 'status': TenantDocument.Status.VERIFIED,
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['status'], TenantDocument.Status.PENDING)
        verified = self.client.post(
            f"/api/v1/property/tenant-documents/{response.data['id']}/verify/",
            {}, format='json', **self.headers,
        )
        self.assertEqual(verified.status_code, 200, verified.data)
        document = TenantDocument.objects.get(pk=response.data['id'])
        self.assertEqual(document.status, TenantDocument.Status.VERIFIED)
        self.assertEqual(document.verified_by, self.user)
        self.assertEqual(self.client.post(
            f"/api/v1/property/tenant-documents/{document.id}/verify/", {}, format='json', **self.headers,
        ).status_code, 400)

    def test_lease_activation_and_termination_control_unit_occupancy(self):
        available = Unit.objects.create(
            organization=self.organization, property=self.property, code='102', status=Unit.Status.AVAILABLE,
        )
        prospect = Tenant.objects.create(
            organization=self.organization, code='TEN-2', name='Prospect', status=Tenant.Status.PROSPECT,
        )
        lease = Lease.objects.create(
            organization=self.organization, reference='LEASE-2', unit=available, tenant=prospect,
            starts_on='2026-08-01', ends_on='2027-08-01', monthly_rent=Decimal('1200'),
        )
        activated = self.client.post(f'/api/v1/property/leases/{lease.id}/activate/', {}, format='json', **self.headers)
        self.assertEqual(activated.status_code, 200, activated.data)
        lease.refresh_from_db(); available.refresh_from_db(); prospect.refresh_from_db()
        self.assertEqual(lease.status, Lease.Status.ACTIVE)
        self.assertEqual(available.status, Unit.Status.OCCUPIED)
        self.assertEqual(prospect.status, Tenant.Status.ACTIVE)
        self.assertEqual(self.client.patch(
            f'/api/v1/property/leases/{lease.id}/', {'status': Lease.Status.TERMINATED},
            format='json', **self.headers,
        ).data['status'], Lease.Status.ACTIVE)
        terminated = self.client.post(f'/api/v1/property/leases/{lease.id}/terminate/', {}, format='json', **self.headers)
        self.assertEqual(terminated.status_code, 200, terminated.data)
        available.refresh_from_db()
        self.assertEqual(available.status, Unit.Status.AVAILABLE)

    def test_invoice_lifecycle_and_receipts_require_issued_invoice(self):
        created = self.client.post('/api/v1/property/invoices/', {
            'number': 'INV-DRAFT', 'lease': str(self.lease.id), 'invoice_type': 'rent',
            'issued_on': '2026-08-01', 'due_on': '2026-08-31', 'amount': '500.00',
            'balance': '1.00', 'status': Invoice.Status.PAID,
        }, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data['status'], Invoice.Status.DRAFT)
        self.assertEqual(Decimal(created.data['balance']), Decimal('500.00'))
        rejected = self.client.post('/api/v1/property/receipts/', {
            'number': 'RCT-DRAFT', 'tenant': str(self.tenant.id), 'invoice': created.data['id'],
            'received_on': '2026-08-01', 'amount': '100.00', 'payment_method': 'cash',
        }, format='json', **self.headers)
        self.assertEqual(rejected.status_code, 400)
        self.assertIn('allocated automatically', str(rejected.data['invoice'][0]).lower())
        premature_issue = self.client.post(f"/api/v1/property/invoices/{created.data['id']}/issue/", {}, format='json', **self.headers)
        self.assertEqual(premature_issue.status_code, 400)
        submitted = self.client.post(f"/api/v1/property/invoices/{created.data['id']}/submit-review/", {}, format='json', **self.headers)
        self.assertEqual(submitted.data['status'], Invoice.Status.REVIEW)
        approved = self.client.post(f"/api/v1/property/invoices/{created.data['id']}/approve/", {}, format='json', **self.headers)
        self.assertEqual(approved.data['status'], Invoice.Status.APPROVED)
        issued = self.client.post(f"/api/v1/property/invoices/{created.data['id']}/issue/", {}, format='json', **self.headers)
        self.assertEqual(issued.status_code, 200, issued.data)
        self.assertEqual(issued.data['status'], Invoice.Status.ISSUED)
        self.assertTrue(InvoiceReminder.objects.filter(invoice_id=created.data['id']).exists())

    def test_expense_requires_submit_approval_before_payment(self):
        created = self.client.post('/api/v1/property/expenses/', {
            'property': str(self.property.id), 'supplier': 'Lift Services Ltd',
            'category': 'maintenance', 'incurred_on': '2026-08-01', 'amount': '800.00',
            'status': Expense.Status.PAID,
        }, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        expense_id = created.data['id']
        self.assertEqual(created.data['status'], Expense.Status.DRAFT)
        premature = self.client.post(f'/api/v1/property/expenses/{expense_id}/mark-paid/', {}, format='json', **self.headers)
        self.assertEqual(premature.status_code, 400)
        for action, expected in (('submit', Expense.Status.PENDING), ('approve', Expense.Status.APPROVED), ('mark-paid', Expense.Status.PAID)):
            response = self.client.post(f'/api/v1/property/expenses/{expense_id}/{action}/', {}, format='json', **self.headers)
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['status'], expected)

    def test_rent_schedule_generates_one_invoice_idempotently(self):
        from datetime import timedelta
        from django.utils import timezone
        today = timezone.localdate()
        schedule = RentSchedule.objects.create(
            organization=self.organization, lease=self.lease,
            period_start=today.isoformat(), period_end=(today + timedelta(days=30)).isoformat(),
            due_on=(today + timedelta(days=5)).isoformat(),
            base_rent=Decimal('1000'), escalation_amount=Decimal('0'),
            service_charge=Decimal('100'), total=Decimal('1100'),
        )
        first = self.client.post(f'/api/v1/property/rent-schedules/{schedule.id}/generate-invoice/', {}, format='json', **self.headers)
        self.assertEqual(first.status_code, 201, first.data)
        second = self.client.post(f'/api/v1/property/rent-schedules/{schedule.id}/generate-invoice/', {}, format='json', **self.headers)
        self.assertEqual(second.status_code, 200, second.data)
        schedule.refresh_from_db()
        self.assertEqual(schedule.status, RentSchedule.Status.INVOICED)
        self.assertEqual(Invoice.objects.filter(rent_schedule_item=schedule).count(), 1)

    def test_expired_lease_cannot_generate_rent_invoice(self):
        from datetime import timedelta
        from django.utils import timezone
        today = timezone.localdate()
        self.lease.ends_on = today
        self.lease.save(update_fields=('ends_on',))
        schedule = RentSchedule.objects.create(
            organization=self.organization, lease=self.lease,
            period_start=today - timedelta(days=30), period_end=today,
            due_on=today - timedelta(days=25), base_rent=Decimal('1000'),
            escalation_amount=Decimal('0'), service_charge=Decimal('0'), total=Decimal('1000'),
        )
        response = self.client.post(f'/api/v1/property/rent-schedules/{schedule.id}/generate-invoice/', {}, format='json', **self.headers)
        self.assertEqual(response.status_code, 400)
        self.assertIn('expired', str(response.data).lower())
        self.assertFalse(Invoice.objects.filter(rent_schedule_item=schedule).exists())
        manual = self.client.post('/api/v1/property/invoices/', {
            'number': 'EXPIRED-LEASE-INVOICE', 'lease': str(self.lease.id), 'invoice_type': 'rent',
            'issued_on': today, 'due_on': today, 'subtotal': '1000.00', 'tax_rate': '0',
            'tax_amount': '0', 'amount': '1000.00',
        }, format='json', **self.headers)
        self.assertEqual(manual.status_code, 400)
        self.assertIn('expired', str(manual.data).lower())

    def test_invoice_preview_and_bulk_generation_apply_vat_and_create_reviewable_drafts(self):
        from datetime import timedelta
        from django.utils import timezone
        today = timezone.localdate()
        schedules = [RentSchedule.objects.create(
            organization=self.organization, lease=self.lease,
            period_start=today + timedelta(days=index * 31), period_end=today + timedelta(days=index * 31 + 30),
            due_on=today + timedelta(days=index * 31 + 5), base_rent=Decimal('1000'),
            escalation_amount=Decimal('0'), service_charge=Decimal('100'), total=Decimal('1100'),
        ) for index in range(2)]
        preview = self.client.post(
            f'/api/v1/property/rent-schedules/{schedules[0].id}/preview/', {'tax_rate': '16'}, format='json', **self.headers,
        )
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(Decimal(preview.data['tax_amount']), Decimal('176.00'))
        self.assertEqual(Decimal(preview.data['total']), Decimal('1276.00'))
        generated = self.client.post('/api/v1/property/rent-schedules/bulk-generate-invoices/', {
            'schedule_ids': [str(schedule.id) for schedule in schedules], 'tax_rate': '16',
        }, format='json', **self.headers)
        self.assertEqual(generated.status_code, 201, generated.data)
        self.assertEqual(generated.data['created_count'], 2)
        invoices = Invoice.objects.filter(rent_schedule_item__in=schedules)
        self.assertEqual(invoices.filter(status=Invoice.Status.DRAFT, tax_rate=16, tax_amount=Decimal('176')).count(), 2)
        repeated = self.client.post('/api/v1/property/rent-schedules/bulk-generate-invoices/', {
            'schedule_ids': [str(schedule.id) for schedule in schedules], 'tax_rate': '16',
        }, format='json', **self.headers)
        self.assertEqual(repeated.data['created_count'], 0)
        self.assertEqual(repeated.data['existing_count'], 2)

    def test_service_charge_allocations_and_reconciliation_are_calculated_server_side(self):
        self.unit.area = Decimal('100')
        self.unit.save()
        Unit.objects.create(
            organization=self.organization, property=self.property, code='202',
            area=Decimal('300'), status=Unit.Status.AVAILABLE,
        )
        charge = ServiceCharge.objects.create(
            organization=self.organization, property=self.property, name='2026 Service Charge',
            method=ServiceCharge.Method.AREA, annual_budget=Decimal('4800'),
            starts_on='2026-01-01',
        )
        allocated = self.client.post(
            f'/api/v1/property/service-charges/{charge.id}/generate-allocations/',
            {}, format='json', **self.headers,
        )
        self.assertEqual(allocated.status_code, 200, allocated.data)
        self.assertEqual(len(allocated.data), 2)
        self.assertEqual(
            sum(ServiceChargeAllocation.objects.filter(service_charge=charge).values_list('annual_amount', flat=True)),
            Decimal('4800.00'),
        )
        Expense.objects.create(
            organization=self.organization, property=self.property, supplier='Caretaker Ltd',
            category='service charge', incurred_on='2026-07-15', amount=Decimal('300'),
            status=Expense.Status.APPROVED,
        )
        reconciled = self.client.post(f'/api/v1/property/service-charges/{charge.id}/reconcile/', {
            'period_start': '2026-07-01', 'period_end': '2026-07-31',
        }, format='json', **self.headers)
        self.assertEqual(reconciled.status_code, 200, reconciled.data)
        self.assertEqual(Decimal(reconciled.data['actual_amount']), Decimal('300.00'))
        record = ServiceChargeReconciliation.objects.get(service_charge=charge)
        self.assertEqual(record.variance, record.budgeted_amount - record.actual_amount)

    def test_budget_approval_and_actual_variance_are_dynamic(self):
        budget = Budget.objects.create(
            organization=self.organization, property=self.property, year=2026,
            category='Utilities', amount=Decimal('1000'),
        )
        Expense.objects.create(
            organization=self.organization, property=self.property, supplier='Power Co',
            category='Utilities', incurred_on='2026-05-01', amount=Decimal('250'),
            status=Expense.Status.PAID,
        )
        for action, expected in (('submit', Budget.Status.PENDING), ('approve', Budget.Status.APPROVED)):
            response = self.client.post(
                f'/api/v1/property/budgets/{budget.id}/{action}/', {}, format='json', **self.headers,
            )
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['status'], expected)
        listed = self.client.get('/api/v1/property/budgets/', **self.headers)
        row = next(item for item in listed.data if item['id'] == str(budget.id))
        self.assertEqual(Decimal(row['actual_amount']), Decimal('250.00'))
        self.assertEqual(Decimal(row['variance']), Decimal('750.00'))

    def test_aging_analytics_and_csv_export_use_live_tenant_data(self):
        aging = self.client.get('/api/v1/property/analytics/aging/', **self.headers)
        self.assertEqual(aging.status_code, 200, aging.data)
        self.assertEqual(Decimal(aging.data['total']), Decimal('1000.00'))
        self.assertEqual(aging.data['tenants'][0]['tenant'], self.tenant.name)
        exported = self.client.get('/api/v1/property/analytics/exports/aging/', **self.headers)
        self.assertEqual(exported.status_code, 200)
        self.assertIn('text/csv', exported['Content-Type'])
        self.assertIn('INV-1', exported.content.decode())

    def test_bulk_unit_generation_is_bounded_and_idempotent(self):
        generated = self.client.post(f'/api/v1/property/properties/{self.property.id}/bulk-units/', {
            'count': 3, 'start': 10, 'prefix': 'A-', 'unit_type': 'Office', 'area': '75.00',
        }, format='json', **self.headers)
        self.assertEqual(generated.status_code, 201, generated.data)
        self.assertEqual(generated.data['created'], 3)
        repeated = self.client.post(f'/api/v1/property/properties/{self.property.id}/bulk-units/', {
            'count': 3, 'start': 10, 'prefix': 'A-', 'unit_type': 'Office', 'area': '75.00',
        }, format='json', **self.headers)
        self.assertEqual(repeated.status_code, 201, repeated.data)
        self.assertEqual(repeated.data['created'], 0)
        self.assertEqual(Unit.objects.filter(property=self.property, code__startswith='A-').count(), 3)
        rejected = self.client.post(f'/api/v1/property/properties/{self.property.id}/bulk-units/', {
            'count': 501, 'start': 1,
        }, format='json', **self.headers)
        self.assertEqual(rejected.status_code, 400)

    def test_bulk_onboard_tenants_and_multi_floor_leases(self):
        u1 = Unit.objects.create(organization=self.organization, property=self.property, code='FL1-01', floor='1', area=Decimal('100.00'))
        u2 = Unit.objects.create(organization=self.organization, property=self.property, code='FL2-01', floor='2', area=Decimal('200.00'))

        payload = {
            'rows': [
                {
                    'tenant': {'name': 'Mega Corp Ltd', 'tax_id': 'P059999999X', 'email': 'corp@example.com'},
                    'lease': {'unit_code': 'FL1-01', 'starts_on': '2026-01-01', 'term_months': 12, 'monthly_rent': '50000', 'service_charge_rate_per_sqft': '15', 'vat_rate': '16'},
                },
                {
                    'tenant': {'name': 'Mega Corp Ltd', 'tax_id': 'P059999999X', 'email': 'corp@example.com'},
                    'lease': {'unit_code': 'FL2-01', 'starts_on': '2026-03-01', 'term_months': 24, 'monthly_rent': '120000', 'service_charge_rate_per_sqft': '20', 'vat_rate': '16'},
                },
            ]
        }
        res = self.client.post('/api/v1/property/tenants/bulk-onboard/', payload, format='json', **self.headers)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['succeeded_count'], 2)
        self.assertEqual(res.data['failed_count'], 0)

        # Confirm single tenant entity created with 2 distinct leases across floors
        tenant = Tenant.objects.get(organization=self.organization, tax_id='P059999999X')
        leases = tenant.leases.all()
        self.assertEqual(leases.count(), 2)
        self.assertEqual(set(leases.values_list('unit__code', flat=True)), {'FL1-01', 'FL2-01'})

    def test_lease_import_previews_then_creates_drafts_with_unit_deposit(self):
        unit = Unit.objects.create(organization=self.organization, property=self.property, code='IMPORT-01', area=Decimal('500'))
        tenant = Tenant.objects.create(organization=self.organization, property=self.property, code='TNT-IMPORT', name='Imported Tenant')
        deposit_item = BillingItem.objects.create(
            organization=self.organization, code='SECURITY_DEPOSIT', name='Security deposit',
            calculation=BillingItem.Calculation.FIXED, is_recurring=False,
        )
        UnitChargeRule.objects.create(
            organization=self.organization, unit=unit, billing_item=deposit_item,
            frequency=UnitChargeRule.Frequency.ONE_OFF, amount=Decimal('75000'),
        )
        rows = [{'tenant_code': tenant.code, 'unit_code': unit.code, 'starts_on': '2026-09-01', 'ends_on': '2027-08-31', 'monthly_rent': '45000', 'billing_day': '5'}]
        preview = self.client.post('/api/v1/property/leases/bulk-import/', {'mode': 'preview', 'rows': rows}, format='json', **self.headers)
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(preview.data['valid_count'], 1)
        self.assertEqual(preview.data['rows'][0]['data']['deposit'], '75000.00')
        self.assertFalse(Lease.objects.filter(unit=unit).exists())
        committed = self.client.post('/api/v1/property/leases/bulk-import/', {'mode': 'commit', 'rows': rows}, format='json', **self.headers)
        self.assertEqual(committed.status_code, 201, committed.data)
        lease = Lease.objects.get(unit=unit)
        self.assertEqual(lease.status, Lease.Status.DRAFT)
        self.assertEqual(lease.deposit, Decimal('75000'))
        self.assertEqual(lease.metadata['source'], 'lease_import')
        self.assertTrue(lease.billing_profiles.filter(billing_item=deposit_item).exists())

    def test_tenant_portal_is_user_linked_and_creates_scoped_service_request(self):
        TenantPortalAccess.objects.create(
            organization=self.organization, user=self.user, tenant=self.tenant,
        )
        portal = self.client.get('/api/v1/property/portal/', **self.headers)
        self.assertEqual(portal.status_code, 200, portal.data)
        self.assertEqual(portal.data['tenant']['id'], str(self.tenant.id))
        self.assertEqual(portal.data['currentLease']['id'], str(self.lease.id))
        self.assertEqual(len(portal.data['invoices']), 1)
        support_view = self.client.get(f'/api/v1/property/portal/{self.tenant.id}/', **self.headers)
        self.assertEqual(support_view.status_code, 200, support_view.data)
        self.assertEqual(support_view.data['tenant']['id'], str(self.tenant.id))
        created = self.client.post('/api/v1/property/portal/service-requests/', {
            'subject': 'Leaking tap', 'category': 'Plumbing',
            'description': 'Kitchen tap is leaking.', 'priority': 'high',
        }, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        request_record = ServiceRequest.objects.get(pk=created.data['id'])
        self.assertEqual(request_record.tenant, self.tenant)
        self.assertEqual(request_record.unit, self.unit)
        TenantPortalAccess.objects.filter(user=self.user).update(is_active=False)
        self.assertEqual(self.client.get('/api/v1/property/portal/', **self.headers).status_code, 403)

    def test_tenant_portal_support_preview_only_returns_tenant_facing_notices(self):
        portal_user = get_user_model().objects.create_user(username='tenant-notices', password='test')
        Membership.objects.create(user=portal_user, organization=self.organization)
        TenantPortalAccess.objects.create(
            organization=self.organization, user=portal_user, tenant=self.tenant,
        )
        tenant_notice = Notification.objects.create(
            organization=self.organization, recipient=portal_user,
            title='Payment reminder', message='Your rent invoice is due.',
            action_url='/tenant-portal?tab=notices',
        )
        Notification.objects.create(
            organization=self.organization, recipient=self.user,
            title='New Helpdesk Ticket TT-123', message='Internal staff dispatch message.',
            action_url='/companion?tab=feedback',
        )
        response = self.client.get(
            f'/api/v1/property/portal/?tenant={self.tenant.id}', **self.headers,
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([row['id'] for row in response.data['notices']], [tenant_notice.id])
        self.assertNotIn('Helpdesk', ' '.join(row['title'] for row in response.data['notices']))

    def test_offer_letter_acceptance_blocks_then_releases_first_billing(self):
        TenantPortalAccess.objects.create(
            organization=self.organization, user=self.user, tenant=self.tenant,
        )
        issued = self.client.post(
            f'/api/v1/property/leases/{self.lease.id}/offer-letter/', {}, format='json', **self.headers,
        )
        self.assertEqual(issued.status_code, 200, issued.data)
        self.assertEqual(issued.data['offer_letter']['status'], 'issued')
        self.assertTrue(Notification.objects.filter(
            recipient=self.user, metadata__offer_reference=issued.data['offer_letter']['reference'],
        ).exists())

        run = BillingRun.objects.create(
            organization=self.organization, property=self.property,
            period_start=date(2026, 8, 1), period_end=date(2026, 8, 31), created_by=self.user,
        )
        prepared = self.client.post(f'/api/v1/property/billing-runs/{run.id}/prepare/', {}, format='json', **self.headers)
        self.assertEqual(prepared.status_code, 200, prepared.data)
        candidate = BillingCandidate.objects.get(billing_run=run, lease=self.lease)
        self.assertEqual(candidate.status, BillingCandidate.Status.ISSUE)
        self.assertTrue(any(issue['code'] == 'offer_letter_pending' for issue in candidate.issue_summary))

        accepted = self.client.post('/api/v1/property/portal/offer-letter/accept/', {
            'accepted_by': 'A Tenant', 'confirmed': True,
        }, format='json', **self.headers)
        self.assertEqual(accepted.status_code, 200, accepted.data)
        self.assertEqual(accepted.data['offer_letter']['status'], 'accepted')
        prepared = self.client.post(f'/api/v1/property/billing-runs/{run.id}/prepare/', {}, format='json', **self.headers)
        self.assertEqual(prepared.status_code, 200, prepared.data)
        candidate.refresh_from_db()
        self.assertEqual(candidate.status, BillingCandidate.Status.READY)

    def test_ongoing_property_bypasses_offer_letter_blocker(self):
        # Ongoing properties or active tenancies without explicit require_offer_letter do not block billing
        self.lease.metadata = {'offer_letter': {'status': 'issued'}}
        self.lease.save()
        run = BillingRun.objects.create(
            organization=self.organization, property=self.property,
            period_start=date(2026, 9, 1), period_end=date(2026, 9, 30), created_by=self.user,
        )
        prepared = self.client.post(f'/api/v1/property/billing-runs/{run.id}/prepare/', {}, format='json', **self.headers)
        self.assertEqual(prepared.status_code, 200)
        candidate = BillingCandidate.objects.get(billing_run=run, lease=self.lease)
        self.assertFalse(any(issue['code'] == 'offer_letter_pending' for issue in candidate.issue_summary))
        self.assertEqual(candidate.status, BillingCandidate.Status.READY)

    def test_lease_renewal_preserves_continuity_and_is_idempotent(self):
        renewed = self.client.post(f'/api/v1/property/leases/{self.lease.id}/renew/', {
            'reference': 'LEASE-1-R1', 'ends_on': '2028-01-01', 'monthly_rent': '1100.00',
        }, format='json', **self.headers)
        self.assertEqual(renewed.status_code, 201, renewed.data)
        self.lease.refresh_from_db(); self.unit.refresh_from_db()
        self.assertEqual(self.lease.status, Lease.Status.EXPIRED)
        self.assertEqual(self.unit.status, Unit.Status.OCCUPIED)
        renewal = Lease.objects.get(renewed_from=self.lease)
        self.assertEqual(renewal.status, Lease.Status.ACTIVE)
        self.assertEqual(renewal.starts_on, self.lease.ends_on)
        repeated = self.client.post(f'/api/v1/property/leases/{self.lease.id}/renew/', {
            'reference': 'SHOULD-NOT-CREATE', 'ends_on': '2029-01-01', 'monthly_rent': '1200.00',
        }, format='json', **self.headers)
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(Lease.objects.filter(renewed_from=self.lease).count(), 1)

    def test_invoice_reminder_creates_portal_notice(self):
        TenantPortalAccess.objects.create(
            organization=self.organization, user=self.user, tenant=self.tenant,
        )
        response = self.client.post(f'/api/v1/property/invoices/{self.invoice.id}/send-reminder/', {
            'channel': InvoiceReminder.Channel.PORTAL,
            'notice_type': InvoiceReminder.NoticeType.FORMAL_DEMAND,
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        reminder = InvoiceReminder.objects.get(invoice=self.invoice, sent_by=self.user)
        self.assertEqual(reminder.notice_type, InvoiceReminder.NoticeType.FORMAL_DEMAND)
        notice = Notification.objects.get(metadata__invoice_id=str(self.invoice.id))
        self.assertEqual(notice.recipient, self.user)

    def test_bank_transaction_matches_one_equal_receipt_and_locks_record(self):
        receipt = Receipt.objects.create(
            organization=self.organization, number='RCT-BANK', tenant=self.tenant,
            received_on='2026-08-01', amount=Decimal('300'), payment_method='bank_transfer',
            external_reference='BANK-TXN-001', received_by=self.user,
        )
        created = self.client.post('/api/v1/property/bank-transactions/', {
            'reference': 'BANK-TXN-001', 'transacted_on': '2026-08-01',
            'description': 'Acacia rent', 'amount': '300.00', 'status': 'matched',
        }, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data['status'], BankTransaction.Status.UNMATCHED)
        matched = self.client.post(f"/api/v1/property/bank-transactions/{created.data['id']}/match/", {
            'receipt': str(receipt.id),
        }, format='json', **self.headers)
        self.assertEqual(matched.status_code, 200, matched.data)
        self.assertEqual(matched.data['status'], BankTransaction.Status.MATCHED)
        self.assertEqual(self.client.patch(
            f"/api/v1/property/bank-transactions/{created.data['id']}/", {'amount': '200'},
            format='json', **self.headers,
        ).status_code, 400)

    def test_receipt_number_is_generated_when_the_user_does_not_supply_one(self):
        response = self.client.post('/api/v1/property/receipts/', {
            'tenant': str(self.tenant.id), 'received_on': '2026-08-01', 'amount': '300.00',
            'payment_method': 'bank_transfer', 'external_reference': 'AUTO-RECEIPT-1',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertRegex(response.data['number'], r'^RCPT-2026-\d{5}$')

    def test_bank_statement_csv_import_is_idempotent_and_validates_required_columns(self):
        statement = SimpleUploadedFile(
            'august-statement.csv',
            b'reference,date,description,amount\nKCB-100,2026-08-01,Acacia rent,"1,250.00"\n',
            content_type='text/csv',
        )
        response = self.client.post('/api/v1/property/bank-transactions/import-csv/', {'file': statement}, **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data, {'created': 1, 'skipped': 0})
        transaction_record = BankTransaction.objects.get(organization=self.organization, reference='KCB-100')
        self.assertEqual(transaction_record.amount, Decimal('1250.00'))
        repeated = self.client.post('/api/v1/property/bank-transactions/import-csv/', {
            'file': SimpleUploadedFile('august-statement.csv', b'reference,date,amount\nKCB-100,2026-08-01,1250\n', content_type='text/csv')
        }, **self.headers)
        self.assertEqual(repeated.status_code, 201, repeated.data)
        self.assertEqual(repeated.data, {'created': 0, 'skipped': 1})
        invalid = self.client.post('/api/v1/property/bank-transactions/import-csv/', {
            'file': SimpleUploadedFile('invalid.csv', b'reference,amount\nKCB-101,1250\n', content_type='text/csv')
        }, **self.headers)
        self.assertEqual(invalid.status_code, 400, invalid.data)

    def test_tenancy_occupancy_report_is_live_and_property_scoped(self):
        headers = {**self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id)}
        response = self.client.get(
            '/api/v1/property/analytics/tenancy-occupancy/?start=2026-01-01&end=2026-12-31',
            **headers,
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['kpis']['total_units'], 1)
        self.assertEqual(response.data['kpis']['occupied_units'], 1)
        self.assertEqual(response.data['kpis']['occupancy_rate'], 100.0)
        self.assertEqual(response.data['tenancy_schedule'][0]['tenant'], self.tenant.name)
        self.assertEqual(response.data['tenancy_schedule'][0]['property'], self.property.name)
        self.assertIn('floor', response.data['tenancy_schedule'][0])
        self.assertIn('service_charge', response.data['tenancy_schedule'][0])
        self.assertIn('escalation_percent', response.data['tenancy_schedule'][0])
        self.assertIn('next_effective_rent', response.data['tenancy_schedule'][0])
        self.assertIn('owner', response.data['tenancy_schedule'][0])
        self.assertIn('management_mandate', response.data['tenancy_schedule'][0])
        self.assertEqual(len(response.data['ownership_schedule']), 1)
        self.assertIn('billing_readiness', response.data['ownership_schedule'][0])
        self.assertEqual(response.data['lease_expiry'][0]['lease'], self.lease.reference)

    def test_each_visible_report_tab_exports_its_own_dataset_in_supported_formats(self):
        headers = {**self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id)}
        report_headings = {
            'tenancy-schedule': b'Escalation %', 'ownership-schedule': b'Billing Readiness', 'vacancy': b'Days vacant',
            'movements': b'Movement', 'income-analysis': b'Annualized income',
            'billing-schedule': b'Outstanding C/F', 'vat-schedule': b'Taxable value',
            'expenses-schedule': b'Budget code',
        }
        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            for report_key, heading in report_headings.items():
                csv_response = self.client.get(
                    f'/api/v1/property/analytics/exports/{report_key}/?start=2026-01-01&end=2026-12-31&output=csv',
                    **headers,
                )
                self.assertEqual(csv_response.status_code, 200, report_key)
                self.assertIn(heading, csv_response.content, report_key)
                xlsx_response = self.client.get(
                    f'/api/v1/property/analytics/exports/{report_key}/?start=2026-01-01&end=2026-12-31&output=xlsx',
                    **headers,
                )
                self.assertEqual(xlsx_response.status_code, 200, report_key)
                self.assertEqual(xlsx_response['Content-Type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                pdf_response = self.client.get(
                    f'/api/v1/property/analytics/exports/{report_key}/?start=2026-01-01&end=2026-12-31&output=pdf',
                    **headers,
                )
                self.assertEqual(pdf_response.status_code, 200, report_key)
                self.assertEqual(pdf_response['Content-Type'], 'application/pdf')

            billing_csv = self.client.get(
                '/api/v1/property/analytics/exports/billing-schedule/?start=2026-01-01&end=2026-12-31&output=csv',
                **headers,
            )
            billing_header = billing_csv.content.decode('utf-8-sig').splitlines()[0]
            self.assertEqual(
                billing_header,
                'Tenant,Unit / no.,Rent / month,Payment mode,Billings up to,Balance B/F,Current billings,Total billings,Receipts,Outstanding C/F',
            )
            for removed_column in ('Invoice', 'Property', 'Issued date', 'Due date'):
                self.assertNotIn(removed_column, billing_header)

    def test_financial_reports_reconcile_live_ledgers(self):
        self.invoice.subtotal = Decimal('1000'); self.invoice.save(update_fields=('subtotal',))
        Receipt.objects.create(
            organization=self.organization, number='RCT-FIN-1', tenant=self.tenant,
            invoice=self.invoice, received_on='2026-07-15', amount=Decimal('600'),
            payment_method='bank_transfer', received_by=self.user,
        )
        Expense.objects.create(
            organization=self.organization, property=self.property, supplier='Cleaner Ltd',
            category='Cleaning', incurred_on='2026-07-16', amount=Decimal('200'),
            taxable_amount=Decimal('172.41'), tax_amount=Decimal('27.59'), tax_code='VAT16',
            status=Expense.Status.APPROVED,
        )
        headers = {**self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id)}
        response = self.client.get(
            '/api/v1/property/analytics/financial-reports/?start=2026-07-01&end=2026-07-31',
            **headers,
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Decimal(response.data['kpis']['total_billed']), Decimal('1000'))
        self.assertEqual(Decimal(response.data['kpis']['total_collected']), Decimal('600'))
        self.assertEqual(Decimal(response.data['kpis']['total_expenses']), Decimal('200'))
        self.assertEqual(Decimal(response.data['kpis']['net_income']), Decimal('400'))
        self.assertEqual(response.data['billing_collection'][0]['invoice'], self.invoice.number)
        self.assertEqual(len(response.data['expenses']), 1)

    def test_exports_are_stored_audited_and_schedules_generate_downloadable_artifacts(self):
        headers = {**self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id)}
        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            exported = self.client.get(
                '/api/v1/property/analytics/exports/occupancy/?start=2026-01-01&end=2026-12-31&output=xlsx',
                **headers,
            )
            self.assertEqual(exported.status_code, 200)
            self.assertEqual(exported['Content-Type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            execution = ReportExecution.objects.get(pk=exported['X-Report-Execution-ID'])
            self.assertEqual(execution.status, ReportExecution.Status.COMPLETED)
            self.assertEqual(execution.output_format, 'xlsx')
            self.assertTrue(execution.file.storage.exists(execution.file.name))

            definition = ReportDefinition.objects.create(
                organization=self.organization, key='saved-occupancy', name='Saved occupancy',
                domain=ReportDefinition.Domain.TENANCY, default_filters={
                    '_report_key': 'occupancy', 'start': '2026-01-01', 'end': '2026-12-31',
                }, created_by=self.user,
            )
            self.user.email = 'manager@example.com'; self.user.save(update_fields=('email',))
            scheduled = self.client.post('/api/v1/property/scheduled-reports/', {
                'definition': str(definition.id), 'property': str(self.property.id),
                'frequency': 'monthly', 'next_run_at': '2026-08-11T12:00:00Z',
                'recipients': ['manager@example.com'], 'filters': {}, 'output_format': 'pdf',
            }, format='json', **headers)
            self.assertEqual(scheduled.status_code, 201, scheduled.data)
            generated = self.client.post(
                f"/api/v1/property/scheduled-reports/{scheduled.data['id']}/run/", {},
                format='json', **headers,
            )
            self.assertEqual(generated.status_code, 201, generated.data)
            self.assertEqual(generated.data['status'], ReportExecution.Status.COMPLETED)
            download = self.client.get(
                f"/api/v1/property/report-executions/{generated.data['id']}/download/", **headers,
            )
            self.assertEqual(download.status_code, 200)

            with mock.patch('django.core.mail.EmailMessage.send', side_effect=RuntimeError('SMTP unavailable')):
                retried = self.client.post(
                    f"/api/v1/property/scheduled-reports/{scheduled.data['id']}/run/", {},
                    format='json', **headers,
                )
            self.assertEqual(retried.status_code, 201, retried.data)
            schedule = ScheduledReport.objects.get(pk=scheduled.data['id'])
            self.assertEqual(schedule.last_delivery_status, 'delivery_failed')
            self.assertIn('SMTP unavailable', schedule.last_delivery_error)
            self.assertLessEqual(schedule.next_run_at, timezone.now() + timedelta(hours=1, minutes=1))

    def test_critical_report_pdfs_and_excel_are_branded_and_structured(self):
        self.property.metadata = {
            'lr_number': 'Nairobi/Block 1/100',
            'landlord': {'name': 'Demo Landlord', 'vat_registered': True},
        }
        self.property.save(update_fields=('metadata',))
        self.organization.settings = {
            'branding': {
                'company_name': 'Center Estates Demo',
                'address': 'Nairobi, Kenya',
                'email': 'reports@centerestates.demo',
                'tax_pin': 'P000000000X',
            },
        }
        self.organization.save(update_fields=('settings',))
        self.invoice.tax_amount = Decimal('160')
        self.invoice.subtotal = Decimal('1000')
        self.invoice.amount = Decimal('1160')
        self.invoice.metadata = {'billing_period': '2026-07'}
        self.invoice.save(update_fields=('tax_amount', 'subtotal', 'amount', 'metadata'))
        headers = {**self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id)}
        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            cases = (
                ('tenancy-schedule', b'TENANCY SCHEDULE', b'Floor'),
                ('aging', b'ARREARS AGEING', b'BUCKET'),
                ('vat-schedule', b'VAT', b'Output VAT'),
                ('billing-schedule', b"TENANTS PAYMENT'S STATUS", b'OUTSTANDING'),
                ('income-expense', b'RECEIPTS', b'DISBURSEMENTS'),
                ('tenant-payment-status', b"TENANTS PAYMENT'S STATUS", b'OUTSTANDING'),
            )
            for report_kind, title_token, body_token in cases:
                response = self.client.get(
                    f'/api/v1/property/analytics/exports/{report_kind}/?start=2026-01-01&end=2026-12-31&output=pdf',
                    **headers,
                )
                self.assertEqual(response.status_code, 200, report_kind)
                self.assertEqual(response['Content-Type'], 'application/pdf')
                self.assertGreater(len(response.content), 1200, report_kind)
                self.assertTrue(response.content.startswith(b'%PDF'), report_kind)
                # Branded PDFs embed report titles as plain text objects.
                self.assertIn(title_token[:8], response.content.upper(), report_kind)

            excel = self.client.get(
                '/api/v1/property/analytics/exports/tenancy-schedule/?start=2026-01-01&end=2026-12-31&output=xlsx',
                **headers,
            )
            self.assertEqual(excel.status_code, 200)
            self.assertEqual(
                excel['Content-Type'],
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            )
            self.assertTrue(excel.content[:2] == b'PK')
            self.assertTrue(excel['X-Report-Execution-ID'])
            self.assertIn('Tenancy', excel.get('X-Report-Title', 'Tenancy Schedule'))

    def test_approved_water_reading_flows_into_generated_invoice_line(self):
        water_item = BillingItem.objects.create(
            organization=self.organization, code='WATER', name='Water',
            calculation=BillingItem.Calculation.METERED, income_category='utilities',
        )
        BillingProfile.objects.create(
            organization=self.organization, lease=self.lease, billing_item=water_item,
            frequency=BillingProfile.Frequency.METERED, calculation=BillingItem.Calculation.METERED,
            amount=Decimal('0'), effective_from='2026-01-01', billing_day=1,
        )
        meter = UtilityMeter.objects.create(
            organization=self.organization, property=self.property, property_unit=self.unit,
            code='W-UNIT-101', name='Unit water', utility_type=UtilityMeter.Utility.WATER,
            unit='m3', tariff=Decimal('100'),
        )
        MeterReading.objects.create(
            organization=self.organization, meter=meter,
            read_at=timezone.make_aware(datetime(2026, 8, 20, 9, 0)),
            value=Decimal('150'), previous_value=Decimal('120'), consumption=Decimal('30'),
            cost=Decimal('3000'), status=MeterReading.Status.APPROVED, reviewed_by=self.user,
            reviewed_at=timezone.now(),
        )
        _, run_url, prepared = self._prepare_run('2026-08-01', '2026-08-31')
        water_lines = [
            item for candidate in prepared['candidates']
            for item in candidate['billing_items'] if item['code'] == 'WATER'
        ]
        self.assertEqual(len(water_lines), 1)
        self.assertEqual(water_lines[0]['total'], '3000.00')
        self.assertEqual(water_lines[0]['description'], 'Water')
        candidate = next(row for row in prepared['candidates'] if row['status'] == BillingCandidate.Status.READY)
        approver = self._create_billing_approver()
        self.client.force_authenticate(approver)
        self.assertEqual(self.client.post(f'{run_url}approve/', {}, format='json', **self.headers).status_code, 200)
        self.client.force_authenticate(self.user)
        generated = self.client.post(f'{run_url}generate/', {
            'candidate_ids': [candidate['id']],
        }, format='json', **self.headers)
        self.assertEqual(generated.status_code, 201, generated.data)
        invoice_ids = [row['id'] for row in generated.data['invoices']]
        descriptions = set(InvoiceLine.objects.filter(invoice_id__in=invoice_ids).values_list('description', flat=True))
        self.assertIn('Water', descriptions)
        water_line = InvoiceLine.objects.get(invoice_id__in=invoice_ids, description='Water')
        self.assertEqual(water_line.total, Decimal('3000.00'))
        self.assertEqual(water_line.source_type, 'billing_profile')

    def test_property_scope_and_role_allow_deny_for_billing_and_reports(self):
        other_property = Property.objects.create(
            organization=self.other, code='FOREIGN', name='Other org property', status=Property.Status.ACTIVE,
        )
        foreign = self.client.get(
            '/api/v1/property/dashboard/',
            **{**self.headers, 'HTTP_X_PROPERTY_ID': str(other_property.id)},
        )
        self.assertEqual(foreign.status_code, 403)

        scoped = self.client.get(
            '/api/v1/property/analytics/tenancy-occupancy/?start=2026-01-01&end=2026-12-31',
            **{**self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id)},
        )
        self.assertEqual(scoped.status_code, 200, getattr(scoped, 'data', scoped.content))

        viewer = self._create_role_user('billing-viewer', 'property.view')
        self.client.force_authenticate(viewer)
        self.assertEqual(
            self.client.post('/api/v1/property/billing-runs/', {
                'property': str(self.property.id),
                'period_start': '2026-10-01', 'period_end': '2026-10-31',
            }, format='json', **self.headers).status_code,
            403,
        )
        self.assertEqual(self.client.get('/api/v1/property/dashboard/', **self.headers).status_code, 200)

        accountant = self._create_role_user(
            'billing-accountant-role', 'property.view', 'property.finance', 'property.report',
        )
        self.client.force_authenticate(accountant)
        created = self.client.post('/api/v1/property/billing-runs/', {
            'property': str(self.property.id),
            'period_start': '2026-10-01', 'period_end': '2026-10-31',
        }, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(
            self.client.post(
                f"/api/v1/property/billing-runs/{created.data['id']}/approve/", {},
                format='json', **self.headers,
            ).status_code,
            403,
        )
        self.client.force_authenticate(self.user)

    # ─── P0: CREDIT NOTE VOID ───

    def test_credit_note_void_restores_invoice_balance(self):
        """Voiding a credit note restores the invoice balance and prevents double-void."""
        # Create credit note
        cn_resp = self.client.post('/api/v1/property/credit-notes/', {
            'number': 'CN-VOID-001', 'invoice': str(self.invoice.id),
            'issued_on': '2026-07-31', 'amount': '300.00',
            'reason': 'Test abatement',
        }, format='json', **self.headers)
        self.assertEqual(cn_resp.status_code, 201, cn_resp.data)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.balance, Decimal('700.00'))
        cn_id = cn_resp.data['id']

        # Void the credit note
        void_resp = self.client.post(
            f'/api/v1/property/credit-notes/{cn_id}/void/',
            {'reason': 'Incorrectly issued'}, format='json', **self.headers,
        )
        self.assertEqual(void_resp.status_code, 200, void_resp.data)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.balance, Decimal('1000.00'))
        cn = CreditNote.objects.get(pk=cn_id)
        self.assertEqual(cn.status, 'void')
        self.assertEqual(cn.void_reason, 'Incorrectly issued')

        # Double-void is rejected
        double_void = self.client.post(
            f'/api/v1/property/credit-notes/{cn_id}/void/',
            {'reason': 'Again'}, format='json', **self.headers,
        )
        self.assertEqual(double_void.status_code, 400)

    def test_credit_note_void_requires_reason(self):
        """Void without a reason is rejected."""
        cn_resp = self.client.post('/api/v1/property/credit-notes/', {
            'number': 'CN-VOID-002', 'invoice': str(self.invoice.id),
            'issued_on': '2026-07-31', 'amount': '100.00',
            'reason': 'Quick credit',
        }, format='json', **self.headers)
        self.assertEqual(cn_resp.status_code, 201)
        void_resp = self.client.post(
            f"/api/v1/property/credit-notes/{cn_resp.data['id']}/void/",
            {'reason': ''}, format='json', **self.headers,
        )
        self.assertEqual(void_resp.status_code, 400)

    # ─── P0: INVOICE VOID ───

    def test_invoice_void_sets_status_and_prevents_further_actions(self):
        """Voiding an issued invoice sets status to VOID."""
        resp = self.client.post(
            f'/api/v1/property/invoices/{self.invoice.id}/void/',
            {'reason': 'Duplicate'}, format='json', **self.headers,
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, Invoice.Status.VOID)

        # Cannot issue a void invoice
        issue_resp = self.client.post(
            f'/api/v1/property/invoices/{self.invoice.id}/issue/',
            {}, format='json', **self.headers,
        )
        self.assertIn(issue_resp.status_code, [400, 403])

    # ─── P0: M-PESA STK PUSH ───

    @mock.patch('properties.mpesa_client.get_oauth_token', return_value='test-token-abc')
    @mock.patch('properties.mpesa_client.initiate_stk_push')
    def test_mpesa_stk_push_creates_intent_and_calls_daraja(self, mock_stk, mock_oauth):
        """STK push creates PaymentIntent and calls Daraja API."""
        # Configure M-Pesa gateway
        gw = PaymentGatewayConfiguration.objects.create(
            organization=self.organization, property=self.property,
            provider=PaymentGatewayConfiguration.Provider.MPESA,
            display_name='M-Pesa Test', is_enabled=True,
            settings={
                'shortcode': '174379', 'passkey': 'test-passkey',
                'consumer_key': 'test-key', 'consumer_secret': 'test-secret',
                'environment': 'sandbox',
            },
        )
        mock_stk.return_value = {
            'success': True, 'checkout_request_id': 'ws_CO_1234',
            'merchant_request_id': 'MR_5678', 'response_code': '0',
            'response_description': 'Success', 'customer_message': 'Success. Enter PIN.',
        }

        # Create tenant portal access
        portal_user = get_user_model().objects.create_user(username='portal', password='pw')
        Membership.objects.create(user=portal_user, organization=self.organization, status='active')
        TenantPortalAccess.objects.create(
            organization=self.organization, tenant=self.tenant, user=portal_user,
        )

        # Verify gateway was created
        self.assertEqual(PaymentGatewayConfiguration.objects.filter(property=self.property).count(), 1)
        self.assertEqual(gw.provider, PaymentGatewayConfiguration.Provider.MPESA)

    def test_mpesa_gateway_missing_config_rejected(self):
        """STK push without gateway configuration is rejected."""
        # No gateway configured for this property
        self.assertEqual(
            PaymentGatewayConfiguration.objects.filter(property=self.property).count(), 0,
        )

    # ─── P1: TENANT EDIT ───

    def test_tenant_update_edit_fields(self):
        """PATCH tenant name, email, phone; verify code is immutable."""
        resp = self.client.patch(
            f'/api/v1/property/tenants/{self.tenant.id}/',
            {'name': 'Updated Tenant', 'email': 'new@example.com', 'phone': '0700111222'},
            format='json', **self.headers,
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.name, 'Updated Tenant')
        self.assertEqual(self.tenant.email, 'new@example.com')
        self.assertEqual(self.tenant.phone, '0700111222')
        self.assertEqual(self.tenant.code, 'TEN-1')  # Code unchanged

    def test_tenant_update_rejects_cross_org_assignment(self):
        """Cannot reassign a tenant to a different organization's property."""
        other_prop = Property.objects.create(
            organization=self.other, code='OTHER-1', name='Other Property',
        )
        resp = self.client.patch(
            f'/api/v1/property/tenants/{self.tenant.id}/',
            {'property': str(other_prop.id)}, format='json', **self.headers,
        )
        self.assertIn(resp.status_code, [400, 403])


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class PropertyRolePermissionApiTests(TestCase):
    """Role-complete acceptance for the Property manager, leasing officer and accountant."""

    def setUp(self):
        self.user = get_user_model().objects.create_user(username='property-role-user', password='test')
        self.organization = Organization.objects.create(name='Property Roles', slug='property-roles')
        self.membership = Membership.objects.create(
            user=self.user, organization=self.organization, is_default=True,
        )
        Subscription.objects.create(
            organization=self.organization, module=Module.PROPERTY, status=Subscription.Status.ACTIVE,
        )
        self.property = Property.objects.create(
            organization=self.organization, code='ROLE-1', name='Role Property',
            status=Property.Status.ACTIVE,
        )
        self.unit = Unit.objects.create(
            organization=self.organization, property=self.property, code='R1',
            status=Unit.Status.OCCUPIED,
        )
        self.tenant = Tenant.objects.create(
            organization=self.organization, code='RT-1', name='Role Tenant',
            status=Tenant.Status.ACTIVE,
        )
        self.lease = Lease.objects.create(
            organization=self.organization, reference='ROLE-LS-1', unit=self.unit,
            tenant=self.tenant, starts_on='2026-01-01', ends_on='2027-01-01',
            monthly_rent=Decimal('1000'), status=Lease.Status.ACTIVE,
        )
        self.invoice = Invoice.objects.create(
            organization=self.organization, number='ROLE-INV-1', lease=self.lease,
            issued_on='2026-07-01', due_on='2026-07-07', amount=Decimal('1000'),
            balance=Decimal('1000'), status=Invoice.Status.OVERDUE,
        )
        self.role = Role.objects.create(
            organization=self.organization, name='Business Role', slug='business-role',
        )
        MembershipRole.objects.create(membership=self.membership, role=self.role)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def _grant(self, *keys):
        for key in keys:
            permission, _ = Permission.objects.get_or_create(
                key=key, defaults={'label': key, 'module': key.split('.')[0]},
            )
            self.role.permissions.add(permission)

    def test_leasing_officer_onboards_tenants_and_verifies_documents_but_cannot_administer_or_issue_receipts(self):
        self._grant('property.view', 'property.leasing', 'property.report')
        self.assertEqual(self.client.get('/api/v1/property/dashboard/', **self.headers).status_code, 200)

        created = self.client.post('/api/v1/property/tenants/', {
            'code': 'RT-2', 'name': 'New Prospect', 'status': Tenant.Status.PROSPECT,
        }, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data['status'], Tenant.Status.PROSPECT)

        document = TenantDocument.objects.create(
            organization=self.organization, tenant=self.tenant,
            document_type='identity', document_number='A1234567',
            file_url='documents/passport.pdf',
        )
        verified = self.client.post(
            f'/api/v1/property/tenant-documents/{document.id}/verify/', {}, format='json', **self.headers,
        )
        self.assertEqual(verified.status_code, 200, verified.data)
        self.assertEqual(verified.data['status'], TenantDocument.Status.VERIFIED)

        self.assertEqual(
            self.client.post('/api/v1/property/properties/', {}, format='json', **self.headers).status_code,
            403,
        )
        self.assertEqual(
            self.client.post('/api/v1/property/receipts/', {}, format='json', **self.headers).status_code,
            403,
        )

    def test_accountant_issues_invoices_allocates_receipts_and_pays_expenses_but_cannot_administer_or_lease(self):
        self._grant('property.view', 'property.finance', 'property.approve', 'property.report')
        self.assertEqual(self.client.get('/api/v1/property/dashboard/', **self.headers).status_code, 200)

        draft = self.client.post('/api/v1/property/invoices/', {
            'number': 'ROLE-INV-2', 'lease': str(self.lease.id),
            'issued_on': '2026-08-01', 'due_on': '2026-08-07', 'amount': '1200.00',
        }, format='json', **self.headers)
        self.assertEqual(draft.status_code, 201, draft.data)
        self.assertEqual(draft.data['status'], Invoice.Status.DRAFT)
        self.client.post(f"/api/v1/property/invoices/{draft.data['id']}/submit-review/", {}, format='json', **self.headers)
        self.client.post(f"/api/v1/property/invoices/{draft.data['id']}/approve/", {}, format='json', **self.headers)
        issued = self.client.post(f"/api/v1/property/invoices/{draft.data['id']}/issue/", {}, format='json', **self.headers)
        self.assertEqual(issued.status_code, 200, issued.data)
        self.assertEqual(issued.data['status'], Invoice.Status.ISSUED)

        receipt = self.client.post('/api/v1/property/receipts/', {
            'number': 'ROLE-RCT-1', 'tenant': str(self.tenant.id),
            'received_on': '2026-08-01',
            'amount': '400.00', 'payment_method': 'bank_transfer',
            'external_reference': 'ROLE-BANK-1',
        }, format='json', **self.headers)
        self.assertEqual(receipt.status_code, 201, receipt.data)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.balance, Decimal('600.00'))

        expense = Expense.objects.create(
            organization=self.organization, property=self.property, supplier='KPLC',
            category='Utilities',
            description='Electricity bill', amount=Decimal('8000'),
            incurred_on='2026-08-01', status=Expense.Status.DRAFT,
        )
        submitted = self.client.post(
            f'/api/v1/property/expenses/{expense.id}/submit/', {}, format='json', **self.headers,
        )
        self.assertEqual(submitted.status_code, 200, submitted.data)
        approved = self.client.post(
            f'/api/v1/property/expenses/{expense.id}/approve/', {}, format='json', **self.headers,
        )
        self.assertEqual(approved.status_code, 200, approved.data)

        self.assertEqual(
            self.client.post('/api/v1/property/properties/', {}, format='json', **self.headers).status_code,
            403,
        )
        self.assertEqual(
            self.client.post('/api/v1/property/tenants/', {}, format='json', **self.headers).status_code,
            403,
        )

    def test_invoice_preparer_can_submit_but_cannot_approve_or_issue(self):
        self._grant('property.view', 'property.finance')
        draft = self.client.post('/api/v1/property/invoices/', {
            'number': 'ROLE-INV-SEPARATION', 'lease': str(self.lease.id),
            'issued_on': '2026-08-01', 'due_on': '2026-08-07',
            'subtotal': '1000.00', 'tax_rate': '16',
        }, format='json', **self.headers)
        self.assertEqual(draft.status_code, 201, draft.data)
        submitted = self.client.post(
            f"/api/v1/property/invoices/{draft.data['id']}/submit-review/", {},
            format='json', **self.headers,
        )
        self.assertEqual(submitted.status_code, 200, submitted.data)
        self.assertEqual(submitted.data['status'], Invoice.Status.REVIEW)
        self.assertEqual(self.client.post(
            f"/api/v1/property/invoices/{draft.data['id']}/approve/", {},
            format='json', **self.headers,
        ).status_code, 403)
        self.assertEqual(self.client.post(
            f"/api/v1/property/invoices/{draft.data['id']}/issue/", {},
            format='json', **self.headers,
        ).status_code, 403)

    # ─── P0: CREDIT NOTE VOID ───


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class TenantHandoverApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='hnd-user', password='test')
        self.organization = Organization.objects.create(name='HND Client', slug='hnd-client')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True, is_organization_admin=True)
        Subscription.objects.create(organization=self.organization, module=Module.PROPERTY, status=Subscription.Status.ACTIVE)
        self.property = Property.objects.create(organization=self.organization, code='P1', name='HND Building')
        self.unit = Unit.objects.create(organization=self.organization, property=self.property, code='101')
        self.tenant = Tenant.objects.create(organization=self.organization, code='TEN-1', name='Handover Tenant')
        self.lease = Lease.objects.create(
            organization=self.organization, reference='LSE-HND-1', unit=self.unit, tenant=self.tenant,
            starts_on='2026-09-01', ends_on='2027-09-01', monthly_rent=Decimal('25000'),
            status=Lease.Status.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def _create(self):
        return self.client.post('/api/v1/property/handovers/', {
            'lease': str(self.lease.id), 'handover_date': '2026-09-01',
            'condition_lines': [
                {'item': 'Flooring', 'condition': 'Good', 'notes': 'Tiles intact'},
                {'item': 'Walls', 'condition': 'Fair', 'notes': 'Minor scuffing'},
            ],
            'keys_items': [{'item': 'Main door key', 'quantity': 2}],
            'electricity_meter_number': 'KPLC-9911', 'electricity_opening_reading': '120.50',
            'notes': 'Handover completed at premises.',
        }, format='json', **self.headers)

    def test_full_handover_lifecycle(self):
        created = self._create()
        self.assertEqual(created.status_code, 201, created.data)
        self.assertTrue(created.data['code'].startswith('HND-'))
        self.assertEqual(created.data['unit_code'], '101')
        hid = created.data['id']
        blocked = self.client.post(f'/api/v1/property/handovers/{hid}/sign-tenant/', {}, format='json', **self.headers)
        self.assertEqual(blocked.status_code, 400)
        caretaker = self.client.post(f'/api/v1/property/handovers/{hid}/sign-caretaker/', {'caretaker_name': 'Joe Caretaker'}, format='json', **self.headers)
        self.assertEqual(caretaker.status_code, 200, caretaker.data)
        self.assertEqual(caretaker.data['status'], 'in_progress')
        tenant_sign = self.client.post(f'/api/v1/property/handovers/{hid}/sign-tenant/', {}, format='json', **self.headers)
        self.assertEqual(tenant_sign.status_code, 200, tenant_sign.data)
        self.assertEqual(tenant_sign.data['status'], 'completed')
        ack = self.client.post(f'/api/v1/property/handovers/{hid}/acknowledge/', {}, format='json', **self.headers)
        self.assertEqual(ack.status_code, 200, ack.data)
        self.assertEqual(ack.data['status'], 'acknowledged')

    def test_caretaker_signature_requires_condition_lines(self):
        created = self.client.post('/api/v1/property/handovers/', {'lease': str(self.lease.id)}, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        signed = self.client.post(f"/api/v1/property/handovers/{created.data['id']}/sign-caretaker/", {'caretaker_name': 'Joe'}, format='json', **self.headers)
        self.assertEqual(signed.status_code, 400)
        self.assertIn('condition_lines', signed.data)


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class ExitClearanceApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='exc-user', password='test')
        self.organization = Organization.objects.create(name='EXC Client', slug='exc-client')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True, is_organization_admin=True)
        Subscription.objects.create(organization=self.organization, module=Module.PROPERTY, status=Subscription.Status.ACTIVE)
        self.property = Property.objects.create(organization=self.organization, code='P1', name='EXC Building')
        self.unit = Unit.objects.create(organization=self.organization, property=self.property, code='201')
        self.tenant = Tenant.objects.create(organization=self.organization, code='TEN-2', name='Exiting Tenant')
        self.lease = Lease.objects.create(
            organization=self.organization, reference='LSE-EXC-1', unit=self.unit, tenant=self.tenant,
            starts_on='2025-09-01', ends_on='2026-09-01', monthly_rent=Decimal('25000'),
            status=Lease.Status.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def _create(self):
        return self.client.post('/api/v1/property/exit-clearances/', {
            'lease': str(self.lease.id), 'move_out_date': '2026-09-01',
            'move_out_conditions': 'Tenant must vacate by noon.',
            'deposit_amount': '50000.00',
        }, format='json', **self.headers)

    def _complete_sections(self, clearance_id):
        return self.client.patch(f'/api/v1/property/exit-clearances/{clearance_id}/', {
            'utilities_cleared': True, 'electricity_final_reading': '310.00',
            'inspection_passed': True, 'inspection_notes': 'Unit in good condition.',
            'rent_cleared': True, 'service_charge_cleared': True,
            'deductions': [{'item': 'Repainting', 'amount': '8000', 'notes': 'Scuffed walls'}],
        }, format='json', **self.headers)

    def test_full_exit_clearance_to_gate_pass(self):
        created = self._create()
        self.assertEqual(created.status_code, 201, created.data)
        self.assertTrue(created.data['code'].startswith('EXC-'))
        cid = created.data['id']
        early = self.client.post(f'/api/v1/property/exit-clearances/{cid}/mark-cleared/', {}, format='json', **self.headers)
        self.assertEqual(early.status_code, 400)
        patched = self._complete_sections(cid)
        self.assertEqual(patched.status_code, 200, patched.data)
        cleared = self.client.post(f'/api/v1/property/exit-clearances/{cid}/mark-cleared/', {}, format='json', **self.headers)
        self.assertEqual(cleared.status_code, 200, cleared.data)
        self.assertEqual(cleared.data['status'], 'cleared')
        self.assertEqual(cleared.data['refund_amount'], '42000.00')
        mgr = self.client.post(f'/api/v1/property/exit-clearances/{cid}/approve-manager/', {}, format='json', **self.headers)
        self.assertEqual(mgr.status_code, 200, mgr.data)
        fin = self.client.post(f'/api/v1/property/exit-clearances/{cid}/approve-finance/', {}, format='json', **self.headers)
        self.assertEqual(fin.status_code, 200, fin.data)
        self.assertEqual(fin.data['status'], 'approved')
        gp = self.client.post(f'/api/v1/property/exit-clearances/{cid}/issue-gate-pass/', {}, format='json', **self.headers)
        self.assertEqual(gp.status_code, 200, gp.data)
        self.assertEqual(gp.data['status'], 'gate_pass_issued')
        self.assertTrue(gp.data['gate_pass_number'].startswith('GP-'))

    def test_deductions_cannot_exceed_deposit(self):
        created = self._create()
        cid = created.data['id']
        over = self.client.patch(f'/api/v1/property/exit-clearances/{cid}/', {
            'deductions': [{'item': 'Damaged floor', 'amount': '60000'}],
        }, format='json', **self.headers)
        self.assertEqual(over.status_code, 400)
        self.assertIn('deductions', over.data)

    def test_gate_pass_requires_full_approval_chain(self):
        created = self._create()
        cid = created.data['id']
        self._complete_sections(cid)
        self.client.post(f'/api/v1/property/exit-clearances/{cid}/mark-cleared/', {}, format='json', **self.headers)
        skip = self.client.post(f'/api/v1/property/exit-clearances/{cid}/issue-gate-pass/', {}, format='json', **self.headers)
        self.assertEqual(skip.status_code, 400)


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class PropertyAccountingAuditFlowTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='fin-mgr', email='fin@example.com', password='test-password',
        )
        self.organization = Organization.objects.create(name='Fin Corp', slug='fin-corp')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True, is_organization_admin=True)
        Subscription.objects.create(organization=self.organization, module=Module.PROPERTY, status=Subscription.Status.ACTIVE)
        self.property = Property.objects.create(organization=self.organization, code='BLU-01', name='Blue Tower', status=Property.Status.ACTIVE)
        self.unit = Unit.objects.create(organization=self.organization, property=self.property, code='B-101', status=Unit.Status.OCCUPIED)
        self.tenant = Tenant.objects.create(organization=self.organization, code='TEN-01', name='Apex Logistics', status=Tenant.Status.ACTIVE)
        self.lease = Lease.objects.create(
            organization=self.organization, reference='LEASE-BLU-1', unit=self.unit, tenant=self.tenant,
            starts_on='2026-01-01', ends_on='2027-01-01', monthly_rent=Decimal('50000'), status=Lease.Status.ACTIVE,
        )
        self.invoice1 = Invoice.objects.create(
            organization=self.organization, number='INV-2026-000001', lease=self.lease,
            issued_on='2026-01-01', due_on='2026-01-05', amount=Decimal('50000'), balance=Decimal('50000'),
            status=Invoice.Status.ISSUED,
        )
        self.invoice2 = Invoice.objects.create(
            organization=self.organization, number='INV-2026-000002', lease=self.lease,
            issued_on='2026-02-01', due_on='2026-02-05', amount=Decimal('50000'), balance=Decimal('50000'),
            status=Invoice.Status.ISSUED,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def test_credit_note_auto_generates_number(self):
        res = self.client.post('/api/v1/property/credit-notes/', {
            'invoice': self.invoice1.id,
            'amount': '5000.00',
            'issued_on': '2026-08-27',
            'reason': 'Water charge billing correction',
        }, format='json', **self.headers)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data['number'].startswith('CN-2026-'), res.data['number'])
        self.invoice1.refresh_from_db()
        self.assertEqual(self.invoice1.balance, Decimal('45000.00'))

    def test_fifo_auto_allocation_and_reversal(self):
        receipt = Receipt.objects.create(
            organization=self.organization, number='RCT-2026-0001', tenant=self.tenant,
            received_on='2026-08-01', amount=Decimal('70000.00'), payment_method='mpesa',
            received_by=self.user,
        )
        auto_res = self.client.post('/api/v1/property/receipt-allocations/auto-allocate/', {}, format='json', **self.headers)
        self.assertEqual(auto_res.status_code, 200, auto_res.data)
        self.assertEqual(auto_res.data['allocated_count'], 2)

        self.invoice1.refresh_from_db()
        self.invoice2.refresh_from_db()
        self.assertEqual(self.invoice1.balance, Decimal('0.00'))
        self.assertEqual(self.invoice1.status, Invoice.Status.PAID)
        self.assertEqual(self.invoice2.balance, Decimal('30000.00'))
        self.assertEqual(self.invoice2.status, Invoice.Status.PARTIAL)

        allocations = ReceiptAllocation.objects.filter(receipt=receipt).order_by('created_at')
        self.assertEqual(allocations.count(), 2)

        rev_res = self.client.post(f'/api/v1/property/receipt-allocations/{allocations.first().id}/reverse/', {}, format='json', **self.headers)
        self.assertEqual(rev_res.status_code, 200, rev_res.data)
        self.invoice1.refresh_from_db()
        self.assertEqual(self.invoice1.balance, Decimal('50000.00'))
        self.assertEqual(self.invoice1.status, Invoice.Status.ISSUED)

    def test_multi_format_bank_statement_import_auto_matching_and_unreceipted_flagging(self):
        # Create an issued invoice and receipt for auto-matching
        matched_receipt = Receipt.objects.create(
            organization=self.organization, number='RCPT-2026-99001',
            tenant=self.tenant, invoice=self.invoice1, amount=Decimal('35000.00'),
            received_on=date(2026, 8, 15), payment_method='mpesa', external_reference='TCF6R8PBD2',
            received_by=self.user,
        )

        # Multi-row CSV simulating NBK statement with M-Pesa sweep, direct transfer, bank fee, and unreceipted credit
        csv_bytes = (
            b"Transaction Date,Value Date,Reference,Transaction Details,Debit,Credit,Book Balance\n"
            b"15/08/2026,15/08/2026,FT25074RP3BM,TCF6R8PBD2 From Acc.No. - KES1484877030077 625625 254714916329 KINGSLEY MPESA PAY BILL,0,35000.00,35000.00\n"
            b"16/08/2026,16/08/2026,FT2507520N6J,TCG0UXK9OY From Acc.No. - KES1484877030077 106 NAIMA MPESA PAY BILL,0,2000.00,37000.00\n"
            b"17/08/2026,17/08/2026,FT25076TAX01,Excise Duty Tax,100.00,0,36900.00\n"
            b"18/08/2026,18/08/2026,FT25077CHQ01,Transfer CHQ BOOK THE LYNX AT NGONG ROAD,0,5000.00,41900.00\n"
        )
        csv_file = SimpleUploadedFile('nbk_statement.csv', csv_bytes, content_type='text/csv')

        res = self.client.post('/api/v1/property/bank-transactions/import-statement/', {'file': csv_file}, format='multipart', **self.headers)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['total_parsed'], 4)
        self.assertEqual(res.data['created'], 4)
        self.assertEqual(res.data['auto_matched'], 1)
        self.assertEqual(res.data['unreceipted_credits'], 2)

        # Verify matched transaction
        tx1 = BankTransaction.objects.get(organization=self.organization, reference='FT25074RP3BM')
        self.assertEqual(tx1.status, BankTransaction.Status.MATCHED)
        self.assertEqual(tx1.receipt, matched_receipt)
        self.assertEqual(tx1.extracted_mpesa_ref, 'TCF6R8PBD2')
        self.assertEqual(tx1.transaction_type, BankTransaction.TransactionType.MPESA_SWEEP)

        # Verify unreceipted transaction
        tx2 = BankTransaction.objects.get(organization=self.organization, reference='FT2507520N6J')
        self.assertEqual(tx2.status, BankTransaction.Status.UNMATCHED)
        self.assertEqual(tx2.extracted_mpesa_ref, 'TCG0UXK9OY')
        self.assertEqual(tx2.extracted_account, '106')
        self.assertEqual(tx2.extracted_payer_name, 'NAIMA')

        # Verify tax debit transaction
        tx3 = BankTransaction.objects.get(organization=self.organization, reference='FT25076TAX01')
        self.assertEqual(tx3.transaction_type, BankTransaction.TransactionType.TAX)
        self.assertEqual(tx3.money_out, Decimal('100.00'))

    def test_quick_receipt_creates_receipt_and_reconciles_bank_transaction(self):
        tx = BankTransaction.objects.create(
            organization=self.organization, reference='FT2599DIRECT01',
            transacted_on=date(2026, 8, 20), amount=Decimal('10000.00'),
            money_in=Decimal('10000.00'), transaction_type=BankTransaction.TransactionType.DIRECT_DEPOSIT,
            extracted_payer_name='Direct Transfer Payer', status=BankTransaction.Status.UNMATCHED,
        )

        res = self.client.post(f'/api/v1/property/bank-transactions/{tx.id}/quick-receipt/', {
            'invoice_id': str(self.invoice1.id),
            'payer_name': 'Direct Transfer Payer',
            'payment_channel': 'bank_transfer',
        }, format='json', **self.headers)

        self.assertEqual(res.status_code, 201, res.data)
        tx.refresh_from_db()
        self.assertEqual(tx.status, BankTransaction.Status.MATCHED)
        self.assertIsNotNone(tx.receipt)
        self.assertEqual(tx.receipt.amount, Decimal('10000.00'))
        self.assertEqual(tx.receipt.payment_method, 'bank_transfer')

        self.invoice1.refresh_from_db()
        self.assertEqual(self.invoice1.balance, Decimal('40000.00'))
        self.assertEqual(self.invoice1.status, Invoice.Status.PARTIAL)


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class SectionalTitleOnboardingAndBillingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username='sectional_admin', email='sectional@example.com', password='password123'
        )
        self.organization = Organization.objects.create(name='Sectional Management Org', slug='sectional-mgmt-org')
        Membership.objects.create(
            organization=self.organization, user=self.user, is_default=True, is_organization_admin=True,
        )
        Subscription.objects.create(
            organization=self.organization, module=Module.PROPERTY, status=Subscription.Status.ACTIVE, is_active=True,
        )
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}
        self.client.force_authenticate(user=self.user)

    def test_bulk_owner_import_assigns_sectional_units_and_engagements(self):
        property_obj = Property.objects.create(
            organization=self.organization, code='PROP-BULK-OWN', name='Bulk Owner Court', is_sectional_title=True,
        )
        building = Building.objects.create(
            organization=self.organization, property=property_obj, code='BLOCK-A', name='Block A',
        )
        Unit.objects.create(organization=self.organization, property=property_obj, building=building, code='A-101')
        Unit.objects.create(organization=self.organization, property=property_obj, building=building, code='A-102')
        payload = {'mode': 'commit', 'rows': [{
            'name': 'Acacia Holdings Ltd', 'email': 'accounts@acacia.example', 'pin_number': 'P012345678X',
            'unit_codes': 'A-101; A-102', 'engaged_for_unit_management': 'yes', 'engaged_for_letting': 'no',
        }]}

        response = self.client.post('/api/v1/property/owners/bulk-import/', payload, format='json', **self.headers)

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['created_count'], 1)
        owner = Owner.objects.get(organization=self.organization, pin_number='P012345678X')
        self.assertTrue(owner.engaged_for_unit_management)
        self.assertFalse(owner.engaged_for_letting)
        self.assertEqual(owner.units.count(), 2)

    def test_sectional_title_onboarding_and_readiness_check(self):
        payload = {
            'property': {
                'name': 'Kilimani Heights Apartments',
                'scheme_registration_number': 'SS/NAI/2026/089',
                'total_blocks': 2,
                'total_units_count': 4,
                'estate_manager_name': 'Mary Wanjiku',
                'management_commencement_date': '2026-09-01',
                'address': 'Argwings Kodhek Road, Kilimani',
                'city': 'Nairobi',
            },
            'blocks': [
                {'name': 'Block A', 'floors': 5},
                {'name': 'Block B', 'floors': 5},
            ],
            'owners': [
                {
                    'name': 'Dr. James Kariuki',
                    'email': 'jkariuki@example.com',
                    'phone': '+254711223344',
                    'pin_number': 'A001234567Z',
                    'settlement_bank_name': 'KCB Bank',
                    'settlement_bank_account': '1234567890',
                    'settlement_bank_branch': 'Kilimani',
                },
                {
                    'name': 'Sarah Muthoni',
                    'email': 'smuthoni@example.com',
                    'phone': '+254722334455',
                    'pin_number': 'A009876543Y',
                    'settlement_bank_name': 'Equity Bank',
                    'settlement_bank_account': '0987654321',
                    'settlement_bank_branch': 'Upperhill',
                }
            ],
            'units': [
                {
                    'code': 'A101',
                    'block': 'Block A',
                    'floor': '1',
                    'owner_name': 'Dr. James Kariuki',
                    'sectional_title_number': 'ST/A101/2026',
                    'ownership_share': '0.2500',
                    'management_mandate': 'both',
                    'service_charge_payer': 'owner',
                    'water_payer': 'tenant',
                    'rental_commission_rate': '10.00',
                    'common_area_fee_amount': '5000.00',
                },
                {
                    'code': 'A102',
                    'block': 'Block A',
                    'floor': '1',
                    'owner_name': 'Dr. James Kariuki',
                    'sectional_title_number': 'ST/A102/2026',
                    'ownership_share': '0.2500',
                    'management_mandate': 'common_area_only',
                    'service_charge_payer': 'owner',
                    'water_payer': 'tenant',
                    'rental_commission_rate': '0.00',
                    'common_area_fee_amount': '5000.00',
                },
                {
                    'code': 'B201',
                    'block': 'Block B',
                    'floor': '2',
                    'owner_name': 'Sarah Muthoni',
                    'sectional_title_number': 'ST/B201/2026',
                    'ownership_share': '0.2500',
                    'management_mandate': 'rental_management',
                    'service_charge_payer': 'owner',
                    'water_payer': 'tenant',
                    'rental_commission_rate': '8.50',
                    'common_area_fee_amount': '5000.00',
                },
                {
                    'code': 'B202',
                    'block': 'Block B',
                    'floor': '2',
                    'owner_name': 'Sarah Muthoni',
                    'sectional_title_number': 'ST/B202/2026',
                    'ownership_share': '0.2500',
                    'management_mandate': 'both',
                    'service_charge_payer': 'owner',
                    'water_payer': 'tenant',
                    'rental_commission_rate': '10.00',
                    'common_area_fee_amount': '5000.00',
                }
            ],
            'fee_profiles': [
                {
                    'fee_type': 'common_area',
                    'calculation_basis': 'fixed',
                    'amount': '5000.00',
                    'billed_to': 'unit_owner',
                },
                {
                    'fee_type': 'rental_commission',
                    'calculation_basis': 'percentage',
                    'percentage_rate': '10.00',
                    'billed_to': 'unit_owner',
                }
            ],
            'collection_accounts': [
                {
                    'charge_type': 'rent',
                    'bank_name': 'NCBA Bank',
                    'account_name': 'Kilimani Heights Rent Collection',
                    'account_number': '1122334455',
                    'branch': 'Kilimani',
                    'mpesa_paybill': '522522',
                    'mpesa_reference_format': 'RENT-{UNIT}-{MONTH}-{YEAR}',
                },
                {
                    'charge_type': 'service_charge',
                    'bank_name': 'NCBA Bank',
                    'account_name': 'Kilimani Heights SC Collection',
                    'account_number': '1122334466',
                    'branch': 'Kilimani',
                    'mpesa_paybill': '522522',
                    'mpesa_reference_format': 'SC-{UNIT}-{MONTH}-{YEAR}',
                }
            ],
            'activate_immediately': True,
        }

        # Test Onboarding endpoint
        res = self.client.post('/api/v1/property/properties/onboard-sectional-title/', payload, format='json', **self.headers)
        self.assertEqual(res.status_code, 201, res.data)
        prop_id = res.data['id']

        # Verify created models
        prop = Property.objects.get(id=prop_id)
        self.assertTrue(prop.is_sectional_title)
        self.assertEqual(prop.scheme_registration_number, 'SS/NAI/2026/089')
        self.assertEqual(prop.buildings.count(), 2)
        self.assertEqual(prop.units.count(), 4)
        self.assertEqual(prop.collection_accounts.count(), 2)
        self.assertEqual(prop.fee_profiles.count(), 2)

        # Check unit owner assignment
        unit_a101 = prop.units.get(code='A101')
        self.assertIsNotNone(unit_a101.owner)
        self.assertEqual(unit_a101.owner.name, 'Dr. James Kariuki')
        self.assertEqual(unit_a101.management_mandate, 'both')
        self.assertEqual(unit_a101.common_area_fee_amount, Decimal('5000.00'))

        # Test Readiness Check endpoint
        rc_res = self.client.get(f'/api/v1/property/properties/{prop_id}/readiness-check/', **self.headers)
        self.assertEqual(rc_res.status_code, 200, rc_res.data)
        self.assertTrue(rc_res.data['is_ready'])
        self.assertEqual(rc_res.data['passed_checks'], 5)

        # Test Owner Financial Summary endpoint
        owner_obj = unit_a101.owner
        summary_res = self.client.get(f'/api/v1/property/owners/{owner_obj.id}/financial-summary/', **self.headers)
        self.assertEqual(summary_res.status_code, 200, summary_res.data)
        self.assertEqual(summary_res.data['units_count'], 2)
        self.assertEqual(summary_res.data['settlement_details']['bank_name'], 'KCB Bank')

    def test_sectional_title_billing_generates_correct_invoices_and_mpesa_refs(self):
        # Create sectional property with owner and tenant lease
        prop = Property.objects.create(
            organization=self.organization, code='PROP-SEC-01', name='Riverside Sectional Courts',
            is_sectional_title=True, scheme_registration_number='SS/NRB/2026/001',
        )
        bld = Building.objects.create(organization=self.organization, property=prop, code='B1', name='Block 1')
        owner = Owner.objects.create(
            organization=self.organization, code='OWN-0001', name='Grace Muthoni',
            settlement_bank_name='Stanbic Bank', settlement_bank_account='0100998877',
        )
        unit = Unit.objects.create(
            organization=self.organization, property=prop, building=bld, code='R-101',
            owner=owner, sectional_title_number='ST/R101', management_mandate='both',
            service_charge_payer='owner', common_area_fee_amount=Decimal('4500.00'),
        )
        tenant = Tenant.objects.create(organization=self.organization, code='TNT-001', name='David Otieno')
        lease = Lease.objects.create(
            organization=self.organization, unit=unit, tenant=tenant, reference='L-R101-01',
            starts_on=date(2026, 1, 1), ends_on=date(2026, 12, 31), monthly_rent=Decimal('45000.00'),
            billing_day=1, status=Lease.Status.ACTIVE,
        )
        # Add collection account
        rent_acct = PropertyCollectionAccount.objects.create(
            organization=self.organization, property=prop, charge_type='rent',
            bank_name='NCBA Bank', account_name='Riverside Rent A/C', account_number='11002233',
            mpesa_paybill='522522', mpesa_reference_format='RENT-{UNIT}-{MONTH}-{YEAR}',
        )
        sc_acct = PropertyCollectionAccount.objects.create(
            organization=self.organization, property=prop, charge_type='service_charge',
            bank_name='NCBA Bank', account_name='Riverside SC A/C', account_number='11002244',
            mpesa_paybill='522522', mpesa_reference_format='SC-{UNIT}-{MONTH}-{YEAR}',
        )

        # Run Billing Run for August 2026
        billing_run = BillingRun.objects.create(
            organization=self.organization, property=prop, period_start=date(2026, 8, 1),
            period_end=date(2026, 8, 31), created_by=self.user,
        )
        # Prepare
        prep_res = self.client.post(f'/api/v1/property/billing-runs/{billing_run.id}/prepare/', **self.headers)
        self.assertEqual(prep_res.status_code, 200, prep_res.data)

        # Approve
        billing_run.status = BillingRun.Status.REVIEW
        billing_run.save(update_fields=('status',))
        app_res = self.client.post(f'/api/v1/property/billing-runs/{billing_run.id}/approve/', **self.headers)
        self.assertEqual(app_res.status_code, 200, app_res.data)

        # Generate
        gen_res = self.client.post(f'/api/v1/property/billing-runs/{billing_run.id}/generate/', **self.headers)
        self.assertIn(gen_res.status_code, (200, 201), gen_res.data)

        # Verify generated Rent invoice
        rent_inv = Invoice.objects.filter(lease=lease, invoice_type='rent', metadata__billing_period='2026-08').first()
        self.assertIsNotNone(rent_inv)
        self.assertEqual(rent_inv.amount, Decimal('45000.00'))
        self.assertEqual(rent_inv.collection_account, rent_acct)
        self.assertEqual(rent_inv.mpesa_reference, 'RENT-R-101-08-2026')

        # Test Landlord Remittance Statement Calculation
        rent_inv.status = Invoice.Status.PAID
        rent_inv.balance = Decimal('0.00')
        rent_inv.save()
        LandlordInvoice.objects.create(
            organization=self.organization, property=prop, owner=owner,
            number='LB-2026-000099', landlord_name=owner.name, fee_type='letting',
            billing_period='2026-08', fee_amount=Decimal('10000.00'),
            vat_amount=Decimal('1600.00'), total_amount=Decimal('11600.00'),
            status=LandlordInvoice.Status.PAID,
        )

        remit_res = self.client.get(
            f'/api/v1/property/owners/{owner.id}/remittance-statement/?month=8&year=2026',
            **self.headers
        )
        self.assertEqual(remit_res.status_code, 200, remit_res.data)
        data = remit_res.data
        self.assertEqual(data['summary']['total_gross_collected'], Decimal('45000.00'))
        # 10% commission on 45,000 = 4,500
        self.assertEqual(data['summary']['total_commission_deducted'], Decimal('4500.00'))
        # Net remittance = 45000 - 4500 commission - SC = actual net
        self.assertGreater(data['summary']['net_remittance_payable'], Decimal('0.00'))
        self.assertLess(data['summary']['net_remittance_payable'], Decimal('45000.00'))
        self.assertEqual(data['settlement_route']['bank_name'], 'Stanbic Bank')
        self.assertIn('account_number', data['settlement_route'])
        self.assertEqual(data['summary']['total_letting_fees_charged'], Decimal('11600.00'))
        self.assertEqual(data['summary']['total_letting_fees_paid'], Decimal('11600.00'))
        self.assertEqual(data['fee_invoices'][0]['number'], 'LB-2026-000099')


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class LandlordInvoiceApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='landlord-user', email='landlord@example.com', password='test-password',
        )
        self.organization = Organization.objects.create(name='Landlord Client', slug='landlord-client')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True, is_organization_admin=True)
        Subscription.objects.create(
            organization=self.organization, module=Module.PROPERTY, status=Subscription.Status.ACTIVE,
        )
        self.property = Property.objects.create(
            organization=self.organization, code='LND-001', name='Landlord Property', status=Property.Status.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def create_invoice(self, status='draft'):
        invoice = LandlordInvoice.objects.create(
            organization=self.organization, number='LB-2026-000001', property=self.property,
            landlord_name='Landlord Property', billing_period='2026-08',
            gross_collections=Decimal('100000'), fee_rate=Decimal('8.00'),
            fee_amount=Decimal('8000.00'), vat_rate=Decimal('16.00'),
            vat_amount=Decimal('1280.00'), total_amount=Decimal('9280.00'),
            net_payout=Decimal('90720.00'), status=status,
        )
        return invoice

    def test_create_generates_number_and_computes_totals(self):
        response = self.client.post(
            '/api/v1/property/landlord-invoices/',
            {
                'property': self.property.id,
                'landlord_name': 'Landlord Property',
                'fee_type': 'management',
                'billing_period': '2026-08',
                'gross_collections': '100000',
                'fee_rate': '8.00',
                'vat_rate': '16.00',
                'deductions': '0',
                'notes': 'August settlement',
            },
            **self.headers, format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        data = response.data
        self.assertEqual(data['number'], 'LB-2026-000001')
        self.assertEqual(data['status'], 'draft')
        self.assertEqual(data['fee_amount'], '8000.00')
        self.assertEqual(data['vat_amount'], '1280.00')
        self.assertEqual(data['total_amount'], '9280.00')
        self.assertEqual(data['net_payout'], '90720.00')

    def test_draft_invoice_can_be_deleted(self):
        invoice = self.create_invoice(status='draft')
        response = self.client.delete(
            f'/api/v1/property/landlord-invoices/{invoice.id}/', **self.headers,
        )
        self.assertEqual(response.status_code, 204, response.data)
        self.assertFalse(LandlordInvoice.objects.filter(id=invoice.id).exists())

    def test_sent_invoice_cannot_be_deleted(self):
        invoice = self.create_invoice(status='sent')
        response = self.client.delete(
            f'/api/v1/property/landlord-invoices/{invoice.id}/', **self.headers,
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertTrue(LandlordInvoice.objects.filter(id=invoice.id).exists())

    def test_landlord_invoice_pdf_generation(self):
        invoice = self.create_invoice(status='draft')
        response = self.client.get(
            f'/api/v1/property/landlord-invoices/{invoice.id}/pdf/', **self.headers,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn(f'landlord-invoice-{invoice.number}.pdf', response['Content-Disposition'])


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class BulkTemplateContractTests(TestCase):
    """Regression test suite ensuring all downloadable CSV templates parse and import without errors."""

    def setUp(self):
        self.organization = Organization.objects.create(name='Template Test Org', slug='template-test-org')
        self.user = get_user_model().objects.create_user(username='template_tester', password='password')
        Membership.objects.create(
            user=self.user, organization=self.organization, is_organization_admin=True, is_default=True,
        )
        Subscription.objects.create(
            organization=self.organization, module=Module.PROPERTY, status=Subscription.Status.ACTIVE,
        )
        self.property = Property.objects.create(
            organization=self.organization, code='PROP-TPL-01', name='Lynx Residency', is_sectional_title=True,
        )
        self.building = Building.objects.create(
            organization=self.organization, property=self.property, code='BLD-01', name='Block A',
        )
        # Pre-create units matching template
        self.u1 = Unit.objects.create(organization=self.organization, property=self.property, building=self.building, code='A-101', unit_type='Studio', area=Decimal('350'))
        self.u2 = Unit.objects.create(organization=self.organization, property=self.property, building=self.building, code='A-102', unit_type='1Br', area=Decimal('550'))
        self.u3 = Unit.objects.create(organization=self.organization, property=self.property, building=self.building, code='B-201', unit_type='2Br Std', area=Decimal('850'))
        self.u4 = Unit.objects.create(organization=self.organization, property=self.property, building=self.building, code='B-202', unit_type='2Br Ensuite', area=Decimal('1050'))
        self.u5 = Unit.objects.create(organization=self.organization, property=self.property, building=self.building, code='G-01', unit_type='Shop', area=Decimal('850'))

        self.headers = {
            'HTTP_X_ORGANIZATION_ID': str(self.organization.id),
            'HTTP_X_PROPERTY_ID': str(self.property.id),
        }
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_tenant_template_sample_rows_bulk_onboard_succeeds_with_zero_failures(self):
        """Verify that every row from tenant-bulk-upload-template.csv imports successfully."""
        template_rows = [
            {
                'tenant': {'name': 'Grace Mwangi', 'tenant_type': 'individual', 'email': 'grace.mwangi@example.com', 'phone': '0722123456', 'tax_id': 'A001234567Z', 'registration_number': '28456789'},
                'lease': {'unit_code': 'A-101', 'area': '350', 'starts_on': '2026-09-01', 'term_months': 12, 'monthly_rent': '25000', 'service_charge_rate_per_sqft': '0', 'vat_rate': '0', 'billing_day': 1},
            },
            {
                'tenant': {'name': 'Brian Kiprono', 'tenant_type': 'individual', 'email': 'brian.kiprono@example.com', 'phone': '0733987654', 'tax_id': 'A009876543W', 'registration_number': '31234567'},
                'lease': {'unit_code': 'A-102', 'area': '550', 'starts_on': '01/09/2026', 'term_months': 12, 'monthly_rent': '35000', 'service_charge_rate_per_sqft': '0', 'vat_rate': '0', 'billing_day': 1},
            },
            {
                'tenant': {'name': 'Faith Njeri Ndungu', 'tenant_type': 'individual', 'email': 'faith.njeri@example.com', 'phone': '0711555888', 'tax_id': 'A005556667K', 'registration_number': '29876543'},
                'lease': {'unit_code': 'B-201', 'area': '850', 'starts_on': '2026-09-01', 'term_months': 12, 'monthly_rent': '50000', 'service_charge_rate_per_sqft': '0', 'vat_rate': '0', 'billing_day': 1},
            },
            {
                'tenant': {'name': 'Kevin Otieno & Linda Achieng', 'tenant_type': 'individual', 'email': 'otieno.family@example.com', 'phone': '0700112233', 'tax_id': 'A007778889P', 'registration_number': '27654321'},
                'lease': {'unit_code': 'B-202', 'area': '1050', 'starts_on': '01/09/2026', 'term_months': 24, 'monthly_rent': '65000', 'service_charge_rate_per_sqft': '0', 'vat_rate': '0', 'billing_day': 1},
            },
            {
                'tenant': {'name': 'Savannah Retail Enterprises Ltd', 'tenant_type': 'company', 'email': 'accounts@savannahretail.co.ke', 'phone': '0722000111', 'tax_id': 'P051234567X', 'registration_number': 'CPR/2022/12345'},
                'lease': {'unit_code': 'G-01', 'area': '850', 'starts_on': '2026-09-01', 'term_months': 24, 'monthly_rent': '85000', 'rent_rate_per_sqft': '100', 'service_charge_rate_per_sqft': '35', 'vat_rate': '16', 'billing_day': 1},
            },
        ]

        payload = {'auto_create_units': True, 'rows': template_rows}
        res = self.client.post('/api/v1/property/tenants/bulk-onboard/', payload, format='json', **self.headers)

        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['succeeded_count'], 5)
        self.assertEqual(res.data['failed_count'], 0)

        # Confirm residential lease has 0% VAT
        res_lease = Lease.objects.get(unit=self.u1)
        self.assertEqual(Decimal(str(res_lease.metadata.get('vat_rate'))), Decimal('0'))
        self.assertEqual(Decimal(str(res_lease.metadata.get('vat_amount'))), Decimal('0.00'))

        # Confirm day-first date normalization for 01/09/2026
        df_lease = Lease.objects.get(unit=self.u2)
        self.assertEqual(df_lease.starts_on.strftime('%Y-%m-%d'), '2026-09-01')

        # Confirm commercial lease has 16% VAT
        comm_lease = Lease.objects.get(unit=self.u5)
        self.assertEqual(Decimal(str(comm_lease.metadata.get('vat_rate'))), Decimal('16'))
        self.assertGreater(Decimal(str(comm_lease.metadata.get('vat_amount'))), Decimal('0'))

    def test_owner_template_sample_rows_bulk_import_succeeds_with_zero_failures(self):
        """Verify that every row from center-estates-landlord-owner-template.csv imports successfully."""
        owner_rows = [
            {
                'name': 'Dr. Peter Kamau Kariuki', 'email': 'peter.kariuki@example.com', 'phone': '+254722111222',
                'pin_number': 'A001234567Z', 'id_or_registration_number': '12345678', 'settlement_bank_name': 'Standard Chartered Bank',
                'settlement_bank_account': '0100123456700', 'settlement_bank_branch': 'Chiromo', 'settlement_paybill_or_till': '',
                'engaged_for_unit_management': 'yes', 'engaged_for_letting': 'yes', 'is_management_company': 'no',
                'unit_codes': 'A-101',
            },
            {
                'name': 'Eng. Mary Wambui Gitau', 'email': 'mary.gitau@example.com', 'phone': '+254733222333',
                'pin_number': 'A009876543Y', 'id_or_registration_number': '23456789', 'settlement_bank_name': '',
                'settlement_bank_account': '', 'settlement_bank_branch': '', 'settlement_paybill_or_till': '247247',
                'engaged_for_unit_management': 'yes', 'engaged_for_letting': 'no', 'is_management_company': 'no',
                'unit_codes': 'B-201; B-202',
            },
            {
                'name': 'ABC Holdings Ltd', 'email': 'accounts@abcholdings.co.ke', 'phone': '+254700000000',
                'pin_number': 'P012345678X', 'id_or_registration_number': 'CPR/2020/12345', 'settlement_bank_name': 'NCBA Bank',
                'settlement_bank_account': '010123456789', 'settlement_bank_branch': 'Westlands', 'settlement_paybill_or_till': '',
                'engaged_for_unit_management': 'yes', 'engaged_for_letting': 'no', 'is_management_company': 'no',
                'unit_codes': 'A-102',
            },
        ]

        payload = {'mode': 'commit', 'rows': owner_rows}
        res = self.client.post('/api/v1/property/owners/bulk-import/', payload, format='json', **self.headers)

        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['created_count'], 3)
        self.assertEqual(res.data['error_count'], 0)

        # Confirm multi-unit ownership assignment
        mary = Owner.objects.get(organization=self.organization, pin_number='A009876543Y')
        self.assertEqual(mary.units.count(), 2)
        self.assertEqual(set(mary.units.values_list('code', flat=True)), {'B-201', 'B-202'})
