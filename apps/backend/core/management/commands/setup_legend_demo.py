import copy
import json
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from companion.models import Task, TaskTemplate
from core.models import Module
from facilities.models import (
    Contractor, FacilityAsset, Inspection, MeterReading, PreventiveSchedule,
    ServiceRequest, UtilityMeter, WorkOrder,
)
from organizations.models import Membership, MembershipRole, Organization, Permission, Role
from properties.models import (
    Budget, Building, Expense, Invoice, Lease, Property, Receipt, Tenant, Unit,
)
from subscriptions.models import Subscription


PEOPLE = ("sharon", "lydia", "abel", "brian", "merrylyn")
SOURCE_PROPERTY_CODES = ("CE-NRB-001", "CE-NRB-002", "CE-MSA-003")
ROLE_PERMISSIONS = (
    "property.view", "property.manage", "property.approve", "property.report",
    "property.operations", "property.leasing", "property.finance",
    "facility.view", "facility.manage", "facility.approve", "facility.report",
    "facility.work", "facility.inspect", "facility.administer",
    "companion.view", "companion.manage", "companion.approve", "companion.assign",
)


def clone_instance(instance, *, overrides=None, exclude=()):
    """Clone concrete fields while replacing tenant/user relations explicitly."""
    data = {}
    excluded = {"id", "created_at", "updated_at", *exclude}
    for field in instance._meta.concrete_fields:
        if field.primary_key or field.name in excluded:
            continue
        if getattr(field, "auto_now", False) or getattr(field, "auto_now_add", False):
            continue
        data[field.attname] = copy.deepcopy(getattr(instance, field.attname))
    data.update(overrides or {})
    return instance.__class__.objects.create(**data)


