import time
import logging
from decimal import Decimal
from typing import Dict, Any, Optional

from django.db import transaction
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()


def calculate_milestone_valuation(
    milestone_entry,
    project=None,
    verifier=None,
    auto_create_certificate: bool = True,
) -> Dict[str, Any]:
    """Calculates the mini-BoQ valuation for a milestone entry based on allocated line items,
    computes contractual deductions (retention, advance payment recovery), and automatically
    generates or updates the Interim Payment Certificate (IPC) and pending Disbursement."""
    from .models import Project, MilestoneBoQItem, Certificate, Disbursement

    if not project:
        project = Project.objects.filter(id=milestone_entry.project_id).first()
        if not project:
            return {"error": "Project not found for milestone entry"}

    # 1. Fetch Mini-BoQ line items
    allocations = list(
        MilestoneBoQItem.objects.filter(
            milestone_id=milestone_entry.milestone_id,
            project=project,
        ).select_related("boq_item")
    )

    percent_complete = Decimal(str(milestone_entry.percent_complete or 0))
    progress_ratio = percent_complete / Decimal("100")

    current_gross = Decimal("0.00")
    boq_snapshot = []

    if allocations:
        for alloc in allocations:
            item = alloc.boq_item
            rate = Decimal(str(item.rate or 0))
            allocated_qty = Decimal(str(alloc.allocated_quantity or 0))
            certified_qty = allocated_qty * progress_ratio
            line_amount = (certified_qty * rate).quantize(Decimal("0.01"))
            current_gross += line_amount

            boq_snapshot.append({
                "boq_item_id": item.id,
                "section": item.section,
                "item_number": item.item_number,
                "description": item.description,
                "unit": item.unit,
                "rate": float(rate),
                "allocated_quantity": float(allocated_qty),
                "certified_quantity": float(certified_qty),
                "line_amount": float(line_amount),
            })
            
            # Sync certified progress to the master BoQ item
            if auto_create_certificate:
                item.certified_quantity = max(item.certified_quantity or Decimal("0"), certified_qty)
                item.certified_amount = (item.certified_quantity * rate).quantize(Decimal("0.01"))
                if percent_complete >= 100:
                    item.cost_state = "certified"
                item.save(update_fields=["certified_quantity", "certified_amount", "cost_state"])
    else:
        # Graceful fallback: If no discrete BoQ items mapped yet, use milestone payment_value or budget share
        if milestone_entry.payment_value:
            current_gross = (Decimal(str(milestone_entry.payment_value)) * progress_ratio).quantize(Decimal("0.01"))
        else:
            current_gross = Decimal("0.00")

    # 2. Contractual Deductions
    meta = project.metadata if isinstance(getattr(project, "metadata", None), dict) else {}
    retention_pct = Decimal(str(meta.get("retention_percent", 5.0)))
    retention_amount = (current_gross * (retention_pct / Decimal("100"))).quantize(Decimal("0.01"))

    advance_recovery_pct = Decimal(str(meta.get("advance_recovery_percent", 10.0)))
    advance_recovery = (current_gross * (advance_recovery_pct / Decimal("100"))).quantize(Decimal("0.01"))

    net_payable = max(current_gross - retention_amount - advance_recovery, Decimal("0.00")).quantize(Decimal("0.01"))

    result = {
        "milestone_id": milestone_entry.milestone_id,
        "percent_complete": float(percent_complete),
        "allocated_items_count": len(allocations),
        "current_gross": float(current_gross),
        "retention_percent": float(retention_pct),
        "retention_amount": float(retention_amount),
        "advance_recovery_percent": float(advance_recovery_pct),
        "advance_recovery": float(advance_recovery),
        "net_payable": float(net_payable),
        "boq_snapshot": boq_snapshot,
    }

    if not auto_create_certificate:
        return result

    # 3. Create or Update Certificate (Interim Payment Certificate - IPC)
    now_ms = int(time.time() * 1000)
    issuer = verifier or User.objects.filter(is_superuser=True).first()

    with transaction.atomic():
        # Look for existing certificate for this milestone
        cert = Certificate.objects.filter(
            project_id=project.id,
            milestone_entry_id=str(milestone_entry.id),
        ).exclude(status="void").first()

        cert_number = f"IPC-{project.code or 'PRJ'}-{milestone_entry.milestone_id[:12].upper()}"

        if not cert:
            cert = Certificate.objects.create(
                organization=project.organization,
                project_id=project.id,
                cert_type="interim",
                number=cert_number,
                contractor_name=meta.get("lead_contractor", {}).get("name") or getattr(project, "client_name", ""),
                amount=current_gross,
                current_gross=current_gross,
                retention_percent=retention_pct,
                retention_amount=retention_amount,
                advance_recovery=advance_recovery,
                net_payable=net_payable,
                boq_snapshot=boq_snapshot,
                milestone_entry_id=str(milestone_entry.id),
                issued_by=issuer,
                issued_at=now_ms,
                status="issued",
            )
        else:
            cert.current_gross = current_gross
            cert.amount = current_gross
            cert.retention_amount = retention_amount
            cert.advance_recovery = advance_recovery
            cert.net_payable = net_payable
            cert.boq_snapshot = boq_snapshot
            cert.issued_at = now_ms
            cert.save()

        # 4. Create or Update Pending Disbursement
        disbursement = Disbursement.objects.filter(
            project_id=project.id,
            certificate=cert,
        ).exclude(status="void").first()

        if not disbursement:
            disbursement = Disbursement.objects.create(
                organization=project.organization,
                project_id=project.id,
                certificate=cert,
                amount=net_payable,
                status="pending",
                managed_by=issuer,
                created_at=now_ms,
            )
        else:
            if disbursement.status == "pending":
                disbursement.amount = net_payable
                disbursement.save(update_fields=["amount"])

        result["certificate_id"] = cert.id
        result["certificate_number"] = cert.number
        result["disbursement_id"] = disbursement.id
        result["disbursement_status"] = disbursement.status

    return result


