from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from organizations.models import Membership, MembershipRole, Organization, Permission, Role
from properties.models import Property

User = get_user_model()

LEGEND_USERS = [
    ("sharon", "Legend-Sharon", "Sharon", "Property Manager"),
    ("lydia", "Legend-Lydia", "Lydia", "Property Manager"),
    ("abel", "Legend-Abel", "Abel", "Property Manager"),
    ("brian", "Legend-Brian", "Brian", "Property Manager"),
    ("merrylyn", "Legend-Merrylyn", "Merrylyn", "Property Manager"),
]


class Command(BaseCommand):
    help = "Safely ensures Sharon, Lydia, Abel, Brian, Merrylyn exist with proper credentials and property assignments without altering existing data."

    def handle(self, *args, **options):
        org = Organization.objects.filter(slug__icontains="legend").first()
        if not org:
            org = Organization.objects.filter(name__icontains="Legend").first()
        if not org:
            self.stderr.write("Legend organization not found.")
            return

        self.stdout.write(f"Configuring team for organization: {org.name} ({org.id})")

        # Find or create Property Manager role in this organization
        pm_role, _ = Role.objects.get_or_create(
            organization=org,
            slug="property-manager",
            defaults={
                "name": "Property Manager",
                "description": "Full Property, Facility and Companion operations without platform administration.",
                "is_system": True,
            },
        )

        # Ensure all standard permissions are assigned to PM role
        all_perms = Permission.objects.filter(
            key__in=[
                "property.view", "property.manage", "property.approve", "property.report",
                "property.operations", "property.leasing", "property.finance",
                "facility.view", "facility.manage", "facility.approve", "facility.report",
                "facility.work", "facility.inspect", "facility.administer",
                "companion.view", "companion.manage", "companion.approve", "companion.assign",
            ]
        )
        pm_role.permissions.set(all_perms)

        # Get all properties for this organization
        org_properties = list(Property.objects.filter(organization=org))
        self.stdout.write(f"Organization properties: {[p.name for p in org_properties]}")

        for username, password, first_name, role_title in LEGEND_USERS:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "first_name": first_name,
                    "last_name": "",
                    "email": f"{username}@propertylegend.com",
                    "is_active": True,
                    "is_staff": False,
                    "is_superuser": False,
                },
            )
            user.set_password(password)
            user.first_name = first_name
            user.is_active = True
            user.save()

            membership, _ = Membership.objects.update_or_create(
                organization=org,
                user=user,
                defaults={
                    "status": Membership.Status.ACTIVE,
                    "is_default": True,
                    "is_organization_admin": False,
                },
            )
            membership.status = Membership.Status.ACTIVE
            membership.save()

            # Assign role
            membership.roles.set([pm_role])

            # Assign to all properties in organization
            if org_properties:
                membership.assigned_properties.set(org_properties)

            self.stdout.write(
                self.style.SUCCESS(
                    f"✓ User '{username}' configured. Active: True, Role: {pm_role.name}, Properties: {[p.name for p in membership.assigned_properties.all()]}"
                )
            )

        self.stdout.write(self.style.SUCCESS("Legend team configuration completed successfully."))
