from django.core.management.base import BaseCommand
from organizations.models import Organization, Role, Membership
from organizations.services import ensure_standard_roles_for_organization


class Command(BaseCommand):
    help = 'Update Legend Management organization property managers with facility module access'

    def handle(self, *args, **options):
        self.stdout.write("Looking for Legend Management organization...")

        # Find Legend Management organization
        legend_org = Organization.objects.filter(name__icontains="legend").first()
        
        if not legend_org:
            self.stdout.write(self.style.WARNING("Legend Management organization not found"))
            return

        self.stdout.write(f"Found organization: {legend_org.name}")
        
        # Update all roles for this organization using the new policy
        ensure_standard_roles_for_organization(legend_org)
        
        # Count property managers in this organization
        property_manager_role = Role.objects.filter(
            organization=legend_org,
            slug='property-manager'
        ).first()
        
        if property_manager_role:
            property_managers = Membership.objects.filter(
                organization=legend_org,
                roles=property_manager_role
            ).count()
            
            self.stdout.write(f"Property managers in {legend_org.name}: {property_managers}")
            
            # Check permissions
            facility_perms = property_manager_role.permissions.filter(module='facility')
            companion_perms = property_manager_role.permissions.filter(module='companion')
            
            self.stdout.write(f"  - Facility permissions: {facility_perms.count()}")
            self.stdout.write(f"  - Companion permissions: {companion_perms.count()}")
            
            if facility_perms.exists() and companion_perms.exists():
                self.stdout.write(self.style.SUCCESS("✓ Property managers now have facility and companion access"))
            else:
                self.stdout.write(self.style.WARNING("⚠ Role permissions may not be fully updated"))
        else:
            self.stdout.write(self.style.WARNING("Property manager role not found in this organization"))

        self.stdout.write(self.style.SUCCESS("Legend Management organization update complete"))
