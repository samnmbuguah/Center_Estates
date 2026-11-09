from decimal import Decimal, ROUND_HALF_UP

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum

from construction.models import (
    BoQItem,
    MilestoneBoQItem,
    MilestoneEntry,
    Project,
    WorkPlanTask,
)
from construction.valuation import calculate_milestone_valuation


class Command(BaseCommand):
    help = (
        "Backfills MilestoneEntry.work_plan_task links, normalizes over-allocated "
        "MilestoneBoQItem quantities to 100% of contract BoQItem.quantity, and "
        "syncs milestone payment_value and cumulative BoQ valuations."
    )

    def handle(self, *args, **options):
        projects = list(Project.objects.all())
        self.stdout.write(f"Backfilling construction domain across {len(projects)} project(s)...")

        linked_milestones = 0
        normalized_allocations = 0
        updated_payment_values = 0

        for project in projects:
            with transaction.atomic():
                tasks = list(
                    WorkPlanTask.objects.filter(project=project).order_by(
                        "start_date", "task_id", "id"
                    )
                )
                milestones = list(
                    MilestoneEntry.objects.filter(
                        project_id=project.id, deleted_at__isnull=True
                    ).order_by("created_at", "milestone_id")
                )

                task_by_id = {str(t.task_id).strip().lower(): t for t in tasks if t.task_id}

                # 1. Link MilestoneEntry -> WorkPlanTask where unlinked
                for idx, ms in enumerate(milestones):
                    if ms.work_plan_task_id:
                        continue
                    ms_title = (ms.milestone_id or "").strip()
                    ms_lower = ms_title.lower()
                    matched_task = None

                    # Match by "T-001 - Task Name" prefix
                    if " - " in ms_title:
                        prefix = ms_title.split(" - ", 1)[0].strip().lower()
                        matched_task = task_by_id.get(prefix)

                    # Match by task_name substring
                    if not matched_task:
                        for t in tasks:
                            t_name = (t.task_name or "").strip().lower()
                            if t_name and len(t_name) >= 4 and (t_name in ms_lower or ms_lower in t_name):
                                matched_task = t
                                break

                    # Fallback positional match if tasks exist
                    if not matched_task and tasks:
                        matched_task = tasks[min(idx, len(tasks) - 1)]

                    if matched_task:
                        ms.work_plan_task = matched_task
                        ms.save(update_fields=["work_plan_task"])
                        linked_milestones += 1

                # 2. Normalize over-allocated MilestoneBoQItem rows per BoQItem
                boq_items = list(BoQItem.objects.filter(project=project))
                for bi in boq_items:
                    allocs = list(
                        MilestoneBoQItem.objects.filter(
                            project=project, boq_item=bi
                        ).order_by("id")
                    )
                    if not allocs:
                        continue
                    contract_qty = Decimal(str(bi.quantity or 0))
                    total_alloc = sum(
                        (Decimal(str(a.allocated_quantity or 0)) for a in allocs),
                        Decimal("0.00"),
                    )
                    if contract_qty > 0 and total_alloc > contract_qty * Decimal("1.0001"):
                        count = len(allocs)
                        equal_share = (contract_qty / Decimal(str(count))).quantize(
                            Decimal("0.01"), rounding=ROUND_HALF_UP
                        )
                        running = Decimal("0.00")
                        for i, alloc in enumerate(allocs):
                            qty = (
                                max(Decimal("0.00"), contract_qty - running)
                                if i == count - 1
                                else max(Decimal("0.01"), equal_share)
                            )
                            running += qty
                            if alloc.allocated_quantity != qty:
                                alloc.allocated_quantity = qty
                                alloc.save(update_fields=["allocated_quantity"])
                                normalized_allocations += 1

                # 3. Recompute MilestoneEntry.payment_value from Mini-BoQ allocations
                for ms in milestones:
                    allocs = MilestoneBoQItem.objects.filter(
                        project=project, milestone_id=ms.milestone_id
                    ).select_related("boq_item")
                    if not allocs.exists():
                        continue
                    total_val = sum(
                        (
                            Decimal(str(a.allocated_quantity or 0))
                            * Decimal(str(a.boq_item.rate or 0))
                            for a in allocs
                        ),
                        Decimal("0.00"),
                    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                    if ms.payment_value != total_val:
                        ms.payment_value = total_val
                        ms.save(update_fields=["payment_value"])
                        updated_payment_values += 1

                    if ms.percent_complete and ms.percent_complete > 0:
                        calculate_milestone_valuation(
                            ms,
                            project=project,
                            auto_create_certificate=True,
                        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done: linked {linked_milestones} milestones to WorkPlanTask, "
                f"normalized {normalized_allocations} over-allocated Mini-BoQ rows, "
                f"and updated {updated_payment_values} milestone payment values."
            )
        )
