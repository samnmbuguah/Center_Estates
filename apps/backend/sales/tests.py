from decimal import Decimal

import tempfile

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Module
from organizations.models import Membership, Organization
from properties.models import Project, Property, Unit
from subscriptions.models import Subscription

from .models import (
    AgentCommission, Buyer, Installment, ListingRender, PropertySale, SaleDocument, SaleListing,
    SalePayment, SalesAuditEvent,
)


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
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True, is_organization_admin=True)
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

    def test_analytics_reports_agent_performance_and_overdue_exposure(self):
        self.installment.due_on = timezone.localdate() - timezone.timedelta(days=1)
        self.installment.save(update_fields=('due_on', 'updated_at'))
        response = self.client.get('/api/v1/sales/analytics/', **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['agentPerformance'][0]['agent__username'], self.user.username)
        self.assertEqual(response.data['agentPerformance'][0]['deals'], 1)
        self.assertEqual(Decimal(response.data['installmentExposure']['outstanding']), Decimal('1000000'))
        self.assertEqual(len(response.data['reports']), 9)

    def test_payment_export_is_downloadable_and_tenant_scoped(self):
        response = self.client.get('/api/v1/sales/analytics/exports/payments/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/csv')
        content = response.content.decode()
        self.assertIn('PAY1', content)
        self.assertNotIn('Hidden', content)

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

    def test_payment_cannot_allocate_to_another_sales_installment(self):
        other_buyer = Buyer.objects.create(
            organization=self.organization, reference='B2', full_name='Buyer Two',
            email='buyer2@example.com', phone='0711', id_number='ID2',
        )
        other_prop = Property.objects.create(organization=self.organization, code='P2', name='Second Development')
        other_unit = Unit.objects.create(organization=self.organization, property=other_prop, code='B-01')
        other_project = Project.objects.create(organization=self.organization, property=other_prop, code='PR2', name='Second Project')
        other_listing = SaleListing.objects.create(
            organization=self.organization, unit=other_unit, project=other_project, list_price=Decimal('5000000'),
        )
        other_sale = PropertySale.objects.create(
            organization=self.organization, reference='S2', buyer=other_buyer,
            listing=other_listing, agreed_price=Decimal('5000000'),
        )
        response = self.client.post('/api/v1/sales/payments/', {
            'reference': 'PAY-WRONG', 'sale': str(other_sale.id),
            'installment': str(self.installment.id), 'paid_on': str(timezone.localdate()),
            'amount': '100.00', 'method': 'bank', 'external_reference': 'EXT-WRONG',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 400, response.data)

    def test_commission_requires_payment_and_construction_gates_then_approval_and_payment(self):
        self.commission.required_construction_percent = Decimal('50')
        self.commission.save()
        self.listing.construction_progress = Decimal('60')
        self.listing.save()
        verified = self.client.post(
            f'/api/v1/sales/payments/{self.pending_payment.id}/verify/', {}, format='json', **self.headers,
        )
        self.assertEqual(verified.status_code, 200, verified.data)
        self.commission.refresh_from_db()
        self.assertEqual(self.commission.status, AgentCommission.Status.ELIGIBLE)
        for action, expected in (('approve', AgentCommission.Status.APPROVED), ('mark-paid', AgentCommission.Status.PAID)):
            response = self.client.post(
                f'/api/v1/sales/commissions/{self.commission.id}/{action}/', {}, format='json', **self.headers,
            )
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['status'], expected)
        self.assertTrue(SalesAuditEvent.objects.filter(
            sale=self.sale, event_type='commission_status_change', to_status=AgentCommission.Status.PAID,
        ).exists())

    def test_legal_document_is_append_only(self):
        document = SaleDocument.objects.create(
            organization=self.organization, sale=self.sale, document_type='sale_agreement',
            title='Executed sale agreement', file_url='https://example.com/agreement.pdf',
            checksum='sha256:agreement-v1', signed_on=timezone.localdate(), is_final=True,
        )
        self.assertEqual(self.client.patch(
            f'/api/v1/sales/documents/{document.id}/', {'title': 'Changed'},
            format='json', **self.headers,
        ).status_code, 400)
        self.assertEqual(self.client.delete(
            f'/api/v1/sales/documents/{document.id}/', **self.headers,
        ).status_code, 400)
        detail = self.client.get(f'/api/v1/sales/sales/{self.sale.id}/', **self.headers)
        self.assertEqual(detail.status_code, 200, detail.data)
        readiness = {item['key']: item for item in detail.data['document_readiness']}
        self.assertTrue(readiness['sale_agreement']['present'])
        self.assertTrue(readiness['sale_agreement']['final'])
        self.assertFalse(readiness['buyer_id']['present'])

    def test_expired_reservation_releases_inventory_and_audits_cancellation(self):
        self.sale.status = PropertySale.Status.RESERVED
        self.sale.save()
        self.listing.status = SaleListing.Status.RESERVED
        self.listing.reservation_expires_at = timezone.now() - timezone.timedelta(minutes=1)
        self.listing.save()
        response = self.client.post('/api/v1/sales/inventory/expire-reservations/', {}, format='json', **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['expired'], 1)
        self.sale.refresh_from_db(); self.listing.refresh_from_db()
        self.assertEqual(self.sale.status, PropertySale.Status.CANCELLED)
        self.assertEqual(self.listing.status, SaleListing.Status.AVAILABLE)
        self.assertTrue(SalesAuditEvent.objects.filter(sale=self.sale, event_type='reservation_expired').exists())


