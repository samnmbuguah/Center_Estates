"""
Financial ViewSets:
  ProvisionalSum, ContingencyDrawdown, AdvancePayment, AdvanceRecovery,
  Requisition, Certificate, Disbursement, DrawdownRequest,
  Chat, Notification, AdminAuditLog.
"""
from decimal import Decimal
from time import time
import datetime

from django.db import transaction
from django.db.models import Sum
from django.http import HttpResponse
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.tenancy import get_active_organization

from ..models import (
    AdvancePayment, AdvanceRecovery, AdminAuditLog, BoQItem, Certificate, ChatMessage,
    ContingencyDrawdown, Disbursement, DrawdownRequest, Notification, Project,
    ProvisionalSum, Requisition, Variation,
)
from ..serializers import (
    AdminAuditLogSerializer, AdvancePaymentSerializer, AdvanceRecoverySerializer,
    CertificateSerializer, ChatMessageSerializer, ContingencyDrawdownSerializer,
    DisbursementSerializer, DrawdownRequestSerializer, NotificationSerializer,
    ProvisionalSumSerializer, RequisitionSerializer,
)
from .base import ConstructionScopedViewSet, scoped_viewset

# ── Simple base ViewSets ──────────────────────────────────────────────────────

ProvisionalSumBaseViewSet = scoped_viewset(
    "ProvisionalSumBaseViewSet", ProvisionalSum, ProvisionalSumSerializer, ("item_number", "description")
)
ContingencyDrawdownBaseViewSet = scoped_viewset(
    "ContingencyDrawdownBaseViewSet", ContingencyDrawdown, ContingencyDrawdownSerializer, ("drawdown_number", "reason")
)
AdvancePaymentBaseViewSet = scoped_viewset(
    "AdvancePaymentBaseViewSet", AdvancePayment, AdvancePaymentSerializer, ("contractor_name", "notes")
)
RequisitionBaseViewSet = scoped_viewset(
    "RequisitionBaseViewSet", Requisition, RequisitionSerializer, ("title", "description")
)
CertificateBaseViewSet = scoped_viewset(
    "CertificateBaseViewSet", Certificate, CertificateSerializer, ("number", "contractor_name")
)
DisbursementBaseViewSet = scoped_viewset("DisbursementBaseViewSet", Disbursement, DisbursementSerializer)
DrawdownRequestBaseViewSet = scoped_viewset(
    "DrawdownRequestBaseViewSet", DrawdownRequest, DrawdownRequestSerializer, ("request_number", "purpose")
)


# ── Full ViewSets with business logic ─────────────────────────────────────────

class ProvisionalSumViewSet(ProvisionalSumBaseViewSet):
    write_permission = 'monitoring.commercial'

    def perform_create(self, serializer):
        now = int(time() * 1000)
        serializer.save(
            organization=self._validate_organization(serializer),
            status="pending", ascertained_amount=0, created_at=now, updated_at=now,
        )

    def perform_update(self, serializer):
        raise ValidationError({"provisional_sum": "Use the controlled ascertain or close action."})

    def perform_destroy(self, instance):
        if instance.status != "pending":
            raise ValidationError({"provisional_sum": "Only pending provisional sums can be deleted."})
        instance.delete()

    @action(detail=True, methods=("post",))
    def ascertain(self, request, pk=None):
        item = self.get_object()
        if item.status != "pending":
            raise ValidationError({"status": "Only pending provisional sums can be ascertained."})
        try:
            amount = Decimal(str(request.data.get("ascertained_amount", "")))
        except Exception:
            raise ValidationError({"ascertained_amount": "Enter a valid amount."})
        if amount < 0:
            raise ValidationError({"ascertained_amount": "The amount cannot be negative."})
        item.ascertained_amount = amount
        item.status = "ascertained"
        item.notes = str(request.data.get("notes", item.notes))
        item.updated_at = int(time() * 1000)
        item.save(update_fields=("ascertained_amount", "status", "notes", "updated_at"))
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=("post",))
    def close(self, request, pk=None):
        item = self.get_object()
        if item.status != "ascertained":
            raise ValidationError({"status": "Ascertain the provisional sum before closing it."})
        item.status = "closed"
        item.updated_at = int(time() * 1000)
        item.save(update_fields=("status", "updated_at"))
        return Response(self.get_serializer(item).data)


