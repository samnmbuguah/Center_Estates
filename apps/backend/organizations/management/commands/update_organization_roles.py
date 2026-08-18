from django.core.management.base import BaseCommand
from organizations.models import Organization
from organizations.services import ensure_standard_roles_for_organization


class Command(BaseCommand):
    help = 'Update all organization roles to use the new module access policy'

    def handle(self, *args, **options):
        self.stdout.write("Updating organization roles with new module access policy...")

        # Get all organizations
        organizations = Organization.objects.all()
        updated_count = 0

        for org in organizations:
            self.stdout.write(f"Processing organization: {org.name}")
            
            # Use the policy-driven role creation/update
            ensure_standard_roles_for_organization(org)
            updated_count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully updated {updated_count} organizations"))
