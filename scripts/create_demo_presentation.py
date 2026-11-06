#!/usr/bin/env python3
"""
Generate the Center Estates Full ERP Live Demonstration Presentation (.pptx).
Covers Property Management, Facilities Operations, Service Charge, and Performance.
"""
from pathlib import Path
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "presentations"
LOGO = ROOT / "apps" / "web" / "public" / "center-estates-logo.png"
HERO = ROOT / "apps" / "web" / "public" / "images" / "hero.jpg"
FACILITY = ROOT / "apps" / "web" / "public" / "images" / "facility.jpg"

NAVY = RGBColor(10, 33, 61)
NAVY_2 = RGBColor(18, 54, 91)
RED = RGBColor(220, 38, 38)
TEAL = RGBColor(0, 145, 138)
GREEN = RGBColor(22, 163, 74)
AMBER = RGBColor(217, 119, 6)
INK = RGBColor(15, 23, 42)
MUTED = RGBColor(55, 73, 94)
PALE = RGBColor(244, 247, 251)
WHITE = RGBColor(255, 255, 255)
LINE = RGBColor(216, 226, 236)


def add_text(slide, text, x, y, w, h, size=18, color=INK, bold=False,
             align=PP_ALIGN.LEFT, font="Liberation Sans", margin=0.04,
             valign=MSO_ANCHOR.MIDDLE, line_spacing=1.15):
    """Multi-line safe text helper that formats every paragraph."""
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.margin_left = tf.margin_right = Inches(margin)
    tf.margin_top = tf.margin_bottom = Inches(margin)
    tf.vertical_anchor = valign
    tf.word_wrap = True

    lines = str(text).split("\n")
    for idx, line in enumerate(lines):
        p = tf.paragraphs[0] if idx == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = line_spacing
        p.space_after = Pt(2)
        r = p.add_run()
        r.text = line
        r.font.name = font
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.color.rgb = color
    return box


def rect(slide, x, y, w, h, fill=WHITE, line=LINE, radius=True, corner=0.025):
    shape = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE,
        Inches(x), Inches(y), Inches(w), Inches(h),
    )
    if radius and len(shape.adjustments) > 0:
        shape.adjustments[0] = corner
    shape.shadow.inherit = False
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    if line is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = line
        shape.line.width = Pt(1)
    return shape


def base_slide(prs, section, title, subtitle=None, number=None):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg = slide.background.fill
    bg.solid()
    bg.fore_color.rgb = PALE

    rect(slide, 0, 0, 13.333, 0.16, NAVY, None, False)
    rect(slide, 0, 0.16, 13.333, 0.72, WHITE, LINE, False)

    if LOGO.exists():
        slide.shapes.add_picture(str(LOGO), Inches(0.55), Inches(0.24), height=Inches(0.52))
    add_text(slide, "Center Estates ERP", 1.25, 0.25, 3.2, 0.28, 16, NAVY, True)
    add_text(slide, "PROPERTY  •  FACILITY  •  CONSTRUCTION  •  PERFORMANCE", 1.25, 0.52, 6.5, 0.2, 8.5, MUTED, True)

    if number is not None:
        rect(slide, 12.15, 0.30, 0.65, 0.38, NAVY, None, True, corner=0.2)
        add_text(slide, f"{number:02d}", 12.15, 0.30, 0.65, 0.38, 11, WHITE, True, PP_ALIGN.CENTER)

    add_text(slide, section.upper(), 0.55, 1.02, 5.0, 0.26, 9.5, RED, True)
    add_text(slide, title, 0.55, 1.28, 12.2, 0.48, 25, INK, True)
    if subtitle:
        add_text(slide, subtitle, 0.55, 1.76, 12.0, 0.34, 12.5, MUTED)
    return slide


def bullets(slide, items, x, y, w, h, size=15.5, color=INK):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(0.08)
    tf.margin_right = Inches(0.05)
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.level = 0
        p.space_after = Pt(10)
        p.line_spacing = 1.15
        r1 = p.add_run()
        r1.text = "▸  "
        r1.font.name = "Liberation Sans"
        r1.font.size = Pt(size)
        r1.font.bold = True
        r1.font.color.rgb = RED

        r2 = p.add_run()
        r2.text = item
        r2.font.name = "Liberation Sans"
        r2.font.size = Pt(size)
        r2.font.color.rgb = color
    return box


