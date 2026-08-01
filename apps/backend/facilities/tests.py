from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Module
from organizations.models import Membership, Organization
from properties.models import Property
from subscriptions.models import Subscription

from .models import FacilityAsset, Inspection, MeterReading, PreventiveSchedule, ServiceRequest, UtilityMeter, WorkOrder, WorkOrderCostItem, WorkOrderEvent


class FacilityIntegrityTests(TestCase):
    def test_asset_cannot_reference_another_organization_property(self):
        first = Organization.objects.create(name='First', slug='facility-first')
        second = Organization.objects.create(name='Second', slug='facility-second')
        prop = Property.objects.create(organization=first, code='P1', name='First Property')
        asset = FacilityAsset(organization=second, property=prop, code='A1', name='Asset', category='HVAC')
        with self.assertRaises(ValidationError):
            asset.save()


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class FacilityApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='facility-user', password='test')
        self.organization = Organization.objects.create(name='Facility Client', slug='facility-client')
        self.other = Organization.objects.create(name='Other Facility Client', slug='other-facility-client')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True, is_organization_admin=True)
        Subscription.objects.create(organization=self.organization, module=Module.FACILITY, status=Subscription.Status.ACTIVE)
        self.property = Property.objects.create(organization=self.organization, code='P1', name='Main Building')
        self.asset = FacilityAsset.objects.create(
            organization=self.organization, property=self.property, code='A1', name='Main Lift',
            category='Mechanical', purchase_value=Decimal('500000'),
        )
        other_property = Property.objects.create(organization=self.other, code='P2', name='Other Building')
        FacilityAsset.objects.create(organization=self.other, property=other_property, code='A2', name='Hidden Asset', category='HVAC')
        self.work_order = WorkOrder.objects.create(
            organization=self.organization, number='WO-1', title='Lift repair', category='Mechanical',
            property=self.property, asset=self.asset, reported_by=self.user, priority=WorkOrder.Priority.HIGH,
            status=WorkOrder.Status.IN_PROGRESS, reported_at=timezone.now(),
            resolution_due_at=timezone.now() - timezone.timedelta(hours=1), progress=50,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def test_assets_are_tenant_scoped(self):
        response = self.client.get('/api/v1/facility/assets/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['code'] for row in response.data], ['A1'])

    def test_dashboard_is_calculated_from_live_data(self):
        response = self.client.get('/api/v1/facility/dashboard/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['kpis']['activeAssets'], 1)
        self.assertEqual(response.data['kpis']['openWorkOrders'], 1)
        self.assertEqual(response.data['kpis']['overdueWorkOrders'], 1)

    def test_work_order_create_sets_reporter_and_organization(self):
        response = self.client.post('/api/v1/facility/work-orders/', {
            'number': 'WO-2', 'title': 'Test alarm', 'category': 'Fire safety',
            'property': str(self.property.id), 'priority': 'critical', 'status': 'open',
            'reported_at': timezone.now().isoformat(), 'progress': 0,
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        created = WorkOrder.objects.get(number='WO-2')
        self.assertEqual(created.reported_by, self.user)
        self.assertEqual(created.organization, self.organization)

    def test_facility_subscription_is_required(self):
        Subscription.objects.filter(organization=self.organization, module=Module.FACILITY).update(is_active=False)
        response = self.client.get('/api/v1/facility/dashboard/', **self.headers)
        self.assertEqual(response.status_code, 403)

    def test_work_order_state_machine_is_audited(self):
        direct = self.client.patch(
            f'/api/v1/facility/work-orders/{self.work_order.id}/',
            {'status': WorkOrder.Status.COMPLETED}, format='json', **self.headers,
        )
        self.assertEqual(direct.status_code, 400)
        completed = self.client.post(
            f'/api/v1/facility/work-orders/{self.work_order.id}/transition/',
            {'status': WorkOrder.Status.COMPLETED, 'notes': 'Lift tested and returned to service.'},
            format='json', **self.headers,
        )
        self.assertEqual(completed.status_code, 200, completed.data)
        self.work_order.refresh_from_db()
        self.assertEqual(self.work_order.progress, 100)
        self.assertIsNotNone(self.work_order.completed_at)
        event = WorkOrderEvent.objects.get(work_order=self.work_order)
        self.assertEqual((event.from_status, event.to_status), ('in_progress', 'completed'))
        self.assertEqual(event.actor, self.user)

    def test_invalid_or_unexplained_transition_is_rejected(self):
        self.work_order.status = WorkOrder.Status.ASSIGNED
        self.work_order.save()
        invalid = self.client.post(
            f'/api/v1/facility/work-orders/{self.work_order.id}/transition/',
            {'status': WorkOrder.Status.COMPLETED, 'notes': 'Skip execution'},
            format='json', **self.headers,
        )
        self.assertEqual(invalid.status_code, 400)
        hold = self.client.post(
            f'/api/v1/facility/work-orders/{self.work_order.id}/transition/',
            {'status': WorkOrder.Status.ON_HOLD}, format='json', **self.headers,
        )
        self.assertEqual(hold.status_code, 400)

    def test_cost_item_recalculates_work_order_cost_and_logs_event(self):
        response = self.client.post('/api/v1/facility/work-order-cost-items/', {
            'work_order': str(self.work_order.id), 'kind': WorkOrderCostItem.Kind.PART,
            'description': 'Lift door roller', 'quantity': '2.000',
            'unit_cost': '3500.00', 'total': '7000.00', 'supplier': 'Lift Parts Kenya',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.work_order.refresh_from_db()
        self.assertEqual(self.work_order.parts_cost, Decimal('7000.00'))
        self.assertTrue(WorkOrderEvent.objects.filter(work_order=self.work_order, event_type='cost_added').exists())

    def test_preventive_schedule_generates_idempotent_work_order_and_advances_recurrence(self):
        schedule = PreventiveSchedule.objects.create(
            organization=self.organization, code='PM-LIFT', name='Monthly lift service', asset=self.asset,
            frequency=PreventiveSchedule.Frequency.MONTHLY, next_due_on=timezone.localdate(), instructions='Service and safety test.',
        )
        url = f'/api/v1/facility/planned-maintenance/{schedule.id}/'
        first = self.client.post(f'{url}generate-work-order/', {}, format='json', **self.headers)
        second = self.client.post(f'{url}generate-work-order/', {}, format='json', **self.headers)
        self.assertEqual(first.status_code, 201, first.data); self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(WorkOrder.objects.filter(number__startswith='PM-PM-LIFT').count(), 1)
        completed = self.client.post(f'{url}complete/', {}, format='json', **self.headers)
        self.assertEqual(completed.status_code, 200, completed.data)
        schedule.refresh_from_db()
        self.assertEqual(schedule.last_completed_on, timezone.localdate())
        self.assertGreater(schedule.next_due_on, schedule.last_completed_on)

    def test_failed_inspection_creates_audited_corrective_work_order(self):
        inspection = Inspection.objects.create(
            organization=self.organization, reference='INS-01', title='Lift safety inspection',
            inspection_type='Safety', property=self.property, asset=self.asset, inspector=self.user,
            scheduled_on=timezone.localdate(),
        )
        completed = self.client.post(f'/api/v1/facility/inspections/{inspection.id}/complete/', {
            'score': '62', 'violations': 2, 'findings': 'Door interlock response outside tolerance.',
        }, format='json', **self.headers)
        self.assertEqual(completed.status_code, 200, completed.data)
        inspection.refresh_from_db()
        self.assertEqual(inspection.status, Inspection.Status.FOLLOW_UP)
        self.assertIsNotNone(inspection.follow_up_work_order)
        self.assertTrue(WorkOrderEvent.objects.filter(work_order=inspection.follow_up_work_order, event_type='inspection_finding').exists())

    def test_service_request_converts_once_and_records_resolution_score(self):
        service_request = ServiceRequest.objects.create(
            organization=self.organization, reference='SR-01', subject='Lift noise', category='Mechanical',
            property=self.property, status=ServiceRequest.Status.NEW, priority=WorkOrder.Priority.HIGH,
            submitted_at=timezone.now(),
        )
        url = f'/api/v1/facility/service-requests/{service_request.id}/'
        converted = self.client.post(f'{url}convert/', {}, format='json', **self.headers)
        self.assertEqual(converted.status_code, 200, converted.data)
        self.assertEqual(self.client.post(f'{url}convert/', {}, format='json', **self.headers).status_code, 400)
        resolved = self.client.post(f'{url}resolve/', {'satisfaction_score': 5}, format='json', **self.headers)
        self.assertEqual(resolved.status_code, 200, resolved.data)
        service_request.refresh_from_db()
        self.assertEqual(service_request.status, ServiceRequest.Status.RESOLVED)
        self.assertEqual(service_request.satisfaction_score, 5)

    def test_meter_readings_compute_consumption_cost_and_anomaly_server_side(self):
        meter = UtilityMeter.objects.create(
            organization=self.organization, code='ELEC-01', name='Main electricity meter',
            property=self.property, utility_type=UtilityMeter.Utility.ELECTRICITY, tariff=Decimal('25.0000'),
        )
        MeterReading.objects.create(organization=self.organization, meter=meter, read_at=timezone.now() - timezone.timedelta(days=2), value=Decimal('1000'), consumption=Decimal('100'), cost=Decimal('2500'))
        MeterReading.objects.create(organization=self.organization, meter=meter, read_at=timezone.now() - timezone.timedelta(days=1), value=Decimal('1100'), consumption=Decimal('100'), cost=Decimal('2500'))
        created = self.client.post('/api/v1/facility/meter-readings/', {
            'meter': str(meter.id), 'read_at': timezone.now().isoformat(), 'value': '1300',
            'consumption': '1', 'cost': '1', 'is_anomaly': False,
        }, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        reading = MeterReading.objects.order_by('-read_at').first()
        self.assertEqual(reading.consumption, Decimal('200'))
        self.assertEqual(reading.cost, Decimal('5000'))
        self.assertTrue(reading.is_anomaly)
        self.assertEqual(self.client.delete(f'/api/v1/facility/meter-readings/{reading.id}/', **self.headers).status_code, 400)
