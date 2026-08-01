from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Module
from organizations.models import Membership, Organization
from subscriptions.models import Subscription

from .models import BidDecision, CompanyDocument, FinancialItem, Tender, TenderAuditEvent, TenderRequirement, TenderSubmission, TenderTask


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class TenderApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='tender-user', password='test')
        self.organization = Organization.objects.create(name='Tender Client', slug='tender-client')
        self.other = Organization.objects.create(name='Other Tender Client', slug='other-tender-client')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True)
        Subscription.objects.create(organization=self.organization, module=Module.TENDER, status=Subscription.Status.ACTIVE)
        self.tender = Tender.objects.create(organization=self.organization, reference='T1', title='Main Tender', client='Client', submission_deadline=timezone.now() + timezone.timedelta(days=5), estimated_value=Decimal('5000'), owner=self.user)
        self.other_tender = Tender.objects.create(organization=self.other, reference='T2', title='Hidden Tender', client='Other', submission_deadline=timezone.now(), owner=self.user)
        TenderTask.objects.create(organization=self.organization, tender=self.tender, title='Prepare response', stage=Tender.Stage.TECHNICAL, owner=self.user, starts_on=timezone.localdate(), due_on=timezone.localdate() + timezone.timedelta(days=2))
        self.client = APIClient(); self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def test_tender_register_is_tenant_scoped(self):
        response = self.client.get('/api/v1/tender/tenders/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['reference'] for item in response.data], ['T1'])

    def test_dashboard_calculates_deadlines_and_pipeline(self):
        response = self.client.get('/api/v1/tender/dashboard/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['kpis']['dueThisWeek'], 1)
        self.assertEqual(Decimal(response.data['kpis']['pipelineValue']), Decimal('5000'))
        self.assertEqual(response.data['kpis']['pendingTasks'], 1)

    def test_create_tender_assigns_authenticated_owner(self):
        response = self.client.post('/api/v1/tender/tenders/', {'reference':'T3','title':'New Tender','client':'Client','submission_deadline':(timezone.now()+timezone.timedelta(days=10)).isoformat(),'estimated_value':'1000','currency':'KES','stage':'invitation','readiness_score':'0'}, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Tender.objects.get(reference='T3').owner, self.user)

    def test_child_record_cannot_reference_other_tenant_tender(self):
        response = self.client.post('/api/v1/tender/requirements/', {'tender':str(self.other_tender.id),'category':'Eligibility','text':'Cross tenant','mandatory':True,'status':'pending'}, format='json', **self.headers)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(TenderRequirement.objects.filter(text='Cross tenant').exists())

    def test_subscription_is_required(self):
        Subscription.objects.filter(organization=self.organization, module=Module.TENDER).update(is_active=False)
        self.assertEqual(self.client.get('/api/v1/tender/dashboard/', **self.headers).status_code, 403)

    def test_stage_changes_require_transition_and_mandatory_requirement_clearance(self):
        direct = self.client.patch(
            f'/api/v1/tender/tenders/{self.tender.id}/', {'stage': Tender.Stage.ANALYSIS},
            format='json', **self.headers,
        )
        self.assertEqual(direct.status_code, 400)
        response = self.client.post(
            f'/api/v1/tender/tenders/{self.tender.id}/transition/',
            {'stage': Tender.Stage.ANALYSIS}, format='json', **self.headers,
        )
        self.assertEqual(response.status_code, 200, response.data)
        requirement = TenderRequirement.objects.create(
            organization=self.organization, tender=self.tender, category='Eligibility',
            text='Current tax clearance', mandatory=True, status='gap',
        )
        blocked = self.client.post(
            f'/api/v1/tender/tenders/{self.tender.id}/transition/',
            {'stage': Tender.Stage.DECISION}, format='json', **self.headers,
        )
        self.assertEqual(blocked.status_code, 400)
        requirement.status = 'met'; requirement.save()
        accepted = self.client.post(
            f'/api/v1/tender/tenders/{self.tender.id}/transition/',
            {'stage': Tender.Stage.DECISION}, format='json', **self.headers,
        )
        self.assertEqual(accepted.status_code, 200, accepted.data)
        self.assertEqual(TenderAuditEvent.objects.filter(tender=self.tender, event_type='stage_transition').count(), 2)

    def test_submission_is_server_stamped_immutable_and_advances_tender(self):
        self.tender.stage = Tender.Stage.PACKAGING; self.tender.save()
        response = self.client.post('/api/v1/tender/submissions/', {
            'tender': str(self.tender.id), 'channel': 'e-procurement portal',
            'package_version': 'FINAL-1.0', 'package_checksum': 'sha256-package',
            'receipt_reference': 'PORTAL-RCT-101', 'compliant': True,
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        submission = TenderSubmission.objects.get(tender=self.tender)
        self.assertEqual(submission.submitted_by, self.user)
        self.assertIsNotNone(submission.submitted_at)
        self.tender.refresh_from_db(); self.assertEqual(self.tender.stage, Tender.Stage.SUBMITTED)
        self.assertEqual(self.client.delete(f'/api/v1/tender/submissions/{submission.id}/', **self.headers).status_code, 400)
        self.assertTrue(TenderAuditEvent.objects.filter(tender=self.tender, event_type='submitted').exists())

    def test_ai_requirement_requires_controlled_human_confirmation(self):
        response = self.client.post('/api/v1/tender/requirements/', {
            'tender': str(self.tender.id), 'category': 'Eligibility', 'text': 'Audited accounts',
            'mandatory': True, 'status': 'met', 'confidence': '91', 'citation': 'Page 12',
            'model_version': 'extract-v2',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        requirement = TenderRequirement.objects.get(text='Audited accounts')
        self.assertEqual(requirement.status, 'pending')
        confirmed = self.client.post(
            f'/api/v1/tender/requirements/{requirement.id}/confirm/', {'status': 'met'},
            format='json', **self.headers,
        )
        self.assertEqual(confirmed.status_code, 200, confirmed.data)
        requirement.refresh_from_db(); self.assertEqual(requirement.confirmed_by, self.user)
        self.assertTrue(TenderAuditEvent.objects.filter(tender=self.tender, event_type='requirement_confirmed').exists())

    def test_bid_decision_is_server_stamped_and_audited(self):
        self.tender.stage = Tender.Stage.DECISION; self.tender.save()
        response = self.client.post('/api/v1/tender/decisions/', {
            'tender': str(self.tender.id), 'eligibility_score': '90', 'profitability_score': '75',
            'capacity_score': '80', 'risk_score': '35', 'recommendation': 'bid',
            'decision': 'approved', 'rationale': 'Capacity confirmed',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        decision = BidDecision.objects.get(tender=self.tender); self.assertEqual(decision.decision, 'pending')
        decided = self.client.post(
            f'/api/v1/tender/decisions/{decision.id}/decide/',
            {'decision': 'approved', 'rationale': 'Board approval recorded'}, format='json', **self.headers,
        )
        self.assertEqual(decided.status_code, 200, decided.data)
        decision.refresh_from_db(); self.assertEqual(decision.decided_by, self.user)
        self.assertTrue(TenderAuditEvent.objects.filter(tender=self.tender, event_type='bid_decision').exists())

    def test_financial_amount_is_calculated_and_approval_locks_pricing(self):
        response = self.client.post('/api/v1/tender/financial-items/', {
            'tender': str(self.tender.id), 'code': 'B1', 'description': 'Mobilisation',
            'quantity': '3', 'unit': 'month', 'unit_rate': '2500', 'amount': '1', 'approved': True,
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        item = FinancialItem.objects.get(code='B1'); self.assertEqual(item.amount, Decimal('7500')); self.assertFalse(item.approved)
        approved = self.client.post(f'/api/v1/tender/financial-items/{item.id}/approve/', {}, format='json', **self.headers)
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(self.client.patch(
            f'/api/v1/tender/financial-items/{item.id}/', {'unit_rate': '1'}, format='json', **self.headers,
        ).status_code, 400)

    def test_company_vault_is_append_only_and_reports_are_exportable(self):
        document = CompanyDocument.objects.create(
            organization=self.organization, name='Tax compliance', document_type='tax',
            version='1', checksum='sha256-tax',
        )
        self.assertEqual(self.client.patch(
            f'/api/v1/tender/company-documents/{document.id}/', {'name': 'Changed'}, format='json', **self.headers,
        ).status_code, 400)
        analytics = self.client.get('/api/v1/tender/analytics/', **self.headers)
        self.assertEqual(analytics.status_code, 200, analytics.data)
        export = self.client.get('/api/v1/tender/analytics/exports/pipeline/', **self.headers)
        self.assertEqual(export.status_code, 200)
        self.assertIn('T1', export.content.decode()); self.assertNotIn('Hidden Tender', export.content.decode())