class ContingencyDrawdownViewSet(ContingencyDrawdownBaseViewSet):
    write_permission = 'monitoring.commercial'

    def perform_create(self, serializer):
        now = int(time() * 1000)
        serializer.save(
            organization=self._validate_organization(serializer),
            status="requested", created_at=now, updated_at=now,
        )

    def perform_update(self, serializer):
        raise ValidationError({"drawdown": "Use the controlled decision action."})

    def perform_destroy(self, instance):
        raise ValidationError({"drawdown": "Contingency requests cannot be deleted."})

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def decide(self, request, pk=None):
        item = ContingencyDrawdown.objects.select_for_update().select_related("project").filter(
            pk=pk, organization=get_active_organization(request)
        ).first()
        if not item:
            return Response({"detail": "Contingency request not found."}, status=404)
        decision = str(request.data.get("decision", ""))
        reason = str(request.data.get("reason", "")).strip()
        if item.status != "requested" or decision not in ("approved", "rejected"):
            raise ValidationError({"decision": "A requested drawdown may be approved or rejected."})
        if decision == "rejected" and not reason:
            raise ValidationError({"reason": "A rejection reason is required."})
        if decision == "approved":
            allowance = (item.project.budget or Decimal(0)) * Decimal("0.05")
            approved = ContingencyDrawdown.objects.filter(
                project=item.project, status="approved"
            ).aggregate(total=Sum("amount"))["total"] or Decimal(0)
            if item.amount > allowance - approved:
                raise ValidationError({"amount": "The request exceeds the remaining 5% contingency allowance."})
            item.approved_by = request.user
            item.approved_at = int(time() * 1000)
        elif reason:
            item.reason = f"{item.reason}\nRejection: {reason}"
        item.status = decision
        item.updated_at = int(time() * 1000)
        item.save()
        return Response(self.get_serializer(item).data)


class AdvancePaymentViewSet(AdvancePaymentBaseViewSet):
    write_permission = 'monitoring.commercial'

    def perform_create(self, serializer):
        now = int(time() * 1000)
        serializer.save(
            organization=self._validate_organization(serializer),
            status="active", recovered_amount=0, created_at=now, updated_at=now,
        )

    def perform_update(self, serializer):
        raise ValidationError({"advance": "Post an append-only recovery event."})

    def perform_destroy(self, instance):
        raise ValidationError({"advance": "Advance payment history cannot be deleted."})

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def recover(self, request, pk=None):
        advance = AdvancePayment.objects.select_for_update().filter(
            pk=pk, organization=get_active_organization(request)
        ).first()
        if not advance:
            return Response({"detail": "Advance payment not found."}, status=404)
        if advance.status != "active":
            raise ValidationError({"status": "Only active advances accept recoveries."})
        try:
            amount = Decimal(str(request.data.get("amount_recovered", "")))
        except Exception:
            raise ValidationError({"amount_recovered": "Enter a valid recovery amount."})
        outstanding = advance.amount - advance.recovered_amount
        if amount <= 0 or amount > outstanding:
            raise ValidationError({"amount_recovered": "Recovery must be positive and cannot exceed the outstanding balance."})
        now = int(time() * 1000)
        AdvanceRecovery.objects.create(
            advance_payment=advance,
            certificate_number=str(request.data.get("certificate_number", "")),
            amount_recovered=amount,
            created_at=now,
        )
        advance.recovered_amount += amount
        advance.updated_at = now
        if advance.recovered_amount == advance.amount:
            advance.status = "fully_recovered"
        advance.save(update_fields=("recovered_amount", "updated_at", "status"))
        return Response(self.get_serializer(advance).data)


class AdvanceRecoveryViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.finance'
    queryset = AdvanceRecovery.objects.select_related("advance_payment__project")
    serializer_class = AdvanceRecoverySerializer
    organization_field = "advance_payment__organization"
    search_fields = ("advance_payment__contractor_name", "certificate_number")
    http_method_names = ("get", "head", "options")


class RequisitionViewSet(RequisitionBaseViewSet):
    write_permission = 'monitoring.finance'

    def perform_create(self, serializer):
        now = int(time() * 1000)
        serializer.save(
            organization=self._validate_organization(serializer),
            status="submitted", raised_by=self.request.user, created_at=now, updated_at=now,
        )

    def perform_update(self, serializer):
        raise ValidationError({"requisition": "Use the controlled workflow actions."})

    def perform_destroy(self, instance):
        raise ValidationError({"requisition": "Finance requisitions cannot be deleted."})

    @action(detail=True, methods=("post",))
    def review(self, request, pk=None):
        requisition = self.get_object()
        if requisition.status != "submitted":
            raise ValidationError({"status": "Only submitted requisitions can be reviewed."})
        requisition.status = "reviewed"
        requisition.reviewed_by = request.user
        requisition.updated_at = int(time() * 1000)
        requisition.save(update_fields=("status", "reviewed_by", "updated_at"))
        return Response(self.get_serializer(requisition).data)

    @action(detail=True, methods=("post",))
    def decide(self, request, pk=None):
        requisition = self.get_object()
        decision = str(request.data.get("decision", ""))
        if requisition.status != "reviewed" or decision not in ("approved", "rejected"):
            raise ValidationError({"decision": "A reviewed requisition may be approved or rejected."})
        requisition.status = decision
        requisition.approved_by = request.user
        requisition.updated_at = int(time() * 1000)
        requisition.save(update_fields=("status", "approved_by", "updated_at"))
        return Response(self.get_serializer(requisition).data)


