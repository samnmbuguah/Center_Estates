#!/usr/bin/env python3
"""Generate deterministic client-review samples without changing live PDF layouts."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, LETTER, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

OUT = ROOT / "docs" / "quality" / "golden-reports" / "samples"
OUT.mkdir(parents=True, exist_ok=True)
LOGO = ROOT / "apps" / "web" / "public" / "center-estates-logo.png"
INK = colors.HexColor("#111827")
RED = colors.HexColor("#d51f2a")
GREY = colors.HexColor("#eef1f4")
LINE = colors.HexColor("#111111")
styles = getSampleStyleSheet()
small = ParagraphStyle("small", parent=styles["BodyText"], fontName="Helvetica", fontSize=7, leading=9, textColor=INK)
tiny = ParagraphStyle("tiny", parent=small, fontSize=5.5, leading=6.5)
right = ParagraphStyle("right", parent=small, alignment=2)
title = ParagraphStyle("title", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=INK, spaceAfter=5)


def masthead(doc_title, property_name, period):
    logo = Image(str(LOGO), width=17 * mm, height=22 * mm)
    company = Paragraph("<b>CENTER ESTATES</b><br/>Dolphine Plaza, Mbagathi Road<br/>P.O. Box 8014-00100 GPO, Nairobi, Kenya<br/>Tel: +254 722 574 400 · mail@centerestates.co.ke", small)
    meta = Paragraph(f"<b>{doc_title}</b><br/><b>{property_name}</b><br/>{period}<br/>Prepared: 11 Aug 2026", right)
    table = Table([[logo, company, meta]], colWidths=[20 * mm, 90 * mm, 78 * mm])
    table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LINEBELOW", (0, 0), (-1, -1), 1.2, RED), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    return [table, Spacer(1, 5 * mm)]


def build(name, story, pagesize=A4):
    path = OUT / name
    doc = SimpleDocTemplate(str(path), pagesize=pagesize, leftMargin=12 * mm, rightMargin=12 * mm, topMargin=10 * mm, bottomMargin=12 * mm, title=name.removesuffix(".pdf"))
    doc.build(story)


def styled_table(data, widths, font=7, right_from=None, repeat=1):
    wrapped = [[Paragraph(str(cell), tiny if font < 7 else small) for cell in row] for row in data]
    table = Table(wrapped, colWidths=widths, repeatRows=repeat)
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), GREY), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), .45, LINE), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("BACKGROUND", (0, -1), (-1, -1), GREY), ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
    ]
    if right_from is not None:
        commands.append(("ALIGN", (right_from, 1), (-1, -1), "RIGHT"))
    table.setStyle(TableStyle(commands))
    return table


def payment_status():
    rows = [
        ["Tenant", "Unit", "Rent / month", "Mode", "Billings up to", "Balance B/F", "Current", "Total billings", "Receipts up to 31.07.2026", "Balance C/F"],
        ["Acacia Consulting Ltd", "S01", "85,000.00", "Monthly", "31/07/2026", "—", "85,000.00", "85,000.00", "(85,000.00)", "—"],
        ["Bluebird Retail Ltd", "S02", "62,500.00", "Monthly", "31/07/2026", "25,000.00", "62,500.00", "87,500.00", "(60,000.00)", "27,500.00"],
        ["Cedar Health Services", "S03", "74,000.00", "Monthly", "31/07/2026", "(10,000.00)", "74,000.00", "64,000.00", "(64,000.00)", "—"],
        ["FLATS", "", "", "", "", "", "", "", "", ""],
        ["David Mwangi", "F01", "42,000.00", "Monthly", "31/07/2026", "42,000.00", "42,000.00", "84,000.00", "(42,000.00)", "42,000.00"],
        ["Fatuma Hassan", "F02", "38,000.00", "Monthly", "31/07/2026", "—", "38,000.00", "38,000.00", "(38,000.00)", "—"],
        ["TOTALS", "", "301,500.00", "", "", "57,000.00", "301,500.00", "358,500.00", "(289,000.00)", "69,500.00"],
    ]
    story = masthead("TENANTS PAYMENTS STATUS REPORT", "Nyali Trade Centre · LR No. MN/I/1024", "Month: July 2026")
    story += [Paragraph("<b>Client:</b> Center Estates Demo &nbsp;&nbsp;&nbsp; <b>Property:</b> Nyali Trade Centre", small), Spacer(1, 3 * mm), Paragraph("BILLINGS (JULY 2026)", title), styled_table(rows, [42*mm, 15*mm, 24*mm, 18*mm, 24*mm, 22*mm, 22*mm, 24*mm, 29*mm, 23*mm], font=5.5, right_from=2)]
    build("Sample - Tenants Payments Status Report.pdf", story, landscape(LETTER))


def invoice():
    story = masthead("RENT INVOICE", "Nyali Trade Centre · Unit S02", "Invoice date: 01 Jul 2026")
    story += [Paragraph("RENT INVOICE", title), styled_table([
        ["Invoice No.", "INV-2026-0712", "Tenant Account", "TNT-0002"], ["Tenant", "Bluebird Retail Ltd", "KRA PIN", "P051234567X"],
        ["Lease", "LEASE-0002", "Period", "01 Jul — 31 Jul 2026"], ["Due date", "07 Jul 2026", "Property / Unit", "Nyali Trade Centre / S02"],
    ], [30*mm, 62*mm, 30*mm, 62*mm], right_from=None, repeat=0), Spacer(1, 5*mm), styled_table([
        ["DESCRIPTION", "QTY", "RATE", "VAT", "AMOUNT EXCL. VAT"], ["Monthly rent — July 2026", "1", "62,500.00", "16%", "62,500.00"],
        ["Service charge", "1", "8,500.00", "16%", "8,500.00"], ["TOTAL", "", "", "11,360.00", "82,360.00 incl. VAT"],
    ], [78*mm, 18*mm, 28*mm, 24*mm, 36*mm], right_from=1), Spacer(1, 6*mm), Paragraph("<b>Payment details:</b> Cooperative Bank · Center Estates Client Account · A/C 01120001234500<br/><b>Reference:</b> INV-2026-0712 / TNT-0002", small)]
    build("Sample - Rent Invoice.pdf", story)


def receipt():
    story = masthead("OFFICIAL RECEIPT", "Nyali Trade Centre · Unit S02", "Receipt date: 06 Jul 2026")
    story += [Paragraph("RECEIPT", title), styled_table([
        ["Receipt No.", "RCT-2026-16269", "Cheque / Ref No.", "MPESA-QG12ABC34"], ["Description", "Rent payment", "Posting date", "06 Jul 2026"],
        ["Received from", "Bluebird Retail Ltd", "Amount received", "KES 82,360.00"],
    ], [31*mm, 61*mm, 32*mm, 60*mm], repeat=0), Spacer(1, 5*mm), Paragraph("<b>Amount in words:</b> Kenya shillings eighty two thousand three hundred sixty only", small), Spacer(1, 5*mm), styled_table([
        ["ACCOUNT", "INVOICE", "DESCRIPTION", "AMOUNT"], ["TNT-0002", "INV-2026-0712", "July rent and service charge", "82,360.00"], ["TOTAL", "", "", "82,360.00"],
    ], [32*mm, 40*mm, 76*mm, 36*mm], right_from=3), Spacer(1, 12*mm), Paragraph("Served by: Jane Mwangi<br/>This computer-generated receipt is valid without a physical stamp.", small)]
    build("Sample - Official Rent Receipt.pdf", story)


def statement():
    story = masthead("TENANT RENT STATEMENT", "Nyali Trade Centre · Unit S02", "01 Jan — 31 Jul 2026")
    story += [styled_table([["Tenant", "Bluebird Retail Ltd", "Tenant No.", "TNT-0002", "Lease", "LEASE-0002"], ["Property", "Nyali Trade Centre", "Unit", "S02", "KRA PIN", "P051234567X"]], [25*mm, 55*mm, 25*mm, 35*mm, 22*mm, 40*mm], repeat=0), Spacer(1, 5*mm), styled_table([
        ["POSTING DATE", "DOCUMENT NO.", "REFERENCE", "DESCRIPTION", "DEBIT", "CREDIT", "BALANCE"], ["01/01/2026", "", "", "Opening balance", "", "", "25,000.00"],
        ["01/07/2026", "INV-2026-0712", "LEASE-0002", "July rent and service charge", "82,360.00", "", "107,360.00"], ["06/07/2026", "RCT-2026-16269", "MPESA-QG12ABC34", "Payment received", "", "82,360.00", "25,000.00"],
        ["TOTALS", "", "", "", "82,360.00", "82,360.00", "25,000.00"],
    ], [24*mm, 33*mm, 36*mm, 62*mm, 27*mm, 27*mm, 29*mm], font=6, right_from=4)]
    build("Sample - Tenant Rent Statement.pdf", story, landscape(A4))


def income_expenditure():
    story = masthead("RECEIPTS & EXPENDITURE ACCOUNT", "Nyali Trade Centre · LR No. MN/I/1024", "01 Jul — 31 Jul 2026")
    story += [styled_table([
        ["CATEGORY", "CURRENT PERIOD", "%", "CUMULATIVE 2026", "%"], ["[A] RECEIPTS", "", "", "", ""], ["Rent receipts", "289,000.00", "88.5%", "2,450,231.00", "91.2%"],
        ["Service charge", "37,500.00", "11.5%", "236,400.00", "8.8%"], ["TOTAL RECEIPTS", "326,500.00", "100%", "2,686,631.00", "100%"], ["[B] DISBURSEMENTS", "", "", "", ""],
        ["Repairs and maintenance", "48,200.00", "14.8%", "312,400.00", "11.6%"], ["Utilities", "31,750.00", "9.7%", "224,810.00", "8.4%"], ["Management fees", "32,650.00", "10.0%", "268,663.00", "10.0%"],
        ["TOTAL DISBURSEMENTS", "112,600.00", "34.5%", "805,873.00", "30.0%"], ["SURPLUS / (DEFICIT)", "213,900.00", "", "1,880,758.00", ""],
    ], [82*mm, 35*mm, 20*mm, 38*mm, 20*mm], font=6, right_from=1), Spacer(1, 6*mm), Paragraph("Detailed receipt and disbursement schedules continue on subsequent pages in the final report.", small)]
    build("Sample - Income and Expenditure Report.pdf", story, landscape(A4))


if __name__ == "__main__":
    payment_status(); invoice(); receipt(); statement(); income_expenditure()
    print(f"Generated 5 samples in {OUT}")
