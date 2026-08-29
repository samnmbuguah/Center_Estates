from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Module
from organizations.models import Membership, MembershipRole, Organization, Permission, Role
from properties.models import Building, Lease, Property, Tenant, TenantPortalAccess, Unit
from subscriptions.models import Subscription

from .models import Contractor, ContractorContract, ContractInvoiceAppraisal, FacilityAsset, FacilityExpense, FacilityIncident, FacilityIncidentAttachment, FacilityIncidentEvent, FacilityJobCard, FacilityPaymentRecord, FinancePaymentRequest, FloorPlan, Inspection, LocalPurchaseOrder, MeterReading, MeterReconciliation, MeterResetEvent, PreventiveSchedule, ProcurementRecord, RepairRequisition, ServiceProfile, ServiceRequest, SupplierInvoice, UtilityMeter, WorkOrder, WorkOrderCostItem, WorkOrderEvent


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
        Subscription.objects.create(organization=self.organization, module=Module.PROPERTY, status=Subscription.Status.ACTIVE)
        self.property = Property.objects.create(organization=self.organization, code='P1', name='Main Building')
        self.building = Building.objects.create(organization=self.organization, property=self.property, code='BLD-1', name='Main Building')
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

    def test_floor_plan_upload_is_property_scoped_and_retains_original(self):
        response = self.client.post('/api/v1/facility/floor-plans/upload/', {
            'building': str(self.building.id), 'floor': '6',
            'file': SimpleUploadedFile('level-6.png', b'not-a-real-png-but-a-storage-test', content_type='image/png'),
        }, format='multipart', **{**self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id)})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['file_type'], 'png')
        self.assertEqual(response.data['preview_status'], 'ready')
        self.assertTrue(response.data['original_url'])
        self.assertEqual(FloorPlan.objects.filter(organization=self.organization, building=self.building, floor='6').count(), 1)

        listed = self.client.get('/api/v1/facility/floor-plans/', {
            'building': str(self.building.id), 'floor': '6',
        }, **{**self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id)})
        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(len(listed.data), 1)

    def test_landlord_report_is_a_real_property_scoped_pdf(self):
        response = self.client.get('/api/v1/facility/analytics/landlord-report/', **{
            **self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id),
        })
        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn('facility-performance-', response['Content-Disposition'])
        self.assertTrue(response.content.startswith(b'%PDF-'))
        self.assertGreater(len(response.content), 2500)

    def test_asset_onboarding_generates_code_and_keeps_digital_passport(self):
        response = self.client.post('/api/v1/facility/assets/', {
            'name': 'Roof standby generator',
            'category': 'Backup power',
            'property': str(self.property.id),
            'criticality': 'critical',
            'condition': 'good',
            'purchase_value': '1250000.00',
            'replacement_cost': '1800000.00',
            'metadata': {
                'asset_type': 'Diesel generator',
                'capacity_rating': '500 kVA',
                'room': 'Roof plant room',
                'maintenance_strategy': 'preventive',
                'onboarding_status': 'complete',
            },
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertRegex(response.data['code'], r'^AST-[A-F0-9]{8}$')
        self.assertEqual(response.data['metadata']['capacity_rating'], '500 kVA')

    def test_service_provider_onboarding_generates_code_and_assigns_property(self):
        response = self.client.post('/api/v1/facility/contractors/', {
            'name': 'Reliable Technical Services Ltd',
            'specialty': 'Mechanical and electrical',
            'registration_number': 'PVT-12345',
            'pin_number': 'P012345678A',
            'contact_name': 'Jane Manager',
            'phone': '+254700000001',
            'email': 'service@example.test',
            'approval_status': 'pending',
            'assigned_properties': [str(self.property.id)],
            'metadata': {
                'business_type': 'Limited company',
                'bank_name': 'Co-operative Bank',
                'insurance_policy_number': 'POL-123',
                'onboarding_status': 'complete',
            },
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertRegex(response.data['code'], r'^SP-[A-F0-9]{8}$')
        self.assertEqual(response.data['assigned_properties'], [self.property.id])
        self.assertEqual(response.data['metadata']['bank_name'], 'Co-operative Bank')

    def test_service_profile_is_independent_and_property_scoped(self):
        response = self.client.post('/api/v1/facility/service-profiles/', {
            'name': 'Generator maintenance', 'category': 'Mechanical', 'service_type': 'preventive',
            'status': 'active', 'criticality': 'critical', 'coverage': 'property',
            'default_frequency': 'Monthly', 'description': 'Keep standby generation available.',
            'properties': [str(self.property.id)], 'assets': [str(self.asset.id)],
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertRegex(response.data['code'], r'^SVC-[A-F0-9]{8}$')
        profile = ServiceProfile.objects.get(pk=response.data['id'])
        self.assertEqual(profile.created_by, self.user)
        self.assertEqual(profile.allocations.count(), 0)
        scoped = self.client.get('/api/v1/facility/service-profiles/', **{
            **self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id),
        })
        self.assertEqual([row['name'] for row in scoped.data], ['Generator maintenance'])

    def test_incident_draft_review_work_order_and_closure_are_audited(self):
        created = self.client.post('/api/v1/facility/incidents/', {
            'property': str(self.property.id), 'location': 'Lift lobby',
            'occurred_at': timezone.now().isoformat(), 'category': 'Safety', 'severity': 'high',
            'narrative': 'A passenger was briefly trapped when the lift stopped.',
            'people_involved': ['Visitor'], 'impacts': ['Service disruption'],
            'immediate_action': 'Isolated the lift and assisted the passenger.',
            'recommended_action': 'Inspect lift controls.',
        }, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        incident = FacilityIncident.objects.get(pk=created.data['id'])
        self.assertEqual(incident.status, FacilityIncident.Status.DRAFT)

        evidence = self.client.post(f'/api/v1/facility/incidents/{incident.id}/attachments/', {
            'file': SimpleUploadedFile('incident-photo.jpg', b'incident-evidence', content_type='image/jpeg'),
            'name': 'Plant room condition',
        }, format='multipart', **self.headers)
        self.assertEqual(evidence.status_code, 201, evidence.data)
        self.assertEqual(FacilityIncidentAttachment.objects.filter(incident=incident).count(), 1)
        self.assertTrue(FacilityIncidentEvent.objects.filter(incident=incident, event_type='evidence_uploaded').exists())
        submitted = self.client.post(f'/api/v1/facility/incidents/{incident.id}/submit/', {}, format='json', **self.headers)
        self.assertEqual(submitted.status_code, 200, submitted.data)
        reviewed = self.client.post(f'/api/v1/facility/incidents/{incident.id}/review/', {'notes': 'Escalated to lift vendor.'}, format='json', **self.headers)
        self.assertEqual(reviewed.status_code, 200, reviewed.data)
        linked = self.client.post(f'/api/v1/facility/incidents/{incident.id}/create-work-order/', {}, format='json', **self.headers)
        self.assertEqual(linked.status_code, 201, linked.data)
        resolved = self.client.post(f'/api/v1/facility/incidents/{incident.id}/resolve/', {'resolution_notes': 'Control relay replaced and lift tested.'}, format='json', **self.headers)
        self.assertEqual(resolved.status_code, 200, resolved.data)
        closed = self.client.post(f'/api/v1/facility/incidents/{incident.id}/close/', {'notes': 'Manager verified closure.'}, format='json', **self.headers)
        self.assertEqual(closed.status_code, 200, closed.data)
        incident.refresh_from_db()
        self.assertEqual(incident.status, FacilityIncident.Status.CLOSED)
        self.assertIsNotNone(incident.work_order_id)
        # Draft creation, evidence, submission, review, work-order creation,
        # resolution and closure are all retained as distinct audit events.
        self.assertEqual(FacilityIncidentEvent.objects.filter(incident=incident).count(), 7)

    def test_dashboard_is_calculated_from_live_data(self):
        response = self.client.get('/api/v1/facility/dashboard/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['kpis']['activeAssets'], 1)
        self.assertEqual(response.data['kpis']['openWorkOrders'], 1)
        self.assertEqual(response.data['kpis']['overdueWorkOrders'], 1)

    def test_facility_expense_is_persisted_scoped_and_approved(self):
        created = self.client.post('/api/v1/facility/expenses/', {
            'property': str(self.property.id),
            'spent_on': '2026-08-23',
            'category': 'Repairs',
            'description': 'Generator oil and filter service',
            'amount': '18500.00',
            'float_reference': 'FLT-2026-08',
            'supplier': 'PowerTech Services',
            'receipt_reference': 'RCT-1842',
        }, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        expense = FacilityExpense.objects.get(pk=created.data['id'])
        self.assertEqual(expense.recorded_by, self.user)
        self.assertEqual(expense.status, FacilityExpense.Status.PENDING)

        approved = self.client.post(
            f'/api/v1/facility/expenses/{expense.id}/approve/',
            {'notes': 'Receipt and service completion verified.'}, format='json', **self.headers,
        )
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data['status'], FacilityExpense.Status.APPROVED)
        listed = self.client.get('/api/v1/facility/expenses/', **{
            **self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id),
        })
        self.assertEqual([row['description'] for row in listed.data], ['Generator oil and filter service'])

    def test_preventive_schedules_can_be_created_atomically_in_bulk(self):
        response = self.client.post('/api/v1/facility/planned-maintenance/bulk-create/', {
            'records': [
                {
                    'code': 'PPM-A1-202608', 'name': 'August lift service',
                    'asset': str(self.asset.id), 'frequency': 'monthly',
                    'next_due_on': '2026-08-28', 'estimated_hours': '2.00', 'is_active': True,
                },
                {
                    'code': 'PPM-A1-202609', 'name': 'September lift service',
                    'asset': str(self.asset.id), 'frequency': 'monthly',
                    'next_due_on': '2026-09-28', 'estimated_hours': '2.00', 'is_active': True,
                },
            ],
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(PreventiveSchedule.objects.filter(organization=self.organization).count(), 2)

        duplicate = self.client.post('/api/v1/facility/planned-maintenance/bulk-create/', {
            'records': [{
                'code': 'PPM-A1-202608', 'name': 'Duplicate schedule',
                'asset': str(self.asset.id), 'frequency': 'monthly',
                'next_due_on': '2026-10-28', 'estimated_hours': '2.00', 'is_active': True,
            }],
        }, format='json', **self.headers)
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(PreventiveSchedule.objects.filter(organization=self.organization).count(), 2)

    def test_dashboard_and_contractors_honor_selected_property(self):
        assigned = Contractor.objects.create(
            organization=self.organization, code='V-1', name='Main Lift Vendor', specialty='Lifts', status=Contractor.Status.ACTIVE,
        )
        self.work_order.contractor = assigned
        self.work_order.save(update_fields=('contractor', 'updated_at'))
        second_property = Property.objects.create(organization=self.organization, code='P3', name='Branch Building')
        branch_vendor = Contractor.objects.create(
            organization=self.organization, code='V-2', name='Branch Vendor', specialty='HVAC', status=Contractor.Status.ACTIVE,
        )
        WorkOrder.objects.create(
            organization=self.organization, number='WO-BRANCH', title='Branch HVAC', category='HVAC',
            property=second_property, contractor=branch_vendor, reported_by=self.user,
            status=WorkOrder.Status.OPEN, reported_at=timezone.now(),
        )
        scoped_headers = {**self.headers, 'HTTP_X_PROPERTY_ID': str(self.property.id)}

        dashboard = self.client.get('/api/v1/facility/dashboard/', **scoped_headers)
        self.assertEqual(dashboard.status_code, 200)
        self.assertEqual(dashboard.data['kpis']['openWorkOrders'], 1)
        self.assertEqual(dashboard.data['kpis']['contractors'], 1)
        contractors = self.client.get('/api/v1/facility/contractors/', **scoped_headers)
        self.assertEqual([row['name'] for row in contractors.data], ['Main Lift Vendor'])

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
            'unit_cost': '3500.00', 'total': '1.00', 'supplier': 'Lift Parts Kenya',
        }, format='json', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.work_order.refresh_from_db()
        self.assertEqual(self.work_order.parts_cost, Decimal('7000.00'))
        self.assertTrue(WorkOrderEvent.objects.filter(work_order=self.work_order, event_type='cost_added').exists())
        self.assertEqual(Decimal(response.data['total']), Decimal('7000.00'))
        attachment = self.client.post('/api/v1/facility/work-order-attachments/', {
            'work_order': str(self.work_order.id), 'file_url': '/media/work-orders/lift-after.jpg',
            'file_name': 'lift-after.jpg', 'media_type': 'image/jpeg', 'caption': 'Lift returned to service',
        }, format='json', **self.headers)
        self.assertEqual(attachment.status_code, 201, attachment.data)
        self.assertTrue(WorkOrderEvent.objects.filter(work_order=self.work_order, event_type='attachment_added').exists())

    def test_work_order_evidence_accepts_direct_file_upload(self):
        image = SimpleUploadedFile('repair-after.jpg', b'fake-jpeg-content', content_type='image/jpeg')
        response = self.client.post('/api/v1/facility/work-order-attachments/', {
            'work_order': str(self.work_order.id), 'uploaded_file': image,
            'file_name': 'repair-after.jpg', 'media_type': 'image/jpeg',
            'caption': 'Lift tested after repair.',
        }, format='multipart', **self.headers)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIn('/media/facility/work-orders/', response.data['file_url'])
        self.assertTrue(WorkOrderEvent.objects.filter(work_order=self.work_order, event_type='attachment_added').exists())

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

    def test_completed_work_requires_manager_verification_gate(self):
        self.work_order.status = WorkOrder.Status.COMPLETED
        self.work_order.completed_at = timezone.now()
        self.work_order.resolution_notes = 'Repair complete and tested.'
        self.work_order.save()
        response = self.client.post(
            f'/api/v1/facility/work-orders/{self.work_order.id}/verify/',
            {'notes': 'Evidence reviewed and asset returned to service.'},
            format='json', **self.headers,
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.work_order.refresh_from_db()
        self.assertTrue(self.work_order.supervisor_verified)
        self.assertEqual(self.work_order.supervisor_verified_by, self.user)
        self.assertTrue(WorkOrderEvent.objects.filter(work_order=self.work_order, event_type='manager_verified').exists())

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

    def test_service_request_resolution_waits_for_requester_confirmation(self):
        service_request = ServiceRequest.objects.create(
            organization=self.organization, reference='SR-01', subject='Lift noise', category='Mechanical',
            property=self.property, status=ServiceRequest.Status.NEW, priority=WorkOrder.Priority.HIGH,
            submitted_at=timezone.now(),
        )
        url = f'/api/v1/facility/service-requests/{service_request.id}/'
        self.assertEqual(self.client.post(f'{url}convert/', {}, format='json', **self.headers).status_code, 400)
        approved = self.client.post(f'{url}approve/', {'notes': 'Budget threshold accepted'}, format='json', **self.headers)
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data['status'], ServiceRequest.Status.APPROVED)
        converted = self.client.post(f'{url}convert/', {}, format='json', **self.headers)
        self.assertEqual(converted.status_code, 200, converted.data)
        self.assertEqual(self.client.post(f'{url}convert/', {}, format='json', **self.headers).status_code, 400)
        self.assertEqual(self.client.post(f'{url}resolve/', {'satisfaction_score': 5}, format='json', **self.headers).status_code, 400)
        service_request.refresh_from_db()
        service_request.work_order.status = WorkOrder.Status.COMPLETED
        service_request.work_order.completed_at = timezone.now()
        service_request.work_order.save(update_fields=('status', 'completed_at', 'updated_at'))
        resolved = self.client.post(f'{url}resolve/', {}, format='json', **self.headers)
        self.assertEqual(resolved.status_code, 200, resolved.data)
        service_request.refresh_from_db()
        self.assertEqual(service_request.status, ServiceRequest.Status.RESOLVED)
        self.assertIsNone(service_request.satisfaction_score)
        service_request.work_order.refresh_from_db()
        self.assertFalse(service_request.work_order.requester_confirmed)

    def test_service_request_rejection_requires_reason_and_blocks_conversion(self):
        service_request = ServiceRequest.objects.create(
            organization=self.organization, reference='SR-REJECT', subject='Cosmetic repaint', category='Decor',
            property=self.property, status=ServiceRequest.Status.NEW, submitted_at=timezone.now(),
        )
        url = f'/api/v1/facility/service-requests/{service_request.id}/'
        self.assertEqual(self.client.post(f'{url}reject/', {}, format='json', **self.headers).status_code, 400)
        rejected = self.client.post(f'{url}reject/', {'notes': 'Tenant alteration, not common-area maintenance.'}, format='json', **self.headers)
        self.assertEqual(rejected.status_code, 200, rejected.data)
        self.assertEqual(rejected.data['status'], ServiceRequest.Status.REJECTED)
        self.assertEqual(self.client.post(f'{url}convert/', {}, format='json', **self.headers).status_code, 400)

    def test_meter_readings_compute_consumption_cost_and_anomaly_server_side(self):
        unit = Unit.objects.create(organization=self.organization, property=self.property, code='101')
        meter = UtilityMeter.objects.create(
            organization=self.organization, code='ELEC-01', name='Main electricity meter',
            property=self.property, property_unit=unit,
            utility_type=UtilityMeter.Utility.ELECTRICITY, tariff=Decimal('25.0000'),
        )
        MeterReading.objects.create(organization=self.organization, meter=meter, read_at=timezone.now() - timezone.timedelta(days=2), value=Decimal('1000'), consumption=Decimal('100'), cost=Decimal('2500'), status=MeterReading.Status.APPROVED)
        MeterReading.objects.create(organization=self.organization, meter=meter, read_at=timezone.now() - timezone.timedelta(days=1), value=Decimal('1100'), consumption=Decimal('100'), cost=Decimal('2500'), status=MeterReading.Status.APPROVED)
        created = self.client.post('/api/v1/facility/meter-readings/', {
            'meter': str(meter.id), 'read_at': timezone.now().isoformat(), 'value': '1300',
            'consumption': '1', 'cost': '1', 'is_anomaly': False,
        }, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        reading = MeterReading.objects.order_by('-read_at').first()
        self.assertEqual(reading.consumption, Decimal('200'))
        self.assertEqual(reading.cost, Decimal('5000'))
        self.assertEqual(reading.previous_value, Decimal('1100'))
        self.assertEqual(reading.status, MeterReading.Status.PENDING)
        self.assertTrue(reading.is_anomaly)
        approved = self.client.post(
            f'/api/v1/facility/meter-readings/{reading.id}/approve/',
            {'notes': 'Consumption checked against the caretaker sheet.'}, format='json', **self.headers,
        )
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data['status'], MeterReading.Status.APPROVED)
        self.assertEqual(approved.data['unit_code'], '101')
        self.assertEqual(self.client.post(
            f'/api/v1/facility/meter-readings/{reading.id}/approve/', {}, format='json', **self.headers,
        ).status_code, 400)
        backwards = self.client.post('/api/v1/facility/meter-readings/', {
            'meter': str(meter.id), 'read_at': (timezone.now() + timezone.timedelta(days=1)).isoformat(), 'value': '1200',
        }, format='json', **self.headers)
        self.assertEqual(backwards.status_code, 201, backwards.data)
        self.assertEqual(backwards.data['status'], MeterReading.Status.REJECTED)
        self.assertEqual(Decimal(backwards.data['consumption']), Decimal('0'))
        out_of_sequence = self.client.post('/api/v1/facility/meter-readings/', {
            'meter': str(meter.id), 'read_at': (reading.read_at - timezone.timedelta(hours=1)).isoformat(), 'value': '1400',
        }, format='json', **self.headers)
        self.assertEqual(out_of_sequence.status_code, 400)
        self.assertIn('read_at', out_of_sequence.data)
        self.assertEqual(self.client.delete(f'/api/v1/facility/meter-readings/{reading.id}/', **self.headers).status_code, 400)

        meter_register = self.client.get('/api/v1/facility/meters/', **self.headers)
        self.assertEqual(meter_register.status_code, 200)
        registered = next(row for row in meter_register.data if row['code'] == 'ELEC-01')
        self.assertEqual(registered['unit_code'], '101')
        self.assertEqual(Decimal(registered['current_reading']), Decimal('1200'))
        self.assertEqual(Decimal(registered['previous_reading']), Decimal('1300'))
        self.assertEqual(registered['reading_status'], MeterReading.Status.REJECTED)
        self.assertEqual(self.client.patch(
            f'/api/v1/facility/meters/{meter.id}/', {'tariff': '-1'}, format='json', **self.headers,
        ).status_code, 400)
        updated_rate = self.client.patch(
            f'/api/v1/facility/meters/{meter.id}/', {'tariff': '27.5000'}, format='json', **self.headers,
        )
        self.assertEqual(updated_rate.status_code, 200, updated_rate.data)
        self.assertEqual(Decimal(updated_rate.data['tariff']), Decimal('27.5000'))
        MeterReading.objects.create(
            organization=self.organization, meter=meter,
            read_at=reading.read_at + timezone.timedelta(hours=1), value=Decimal('9999'),
            previous_value=Decimal('1300'), consumption=Decimal('8699'), cost=Decimal('0'),
            status=MeterReading.Status.REJECTED,
        )
        after_rejection = self.client.post('/api/v1/facility/meter-readings/', {
            'meter': str(meter.id),
            'read_at': (reading.read_at + timezone.timedelta(hours=2)).isoformat(),
            'value': '1350',
        }, format='json', **self.headers)
        self.assertEqual(after_rejection.status_code, 201, after_rejection.data)
        self.assertEqual(Decimal(after_rejection.data['previous_value']), Decimal('1300'))
        self.assertEqual(Decimal(after_rejection.data['consumption']), Decimal('50'))

    def test_smart_meter_ingestion_is_idempotent_and_still_requires_approval(self):
        meter = UtilityMeter.objects.create(
            organization=self.organization, code='WATER-IOT', name='Smart water meter',
            property=self.property, utility_type=UtilityMeter.Utility.WATER, tariff=Decimal('90'),
        )
        payload = {
            'meter': str(meter.id), 'read_at': timezone.now().isoformat(), 'value': '240.5',
            'method': MeterReading.Method.IOT, 'source_reference': 'device-7:event-991',
        }
        created = self.client.post('/api/v1/facility/meter-readings/ingest/', payload, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        self.assertFalse(created.data['duplicate'])
        self.assertEqual(created.data['status'], MeterReading.Status.PENDING)
        replay = self.client.post('/api/v1/facility/meter-readings/ingest/', payload, format='json', **self.headers)
        self.assertEqual(replay.status_code, 200, replay.data)
        self.assertTrue(replay.data['duplicate'])
        self.assertEqual(MeterReading.objects.filter(source_reference='device-7:event-991').count(), 1)

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
            status=MeterReading.Status.APPROVED,
        )
        reading = self.client.post('/api/v1/facility/meter-readings/', {
            'meter': str(meter.id), 'read_at': timezone.now().isoformat(), 'value': '560',
            'consumption': '0', 'cost': '0',
        }, format='json', **self.headers)
        self.assertEqual(reading.status_code, 201, reading.data)
        saved = MeterReading.objects.order_by('-read_at').first()
        self.assertEqual(saved.consumption, Decimal('60'))
        self.assertEqual(saved.cost, Decimal('1500'))
        approval_url = f'/api/v1/facility/meter-readings/{saved.id}/approve/'
        self.assertEqual(self.client.post(approval_url, {}, format='json', **self.headers).status_code, 403)
        self._grant('facility.approve')
        self.assertEqual(self.client.post(
            approval_url, {'notes': 'Manager verified'}, format='json', **self.headers,
        ).status_code, 200)
        next_reading = self.client.post('/api/v1/facility/meter-readings/', {
            'meter': str(meter.id), 'read_at': (timezone.now() + timezone.timedelta(hours=1)).isoformat(), 'value': '580',
        }, format='json', **self.headers)
        self.assertEqual(next_reading.status_code, 201, next_reading.data)
        blocked_pending = self.client.post('/api/v1/facility/meter-readings/', {
            'meter': str(meter.id), 'read_at': (timezone.now() + timezone.timedelta(hours=2)).isoformat(), 'value': '590',
        }, format='json', **self.headers)
        self.assertEqual(blocked_pending.status_code, 400)
        self.assertIn('meter', blocked_pending.data)

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

    def test_service_request_approval_is_separate_from_technician_conversion(self):
        self._grant('facility.view', 'facility.work')
        service_request = ServiceRequest.objects.create(
            organization=self.organization, reference='FR-REQ-APPROVAL', subject='Replace common-area light',
            category='Electrical', property=self.property, priority=WorkOrder.Priority.MEDIUM,
            status=ServiceRequest.Status.NEW, submitted_at=timezone.now(),
        )
        url = f'/api/v1/facility/service-requests/{service_request.id}/'
        self.assertEqual(self.client.post(f'{url}approve/', {}, format='json', **self.headers).status_code, 403)
        self.assertEqual(self.client.post(f'{url}convert/', {}, format='json', **self.headers).status_code, 400)
        self._grant('facility.approve')
        approved = self.client.post(f'{url}approve/', {'notes': 'Approved by resident manager'}, format='json', **self.headers)
        self.assertEqual(approved.status_code, 200, approved.data)
        converted = self.client.post(f'{url}convert/', {}, format='json', **self.headers)
        self.assertEqual(converted.status_code, 200, converted.data)
        self.assertEqual(converted.data['status'], ServiceRequest.Status.ASSIGNED)

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

        service_request = ServiceRequest.objects.get(pk=created.data['id'])
        work_order = WorkOrder.objects.create(
            organization=self.organization, number='FR-WO-CONFIRM', title='Repair leaking tap',
            category='Plumbing', property=self.property, reported_by=self.user,
            status=WorkOrder.Status.COMPLETED, reported_at=timezone.now(), completed_at=timezone.now(), progress=100,
        )
        service_request.work_order = work_order
        service_request.status = ServiceRequest.Status.RESOLVED
        service_request.resolved_at = timezone.now()
        service_request.save(update_fields=('work_order', 'status', 'resolved_at', 'updated_at'))
        decision_url = f'/api/v1/facility/portal/service-requests/{service_request.id}/'
        self.assertEqual(self.client.post(f'{decision_url}confirm/', {}, format='json', **self.headers).status_code, 400)
        confirmed = self.client.post(
            f'{decision_url}confirm/', {'satisfaction_score': 5}, format='json', **self.headers,
        )
        self.assertEqual(confirmed.status_code, 200, confirmed.data)
        self.assertEqual(confirmed.data['status'], ServiceRequest.Status.CLOSED)
        work_order.refresh_from_db()
        self.assertTrue(work_order.requester_confirmed)

        service_request.status = ServiceRequest.Status.RESOLVED
        service_request.save(update_fields=('status', 'updated_at'))
        reopened = self.client.post(
            f'{decision_url}reopen/', {'reason': 'The tap is still leaking under pressure.'},
            format='json', **self.headers,
        )
        self.assertEqual(reopened.status_code, 200, reopened.data)
        self.assertEqual(reopened.data['status'], ServiceRequest.Status.IN_PROGRESS)
        work_order.refresh_from_db()
        self.assertEqual(work_order.status, WorkOrder.Status.IN_PROGRESS)
        self.assertFalse(work_order.requester_confirmed)
        self.assertTrue(WorkOrderEvent.objects.filter(work_order=work_order, event_type='requester_reopened').exists())

        # A facility staff endpoint stays out of reach: work mutation requires facility.work.
        self.assertEqual(
            self.client.post('/api/v1/facility/work-orders/', {}, format='json', **self.headers).status_code,
            403,
        )

    def test_occupant_without_linked_profile_cannot_open_portal(self):
        self._grant('facility.view')
        self.assertEqual(self.client.get('/api/v1/facility/portal/', **self.headers).status_code, 403)

    def test_bulk_meter_reconciliation_and_authorized_reset_are_auditable(self):
        self._grant('facility.view', 'facility.work', 'facility.administer', 'facility.approve')
        bulk = UtilityMeter.objects.create(
            organization=self.organization, code='WATER-BULK', name='Main water meter',
            property=self.property, utility_type=UtilityMeter.Utility.WATER,
            meter_role=UtilityMeter.MeterRole.BULK, unit='m3', tariff=Decimal('120'),
        )
        check = UtilityMeter.objects.create(
            organization=self.organization, code='WATER-CHECK-1', name='Unit check meter',
            property=self.property, utility_type=UtilityMeter.Utility.WATER,
            meter_role=UtilityMeter.MeterRole.CHECK, parent_meter=bulk, unit='m3', tariff=Decimal('120'),
        )
        reset = self.client.post('/api/v1/facility/meter-reset-events/', {
            'meter': str(check.id), 'kind': MeterResetEvent.Kind.REPLACEMENT,
            'effective_at': timezone.now().isoformat(), 'previous_value': '950',
            'reset_value': '0', 'reason': 'Meter replaced after failure.',
        }, format='json', **self.headers)
        self.assertEqual(reset.status_code, 201, reset.data)
        reconciliation = self.client.post('/api/v1/facility/meter-reconciliations/', {
            'bulk_meter': str(bulk.id), 'period_start': '2026-08-01', 'period_end': '2026-08-31',
            'bulk_consumption': '1070', 'check_consumption': '920', 'tolerance_percent': '5',
            'supporting_documents': [],
        }, format='json', **self.headers)
        self.assertEqual(reconciliation.status_code, 201, reconciliation.data)
        self.assertEqual(reconciliation.data['status'], MeterReconciliation.Status.EXCEPTION)
        self.assertEqual(Decimal(reconciliation.data['variance']), Decimal('150'))
        without_notes = self.client.post(
            f"/api/v1/facility/meter-reconciliations/{reconciliation.data['id']}/approve/", {}, format='json', **self.headers,
        )
        self.assertEqual(without_notes.status_code, 400)
        approved = self.client.post(
            f"/api/v1/facility/meter-reconciliations/{reconciliation.data['id']}/approve/",
            {'notes': 'Leak inspection task raised.'}, format='json', **self.headers,
        )
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data['status'], MeterReconciliation.Status.APPROVED)
        self.assertEqual(self.client.post(
            f"/api/v1/facility/meter-reconciliations/{reconciliation.data['id']}/approve/",
            {'notes': 'Already approved'}, format='json', **self.headers,
        ).status_code, 400)

        worker = get_user_model().objects.create_user(username='facility-worker', password='test')
        membership = Membership.objects.create(user=worker, organization=self.organization)
        role = Role.objects.create(organization=self.organization, name='Facility Worker', slug='facility-worker')
        MembershipRole.objects.create(membership=membership, role=role)
        for key in ('facility.view', 'facility.work'):
            permission, _ = Permission.objects.get_or_create(
                key=key, defaults={'label': key, 'module': 'facility'},
            )
            role.permissions.add(permission)
        self.client.force_authenticate(worker)
        exception = self.client.post('/api/v1/facility/meter-reconciliations/', {
            'bulk_meter': str(bulk.id), 'period_start': '2026-07-01', 'period_end': '2026-07-31',
            'bulk_consumption': '1000', 'check_consumption': '800', 'tolerance_percent': '5',
            'supporting_documents': [],
        }, format='json', **self.headers)
        self.assertEqual(exception.status_code, 201, exception.data)
        forbidden = self.client.post(
            f"/api/v1/facility/meter-reconciliations/{exception.data['id']}/approve/",
            {'notes': 'Worker cannot approve'}, format='json', **self.headers,
        )
        self.assertEqual(forbidden.status_code, 403)


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class RepairRequisitionApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='req-user', password='test')
        self.organization = Organization.objects.create(name='Req Client', slug='req-client')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True, is_organization_admin=True)
        Subscription.objects.create(organization=self.organization, module=Module.FACILITY, status=Subscription.Status.ACTIVE)
        self.property = Property.objects.create(organization=self.organization, code='P1', name='Req Building')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def _create(self, **overrides):
        payload = {
            'title': 'Broken water pump',
            'property': str(self.property.id),
            'location': 'Basement plant room',
            'issue_description': 'Pump stopped on Monday; no water above 2nd floor.',
            'required_repair': 'Replace impeller and seals; pressure test.',
            'estimated_cost': '45000.00',
            'priority': 'high',
        }
        payload.update(overrides)
        return self.client.post('/api/v1/facility/requisitions/', payload, format='json', **self.headers)

    def test_full_requisition_lifecycle(self):
        created = self._create()
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data['status'], 'draft')
        self.assertTrue(created.data['code'].startswith('RQR-'))

        requisition_id = created.data['id']
        submitted = self.client.post(f'/api/v1/facility/requisitions/{requisition_id}/submit/', {}, format='json', **self.headers)
        self.assertEqual(submitted.status_code, 200, submitted.data)
        self.assertEqual(submitted.data['status'], 'submitted')

        approved = self.client.post(f'/api/v1/facility/requisitions/{requisition_id}/approve/', {'notes': 'Approved, urgent'}, format='json', **self.headers)
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data['status'], 'approved')
        self.assertEqual(approved.data['manager_notes'], 'Approved, urgent')

        converted = self.client.post(f'/api/v1/facility/requisitions/{requisition_id}/convert-to-work-order/', {}, format='json', **self.headers)
        self.assertEqual(converted.status_code, 200, converted.data)
        self.assertEqual(converted.data['status'], 'converted')
        self.assertTrue(converted.data['work_order_number'].startswith('WO-'))

        work_order = WorkOrder.objects.get(number=converted.data['work_order_number'])
        self.assertEqual(work_order.source, 'requisition')
        self.assertEqual(work_order.priority, WorkOrder.Priority.HIGH)

    def test_invalid_transitions_are_rejected(self):
        created = self._create()
        requisition_id = created.data['id']
        # Cannot approve a draft
        early = self.client.post(f'/api/v1/facility/requisitions/{requisition_id}/approve/', {}, format='json', **self.headers)
        self.assertEqual(early.status_code, 400)
        # Cannot convert a draft
        early_convert = self.client.post(f'/api/v1/facility/requisitions/{requisition_id}/convert-to-work-order/', {}, format='json', **self.headers)
        self.assertEqual(early_convert.status_code, 400)

    def test_reject_requires_reason(self):
        created = self._create()
        requisition_id = created.data['id']
        self.client.post(f'/api/v1/facility/requisitions/{requisition_id}/submit/', {}, format='json', **self.headers)
        missing = self.client.post(f'/api/v1/facility/requisitions/{requisition_id}/reject/', {'reason': ''}, format='json', **self.headers)
        self.assertEqual(missing.status_code, 400)
        rejected = self.client.post(f'/api/v1/facility/requisitions/{requisition_id}/reject/', {'reason': 'Over budget'}, format='json', **self.headers)
        self.assertEqual(rejected.status_code, 200, rejected.data)
        self.assertEqual(rejected.data['status'], 'rejected')
        self.assertEqual(rejected.data['rejected_reason'], 'Over budget')

    def test_requisitions_are_organization_scoped(self):
        other = Organization.objects.create(name='Req Other', slug='req-other')
        other_property = Property.objects.create(organization=other, code='P9', name='Hidden Building')
        RepairRequisition.objects.create(
            organization=other, property=other_property, code='RQR-OTHER-1',
            title='Hidden requisition', issue_description='x', required_repair='y',
            requester=self.user,
        )
        response = self.client.get('/api/v1/facility/requisitions/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 0)

    def test_direct_status_edit_is_blocked(self):
        created = self._create()
        patched = self.client.patch(
            f"/api/v1/facility/requisitions/{created.data['id']}/",
            {'status': 'approved'}, format='json', **self.headers,
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        # Status is read-only: the patch is ignored and the record stays a draft.
        self.assertEqual(patched.data['status'], 'draft')
        requisition = RepairRequisition.objects.get(pk=created.data['id'])
        self.assertEqual(requisition.status, RepairRequisition.Status.DRAFT)


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class IncidentMemoApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='memo-user', password='test')
        self.organization = Organization.objects.create(name='Memo Client', slug='memo-client')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True, is_organization_admin=True)
        Subscription.objects.create(organization=self.organization, module=Module.FACILITY, status=Subscription.Status.ACTIVE)
        self.property = Property.objects.create(organization=self.organization, code='P1', name='Memo Building')
        self.incident = FacilityIncident.objects.create(
            organization=self.organization, reference='INC-TEST-001', property=self.property,
            location='Gate house', occurred_at=timezone.now(), category='Break-in',
            severity=FacilityIncident.Severity.HIGH, status=FacilityIncident.Status.SUBMITTED,
            narrative='Night guard reported forced entry at the gate house around 2am.',
            immediate_action='Police notified; site secured.',
            recommended_action='Install floodlights and reinforce the gate padlock.',
            reported_by=self.user,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def test_incident_memo_generates_branded_pdf(self):
        response = self.client.get(f'/api/v1/facility/incidents/{self.incident.id}/memo/', **self.headers)
        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn('incident-memo-INC-TEST-001', response['Content-Disposition'])
        self.assertTrue(response.content.startswith(b'%PDF-'))
        self.assertGreater(len(response.content), 2000)


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class SupplierInvoiceApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='sin-user', password='test')
        self.organization = Organization.objects.create(name='SIN Client', slug='sin-client')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True, is_organization_admin=True)
        Subscription.objects.create(organization=self.organization, module=Module.FACILITY, status=Subscription.Status.ACTIVE)
        self.property = Property.objects.create(organization=self.organization, code='P1', name='SIN Building')
        self.supplier = Contractor.objects.create(
            organization=self.organization, code='SUP-1', name='Acme Repairs', specialty='Plumbing',
        )
        self.work_order = WorkOrder.objects.create(
            organization=self.organization, number='WO-SIN-1', title='Pump replacement', category='Plumbing',
            property=self.property, reported_by=self.user, status=WorkOrder.Status.COMPLETED,
            supervisor_verified=True, reported_at=timezone.now(),
            labor_cost=Decimal('10000'), parts_cost=Decimal('20000'),
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def _create(self, **overrides):
        payload = {
            'property': str(self.property.id),
            'supplier': str(self.supplier.id),
            'supplier_invoice_number': 'INV-ACME-001',
            'classification': 'repair',
            'work_order': str(self.work_order.id),
            'description': 'Pump replacement as per WO-SIN-1.',
            'subtotal': '30000.00',
            'vat_rate': '16.00',
            'vat_amount': '4800.00',
            'total': '34800.00',
            'cost_centre': 'FM-MAINT',
        }
        payload.update(overrides)
        return self.client.post('/api/v1/facility/supplier-invoices/', payload, format='json', **self.headers)

    def test_duplicate_supplier_invoice_number_is_rejected(self):
        first = self._create()
        self.assertEqual(first.status_code, 201, first.data)
        duplicate = self._create()
        self.assertEqual(duplicate.status_code, 400)
        self.assertIn('supplier_invoice_number', duplicate.data)

    def test_full_invoice_lifecycle_to_paid(self):
        created = self._create()
        self.assertEqual(created.status_code, 201, created.data)
        self.assertTrue(created.data['code'].startswith('SIN-'))
        invoice_id = created.data['id']

        submitted = self.client.post(f'/api/v1/facility/supplier-invoices/{invoice_id}/submit/', {}, format='json', **self.headers)
        self.assertEqual(submitted.status_code, 200, submitted.data)
        self.assertEqual(submitted.data['status'], 'submitted')

        verified = self.client.post(f'/api/v1/facility/supplier-invoices/{invoice_id}/verify/', {}, format='json', **self.headers)
        self.assertEqual(verified.status_code, 200, verified.data)
        self.assertEqual(verified.data['status'], 'verified')
        # Verified WO value 30000 vs invoice total 34800 → variance 4800
        self.assertEqual(verified.data['work_order_value'], Decimal('30000.00'))
        self.assertEqual(verified.data['variance'], Decimal('4800.00'))

        approved = self.client.post(f'/api/v1/facility/supplier-invoices/{invoice_id}/approve/', {}, format='json', **self.headers)
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data['status'], 'approved')

        processing = self.client.post(f'/api/v1/facility/supplier-invoices/{invoice_id}/start-payment/', {}, format='json', **self.headers)
        self.assertEqual(processing.status_code, 200, processing.data)

        missing_ref = self.client.post(f'/api/v1/facility/supplier-invoices/{invoice_id}/mark-paid/', {}, format='json', **self.headers)
        self.assertEqual(missing_ref.status_code, 400)
        paid = self.client.post(f'/api/v1/facility/supplier-invoices/{invoice_id}/mark-paid/', {'payment_reference': 'RTGS-8891'}, format='json', **self.headers)
        self.assertEqual(paid.status_code, 200, paid.data)
        self.assertEqual(paid.data['status'], 'paid')
        self.assertEqual(paid.data['payment_reference'], 'RTGS-8891')

    def test_repair_invoice_requires_work_order_on_submit(self):
        created = self._create(work_order=None)
        self.assertEqual(created.status_code, 201, created.data)
        submitted = self.client.post(f"/api/v1/facility/supplier-invoices/{created.data['id']}/submit/", {}, format='json', **self.headers)
        self.assertEqual(submitted.status_code, 400)
        self.assertIn('work_order', submitted.data)

    def test_unverified_work_order_requires_exception_to_approve(self):
        self.work_order.supervisor_verified = False
        self.work_order.save(update_fields=('supervisor_verified', 'updated_at'))
        created = self._create()
        invoice_id = created.data['id']
        self.client.post(f'/api/v1/facility/supplier-invoices/{invoice_id}/submit/', {}, format='json', **self.headers)
        self.client.post(f'/api/v1/facility/supplier-invoices/{invoice_id}/verify/', {}, format='json', **self.headers)
        blocked = self.client.post(f'/api/v1/facility/supplier-invoices/{invoice_id}/approve/', {}, format='json', **self.headers)
        self.assertEqual(blocked.status_code, 400)
        self.assertIn('exception', blocked.data)
        approved = self.client.post(f'/api/v1/facility/supplier-invoices/{invoice_id}/approve/', {
            'exception': True, 'exception_notes': 'Emergency repair; verified on site by manager.',
        }, format='json', **self.headers)
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertTrue(approved.data['exception_approved'])


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class ProcurementFinanceWorkflowApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='procurement-manager', password='test')
        self.organization = Organization.objects.create(name='Procurement Client', slug='procurement-client')
        Membership.objects.create(user=self.user, organization=self.organization, is_default=True, is_organization_admin=True)
        Subscription.objects.create(organization=self.organization, module=Module.FACILITY, status=Subscription.Status.ACTIVE)
        self.property = Property.objects.create(organization=self.organization, code='PROC-1', name='Procurement House')
        self.bidder = Contractor.objects.create(organization=self.organization, code='BID-1', name='Reliable Engineering', specialty='Mechanical')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}

    def _approved_requisition(self):
        requisition = RepairRequisition.objects.create(
            organization=self.organization, code='RQR-PROC-1', property=self.property,
            title='Replace booster pump', issue_description='Pump failed', required_repair='Supply and install booster pump',
            estimated_cost=Decimal('100000'), requester=self.user, status=RepairRequisition.Status.APPROVED,
        )
        return requisition

    def test_approved_requisition_flows_through_award_lpo_and_verified_job_card(self):
        requisition = self._approved_requisition()
        requisition_pdf = self.client.get(f'/api/v1/facility/requisitions/{requisition.id}/pdf/', **self.headers)
        self.assertEqual(requisition_pdf.status_code, 200)
        self.assertTrue(requisition_pdf.content.startswith(b'%PDF-'))
        created = self.client.post('/api/v1/facility/procurements/', {'requisition': str(requisition.id)}, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        procurement_id = created.data['id']
        quote = self.client.post(f'/api/v1/facility/procurements/{procurement_id}/add-quotation/', {
            'bidder': str(self.bidder.id), 'quotation_number': 'Q-001', 'quoted_on': '2026-08-27',
            'lead_time_days': 3, 'subtotal': '100000.00', 'vat_amount': '16000.00', 'total': '116000.00',
        }, format='json', **self.headers)
        self.assertEqual(quote.status_code, 201, quote.data)
        award = self.client.post(f'/api/v1/facility/procurements/{procurement_id}/award/', {
            'quotation': quote.data['id'], 'reason': 'Best evaluated compliant bid',
        }, format='json', **self.headers)
        self.assertEqual(award.status_code, 200, award.data)
        evaluation_pdf = self.client.get(f'/api/v1/facility/procurements/{procurement_id}/evaluation-pdf/', **self.headers)
        self.assertEqual(evaluation_pdf.status_code, 200)
        self.assertTrue(evaluation_pdf.content.startswith(b'%PDF-'))
        lpo = self.client.post(f'/api/v1/facility/procurements/{procurement_id}/issue-lpo/', {
            'delivery_date': '2026-09-05', 'payment_terms': '30 days after verified completion',
        }, format='json', **self.headers)
        self.assertEqual(lpo.status_code, 201, lpo.data)
        card = self.client.post(f"/api/v1/facility/lpos/{lpo.data['id']}/generate-job-card/", {}, format='json', **self.headers)
        self.assertEqual(card.status_code, 201, card.data)
        card_url = f"/api/v1/facility/job-cards/{card.data['id']}/"
        self.assertEqual(self.client.post(f'{card_url}start/', {}, format='json', **self.headers).status_code, 200)
        signed = self.client.post(f'{card_url}contractor-sign/', {
            'signatory': 'Site Engineer', 'completion_notes': 'Installed and pressure tested', 'evidence_urls': ['https://example.test/proof.jpg'],
        }, format='json', **self.headers)
        self.assertEqual(signed.status_code, 200, signed.data)
        caretaker = self.client.post(f'{card_url}caretaker-sign/', {'signatory': 'Caretaker'}, format='json', **self.headers)
        self.assertEqual(caretaker.status_code, 200, caretaker.data)
        verified = self.client.post(f'{card_url}verify/', {'notes': 'Work accepted'}, format='json', **self.headers)
        self.assertEqual(verified.status_code, 200, verified.data)
        self.assertTrue(verified.data['ticket_closure_eligible'])
        job_card = FacilityJobCard.objects.get(pk=card.data['id'])
        self.assertTrue(job_card.work_order.supervisor_verified)
        self.assertEqual(ProcurementRecord.objects.get(pk=procurement_id).status, ProcurementRecord.Status.VERIFIED)
        for document_url in (f"/api/v1/facility/lpos/{lpo.data['id']}/pdf/", f'{card_url}pdf/'):
            document = self.client.get(document_url, **self.headers)
            self.assertEqual(document.status_code, 200)
            self.assertEqual(document['Content-Type'], 'application/pdf')
            self.assertTrue(document.content.startswith(b'%PDF-'))

        voucher = self.client.post('/api/v1/facility/petty-cash-vouchers/', {
            'lpo': lpo.data['id'], 'job_card': card.data['id'],
            'recipients': [
                {'name': 'John Mwangi', 'identity': 'ID-123 / 0700000001', 'role': 'Technician', 'amount': '70000.00'},
                {'name': 'Amina Ali', 'identity': 'ID-456 / 0700000002', 'role': 'Assistant', 'amount': '30000.00'},
            ],
        }, format='json', **self.headers)
        self.assertEqual(voucher.status_code, 201, voucher.data)
        self.assertEqual(Decimal(voucher.data['total_amount']), Decimal('100000.00'))
        base = f"/api/v1/facility/petty-cash-vouchers/{voucher.data['id']}/"
        self.assertEqual(self.client.post(f'{base}submit/', {}, format='json', **self.headers).status_code, 200)
        self.assertEqual(self.client.post(f'{base}approve/', {}, format='json', **self.headers).status_code, 200)
        voucher_pdf = self.client.get(f'{base}pdf/', **self.headers)
        self.assertEqual(voucher_pdf.status_code, 200)
        self.assertTrue(voucher_pdf.content.startswith(b'%PDF-'))
        paid = self.client.post(f'{base}mark-paid/', {
            'payment_reference': 'PC-001', 'signed_voucher_url': 'https://example.test/signed-voucher.pdf',
        }, format='json', **self.headers)
        self.assertEqual(paid.status_code, 200, paid.data)
        posted = self.client.post(f'{base}post-expense/', {}, format='json', **self.headers)
        self.assertEqual(posted.status_code, 200, posted.data)
        self.assertEqual(posted.data['status'], 'posted')

    def test_independent_payment_request_posts_payment_and_expense(self):
        created = self.client.post('/api/v1/facility/payment-requests/', {
            'property': str(self.property.id), 'category': 'licence', 'payee': 'County Government',
            'description': 'Annual business permit', 'amount': '25000.00', 'due_date': '2026-09-01',
            'statutory_reference': 'LIC-2026', 'supporting_documents': ['https://example.test/licence.pdf'],
        }, format='json', **self.headers)
        self.assertEqual(created.status_code, 201, created.data)
        base = f"/api/v1/facility/payment-requests/{created.data['id']}/"
        for action in ('submit', 'approve', 'start-processing'):
            response = self.client.post(f'{base}{action}/', {}, format='json', **self.headers)
            self.assertEqual(response.status_code, 200, response.data)
        paid = self.client.post(f'{base}mark-paid/', {'payment_reference': 'BANK-001'}, format='json', **self.headers)
        self.assertEqual(paid.status_code, 200, paid.data)
        self.assertEqual(paid.data['status'], FinancePaymentRequest.Status.PAID)
        record = FacilityPaymentRecord.objects.get(payment_request_id=created.data['id'])
        self.assertEqual(record.reference, 'BANK-001')
        self.assertIsNotNone(record.expense_id)

    def test_recurring_invoice_requires_caretaker_and_manager_appraisal(self):
        profile = ServiceProfile.objects.create(
            organization=self.organization, code='SVC-CLEAN', name='Cleaning', category='Cleaning',
            service_type=ServiceProfile.ServiceType.ROUTINE, description='Daily cleaning', created_by=self.user,
        )
        profile.properties.add(self.property)
        ContractorContract.objects.create(
            organization=self.organization, contractor=self.bidder, property=self.property,
            contract_number='CTR-001', scope_of_work='Cleaning', contract_value=Decimal('120000'),
            start_date='2026-01-01', end_date='2026-12-31', status='active',
        )
        invoice = self.client.post('/api/v1/facility/supplier-invoices/', {
            'property': str(self.property.id), 'supplier': str(self.bidder.id),
            'supplier_invoice_number': 'CLEAN-AUG', 'classification': 'recurring',
            'service_profile': str(profile.id), 'service_period_start': '2026-08-01', 'service_period_end': '2026-08-31',
            'description': 'August cleaning', 'subtotal': '10000.00', 'vat_rate': '16.00',
            'vat_amount': '1600.00', 'total': '11600.00',
        }, format='json', **self.headers)
        self.assertEqual(invoice.status_code, 201, invoice.data)
        appraisal = ContractInvoiceAppraisal.objects.get(invoice_id=invoice.data['id'])
        signed = self.client.post(f'/api/v1/facility/contract-invoice-appraisals/{appraisal.id}/caretaker-sign/', {
            'quality_score': 5, 'timeliness_score': 4, 'responsiveness_score': 5, 'notes': 'Service delivered',
        }, format='json', **self.headers)
        self.assertEqual(signed.status_code, 200, signed.data)
        approved = self.client.post(f'/api/v1/facility/contract-invoice-appraisals/{appraisal.id}/manager-approve/', {}, format='json', **self.headers)
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data['status'], ContractInvoiceAppraisal.Status.APPROVED)
        appraisal_pdf = self.client.get(f'/api/v1/facility/contract-invoice-appraisals/{appraisal.id}/pdf/', **self.headers)
        self.assertEqual(appraisal_pdf.status_code, 200)
        self.assertTrue(appraisal_pdf.content.startswith(b'%PDF-'))
