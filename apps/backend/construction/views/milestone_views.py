"""
Milestone, MilestoneVerification, and Evidence ViewSets.

Key domain behaviours:
  - MilestoneViewSet: mobile-capture guarded, append-only after submission,
    mini-BoQ allocation, AI-assisted auto-mapping and audit.
  - MilestoneVerificationViewSet: triggers automated IPC creation on 'verified'.
  - EvidenceViewSet: mobile-capture guarded, append-only.
"""
from decimal import Decimal
from time import time

from django.db import transaction
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.tenancy import get_active_organization
from organizations.models import Membership

from ..models import (
    BoQItem, Device, MilestoneBoQItem, MilestoneEntry, MilestoneVerification,
    EvidenceFile, Project,
)
from ..serializers import (
    EvidenceSerializer, MilestoneBoQItemSerializer, MilestoneSerializer,
    MilestoneVerificationSerializer,
)
from .base import (
    ConstructionScopedViewSet, ImmutableSubmittedMixin,
    MobileCaptureMixin, scoped_viewset,
)

MilestoneBaseViewSet = scoped_viewset(
    "MilestoneBaseViewSet", MilestoneEntry, MilestoneSerializer, ("milestone_id",)
)
EvidenceBaseViewSet = scoped_viewset(
    "EvidenceBaseViewSet", EvidenceFile, EvidenceSerializer, ("remote_url", "hash")
)

# BoQ keyword-to-section mapping used by auto_map_boq.
# Kept as a module-level constant (OCP: extend here, not inside the action).
BOQ_SECTION_KEYWORDS = {
    "substructure": ["substructure", "excavation", "foundation", "hardcore", "plinth", "strip footing", "ground beam"],
    "superstructure": ["superstructure", "slab", "column", "beam", "concrete", "rebar", "formwork", "masonry", "wall"],
    "finishes": ["finishes", "plaster", "paint", "tile", "screed", "ceiling", "gypsum", "flooring", "door", "window"],
    "mep": ["mep", "electrical", "plumbing", "drainage", "conduit", "cable", "pipe", "sanitary", "cctv"],
    "external": ["external", "paving", "drainage", "landscaping", "fence", "gate", "cabro", "driveway"],
    "preliminaries": ["preliminaries", "insurance", "mobilization", "signboard", "site office", "security", "water test"],
}


def check_milestone_prerequisites(milestone_entry, organization=None):
    """Checks if all prerequisite milestone stage-gates have reached 100% completion."""
    prereqs = milestone_entry.prerequisites or []
    if not prereqs:
        return True, []

    org = organization or milestone_entry.organization
    qs = MilestoneEntry.objects.filter(
        project_id=milestone_entry.project_id,
        milestone_id__in=prereqs,
        deleted_at__isnull=True,
    )
    if org:
        qs = qs.filter(organization=org)

    found_map = {m.milestone_id: m for m in qs}
    incomplete = []
    for pid in prereqs:
        item = found_map.get(pid)
        if not item or item.percent_complete < 100:
            pct = item.percent_complete if item else 0
            incomplete.append({"milestone_id": pid, "percent_complete": pct})

    return len(incomplete) == 0, incomplete


def _sync_workplan_task_progress(milestone_entry):
    """Rolls up MilestoneEntry progress back to its linked WorkPlanTask so the Gantt & S-curve stay in sync."""
    from ..models import WorkPlanTask

    task = getattr(milestone_entry, "work_plan_task", None)
    if not task:
        label = str(milestone_entry.milestone_id or "")
        code_part = label.split(":", 1)[0].strip() if ":" in label else ""
        if code_part:
            task = WorkPlanTask.objects.filter(
                project_id=milestone_entry.project_id, task_id=code_part
            ).first()
        if not task:
            task = WorkPlanTask.objects.filter(
                project_id=milestone_entry.project_id, task_name__iexact=label
            ).first()
        if task and not milestone_entry.work_plan_task_id:
            milestone_entry.work_plan_task = task
            milestone_entry.save(update_fields=["work_plan_task"])

    if task:
        linked_entries = list(
            MilestoneEntry.objects.filter(
                project_id=milestone_entry.project_id,
                work_plan_task=task,
                deleted_at__isnull=True,
            )
        )
        if linked_entries:
            avg_pct = sum(Decimal(str(e.percent_complete or 0)) for e in linked_entries) / Decimal(len(linked_entries))
            task.percent_complete = avg_pct.quantize(Decimal("0.1"))
        else:
            task.percent_complete = Decimal(str(milestone_entry.percent_complete or 0))
        task.status = "completed" if task.percent_complete >= 100 else ("in_progress" if task.percent_complete > 0 else "not_started")
        task.save(update_fields=["percent_complete", "status"])