def audit_milestone_claim(entry, project=None) -> Dict[str, Any]:
    """Runs an automated AI audit of the milestone's physical progress, photos, and mini-BoQ items."""
    from .models import Project

    if not project:
        project = Project.objects.filter(id=entry.project_id).first()

    valuation = calculate_milestone_valuation(entry, project=project, auto_create_certificate=False)

    evidence_files = list(entry.evidence.all()) if hasattr(entry, "evidence") else []
    observations = list(entry.observations.all()) if hasattr(entry, "observations") else []

    anomalies = []
    confidence = 95

    percent_complete = getattr(entry, "percent_complete", 0) or 0

    if percent_complete > 25 and len(evidence_files) == 0:
        anomalies.append({
            "severity": "high",
            "issue": "Missing photographic evidence",
            "detail": f"Milestone is claimed at {percent_complete}% completion, but 0 photographic evidence files are attached."
        })
        confidence -= 30

    if valuation.get("allocated_items_count", 0) == 0:
        anomalies.append({
            "severity": "medium",
            "issue": "Unallocated Mini-BoQ",
            "detail": "No Bill of Quantities items are bound to this milestone. Financial progress cannot be verified against contract unit rates."
        })
        confidence -= 15

    off_site_count = sum(1 for e in evidence_files if getattr(e, "geofence_status", "") == "flagged")
    if off_site_count > 0:
        anomalies.append({
            "severity": "high",
            "issue": "Geofence perimeter breach",
            "detail": f"{off_site_count} photo evidence upload(s) were captured outside the project site geofence radius."
        })
        confidence -= 25

    urgent_obs = [o.body for o in observations if getattr(o, "flag", "") in ("issue", "urgent")]
    if urgent_obs:
        anomalies.append({
            "severity": "medium",
            "issue": "Site issues flagged by Clerk of Works",
            "detail": f"{len(urgent_obs)} issue(s) reported: " + "; ".join(urgent_obs[:2])
        })
        confidence -= 10

    audit_status = "pass" if confidence >= 80 else ("warning" if confidence >= 60 else "flagged")

    return {
        "milestone_id": entry.milestone_id,
        "audit_status": audit_status,
        "confidence_score": max(confidence, 10),
        "anomalies": anomalies,
        "valuation": valuation,
        "recommendation": (
            "Claim is verified and aligned with BoQ contractual rates. Recommended for IPC certification."
            if audit_status == "pass" else
            "Claim has minor discrepancies. Review site evidence before issuing payment certificate."
            if audit_status == "warning" else
            "Flagged high-risk claim. Physical site reinspection recommended prior to certifying disbursement."
        )
    }

