"""Additive-only seeder for the dedicated E2E test organisation.

This command NEVER deletes, updates or re-seeds existing data. It only:
  1. Creates (if missing) the "Center Estates Test" organisation.
  2. Ensures the standard embedded roles exist in that organisation.
  3. Creates (if missing) dedicated test users and memberships for that
     organisation.

Existing organisations, users, memberships and roles are left untouched.
The command is idempotent; passwords are only set when the user is first
created unless --reset-passwords is passed explicitly.
"""

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from organizations.models import Membership, Organization
from organizations.services import ensure_standard_roles_for_organization

TEST_ORG_NAME = "Center Estates Test"
TEST_ORG_SLUG = "center-estates-test"

TEST_ACCOUNTS = [
    # (username, role slug, is_organization_admin)
    ("e2e-admin", "platform-admin", True),
    ("e2e-property-manager", "property-manager", False),
    ("e2e-leasing-officer", "leasing-officer", False),
    ("e2e-property-accountant", "property-accountant", False),
    ("e2e-facility-manager", "facility-manager", False),
    ("e2e-facility-technician", "facility-technician", False),
    ("e2e-facility-occupant", "facility-occupant", False),
    ("e2e-sales-agent", "sales-agent", False),
    ("e2e-valuation-coordinator", "valuation-coordinator", False),
    ("e2e-operations-staff", "operations-staff", False),
    ("e2e-read-only", "read-only", False),
]

# Role slugs absent from STANDARD_BUSINESS_ROLES but still used by specific
# workspaces (e.g. the tenant portal). They are created in the test
# organisation with minimal permissions when missing.
EXTRA_ROLES = {
    "facility-occupant": ("Facility Occupant", "facility.view"),
}


class Command(BaseCommand):
    help = "Create the dedicated E2E test organisation and role accounts (additive only)."

    def add_arguments(self, parser):
        parser.add_argument("--reset-passwords", action="store_true", help="Force-set passwords on existing test users.")
        parser.add_argument("--password", help="Password for the test users (falls back to E2E_TEST_PASSWORD env).")

    def handle(self, *args, **options):
        User = get_user_model()
        password = options.get("password") or os.environ.get("E2E_TEST_PASSWORD") or None
        if not password:
            raise CommandError("A test password is required: pass --password or set E2E_TEST_PASSWORD.")

        org, org_created = Organization.objects.get_or_create(
            slug=TEST_ORG_SLUG,
            defaults={"name": TEST_ORG_NAME, "is_active": True},
        )
        self.stdout.write(self.style.SUCCESS(f"Organisation {'created' if org_created else 'found'}: {org.name} ({org.slug})"))

        ensure_standard_roles_for_organization(org)
        self.stdout.write(self.style.SUCCESS("Standard embedded roles ensured."))

        from organizations.models import Permission, Role

        for extra_slug, (extra_name, permission_key) in EXTRA_ROLES.items():
            role_obj, role_created = Role.objects.get_or_create(
                organization=org,
                slug=extra_slug,
                defaults={"name": extra_name, "is_system": True, "description": f"E2E-specific role for {extra_slug}."},
            )
            permission = Permission.objects.filter(key=permission_key).first()
            if permission is not None:
                role_obj.permissions.add(permission)
            if role_created:
                self.stdout.write(self.style.SUCCESS(f"Extra role created: {extra_slug}"))

        created_users, updated_passwords = [], []
        with transaction.atomic():
            for username, role_slug, is_org_admin in TEST_ACCOUNTS:
                user, user_created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        "email": f"{username}@centerestates.test",
                        "first_name": username.replace("-", " ").title(),
                        "is_active": True,
                        "is_staff": False,
                        "is_superuser": False,
                    },
                )
                if user_created:
                    created_users.append(username)
                if user_created or options["reset_passwords"]:
                    user.set_password(password)
                    user.save(update_fields=["password"])
                    updated_passwords.append(username)

                # Create the membership without claiming "default" up front:
                # a second default membership for the same user is invalid.
                membership, membership_created = Membership.objects.get_or_create(
                    user=user,
                    organization=org,
                    defaults={
                        "is_organization_admin": is_org_admin,
                        "status": Membership.Status.ACTIVE,
                    },
                )
                role = Role.objects.filter(organization=org, slug=role_slug).first()
                if role is not None:
                    membership.roles.add(role)
                if not Membership.objects.filter(user=user, is_default=True).exists():
                    membership.is_default = True
                    membership.save(update_fields=["is_default"])

        self.stdout.write(self.style.SUCCESS(f"Users created: {', '.join(created_users) or 'none (all existed)'}"))
        self.stdout.write(self.style.SUCCESS(f"Passwords set: {', '.join(updated_passwords) or 'none'}"))
        if updated_passwords:
            self.stdout.write(self.style.WARNING(f"Test password (set on the listed users): {password}"))
        self.stdout.write(self.style.SUCCESS("Done. No existing data was modified or removed."))
