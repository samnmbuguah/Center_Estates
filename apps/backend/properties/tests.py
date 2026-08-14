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
    TaxConfiguration, TenantMovement, Unit, UnitStatusHistory,
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
        self.assertEqual(response.data['portfolio'][0]['name'], 'Owned Property')
        self.assertEqual(response.data['portfolio'][0]['occupied'], 1)
        self.assertEqual(len(response.data['aging']), 4)
        self.assertTrue(response.data['collectionTrend'])

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
        self.assertEqual(self.client.post(f'{run_url}approve/', {}, format='json', **self.headers).status_code, 400)
        approver = get_user_model().objects.create_user(username='billing-approver', password='test-password')
        Membership.objects.create(
            user=approver, organization=self.organization, is_organization_admin=True,
        )
        self.client.force_authenticate(approver)
        approved = self.client.post(f'{run_url}approve/', {}, format='json', **self.headers)
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data['status'], BillingRun.Status.APPROVED)
        self.client.force_authenticate(self.user)
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
        statement_document = self.client.get(
            '/api/v1/property/portal/statement.pdf/?start=2026-01-01&end=2026-12-31', **self.headers,
        )
        self.assertEqual(statement_document.status_code, 200)
        self.assertEqual(statement_document['Content-Type'], 'application/pdf')

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

    def test_report_catalogue_uses_client_categories_and_exports_each_family(self):
        catalogue = self.client.get('/api/v1/property/analytics/', **self.headers)
        self.assertEqual(catalogue.status_code, 200)
        categories = {row['category'] for row in catalogue.data['reports']}
        self.assertEqual(categories, {
            'Financial', 'Tenants & Occupancy', 'Service Providers', 'Compliance & Risk',
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
        response = self.client.post('/api/v1/property/tenants/onboard/', {
            'tenant': {
                'name': 'Acme Kenya Limited', 'tenant_type': 'company', 'address_1': 'Moi Avenue',
                'address_2': 'Suite 4', 'city': 'Mombasa', 'phone': '+254700000001',
                'email': 'accounts@acme.test', 'tax_id': 'P051234567X',
                'contact_name': 'Jane Wanjiku', 'contact_phone': '+254700000002',
                'contact_email': 'jane@acme.test',
            },
            'lease': {
                'unit': str(available_unit.id), 'term_months': 72, 'starts_on': '2026-09-01',
                'area': 1000, 'rent_rate_per_sqft': 100, 'service_charge_rate_per_sqft': 15,
                'vat_rate': 16, 'security_deposit': 200000, 'billing_day': 1,
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
        self.assertEqual(lease.ends_on.isoformat(), '2032-09-01')
        self.assertEqual(lease.monthly_rent, Decimal('100000.00'))
        self.assertEqual(lease.escalation_percent, Decimal('5.00'))
        self.assertEqual(lease.escalation_interval_months, 12)
        self.assertEqual(lease.metadata['monthly_service_charge_excl_vat'], '15000.00')
        self.assertEqual(response.data['calculations']['total_amount_payable'], '343400.00')
        activated = self.client.post(f'/api/v1/property/leases/{lease.id}/activate/', {}, format='json', **self.headers)
        self.assertEqual(activated.status_code, 200, activated.data)
        schedules = RentSchedule.objects.filter(lease=lease).order_by('period_start')
        self.assertEqual(schedules.count(), 72)
        self.assertEqual(schedules[12].period_start.isoformat(), '2027-09-01')
        self.assertEqual(schedules[12].base_rent, Decimal('100000.00'))
        self.assertEqual(schedules[12].escalation_amount, Decimal('5000.00'))
        self.assertEqual(schedules[24].escalation_amount, Decimal('10250.00'))
        premature = self.client.post(f'/api/v1/property/rent-schedules/{schedules[0].id}/generate-invoice/', {}, format='json', **self.headers)
        self.assertEqual(premature.status_code, 400)
        self.assertIn('commencement', str(premature.data).lower())

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

    def test_tenant_portal_is_user_linked_and_creates_scoped_service_request(self):
        TenantPortalAccess.objects.create(
            organization=self.organization, user=self.user, tenant=self.tenant,
        )
        portal = self.client.get('/api/v1/property/portal/', **self.headers)
        self.assertEqual(portal.status_code, 200, portal.data)
        self.assertEqual(portal.data['tenant']['id'], str(self.tenant.id))
        self.assertEqual(portal.data['currentLease']['id'], str(self.lease.id))
        self.assertEqual(len(portal.data['invoices']), 1)
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
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(InvoiceReminder.objects.filter(invoice=self.invoice, sent_by=self.user).exists())
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
        self.assertEqual(response.data['lease_expiry'][0]['lease'], self.lease.reference)

    def test_each_visible_report_tab_exports_its_own_dataset_in_supported_formats(self):
        headers = {**self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id)}
        report_headings = {
            'tenancy-schedule': b'Escalation %', 'vacancy': b'Days vacant',
            'movements': b'Movement', 'income-analysis': b'Annualized income',
            'billing-schedule': b'Total billed', 'vat-schedule': b'Taxable value',
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
                ('billing-schedule', b'BILLING', b'Tenant'),
                ('income-expense', b'RECEIPTS', b'DISBURSEMENTS'),
                ('tenant-payment-status', b'TENANTS PAYMENTS STATUS', b'OUTSTANDING'),
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
        invoice = Invoice.objects.get(number=generated.data['invoices'][0]['number'])
        descriptions = set(InvoiceLine.objects.filter(invoice=invoice).values_list('description', flat=True))
        self.assertIn('Water', descriptions)
        water_line = InvoiceLine.objects.get(invoice=invoice, description='Water')
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
            'invoice': str(self.invoice.id), 'received_on': '2026-08-01',
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
