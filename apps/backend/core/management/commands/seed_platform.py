import os
from decimal import Decimal
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from core.models import Module
from organizations.models import Membership, Organization, Permission, Role
from properties.models import (
    Building, Budget, Expense, Invoice, Lease, Project, Property, Receipt,
    ServiceCharge, Tenant, Unit,
)
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
        ):
            units[number], _ = Unit.objects.update_or_create(
                organization=organization, property=prop, code=str(number),
                defaults={
                    'building': building, 'floor': str(number)[0], 'unit_type': unit_type,
                    'area': Decimal(area), 'status': status,
                },
            )
        Project.objects.update_or_create(
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
        self.stdout.write(self.style.SUCCESS(f'Seeded platform data for {organization.name}.'))
