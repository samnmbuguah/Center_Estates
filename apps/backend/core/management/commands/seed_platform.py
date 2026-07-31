import os
from decimal import Decimal
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from core.models import Module
from facilities.models import Contractor, FacilityAsset, Inspection, MeterReading, PreventiveSchedule, ServiceRequest, UtilityMeter, WorkOrder
from organizations.models import Membership, Organization, Permission, Role
from properties.models import (
    Building, Budget, Expense, Invoice, Lease, Project, Property, Receipt,
    ServiceCharge, Tenant, Unit,
)
from sales.models import AgentCommission, Buyer, Installment, PropertySale, SaleDocument, SaleListing, SalePayment, SiteVisit
from subscriptions.models import Subscription


class Command(BaseCommand):
    help = 'Create idempotent platform demo/admin data for development and acceptance testing.'

    def handle(self, *args, **options):
        password = os.environ.get('SEED_ADMIN_PASSWORD')
        if not password:
            raise CommandError('SEED_ADMIN_PASSWORD is required.')
        username = os.environ.get('SEED_ADMIN_USERNAME', 'admin')
        user, _ = get_user_model().objects.get_or_create(username=username)
        user.is_staff = True
        user.is_superuser = True
        user.set_password(password)
        user.save()

        organization, _ = Organization.objects.update_or_create(
            slug='center-estates-demo',
            defaults={'name': 'Center Estates Demo', 'is_active': True, 'domain': 'erp.169-58-102-217.sslip.io'},
        )
        Membership.objects.update_or_create(
            organization=organization, user=user,
            defaults={'is_default': True, 'is_organization_admin': True, 'status': Membership.Status.ACTIVE},
        )
        for module, _label in Module.choices:
            Subscription.objects.update_or_create(
                organization=organization, module=module,
                defaults={'is_active': True, 'status': Subscription.Status.ACTIVE},
            )

        permission, _ = Permission.objects.get_or_create(
            key='property.manage', defaults={'label': 'Manage properties', 'module': Module.PROPERTY}
        )
        role, _ = Role.objects.get_or_create(
            organization=organization, slug='platform-admin', defaults={'name': 'Platform Administrator', 'is_system': True}
        )
        role.permissions.add(permission)

        prop, _ = Property.objects.update_or_create(
            organization=organization, code='CE-NRB-001',
            defaults={'name': 'Westlands Business Centre', 'property_type': 'Commercial', 'status': Property.Status.ACTIVE, 'city': 'Nairobi'},
        )
        building, _ = Building.objects.update_or_create(
            organization=organization, property=prop, code='TOWER-A',
            defaults={'name': 'Tower A', 'floors': 12},
        )
        units = {}
        for number, unit_type, area, status in (
            (101, 'Office', '125.00', Unit.Status.OCCUPIED),
            (102, 'Retail', '84.50', Unit.Status.OCCUPIED),
            (201, 'Office', '140.00', Unit.Status.AVAILABLE),
            (301, 'Office', '155.00', Unit.Status.AVAILABLE),
        ):
            units[number], _ = Unit.objects.update_or_create(
                organization=organization, property=prop, code=str(number),
                defaults={
                    'building': building, 'floor': str(number)[0], 'unit_type': unit_type,
                    'area': Decimal(area), 'status': status,
                },
            )
        project, _ = Project.objects.update_or_create(
            organization=organization, code='CE-REFURB-01',
            defaults={'name': 'Tower A Refurbishment', 'property': prop, 'status': Project.Status.ACTIVE},
        )

        today = timezone.localdate()
        tenant_one, _ = Tenant.objects.update_or_create(
            organization=organization, code='TEN-001',
            defaults={
                'name': 'Acacia Consulting Ltd', 'tenant_type': 'company',
                'email': 'accounts@acacia.example', 'phone': '+254 700 111 222',
                'tax_id': 'P051234567A', 'status': Tenant.Status.ACTIVE,
                'billing_address': 'Westlands, Nairobi',
            },
        )
        tenant_two, _ = Tenant.objects.update_or_create(
            organization=organization, code='TEN-002',
            defaults={
                'name': 'Bluebird Retail Kenya', 'tenant_type': 'company',
                'email': 'finance@bluebird.example', 'phone': '+254 711 333 444',
                'status': Tenant.Status.ACTIVE, 'billing_address': 'Parklands, Nairobi',
            },
        )
        lease_one, _ = Lease.objects.update_or_create(
            organization=organization, reference='LS-2026-001',
            defaults={
                'unit': units[101], 'tenant': tenant_one,
                'starts_on': today - timedelta(days=180), 'ends_on': today + timedelta(days=550),
                'monthly_rent': Decimal('185000.00'), 'deposit': Decimal('370000.00'),
                'escalation_percent': Decimal('7.50'), 'billing_day': 1, 'status': Lease.Status.ACTIVE,
            },
        )
        lease_two, _ = Lease.objects.update_or_create(
            organization=organization, reference='LS-2025-014',
            defaults={
                'unit': units[102], 'tenant': tenant_two,
                'starts_on': today - timedelta(days=330), 'ends_on': today + timedelta(days=35),
                'monthly_rent': Decimal('120000.00'), 'deposit': Decimal('240000.00'),
                'escalation_percent': Decimal('5.00'), 'billing_day': 5, 'status': Lease.Status.EXPIRING,
            },
        )
        invoice_one, _ = Invoice.objects.update_or_create(
            organization=organization, number='INV-2026-0701',
            defaults={
                'lease': lease_one, 'invoice_type': 'rent', 'issued_on': today - timedelta(days=30),
                'due_on': today - timedelta(days=23), 'amount': Decimal('185000.00'),
                'balance': Decimal('0.00'), 'status': Invoice.Status.PAID,
            },
        )
        Invoice.objects.update_or_create(
            organization=organization, number='INV-2026-0702',
            defaults={
                'lease': lease_two, 'invoice_type': 'rent', 'issued_on': today - timedelta(days=30),
                'due_on': today - timedelta(days=20), 'amount': Decimal('120000.00'),
                'balance': Decimal('120000.00'), 'status': Invoice.Status.OVERDUE,
            },
        )
        Receipt.objects.update_or_create(
            organization=organization, number='RCT-2026-0418',
            defaults={
                'tenant': tenant_one, 'invoice': invoice_one, 'received_on': today - timedelta(days=25),
                'amount': Decimal('185000.00'), 'payment_method': 'bank_transfer',
                'external_reference': 'FT260418ACACIA', 'received_by': user,
            },
        )
        Expense.objects.update_or_create(
            organization=organization, property=prop, invoice_number='EXP-POWER-0726',
            defaults={
                'supplier': 'Nairobi Power Services', 'category': 'Utilities',
                'incurred_on': today - timedelta(days=12), 'amount': Decimal('68500.00'),
                'status': Expense.Status.APPROVED, 'description': 'Common-area electricity and generator service.',
            },
        )
        Budget.objects.update_or_create(
            organization=organization, property=prop, year=today.year, category='Repairs & maintenance',
            defaults={'amount': Decimal('2400000.00')},
        )
        ServiceCharge.objects.update_or_create(
            organization=organization, property=prop, name=f'{today.year} Commercial Service Charge',
            defaults={
                'method': ServiceCharge.Method.AREA, 'annual_budget': Decimal('3600000.00'),
                'starts_on': today.replace(month=1, day=1), 'is_active': True,
            },
        )
        contractor, _ = Contractor.objects.update_or_create(
            organization=organization, code='CTR-001',
            defaults={
                'name': 'AquaFix Services Ltd', 'specialty': 'Plumbing & drainage',
                'contact_name': 'Miriam Wanjiku', 'email': 'service@aquafix.example',
                'phone': '+254 722 555 100', 'status': Contractor.Status.ACTIVE,
                'rating': Decimal('4.70'), 'insurance_expires_on': today + timedelta(days=240),
                'license_expires_on': today + timedelta(days=150),
            },
        )
        lift, _ = FacilityAsset.objects.update_or_create(
            organization=organization, code='LFT-TA-01',
            defaults={
                'name': 'Tower A Passenger Lift 1', 'category': 'Mechanical', 'property': prop,
                'building': building, 'manufacturer': 'KONE', 'model_number': 'MonoSpace 500',
                'serial_number': 'KNE-22190', 'installed_on': today - timedelta(days=730),
                'warranty_expires_on': today + timedelta(days=365), 'purchase_value': Decimal('8400000.00'),
                'condition': FacilityAsset.Condition.GOOD, 'is_active': True,
            },
        )
        generator, _ = FacilityAsset.objects.update_or_create(
            organization=organization, code='GEN-TA-01',
            defaults={
                'name': 'Tower A Standby Generator', 'category': 'Electrical', 'property': prop,
                'building': building, 'manufacturer': 'Cummins', 'model_number': 'C275D5',
                'serial_number': 'CMN-77501', 'purchase_value': Decimal('5700000.00'),
                'condition': FacilityAsset.Condition.FAIR, 'is_active': True,
            },
        )
        work_order, _ = WorkOrder.objects.update_or_create(
            organization=organization, number='WO-2026-1787',
            defaults={
                'title': 'Water leakage near lift lobby', 'description': 'Investigate and repair leaking cold-water pipe joint.',
                'category': 'Plumbing & drainage', 'property': prop, 'asset': lift, 'contractor': contractor,
                'assigned_to': user, 'reported_by': user, 'priority': WorkOrder.Priority.HIGH,
                'status': WorkOrder.Status.IN_PROGRESS, 'reported_at': timezone.now() - timedelta(days=1),
                'response_due_at': timezone.now() - timedelta(hours=18),
                'resolution_due_at': timezone.now() + timedelta(hours=5), 'scheduled_for': timezone.now(),
                'labor_cost': Decimal('2500.00'), 'parts_cost': Decimal('2470.00'),
                'other_cost': Decimal('300.00'), 'progress': 60,
            },
        )
        WorkOrder.objects.update_or_create(
            organization=organization, number='WO-2026-1789',
            defaults={
                'title': 'Generator preventive service overdue', 'category': 'Electrical',
                'property': prop, 'asset': generator, 'assigned_to': user, 'reported_by': user,
                'priority': WorkOrder.Priority.CRITICAL, 'status': WorkOrder.Status.ASSIGNED,
                'reported_at': timezone.now() - timedelta(days=3),
                'response_due_at': timezone.now() - timedelta(days=2),
                'resolution_due_at': timezone.now() - timedelta(hours=6), 'progress': 15,
            },
        )
        PreventiveSchedule.objects.update_or_create(
            organization=organization, code='PM-LIFT-MONTHLY',
            defaults={
                'name': 'Monthly lift safety service', 'asset': lift,
                'frequency': PreventiveSchedule.Frequency.MONTHLY,
                'last_completed_on': today - timedelta(days=32), 'next_due_on': today - timedelta(days=2),
                'estimated_hours': Decimal('3.00'), 'instructions': 'Inspect brakes, doors, controls and emergency communication.',
            },
        )
        PreventiveSchedule.objects.update_or_create(
            organization=organization, code='PM-GEN-QUARTERLY',
            defaults={
                'name': 'Quarterly generator service', 'asset': generator,
                'frequency': PreventiveSchedule.Frequency.QUARTERLY,
                'last_completed_on': today - timedelta(days=55), 'next_due_on': today + timedelta(days=35),
                'estimated_hours': Decimal('5.00'), 'instructions': 'Load test, change filters and inspect starter batteries.',
            },
        )
        Inspection.objects.update_or_create(
            organization=organization, reference='INS-2026-0081',
            defaults={
                'title': 'Monthly fire and life safety inspection', 'inspection_type': 'Safety',
                'property': prop, 'inspector': user, 'scheduled_on': today - timedelta(days=5),
                'completed_on': today - timedelta(days=5), 'status': Inspection.Status.FOLLOW_UP,
                'score': Decimal('86.00'), 'findings': 'One fire extinguisher service tag has expired.',
                'violations': 1, 'follow_up_work_order': work_order,
            },
        )
        ServiceRequest.objects.update_or_create(
            organization=organization, reference='SR-2026-00123',
            defaults={
                'subject': 'Water leakage reported', 'description': 'Water dripping near the basement lift lobby.',
                'category': 'Plumbing', 'property': prop, 'unit': units[101], 'tenant': tenant_one,
                'status': ServiceRequest.Status.IN_PROGRESS, 'priority': WorkOrder.Priority.HIGH,
                'submitted_at': timezone.now() - timedelta(days=1),
                'response_due_at': timezone.now() - timedelta(hours=18), 'work_order': work_order,
            },
        )
        meter, _ = UtilityMeter.objects.update_or_create(
            organization=organization, code='ELC-TA-MAIN',
            defaults={
                'name': 'Tower A Main Electricity Meter', 'property': prop,
                'utility_type': UtilityMeter.Utility.ELECTRICITY, 'unit': 'kWh',
                'tariff': Decimal('27.4500'), 'is_active': True,
            },
        )
        MeterReading.objects.update_or_create(
            organization=organization, meter=meter, read_at=timezone.now().replace(minute=0, second=0, microsecond=0),
            defaults={
                'value': Decimal('198420.000'), 'consumption': Decimal('1245.000'),
                'cost': Decimal('34175.25'), 'is_anomaly': False,
            },
        )
        listing_one, _ = SaleListing.objects.update_or_create(
            organization=organization, unit=units[201],
            defaults={
                'project': project, 'list_price': Decimal('28500000.00'),
                'minimum_deposit_percent': Decimal('20.00'), 'status': SaleListing.Status.RESERVED,
                'construction_progress': Decimal('72.00'), 'reservation_expires_at': timezone.now() + timedelta(days=14),
            },
        )
        listing_two, _ = SaleListing.objects.update_or_create(
            organization=organization, unit=units[301],
            defaults={
                'project': project, 'list_price': Decimal('19800000.00'),
                'minimum_deposit_percent': Decimal('15.00'), 'status': SaleListing.Status.AVAILABLE,
                'construction_progress': Decimal('72.00'),
            },
        )
        buyer, _ = Buyer.objects.update_or_create(
            organization=organization, reference='BUY-2026-0042',
            defaults={
                'full_name': 'Grace Wambui Njoroge', 'email': 'grace.wambui@example.com',
                'phone': '+254 712 808 424', 'id_number': '28910422', 'tax_number': 'A009281042L',
                'address': 'Kilimani, Nairobi', 'financing_type': 'bank', 'financier': 'Housing Finance Kenya',
                'status': Buyer.Status.ACTIVE, 'assigned_agent': user, 'confirmed_at': timezone.now() - timedelta(days=28),
            },
        )
        sale, _ = PropertySale.objects.update_or_create(
            organization=organization, reference='SALE-2026-0031',
            defaults={
                'buyer': buyer, 'listing': listing_one, 'agent': user,
                'agreed_price': Decimal('27800000.00'), 'reservation_fee': Decimal('250000.00'),
                'reserved_at': timezone.now() - timedelta(days=25), 'contracted_on': today - timedelta(days=14),
                'expected_completion_on': today + timedelta(days=250), 'status': PropertySale.Status.CONTRACTED,
            },
        )
        deposit, _ = Installment.objects.update_or_create(
            organization=organization, sale=sale, sequence=1,
            defaults={
                'description': '20% contract deposit', 'due_on': today - timedelta(days=10),
                'amount': Decimal('5560000.00'), 'paid_amount': Decimal('5560000.00'),
                'status': Installment.Status.PAID, 'milestone': 'Contract signing',
            },
        )
        Installment.objects.update_or_create(
            organization=organization, sale=sale, sequence=2,
            defaults={
                'description': 'Second construction installment', 'due_on': today + timedelta(days=45),
                'amount': Decimal('4170000.00'), 'paid_amount': Decimal('0.00'),
                'status': Installment.Status.UPCOMING, 'milestone': 'Roof slab completion',
            },
        )
        SalePayment.objects.update_or_create(
            organization=organization, reference='PAY-2026-0098',
            defaults={
                'sale': sale, 'installment': deposit, 'paid_on': today - timedelta(days=11),
                'amount': Decimal('5560000.00'), 'method': 'bank', 'external_reference': 'FT26201GWAM',
                'status': SalePayment.Status.VERIFIED, 'verified_by': user,
                'verified_at': timezone.now() - timedelta(days=10),
            },
        )
        SalePayment.objects.update_or_create(
            organization=organization, reference='PAY-2026-0106',
            defaults={
                'sale': sale, 'installment': None, 'paid_on': today,
                'amount': Decimal('250000.00'), 'method': 'paybill', 'external_reference': 'RGA4K8Z21P',
                'status': SalePayment.Status.PENDING,
            },
        )
        SiteVisit.objects.update_or_create(
            organization=organization, reference='VIS-2026-0155',
            defaults={
                'visitor_name': 'Daniel Otieno', 'email': 'daniel.otieno@example.com',
                'phone': '+254 723 515 515', 'project': project, 'interested_unit_type': 'Office',
                'introducing_agent': user, 'visited_at': timezone.now() - timedelta(days=2),
                'follow_up_on': today + timedelta(days=2), 'notes': 'Interested in upper-floor corner units.',
            },
        )
        AgentCommission.objects.update_or_create(
            organization=organization, reference='COM-2026-0029',
            defaults={
                'sale': sale, 'agent': user, 'rate_percent': Decimal('2.00'),
                'amount': Decimal('556000.00'), 'required_paid_percent': Decimal('20.00'),
                'status': AgentCommission.Status.ELIGIBLE,
            },
        )
        SaleDocument.objects.update_or_create(
            organization=organization, sale=sale, checksum='demo-sale-agreement-v1-sha256',
            defaults={
                'document_type': 'sale_agreement', 'title': 'Executed Agreement for Sale',
                'file_url': '', 'signed_on': today - timedelta(days=14), 'is_final': True,
            },
        )
        self.stdout.write(self.style.SUCCESS(f'Seeded platform data for {organization.name}.'))
