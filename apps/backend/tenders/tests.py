from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Module
from organizations.models import Membership, Organization
from subscriptions.models import Subscription

from .models import Tender, TenderRequirement, TenderTask


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