def proof_bar(slide, text):
    rect(slide, 0.55, 6.80, 12.23, 0.44, NAVY, None, True, corner=0.08)
    rect(slide, 0.65, 6.88, 1.35, 0.28, RED, None, True, corner=0.15)
    add_text(slide, "PROOF CHAIN", 0.65, 6.88, 1.35, 0.28, 8.5, WHITE, True, PP_ALIGN.CENTER)
    add_text(slide, text, 2.15, 6.86, 10.4, 0.32, 11, WHITE, True)


def card(slide, x, y, w, h, title, body, accent=RED, icon=None):
    rect(slide, x, y, w, h, WHITE, LINE, True, corner=0.025)
    rect(slide, x, y, w, 0.08, accent, None, False)
    if icon:
        badge_w = 0.58 if len(str(icon)) > 1 else 0.42
        rect(slide, x + 0.22, y + 0.18, badge_w, 0.36, accent, None, True, corner=0.2)
        add_text(slide, icon, x + 0.22, y + 0.18, badge_w, 0.36, 11.5, WHITE, True, PP_ALIGN.CENTER)
        tx = x + 0.32 + badge_w
    else:
        tx = x + 0.24
    add_text(slide, title, tx, y + 0.18, w - (tx - x) - 0.18, 0.36, 14.5, INK, True)
    add_text(slide, body, x + 0.24, y + 0.64, w - 0.48, h - 0.78, 11.5, MUTED,
             valign=MSO_ANCHOR.TOP, margin=0.02)


