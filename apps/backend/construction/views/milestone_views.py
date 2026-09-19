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


class MilestoneViewSet(MobileCaptureMixin, ImmutableSubmittedMixin, MilestoneBaseViewSet):
    write_permission = 'monitoring.site'

    @action(detail=True, methods=["get", "post"], url_path="mini-boq")
    def mini_boq(self, request, pk=None):
        """Fetch or update the Mini-BoQ line items allocated to this milestone."""
        entry = self.get_object()
        org = get_active_organization(request)
        project = (
            Project.objects.filter(id=entry.project_id, organization=org).first()
            if org else Project.objects.filter(id=entry.project_id).first()
        )
        if not project:
            return Response({"detail": "Project not found."}, status=404)

        if request.method == "POST":
            items = request.data.get("items", [])
            now_ms = int(time() * 1000)
            with transaction.atomic():
                MilestoneBoQItem.objects.filter(milestone_id=entry.milestone_id, project=project).delete()
                created = []
                for itm in items:
                    boq_id = itm.get("boq_item_id")
                    qty = itm.get("allocated_quantity", 0)
                    notes = str(itm.get("notes", "")).strip()
                    boq_item = BoQItem.objects.filter(id=boq_id, project=project).first()
                    if boq_item and float(qty) > 0:
                        created.append(
                            MilestoneBoQItem(
                                project=project,
                                organization=project.organization,
                                milestone_id=entry.milestone_id,
                                boq_item=boq_item,
                                allocated_quantity=Decimal(str(qty)),
                                notes=notes,
                                created_at=now_ms,
                                updated_at=now_ms,
                            )
                        )
                if created:
                    MilestoneBoQItem.objects.bulk_create(created)

        from ..valuation import calculate_milestone_valuation
        allocations = MilestoneBoQItem.objects.filter(
            milestone_id=entry.milestone_id, project=project
        ).select_related("boq_item")

        valuation_data = calculate_milestone_valuation(
            entry, project=project, verifier=request.user, auto_create_certificate=False
        )

        return Response({
            "milestone_id": entry.milestone_id,
            "percent_complete": entry.percent_complete,
            "items": MilestoneBoQItemSerializer(allocations, many=True).data,
            "valuation": valuation_data,
        })

    @action(detail=False, methods=["post"], url_path="auto-map-boq")
    def auto_map_boq(self, request):
        """Smart keyword & WBS semantic matching to allocate project BoQ items into milestones."""
        project_id = request.data.get("project_id")
        target_milestone_id = request.data.get("milestone_id")
        org = get_active_organization(request)
        project = (
            Project.objects.filter(id=project_id, organization=org).first()
            if org else Project.objects.filter(id=project_id).first()
        )
        if not project:
            return Response({"detail": "Project not found."}, status=404)

        milestones_qs = MilestoneEntry.objects.filter(project_id=project.id)
        if org:
            milestones_qs = milestones_qs.filter(organization=org)
        if target_milestone_id:
            milestones_qs = milestones_qs.filter(milestone_id=target_milestone_id)

        all_boq_items = list(BoQItem.objects.filter(project=project))
        if not all_boq_items:
            return Response(
                {"detail": "No BoQ items found for this project. Please upload or create a BoQ first."},
                status=400,
            )

        mapped_count = 0
        now_ms = int(time() * 1000)

        with transaction.atomic():
            for m in milestones_qs:
                m_name = (m.milestone_id or "").lower()
                matched_items = []
                for sec, keywords in BOQ_SECTION_KEYWORDS.items():
                    if any(kw in m_name for kw in keywords):
                        for item in all_boq_items:
                            desc = (item.description or "").lower()
                            if item.section == sec or any(kw in desc for kw in keywords):
                                matched_items.append(item)

                seen_ids = set(
                    MilestoneBoQItem.objects.filter(
                        milestone_id=m.milestone_id, project=project
                    ).values_list("boq_item_id", flat=True)
                )
                to_create = []
                for bi in matched_items:
                    if bi.id not in seen_ids:
                        seen_ids.add(bi.id)
                        to_create.append(
                            MilestoneBoQItem(
                                project=project,
                                organization=project.organization,
                                milestone_id=m.milestone_id,
                                boq_item=bi,
                                allocated_quantity=bi.quantity or Decimal("1.00"),
                                notes="Auto-mapped by AI keyword heuristics",
                                created_at=now_ms,
                                updated_at=now_ms,
                            )
                        )
                if to_create:
                    MilestoneBoQItem.objects.bulk_create(to_create)
                    mapped_count += len(to_create)

        return Response({
            "status": "success",
            "mapped_allocations": mapped_count,
            "message": f"Successfully mapped {mapped_count} BoQ line items to milestones.",
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
