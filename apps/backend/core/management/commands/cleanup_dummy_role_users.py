from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from organizations.models import Membership, MembershipRole, Organization, Permission, Role
from properties.models import Property

User = get_user_model()

REAL_USERS = [
    {
        "username": "admin",
        "password": "Legend-Admin",
        "first_name": "Admin",
        "last_name": "User",
        "email": "admin@centerestates.com",
        "is_superuser": True,
        "is_staff": True,
        "is_org_admin": True,
        "role_slug": "platform-admin",
        "role_name": "Platform Administrator",
    },
    {
        "username": "samuel",
        "password": "Legend-Admin",
        "first_name": "Samuel",
        "last_name": "N",
        "email": "samnmbuguah@gmail.com",
        "is_superuser": True,
        "is_staff": True,
        "is_org_admin": True,
        "role_slug": "platform-admin",
        "role_name": "Platform Administrator",
    },
    {
        "username": "sharon",
        "password": "Legend-Sharon",
        "first_name": "Sharon",
        "last_name": "",
        "email": "sharon@propertylegend.com",
        "is_superuser": False,
        "is_staff": False,
        "is_org_admin": False,
        "role_slug": "property-manager",
        "role_name": "Property Manager",
    },
    {
        "username": "lydia",
        "password": "Legend-Lydia",
        "first_name": "Lydia",
        "last_name": "",
        "email": "lydia@propertylegend.com",
        "is_superuser": False,
        "is_staff": False,
        "is_org_admin": False,
        "role_slug": "property-manager",
        "role_name": "Property Manager",
    },
    {
        "username": "abel",
        "password": "Legend-Abel",
        "first_name": "Abel",
        "last_name": "",
        "email": "abel@propertylegend.com",
        "is_superuser": False,
        "is_staff": False,
        "is_org_admin": False,
        "role_slug": "property-manager",
        "role_name": "Property Manager",
    },
    {
        "username": "brian",
        "password": "Legend-Brian",
        "first_name": "Brian",
        "last_name": "",
        "email": "brian@propertylegend.com",
        "is_superuser": False,
        "is_staff": False,
        "is_org_admin": False,
        "role_slug": "property-manager",
        "role_name": "Property Manager",
    },
    {
        "username": "merrylyn",
        "password": "Legend-Merrylyn",
        "first_name": "Merrylyn",
        "last_name": "",
        "email": "merrylyn@propertylegend.com",
        "is_superuser": False,
        "is_staff": False,
        "is_org_admin": False,
        "role_slug": "property-manager",
        "role_name": "Property Manager",
    },
]