def build():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Cover
    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = WHITE
    if HERO.exists():
        s.shapes.add_picture(str(HERO), 0, 0, width=prs.slide_width, height=prs.slide_height)
    rect(s, 0, 0, 5.55, 7.5, WHITE, None, False)
    rect(s, 5.43, 0, 0.12, 7.5, RED, None, False)
    if LOGO.exists():
        s.shapes.add_picture(str(LOGO), Inches(0.68), Inches(0.55), height=Inches(0.82))
    add_text(s, "Center Estates ERP", 1.62, 0.66, 3.4, 0.4, 22, NAVY, True)
    add_text(s, "LIVE PLATFORM DEMONSTRATION", 0.72, 1.95, 4.2, 0.3, 10.5, RED, True)
    add_text(s, "One operating record.\nComplete estate control.", 0.68, 2.38, 4.35, 1.35, 28, NAVY, True,
             valign=MSO_ANCHOR.TOP)
    add_text(s, "Property management, facilities operations, construction governance, and staff performance—connected from transaction to report.",
             0.72, 3.95, 4.2, 1.0, 13.5, MUTED, valign=MSO_ANCHOR.TOP)
    rect(s, 0.72, 5.28, 4.15, 0.56, RED, None, True, corner=0.12)
    add_text(s, "RECORD  →  ACT  →  VERIFY  →  REPORT", 0.86, 5.42, 3.87, 0.26, 10.5, WHITE, True, PP_ALIGN.CENTER)
    add_text(s, "Enterprise Edition  •  centerestates.com", 0.72, 6.72, 4.2, 0.25, 10, MUTED)

    # Slide 1
    s = base_slide(prs, "Demo story", "From property record to management evidence", "A focused 25–30 minute journey—not a tour of every menu.", 1)
    steps = [
        ("01", "RECORD", "Property, tenant, asset and service masters"),
        ("02", "PLAN", "Billing schedules, PPM and compliance calendars"),
        ("03", "EXECUTE", "Tasks, tickets, work orders and collections"),
        ("04", "VERIFY", "Approvals, evidence, SLA and audit trail"),
        ("05", "MEASURE", "KPIs, trends, ageing and performance"),
        ("06", "REPORT", "Tenant, manager and landlord outputs"),
    ]
    for i, (n, t, b) in enumerate(steps):
        x = 0.65 + (i % 3) * 4.15
        y = 2.45 + (i // 3) * 1.85
        card(s, x, y, 3.8, 1.55, t, b, [RED, TEAL, AMBER, NAVY_2, GREEN, RED][i], n)
    proof_bar(s, "Every dashboard number is traceable to an underlying transaction and responsible person.")

    # Slide 2
    s = base_slide(prs, "Command centre", "Start with today’s operating priorities", "Companion gives each manager one place to see what needs attention now.", 2)
    card(s, 0.65, 2.35, 2.9, 1.75, "Due today", "Planned maintenance, inspections, lease events and assigned tasks.", RED, "◷")
    card(s, 3.75, 2.35, 2.9, 1.75, "Needs attention", "Overdue actions, SLA risks, expiring compliance and approvals.", AMBER, "!")
    card(s, 6.85, 2.35, 2.9, 1.75, "Team delivery", "Assignments, progress, evidence and staff performance.", TEAL, "✓")
    card(s, 9.95, 2.35, 2.75, 1.75, "Quartermaster", "Contextual AI assistance, summaries and operational guidance.", NAVY_2, "AI")
    bullets(s, [
        "Open with the manager’s current property already selected.",
        "Use one alert as the bridge into the live workflow.",
        "Return here at the end to show the action is now reflected."
    ], 0.85, 4.45, 11.8, 1.85, 15.5)
    proof_bar(s, "The ERP behaves as an operating command centre, not a passive database.")

    # Slide 3
    s = base_slide(prs, "Property foundation", "A complete, property-scoped operating record", "Property → buildings/areas → units → tenants → services → assets.", 3)
    card(s, 0.65, 2.35, 3.8, 2.95, "Property & buildings", "Identity, address, ownership, building hierarchy, lettable area, utilities, documents and contacts.", NAVY_2, "01")
    card(s, 4.75, 2.35, 3.8, 2.95, "Units & billing schedule", "Unit use, floor, area, parking, recurring charges, deposits and utility applicability.", RED, "02")
    card(s, 8.85, 2.35, 3.8, 2.95, "Tenant & lease", "Application, contacts, assigned unit, commencement, expiry, escalation and approvals.", TEAL, "03")
    add_text(s, "All module tabs inherit the selected property—no portfolio totals inside a property workspace.", 0.8, 5.65, 11.7, 0.55, 15.5, NAVY, True, PP_ALIGN.CENTER)
    proof_bar(s, "One trusted structure eliminates duplicate setup and enables automatic downstream billing and reporting.")

    # Slide 4
    s = base_slide(prs, "Property management", "Tenancy and billing are configured once", "The unit defines what can be billed; the lease defines when rent becomes due.", 4)
    card(s, 0.65, 2.35, 3.8, 2.95, "Configure the unit", "Rent basis, service charge, utilities, parking and deposits belong to the unit billing schedule.", NAVY_2, "01")
    card(s, 4.75, 2.35, 3.8, 2.95, "Create the tenancy", "Select the unit, capture lease dates and escalation, then inherit applicable charges automatically.", RED, "02")
    card(s, 8.85, 2.35, 3.8, 2.95, "Generate invoices", "The engine checks readiness and produces separate rent and utility invoices—payable together.", TEAL, "03")
    add_text(s, "Demo action: open one active tenant and explain the source of each charge before opening invoicing.", 0.8, 5.65, 11.7, 0.45, 15, INK, True, PP_ALIGN.CENTER)
    proof_bar(s, "Billing is driven by tenancy and unit data—not rebuilt manually at month-end.")

    # Slide 5
    s = base_slide(prs, "Collections", "From invoice to receipt, allocation and arrears", "A clear financial trail for manager, landlord and tenant.", 5)
    flow = [("INVOICE", NAVY_2), ("PAYMENT", TEAL), ("RECEIPT", GREEN), ("ALLOCATION", AMBER), ("ARREARS", RED), ("REPORT", NAVY)]
    for i, (t, c) in enumerate(flow):
        x = 0.65 + i * 2.05
        rect(s, x, 2.65, 1.72, 0.78, c, None, True, corner=0.12)
        add_text(s, t, x + 0.08, 2.88, 1.56, 0.30, 11, WHITE, True, PP_ALIGN.CENTER)
        if i < 5:
            add_text(s, "→", x + 1.76, 2.86, 0.26, 0.30, 18, MUTED, True, PP_ALIGN.CENTER)
    bullets(s, [
        "Show billed, collected and outstanding for the selected property and period.",
        "Open the tenant statement or receipt to prove document quality and traceability.",
        "Explain reminders and recovery actions without overstating unconfigured payment integrations."
    ], 0.9, 4.05, 11.6, 2.0, 15.5)
    proof_bar(s, "The manager can explain every balance and the tenant can access the same supporting documents.")

    # Slide 6
    s = base_slide(prs, "Service charge", "Plan, allocate, reconcile and explain", "Connect operational requirements to the annual service charge budget.", 6)
    card(s, 0.65, 2.35, 2.88, 2.75, "Schemes", "Define period, allocation basis and applicable units.", NAVY_2, "01")
    card(s, 3.71, 2.35, 2.88, 2.75, "Budget lines", "Security, cleaning, utilities, repairs and management costs.", RED, "02")
    card(s, 6.77, 2.35, 2.88, 2.75, "Allocation", "Apportion by area, equal share or configured driver.", TEAL, "03")
    card(s, 9.83, 2.35, 2.88, 2.75, "Reconciliation", "Compare budget with actual expenditure and explain variance.", AMBER, "04")
    add_text(s, "Use historical averages or projected quantities and rates—then preserve the approval and audit trail.", 0.85, 5.48, 11.6, 0.55, 15, INK, True, PP_ALIGN.CENTER)
    proof_bar(s, "Service charge planning is linked to real operational requirements and actual expenditure.")

    # Slide 7
    s = base_slide(prs, "Tenant self-service", "A tenant can act—not only view", "Invoices, receipts, lease information, notices and maintenance requests in one secure portal.", 7)
    card(s, 0.65, 2.35, 3.8, 2.95, "Financial self-service", "View invoices, balances, receipts and payment history.", NAVY_2, "KES")
    card(s, 4.75, 2.35, 3.8, 2.95, "Report an issue", "Capture category, priority, description and unit context; receive a traceable reference.", RED, "!")
    card(s, 8.85, 2.35, 3.8, 2.95, "Track progress", "See open requests, updates, documents and closure evidence.", TEAL, "✓")
    add_text(s, "Live proof: submit a low-risk issue, note the reference, then continue the same record in Facility Management.", 0.85, 5.65, 11.6, 0.5, 15, INK, True, PP_ALIGN.CENTER)
    proof_bar(s, "A tenant request becomes a property-scoped operational transaction—not an email or informal phone call.")

    # Slide 8
    s = base_slide(prs, "Facilities operations", "Turn a reported defect into controlled work", "Ticket → triage → SLA → assignment → evidence → verification → closure.", 8)
    labels = ["REPORT", "TRIAGE", "ASSIGN", "EXECUTE", "VERIFY", "CLOSE"]
    colors = [RED, AMBER, NAVY_2, TEAL, GREEN, NAVY]
    for i, (label, c) in enumerate(zip(labels, colors)):
        x = 0.65 + i * 2.05
        rect(s, x, 2.65, 1.72, 0.80, c, None, True, corner=0.12)
        add_text(s, label, x + 0.05, 2.90, 1.62, 0.30, 11, WHITE, True, PP_ALIGN.CENTER)
        if i < 5:
            add_text(s, "→", x + 1.76, 2.88, 0.26, 0.30, 18, MUTED, True, PP_ALIGN.CENTER)
    bullets(s, [
        "Time-stamped severity and SLA target",
        "Responsible staff member or approved service provider",
        "Photos, notes, costs and verification evidence",
        "Escalation and notifications when thresholds are at risk"
    ], 0.85, 4.05, 11.7, 2.1, 15.5)
    proof_bar(s, "Every maintenance action has ownership, evidence, elapsed time and a measurable outcome.")

    # Slide 9
    s = base_slide(prs, "Asset lifecycle", "Every critical asset has a passport and a plan", "From onboarding to preventive maintenance, condition history and replacement decisions.", 9)
    if FACILITY.exists():
        s.shapes.add_picture(str(FACILITY), Inches(7.15), Inches(2.30), width=Inches(5.55), height=Inches(3.95))
    bullets(s, [
        "Specification, location, condition, criticality and warranty",
        "Service history, documents and next planned maintenance",
        "12-month PPM calendar with due, completed and overdue work",
        "Inspections, compliance renewals and recurring-failure visibility"
    ], 0.75, 2.45, 6.0, 3.6, 16)
    proof_bar(s, "The asset register is operational: it drives schedules, work, compliance and lifecycle decisions.")

    # Slide 10 (Fixed word wrapping on PROPERTY ALLOCATION & WORK & INSPECTION)
    s = base_slide(prs, "Service architecture", "Define WHAT before assigning WHO", "Service Profiles remain stable while providers, contracts and performance can change.", 10)
    stages = [
        ("SERVICE\nPROFILE", "What is required", NAVY_2),
        ("SERVICE\nPROVIDER", "Who delivers", RED),
        ("PROPERTY\nSCOPE", "Where it applies", TEAL),
        ("CONTRACT\n& SLA", "Expected standard", AMBER),
        ("FIELD\nINSPECTION", "Verified evidence", NAVY),
        ("KPI & COST\nOUTCOME", "Measured result", GREEN),
    ]
    for i, (t, b, col) in enumerate(stages):
        x = 0.55 + i * 2.08
        rect(s, x, 2.40, 1.84, 2.05, WHITE, LINE, True, corner=0.04)
        rect(s, x, 2.40, 1.84, 0.08, col, None, False)
        add_text(s, t, x + 0.08, 2.65, 1.68, 0.72, 12.5, col, True, PP_ALIGN.CENTER)
        add_text(s, b, x + 0.08, 3.60, 1.68, 0.45, 10.5, MUTED, False, PP_ALIGN.CENTER)
        if i < 5:
            add_text(s, "→", x + 1.85, 3.22, 0.22, 0.30, 16, MUTED, True, PP_ALIGN.CENTER)
    bullets(s, [
        "One service profile can use different providers at different properties.",
        "Changing a provider never erases service requirements or historical SLA performance."
    ], 0.85, 4.88, 11.4, 1.35, 15)
    proof_bar(s, "Provider selection is separated from the enduring service standard used for SLA and KPI measurement.")

    # Slide 11
    s = base_slide(prs, "Performance", "Transactions become management insight", "Use trends and exceptions to answer: What happened? Why? What needs action next?", 11)
    card(s, 0.65, 2.35, 2.88, 2.95, "PPM compliance", "Completed on time, overdue and upcoming preventive work.", GREEN, "✓")
    card(s, 3.71, 2.35, 2.88, 2.95, "SLA performance", "Response and resolution time by priority, team and provider.", RED, "◷")
    card(s, 6.77, 2.35, 2.88, 2.95, "Financial control", "Expected vs actual collections, arrears ageing and budget variance.", AMBER, "↗")
    card(s, 9.83, 2.35, 2.88, 2.95, "Risk & compliance", "Expiries, incidents, recurring defects and approvals.", NAVY_2, "!")
    add_text(s, "Drill from every metric to the source record during the demo.", 0.8, 5.65, 11.8, 0.42, 15, INK, True, PP_ALIGN.CENTER)
    proof_bar(s, "The system measures performance objectively using the same records created during daily work.")

    # Slide 12 (Fixed "KES" badge width so it never wraps vertically)
    s = base_slide(prs, "Reporting", "One data source, different audiences", "Operational registers, tenant documents and landlord-ready management packs.", 12)
    card(s, 0.65, 2.35, 3.8, 2.95, "Operational", "Work orders, PPM, compliance, incidents, utilities and provider performance.", NAVY_2, "OPS")
    card(s, 4.75, 2.35, 3.8, 2.95, "Financial", "Billing and collection, receipts and expenditure, arrears, VAT and budget versus actual.", RED, "KES")
    card(s, 8.85, 2.35, 3.8, 2.95, "Tenancy", "Occupancy, vacancy, lease expiry, movements and tenant statements.", TEAL, "TEN")
    bullets(s, [
        "PDF for presentation and audit evidence  •  Excel/CSV for analysis and downstream processing",
        "Property, reporting period, management identity and branding in every generated document"
    ], 0.85, 5.52, 11.5, 0.95, 14)
    proof_bar(s, "Management and landlord reports reuse live records instead of separate spreadsheets.")

    # Slide 13
    s = base_slide(prs, "Live demonstration", "Recommended 27-minute run of show", "Keep the audience inside one property and one coherent story.", 13)
    rows = [
        ("2 min", "Companion", "Today’s priorities and selected property"),
        ("4 min", "Property & tenancy", "Unit billing schedule and active lease"),
        ("4 min", "Billing & collections", "Invoice source, receipt and outstanding balance"),
        ("3 min", "Tenant portal", "Submit one maintenance issue"),
        ("6 min", "Facility workflow", "Triage, SLA, assignment, evidence and verification"),
        ("3 min", "Asset & PPM", "Asset passport, calendar and compliance"),
        ("3 min", "Performance & reports", "KPI drill-down and landlord output"),
        ("2 min", "Close", "Return to Companion and recap proof chain"),
    ]
    y = 2.30
    for i, (tm, stage, msg) in enumerate(rows):
        fill = WHITE if i % 2 == 0 else RGBColor(234, 241, 247)
        rect(s, 0.72, y, 11.9, 0.48, fill, LINE, False)
        add_text(s, tm, 0.9, y + 0.08, 0.85, 0.32, 11, RED, True)
        add_text(s, stage, 1.85, y + 0.08, 2.4, 0.32, 11.5, INK, True)
        add_text(s, msg, 4.35, y + 0.08, 8.0, 0.32, 11, MUTED)
        y += 0.52
    proof_bar(s, "Perform one meaningful action live; use prepared records for the broader lifecycle and reporting story.")

    # Slide 14
    s = base_slide(prs, "Presenter guardrails", "What to claim—and what to position as roadmap", "Credibility matters more than covering every feature.", 14)
    card(s, 0.65, 2.35, 3.8, 3.85, "Show live", "Property scoping, tenant/lease records, issue reporting, work orders, PPM, service profiles/providers, reports and Companion workflows.", GREEN, "✓")
    card(s, 4.75, 2.35, 3.8, 3.85, "Describe carefully", "External email/SMS delivery, live payment gateways and scheduled automations only when the environment is configured and tested.", AMBER, "!")
    card(s, 8.85, 2.35, 3.8, 3.85, "Position as integration", "Specific smart-meter devices, third-party accounting systems and provider-specific APIs require vendor credentials and interface work.", RED, "→")
    proof_bar(s, "Never claim a feature is live unless it works in the environment being demonstrated.")

    # Slide 15
    s = base_slide(prs, "Demo readiness", "Final pre-flight checklist", "Run this on the same device, browser and network that will be used in the meeting.", 15)
    checks = [
        "Login and session persistence",
        "Correct organization and selected property",
        "Property, tenant, asset and provider records populated",
        "Open, due and overdue work represented",
        "Tenant issue submission and generated reference",
        "Work-order detail and SLA fields",
        "PPM and compliance calendar",
        "Companion tasks and notifications",
        "PDF report opens and is legible",
        "Backup screenshots/video available",
    ]
    for i, c in enumerate(checks):
        x = 0.75 + (i % 2) * 6.05
        y = 2.32 + (i // 2) * 0.78
        rect(s, x, y, 5.72, 0.58, WHITE, LINE, True, corner=0.06)
        add_text(s, "✓", x + 0.18, y + 0.12, 0.35, 0.34, 14, GREEN, True)
        add_text(s, c, x + 0.58, y + 0.12, 4.95, 0.34, 12, INK, True)
    proof_bar(s, "Stop and switch to the backup path if latency, authentication or integrations are unstable.")

    # Slide 16
    s = base_slide(prs, "Close", "Center Estates is an operating control system", "A single live record connects tenants, staff, providers, assets, money and management evidence.", 16)
    rect(s, 0.65, 2.45, 12.03, 1.05, NAVY, None, True, corner=0.04)
    add_text(s, "RECORD  →  PLAN  →  ASSIGN  →  EXECUTE  →  VERIFY  →  MEASURE  →  REPORT  →  IMPROVE", 0.85, 2.78, 11.6, 0.4, 15, WHITE, True, PP_ALIGN.CENTER)
    add_text(s, "The facility is onboarded. Work is planned. Issues are controlled.\nPerformance is measured. Reports are ready.", 1.15, 4.05, 11.0, 0.95, 22, INK, True, PP_ALIGN.CENTER)
    add_text(s, "Questions & Live Scenarios  •  https://centerestates.com", 3.55, 5.55, 6.2, 0.45, 16, RED, True, PP_ALIGN.CENTER)
    proof_bar(s, "One operating record. Complete estate control.")

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "CeEst_ERP_Live_Demo_Presentation.pptx"
    prs.save(path)
    return path


if __name__ == "__main__":
    print(build())
