from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from organizations.models import Organization, Membership, Role
from properties.models import (
    Property, Building, Unit, Project, Tenant, Lease, LeaseEscalation,
    UnitStatusHistory, TenantMovement, BillingProfile, BillingRun,
    BillingCandidate, BillingReadinessIssue, Invoice, InvoiceLine,
    Receipt, InvoiceReminder, BankTransaction, PaymentGatewayConfiguration,
    PaymentIntent, Expense, Budget, ServiceCharge, ServiceChargeAllocation,
    ServiceChargeReconciliation, TenantDocument, RentSchedule,
    ReceiptAllocation, CreditNote, ReportExecution, ScheduledReport
)
from facilities.models import (
    FacilityAsset, WorkOrder, WorkOrderEvent, WorkOrderCostItem,
    WorkOrderAttachment, PreventiveSchedule, Inspection, ServiceRequest,
    UtilityMeter, MeterReading, MeterResetEvent, MeterReconciliation
)
from sales.models import SaleListing, PropertySale, Installment, SalePayment
from valuations.models import ValuationInstruction
from companion.models import (
    Task, TaskEvent, TeamFeedbackThread, TeamFeedbackMessage,
    StaffLeaveRequest, StaffHrRequest, StaffLeaveBalance
)
from django.contrib.auth import get_user_model

