from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Module
from organizations.models import Membership, Organization
from subscriptions.models import Subscription

from .models import ValuationClient, ValuationInstruction, ValuationInvoice, ValuationPayment


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class ValuationApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='valuer', password='test')
        self.organization = Organization.objects.create(name='Valuation Client', slug='valuation-client')
        self.other = Organization.objects.create(name='Other Valuation Client', slug='other-valuation-client')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True)
        Subscription.objects.create(organization=self.organization, module=Module.VALUATION, status=Subscription.Status.ACTIVE)
        self.client_record = ValuationClient.objects.create(organization=self.organization, code='C1', name='Bank One', client_type='bank')
        self.other_client = ValuationClient.objects.create(organization=self.other, code='C2', name='Hidden Bank', client_type='bank')
        self.instruction = ValuationInstruction.objects.create(organization=self.organization, reference='V1', client=self.client_record, property_description='Office Block', valuation_type='Commercial', purpose='Mortgage', valuer=self.user, instructed_on=timezone.localdate(), due_on=timezone.localdate()+timezone.timedelta(days=5), quoted_fee=Decimal('1000'), status=ValuationInstruction.Status.REVIEW)
        self.invoice = ValuationInvoice.objects.create(organization=self.organization, number='I1', instruction=self.instruction, issued_on=timezone.localdate(), due_on=timezone.localdate()+timezone.timedelta(days=30), subtotal=Decimal('1000'), tax=Decimal('160'), total=Decimal('1160'), balance=Decimal('1160'), status=ValuationInvoice.Status.ISSUED)
        self.client = APIClient(); self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def test_client_register_is_tenant_scoped(self):
        response = self.client.get('/api/v1/valuation/clients/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['code'] for row in response.data], ['C1'])

    def test_dashboard_is_calculated_from_live_pipeline(self):
        response = self.client.get('/api/v1/valuation/dashboard/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['kpis']['activeInstructions'], 1)
        self.assertEqual(Decimal(response.data['kpis']['outstanding']), Decimal('1160'))

    def test_instruction_rejects_foreign_organization_client(self):
        response = self.client.post('/api/v1/valuation/instructions/', {'reference':'V2','client':str(self.other_client.id),'property_description':'Cross tenant','valuation_type':'Residential','purpose':'Sale','priority':'normal','valuer':str(self.user.id),'instructed_on':str(timezone.localdate()),'due_on':str(timezone.localdate()+timezone.timedelta(days=3)),'quoted_fee':'500','status':'new'}, format='json', **self.headers)
        self.assertEqual(response.status_code, 400)

    def test_payment_assigns_authenticated_receiver(self):
        response = self.client.post('/api/v1/valuation/payments/', {'reference':'P1','invoice':str(self.invoice.id),'paid_on':str(timezone.localdate()),'amount':'500','method':'bank','external_reference':'EXT'}, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(ValuationPayment.objects.get(reference='P1').received_by, self.user)

    def test_subscription_is_required(self):
        Subscription.objects.filter(organization=self.organization, module=Module.VALUATION).update(is_active=False)
        self.assertEqual(self.client.get('/api/v1/valuation/dashboard/', **self.headers).status_code, 403)