class SalesReportingTests(SalesApiTests):
    def test_report_catalogue_exposes_grouped_reports(self):
        response = self.client.get('/api/v1/sales/analytics/', **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        keys = [r['key'] for r in response.data['reports']]
        self.assertIn('inventory', keys)
        self.assertIn('sales-pipeline', keys)
        self.assertIn('financial-summary', keys)
        self.assertIn('installment-schedule', keys)
        self.assertIn('commission-ledger', keys)
        self.assertIn('agent-performance', keys)
        for report in response.data['reports']:
            self.assertIn('name', report)
            self.assertIn('category', report)
            self.assertIn('description', report)

    def test_summary_preview_returns_columns_and_rows(self):
        response = self.client.get('/api/v1/sales/analytics/reports/sales-pipeline/', **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        self.assertIn('columns', data)
        self.assertIn('rows', data)
        self.assertEqual(data['count'], 1)
        self.assertIn('period', data)
        self.assertIn('generated_at', data['meta'])
        # The seeded sale should surface with its buyer and agreed price.
        self.assertEqual(data['rows'][0]['Sale Ref'], 'S1')

    def test_summary_respects_date_range_filter(self):
        old = self.client.get(
            '/api/v1/sales/analytics/reports/sales-pipeline/?start=2000-01-01&end=2000-12-31', **self.headers,
        )
        self.assertEqual(old.status_code, 200, old.data)
        self.assertEqual(old.data['count'], 0)

    def test_csv_export_returns_auditable_dataset(self):
        response = self.client.get('/api/v1/sales/analytics/exports/inventory/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/csv')
        self.assertIn('attachment; filename', response['Content-Disposition'])
        text = response.content.decode('utf-8')
        self.assertIn('Project', text)
        self.assertIn('Development Project', text)

    def test_excel_export_returns_workbook_and_audits_execution(self):
        from properties.models import ReportExecution
        response = self.client.get('/api/v1/sales/analytics/exports/inventory/?output=xlsx', **self.headers)
        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        self.assertIn('spreadsheetml', response['Content-Type'])
        self.assertTrue(ReportExecution.objects.filter(
            organization=self.organization, report_key='inventory',
        ).exists())

    def test_unknown_report_is_rejected(self):
        response = self.client.get('/api/v1/sales/analytics/reports/nope/', **self.headers)
        self.assertEqual(response.status_code, 400)

    def test_installment_schedule_flags_overdue_exposure(self):
        overdue = Installment.objects.create(
            organization=self.organization, sale=self.sale, sequence=2,
            description='Second tranche', due_on=timezone.localdate() - timezone.timedelta(days=10),
            amount=Decimal('500000'), status=Installment.Status.OVERDUE,
        )
        response = self.client.get('/api/v1/sales/analytics/reports/installment-schedule/', **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        rows = [r for r in response.data['rows'] if r['Description'] == 'Second tranche']
        self.assertEqual(len(rows), 1)
        self.assertGreater(int(rows[0]['Days Overdue']), 0)

    def test_buyer_profile_aggregates_sales_and_payments(self):
        response = self.client.get(f'/api/v1/sales/buyers/{self.buyer.id}/profile/', **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['buyer']['reference'], 'B1')
        self.assertEqual(len(response.data['sales']), 1)
        self.assertEqual(len(response.data['installments']), 1)
        self.assertIn('summary', response.data)
        self.assertEqual(Decimal(response.data['summary']['verifiedPaid']), Decimal('1000000'))
        self.assertEqual(Decimal(response.data['summary']['outstanding']), Decimal('8500000'))

    def test_installment_aging_buckets_and_exposure(self):
        self.installment.due_on = timezone.localdate() - timezone.timedelta(days=45)
        self.installment.status = Installment.Status.OVERDUE
        self.installment.save(update_fields=('due_on', 'status', 'updated_at'))
        response = self.client.get('/api/v1/sales/installments/aging/', **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        buckets = {b['key']: b for b in response.data['buckets']}
        self.assertEqual(Decimal(buckets['d31_60']['amount']), Decimal('1000000'))
        self.assertEqual(Decimal(response.data['totals']['overdue']), Decimal('1000000'))
        self.assertEqual(len(response.data['topExposures']), 1)
        self.assertEqual(response.data['topExposures'][0]['sale'], 'S1')
        self.assertGreaterEqual(int(response.data['topExposures'][0]['oldest_days']), 45)


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class SalesNotificationTests(SalesApiTests):
    def test_payment_submission_notifies_finance(self):
        from notifications.models import Notification
        response = self.client.post('/api/v1/sales/payments/', {
            'reference': 'PAY-N1', 'sale': str(self.sale.id), 'paid_on': str(timezone.localdate()),
            'amount': '500', 'method': 'bank', 'external_reference': 'EXT-N1', 'status': 'pending',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(Notification.objects.filter(
            organization=self.organization, recipient=self.user,
            title='Payment submitted for verification',
        ).exists())

    def test_commission_eligibility_notifies(self):
        from notifications.models import Notification
        response = self.client.post(
            f'/api/v1/sales/payments/{self.pending_payment.id}/verify/', {}, format='json', **self.headers,
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.commission.refresh_from_db()
        self.assertEqual(self.commission.status, AgentCommission.Status.ELIGIBLE)
        self.assertTrue(Notification.objects.filter(
            organization=self.organization, title='Commission eligible for approval',
        ).exists())

    def test_reservation_expiry_command_releases_and_notifies(self):
        from django.core.management import call_command
        from notifications.models import Notification
        self.sale.status = PropertySale.Status.RESERVED
        self.sale.save()
        self.listing.status = SaleListing.Status.RESERVED
        self.listing.reservation_expires_at = timezone.now() - timezone.timedelta(minutes=1)
        self.listing.save()
        call_command('sync_sales_reservations')
        self.sale.refresh_from_db(); self.listing.refresh_from_db()
        self.assertEqual(self.sale.status, PropertySale.Status.CANCELLED)
        self.assertEqual(self.listing.status, SaleListing.Status.AVAILABLE)
        self.assertTrue(Notification.objects.filter(
            organization=self.organization, title='Sale reservation expired',
        ).exists())


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class SalesListingRenderTests(SalesApiTests):
    def test_render_listing_serializer_exposes_absolute_url(self):
        render = ListingRender.objects.create(
            organization=self.organization, listing=self.listing,
            render_kind=ListingRender.RenderKind.MODEL_3D, title='A-01 3D model',
            file_url='https://cdn.example.com/unit.glb', mime_type='model/gltf-binary',
        )
        response = self.client.get('/api/v1/sales/inventory/', **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        row = next((r for r in response.data if str(r['id']) == str(self.listing.id)), None)
        self.assertIsNotNone(row)
        self.assertEqual(len(row['renders']), 1)
        self.assertEqual(row['renders'][0]['render_url'], 'https://cdn.example.com/unit.glb')
        self.assertEqual(row['renders'][0]['render_kind'], 'model_3d')

    def test_listing_renders_crud_and_primary_flag(self):
        first = self.client.post('/api/v1/sales/listing-renders/', {
            'listing': str(self.listing.id), 'render_kind': 'render', 'title': 'Hero render', 'file_url': 'https://cdn.example.com/hero.jpg', 'is_primary': True,
        }, format='json', **self.headers)
        self.assertEqual(first.status_code, 201, first.data)
        second = self.client.post('/api/v1/sales/listing-renders/', {
            'listing': str(self.listing.id), 'render_kind': 'floorplan', 'title': 'Floor plan', 'file_url': 'https://cdn.example.com/plan.jpg', 'is_primary': True,
        }, format='json', **self.headers)
        self.assertEqual(second.status_code, 201, second.data)
        # Only one primary per listing.
        self.assertEqual(ListingRender.objects.filter(organization=self.organization, listing=self.listing, is_primary=True).count(), 1)

    def test_model_3d_requires_an_asset(self):
        response = self.client.post('/api/v1/sales/listing-renders/', {
            'listing': str(self.listing.id), 'render_kind': 'model_3d', 'title': 'No asset',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 400, response.data)


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class SalesPortalTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='buyer-owner', password='test')
        self.organization = Organization.objects.create(name='Portal Client', slug='portal-client')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True, is_organization_admin=True)
        Subscription.objects.create(organization=self.organization, module=Module.SALES, status=Subscription.Status.ACTIVE)
        prop = Property.objects.create(organization=self.organization, code='P1', name='Development')
        unit = Unit.objects.create(organization=self.organization, property=prop, code='A-01')
        project = Project.objects.create(organization=self.organization, property=prop, code='PR1', name='Development Project')
        self.listing = SaleListing.objects.create(organization=self.organization, unit=unit, project=project, list_price=Decimal('10000000'))
        self.buyer = Buyer.objects.create(organization=self.organization, reference='B1', full_name='Buyer One', email='buyer@example.com', phone='0700', id_number='ID1', status=Buyer.Status.ACTIVE)
        self.sale = PropertySale.objects.create(organization=self.organization, reference='S1', buyer=self.buyer, listing=self.listing, agent=self.user, agreed_price=Decimal('9500000'), status=PropertySale.Status.CONTRACTED)
        Installment.objects.create(organization=self.organization, sale=self.sale, sequence=1, description='Deposit', due_on=timezone.localdate(), amount=Decimal('1000000'), status=Installment.Status.DUE)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def test_buyer_without_access_is_denied(self):
        response = self.client.get('/api/v1/sales/buyer-portal/', **self.headers)
        self.assertEqual(response.status_code, 403)

    def test_linked_buyer_can_view_portal(self):
        from .models import BuyerPortalAccess
        BuyerPortalAccess.objects.create(organization=self.organization, user=self.user, buyer=self.buyer)
        response = self.client.get('/api/v1/sales/buyer-portal/', **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['buyer']['reference'], 'B1')
        self.assertEqual(response.data['currentSale']['reference'], 'S1')
        self.assertEqual(len(response.data['installments']), 1)

    def test_buyer_can_record_pending_payment(self):
        from .models import BuyerPortalAccess
        BuyerPortalAccess.objects.create(organization=self.organization, user=self.user, buyer=self.buyer)
        response = self.client.post(
            '/api/v1/sales/buyer-portal/payments/record/',
            {
                'sale': str(self.sale.id), 'amount': '500000',
                'method': 'bank', 'external_reference': 'RTGS-0001',
            },
            format='json', **self.headers,
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['status'], SalePayment.Status.PENDING)
        self.assertTrue(SalesAuditEvent.objects.filter(sale=self.sale, event_type='payment_submitted').exists())
        self.assertTrue(SalePayment.objects.filter(organization=self.organization, external_reference='RTGS-0001').exists())

    def test_agent_portal_scopes_to_assigned_records(self):
        response = self.client.get('/api/v1/sales/agent-portal/', **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['kpis']['pipelineDeals'], 1)
        self.assertEqual(response.data['agent']['username'], 'buyer-owner')
