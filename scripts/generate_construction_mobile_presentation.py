#!/usr/bin/env python3
"""
Generate the Center Estates Construction Oversight & Mobile Field App Presentation (.pptx).
Tailored for executive, client, and contractor stakeholders.
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

# Color Palette: Corporate Navy, Construction Safety Amber, Accent Crimson, Verified Emerald, Slate
NAVY = RGBColor(10, 33, 61)
NAVY_LIGHT = RGBColor(18, 54, 91)
CRIMSON = RGBColor(220, 38, 38)
AMBER = RGBColor(217, 119, 6)
GREEN = RGBColor(22, 163, 74)
INK = RGBColor(15, 23, 42)
MUTED = RGBColor(71, 85, 105)
PALE = RGBColor(248, 250, 252)
WHITE = RGBColor(255, 255, 255)
LINE = RGBColor(226, 232, 240)
CARD_BG = RGBColor(255, 255, 255)
BAR_BG = RGBColor(241, 245, 249)


def add_text(slide, text, x, y, w, h, size=18, color=INK, bold=False,
             align=PP_ALIGN.LEFT, font="Liberation Sans", margin=0.04,
             valign=MSO_ANCHOR.MIDDLE):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.margin_left = tf.margin_right = Inches(margin)
    tf.margin_top = tf.margin_bottom = Inches(margin)
    tf.vertical_anchor = valign
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.alignment = align
    r = p.runs[0]
    r.font.name = font
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.color.rgb = color
    return box


def rect(slide, x, y, w, h, fill=WHITE, line=LINE, radius=True):
    shape = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE,
        Inches(x), Inches(y), Inches(w), Inches(h),
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    shape.line.color.rgb = line
    shape.line.width = Pt(1)
    return shape


def base_slide(prs, section, title, subtitle=None, number=None):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg = slide.background.fill
    bg.solid()
    bg.fore_color.rgb = PALE
    # Top banner stripe
    rect(slide, 0, 0, 13.333, 0.22, NAVY, NAVY, False)
    if LOGO.exists():
        slide.shapes.add_picture(str(LOGO), Inches(0.45), Inches(0.38), height=Inches(0.6))
    add_text(slide, "Center Estates ERP", 1.25, 0.4, 3.2, 0.28, 18, NAVY, True)
    add_text(slide, "CONSTRUCTION OVERSIGHT  •  FIELD TELEMETRY  •  FINANCIAL GOVERNANCE", 1.25, 0.69, 7.5, 0.2, 8, MUTED, True)
    add_text(slide, section.upper(), 0.55, 1.15, 5.0, 0.28, 10, CRIMSON, True)
    add_text(slide, title, 0.55, 1.45, 12.2, 0.5, 26, INK, True)
    if subtitle:
        add_text(slide, subtitle, 0.55, 1.95, 12.0, 0.35, 13, MUTED)
    if number is not None:
        add_text(slide, f"{number:02d}", 12.35, 0.45, 0.45, 0.3, 11, CRIMSON, True, PP_ALIGN.RIGHT)
    return slide


def bullets(slide, items, x, y, w, h, size=16, color=INK):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(0.08)
    tf.margin_right = Inches(0.05)
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = item
        p.level = 0
        p.space_after = Pt(10)
        p.font.name = "Liberation Sans"
        p.font.size = Pt(size)
        p.font.color.rgb = color
        p.text = "•  " + p.text
    return box


def proof_bar(slide, text):
    rect(slide, 0.55, 6.78, 12.23, 0.42, BAR_BG, BAR_BG)
    add_text(slide, "AUDIT PRINCIPLE", 0.75, 6.87, 1.3, 0.2, 8.5, NAVY, True)
    add_text(slide, text, 2.15, 6.84, 10.4, 0.25, 11, NAVY, True)


def card(slide, x, y, w, h, title, body, accent=CRIMSON, icon=None):
    rect(slide, x, y, w, h, CARD_BG, LINE)
    rect(slide, x, y, 0.08, h, accent, accent, False)
    if icon:
        add_text(slide, icon, x + 0.2, y + 0.16, 0.4, 0.35, 18, accent, True)
        tx = x + 0.62
    else:
        tx = x + 0.22
    add_text(slide, title, tx, y + 0.15, w - (tx - x) - 0.2, 0.32, 14.5, INK, True)
    add_text(slide, body, x + 0.22, y + 0.58, w - 0.44, h - 0.72, 11.5, MUTED,
             valign=MSO_ANCHOR.TOP, margin=0.02)


def build_presentation():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # -------------------------------------------------------------
    # SLIDE 1: Cover
    # -------------------------------------------------------------
    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = WHITE
    # Left colored accent panel
    rect(s, 0, 0, 5.2, 7.5, NAVY, NAVY, False)
    rect(s, 5.12, 0, 0.1, 7.5, CRIMSON, CRIMSON, False)
    if LOGO.exists():
        s.shapes.add_picture(str(LOGO), Inches(0.6), Inches(0.6), height=Inches(0.85))
    add_text(s, "Center Estates ERP", 0.6, 1.6, 4.2, 0.35, 22, WHITE, True)
    add_text(s, "CONSTRUCTION SUITE & MOBILE APP", 0.6, 2.0, 4.2, 0.25, 10, AMBER, True)
    add_text(s, "Eliminating Capital Leakage in African Real Estate Development.", 0.6, 2.6, 4.2, 1.4, 25, WHITE, True, valign=MSO_ANCHOR.TOP)
    add_text(s, "Real-time field telemetry, BoQ allowance shields, and cryptographic milestone stage-gates.", 0.6, 4.3, 4.0, 1.1, 13, RGBColor(203, 213, 225), valign=MSO_ANCHOR.TOP)
    rect(s, 0.6, 5.7, 4.0, 0.5, CRIMSON, CRIMSON)
    add_text(s, "VERIFY ON-SITE  →  CERTIFY ON WEB", 0.7, 5.82, 3.8, 0.25, 10, WHITE, True, PP_ALIGN.CENTER)
    add_text(s, "Live Demo Project: Karam Apartments — Lang'ata (PRJ-KRM-01)", 0.6, 6.75, 4.2, 0.3, 9, RGBColor(148, 163, 184))

    # Right hero details
    rect(s, 5.65, 0.6, 7.15, 6.3, PALE, LINE)
    add_text(s, "EXECUTIVE SUMMARY", 6.0, 0.9, 5.0, 0.3, 11, CRIMSON, True)
    add_text(s, "A Single Operating Chain Between Site Gate & Bank Drawdown", 6.0, 1.25, 6.5, 0.5, 20, INK, True)
    bullets(s, [
        "Bill of Quantities (BoQ) Integrated: Every material delivery checked against contractual budget limits.",
        "Contractual Stage-Gates: Downstream milestones remain locked until prerequisite structural works reach 100%.",
        "Offline-First Site Diary: Complete Clerk of Works logging with zero 4G/Wi-Fi reliance via local SQLite sync.",
        "Tamper-Evident Auditing: SHA-256 evidence seals, GPS geofencing, and biometric digital sign-offs.",
        "Mini-BoQ Valuations: Real-time calculation of Interim Payment Certificates (IPCs) backed by verified site photos."
    ], 6.0, 2.0, 6.4, 4.5, 14)

    # -------------------------------------------------------------
    # SLIDE 2: The Core Problem
    # -------------------------------------------------------------
    s = base_slide(prs, "Industry Challenge", "The Three Critical Blind Spots in Construction Oversight",
                   "Why 15% to 25% of commercial construction capital is lost during execution.", 1)
    card(s, 0.65, 2.5, 3.8, 3.8, "1. Phantom & Over-Deliveries",
         "Paper delivery slips signed at the gate with no live cross-reference to the approved BoQ allowance.\n\n"
         "• Materials delivered beyond budget without developer visibility.\n"
         "• Inability to track which supplier provided which batch.\n"
         "• Discrepancies only discovered months later during final accounts.", CRIMSON, "⚠")
    card(s, 4.75, 2.5, 3.8, 3.8, "2. Premature Progress Claims",
         "Contractors claiming 40% completion on superstructure before foundation works are certified.\n\n"
         "• Downstream milestone payments disbursed prematurely.\n"
         "• Capital over-extended ahead of actual physical progress.\n"
         "• Subcontractor disputes and compromised structural verification.", AMBER, "⛔")
    card(s, 8.85, 2.5, 3.8, 3.8, "3. Disconnected Site Diary",
         "Clerk of Works field diaries written in paper logbooks or scattered WhatsApp groups.\n\n"
         "• Photos lack GPS coordinates and tamper-evident timestamps.\n"
         "• Site defects and safety snags unaddressed for weeks.\n"
         "• Disconnect between site reality and the finance office.", NAVY_LIGHT, "📄")
    proof_bar(s, "Traditional oversight depends on trust and retrospective audits. Center Estates enforces proactive digital controls.")

    # -------------------------------------------------------------
    # SLIDE 3: The Architecture of Truth
    # -------------------------------------------------------------
    s = base_slide(prs, "System Architecture", "Unified Real-Time Platform: Mobile App ↔ Web ERP ↔ API",
                   "One continuous operational record linking the site gate directly to the board room.", 2)
    card(s, 0.65, 2.45, 3.8, 4.0, "Mobile Field App (Expo / React Native)",
         "Authoritative source of physical site truth for Clerks of Works and resident engineers.\n\n"
         "• Offline-First: TinyBase reactive layer on local SQLite.\n"
         "• Rugged Field UX: Big touch targets, high contrast, Kenyan supplier chips.\n"
         "• GPS Geofencing: Automatic classification of photo capture location.\n"
         "• Form Draft Persistence: Zero data loss on sudden app kills.", CRIMSON, "📱")
    card(s, 4.75, 2.45, 3.8, 4.0, "Central REST API (Django & MySQL)",
         "Production backend engine running at api.centerestates.com.\n\n"
         "• Bidirectional Delta-Sync: Atomic /sync/pull and /sync/push endpoints.\n"
         "• Contractual Stage-Gate Validator: Enforces 100% prerequisite completion.\n"
         "• Cryptographic Integrity Seals: SHA-256 evidence hashing.\n"
         "• Role-Based Access Control: Mobile Clerk vs Consultant vs Owner.", NAVY_LIGHT, "⚙")
    card(s, 8.85, 2.45, 3.8, 4.0, "Office Web ERP (Next.js 14)",
         "Real-time management command center for Developers, PMs, and Quantity Surveyors.\n\n"
         "• Work Plan & CPM Gantt: Predecessor scheduling and progress.\n"
         "• Bill of Quantities (BoQ): Line-item budgets, rates, and variance shields.\n"
         "• Mini-BoQ Valuations: Certified interim payment calculations.\n"
         "• Defect Kanban: Live snag resolution workflows.", GREEN, "💻")
    proof_bar(s, "Mobile evidence is immutable. Submitted site records cannot be overwritten or deleted by office users.")

    # -------------------------------------------------------------
    # SLIDE 4: Mobile Gate Deliveries & BoQ Shield
    # -------------------------------------------------------------
    s = base_slide(prs, "Field Material Control", "Site Gate Deliveries Bound to BoQ Allowances",
                   "Preventing material leakage before the truck leaves the site perimeter.", 3)
    card(s, 0.65, 2.45, 2.85, 2.7, "Searchable BoQ Picker",
         "Clerk taps to open full project Bill of Quantities. Auto-fills item code, material name, and measurement unit.", CRIMSON, "🔍")
    card(s, 3.72, 2.45, 2.85, 2.7, "Kenyan Supplier Chips",
         "One-tap selection for Bamburi, Apex Steel, Devki, Savannah, Simba, and Tononoka.", AMBER, "🏢")
    card(s, 6.78, 2.45, 2.85, 2.7, "Planned Allowance Shield",
         "Displays approved BoQ quantity and remaining balance. Red banner triggers if delivery exceeds planned allowance.", GREEN, "🛡")
    card(s, 9.85, 2.45, 2.85, 2.7, "Work Plan Task Tagging",
         "Ties materials to CPM work plan activities (e.g. WP-001 Foundation Works) for exact consumption tracking.", NAVY_LIGHT, "🏷")
    bullets(s, [
        "Eliminates handwritten gate passes: Delivery note numbers and supplier invoices digitized at intake.",
        "Automatic reconciliation: Real-time variance reports alert Quantity Surveyors to unexpected material spikes.",
        "Offline caching: Form drafts automatically persist in SQLite even if phone battery dies."
    ], 0.85, 5.4, 11.6, 1.15, 14.5)
    proof_bar(s, "Every delivery record is linked to a BoQ line item and a work plan activity, ensuring 100% material traceability.")

    # -------------------------------------------------------------
    # SLIDE 5: Contractual Stage-Gate Engine
    # -------------------------------------------------------------
    s = base_slide(prs, "Contractual Governance", "The Stage-Gate Engine: Mathematical Payout Protection",
                   "Downstream milestones cannot advance until preceding structural requirements reach 100%.", 4)
    # Stage-Gate Visual Progression
    flow = [
        ("Substructure & Raft\n(Prerequisite)", "100% COMPLETE\n✓ Certified by Engineer", GREEN),
        ("Superstructure Frame\n(Current Milestone)", "STAGE-GATE UNLOCKED\nProgress Claim Allowed", AMBER),
        ("Roofing & Waterproofing\n(Downstream)", "🔒 LOCKED\n0% Allowed until Frame 100%", CRIMSON),
    ]
    for i, (title, status, col) in enumerate(flow):
        x = 0.8 + i * 4.0
        rect(s, x, 2.5, 3.6, 1.8, WHITE, col)
        rect(s, x, 2.5, 3.6, 0.08, col, col, False)
        add_text(s, title, x + 0.2, 2.65, 3.2, 0.6, 16, INK, True, PP_ALIGN.CENTER)
        add_text(s, status, x + 0.2, 3.4, 3.2, 0.6, 12, col, True, PP_ALIGN.CENTER)
        if i < 2:
            add_text(s, "➔", x + 3.68, 3.2, 0.35, 0.35, 22, MUTED, True, PP_ALIGN.CENTER)

    bullets(s, [
        "Enforced at Database & API Level: The backend rejects progress updates (>0%) if predecessors are incomplete.",
        "Prominent Mobile Banner: The Clerk's app explicitly states which predecessor milestones are blocking submission.",
        "Protects Developer & Financier: Eliminates contractor over-billing on downstream finishes before structural sign-off."
    ], 0.85, 4.6, 11.6, 1.9, 15)
    proof_bar(s, "Stage-gates bridge engineering reality with legal contract compliance, removing subjective certification bias.")

    # -------------------------------------------------------------
    # SLIDE 6: Field Snagging & Quality Control
    # -------------------------------------------------------------
    s = base_slide(prs, "Quality & Compliance", "Defect Management & Concrete Lifecycle Schedulers",
                   "Logging site snags on mobile; scheduling 7, 14, and 28-day concrete crushing tests.", 5)
    card(s, 0.65, 2.5, 3.8, 3.8, "Mobile Snags & Defect Ticketing",
         "Resident Engineers log defects instantly from the field.\n\n"
         "• Classification: Quality Defect, Safety Risk, Structural Discrepancy.\n"
         "• Priority Routing: Urgent, High, Normal.\n"
         "• Photographic Evidence: Direct camera capture with GPS coordinates.\n"
         "• Live Office Kanban: Real-time sync to the web oversight board.", CRIMSON, "⚡")
    card(s, 4.75, 2.5, 3.8, 3.8, "Concrete Quality & Curing Scheduler",
         "Ensuring structural pour compliance with Kenyan building standards (BS 8110 / Eurocode 2).\n\n"
         "• Slump Test Logging: Real-time workability verification.\n"
         "• Automated Crushing Schedule: Automatically queues 7-day, 14-day, and 28-day cylinder crushing tests.\n"
         "• Lab Certificate Attachment: Test results archived into the milestone record.", AMBER, "🧱")
    card(s, 8.85, 2.5, 3.8, 3.8, "Health & Safety Incident Reports",
         "Immediate escalation protocol for near-misses and site incidents.\n\n"
         "• Severity grading and root cause categorization.\n"
         "• Corrective Action Plan (CAP) tracking.\n"
         "• Regulatory reporting compliance (DOSHS & NCA).", NAVY_LIGHT, "🦺")
    proof_bar(s, "Quality tests and defect tickets form part of the permanent structural audit trail required for building occupation certificates.")

    # -------------------------------------------------------------
    # SLIDE 7: Financial Control & Mini-BoQ Valuations
    # -------------------------------------------------------------
    s = base_slide(prs, "Commercial Oversight", "Interim Payment Certificates (IPCs) & Mini-BoQ Audits",
                   "Turning certified field progress into automated financial drawdown certificates.", 6)
    card(s, 0.65, 2.45, 3.8, 2.8, "1. Mini-BoQ Valuation",
         "Quantity Surveyors inspect the exact BoQ sub-elements linked to the completed milestone, calculating certified KES value.", NAVY_LIGHT, "💰")
    card(s, 4.75, 2.45, 3.8, 2.8, "2. AI Progress Audit",
         "AI models compare actual progress against baseline schedule, highlighting material variance and projected completion dates.", CRIMSON, "🤖")
    card(s, 8.85, 2.45, 3.8, 2.8, "3. Drawdown Certificates",
         "Generates audit-ready PDF payment certificates showing certified value, retention deductions, and advance recovery.", GREEN, "📜")
    bullets(s, [
        "100% Backed by Field Evidence: Every shilling certified is backed by geotagged site photos and delivery notes.",
        "Automatic Retention Deductions: Configurable retention rates (e.g. 5% or 10%) automatically deducted.",
        "Disbursement Reconciliation: Seamless financial handover to property development accounts."
    ], 0.85, 5.5, 11.6, 1.15, 14.5)
    proof_bar(s, "Quantity Surveyors save up to 80% of interim valuation time while providing banks with unassailable audit proof.")

    # -------------------------------------------------------------
    # SLIDE 8: Offline-First & Cryptographic Security
    # -------------------------------------------------------------
    s = base_slide(prs, "Anti-Fraud Architecture", "Offline Resilience & Cryptographic Anti-Fraud Controls",
                   "Built specifically for African construction environments with unreliable connectivity.", 7)
    card(s, 0.65, 2.5, 2.85, 3.8, "Offline SQLite Engine",
         "Basements and deep excavations have zero 4G.\n\n"
         "The app caches all forms, BoQ items, and daily logs locally in SQLite, syncing automatically upon network restoration.", NAVY_LIGHT, "📶")
    card(s, 3.72, 2.5, 2.85, 3.8, "Biometric Key Signatures",
         "Each field device enrols an Ed25519 cryptographic key in hardware keystore.\n\n"
         "Submissions require a live biometric prompt, providing non-repudiation of who signed the milestone.", GREEN, "👆")
    card(s, 6.78, 2.5, 2.85, 3.8, "GPS Geofence Guard",
         "Photos captured off-site are flagged as fraud risks.\n\n"
         "The server automatically tests hardware GPS coordinates against the project perimeter.", AMBER, "📍")
    card(s, 9.85, 2.5, 2.85, 3.8, "Immutable SHA-256 Seals",
         "Every submission generates a tamper-evident hash over progress, observations, and photo bytes.\n\n"
         "Any posterior alteration breaks the seal.", CRIMSON, "🔒")
    proof_bar(s, "Security and auditability are baked into the data layer, not added as an afterthought.")

    # -------------------------------------------------------------
    # SLIDE 9: Live Demo Run of Show
    # -------------------------------------------------------------
    s = base_slide(prs, "Demonstration Flow", "Recommended 5-Step Live Demonstration Script",
                   "A compelling 8-minute journey demonstrating real-time office-to-field synchronicity.", 8)
    rows = [
        ("Step 1", "Office Baseline Setup (Web)", "Open Karam Apartments. Showcase the Work Plan (CPM Gantt) and approved BoQ allowances.", "1.0 min"),
        ("Step 2", "Site Gate Delivery (Mobile)", "Open Mobile App. Select BoQ item (Cement), tap 'Bamburi' chip, demonstrate Planned Allowance Shield.", "2.0 mins"),
        ("Step 3", "Stage-Gate Lockout (Mobile)", "Open 'Superstructure Frame'. Show '🔒 Stage-Gate Locked' banner blocking premature claim.", "1.5 mins"),
        ("Step 4", "Live Snag Sync (Mobile → Web)", "Log rebar spacing defect on mobile. Switch to Web to show immediate appearance on Kanban board.", "1.5 mins"),
        ("Step 5", "Mini-BoQ Valuation & AI Audit (Web)", "Open Mini-BoQ breakdown, verify certified KES amount, and trigger AI Progress Audit.", "2.0 mins"),
    ]
    y = 2.45
    for i, (step, title, desc, duration) in enumerate(rows):
        fill = WHITE if i % 2 == 0 else RGBColor(241, 245, 249)
        rect(s, 0.72, y, 11.9, 0.65, fill, fill, False)
        add_text(s, step, 0.88, y + 0.14, 0.9, 0.35, 12, CRIMSON, True)
        add_text(s, title, 1.85, y + 0.14, 3.2, 0.35, 13, INK, True)
        add_text(s, desc, 5.15, y + 0.14, 5.9, 0.35, 11, MUTED)
        add_text(s, duration, 11.15, y + 0.14, 1.2, 0.35, 11, NAVY_LIGHT, True, PP_ALIGN.RIGHT)
        y += 0.75
    proof_bar(s, "Keep the audience focused on Karam Apartments to prove coherent end-to-end operational integrity.")

    # -------------------------------------------------------------
    # SLIDE 10: Value & ROI
    # -------------------------------------------------------------
    s = base_slide(prs, "Business Case", "Measurable Business Impact & Stakeholder ROI",
                   "Why institutional developers and financiers mandate Center Estates for project oversight.", 9)
    card(s, 0.65, 2.5, 3.8, 3.8, "For Real Estate Developers",
         "• Complete visibility into actual daily site progress.\n"
         "• 15%–20% reduction in unauthorized material overages.\n"
         "• Seamless transition into Sales & Facilities modules upon project completion.", CRIMSON, "🏢")
    card(s, 4.75, 2.5, 3.8, 3.8, "For Project Managers & QSs",
         "• Automated Interim Payment Certificates (IPCs) in minutes instead of days.\n"
         "• Standardized daily site logs and concrete test archives.\n"
         "• Clear evidentiary defense in contractor dispute arbitration.", AMBER, "📐")
    card(s, 8.85, 2.5, 3.8, 3.8, "For Commercial Banks & Financiers",
         "• Independent, unassailable audit proof for construction loan drawdowns.\n"
         "• Cryptographic evidence eliminates contractor collusion risks.\n"
         "• ESG and regulatory safety compliance verification.", GREEN, "🏦")
    proof_bar(s, "Center Estates transforms construction monitoring from an administrative chore into a strategic financial safeguard.")

    # -------------------------------------------------------------
    # SLIDE 11: Closing Slide
    # -------------------------------------------------------------
    s = base_slide(prs, "Summary & Conclusion", "One Unified Platform: From Groundbreaking to Estate Handover",
                   "Thank you. We are ready for live scenarios and questions.", 10)
    rect(s, 0.7, 2.5, 11.95, 1.2, NAVY, NAVY)
    add_text(s, "RECORD  →  VERIFY ON-SITE  →  STAGE-GATE  →  CERTIFY PAYMENT  →  HANDOVER",
             0.9, 2.9, 11.5, 0.4, 17, WHITE, True, PP_ALIGN.CENTER)
    add_text(s, "The mobile app is live. The backend is synchronized. The construction module is ready.",
             1.0, 4.1, 11.3, 0.7, 23, INK, True, PP_ALIGN.CENTER)

    card(s, 1.5, 5.0, 4.8, 1.4, "Live Demonstration Access",
         "Web: https://centerestates.com\n"
         "Mobile: exp://vpofj68-anonymous-8081.exp.direct\n"
         "Demo Project: Karam Apartments (PRJ-KRM-01)", NAVY_LIGHT, "🌐")

    card(s, 6.9, 5.0, 4.8, 1.4, "Presenter Contact & Inquiries",
         "Platform: Center Estates Construction Suite\n"
         "Engineering: Antigravity AI Systems\n"
         "Date: November 2026", CRIMSON, "👤")

    OUT.mkdir(parents=True, exist_ok=True)
    out_path = OUT / "Center_Estates_Construction_and_Mobile_Presentation.pptx"
    prs.save(out_path)
    return out_path


if __name__ == "__main__":
    generated = build_presentation()
    print(f"Presentation successfully created at: {generated}")