class Command(BaseCommand):
    help = "Move Blue Shield properties to Legend Management Limited and scope property managers to Legend organization."

    def handle(self, *args, **options):
        User = get_user_model()
        with transaction.atomic():
            legend_org = Organization.objects.filter(name="Legend Management Limited").first()
            if not legend_org:
                legend_org = Organization.objects.create(
                    name="Legend Management Limited",
                    slug="legend-management-limited",
                    is_active=True,
                )
                self.stdout.write(self.style.SUCCESS(f"Created Legend Management Limited organization: {legend_org.id}"))
            else:
                self.stdout.write(self.style.SUCCESS(f"Found Legend Management Limited: {legend_org.id}"))

            demo_org = Organization.objects.filter(name="Center Estates Demo").first()

            # 1. Find the 2 Blueshield properties
            bs_props = Property.objects.filter(
                Q(name__icontains="blueshield") | Q(name__icontains="blue shield")
            )
            bs_prop_ids = list(bs_props.values_list("id", flat=True))
            self.stdout.write(f"Found {len(bs_props)} Blue Shield properties: {[p.name for p in bs_props]}")

            # 2. Reassign properties and all related models to Legend Management Limited
            bs_props.update(organization=legend_org)

            Building.objects.filter(property_id__in=bs_prop_ids).update(organization=legend_org)
            Unit.objects.filter(property_id__in=bs_prop_ids).update(organization=legend_org)
            Project.objects.filter(property_id__in=bs_prop_ids).update(organization=legend_org)
            Tenant.objects.filter(Q(property_id__in=bs_prop_ids) | Q(leases__unit__property_id__in=bs_prop_ids)).update(organization=legend_org)
            Lease.objects.filter(unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            LeaseEscalation.objects.filter(lease__unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            UnitStatusHistory.objects.filter(unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            TenantMovement.objects.filter(unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            BillingProfile.objects.filter(lease__unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            BillingRun.objects.filter(property_id__in=bs_prop_ids).update(organization=legend_org)
            BillingCandidate.objects.filter(lease__unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            BillingReadinessIssue.objects.filter(lease__unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            Invoice.objects.filter(lease__unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            InvoiceLine.objects.filter(invoice__lease__unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            Receipt.objects.filter(invoice__lease__unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            InvoiceReminder.objects.filter(invoice__lease__unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            BankTransaction.objects.filter(receipt__invoice__lease__unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            PaymentGatewayConfiguration.objects.filter(property_id__in=bs_prop_ids).update(organization=legend_org)
            PaymentIntent.objects.filter(invoice__lease__unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            Expense.objects.filter(property_id__in=bs_prop_ids).update(organization=legend_org)
            Budget.objects.filter(property_id__in=bs_prop_ids).update(organization=legend_org)
            ServiceCharge.objects.filter(property_id__in=bs_prop_ids).update(organization=legend_org)
            ServiceChargeAllocation.objects.filter(service_charge__property_id__in=bs_prop_ids).update(organization=legend_org)
            ServiceChargeReconciliation.objects.filter(service_charge__property_id__in=bs_prop_ids).update(organization=legend_org)
            TenantDocument.objects.filter(tenant__leases__unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            RentSchedule.objects.filter(lease__unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            ReceiptAllocation.objects.filter(invoice__lease__unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            CreditNote.objects.filter(invoice__lease__unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            ReportExecution.objects.filter(property_id__in=bs_prop_ids).update(organization=legend_org)
            ScheduledReport.objects.filter(property_id__in=bs_prop_ids).update(organization=legend_org)
            FacilityAsset.objects.filter(property_id__in=bs_prop_ids).update(organization=legend_org)
            WorkOrder.objects.filter(property_id__in=bs_prop_ids).update(organization=legend_org)
            WorkOrderEvent.objects.filter(work_order__property_id__in=bs_prop_ids).update(organization=legend_org)
            WorkOrderCostItem.objects.filter(work_order__property_id__in=bs_prop_ids).update(organization=legend_org)
            WorkOrderAttachment.objects.filter(work_order__property_id__in=bs_prop_ids).update(organization=legend_org)
            PreventiveSchedule.objects.filter(asset__property_id__in=bs_prop_ids).update(organization=legend_org)
            Inspection.objects.filter(property_id__in=bs_prop_ids).update(organization=legend_org)
            ServiceRequest.objects.filter(property_id__in=bs_prop_ids).update(organization=legend_org)
            UtilityMeter.objects.filter(property_id__in=bs_prop_ids).update(organization=legend_org)
            MeterReading.objects.filter(meter__property_id__in=bs_prop_ids).update(organization=legend_org)
            SaleListing.objects.filter(unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            PropertySale.objects.filter(listing__unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            Installment.objects.filter(sale__listing__unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            SalePayment.objects.filter(sale__listing__unit__property_id__in=bs_prop_ids).update(organization=legend_org)
            ValuationInstruction.objects.filter(property_id__in=bs_prop_ids).update(organization=legend_org)
            Task.objects.filter(property_id__in=bs_prop_ids).update(organization=legend_org)
            TaskEvent.objects.filter(task__property_id__in=bs_prop_ids).update(organization=legend_org)

            # Reassign companion feedback threads pointing to Blue Shield properties or logged by team to Legend
            TeamFeedbackThread.objects.filter(property_id__in=bs_prop_ids).update(organization=legend_org)
            TeamFeedbackMessage.objects.filter(thread__property_id__in=bs_prop_ids).update(organization=legend_org)
            # Reassign all team dialogue threads to Legend so they remain visible in Legend
            TeamFeedbackThread.objects.all().update(organization=legend_org)
            TeamFeedbackMessage.objects.all().update(organization=legend_org)

            # Reassign leave and HR requests to Legend org
            StaffLeaveRequest.objects.all().update(organization=legend_org)
            StaffHrRequest.objects.all().update(organization=legend_org)
            StaffLeaveBalance.objects.all().update(organization=legend_org)

            self.stdout.write(self.style.SUCCESS("Successfully migrated Blue Shield properties & sub-records to Legend Management Limited."))

            # 3. Configure Property Managers
            pm_usernames = ["sharon", "lydia", "abel", "brian", "merrylyn"]
            legend_properties = list(Property.objects.filter(organization=legend_org))
            legend_pm_role, _ = Role.objects.get_or_create(
                organization=legend_org,
                slug="property-manager",
                defaults={"name": "Property Manager", "description": "Property Manager Role"}
            )
            legend_admin_role, _ = Role.objects.get_or_create(
                organization=legend_org,
                slug="platform-admin",
                defaults={"name": "Super Administrator", "description": "Platform Admin"}
            )

            for uname in pm_usernames:
                user = User.objects.filter(username=uname).first()
                if not user:
                    continue

                # Remove / deactivate membership from Demo org
                if demo_org:
                    Membership.objects.filter(user=user, organization=demo_org).delete()

                # Ensure single active membership in Legend Management Limited
                m, _ = Membership.objects.get_or_create(
                    user=user,
                    organization=legend_org,
                    defaults={"is_organization_admin": False, "is_default": True}
                )
                m.is_organization_admin = False
                m.is_default = True
                m.save()
                m.roles.set([legend_pm_role])
                # Assign all current properties in Legend Management Limited (Litch House, BLUESHIELD TOWERS, Blue Shield Towers)
                m.assigned_properties.set(legend_properties)
                self.stdout.write(f"Updated PM {uname}: assigned to Legend Management Limited properties {[p.name for p in legend_properties]}")

            # 4. Ensure super admins (samuel and admin) are default in Legend Management Limited with full access
            for admin_uname in ["samuel", "admin"]:
                admin_user = User.objects.filter(username=admin_uname).first()
                if not admin_user:
                    continue
                # Unset is_default on other memberships first to satisfy unique constraint
                Membership.objects.filter(user=admin_user).exclude(organization=legend_org).update(is_default=False)

                m_admin, _ = Membership.objects.get_or_create(
                    user=admin_user,
                    organization=legend_org,
                    defaults={"is_organization_admin": True, "is_default": True}
                )
                m_admin.is_organization_admin = True
                m_admin.is_default = True
                m_admin.save()
                m_admin.roles.set([legend_admin_role])
                m_admin.assigned_properties.set(legend_properties)
                self.stdout.write(f"Configured Super Admin {admin_uname} on Legend Management Limited with all properties.")

        self.stdout.write(self.style.SUCCESS("All migrations completed successfully."))
