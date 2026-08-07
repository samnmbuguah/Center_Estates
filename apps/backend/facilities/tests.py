from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Module
from organizations.models import Membership, MembershipRole, Organization, Permission, Role
from properties.models import Building, Lease, Property, Tenant, TenantPortalAccess, Unit
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

    def test_facility_analytics(self):
        response = self.client.get('/api/v1/facility/analytics/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertIn('summary', response.data)
        self.assertIn('work_orders_by_status', response.data)
        self.assertIn('work_orders_by_priority', response.data)
        self.assertIn('assets_by_category', response.data)
        self.assertIn('inspections_by_month', response.data)
        self.assertEqual(response.data['summary']['total_assets'], 1)
        self.assertEqual(response.data['summary']['active_assets'], 1)
        self.assertEqual(response.data['summary']['total_work_orders'], 1)
        self.assertEqual(response.data['summary']['open_work_orders'], 1)

    def test_facility_export_assets(self):
        response = self.client.get('/api/v1/facility/analytics/exports/?type=assets', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/csv')
        self.assertIn('facility-assets.csv', response['Content-Disposition'])


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class FacilityRolePermissionApiTests(TestCase):
    """Role-complete acceptance for facility technician, inspector and occupant."""

    def setUp(self):
        self.user = get_user_model().objects.create_user(username='facility-role-user', password='test')
        self.organization = Organization.objects.create(name='Facility Roles', slug='facility-roles')
        self.membership = Membership.objects.create(
            user=self.user, organization=self.organization, is_default=True,
        )
        Subscription.objects.create(
            organization=self.organization, module=Module.FACILITY, status=Subscription.Status.ACTIVE,
        )
        self.property = Property.objects.create(
            organization=self.organization, code='FR-1', name='Role Building',
        )
        self.asset = FacilityAsset.objects.create(
            organization=self.organization, property=self.property, code='FR-A1',
            name='Role Lift', category='Mechanical', purchase_value=Decimal('500000'),
        )
        self.work_order = WorkOrder.objects.create(
            organization=self.organization, number='FR-WO-1', title='Lift repair',
            category='Mechanical', property=self.property, asset=self.asset,
            reported_by=self.user, priority=WorkOrder.Priority.HIGH,
            status=WorkOrder.Status.ASSIGNED, reported_at=timezone.now(),
            resolution_due_at=timezone.now() + timezone.timedelta(hours=6), progress=0,
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

    def test_technician_runs_work_and_adds_costs_but_cannot_administer_or_inspect(self):
        self._grant('facility.view', 'facility.work')
        self.assertEqual(self.client.get('/api/v1/facility/dashboard/', **self.headers).status_code, 200)

        created = self.client.post('/api/v1/facility/work-orders/', {
            'number': 'FR-WO-2', 'title': 'Test alarm', 'category': 'Fire safety',
            'property': str(self.property.id), 'priority': 'critical', 'status': 'open',
            'reported_at': timezone.now().isoformat(), 'progress': 0,
        }, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(WorkOrder.objects.get(number='FR-WO-2').reported_by, self.user)

        transitioned = self.client.post(
            f'/api/v1/facility/work-orders/{self.work_order.id}/transition/',
            {'status': 'in_progress', 'notes': 'Technician started work'},
            format='json', **self.headers,
        )
        self.assertEqual(transitioned.status_code, 200, transitioned.data)
        self.assertEqual(transitioned.data['status'], WorkOrder.Status.IN_PROGRESS)

        cost = self.client.post('/api/v1/facility/work-order-cost-items/', {
            'work_order': str(self.work_order.id), 'kind': 'part', 'description': 'Lift cable',
            'quantity': '1', 'unit_cost': '45000.00', 'total': '45000.00',
        }, format='json', **self.headers)
        self.assertEqual(cost.status_code, 201, cost.data)

        for collection in ('assets', 'contractors', 'inspections', 'meters'):
            with self.subTest(collection=collection):
                self.assertEqual(
                    self.client.post(
                        f'/api/v1/facility/{collection}/', {}, format='json', **self.headers,
                    ).status_code,
                    403,
                )

    def test_technician_records_meter_readings_and_completes_work_order(self):
        self._grant('facility.view', 'facility.work', 'facility.read_meters')
        meter = UtilityMeter.objects.create(
            organization=self.organization, code='FR-ELEC', name='Role meter',
            property=self.property, utility_type=UtilityMeter.Utility.ELECTRICITY,
            tariff=Decimal('25.0000'),
        )
        MeterReading.objects.create(
            organization=self.organization, meter=meter,
            read_at=timezone.now() - timezone.timedelta(days=1),
            value=Decimal('500'), consumption=Decimal('0'), cost=Decimal('0'),
        )
        reading = self.client.post('/api/v1/facility/meter-readings/', {
            'meter': str(meter.id), 'read_at': timezone.now().isoformat(), 'value': '560',
            'consumption': '0', 'cost': '0',
        }, format='json', **self.headers)
        self.assertEqual(reading.status_code, 201, reading.data)
        saved = MeterReading.objects.order_by('-read_at').first()
        self.assertEqual(saved.consumption, Decimal('60'))
        self.assertEqual(saved.cost, Decimal('1500'))

        completed = self.client.post(
            f'/api/v1/facility/work-orders/{self.work_order.id}/transition/',
            {'status': 'in_progress', 'notes': 'Started'}, format='json', **self.headers,
        )
        self.assertEqual(completed.status_code, 200, completed.data)
        finished = self.client.post(
            f'/api/v1/facility/work-orders/{self.work_order.id}/transition/',
            {'status': 'completed', 'notes': 'Done'}, format='json', **self.headers,
        )
        self.assertEqual(finished.status_code, 200, finished.data)
        self.work_order.refresh_from_db()
        self.assertEqual(self.work_order.status, WorkOrder.Status.COMPLETED)
        self.assertIsNotNone(self.work_order.completed_at)

    def test_inspector_executes_inspections_and_creates_corrective_work_but_cannot_administer(self):
        self._grant('facility.view', 'facility.inspect', 'facility.work')
        created = self.client.post('/api/v1/facility/inspections/', {
            'reference': 'FR-INS-1', 'title': 'Fire safety inspection',
            'inspection_type': 'Safety', 'property': str(self.property.id),
            'asset': str(self.asset.id), 'scheduled_on': '2026-08-01',
        }, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)

        completed = self.client.post(
            f"/api/v1/facility/inspections/{created.data['id']}/complete/",
            {'findings': 'Corroded fire hose reel', 'score': '42', 'violations': 2},
            format='json', **self.headers,
        )
        self.assertEqual(completed.status_code, 200, completed.data)
        self.assertEqual(completed.data['status'], Inspection.Status.FOLLOW_UP)
        self.assertTrue(
            WorkOrder.objects.filter(organization=self.organization, source_inspections__pk=created.data['id']).exists(),
        )

        for collection in ('assets', 'contractors', 'meters'):
            with self.subTest(collection=collection):
                self.assertEqual(
                    self.client.post(
                        f'/api/v1/facility/{collection}/', {}, format='json', **self.headers,
                    ).status_code,
                    403,
                )

    def test_occupant_portal_submits_and_follows_only_own_service_requests(self):
        self._grant('facility.view')
        tenant = Tenant.objects.create(
            organization=self.organization, code='FR-T1', name='Role Occupant',
            status=Tenant.Status.ACTIVE,
        )
        other_tenant = Tenant.objects.create(
            organization=self.organization, code='FR-T2', name='Other Occupant',
            status=Tenant.Status.ACTIVE,
        )
        building = Building.objects.create(
            organization=self.organization, property=self.property, code='FR-B1', name='Role Tower',
        )
        unit = Unit.objects.create(
            organization=self.organization, property=self.property, building=building,
            code='FR-101', status=Unit.Status.OCCUPIED,
        )
        lease = Lease.objects.create(
            organization=self.organization, reference='FR-LS-1', unit=unit,
            tenant=tenant, starts_on='2026-01-01', ends_on='2027-01-01',
            monthly_rent=Decimal('1000'), status=Lease.Status.ACTIVE,
        )
        TenantPortalAccess.objects.create(
            organization=self.organization, user=self.user, tenant=tenant, is_active=True,
        )
        ServiceRequest.objects.create(
            organization=self.organization, reference='FR-REQ-OTHER', subject='Other tenant issue',
            category='Plumbing', property=self.property, tenant=other_tenant,
            status=ServiceRequest.Status.NEW, submitted_at=timezone.now(),
        )

        portal = self.client.get('/api/v1/facility/portal/', **self.headers)
        self.assertEqual(portal.status_code, 200, portal.data)
        self.assertEqual(portal.data['tenant']['id'], str(tenant.id))
        self.assertEqual(portal.data['property']['name'], 'Role Building')
        self.assertEqual(len(portal.data['serviceRequests']), 0)

        created = self.client.post('/api/v1/facility/portal/service-requests/', {
            'subject': 'Leaking tap', 'category': 'Plumbing',
            'description': 'Kitchen tap drips', 'priority': 'medium',
        }, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(str(created.data['tenant']), str(tenant.id))

        portal = self.client.get('/api/v1/facility/portal/', **self.headers)
        self.assertEqual(len(portal.data['serviceRequests']), 1)
        self.assertEqual(portal.data['serviceRequests'][0]['subject'], 'Leaking tap')

        # A facility staff endpoint stays out of reach: work mutation requires facility.work.
        self.assertEqual(
            self.client.post('/api/v1/facility/work-orders/', {}, format='json', **self.headers).status_code,
            403,
        )

    def test_occupant_without_linked_profile_cannot_open_portal(self):
        self._grant('facility.view')
        self.assertEqual(self.client.get('/api/v1/facility/portal/', **self.headers).status_code, 403)
