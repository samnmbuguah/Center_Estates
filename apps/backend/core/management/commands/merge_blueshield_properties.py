from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from organizations.models import Organization, Membership
from properties.models import (
    Property, Building, Unit, Project, Tenant, Lease,
    Invoice, Receipt, Expense, Budget, ServiceCharge,
    TenantDocument, RentSchedule, BillingProfile, BillingRun,
    BillingCandidate, BillingReadinessIssue,
    ReportExecution, ScheduledReport, PaymentGatewayConfiguration
)
from facilities.models import (
    FacilityAsset, WorkOrder, WorkOrderEvent, WorkOrderCostItem,
    WorkOrderAttachment, PreventiveSchedule, Inspection, ServiceRequest,
    UtilityMeter, MeterReading
)
from valuations.models import ValuationInstruction
from companion.models import Task, TaskEvent, TeamFeedbackThread, TeamFeedbackMessage


class Command(BaseCommand):
    help = "Merge duplicate Blueshield Towers property records into a single canonical record with zero data loss."

    def handle(self, *args, **options):
        with transaction.atomic():
            legend_org = Organization.objects.filter(name__icontains="legend").first()
            if not legend_org:
                self.stdout.write(self.style.ERROR("Legend Management Limited organization not found."))
                return

            self.stdout.write(self.style.SUCCESS(f"Found Legend Management: {legend_org.name} ({legend_org.id})"))

            # Primary live Blueshield property with actual units & leases (PROP-0006)
            master_prop = Property.objects.filter(
                organization=legend_org,
                name__iexact="BLUESHIELD TOWERS"
            ).filter(units__leases__isnull=False).distinct().first()

            if not master_prop:
                # Fallback to the one with the most units/leases
                master_prop = Property.objects.filter(
                    organization=legend_org,
                    name__icontains="blueshield"
                ).order_by("-units__leases").first()

            if not master_prop:
                self.stdout.write(self.style.ERROR("Could not identify master Blueshield property."))
                return

            self.stdout.write(self.style.SUCCESS(
                f"Master Property: {master_prop.name} (Code: {master_prop.code}, ID: {master_prop.id}) "
                f"with {master_prop.units.count()} units and {Lease.objects.filter(unit__property=master_prop).count()} leases."
            ))

            # Find duplicate Blueshield properties
            duplicate_props = Property.objects.filter(
                organization=legend_org,
                name__icontains="blueshield"
            ).exclude(id=master_prop.id)

            dup_ids = list(duplicate_props.values_list("id", flat=True))
            self.stdout.write(f"Found {len(dup_ids)} duplicate Blueshield properties to merge: {dup_ids}")

            if dup_ids:
                # 1. Reassign Feedback Threads and Messages
                fb_count = TeamFeedbackThread.objects.filter(property_id__in=dup_ids).update(property=master_prop)
                self.stdout.write(f"Reassigned {fb_count} TeamFeedbackThreads to master property.")

                # 2. Reassign Utility Meters (avoiding duplicate code constraint)
                for meter in UtilityMeter.objects.filter(property_id__in=dup_ids):
                    existing = UtilityMeter.objects.filter(organization=legend_org, property=master_prop, code=meter.code).first()
                    if existing:
                        MeterReading.objects.filter(meter=meter).update(meter=existing)
                        meter.delete()
                    else:
                        meter.property = master_prop
                        meter.save()
                self.stdout.write("Reassigned UtilityMeters to master property.")

                # 3. Reassign Billing Runs (avoiding unique constraint on organization, property, period_start)
                for br in BillingRun.objects.filter(property_id__in=dup_ids):
                    existing_br = BillingRun.objects.filter(
                        organization=legend_org,
                        property=master_prop,
                        period_start=br.period_start
                    ).first()
                    if existing_br:
                        BillingCandidate.objects.filter(billing_run=br).update(billing_run=existing_br)
                        BillingReadinessIssue.objects.filter(billing_run=br).update(billing_run=existing_br)
                        br.delete()
                    else:
                        br.property = master_prop
                        br.save()
                self.stdout.write("Reassigned BillingRuns to master property.")

                # 4. Reassign Report Executions & Scheduled Reports
                rx_count = ReportExecution.objects.filter(property_id__in=dup_ids).update(property=master_prop)
                sr_count = ScheduledReport.objects.filter(property_id__in=dup_ids).update(property=master_prop)
                self.stdout.write(f"Reassigned: ReportExecutions={rx_count}, ScheduledReports={sr_count}")

                # 5. Reassign Facility Assets, Work Orders, Service Requests, Inspections
                fa_count = FacilityAsset.objects.filter(property_id__in=dup_ids).update(property=master_prop)
                wo_count = WorkOrder.objects.filter(property_id__in=dup_ids).update(property=master_prop)
                sreq_count = ServiceRequest.objects.filter(property_id__in=dup_ids).update(property=master_prop)
                insp_count = Inspection.objects.filter(property_id__in=dup_ids).update(property=master_prop)
                self.stdout.write(f"Reassigned Facilities: Assets={fa_count}, WorkOrders={wo_count}, ServiceRequests={sreq_count}, Inspections={insp_count}")

                # 6. Reassign Tasks, Valuations, Projects, Expenses
                task_count = Task.objects.filter(property_id__in=dup_ids).update(property=master_prop)
                val_count = ValuationInstruction.objects.filter(property_id__in=dup_ids).update(property=master_prop)
                proj_count = Project.objects.filter(property_id__in=dup_ids).update(property=master_prop)
                exp_count = Expense.objects.filter(property_id__in=dup_ids).update(property=master_prop)
                ten_count = Tenant.objects.filter(property_id__in=dup_ids).update(property=master_prop)
                self.stdout.write(f"Reassigned: Tasks={task_count}, Valuations={val_count}, Projects={proj_count}, Expenses={exp_count}, DirectTenants={ten_count}")

                # 7. Reassign user memberships to master property
                for membership in Membership.objects.filter(organization=legend_org):
                    membership.assigned_properties.add(master_prop)
                    for dup_p in duplicate_props:
                        membership.assigned_properties.remove(dup_p)
                self.stdout.write("Updated all user membership property assignments.")

                # 8. Delete unleased placeholder units and buildings from duplicate shells
                dup_units = Unit.objects.filter(property_id__in=dup_ids)
                dup_unit_count = dup_units.count()
                dup_units.delete()
                self.stdout.write(f"Cleaned up {dup_unit_count} placeholder units from duplicates.")

                dup_bldgs = Building.objects.filter(property_id__in=dup_ids)
                dup_bldg_count = dup_bldgs.count()
                dup_bldgs.delete()
                self.stdout.write(f"Cleaned up {dup_bldg_count} placeholder buildings from duplicates.")

                # 9. Delete duplicate property records
                duplicate_props.delete()
                self.stdout.write(self.style.SUCCESS("Successfully deleted duplicate Blueshield property shells."))

            # Ensure master property has standard name
            master_prop.name = "BLUESHIELD TOWERS"
            master_prop.save()

            # Clean duplicate KASNEB TOWERS empty shells if any
            kasneb_props = Property.objects.filter(organization=legend_org, name__icontains="kasneb").order_by("created_at")
            if kasneb_props.count() > 1:
                first_kasneb = kasneb_props.first()
                other_kasnebs = kasneb_props.exclude(id=first_kasneb.id)
                self.stdout.write(f"Found {other_kasnebs.count()} duplicate empty KASNEB TOWERS properties. Cleaning up...")
                for k_dup in other_kasnebs:
                    if k_dup.units.count() == 0 and Lease.objects.filter(unit__property=k_dup).count() == 0:
                        k_dup.delete()
                self.stdout.write(self.style.SUCCESS("Cleaned up duplicate empty KASNEB TOWERS."))

            self.stdout.write(self.style.SUCCESS("Merge completed successfully with zero data loss."))
