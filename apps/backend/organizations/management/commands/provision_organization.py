"""Super-admin command to provision a new tenant organization in Center Estates.

Example:
    python manage.py provision_organization \\
        --name "Apex Living Properties" \\
        --slug "apex-living" \\
        --admin-email "director@apexliving.co.ke" \\
        --admin-name "Jane Mwangi" \\
        --modules "property,sales,facility,companion"
"""

from django.core.management.base import BaseCommand, CommandError
from organizations.services import provision_new_organization


class Command(BaseCommand):
    help = "Provision a new tenant organization with standard roles, module subscriptions, and admin user."

    def add_arguments(self, parser):
        parser.add_argument("--name", required=True, help="Organization full name (e.g. 'Apex Living Properties')")
        parser.add_argument("--slug", required=True, help="Organization slug (e.g. 'apex-living')")
        parser.add_argument("--admin-email", required=True, help="Tenant Administrator email address")
        parser.add_argument("--admin-name", default="", help="Tenant Administrator full name")
        parser.add_argument("--admin-password", default="", help="Optional password for the administrator")
        parser.add_argument("--domain", default="", help="Optional custom domain (e.g. 'apexliving.co.ke')")
        parser.add_argument(
            "--modules",
            default="property,sales,facility,companion",
            help="Comma-separated module keys to activate (default: property,sales,facility,companion)",
        )

    def handle(self, *args, **options):
        name = options["name"]
        slug = options["slug"]
        admin_email = options["admin_email"]
        admin_name = options.get("admin_name", "")
        admin_password = options.get("admin_password", "")
        domain = options.get("domain", "")
        modules_raw = options.get("modules", "")
        modules = [m.strip().lower() for m in modules_raw.split(",") if m.strip()]

        try:
            result = provision_new_organization(
                name=name,
                slug=slug,
                admin_email=admin_email,
                admin_name=admin_name,
                admin_password=admin_password,
                modules=modules,
                domain=domain,
            )
        except ValueError as err:
            raise CommandError(str(err))

        org = result["organization"]
        admin = result["admin_user"]
        status_text = "Created" if result["created"] else "Updated"

        self.stdout.write(self.style.SUCCESS(f"Organization {status_text}: {org.name} [{org.slug}]"))
        self.stdout.write(self.style.SUCCESS(f"Admin User: {admin.email} (username: {admin.username})"))
        if result.get("temp_password"):
            self.stdout.write(self.style.WARNING(f"Generated Password: {result['temp_password']}"))
        self.stdout.write(self.style.SUCCESS(f"Active Modules: {', '.join(result['modules'])}"))
