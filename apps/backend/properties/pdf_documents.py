"""Branded, tenant-scoped financial PDF documents for Property Management."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal
from io import BytesIO, StringIO
from pathlib import Path
import csv

from django.conf import settings as django_settings
from django.db.models import Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
)

from .models import CreditNote, Expense, Invoice, LandlordInvoice, Lease, Receipt


RED = colors.HexColor("#dc2626")
NAVY = colors.HexColor("#17243b")
# Metadata must remain readable after browser scaling and office printing.
# The previous slate-500 was too faint in addresses, periods and footers.
MUTED = colors.HexColor("#334155")
LINE = colors.HexColor("#dbe3ec")
PALE = colors.HexColor("#f4f7fa")
GREEN = colors.HexColor("#047857")


def _money(value) -> str:
    return f"KES {Decimal(value or 0):,.2f}"


def _accounting(value, *, credit=False) -> str:
    amount = Decimal(value or 0)
    if credit and amount:
        return f"({amount:,.2f})"
    return f"({abs(amount):,.2f})" if amount < 0 else f"{amount:,.2f}"


_ONES = ("zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen")
_TENS = ("", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety")


def _under_thousand(number: int) -> str:
    parts = []
    if number >= 100:
        parts.extend((_ONES[number // 100], "hundred")); number %= 100
    if number >= 20:
        parts.append(_TENS[number // 10]); number %= 10
    if number:
        parts.append(_ONES[number])
    return " ".join(parts)


def amount_in_words(value) -> str:
    amount = Decimal(value or 0).quantize(Decimal("0.01"))
    whole, cents = int(amount), int((amount % 1) * 100)
    if whole == 0:
        words = "zero"
    else:
        groups = ((1_000_000_000, "billion"), (1_000_000, "million"), (1_000, "thousand"), (1, ""))
        parts = []
        for divisor, label in groups:
            count, whole = divmod(whole, divisor)
            if count:
                parts.append(_under_thousand(count))
                if label: parts.append(label)
        words = " ".join(parts)
    return f"Kenya shillings {words}{f' and {cents:02d}/100' if cents else ''} only".title()


def _branding(organization):
    settings = getattr(organization, "settings", None) or {}
    branding = settings.get("branding") if isinstance(settings.get("branding"), dict) else {}
    org_name = getattr(organization, "company_name", None) or getattr(organization, "name", "") or "CeEst"
    logo_url = getattr(organization, "logo_url", None) or branding.get("logo_url") or settings.get("logo_url") or ""

    # Ensure Legend Management organization accurately maps its dedicated logo
    if "legend" in org_name.lower() or (getattr(organization, "slug", "") and "legend" in organization.slug.lower()):
        if not logo_url:
            logo_url = "/legend-site-logo.png"

    return {
        "name": org_name,
        "address": branding.get("address") or settings.get("address") or f"{org_name} Property Management",
        "phone": branding.get("phone") or settings.get("phone") or "",
        "email": branding.get("email") or settings.get("email") or "",
        "pin": branding.get("tax_pin") or settings.get("tax_pin") or settings.get("pin") or "",
        "logo": logo_url,
    }


def _styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="DocTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=16, leading=20, textColor=NAVY, spaceAfter=4))
    styles.add(ParagraphStyle(name="Section", parent=styles["Heading3"], fontName="Helvetica-Bold", fontSize=9.5, leading=13, textColor=RED, spaceBefore=7, spaceAfter=5, uppercase=True))
    styles.add(ParagraphStyle(name="Small", parent=styles["BodyText"], fontSize=8.5, leading=11, textColor=NAVY))
    styles.add(ParagraphStyle(name="HeaderSmall", parent=styles["BodyText"], fontSize=8, leading=10, textColor=colors.white, fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle(name="HeaderRight", parent=styles["BodyText"], fontSize=8, leading=10, textColor=colors.white, fontName="Helvetica-Bold", alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name="Tiny", parent=styles["BodyText"], fontSize=8, leading=10.5, textColor=NAVY))
    styles.add(ParagraphStyle(name="Right", parent=styles["Small"], alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name="CenterSmall", parent=styles["Small"], alignment=TA_CENTER))
    return styles


def _logo_path(configured_logo: str, organization=None) -> Path | None:
    """Resolve uploaded branding, organization-specific mark or fallback logo without remote I/O."""
    candidates = []

    org_name = getattr(organization, "name", "") or ""
    org_slug = getattr(organization, "slug", "") or ""
    is_legend = "legend" in org_name.lower() or "legend" in org_slug.lower() or (configured_logo and "legend" in str(configured_logo).lower())

    if is_legend:
        candidates.extend([
            Path(django_settings.BASE_DIR) / "core" / "static" / "legend-site-logo.png",
            Path(django_settings.BASE_DIR).parent / "web" / "public" / "legend-site-logo.png",
            Path(django_settings.MEDIA_ROOT) / "legend-site-logo.png",
            Path("/home2/monitori/centerestates.com/legend-site-logo.png"),
            Path("/home2/monitori/centerestates.com/public/legend-site-logo.png"),
        ])

    if configured_logo and not configured_logo.startswith(("http://", "https://", "data:")):
        relative = configured_logo.lstrip("/")
        if relative.startswith("media/"):
            candidates.append(Path(django_settings.MEDIA_ROOT) / relative.removeprefix("media/"))
        candidates.extend((
            Path(django_settings.MEDIA_ROOT) / relative,
            Path(django_settings.BASE_DIR) / "core" / "static" / relative,
            Path(django_settings.BASE_DIR) / relative,
            Path(django_settings.BASE_DIR).parent / "web" / "public" / relative,
            Path("/home2/monitori/centerestates.com") / relative,
            Path(configured_logo),
        ))

    candidates.extend([
        Path(django_settings.BASE_DIR) / "core" / "static" / "center-estates-logo.png",
        Path(django_settings.BASE_DIR).parent / "web" / "public" / "center-estates-logo.png",
        Path("/home2/monitori/centerestates.com/center-estates-logo.png"),
        Path("/home2/monitori/centerestates.com/logo.png"),
    ])
    return next((path for path in candidates if path.is_file()), None)


def _doc_response(
    organization,
    filename: str,
    story: list,
    *,
    wide=False,
    title="REPORT",
    property_name="Portfolio",
    period="As at date of generation",
    generated_by="CeEst",
    pagesize_override=None,
    disposition="inline",
):
    buffer = BytesIO(); pagesize = pagesize_override or (landscape(A4) if wide else A4)
    brand = _branding(organization)
    logo_path = _logo_path(brand["logo"], organization)
    generated_at = timezone.localtime()

    def decorate(canvas, doc):
        canvas.saveState(); width, height = pagesize
        header_bottom = height - 38 * mm
        canvas.setFillColor(colors.white); canvas.rect(0, header_bottom, width, 38 * mm, fill=1, stroke=0)
        drawn_w = 0
        if logo_path:
            try:
                img = ImageReader(str(logo_path))
                img_w, img_h = img.getSize()
                aspect = (img_w / img_h) if img_h else 1.0
                if aspect > 2.0:  # Wide horizontal landscape logo (e.g. Legend Management)
                    drawn_w = min(38 * mm, 14 * mm * aspect)
                    drawn_h = min(16 * mm, drawn_w / aspect)
                elif aspect > 1.2:  # Rectangular logo
                    drawn_w = 26 * mm
                    drawn_h = min(18 * mm, drawn_w / aspect)
                else:  # Square or portrait logo (e.g. Center Estates)
                    drawn_h = 18 * mm
                    drawn_w = min(22 * mm, drawn_h * aspect)

                logo_y = height - 10 * mm - drawn_h
                canvas.drawImage(img, 14 * mm, logo_y, width=drawn_w, height=drawn_h, preserveAspectRatio=True, anchor="w", mask="auto")
            except Exception:
                drawn_w = 0

        text_x = (14 * mm + drawn_w + 4 * mm) if drawn_w > 0 else 14 * mm
        canvas.setFillColor(NAVY); canvas.setFont("Helvetica-Bold", 11.5)
        canvas.drawString(text_x, height - 11 * mm, brand["name"][:64])
        canvas.setFont("Helvetica", 8.25); canvas.setFillColor(MUTED)
        canvas.drawString(text_x, height - 15.5 * mm, brand["address"][:76])
        contact = "  |  ".join(item for item in (brand["phone"], brand["email"], f"PIN {brand['pin']}" if brand["pin"] else "") if item)
        canvas.drawString(text_x, height - 19.5 * mm, contact[:96])
        canvas.setFillColor(NAVY); canvas.setFont("Helvetica-Bold", 10.5)
        canvas.drawRightString(width - 14 * mm, height - 11 * mm, str(title).upper()[:72])
        canvas.setFont("Helvetica-Bold", 8); canvas.drawRightString(width - 14 * mm, height - 16 * mm, str(property_name)[:86])
        canvas.setFont("Helvetica", 8.25); canvas.setFillColor(MUTED)
        canvas.drawRightString(width - 14 * mm, height - 21 * mm, str(period)[:100])
        canvas.setFillColor(RED); canvas.rect(14 * mm, header_bottom + 3 * mm, width - 28 * mm, 1.2 * mm, fill=1, stroke=0)
        canvas.setStrokeColor(LINE); canvas.line(14 * mm, 12 * mm, width - 14 * mm, 12 * mm)
        canvas.setFillColor(MUTED); canvas.setFont("Helvetica", 7.5)
        footer_text = f"Generated by CeEst  ·  {brand['name']}  ·  Generated: {generated_at:%d %b %Y, %H:%M %Z}"
        canvas.drawString(14 * mm, 7.5 * mm, footer_text)
        canvas.drawRightString(width - 14 * mm, 7.5 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc = BaseDocTemplate(buffer, pagesize=pagesize, rightMargin=14 * mm, leftMargin=14 * mm, topMargin=43 * mm, bottomMargin=17 * mm, title=title, author=brand["name"], subject=f"{property_name} — {period}")
    doc.addPageTemplates(PageTemplate(id="document", frames=[Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")], onPage=decorate))
    doc.build(story)
    response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
    response["Content-Disposition"] = f'{disposition}; filename="{filename}"'
    response["Cache-Control"] = "private, no-store"
    return response


def _info_table(rows, styles, widths=None):
    data = []
    for left_label, left_value, right_label, right_value in rows:
        data.append([Paragraph(f"<b>{left_label}</b>", styles["Tiny"]), Paragraph(str(left_value or "—"), styles["Small"]), Paragraph(f"<b>{right_label}</b>", styles["Tiny"]), Paragraph(str(right_value or "—"), styles["Small"])])
    table = Table(data, colWidths=widths or [30 * mm, 62 * mm, 32 * mm, 58 * mm], hAlign="LEFT")
    table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 4), ("LINEBELOW", (0, 0), (-1, -1), .3, LINE)]))
    return table


def invoice_pdf(invoice: Invoice, generated_by="System"):
    s = _styles(); lease = invoice.lease
    unit = invoice.unit or (lease.unit if lease else None)
    if unit is None:
        raise ValueError("An invoice PDF requires a property unit.")
    prop = unit.property
    tenant = lease.tenant if lease else None
    owner = invoice.owner if invoice.recipient_type == Invoice.RecipientType.OWNER else None
    party = owner or tenant
    metadata = invoice.metadata or {}
    persisted_lines = list(invoice.lines.select_related("billing_item").all())
    lines = [
        {
            "description": line.description,
            "quantity": line.quantity,
            "unit_rate": line.unit_rate,
            "amount": line.subtotal,
            "vat_rate": line.tax_rate,
            "vat_amount": line.tax_amount,
            "total": line.total,
        }
        for line in persisted_lines
    ]
    if not lines and isinstance(metadata.get("lines"), list):
        lines = metadata["lines"]
    if not lines:
        label = str(invoice.invoice_type or "Rent").replace("_", " ").title()
        net = invoice.subtotal or (invoice.amount - invoice.tax_amount)
        lines = [{"description": f"{label} — {prop.name} / {unit.code}", "amount": net, "vat_rate": invoice.tax_rate}]
    story = [Paragraph(f"Invoice no. <b>{invoice.number}</b>", s["Small"]), Spacer(1, 4 * mm)]
    landlord = (prop.metadata or {}).get("landlord", {})
    if owner:
        party_rows = [
            ("Owner account", owner.code, "Invoice date", invoice.issued_on.strftime("%d %b %Y")),
            ("Unit owner / landlord", owner.name, "Due date", invoice.due_on.strftime("%d %b %Y")),
            ("Customer PIN", owner.pin_number, "Billing period", metadata.get("billing_period", "—")),
            ("Property", prop.name, "Charge billed to", "Unit owner / landlord"),
            ("Unit / floor", f"{unit.code} / {unit.floor or '—'}", "Invoice status", invoice.status.upper()),
        ]
    else:
        party_rows = [
            ("Tenant no.", tenant.code, "Invoice date", invoice.issued_on.strftime("%d %b %Y")),
            ("Tenant", tenant.name, "Due date", invoice.due_on.strftime("%d %b %Y")),
            ("Customer PIN", tenant.tax_id, "Lease no.", lease.reference),
            ("Property", prop.name, "Lease period", f"{lease.starts_on:%d %b %Y} — {lease.ends_on:%d %b %Y}"),
            ("Unit / floor", f"{unit.code} / {unit.floor or '—'}", "Landlord PIN", landlord.get("pin") or "—"),
        ]
    story.append(_info_table(party_rows, s))
    story.extend([Spacer(1, 5 * mm), Paragraph("Invoice items", s["Section"])])
    data = [["DESCRIPTION", "VAT", "AMOUNT EX VAT", "VAT AMOUNT", "AMOUNT INCL VAT"]]
    for line in lines:
        net = Decimal(str(line.get("amount", 0))); rate = Decimal(str(line.get("vat_rate", invoice.tax_rate)))
        tax = Decimal(str(line.get("vat_amount", (net * rate / 100).quantize(Decimal("0.01")))))
        total = Decimal(str(line.get("total", net + tax)))
        description = str(line.get("description", "Charge"))
        quantity = Decimal(str(line.get("quantity", 1)))
        unit_rate = Decimal(str(line.get("unit_rate", net)))
        if quantity != 1:
            description = f"{description} ({quantity:g} × {_money(unit_rate)})"
        data.append([Paragraph(description, s["Small"]), f"{rate:g}%", f"{net:,.2f}", f"{tax:,.2f}", f"{total:,.2f}"])
    table = Table(data, colWidths=[72 * mm, 18 * mm, 28 * mm, 25 * mm, 30 * mm], repeatRows=1)
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8), ("ALIGN", (1, 1), (-1, -1), "RIGHT"), ("GRID", (0, 0), (-1, -1), .35, LINE), ("ROWBACKGROUNDS", (0, 1), (-1, -1), (colors.white, PALE)), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    story.extend([table, Spacer(1, 5 * mm)])
    from properties.models import PayerWalletEntry
    wallet_applied = PayerWalletEntry.objects.filter(
        organization=invoice.organization, invoice=invoice, entry_type=PayerWalletEntry.EntryType.DEBIT
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    totals_rows = [
        ["Total amount excl. VAT", _money(invoice.subtotal or invoice.amount - invoice.tax_amount)],
        ["Total VAT", _money(invoice.tax_amount)],
        ["Invoice total", _money(invoice.amount)],
    ]
    if wallet_applied > 0:
        totals_rows.append(["Less advance credit applied", f"-{_money(wallet_applied)}"])
        totals_rows.append(["Net invoice balance", _money(invoice.balance)])

    party_invoices = Invoice.objects.filter(organization=invoice.organization, owner=owner) if owner else Invoice.objects.filter(organization=invoice.organization, lease__tenant=tenant)
    prev_balance = party_invoices.exclude(pk=invoice.pk).aggregate(v=Sum("balance"))["v"] or Decimal("0.00")
    totals_rows.append(["Previous owner balance" if owner else "Previous tenant balance", _money(prev_balance)])
    total_due = party_invoices.aggregate(v=Sum("balance"))["v"] or Decimal("0.00")
    totals_rows.append(["TOTAL AMOUNT DUE", _money(total_due)])

    totals = Table(totals_rows, colWidths=[55 * mm, 43 * mm], hAlign="RIGHT")

    totals.setStyle(TableStyle([("ALIGN", (1, 0), (1, -1), "RIGHT"), ("LINEBELOW", (0, 0), (-1, -2), .3, LINE), ("BACKGROUND", (0, -1), (-1, -1), RED), ("TEXTCOLOR", (0, -1), (-1, -1), colors.white), ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8.5), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    story.append(totals)
    bank = (prop.metadata or {}).get("bank_details", {})
    story.extend([Spacer(1, 5 * mm), Paragraph("Payment details", s["Section"]), Paragraph(" · ".join(filter(None, [bank.get("bank_name"), bank.get("branch"), bank.get("account_name"), bank.get("account_number")] )) or "Use the payment instructions shown in the tenant portal.", s["Small"])])
    fiscal = metadata.get("fiscal", {})
    if fiscal: story.extend([Spacer(1, 3 * mm), Paragraph("Fiscal details", s["Section"]), Paragraph(" · ".join(f"{str(k).replace('_', ' ').title()}: {v}" for k, v in fiscal.items()), s["Tiny"])])
    return _doc_response(invoice.organization, f"invoice-{invoice.number}.pdf", story, title="Tax Invoice", property_name=prop.name, period=f"Invoice date: {invoice.issued_on:%d %b %Y}", generated_by=generated_by, disposition="inline")


def landlord_invoice_pdf(invoice: LandlordInvoice, generated_by="System", disposition="inline"):
    s = _styles()
    prop = invoice.property
    owner = invoice.owner
    metadata = invoice.metadata or {}

    is_letting = invoice.fee_type == LandlordInvoice.FeeType.LETTING
    fee_label = "Tenant Placement & Letting Fee" if is_letting else "Property Management Commission"
    doc_title = "INVOICE"
    vat_pct = int(invoice.vat_rate) if invoice.vat_rate and int(invoice.vat_rate) > 0 else 0

    story = [
        Paragraph(f"Invoice no. <b>{invoice.number}</b>", s["Small"]),
        Spacer(1, 1 * mm),
        Paragraph(fee_label, s["Small"]),
        Spacer(1, 4 * mm),
    ]

    owner_code = getattr(owner, "code", "") or metadata.get("owner_code", "")
    owner_pin = invoice.landlord_pin or getattr(owner, "pin_number", "") or "—"
    settlement_bank = ""
    if owner:
        bank_parts = list(filter(None, [
            owner.settlement_bank_name,
            f"A/C: {owner.settlement_bank_account}" if owner.settlement_bank_account else "",
            f"Branch: {owner.settlement_bank_branch}" if owner.settlement_bank_branch else "",
            f"Paybill/Till: {owner.settlement_paybill_or_till}" if owner.settlement_paybill_or_till else "",
        ]))
        settlement_bank = " · ".join(bank_parts)

    units_display = metadata.get("units_display") or (
        ", ".join(metadata.get("units", [])) if metadata.get("units") else (
            f"{owner.units.count()} Units" if (owner and owner.units.exists()) else f"{prop.name} Unit(s)"
        )
    )

    story.append(_info_table([
        ("Landlord / Owner", invoice.landlord_name, "Invoice Date", invoice.issued_on.strftime("%d %b %Y") if invoice.issued_on else "—"),
        ("Owner Account", owner_code or "—", "Due Date", invoice.due_on.strftime("%d %b %Y") if invoice.due_on else "—"),
        ("Landlord KRA PIN", owner_pin, "Billing Period", invoice.billing_period),
        ("Property", prop.name, "Fee Category", fee_label),
        ("Premises / Units", units_display, "Invoice Status", "ISSUED" if invoice.status == "sent" else invoice.status.upper()),
    ], s))

    story.extend([Spacer(1, 5 * mm), Paragraph("Service & Fee Breakdown", s["Section"])])

    vat_header = f"VAT ({vat_pct}%)" if vat_pct > 0 else "VAT"
    data = [["DESCRIPTION", "BASE / COLLECTIONS", "RATE", "NET FEE", vat_header, "TOTAL PAYABLE"]]
    # Use notes as the primary description — it contains the actionable detail
    if invoice.notes:
        desc = invoice.notes
        desc_sub = fee_label
    else:
        desc = fee_label
        if invoice.fee_type == LandlordInvoice.FeeType.MANAGEMENT:
            desc_sub = f"Commission on gross tenant collections for {invoice.billing_period}"
        else:
            desc_sub = f"Tenant onboarding & placement commission — {prop.name}"

    full_desc = f"{desc}<br/><font color='#475569' size='7'>{desc_sub}</font>"

    data.append([
        Paragraph(full_desc, s["Small"]),
        _money(invoice.gross_collections) if not is_letting else "N/A",
        f"{invoice.fee_rate:g}%" if invoice.fee_rate else "Flat",
        f"{invoice.fee_amount:,.2f}",
        f"{invoice.vat_amount:,.2f}" if vat_pct > 0 else "Exempt",
        f"{invoice.total_amount:,.2f}",
    ])

    table = Table(data, colWidths=[65 * mm, 30 * mm, 18 * mm, 24 * mm, 20 * mm, 26 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), .35, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), (colors.white, PALE)),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.extend([table, Spacer(1, 5 * mm)])

    if is_letting:
        # Letting fee: agency charges the landlord — no collections context
        settlement_rows = [
            ["Agency Letting / Placement Fee", _money(invoice.fee_amount)],
        ]
        if vat_pct > 0:
            settlement_rows.append([f"Value Added Tax (VAT {vat_pct}%)", _money(invoice.vat_amount)])
        settlement_rows.append(["TOTAL INVOICE PAYABLE", _money(invoice.total_amount)])
    else:
        settlement_rows = [
            ["Gross Rent Collections Receipted", _money(invoice.gross_collections)],
            ["Less Agency Fee (excl. VAT)", f"-{_money(invoice.fee_amount)}"],
        ]
        if vat_pct > 0:
            settlement_rows.append([f"Less Value Added Tax (VAT {vat_pct}%)", f"-{_money(invoice.vat_amount)}"])
        settlement_rows.append(["Total Management/Agency Invoiced", _money(invoice.total_amount)])
        if invoice.deductions and Decimal(str(invoice.deductions)) > 0:
            settlement_rows.append(["Less Maintenance & Withholding Deductions", f"-{_money(invoice.deductions)}"])
        settlement_rows.append(["NET LANDLORD REMITTANCE PAYOUT", _money(invoice.net_payout)])

    totals = Table(settlement_rows, colWidths=[70 * mm, 45 * mm], hAlign="RIGHT")
    totals.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, -2), .3, LINE),
        ("BACKGROUND", (0, -1), (-1, -1), GREEN),
        ("TEXTCOLOR", (0, -1), (-1, -1), colors.white),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(totals)

    story.extend([
        Spacer(1, 4 * mm),
        Paragraph(f"<b>Amount in Words:</b> {amount_in_words(invoice.total_amount)}", s["Tiny"]),
    ])

    if not is_letting:
        story.extend([
            Spacer(1, 2 * mm),
            Paragraph(f"<b>Net Remittance Payable to Landlord:</b> {_money(invoice.net_payout)} ({amount_in_words(invoice.net_payout)})", s["Tiny"]),
        ])

    if settlement_bank:
        story.extend([
            Spacer(1, 4 * mm),
            Paragraph("Designated Payment Account", s["Section"]),
            Paragraph(settlement_bank, s["Small"]),
        ])

    if not is_letting:
        note_text = ("This document constitutes an official Invoice for property management services rendered in accordance with the Property Management Agreement. "
                     "Agency fees are deducted from gross tenant collections, and the net remittance is scheduled for disbursement to the landlord's designated account above.")
        story.extend([
            Spacer(1, 4 * mm),
            Paragraph("Note", s["Section"]),
            Paragraph(note_text, s["Tiny"]),
        ])

    return _doc_response(
        invoice.organization,
        f"landlord-invoice-{invoice.number}.pdf",
        story,
        title=doc_title,
        property_name=prop.name,
        period=f"Billing Period: {invoice.billing_period}",
        generated_by=generated_by,
        disposition=disposition,
    )


def receipt_pdf(receipt: Receipt, generated_by="System"):
    s = _styles(); tenant = receipt.tenant; invoice = receipt.invoice
    prop = invoice.lease.unit.property if invoice else tenant.property
    story = [Paragraph(f"Receipt no. <b>{receipt.number}</b>", s["Small"]), Spacer(1, 4 * mm)]
    story.append(_info_table([
        ("Received from", tenant.name, "Receipt date", receipt.received_on.strftime("%d %b %Y")),
        ("Tenant account", tenant.code, "Payment method", receipt.payment_method.replace("_", " ").title()),
        ("Property", prop.name if prop else "—", "Cheque / reference", receipt.external_reference or "—"),
        ("Invoice", invoice.number if invoice else "Unapplied receipt", "Posting status", "Applied" if invoice else "Unapplied"),
    ], s))
    story.extend([Spacer(1, 6 * mm), Paragraph("Amount received", s["Section"]), Table([[Paragraph(amount_in_words(receipt.amount), s["Small"]), Paragraph(f"<b>{_money(receipt.amount)}</b>", s["Right"])]], colWidths=[115 * mm, 57 * mm], style=[("BACKGROUND", (0, 0), (-1, -1), PALE), ("BOX", (0, 0), (-1, -1), .6, LINE), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10)]), Spacer(1, 6 * mm)])
    description = invoice.invoice_type.replace("_", " ").title() if invoice else "Unapplied payment"
    story.append(Table([["ACCOUNT", "DESCRIPTION", "INVOICE", "AMOUNT"], [tenant.code, description, invoice.number if invoice else "—", _money(receipt.amount)]], colWidths=[38 * mm, 70 * mm, 35 * mm, 35 * mm], style=[("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8), ("GRID", (0, 0), (-1, -1), .4, LINE), ("ALIGN", (-1, 1), (-1, -1), "RIGHT"), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
    brand = _branding(receipt.organization)
    story.extend([Spacer(1, 10 * mm), Paragraph(f"Served by: {receipt.received_by.get_full_name() or receipt.received_by.get_username()}", s["Small"]), Paragraph(f"This computer-generated receipt is valid without a physical stamp. Verify it from the {brand['name']} tenant ledger.", s["Tiny"])])
    return _doc_response(receipt.organization, f"receipt-{receipt.number}.pdf", story, title="Official Receipt", property_name=prop.name if prop else "Portfolio", period=f"Receipt date: {receipt.received_on:%d %b %Y}", generated_by=generated_by)


def tenant_statement_pdf(tenant, start: date | None = None, end: date | None = None, generated_by="System"):
    s = _styles(); end = end or date.today(); start = start or end.replace(month=1, day=1)
    invoices = Invoice.objects.filter(organization=tenant.organization, lease__tenant=tenant).select_related("lease__unit__property")
    receipts = Receipt.objects.filter(organization=tenant.organization, tenant=tenant)
    credits = CreditNote.objects.filter(organization=tenant.organization, invoice__lease__tenant=tenant).exclude(status="void")
    opening = (invoices.filter(issued_on__lt=start).aggregate(v=Sum("amount"))["v"] or Decimal("0")) - (receipts.filter(received_on__lt=start).aggregate(v=Sum("amount"))["v"] or Decimal("0")) - (credits.filter(issued_on__lt=start).aggregate(v=Sum("amount"))["v"] or Decimal("0"))
    events = []
    for row in invoices.filter(issued_on__range=(start, end)):
        events.append((row.issued_on, row.number, row.number, row.invoice_type.replace("_", " ").title(), row.amount, Decimal("0")))
    for row in receipts.filter(received_on__range=(start, end)):
        events.append((row.received_on, row.number, row.external_reference, "Rent payment", Decimal("0"), row.amount))
    for row in credits.filter(issued_on__range=(start, end)):
        events.append((row.issued_on, row.number, row.invoice.number, f"Credit note: {row.reason}", Decimal("0"), row.amount))
    events.sort(key=lambda item: (item[0], item[1]))
    lease = tenant.leases.select_related("unit__property").order_by("-starts_on").first(); prop = lease.unit.property if lease else tenant.property
    story = [
        _info_table([
            ("Tenant", tenant.name, "Property", prop.name if prop else "—"),
            ("Tenant no.", tenant.code, "Unit / floor", f"{lease.unit.code} / {lease.unit.floor or '—'}" if lease else "—"),
            ("Tenant PIN", tenant.tax_id, "Lease no.", lease.reference if lease else "—"),
            ("Commencement", lease.starts_on if lease else "—", "Expiry", lease.ends_on if lease else "—"),
        ], s, widths=[34 * mm, 100 * mm, 35 * mm, 100 * mm]),
        Spacer(1, 5 * mm)
    ]
    data = [["POSTING DATE", "DOCUMENT NO.", "TRANSACTION REF.", "DESCRIPTION", "DEBIT", "CREDIT", "BALANCE"]]
    balance = opening
    data.append([start.strftime("%d/%m/%Y"), "", "", "Opening balance", "", "", f"{balance:,.2f}"])
    for posted, document, reference, description, debit, credit in events:
        balance += debit - credit
        data.append([
            posted.strftime("%d/%m/%Y"),
            Paragraph(document, s["Small"]),
            Paragraph(reference or "", s["Small"]),
            Paragraph(description, s["Small"]),
            f"{debit:,.2f}" if debit else "",
            f"{credit:,.2f}" if credit else "",
            f"{balance:,.2f}"
        ])
    data.append(["", "", "", "TOTALS", f"{sum((event[4] for event in events), Decimal('0')):,.2f}", f"{sum((event[5] for event in events), Decimal('0')):,.2f}", f"{balance:,.2f}"])
    table = Table(data, colWidths=[24 * mm, 42 * mm, 44 * mm, 73 * mm, 28 * mm, 28 * mm, 30 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), PALE),
        ("FONTNAME", (3, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("GRID", (0, 0), (-1, -1), .3, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5)
    ]))
    story.append(table)
    return _doc_response(tenant.organization, f"tenant-statement-{tenant.code}-{start}-{end}.pdf", story, wide=True, title="Tenant Statement", property_name=prop.name if prop else "Portfolio", period=f"{start:%d %b %Y} — {end:%d %b %Y}", generated_by=generated_by)


def tenant_payment_status_rows(organization, property_record, start: date, end: date):
    """Build the client-approved billing and collection ledger for one property."""
    leases = Lease.objects.filter(
        organization=organization, unit__property=property_record,
        starts_on__lte=end, ends_on__gte=start,
    ).exclude(status=Lease.Status.TERMINATED).select_related("tenant", "unit").order_by("unit__floor", "unit__code", "tenant__name")
    rows = []
    for lease in leases:
        invoices = Invoice.objects.filter(
            organization=organization, lease=lease,
            status__in=(Invoice.Status.ISSUED, Invoice.Status.PARTIAL, Invoice.Status.PAID, Invoice.Status.OVERDUE),
        )
        receipts = Receipt.objects.filter(organization=organization, tenant=lease.tenant).filter(
            Q(invoice__lease=lease) | Q(invoice__isnull=True),
        )
        credits = CreditNote.objects.filter(organization=organization, invoice__lease=lease).exclude(status="void")
        opening = (
            (invoices.filter(issued_on__lt=start).aggregate(v=Sum("amount"))["v"] or Decimal("0"))
            - (receipts.filter(received_on__lt=start).aggregate(v=Sum("amount"))["v"] or Decimal("0"))
            - (credits.filter(issued_on__lt=start).aggregate(v=Sum("amount"))["v"] or Decimal("0"))
        )
        current = invoices.filter(issued_on__range=(start, end)).aggregate(v=Sum("amount"))["v"] or Decimal("0")
        received = receipts.filter(received_on__range=(start, end)).aggregate(v=Sum("amount"))["v"] or Decimal("0")
        current_credits = credits.filter(issued_on__range=(start, end)).aggregate(v=Sum("amount"))["v"] or Decimal("0")
        total = opening + current
        closing = total - received - current_credits
        effective_on = min(end, lease.ends_on)
        rows.append({
            "tenant": lease.tenant.name, "unit": lease.unit.code,
            "floor": lease.unit.floor or "Unspecified", "rent": lease.effective_rent(effective_on),
            "payment_mode": (lease.metadata or {}).get("payment_mode", "Monthly"),
            "billed_to": min(end, lease.ends_on), "opening": opening, "current": current,
            "total": total, "receipts": received + current_credits, "closing": closing,
        })
    return rows


def tenant_payment_status_pdf(organization, property_record, start: date, end: date, generated_by="System"):
    s = _styles(); rows = tenant_payment_status_rows(organization, property_record, start, end)
    header_style = ParagraphStyle(
        "TenantPaymentHeader",
        parent=s["Tiny"],
        fontName="Helvetica-Bold",
        fontSize=6.6,
        leading=7.6,
        alignment=TA_CENTER,
        textColor=colors.black,
    )
    metadata = property_record.metadata or {}; landlord = metadata.get("landlord", {})
    story = [
        _info_table([
            ("CLIENT", landlord.get("name") or "—", "PROPERTY", property_record.name),
            ("L.R No.", metadata.get("lr_number") or metadata.get("lr_no") or "—", "MONTH", end.strftime("%B %Y")),
        ], s, widths=[24 * mm, 92 * mm, 24 * mm, 107 * mm]),
        Spacer(1, 5 * mm),
    ]
    month_label = end.strftime("%B %Y").upper()
    data = [
        [
            Paragraph("NAME OF TENANT", header_style),
            Paragraph("No.", header_style),
            Paragraph("Rent Per<br/>Month", header_style),
            Paragraph("Mode of<br/>Payment", header_style),
            Paragraph("Billings<br/>Upto", header_style),
            Paragraph(f"BILLINGS<br/>({month_label})", header_style),
            "",
            "",
            Paragraph(f"Receipts Upto<br/>{end:%d.%m.%Y}", header_style),
            Paragraph("Outstanding<br/>Balance C/F", header_style),
        ],
        ["", "", "", "", "", Paragraph("Balance B/F", header_style), Paragraph("Current", header_style), Paragraph("Total Current<br/>Billings", header_style), "", ""],
    ]
    for row in rows:
        data.append([
            Paragraph(str(row["tenant"]), s["Small"]), row["unit"], _accounting(row["rent"]), row["payment_mode"],
            row["billed_to"].strftime("%d/%m/%Y"), _accounting(row["opening"]), _accounting(row["current"]),
            _accounting(row["total"]), _accounting(row["receipts"], credit=True), _accounting(row["closing"]),
        ])
    totals = {key: sum((Decimal(row[key]) for row in rows), Decimal("0")) for key in ("rent", "opening", "current", "total", "receipts", "closing")}
    data.append(["TOTAL", "", _accounting(totals["rent"]), "", "", _accounting(totals["opening"]), _accounting(totals["current"]), _accounting(totals["total"]), _accounting(totals["receipts"], credit=True), _accounting(totals["closing"])])
    table = Table(data, colWidths=[42*mm, 14*mm, 24*mm, 21*mm, 23*mm, 24*mm, 21*mm, 27*mm, 25*mm, 26*mm], repeatRows=2)
    table.setStyle(TableStyle([
        ("SPAN", (0, 0), (0, 1)), ("SPAN", (1, 0), (1, 1)), ("SPAN", (2, 0), (2, 1)),
        ("SPAN", (3, 0), (3, 1)), ("SPAN", (4, 0), (4, 1)), ("SPAN", (5, 0), (7, 0)),
        ("SPAN", (8, 0), (8, 1)), ("SPAN", (9, 0), (9, 1)),
        ("BACKGROUND", (0, 0), (-1, 1), colors.white), ("TEXTCOLOR", (0, 0), (-1, -1), colors.black),
        ("FONTNAME", (0, 0), (-1, 1), "Helvetica-Bold"), ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#eeeeee")), ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), .45, colors.black),
        ("TOPPADDING", (0, 0), (-1, 1), 4), ("BOTTOMPADDING", (0, 0), (-1, 1), 4),
        ("TOPPADDING", (0, 2), (-1, -1), 5), ("BOTTOMPADDING", (0, 2), (-1, -1), 5),
    ]))
    story.append(table)
    return _doc_response(
        organization, f"tenants-payments-status-{property_record.code}-{end:%Y-%m}.pdf", story,
        wide=True, title="Tenants Payment's Status Report", property_name=property_record.name,
        period=f"{start:%d %b %Y} — {end:%d %b %Y}", generated_by=generated_by,
        pagesize_override=landscape(letter),
    )


def income_expenditure_pdf(organization, property_record, start: date, end: date, generated_by="System"):
    s = _styles()
    year_start = start.replace(month=1, day=1)

    receipts = Receipt.objects.filter(organization=organization, received_on__lte=end).filter(
        Q(invoice__lease__unit__property=property_record) | Q(invoice__isnull=True, tenant__property=property_record),
    )
    expenses = Expense.objects.filter(
        organization=organization, property=property_record, incurred_on__lte=end,
        status__in=(Expense.Status.APPROVED, Expense.Status.PAID)
    )

    current_receipts = receipts.filter(received_on__gte=start)
    ytd_receipts = receipts.filter(received_on__gte=year_start)
    current_expenses = expenses.filter(incurred_on__gte=start)
    ytd_expenses = expenses.filter(incurred_on__gte=year_start)

    rent_curr = sum((r.amount for r in current_receipts if not r.invoice or r.invoice.invoice_type == "rent"), Decimal("0"))
    rent_ytd = sum((r.amount for r in ytd_receipts if not r.invoice or r.invoice.invoice_type == "rent"), Decimal("0"))

    sc_curr = sum((r.amount for r in current_receipts if r.invoice and r.invoice.invoice_type == "service_charge"), Decimal("0"))
    sc_ytd = sum((r.amount for r in ytd_receipts if r.invoice and r.invoice.invoice_type == "service_charge"), Decimal("0"))

    other_curr = sum((r.amount for r in current_receipts if r.invoice and r.invoice.invoice_type not in ("rent", "service_charge")), Decimal("0"))
    other_ytd = sum((r.amount for r in ytd_receipts if r.invoice and r.invoice.invoice_type not in ("rent", "service_charge")), Decimal("0"))

    total_rec_curr = rent_curr + sc_curr + other_curr
    total_rec_ytd = rent_ytd + sc_ytd + other_ytd

    categories = [
        "1 Utilities", "2 Services", "3 Repairs", "4 Consumables", "5 Maintenance",
        "6 Salaries & Wages", "7 Management Fees & VAT", "8 Letting Fees & VAT",
        "9 Administration Expenses", "10 Insurance", "11 Land Rents & Rates", "12 Deposit Refunds"
    ]

    def _cat_key(cat_str: str) -> str:
        c = (cat_str or "").lower()
        if "util" in c or "water" in c or "power" in c or "elec" in c: return "1 Utilities"
        if "service" in c or "secu" in c or "clean" in c: return "2 Services"
        if "repair" in c: return "3 Repairs"
        if "consum" in c or "bulb" in c: return "4 Consumables"
        if "maint" in c or "lift" in c or "gen" in c: return "5 Maintenance"
        if "sal" in c or "wag" in c or "care" in c or "staff" in c or "nssf" in c: return "6 Salaries & Wages"
        if "manag" in c or "fee" in c: return "7 Management Fees & VAT"
        if "letting" in c or "agent" in c: return "8 Letting Fees & VAT"
        if "admin" in c or "airtime" in c or "transport" in c: return "9 Administration Expenses"
        if "insur" in c: return "10 Insurance"
        if "rate" in c or "rent" in c or "land" in c: return "11 Land Rents & Rates"
        if "ref" in c or "dep" in c: return "12 Deposit Refunds"
        return "9 Administration Expenses"

    exp_curr_map = defaultdict(Decimal)
    exp_ytd_map = defaultdict(Decimal)

    for e in current_expenses:
        exp_curr_map[_cat_key(e.category)] += e.amount
    for e in ytd_expenses:
        exp_ytd_map[_cat_key(e.category)] += e.amount

    total_exp_curr = sum(exp_curr_map.values(), Decimal("0"))
    total_exp_ytd = sum(exp_ytd_map.values(), Decimal("0"))

    surplus_curr = total_rec_curr - total_exp_curr
    surplus_ytd = total_rec_ytd - total_exp_ytd

    metadata = property_record.metadata or {}
    landlord = metadata.get("landlord", {})
    lr_number = metadata.get("lr_number") or metadata.get("lr_no") or "—"

    story = [
        _info_table([
            ("PROPERTY", property_record.name, "STATEMENT PERIOD", f"{start:%d %b %Y} — {end:%d %b %Y}"),
            ("L.R No.", lr_number, "PROPERTY CODE", property_record.code),
            ("CLIENT / LANDLORD", landlord.get("name") or "Landlord", "CURRENCY", "KES"),
        ], s, widths=[29 * mm, 58 * mm, 32 * mm, 65 * mm]),
        Spacer(1, 5 * mm),
    ]

    p_pct = lambda part, tot: f"{(part / tot * 100) if tot else 0:.1f}%"
    data = [["CATEGORY", "REF", "CURRENT PERIOD", "%", f"CUMULATIVE {end.year}", "%"]]
    data.append([Paragraph("<b>[A] RECEIPTS</b>", s["Small"]), "", "", "", "", ""])
    data.append(["1 Rent received as per statement", "Note (A)", f"{rent_curr:,.2f}", p_pct(rent_curr, total_rec_curr), f"{rent_ytd:,.2f}", p_pct(rent_ytd, total_rec_ytd)])
    data.append(["2 Service Charges received", "Note (A)", f"{sc_curr:,.2f}", p_pct(sc_curr, total_rec_curr), f"{sc_ytd:,.2f}", p_pct(sc_ytd, total_rec_ytd)])
    data.append(["3 Others (Rent Deposit / Misc)", "Note (A)", f"{other_curr:,.2f}", p_pct(other_curr, total_rec_curr), f"{other_ytd:,.2f}", p_pct(other_ytd, total_rec_ytd)])
    data.append(["TOTAL RECEIPTS", "", f"{total_rec_curr:,.2f}", "100%", f"{total_rec_ytd:,.2f}", "100%"])

    data.append([Paragraph("<b>[B] DISBURSEMENTS</b>", s["Small"]), "", "", "", "", ""])
    for idx, cat in enumerate(categories, 1):
        c_val = exp_curr_map[cat]
        y_val = exp_ytd_map[cat]
        data.append([cat, f"Note (B{idx})", f"{c_val:,.2f}", p_pct(c_val, total_rec_curr), f"{y_val:,.2f}", p_pct(y_val, total_rec_ytd)])

    data.append(["TOTAL DISBURSEMENTS", "", f"{total_exp_curr:,.2f}", p_pct(total_exp_curr, total_rec_curr), f"{total_exp_ytd:,.2f}", p_pct(total_exp_ytd, total_rec_ytd)])
    data.append(["SURPLUS / (DEFICIT) ON PROPERTY", "", f"{surplus_curr:,.2f}", p_pct(surplus_curr, total_rec_curr), f"{surplus_ytd:,.2f}", p_pct(surplus_ytd, total_rec_ytd)])

    table = Table(data, colWidths=[70 * mm, 18 * mm, 30 * mm, 14 * mm, 32 * mm, 20 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("GRID", (0, 0), (-1, -1), .3, LINE),
        ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), (colors.white, PALE)),
        ("BACKGROUND", (0, 5), (-1, 5), colors.HexColor("#eef2ff")), ("FONTNAME", (0, 5), (-1, 5), "Helvetica-Bold"),
        ("BACKGROUND", (0, -2), (-1, -2), colors.HexColor("#fee2e2")), ("FONTNAME", (0, -2), (-1, -2), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#dcfce7")), ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
    ]))
    story.append(table)

    story.extend([
        Spacer(1, 6 * mm),
        Paragraph("NOTES [A] RECEIPTS DETAIL BREAKDOWN", s["Section"]),
        Table(
            [["TENANT / UNIT CODE", "RECEIPT NO.", "RENT", "SERVICE CHARGE", "DEPOSITS", "TOTAL"]] +
            [
                [
                    f"{r.tenant.name} ({r.tenant.code})", r.number,
                    f"{r.amount:,.2f}" if (not r.invoice or r.invoice.invoice_type == "rent") else "0.00",
                    f"{r.amount:,.2f}" if (r.invoice and r.invoice.invoice_type == "service_charge") else "0.00",
                    f"{r.amount:,.2f}" if (r.invoice and r.invoice.invoice_type not in ("rent", "service_charge")) else "0.00",
                    f"{r.amount:,.2f}"
                ] for r in current_receipts.select_related("tenant", "invoice")
            ] +
            [["TOTALS", "", f"{rent_curr:,.2f}", f"{sc_curr:,.2f}", f"{other_curr:,.2f}", f"{total_rec_curr:,.2f}"]],
            colWidths=[50 * mm, 24 * mm, 25 * mm, 25 * mm, 25 * mm, 30 * mm],
            repeatRows=1,
            style=[
                ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), .3, LINE), ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("BACKGROUND", (0, -1), (-1, -1), PALE), ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ]
        )
    ])

    story.extend([
        Spacer(1, 6 * mm),
        Paragraph("NOTES [B] DISBURSEMENTS DETAIL BREAKDOWN", s["Section"]),
        Table(
            [["DATE", "CATEGORY", "SUPPLIER / PAYEE", "REFERENCE", "DESCRIPTION", "AMOUNT"]] +
            [
                [
                    row.incurred_on.strftime("%d/%m/%Y"), _cat_key(row.category),
                    row.supplier or "—", row.invoice_number or "—",
                    Paragraph(row.description or "—", s["Small"]), f"{row.amount:,.2f}"
                ] for row in current_expenses
            ] +
            [["TOTALS", "", "", "", "", f"{total_exp_curr:,.2f}"]],
            colWidths=[18 * mm, 30 * mm, 35 * mm, 25 * mm, 45 * mm, 26 * mm],
            repeatRows=1,
            style=[
                ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), .3, LINE), ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("BACKGROUND", (0, -1), (-1, -1), PALE), ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ]
        )
    ])

    return _doc_response(
        organization, f"income-expenditure-{property_record.code}-{start}-{end}.pdf", story,
        wide=False, title="Receipts & Expenditure Account", property_name=property_record.name,
        period=f"{start:%d %b %Y} — {end:%d %b %Y}", generated_by=generated_by,
        pagesize_override=letter,
    )


def _looks_numeric(value: str) -> bool:
    cleaned = str(value or "").replace(",", "").replace("%", "").replace("KES", "").replace("$", "").strip()
    if not cleaned: return False
    try:
        float(cleaned)
        return True
    except ValueError:
        return False


def _format_report_cell(value: str, *, header: str = "") -> str:
    raw = str(value or "").strip()
    if not raw: return "—"
    if _looks_numeric(raw) and not any(k in header.lower() for k in ("code", "no", "number", "id", "phone", "pin", "unit", "lease")):
        try:
            val = float(raw.replace(",", "").replace("%", "").replace("KES", "").strip())
            return f"{val:,.2f}"
        except ValueError:
            pass
    return raw


def _clean_header_label(header: str) -> str:
    h = str(header or "").strip()
    cleanups = {
        "Escalation Interval (Months)": "Escalation<br/>Interval (Mos)",
        "Escalation Interval Months": "Escalation<br/>Interval (Mos)",
        "Escalation %": "Escalation<br/>%",
        "Next Effective Rent": "Next Effective<br/>Rent",
        "Service Charge": "Service<br/>Charge",
        "Lease Start": "Lease<br/>Start",
        "Lease End": "Lease<br/>End",
        "Payment Mode": "Payment<br/>Mode",
        "Billings Up To": "Billings<br/>Up To",
        "Total Current Billings": "Total Current<br/>Billings",
        "Days Outstanding": "Days<br/>Overdue",
        "Days Overdue": "Days<br/>Overdue",
        "Outstanding C/F": "Outstanding<br/>C/F",
        "Balance B/F": "Balance<br/>B/F",
        "Receipt Count": "Receipt<br/>Count",
        "Total Collected": "Total<br/>Collected",
        "Original Amount": "Original<br/>Amount",
        "Available Since": "Available<br/>Since",
        "Expected Rent": "Expected<br/>Rent",
        "Vacancy Reason": "Vacancy<br/>Reason",
        "Marketing Status": "Marketing<br/>Status",
        "Taxable Value": "Taxable<br/>Value",
        "VAT Amount": "VAT<br/>Amount",
        "Output VAT": "Output<br/>VAT",
        "Input VAT": "Input<br/>VAT",
        "Annualized Income": "Annualized<br/>Income",
        "Projected Rent": "Projected<br/>Rent",
        "Lease Status": "Lease<br/>Status",
        "Budget Code": "Budget<br/>Code",
        "Cost Centre": "Cost<br/>Centre",
        "Document Type": "Document<br/>Type",
        "Document Number": "Document<br/>No.",
        "Insurance Expiry": "Insurance<br/>Expiry",
        "License Expiry": "License<br/>Expiry",
        "Work Order": "Work<br/>Order",
    }
    return cleanups.get(h, h)


def _column_widths(headers: list[str], rows: list[list[str]], page_width: float) -> list[float]:
    """Calculate balanced column widths ensuring numeric/date values never clip or wrap digits."""
    num_cols = len(headers)
    if num_cols == 0:
        return [page_width]

    min_widths = []
    flex_weights = []

    for index, header in enumerate(headers):
        h_lower = header.lower()
        samples = [row[index] for row in rows[:50] if index < len(row)]
        max_content_len = max((len(str(s or "")) for s in samples), default=len(header))

        is_money = any(k in h_lower for k in ("rent", "amount", "charge", "balance", "total", "subtotal", "paid", "billed", "vat", "net", "tax", "fee", "cost", "spend"))
        is_date = any(k in h_lower for k in ("date", "start", "end", "due", "issued", "expires", "completed"))
        is_rate = any(k in h_lower for k in ("%", "rate", "ratio", "interval", "days", "count", "score"))
        is_use = any(k in h_lower for k in ("use", "category", "specialty", "status", "party", "action"))
        is_code = any(k in h_lower for k in ("unit", "floor", "code", "no", "number", "ref", "area", "type"))
        is_long_text = any(k in h_lower for k in ("tenant", "supplier", "description", "name", "contractor", "party", "reason", "comment"))

        if is_money:
            base_min = 25 * mm
            flex = 1.0
        elif is_date:
            base_min = 22 * mm
            flex = 0.8
        elif is_use:
            base_min = 27 * mm
            flex = 1.3
        elif is_rate:
            base_min = 18 * mm
            flex = 0.6
        elif is_code:
            base_min = 20 * mm
            flex = 0.9
        elif is_long_text:
            base_min = 34 * mm
            flex = 2.4
        else:
            base_min = max(max_content_len * 1.8 * mm, 18 * mm)
            flex = 1.2

        min_widths.append(base_min)
        flex_weights.append(flex)

    total_min = sum(min_widths)

    # If total minimum widths exceed printable page width, proportionally scale down
    if total_min >= page_width:
        scale = page_width / total_min
        return [w * scale for w in min_widths]

    # Distribute excess remaining width proportionally according to flex weight
    remaining_space = page_width - total_min
    total_flex = sum(flex_weights) or 1.0

    final_widths = [
        min_widths[i] + (remaining_space * (flex_weights[i] / total_flex))
        for i in range(num_cols)
    ]
    return final_widths


def tabular_report_pdf(
    organization,
    title: str,
    filename: str,
    csv_content: bytes,
    *,
    property_name="Portfolio",
    period="As at date of generation",
    generated_by="CeEst",
    subtitle="",
):
    """Render the same authoritative dataset offered as CSV into a client-ready PDF."""
    s = _styles()
    rows = list(csv.reader(StringIO(csv_content.decode("utf-8-sig"))))
    if not rows:
        rows = [["Message"], ["No records match the selected property, period and filters."]]
    raw_headers = [str(cell).replace("_", " ").strip().title() for cell in rows[0]]
    raw_body = rows[1:] if len(rows) > 1 else []

    # Strip redundant "Property" column since Property is already prominently displayed in the report header
    prop_indices = {
        i for i, h in enumerate(raw_headers)
        if h.lower() in ("property", "property name", "property_name", "property code")
    }
    if prop_indices and len(raw_headers) > 1:
        headers = [h for i, h in enumerate(raw_headers) if i not in prop_indices]
        body = [[cell for i, cell in enumerate(row) if i not in prop_indices] for row in raw_body]
    else:
        headers = raw_headers
        body = raw_body

    column_count = max(len(headers), max((len(row) for row in body), default=0), 1)
    headers = (headers + [""] * column_count)[:column_count]
    body = [row + [""] * (column_count - len(row)) for row in body]
    page_width = landscape(A4)[0] - 28 * mm
    widths = _column_widths(headers, body, page_width)
    numeric_cols = {
        index for index, header in enumerate(headers)
        if body and sum(1 for row in body if _looks_numeric(row[index])) >= max(1, len(body) // 2)
    }
    data = [[
        Paragraph(f"<b>{_clean_header_label(headers[index])}</b>", s["HeaderSmall"])
        for index in range(column_count)
    ]]
    for row in body:
        data.append([
            Paragraph(_format_report_cell(row[index], header=headers[index]), s["Small"])
            for index in range(column_count)
        ])
    table = Table(data, colWidths=widths, repeatRows=1)
    style_commands = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("GRID", (0, 0), (-1, -1), .3, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), (colors.white, PALE)), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.5), ("RIGHTPADDING", (0, 0), (-1, -1), 2.5),
    ]
    if body and str(body[-1][0]).strip().upper() in {"TOTAL", "TOTALS", "GRAND TOTAL", "SURPLUS / (DEFICIT)"}:
        style_commands.extend([
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#eef2ff")),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ])
    table.setStyle(TableStyle(style_commands))
    story = [
        table,
    ]
    return _doc_response(
        organization, filename, story, wide=True, title=title, property_name=property_name,
        period=period, generated_by=generated_by,
    )


def arrears_aging_pdf(organization, property_name: str, rows: list[dict], summary: dict, *, period: str, generated_by="CeEst"):
    """Branded arrears register with age buckets and collection priority."""
    s = _styles()
    bucket_data = [["BUCKET", "AMOUNT (KES)", "SHARE"]]
    total = sum((Decimal(summary.get(key) or 0) for key in ("current", "31_60", "61_90", "90_plus")), Decimal("0"))
    labels = (("current", "0–30 days"), ("31_60", "31–60 days"), ("61_90", "61–90 days"), ("90_plus", "90+ days"))
    for key, label in labels:
        amount = Decimal(summary.get(key) or 0)
        share = f"{(amount / total * 100):.1f}%" if total else "0.0%"
        bucket_data.append([label, f"{amount:,.2f}", share])
    bucket_data.append(["TOTAL ARREARS", f"{total:,.2f}", "100%"])
    buckets = Table(bucket_data, colWidths=[55 * mm, 40 * mm, 25 * mm], repeatRows=1)
    buckets.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("BACKGROUND", (0, -1), (-1, -1), RED),
        ("TEXTCOLOR", (0, -1), (-1, -1), colors.white), ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"), ("GRID", (0, 0), (-1, -1), .3, LINE),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story = [Paragraph("Ageing summary", s["Section"]), buckets, Spacer(1, 5 * mm), Paragraph("Tenant arrears detail", s["Section"])]
    detail = [["INVOICE", "TENANT", "UNIT", "DUE ON", "DAYS", "BUCKET", "BILLED", "PAID", "BALANCE", "STATUS"]]
    for row in rows:
        detail.append([
            row.get("invoice", ""), Paragraph(str(row.get("tenant", "")), s["Small"]),
            row.get("unit", ""),
            row.get("due_on", ""), row.get("days_overdue", ""), str(row.get("ageing_bucket", "")).replace("_", "–"),
            f"{Decimal(row.get('billed') or 0):,.2f}", f"{Decimal(row.get('paid') or 0):,.2f}",
            f"{Decimal(row.get('balance') or 0):,.2f}", str(row.get("status", "")).replace("_", " ").title(),
        ])
    if len(detail) == 1:
        detail.append(["—", "No open arrears for this period", "", "", "", "", "", "", "", ""])
    detail_table = Table(detail, colWidths=[20 * mm, 42 * mm, 18 * mm, 20 * mm, 14 * mm, 20 * mm, 24 * mm, 24 * mm, 24 * mm, 20 * mm], repeatRows=1)
    detail_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), .3, LINE), ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), (colors.white, PALE)),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
    ]))
    story.append(detail_table)
    story.extend([
        Spacer(1, 5 * mm),
        Paragraph(
            "Collection priority should focus on balances aged beyond 60 days. "
            "Figures reconcile to open invoices excluding void and fully paid documents.",
            s["Small"],
        ),
    ])
    return _doc_response(
        organization, f"arrears-ageing-{date.today():%Y%m%d}.pdf", story, wide=True,
        title="Arrears Ageing Analysis", property_name=property_name, period=period, generated_by=generated_by,
    )


def service_charge_reconciliation_pdf(reconciliation, generated_by="System"):
    s = _styles()
    scheme = reconciliation.service_charge
    prop = scheme.property
    org = scheme.organization

    story = [
        Paragraph("Service Charge Reconciliation Statement", s["Title"]),
        Spacer(1, 4 * mm),
    ]

    info_rows = [
        ("Scheme / Cost Centre", scheme.name),
        ("Property", prop.name),
        ("Reconciliation Period", f"{reconciliation.period_start:%d %b %Y} – {reconciliation.period_end:%d %b %Y}"),
        ("Apportionment Basis", str(scheme.get_method_display() if hasattr(scheme, 'get_method_display') else scheme.method).title()),
        ("Scheme Annual Budget", _money(scheme.annual_budget)),
        ("Reconciliation Status", str(reconciliation.status).upper()),
    ]
    story.append(_info_table(info_rows, s))
    story.append(Spacer(1, 5 * mm))

    variance_val = reconciliation.variance
    is_surplus = variance_val >= 0
    var_label = "SURPLUS (UNDER BUDGET)" if is_surplus else "DEFICIT (OVER BUDGET)"

    summary_table_data = [
        ["FINANCIAL METRIC", "AMOUNT (KES)", "ASSESSMENT"],
        ["Prorated Period Budget", f"{Decimal(reconciliation.budgeted_amount):,.2f}", "Calculated based on elapsed days"],
        ["Actual Incurred Expenditure", f"{Decimal(reconciliation.actual_amount):,.2f}", "Approved & paid property expenses"],
        [f"Net Variance [{var_label}]", f"{Decimal(abs(variance_val)):,.2f}", "Credit adjustment due" if is_surplus else "Balancing billing required"],
    ]
    sum_table = Table(summary_table_data, colWidths=[65 * mm, 45 * mm, 65 * mm])
    sum_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, -1), (-1, -1), GREEN if is_surplus else RED),
        ("TEXTCOLOR", (0, -1), (-1, -1), colors.white),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(sum_table)
    story.append(Spacer(1, 6 * mm))

    allocations = list(scheme.allocations.select_related('unit').order_by('unit__code'))
    if allocations:
        story.append(Paragraph("Unit-Level Apportionment & Variance Breakdown", s["Section"]))
        alloc_table_data = [["UNIT", "AREA (M²)", "SHARE RATIO", "PERIOD BUDGET", "ACTUAL SHARE", "VARIANCE"]]
        for alloc in allocations:
            u_area = f"{alloc.unit.area:,.1f}" if alloc.unit.area else "—"
            u_ratio = f"{(alloc.ratio * 100):.2f}%"
            u_budget = (reconciliation.budgeted_amount * alloc.ratio).quantize(Decimal('0.01'))
            u_actual = (reconciliation.actual_amount * alloc.ratio).quantize(Decimal('0.01'))
            u_var = u_budget - u_actual
            alloc_table_data.append([
                alloc.unit.code,
                u_area,
                u_ratio,
                f"{u_budget:,.2f}",
                f"{u_actual:,.2f}",
                f"{u_var:,.2f}",
            ])
        alloc_table = Table(alloc_table_data, colWidths=[25 * mm, 25 * mm, 25 * mm, 35 * mm, 35 * mm, 30 * mm], repeatRows=1)
        alloc_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.3, LINE),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), (colors.white, PALE)),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(alloc_table)
        story.append(Spacer(1, 6 * mm))

    prep_name = reconciliation.prepared_by.get_full_name() or reconciliation.prepared_by.get_username() if reconciliation.prepared_by else "System"
    rev_name = (reconciliation.reviewed_by.get_full_name() or reconciliation.reviewed_by.get_username()) if reconciliation.reviewed_by else "Pending Review"
    rev_date = f"{reconciliation.reviewed_at:%d %b %Y %H:%M}" if reconciliation.reviewed_at else "Pending"

    sign_data = [
        ["PREPARED BY", "REVIEWED & APPROVED BY", "APPROVAL DATE"],
        [prep_name, rev_name, rev_date],
    ]
    sign_table = Table(sign_data, colWidths=[60 * mm, 65 * mm, 50 * mm])
    sign_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PALE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.3, LINE),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(sign_table)

    return _doc_response(
        org, f"service-charge-reconciliation-{reconciliation.id}.pdf", story,
        title="Service Charge Reconciliation", property_name=prop.name,
        period=f"{reconciliation.period_start:%b %Y} – {reconciliation.period_end:%b %Y}",
        generated_by=generated_by,
    )