class Command(BaseCommand):
    help = "Purges all 54 dummy 'role-*' user accounts and ensures only the 7 legitimate users exist with their exact passwords and roles."

    @transaction.atomic
    def handle(self, *args, **options):
        # 1. Reassign any records pointing to dummy users to admin
        admin_user, _ = User.objects.get_or_create(
            username="admin",
            defaults={
                "first_name": "Admin",
                "email": "admin@centerestates.com",
                "is_superuser": True,
                "is_staff": True,
            },
        )

        dummy_users = list(User.objects.filter(username__startswith="role-"))
        dummy_ids = [u.id for u in dummy_users]
        self.stdout.write(f"Found {len(dummy_users)} dummy role-* users to remove.")

        # Reassign all potential FK relations to admin
        from companion.models import Task, TaskTemplate
        from properties.models import BillingRun, Receipt, Invoice, Lease, Expense, BankTransaction, ReportExecution, TenantPortalAccess
        from facilities.models import WorkOrder, WorkOrderEvent, Inspection, ServiceRequest

        Task.objects.filter(assignee_id__in=dummy_ids).update(assignee=admin_user)
        Task.objects.filter(assigned_by_id__in=dummy_ids).update(assigned_by=admin_user)
        Task.objects.filter(delegated_to_id__in=dummy_ids).update(delegated_to=None)
        Task.objects.filter(delegated_from_id__in=dummy_ids).update(delegated_from=None)

        BillingRun.objects.filter(created_by_id__in=dummy_ids).update(created_by=admin_user)
        Receipt.objects.filter(received_by_id__in=dummy_ids).update(received_by=admin_user)
        WorkOrder.objects.filter(reported_by_id__in=dummy_ids).update(reported_by=admin_user)
        WorkOrderEvent.objects.filter(actor_id__in=dummy_ids).update(actor=admin_user)
        Inspection.objects.filter(inspector_id__in=dummy_ids).update(inspector=admin_user)
        ServiceRequest.objects.filter(decided_by_id__in=dummy_ids).update(decided_by=admin_user)
        ReportExecution.objects.filter(generated_by_id__in=dummy_ids).update(generated_by=admin_user)
        TenantPortalAccess.objects.filter(user_id__in=dummy_ids).delete()

        # Iterate all related models dynamically to ensure no ProtectedError is left
        for rel in User._meta.get_fields():
            if (rel.one_to_many or rel.one_to_one) and rel.auto_created and not rel.concrete:
                rel_model = rel.related_model
                fk_field = rel.field.name
                if rel_model == Membership:
                    continue
                try:
                    filter_kwargs = {f"{fk_field}__in": dummy_ids}
                    update_kwargs = {fk_field: admin_user}
                    count = rel_model.objects.filter(**filter_kwargs).update(**update_kwargs)
                    if count > 0:
                        self.stdout.write(f"Reassigned {count} {rel_model.__name__}.{fk_field} to admin.")
                except Exception as e:
                    self.stdout.write(f"Notice on {rel_model.__name__}: {e}")

        # Delete dummy memberships and users
        Membership.objects.filter(user_id__in=dummy_ids).delete()
        deleted_count, _ = User.objects.filter(id__in=dummy_ids).delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted_count} dummy user objects."))

        # 2. Configure the 7 authentic users
        organizations = list(Organization.objects.all())
        all_permissions = list(Permission.objects.all())

        for u_spec in REAL_USERS:
            user, created = User.objects.get_or_create(username=u_spec["username"])
            user.first_name = u_spec["first_name"]
            user.last_name = u_spec["last_name"]
            user.email = u_spec["email"]
            user.is_superuser = u_spec["is_superuser"]
            user.is_staff = u_spec["is_staff"]
            user.is_active = True
            user.set_password(u_spec["password"])
            user.save()

            for org in organizations:
                # Ensure appropriate role exists in this organization
                role, _ = Role.objects.get_or_create(
                    organization=org,
                    slug=u_spec["role_slug"],
                    defaults={
                        "name": u_spec["role_name"],
                        "description": f"{u_spec['role_name']} with standard default permissions.",
                        "is_system": True,
                    },
                )
                if u_spec["role_slug"] == "platform-admin":
                    role.permissions.set(all_permissions)
                else:
                    pm_perms = Permission.objects.filter(
                        key__in=[
                            "property.view", "property.manage", "property.approve", "property.report",
                            "property.operations", "property.leasing", "property.finance",
                            "facility.view", "facility.manage", "facility.approve", "facility.report",
                            "facility.work", "facility.inspect", "facility.administer",
                            "companion.view", "companion.manage", "companion.approve", "companion.assign",
                        ]
                    )
                    role.permissions.set(pm_perms)

                # Determine is_default cleanly
                is_default_org = False
                existing_default = Membership.objects.filter(user=user, is_default=True).exclude(organization=org).exists()
                if not existing_default:
                    is_default_org = True

                membership, _ = Membership.objects.update_or_create(
                    organization=org,
                    user=user,
                    defaults={
                        "status": Membership.Status.ACTIVE,
                        "is_default": is_default_org,
                        "is_organization_admin": u_spec["is_org_admin"],
                    },
                )
                membership.status = Membership.Status.ACTIVE
                membership.is_organization_admin = u_spec["is_org_admin"]
                membership.is_default = is_default_org
                membership.save()

                # Assign role
                membership.roles.set([role])

                # Assign all properties in this organization
                org_props = list(Property.objects.filter(organization=org))
                if org_props:
                    membership.assigned_properties.set(org_props)

            self.stdout.write(
                self.style.SUCCESS(
                    f"✓ User: {user.username} (Password: {u_spec['password']}) -> Role: {u_spec['role_name']}"
                )
            )

        final_users = list(User.objects.values_list("username", flat=True))
        self.stdout.write(self.style.SUCCESS(f"Total remaining users in system: {len(final_users)} -> {final_users}"))