class MilestoneViewSet(MobileCaptureMixin, ImmutableSubmittedMixin, MilestoneBaseViewSet):
    write_permission = 'monitoring.site'

    def perform_create(self, serializer):
        super().perform_create(serializer)
        if serializer.instance:
            _sync_workplan_task_progress(serializer.instance)

    def perform_update(self, serializer):
        entry = self.get_object()
        new_pct = serializer.validated_data.get("percent_complete")
        if new_pct is not None and new_pct > 0:
            satisfied, incomplete = check_milestone_prerequisites(entry)
            if not satisfied:
                reasons = ", ".join([f"'{item['milestone_id']}' ({item['percent_complete']}%)" for item in incomplete])
                raise ValidationError({
                    "prerequisites": f"Stage-gate locked: Preceding milestone(s) {reasons} must reach 100% before progress can be claimed on '{entry.milestone_id}'."
                })
        super().perform_update(serializer)
        if serializer.instance:
            _sync_workplan_task_progress(serializer.instance)

    @action(detail=True, methods=["get"], url_path="prerequisites")
    def prerequisites(self, request, pk=None):
        entry = self.get_object()
        satisfied, incomplete = check_milestone_prerequisites(entry)
        return Response({
            "milestone_id": entry.milestone_id,
            "prerequisites": entry.prerequisites or [],
            "satisfied": satisfied,
            "incomplete": incomplete,
        })

    @action(detail=True, methods=["get"], url_path="drawdown-eligibility")
    def drawdown_eligibility(self, request, pk=None):
        """Checks if a milestone entry (by UUID pk or milestone_id string) is eligible for IPC drawdown."""
        org = get_active_organization(request)
        qs = MilestoneEntry.objects.filter(deleted_at__isnull=True)
        if org:
            qs = qs.filter(organization=org)
        entry = qs.filter(pk=pk).first() or qs.filter(milestone_id=pk).first()
        if not entry:
            return Response({
                "eligible": False,
                "reason": "Milestone not found.",
                "summary": f"No milestone found matching '{pk}'.",
            })

        satisfied, incomplete = check_milestone_prerequisites(entry, org)
        evidence_count = entry.evidence.count() if hasattr(entry, "evidence") else 0
        verified = hasattr(entry, "verification") and entry.verification.decision == "verified"

        reasons = []
        if not satisfied:
            reasons.append(
                "Incomplete stage-gate prerequisites: "
                + ", ".join(f"{i['milestone_id']} ({i['percent_complete']}%)" for i in incomplete)
            )
        if (entry.percent_complete or 0) <= 0:
            reasons.append("Milestone physical progress is 0%.")
        if (entry.required_evidence_types or []) and evidence_count == 0:
            reasons.append("Required field evidence photos/documents have not been uploaded yet.")

        eligible = len(reasons) == 0
        summary = (
            f"Milestone '{entry.milestone_id}' is at {entry.percent_complete}% completion"
            f" ({'Verified' if verified else 'Pending formal verification'}, {evidence_count} evidence file(s)). "
            + ("Eligible for interim valuation drawdown." if eligible else " | ".join(reasons))
        )
        return Response({
            "eligible": eligible,
            "milestone_id": entry.milestone_id,
            "percent_complete": entry.percent_complete,
            "verified": verified,
            "evidence_count": evidence_count,
            "reason": "; ".join(reasons) if reasons else "All stage-gate & evidence checks passed.",
            "summary": summary,
        })

    @action(detail=True, methods=["get", "post"], url_path="mini-boq")
    def mini_boq(self, request, pk=None):
        """Fetch or update the Mini-BoQ line items allocated to this milestone,
        enforcing contract quantity over-allocation guards across the project."""
        from django.db.models import Sum

        entry = self.get_object()
        org = get_active_organization(request)
        project = (
            Project.objects.filter(id=entry.project_id, organization=org).first()
            if org else Project.objects.filter(id=entry.project_id).first()
        )
        if not project:
            return Response({"detail": "Project not found."}, status=404)

        # Compute quantities already allocated to OTHER milestones on this project
        other_allocs_qs = (
            MilestoneBoQItem.objects.filter(project=project)
            .exclude(milestone_id=entry.milestone_id)
            .values("boq_item_id")
            .annotate(total_allocated=Sum("allocated_quantity"))
        )
        allocated_elsewhere_map = {
            row["boq_item_id"]: Decimal(str(row["total_allocated"] or 0))
            for row in other_allocs_qs
        }

        if request.method == "POST":
            items = request.data.get("items", [])
            allow_over_allocation = bool(request.data.get("allow_variation", False))
            now_ms = int(time() * 1000)
            with transaction.atomic():
                created = []
                total_milestone_value = Decimal("0.00")
                for itm in items:
                    boq_id = itm.get("boq_item_id")
                    qty = Decimal(str(itm.get("allocated_quantity", 0) or 0))
                    notes = str(itm.get("notes", "")).strip()
                    boq_item = BoQItem.objects.filter(id=boq_id, project=project).first()
                    if boq_item and qty > 0:
                        contract_qty = Decimal(str(boq_item.quantity or 0))
                        elsewhere_qty = allocated_elsewhere_map.get(boq_item.id, Decimal("0"))
                        if (
                            not allow_over_allocation
                            and contract_qty > 0
                            and (elsewhere_qty + qty) > (contract_qty * Decimal("1.0001"))
                        ):
                            remaining = max(Decimal("0"), contract_qty - elsewhere_qty)
                            raise ValidationError({
                                "allocated_quantity": (
                                    f"Over-allocation on '{boq_item.section}/{boq_item.item_number} ({boq_item.description[:40]})': "
                                    f"Contract quantity is {contract_qty:f} {boq_item.unit}, "
                                    f"{elsewhere_qty:f} {boq_item.unit} is already allocated to other milestones, "
                                    f"leaving {remaining:f} {boq_item.unit} available (attempted {qty:f})."
                                )
                            })
                        rate = Decimal(str(boq_item.rate or 0))
                        total_milestone_value += (qty * rate).quantize(Decimal("0.01"))
                        created.append(
                            MilestoneBoQItem(
                                project=project,
                                organization=project.organization,
                                milestone_id=entry.milestone_id,
                                boq_item=boq_item,
                                allocated_quantity=qty,
                                notes=notes,
                                created_at=now_ms,
                                updated_at=now_ms,
                            )
                        )
                MilestoneBoQItem.objects.filter(milestone_id=entry.milestone_id, project=project).delete()
                if created:
                    MilestoneBoQItem.objects.bulk_create(created)
                entry.payment_value = total_milestone_value
                entry.save(update_fields=["payment_value"])

        from ..valuation import calculate_milestone_valuation
        allocations = MilestoneBoQItem.objects.filter(
            milestone_id=entry.milestone_id, project=project
        ).select_related("boq_item")

        valuation_data = calculate_milestone_valuation(
            entry, project=project, verifier=request.user, auto_create_certificate=False
        )

        serialized_items = MilestoneBoQItemSerializer(allocations, many=True).data
        for row in serialized_items:
            bid = row.get("boq_item")
            elsewhere = float(allocated_elsewhere_map.get(bid, Decimal("0")))
            total_q = float(row.get("total_item_quantity") or 0)
            row["allocated_elsewhere"] = elsewhere
            row["remaining_unallocated"] = max(0.0, total_q - elsewhere - float(row.get("allocated_quantity") or 0))

        return Response({
            "milestone_id": entry.milestone_id,
            "percent_complete": entry.percent_complete,
            "items": serialized_items,
            "allocated_elsewhere": {str(k): float(v) for k, v in allocated_elsewhere_map.items()},
            "valuation": valuation_data,
        })

    @action(detail=False, methods=["post"], url_path="auto-map-boq")
    def auto_map_boq(self, request):
        """Smart keyword & WBS semantic matching to allocate project BoQ items into milestones.
        Distributes remaining unallocated BoQ quantities proportionally across matched milestones
        so total allocated quantities never exceed 100% of the Master BoQ contract scope."""
        from collections import defaultdict
        from django.db.models import Sum

        project_id = request.data.get("project_id")
        target_milestone_id = request.data.get("milestone_id")
        org = get_active_organization(request)
        project = (
            Project.objects.filter(id=project_id, organization=org).first()
            if org else Project.objects.filter(id=project_id).first()
        )
        if not project:
            return Response({"detail": "Project not found."}, status=404)

        milestones_qs = MilestoneEntry.objects.filter(project_id=project.id, deleted_at__isnull=True)
        if org:
            milestones_qs = milestones_qs.filter(organization=org)
        if target_milestone_id:
            milestones_qs = milestones_qs.filter(milestone_id=target_milestone_id)

        milestones_list = list(milestones_qs)
        all_boq_items = list(BoQItem.objects.filter(project=project))
        if not all_boq_items:
            return Response(
                {"detail": "No BoQ items found for this project. Please upload or create a BoQ first."},
                status=400,
            )

        # Determine which milestones match each BoQ item
        item_to_milestones = defaultdict(list)
        for m in milestones_list:
            m_name = (m.milestone_id or "").lower()
            matched_ids = set()
            for sec, keywords in BOQ_SECTION_KEYWORDS.items():
                if any(kw in m_name for kw in keywords):
                    for item in all_boq_items:
                        desc = (item.description or "").lower()
                        if (item.section == sec or any(kw in desc for kw in keywords)) and item.id not in matched_ids:
                            matched_ids.add(item.id)
                            item_to_milestones[item.id].append(m)

        # Fallback: if a target milestone matched nothing by keyword, map unallocated general/first items
        if target_milestone_id and not item_to_milestones and milestones_list:
            m = milestones_list[0]
            for item in all_boq_items[:8]:
                item_to_milestones[item.id].append(m)

        existing_allocs_by_item = {
            row["boq_item_id"]: Decimal(str(row["total"] or 0))
            for row in MilestoneBoQItem.objects.filter(project=project)
            .values("boq_item_id")
            .annotate(total=Sum("allocated_quantity"))
        }

        mapped_count = 0
        now_ms = int(time() * 1000)
        boq_by_id = {b.id: b for b in all_boq_items}

        with transaction.atomic():
            to_create = []
            affected_milestones = set()
            for item_id, matched_ms in item_to_milestones.items():
                bi = boq_by_id[item_id]
                contract_qty = Decimal(str(bi.quantity or 1))
                already_allocated = existing_allocs_by_item.get(item_id, Decimal("0"))
                remaining_qty = max(Decimal("0"), contract_qty - already_allocated)
                if remaining_qty <= 0:
                    continue

                # Filter out milestones that already have an allocation for this BoQ item
                existing_ms_ids = set(
                    MilestoneBoQItem.objects.filter(project=project, boq_item=bi)
                    .values_list("milestone_id", flat=True)
                )
                eligible_ms = [m for m in matched_ms if m.milestone_id not in existing_ms_ids]
                if not eligible_ms:
                    continue

                share_qty = (remaining_qty / Decimal(len(eligible_ms))).quantize(Decimal("0.0001"))
                if share_qty <= 0:
                    continue

                for m in eligible_ms:
                    to_create.append(
                        MilestoneBoQItem(
                            project=project,
                            organization=project.organization,
                            milestone_id=m.milestone_id,
                            boq_item=bi,
                            allocated_quantity=share_qty,
                            notes=f"Auto-mapped WBS share (1/{len(eligible_ms)} of unallocated scope)",
                            created_at=now_ms,
                            updated_at=now_ms,
                        )
                    )
                    affected_milestones.add(m.id)

            if to_create:
                MilestoneBoQItem.objects.bulk_create(to_create)
                mapped_count = len(to_create)

                # Update payment_value on affected milestones
                for m in milestones_list:
                    if m.id in affected_milestones:
                        allocs = MilestoneBoQItem.objects.filter(
                            project=project, milestone_id=m.milestone_id
                        ).select_related("boq_item")
                        val = sum(
                            (Decimal(str(a.allocated_quantity or 0)) * Decimal(str(a.boq_item.rate or 0)))
                            for a in allocs
                        ).quantize(Decimal("0.01"))
                        m.payment_value = val
                        m.save(update_fields=["payment_value"])

        return Response({
            "status": "success",
            "mapped_allocations": mapped_count,
            "message": f"Successfully mapped {mapped_count} proportional BoQ allocations across milestones.",
        })

    @action(detail=True, methods=["post"], url_path="ai-audit")
    def ai_audit(self, request, pk=None):
        """Runs an automated AI audit of the milestone's physical progress, photos, and mini-BoQ items."""
        entry = self.get_object()
        org = get_active_organization(request)
        project = (
            Project.objects.filter(id=entry.project_id, organization=org).first()
            if org else Project.objects.filter(id=entry.project_id).first()
        )
        if not project:
            return Response({"detail": "Project not found."}, status=404)

        from ..valuation import audit_milestone_claim
        audit_result = audit_milestone_claim(entry, project=project)
        return Response(audit_result)


class MilestoneVerificationViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.certify'
    # ISP fix: advertise only the HTTP methods we actually support
    http_method_names = ("get", "post", "head", "options")
    queryset = MilestoneVerification.objects.select_related("milestone_entry", "verifier")
    serializer_class = MilestoneVerificationSerializer
    organization_field = "milestone_entry__organization"
    search_fields = ("milestone_entry__milestone_id", "decision", "note", "verifier__username")

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        entry = MilestoneEntry.objects.select_for_update().filter(
            pk=serializer.validated_data["milestone_entry"].pk, organization=organization,
        ).first()
        if not entry or entry.submitted_at is None or not hasattr(entry, "seal"):
            raise ValidationError({"milestone_entry": "Only a sealed submitted milestone can be verified."})
        if hasattr(entry, "verification"):
            raise ValidationError({"milestone_entry": "This milestone already has a verification decision."})
        if entry.signing_device_id and Device.objects.filter(
            pk=entry.signing_device_id, organization=organization, user=self.request.user,
        ).exists():
            raise ValidationError({"verifier": "The submitting device owner cannot verify the same milestone."})
        note = serializer.validated_data.get("note", "").strip()
        if serializer.validated_data["decision"] != "verified" and not note:
            raise ValidationError({"note": "A reason is required for rejection or clarification."})

        # Stage-gate validation: Ensure all prerequisite milestones are satisfied
        if serializer.validated_data["decision"] == "verified":
            satisfied, incomplete = check_milestone_prerequisites(entry, organization)
            if not satisfied:
                reasons = ", ".join([f"'{item['milestone_id']}' ({item['percent_complete']}%)" for item in incomplete])
                raise ValidationError({
                    "prerequisites": f"Cannot verify milestone '{entry.milestone_id}'. Prerequisite stage-gate(s) incomplete: {reasons}. All preceding milestones must be 100% complete."
                })

        serializer.save(verifier=self.request.user, verified_at=int(time() * 1000))

        # Automated Valuation & IPC Generation on Verification
        if serializer.validated_data["decision"] == "verified":
            try:
                from ..valuation import calculate_milestone_valuation
                project = Project.objects.filter(id=entry.project_id, organization=organization).first()
                if project:
                    calculate_milestone_valuation(
                        milestone_entry=entry,
                        project=project,
                        verifier=self.request.user,
                        auto_create_certificate=True,
                    )
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(
                    "Valuation calculation error on milestone verification: %s", e
                )


class EvidenceViewSet(MobileCaptureMixin, ImmutableSubmittedMixin, EvidenceBaseViewSet):
    write_permission = 'monitoring.site'
    pass
