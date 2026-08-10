from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core.models import Module
from organizations.models import Membership, MembershipRole, Organization, Permission, Role
from subscriptions.models import Subscription
from facilities.models import ServiceRequest
from notifications.models import Notification

from .models import (
    BankTransaction, Budget, Building, CreditNote, Expense, Invoice,
    InvoiceReminder, Lease, Property, Receipt, ReceiptAllocation, RentSchedule,
    ServiceCharge, ServiceChargeAllocation,
    ServiceChargeReconciliation, Tenant, TenantDocument, TenantPortalAccess,
    Unit,
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
        self.user = get_user_model().objects.create_user(username='property-user', password='test-password')
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

    def test_report_catalogue_uses_client_categories_and_exports_each_family(self):
        catalogue = self.client.get('/api/v1/property/analytics/', **self.headers)
        self.assertEqual(catalogue.status_code, 200)
        categories = {row['category'] for row in catalogue.data['reports']}
        self.assertEqual(categories, {
            'Financial', 'Tenants & Occupancy', 'Service Providers', 'Compliance & Risk',
        })
        keys = {row['key'] for row in catalogue.data['reports']}
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
        self.assertTrue(Property.objects.filter(organization=self.organization, code='OWN-002').exists())

    def test_onboarding_creates_property_buildings_units_and_metadata_atomically(self):
        response = self.client.post('/api/v1/property/properties/onboard/', {
            'property': {
                'name': 'Palm Court', 'property_type': 'mixed_use', 'status': 'draft',
                'address': 'Links Road', 'city': 'Mombasa', 'country': 'KE',
                'metadata': {
                    'lr_number': 'MN/I/456',
                    'landlord': {'name': 'Example Landlord', 'vat_registered': True},
                    'location': {'county': 'Mombasa'},
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
        self.assertEqual(created.metadata['lr_number'], 'MN/I/456')
        self.assertEqual(created.buildings.count(), 2)
        self.assertEqual(created.units.count(), 2)
        self.assertEqual(created.units.get(code='1-A').metadata['rateable_area'], '980')

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