class Command(BaseCommand):
    help = "Create the isolated Legend Management Limited demo tenant and its manager accounts."

    def add_arguments(self, parser):
        parser.add_argument("--credentials", required=True, help="Path to a JSON object containing admin and named user passwords.")
        parser.add_argument("--source-organization", default="center-estates-demo")

    @transaction.atomic
    def handle(self, *args, **options):
        credential_path = Path(options["credentials"])
        if not credential_path.is_file():
            raise CommandError("The credentials JSON file does not exist.")
        credentials = json.loads(credential_path.read_text())
        required = {"admin", *PEOPLE}
        missing = sorted(key for key in required if not credentials.get(key))
        if missing:
            raise CommandError(f"Missing passwords for: {', '.join(missing)}")

        source = Organization.objects.filter(slug=options["source_organization"]).first()
        if not source:
            raise CommandError("The source demo organization does not exist.")

        admin = get_user_model().objects.filter(username="admin", is_superuser=True).first()
        if not admin:
            raise CommandError("The admin superuser does not exist.")
        admin.set_password(credentials["admin"])
        admin.save(update_fields=("password",))

        organization, _ = Organization.objects.update_or_create(
            slug="legend-management-limited",
            defaults={
                "name": "Legend Management Limited",
                "domain": "centerestates.com",
                "is_active": True,
                "settings": {
                    "branding": {
                        "company_name": "Legend Management Limited",
                        "logo_url": "/legend-site-logo.png",
                        "primary_color": "#5b153f",
                        "address": "Nairobi, Kenya",
                        "email": "info@propertylegend.com",
                        "phone": "",
                    },
                },
            },
        )
        for module in (Module.PROPERTY, Module.FACILITY, Module.COMPANION):
            Subscription.objects.update_or_create(
                organization=organization,
                module=module,
                defaults={"is_active": True, "status": Subscription.Status.ACTIVE},
            )
        organization.subscriptions.exclude(module__in=(Module.PROPERTY, Module.FACILITY, Module.COMPANION)).update(is_active=False)

        permission_labels = dict(Module.choices)
        permissions = []
        for key in ROLE_PERMISSIONS:
            module, action = key.split(".", 1)
            permission, _ = Permission.objects.update_or_create(
                key=key,
                defaults={
                    "label": f"{permission_labels[module]}: {action.replace('_', ' ').title()}",
                    "module": module,
                },
            )
            permissions.append(permission)
        role, _ = Role.objects.update_or_create(
            organization=organization,
            slug="property-manager",
            defaults={
                "name": "Property Manager",
                "description": "Full Property, Facility and Companion operations without platform administration or usage analytics.",
                "is_system": True,
            },
        )
        role.permissions.set(permissions)

        managers = {}
        for index, username in enumerate(PEOPLE):
            user, _ = get_user_model().objects.get_or_create(username=username)
            user.first_name = username.title()
            user.last_name = ""
            user.email = f"{username}@propertylegend.com"
            user.is_active = True
            user.is_staff = False
            user.is_superuser = False
            user.set_password(credentials[username])
            user.save()
            membership, _ = Membership.objects.update_or_create(
                organization=organization,
                user=user,
                defaults={
                    "status": Membership.Status.ACTIVE,
                    "is_default": True,
                    "is_organization_admin": False,
                },
            )
            membership.roles.set([role])
            managers[username] = user

        # Platform superusers still need an explicit tenant membership so the
        # session can offer that organization in the top-bar switcher. Keep it
        # non-default to preserve the existing Center Estates landing context.
        Membership.objects.update_or_create(
            organization=organization,
            user=admin,
            defaults={
                "status": Membership.Status.ACTIVE,
                "is_default": False,
                "is_organization_admin": True,
            },
        )

        if Property.objects.filter(organization=organization).exists():
            self.stdout.write(self.style.WARNING("Legend operational data already exists; account and branding setup refreshed without cloning it again."))
            self.stdout.write(self.style.SUCCESS("Legend Management Limited demo setup is ready."))
            return

        primary_manager = managers["sharon"]
        source_properties = list(Property.objects.filter(organization=source, code__in=SOURCE_PROPERTY_CODES).order_by("code"))
        if len(source_properties) != len(SOURCE_PROPERTY_CODES):
            raise CommandError("The three canonical source properties are not available.")

        property_map = {}
        for source_property in source_properties:
            metadata = copy.deepcopy(source_property.metadata or {})
            metadata["landlord"] = {
                **(metadata.get("landlord") if isinstance(metadata.get("landlord"), dict) else {}),
                "name": "Legend Management Limited",
            }
            property_map[source_property.pk] = clone_instance(
                source_property,
                overrides={"organization_id": organization.pk, "metadata": metadata},
            )

        building_map = {}
        for row in Building.objects.filter(property__in=source_properties):
            building_map[row.pk] = clone_instance(row, overrides={
                "organization_id": organization.pk,
                "property_id": property_map[row.property_id].pk,
            })
        unit_map = {}
        for row in Unit.objects.filter(property__in=source_properties):
            unit_map[row.pk] = clone_instance(row, overrides={
                "organization_id": organization.pk,
                "property_id": property_map[row.property_id].pk,
                "building_id": building_map[row.building_id].pk if row.building_id in building_map else None,
            })
        tenant_map = {}
        source_tenants = Tenant.objects.filter(property__in=source_properties).exclude(name__startswith="E2E Test")
        for row in source_tenants:
            tenant_map[row.pk] = clone_instance(row, overrides={
                "organization_id": organization.pk,
                "property_id": property_map[row.property_id].pk,
            })
        lease_map = {}
        for row in Lease.objects.filter(unit__property__in=source_properties, tenant_id__in=tenant_map):
            lease_map[row.pk] = clone_instance(row, exclude=("renewed_from",), overrides={
                "organization_id": organization.pk,
                "unit_id": unit_map[row.unit_id].pk,
                "tenant_id": tenant_map[row.tenant_id].pk,
                "renewed_from_id": None,
            })
        invoice_map = {}
        for row in Invoice.objects.filter(lease_id__in=lease_map):
            invoice_map[row.pk] = clone_instance(row, overrides={
                "organization_id": organization.pk,
                "lease_id": lease_map[row.lease_id].pk,
                "prepared_by_id": primary_manager.pk if row.prepared_by_id else None,
                "reviewed_by_id": primary_manager.pk if row.reviewed_by_id else None,
                "issued_by_id": primary_manager.pk if row.issued_by_id else None,
            })
        for row in Receipt.objects.filter(tenant_id__in=tenant_map):
            clone_instance(row, overrides={
                "organization_id": organization.pk,
                "tenant_id": tenant_map[row.tenant_id].pk,
                "invoice_id": invoice_map[row.invoice_id].pk if row.invoice_id in invoice_map else None,
                "received_by_id": primary_manager.pk,
            })
        for row in Budget.objects.filter(property__in=source_properties):
            clone_instance(row, overrides={
                "organization_id": organization.pk,
                "property_id": property_map[row.property_id].pk,
                "approved_by_id": primary_manager.pk if row.approved_by_id else None,
            })
        for row in Expense.objects.filter(property__in=source_properties):
            clone_instance(row, overrides={
                "organization_id": organization.pk,
                "property_id": property_map[row.property_id].pk,
            })

        contractor_map = {}
        for row in Contractor.objects.filter(organization=source):
            contractor_map[row.pk] = clone_instance(row, overrides={"organization_id": organization.pk})
        asset_map = {}
        for row in FacilityAsset.objects.filter(property__in=source_properties):
            asset_map[row.pk] = clone_instance(row, overrides={
                "organization_id": organization.pk,
                "property_id": property_map[row.property_id].pk,
                "building_id": building_map[row.building_id].pk if row.building_id in building_map else None,
                "unit_id": unit_map[row.unit_id].pk if row.unit_id in unit_map else None,
            })
        work_order_map = {}
        for index, row in enumerate(WorkOrder.objects.filter(property__in=source_properties)):
            manager = managers[PEOPLE[index % len(PEOPLE)]]
            work_order_map[row.pk] = clone_instance(row, overrides={
                "organization_id": organization.pk,
                "property_id": property_map[row.property_id].pk,
                "asset_id": asset_map[row.asset_id].pk if row.asset_id in asset_map else None,
                "contractor_id": contractor_map[row.contractor_id].pk if row.contractor_id in contractor_map else None,
                "assigned_to_id": manager.pk,
                "reported_by_id": primary_manager.pk,
            })
        for row in PreventiveSchedule.objects.filter(asset_id__in=asset_map):
            clone_instance(row, overrides={
                "organization_id": organization.pk,
                "asset_id": asset_map[row.asset_id].pk,
            })
        for row in Inspection.objects.filter(property__in=source_properties):
            clone_instance(row, overrides={
                "organization_id": organization.pk,
                "property_id": property_map[row.property_id].pk,
                "asset_id": asset_map[row.asset_id].pk if row.asset_id in asset_map else None,
                "inspector_id": managers["lydia"].pk,
                "follow_up_work_order_id": work_order_map[row.follow_up_work_order_id].pk if row.follow_up_work_order_id in work_order_map else None,
            })
        for row in ServiceRequest.objects.filter(property__in=source_properties):
            clone_instance(row, overrides={
                "organization_id": organization.pk,
                "property_id": property_map[row.property_id].pk,
                "unit_id": unit_map[row.unit_id].pk if row.unit_id in unit_map else None,
                "tenant_id": tenant_map[row.tenant_id].pk if row.tenant_id in tenant_map else None,
                "work_order_id": work_order_map[row.work_order_id].pk if row.work_order_id in work_order_map else None,
                "decided_by_id": primary_manager.pk if row.decided_by_id else None,
            })
        meter_map = {}
        source_meters = list(UtilityMeter.objects.filter(property__in=source_properties).order_by("parent_meter_id"))
        for row in source_meters:
            meter_map[row.pk] = clone_instance(row, overrides={
                "organization_id": organization.pk,
                "property_id": property_map[row.property_id].pk,
                "property_unit_id": unit_map[row.property_unit_id].pk if row.property_unit_id in unit_map else None,
                "parent_meter_id": meter_map[row.parent_meter_id].pk if row.parent_meter_id in meter_map else None,
            })
        for row in MeterReading.objects.filter(meter_id__in=meter_map):
            clone_instance(row, overrides={
                "organization_id": organization.pk,
                "meter_id": meter_map[row.meter_id].pk,
                "recorded_by_id": managers["abel"].pk,
                "reviewed_by_id": primary_manager.pk if row.reviewed_by_id else None,
            })

        template_map = {}
        for row in TaskTemplate.objects.filter(organization=source):
            template_map[row.pk] = clone_instance(row, overrides={"organization_id": organization.pk})
        for index, row in enumerate(Task.objects.filter(property__in=source_properties)):
            clone_instance(row, overrides={
                "organization_id": organization.pk,
                "property_id": property_map[row.property_id].pk,
                "assigned_by_id": primary_manager.pk,
                "assignee_id": managers[PEOPLE[index % len(PEOPLE)]].pk,
                "delegated_to_id": None,
                "delegated_from_id": None,
                "template_id": template_map[row.template_id].pk if row.template_id in template_map else None,
            })

        self.stdout.write(self.style.SUCCESS(
            f"Legend Management Limited ready: {len(managers)} managers, "
            f"{len(property_map)} properties, {len(unit_map)} units and {len(work_order_map)} work orders."
        ))
