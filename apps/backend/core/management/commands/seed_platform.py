import os
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from core.models import Module
from organizations.models import Membership, Organization, Permission, Role
from properties.models import Building, Project, Property, Unit
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
        for number, unit_type, area in ((101, 'Office', '125.00'), (102, 'Retail', '84.50'), (201, 'Office', '140.00')):
            Unit.objects.update_or_create(
                organization=organization, property=prop, code=str(number),
                defaults={'building': building, 'floor': str(number)[0], 'unit_type': unit_type, 'area': Decimal(area)},
            )
        Project.objects.update_or_create(
            organization=organization, code='CE-REFURB-01',
            defaults={'name': 'Tower A Refurbishment', 'property': prop, 'status': Project.Status.ACTIVE},
        )
        self.stdout.write(self.style.SUCCESS(f'Seeded platform data for {organization.name}.'))