class CertificateViewSet(CertificateBaseViewSet):
    write_permission = 'monitoring.finance'
    """Financial certificates are permanent audit records; they may only be voided."""

    def perform_update(self, serializer):
        current = self.get_object()
        requested_status = serializer.validated_data.get("status", current.status)
        if current.status == "void":
            raise ValidationError({"status": "A void certificate is immutable."})
        if requested_status != "void":
            raise ValidationError({"status": "Issued certificates may only be voided."})
        if not serializer.validated_data.get("void_reason", current.void_reason):
            raise ValidationError({"void_reason": "A reason is required to void a certificate."})
        serializer.save(voided_by=self.request.user, voided_at=int(time() * 1000))

    def perform_destroy(self, instance):
        raise ValidationError({"certificate": "Certificates cannot be deleted; void the record instead."})

    @action(detail=True, methods=["post"], url_path="void")
    def void(self, request, pk=None):
        certificate = self.get_object()
        if certificate.status == "void":
            raise ValidationError({"status": "A void certificate is immutable."})
        reason = str(request.data.get("reason") or request.data.get("void_reason") or "").strip()
        if not reason:
            raise ValidationError({"reason": "A reason is required to void a certificate."})
        certificate.status = "void"
        certificate.void_reason = reason
        certificate.voided_by = request.user
        certificate.voided_at = int(time() * 1000)
        certificate.save(update_fields=["status", "void_reason", "voided_by", "voided_at"])
        return Response(self.get_serializer(certificate).data)

    @action(detail=False, methods=["post"], url_path="generate-ipc")
    @transaction.atomic
    def generate_ipc(self, request):
        """Generates a JBC/FIDIC-compliant Interim Payment Certificate (IPC) incorporating
        cumulative BoQ work done, Materials on Site (80%), approved variations, retention,
        advance payment recovery, and previous certified deductions."""
        from ..valuation import calculate_materials_on_site, amortize_advance_payments
        from ..models import ProjectDocument, DocumentVersion

        organization = get_active_organization(request)
        data = request.data or {}
        project_id = str(data.get("project_id") or "").strip()
        project = (
            Project.objects.filter(id=project_id, organization=organization).first()
            if organization else Project.objects.filter(id=project_id).first()
        )
        if not project:
            raise ValidationError({"project_id": "Project not found."})

        number = str(data.get("number") or "").strip()
        if not number:
            existing_count = Certificate.objects.filter(project_id=project.id).count()
            number = f"IPC-{project.code or 'PRJ'}-{existing_count + 1:03d}"

        cert_type = str(data.get("cert_type") or "interim").strip()
        cur_gross = Decimal(str(data.get("current_gross") or 0)).quantize(Decimal("0.01"))
        variations = Decimal(str(data.get("variations") or data.get("variations_amount") or 0)).quantize(Decimal("0.01"))
        retention_pct = Decimal(str(data.get("retention_percent") or 5)).quantize(Decimal("0.01"))
        advance_rec = Decimal(str(data.get("advance_recovery") or 0)).quantize(Decimal("0.01"))
        prev_cert = Decimal(str(data.get("previous_certified") or 0)).quantize(Decimal("0.01"))

        mos_info = calculate_materials_on_site(project)
        mos_val = Decimal(str(data.get("materials_on_site") or mos_info.get("mos_certified_value") or 0)).quantize(Decimal("0.01"))

        gross = (cur_gross + variations + mos_val).quantize(Decimal("0.01"))
        retention_amt = (gross * retention_pct / Decimal("100")).quantize(Decimal("0.01"))
        net_payable = max(Decimal("0.00"), (gross - retention_amt - advance_rec)).quantize(Decimal("0.01"))

        boq_snapshot = data.get("boq_items") or []
        valuation_meta = data.get("valuation_metadata") or {}
        valuation_meta["materials_on_site"] = float(mos_val)
        valuation_meta["materials_on_site_lines"] = mos_info.get("lines", [])
        supporting_docs = data.get("supporting_documents") or []

        now_ms = int(time() * 1000)
        cert = Certificate.objects.create(
            organization=project.organization,
            project_id=str(project.id),
            cert_type=cert_type,
            number=number,
            contractor_name=str(data.get("contractor_name") or project.client_name or "Main Contractor"),
            amount=gross,
            previous_certified=prev_cert,
            current_gross=cur_gross,
            variations_amount=variations,
            retention_percent=retention_pct,
            retention_amount=retention_amt,
            advance_recovery=advance_rec,
            net_payable=net_payable,
            boq_snapshot=boq_snapshot,
            valuation_metadata=valuation_meta,
            supporting_documents=supporting_docs,
            issued_by=request.user,
            issued_at=now_ms,
            status="issued",
        )

        Disbursement.objects.create(
            organization=project.organization,
            project_id=str(project.id),
            certificate=cert,
            amount=net_payable,
            status="pending",
            managed_by=request.user,
            created_at=now_ms,
        )

        # Automatically amortize active Advance Payments when advance_recovery > 0
        if advance_rec > 0:
            amortize_advance_payments(
                project=project,
                organization=project.organization,
                certificate_number=cert.number,
                recovery_amount=advance_rec,
                now_ms=now_ms,
            )

        # Register supporting documents in the ProjectDocument register
        for doc_meta in supporting_docs:
            if isinstance(doc_meta, dict) and doc_meta.get("name"):
                doc_title = f"{number} — {doc_meta['name']}"[:255]
                proj_doc, _ = ProjectDocument.objects.get_or_create(
                    organization=project.organization,
                    project=project,
                    title=doc_title,
                    defaults={
                        "discipline": "Commercial / QS",
                        "created_at": now_ms,
                    },
                )
                remote_url = doc_meta.get("remote_url") or f"/media/ipc/{project.id}/{number}/{doc_meta['name']}"
                if not DocumentVersion.objects.filter(document=proj_doc, remote_url=remote_url).exists():
                    next_ver = proj_doc.versions.count() + 1
                    ext = str(doc_meta["name"]).rsplit(".", 1)[-1].lower() if "." in str(doc_meta["name"]) else "pdf"
                    DocumentVersion.objects.create(
                        document=proj_doc,
                        version=next_ver,
                        revision_number=f"Rev {next_ver}",
                        remote_url=remote_url,
                        file_format=ext[:16],
                        uploaded_by=request.user,
                        uploaded_at=now_ms,
                    )
                doc_meta["remote_url"] = remote_url
                doc_meta["document_id"] = proj_doc.id
        if supporting_docs:
            cert.supporting_documents = supporting_docs
            cert.save(update_fields=["supporting_documents"])

        # Update certified quantities/amounts on BoQ items submitted in this valuation
        for line in boq_snapshot:
            item_id = line.get("boq_item_id") or line.get("item_number")
            val_amt = Decimal(str(line.get("valuation_amount") or 0))
            if item_id and val_amt > 0:
                boq_item = (
                    BoQItem.objects.filter(project=project, id=item_id).first()
                    if str(item_id).isdigit()
                    else BoQItem.objects.filter(project=project, item_number=str(item_id)).first()
                )
                if boq_item:
                    prev_item_cert = Decimal(str(boq_item.certified_amount or 0))
                    if line.get("is_incremental"):
                        new_cert = (prev_item_cert + val_amt).quantize(Decimal("0.01"))
                        if boq_item.amount and new_cert > Decimal(str(boq_item.amount)):
                            new_cert = Decimal(str(boq_item.amount)).quantize(Decimal("0.01"))
                        boq_item.certified_amount = new_cert
                    else:
                        boq_item.certified_amount = max(prev_item_cert, val_amt).quantize(Decimal("0.01"))
                    rate = Decimal(str(boq_item.rate or 0))
                    if rate > 0:
                        boq_item.certified_quantity = (boq_item.certified_amount / rate).quantize(Decimal("0.0001"))
                    boq_item.cost_state = "certified"
                    boq_item.save(update_fields=["certified_amount", "certified_quantity", "cost_state"])

        return Response({
            "certificate": self.get_serializer(cert).data,
            "breakdown": {
                "previous_certified": str(prev_cert),
                "current_gross": str(cur_gross),
                "materials_on_site": str(mos_val),
                "variations": str(variations),
                "gross": str(gross),
                "retention_percent": str(retention_pct),
                "retention_amount": str(retention_amt),
                "advance_recovery": str(advance_rec),
                "net_payable": str(net_payable),
            },
        }, status=201)

    @action(detail=True, methods=["get"], url_path="pdf")
    def generate_pdf(self, request, pk=None):
        """Generates an audit-grade Interim Payment Certificate (IPC) PDF using ReportLab."""
        certificate = self.get_object()
        project = Project.objects.filter(id=certificate.project_id).first()
        org = certificate.organization

        from io import BytesIO
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=15 * mm,
            leftMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "CertTitle",
            parent=styles["Title"],
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#0f172a"),
            alignment=1,
        )
        subtitle_style = ParagraphStyle(
            "CertSubtitle",
            parent=styles["Normal"],
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#475569"),
            alignment=1,
        )
        heading_style = ParagraphStyle(
            "CertHeading",
            parent=styles["Heading2"],
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#1e293b"),
            spaceBefore=10,
            spaceAfter=6,
        )
        body_style = ParagraphStyle(
            "CertBody",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#334155"),
        )
        bold_style = ParagraphStyle(
            "CertBold",
            parent=body_style,
            fontName="Helvetica-Bold",
        )

        elements = []

        # Header
        org_name = org.name if org else "Center Estates"
        elements.append(Paragraph(f"<b>{org_name.upper()}</b>", title_style))
        elements.append(Paragraph("INTERIM PAYMENT VALUATION CERTIFICATE (IPC)", subtitle_style))
        elements.append(Spacer(1, 6 * mm))

        # Certificate & Project Meta Table
        issued_date_str = (
            datetime.datetime.fromtimestamp(certificate.issued_at / 1000, tz=datetime.timezone.utc).strftime("%d %B %Y")
            if certificate.issued_at else "Draft / Pending"
        )
        cert_num = getattr(certificate, "number", None) or getattr(certificate, "certificate_number", None) or f"IPC-{certificate.id}"
        proj_name = f"{project.name} ({project.code or ''})" if project else certificate.project_id
        proj_contract = (getattr(project, "contract_type", None) or "Standard FIDIC/JBC") if project else "Standard FIDIC/JBC"
        proj_client = (project.client_name if project and project.client_name else "M/S Client")
        proj_loc = (project.location if project and project.location else "Nairobi, Kenya")
        proj_budget = float(project.budget or 0) if project else 0.0

        meta_data = [
            [Paragraph("<b>Certificate No:</b>", body_style), Paragraph(str(cert_num), bold_style),
             Paragraph("<b>Issue Date:</b>", body_style), Paragraph(issued_date_str, body_style)],
            [Paragraph("<b>Project:</b>", body_style), Paragraph(proj_name, body_style),
             Paragraph("<b>Contract Type:</b>", body_style), Paragraph(proj_contract, body_style)],
            [Paragraph("<b>Client:</b>", body_style), Paragraph(proj_client, body_style),
             Paragraph("<b>Status:</b>", body_style), Paragraph(certificate.status.upper(), bold_style)],
            [Paragraph("<b>Site Location:</b>", body_style), Paragraph(proj_loc, body_style),
             Paragraph("<b>Tender Sum:</b>", body_style), Paragraph(f"KES {proj_budget:,.2f}", bold_style)],
        ]
        meta_table = Table(meta_data, colWidths=[35*mm, 55*mm, 35*mm, 55*mm])
        meta_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 6 * mm))

        # Valuation Breakdown Table
        elements.append(Paragraph("Valuation Summary & Statutory Deductions", heading_style))
        cur_gross = float(certificate.current_gross or certificate.amount or 0)
        variations = float(getattr(certificate, "variations_amount", 0) or 0)
        mos_val = float((certificate.valuation_metadata or {}).get("materials_on_site") or 0)
        total_gross = cur_gross + variations + mos_val
        retention_pct = float(certificate.retention_percent or 5.0)
        retention_amt = float(certificate.retention_amount or (total_gross * retention_pct / 100.0))
        advance_rec = float(certificate.advance_recovery or 0)
        prev_cert = float(certificate.previous_certified or 0)
        net_payable = float(certificate.net_payable or (total_gross - retention_amt - advance_rec))

        val_data = [
            [Paragraph("<b>Item Description</b>", bold_style), Paragraph("<b>Amount (KES)</b>", bold_style)],
            [Paragraph("1. Gross Permanent Works Executed", body_style), Paragraph(f"{cur_gross:,.2f}", body_style)],
            [Paragraph("2. Materials on Site (Unfixed @ 80%)", body_style), Paragraph(f"{mos_val:,.2f}", body_style)],
            [Paragraph("3. Approved Contract Variations & Change Orders", body_style), Paragraph(f"{variations:,.2f}", body_style)],
            [Paragraph("<b>Subtotal (Gross Valuation)</b>", bold_style), Paragraph(f"<b>{total_gross:,.2f}</b>", bold_style)],
            [Paragraph(f"4. Less: Retention Fund ({retention_pct:.1f}%)", body_style), Paragraph(f"({retention_amt:,.2f})", body_style)],
            [Paragraph("5. Less: Mobilisation Advance Payment Recovery", body_style), Paragraph(f"({advance_rec:,.2f})", body_style)],
            [Paragraph("6. Reference: Previously Certified Interim Payments", body_style), Paragraph(f"{prev_cert:,.2f}", body_style)],
            [Paragraph("<b>NET CERTIFIED AMOUNT PAYABLE</b>", bold_style), Paragraph(f"<b>KES {net_payable:,.2f}</b>", bold_style)],
        ]
        val_table = Table(val_data, colWidths=[120*mm, 60*mm])
        val_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
            ("BACKGROUND", (0, 3), (-1, 3), colors.HexColor("#f1f5f9")),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#dcfce7")),
            ("TEXTCOLOR", (0, -1), (-1, -1), colors.HexColor("#166534")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(val_table)
        elements.append(Spacer(1, 10 * mm))

        # Sign-off Blocks
        elements.append(Paragraph("Professional Certifications & Approvals", heading_style))
        signs_data = [
            [
                Paragraph("<b>Prepared by:</b><br/>Clerk of Works / Resident Eng.<br/><br/><br/>Sign: ___________________<br/>Date: ___________________", body_style),
                Paragraph("<b>Quantity Surveyor:</b><br/>Consultant QS (IQSK / BORAQS)<br/><br/><br/>Sign: ___________________<br/>Date: ___________________", body_style),
                Paragraph("<b>Client Authorisation:</b><br/>Project Steering Committee<br/><br/><br/>Sign: ___________________<br/>Date: ___________________", body_style),
            ]
        ]
        signs_table = Table(signs_data, colWidths=[60*mm, 60*mm, 60*mm])
        signs_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        elements.append(signs_table)

        doc.build(elements)
        pdf = buffer.getvalue()
        buffer.close()

        response = HttpResponse(pdf, content_type="application/pdf")
        filename = f"IPC_{cert_num}.pdf"
        response["Content-Disposition"] = f'inline; filename="{filename}"'
        return response


class DisbursementViewSet(DisbursementBaseViewSet):
    write_permission = 'monitoring.finance'

    def perform_create(self, serializer):
        certificate = serializer.validated_data.get("certificate")
        organization = self._validate_organization(serializer)
        if certificate and (certificate.organization_id != organization.id or certificate.status == "void"):
            raise ValidationError({"certificate": "Select a current certificate from this organization."})
        serializer.save(
            organization=organization, status="pending",
            managed_by=self.request.user, created_at=int(time() * 1000),
        )

    def perform_update(self, serializer):
        raise ValidationError({"disbursement": "Use the pay or void action."})

    def perform_destroy(self, instance):
        raise ValidationError({"disbursement": "Disbursements cannot be deleted; void the record instead."})

    @action(detail=True, methods=("post",))
    def pay(self, request, pk=None):
        disbursement = self.get_object()
        if disbursement.status != "pending":
            raise ValidationError({"status": "Only pending disbursements can be paid."})
        disbursement.status = "paid"
        disbursement.paid_at = int(time() * 1000)
        disbursement.save(update_fields=("status", "paid_at"))
        return Response(self.get_serializer(disbursement).data)

    @action(detail=True, methods=("post",))
    def void(self, request, pk=None):
        disbursement = self.get_object()
        reason = str(request.data.get("reason", "")).strip()
        if disbursement.status == "void" or not reason:
            raise ValidationError({"reason": "A non-void disbursement requires a void reason."})
        disbursement.status = "void"
        disbursement.void_reason = reason
        disbursement.voided_by = request.user
        disbursement.voided_at = int(time() * 1000)
        disbursement.save(update_fields=("status", "void_reason", "voided_by", "voided_at"))
        return Response(self.get_serializer(disbursement).data)


class DrawdownRequestViewSet(DrawdownRequestBaseViewSet):
    write_permission = 'monitoring.finance'

    def perform_create(self, serializer):
        now = int(time() * 1000)
        serializer.save(
            organization=self._validate_organization(serializer),
            status="submitted", requested_by=self.request.user, created_at=now, updated_at=now,
        )

    def perform_update(self, serializer):
        raise ValidationError({"drawdown": "Use the controlled workflow action."})

    def perform_destroy(self, instance):
        raise ValidationError({"drawdown": "Drawdown requests cannot be deleted."})

    @action(detail=True, methods=("post",))
    def transition(self, request, pk=None):
        drawdown = self.get_object()
        action_name = str(request.data.get("action", ""))
        transitions = {
            "submitted": {"review_documents": "document_review", "reject": "rejected"},
            "document_review": {"review_valuation": "valuation_review", "reject": "rejected"},
            "valuation_review": {"approve": "approved", "reject": "rejected"},
            "approved": {"disburse": "disbursed"},
        }
        target = transitions.get(drawdown.status, {}).get(action_name)
        if not target:
            raise ValidationError({"action": f"Action {action_name or '(missing)'} is not valid from {drawdown.status}."})
        notes = str(request.data.get("notes", "")).strip()
        if target == "rejected" and not notes:
            raise ValidationError({"notes": "A rejection reason is required."})
        now = int(time() * 1000)
        drawdown.status = target
        drawdown.reviewed_by = request.user
        drawdown.updated_at = now
        if notes:
            drawdown.reviewer_notes = notes
        if "valuation_amount" in request.data:
            drawdown.valuation_amount = request.data["valuation_amount"] or None
        if target == "approved":
            drawdown.approved_at = now
        if target == "disbursed":
            drawdown.disbursed_at = now
        drawdown.save()
        return Response(self.get_serializer(drawdown).data)


class ChatMessageViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.site'
    queryset = ChatMessage.objects.select_related("sender", "recipient", "project")
    serializer_class = ChatMessageSerializer
    search_fields = ("body", "channel", "attachment_name")

    def get_queryset(self):
        from django.db.models import Q
        return super().get_queryset().filter(Q(sender=self.request.user) | Q(recipient=self.request.user))

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        project = serializer.validated_data.get("project")
        if project and project.organization_id != organization.id:
            raise ValidationError({"project": "The project belongs to another organization."})
        serializer.save(organization=organization, sender=self.request.user, created_at=int(time() * 1000))

    def perform_update(self, serializer):
        raise ValidationError({"message": "Messages are immutable; use the read action."})

    def perform_destroy(self, instance):
        if instance.sender_id != self.request.user.id:
            raise ValidationError({"message": "Only the sender can delete an unread message."})
        if instance.read_at is not None:
            raise ValidationError({"message": "Read messages are retained in the conversation history."})
        instance.delete()

    @action(detail=True, methods=("post",), url_path="mark-read")
    def mark_read(self, request, pk=None):
        message = self.get_object()
        if message.recipient_id != request.user.id:
            raise ValidationError({"message": "Only the recipient can mark this message read."})
        if message.read_at is None:
            message.read_at = int(time() * 1000)
            message.save(update_fields=("read_at",))
        return Response(self.get_serializer(message).data)

    @action(detail=False, methods=("get",), url_path="unread-count")
    def unread_count(self, request):
        return Response({"count": self.get_queryset().filter(recipient=request.user, read_at__isnull=True).count()})


class NotificationViewSet(ConstructionScopedViewSet):
    queryset = Notification.objects.select_related("recipient")
    serializer_class = NotificationSerializer
    http_method_names = ("get", "post", "patch", "head", "options")

    def get_queryset(self):
        return super().get_queryset().filter(recipient=self.request.user)

    def perform_update(self, serializer):
        allowed = set(serializer.validated_data) <= {"read_at"}
        if not allowed:
            raise ValidationError({"notification": "Only read status may be changed."})
        serializer.save(read_at=int(time() * 1000))

    @action(detail=True, methods=("post",), url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if notification.read_at is None:
            notification.read_at = int(time() * 1000)
            notification.save(update_fields=("read_at",))
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=("post",), url_path="read-all")
    def read_all(self, request):
        read_at = int(time() * 1000)
        count = self.get_queryset().filter(read_at__isnull=True).update(read_at=read_at)
        return Response({"updated": count, "read_at": read_at})

    @action(detail=False, methods=("get",), url_path="unread-count")
    def unread_count(self, request):
        return Response({"count": self.get_queryset().filter(read_at__isnull=True).count()})


class AdminAuditLogViewSet(ConstructionScopedViewSet):
    queryset = AdminAuditLog.objects.select_related("user")
    serializer_class = AdminAuditLogSerializer
    search_fields = ("action", "category", "resource", "resource_id")
    http_method_names = ("get", "head", "options")
