#!/usr/bin/env python3
"""
Generate a clear, practical, jargon-free Center Estates Construction & Mobile Demo Presentation (.pptx)
featuring 100% REAL screenshots captured directly from the live Center Estates system (https://centerestates.com)
for Karam Apartments — Lang'ata (PRJ-KRM-01).
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "presentations"
ASSETS = OUT / "assets"
SCREENSHOTS = ROOT / "apps" / "web" / "public" / "presentations" / "screenshots"
LOGO = ROOT / "apps" / "web" / "public" / "center-estates-logo.png"

# Executive Color Palette
NAVY = RGBColor(10, 33, 61)
NAVY_DARK = RGBColor(7, 22, 44)
NAVY_LIGHT = RGBColor(18, 54, 91)
CRIMSON = RGBColor(220, 38, 38)
AMBER = RGBColor(217, 119, 6)
GREEN = RGBColor(22, 163, 74)
TEAL = RGBColor(13, 148, 136)
INK = RGBColor(15, 23, 42)
MUTED = RGBColor(71, 85, 105)
SLATE_LIGHT = RGBColor(148, 163, 184)
PALE = RGBColor(248, 250, 252)
WHITE = RGBColor(255, 255, 255)
LINE = RGBColor(226, 232, 240)
CARD_BG = RGBColor(255, 255, 255)


def add_text(slide, text, x, y, w, h, size=16, color=INK, bold=False,
             align=PP_ALIGN.LEFT, font="Liberation Sans", margin=0.04,
             valign=MSO_ANCHOR.MIDDLE, line_spacing=1.15):
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
        run = p.add_run()
        run.text = line
        run.font.name = font
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = color
    return box


def rect(slide, x, y, w, h, fill=WHITE, line=LINE, radius=True, corner=0.025, line_width=1.0):
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
        shape.line.width = Pt(line_width)
    return shape


def base_slide(prs, section, title, subtitle=None, number=None):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg = slide.background.fill
    bg.solid()
    bg.fore_color.rgb = PALE

    # Top Navy Executive Stripe
    rect(slide, 0, 0, 13.333, 0.14, NAVY, None, False)
    rect(slide, 0, 0.14, 13.333, 0.68, WHITE, LINE, False)

    if LOGO.exists():
        slide.shapes.add_picture(str(LOGO), Inches(0.50), Inches(0.21), height=Inches(0.50))
    add_text(slide, "Center Estates ERP — Live System Walkthrough", 1.18, 0.22, 5.5, 0.28, 15, NAVY, True)
    add_text(slide, "PRACTICAL CONSTRUCTION MANAGEMENT  •  ACTUAL SYSTEM SCREENSHOTS  •  KARAM APARTMENTS (PRJ-KRM-01)", 1.18, 0.49, 8.8, 0.2, 8.5, MUTED, True)

    if number is not None:
        rect(slide, 12.15, 0.28, 0.65, 0.36, NAVY, None, True, corner=0.2)
        add_text(slide, f"{number:02d}", 12.15, 0.28, 0.65, 0.36, 11, WHITE, True, PP_ALIGN.CENTER)

    # Section Pill & Slide Title
    add_text(slide, section.upper(), 0.50, 0.94, 8.0, 0.22, 9.5, CRIMSON, True)
    add_text(slide, title, 0.50, 1.16, 12.3, 0.42, 22, INK, True)
    if subtitle:
        add_text(slide, subtitle, 0.50, 1.58, 12.3, 0.30, 12, MUTED)
    return slide


def bullets(slide, items, x, y, w, h, size=12.5, color=INK, bullet_char="✓  ", space_after=8):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(0.06)
    tf.margin_right = Inches(0.06)
    tf.margin_top = Inches(0.04)
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.level = 0
        p.space_after = Pt(space_after)
        p.line_spacing = 1.15
        r1 = p.add_run()
        r1.text = bullet_char
        r1.font.name = "Liberation Sans"
        r1.font.size = Pt(size)
        r1.font.bold = True
        r1.font.color.rgb = GREEN

        if ":" in item:
            head, tail = item.split(":", 1)
            r2 = p.add_run()
            r2.text = head + ":"
            r2.font.name = "Liberation Sans"
            r2.font.size = Pt(size)
            r2.font.bold = True
            r2.font.color.rgb = INK

            r3 = p.add_run()
            r3.text = tail
            r3.font.name = "Liberation Sans"
            r3.font.size = Pt(size)
            r3.font.bold = False
            r3.font.color.rgb = color
        else:
            r2 = p.add_run()
            r2.text = item
            r2.font.name = "Liberation Sans"
            r2.font.size = Pt(size)
            r2.font.color.rgb = color
    return box


def proof_bar(slide, text, label="LIVE IN SYSTEM"):
    rect(slide, 0.50, 6.84, 12.33, 0.44, NAVY, None, True, corner=0.08)
    rect(slide, 0.60, 6.92, 2.05, 0.28, CRIMSON, None, True, corner=0.15)
    add_text(slide, label, 0.60, 6.92, 2.05, 0.28, 8.5, WHITE, True, PP_ALIGN.CENTER)
    add_text(slide, text, 2.80, 6.90, 9.8, 0.32, 11, WHITE, True)


def add_screenshot_frame(slide, img_path: Path, x: float, y: float, w: float, caption: str = None):
    """Places a real system screenshot inside a clean framed card."""
    # Calculate height from 16:10 aspect ratio (1440x900 -> h = w * 0.625)
    h = w * 0.625
    frame_h = h + (0.36 if caption else 0.12)
    rect(slide, x - 0.06, y - 0.06, w + 0.12, frame_h, WHITE, LINE, True, corner=0.02, line_width=1.5)
    if img_path.exists():
        slide.shapes.add_picture(str(img_path), Inches(x), Inches(y), width=Inches(w))
    if caption:
        add_text(slide, caption, x, y + h + 0.02, w, 0.26, 9.5, MUTED, True, PP_ALIGN.CENTER)


def feature_slide_with_screenshot(
    prs, number, section, title, subtitle,
    what_it_does_title, what_it_does_bullets,
    how_to_use_title, how_to_use_steps,
    screenshot_file, screenshot_caption, bottom_bar_text
):
    s = base_slide(prs, section, title, subtitle, number)

    # Left Column: Plain-English "What You See" + "How Your Team Uses It"
    rect(s, 0.50, 1.98, 4.55, 2.55, WHITE, LINE, True, corner=0.03)
    rect(s, 0.50, 1.98, 4.55, 0.08, CRIMSON, None, False)
    add_text(s, what_it_does_title, 0.68, 2.12, 4.2, 0.32, 13.5, NAVY, True)
    bullets(s, what_it_does_bullets, 0.64, 2.46, 4.25, 1.98, size=11, color=MUTED, space_after=6)

    rect(s, 0.50, 4.66, 4.55, 2.02, WHITE, LINE, True, corner=0.03)
    rect(s, 0.50, 4.66, 4.55, 0.08, GREEN, None, False)
    add_text(s, how_to_use_title, 0.68, 4.80, 4.2, 0.30, 13, NAVY, True)
    bullets(s, how_to_use_steps, 0.64, 5.12, 4.25, 1.50, size=10.8, color=MUTED, bullet_char="➔  ", space_after=5)

    # Right Column: Large Real System Screenshot (7.55 inches wide!)
    img_path = SCREENSHOTS / screenshot_file
    add_screenshot_frame(s, img_path, 5.25, 2.02, 7.52, screenshot_caption)

    proof_bar(s, bottom_bar_text)
    return s


def build_presentation():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # =========================================================================
    # SLIDE 1: Cover Slide — Real Screenshot + Plain-English Value Proposition
    # =========================================================================
    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = NAVY_DARK

    # Left Executive Panel
    rect(s, 0, 0, 5.55, 7.5, NAVY_DARK, None, False)
    rect(s, 5.45, 0, 0.10, 7.5, CRIMSON, None, False)

    if LOGO.exists():
        s.shapes.add_picture(str(LOGO), Inches(0.55), Inches(0.48), height=Inches(0.68))
    add_text(s, "Center Estates ERP", 1.38, 0.52, 3.8, 0.35, 21, WHITE, True)
    add_text(s, "SIMPLE, VISUAL CONSTRUCTION MANAGEMENT", 1.38, 0.86, 4.0, 0.22, 9, AMBER, True)

    rect(s, 0.55, 1.45, 3.6, 0.32, CRIMSON, None, True, corner=0.2)
    add_text(s, "LIVE SYSTEM WALKTHROUGH (WITH SCREENSHOTS)", 0.55, 1.45, 3.6, 0.32, 9, WHITE, True, PP_ALIGN.CENTER)

    add_text(s, "Track Every Shilling,\nBag of Cement &\nSite Milestone.", 0.55, 1.92, 4.7, 1.55, 27, WHITE, True, valign=MSO_ANCHOR.TOP, line_spacing=1.12)
    add_text(s, "No complicated engineering software. Every feature shown in this deck is live right now in Center Estates for Karam Apartments — Lang'ata.",
             0.55, 3.58, 4.65, 0.85, 12, RGBColor(203, 213, 225), valign=MSO_ANCHOR.TOP, line_spacing=1.22)

    bullets(s, [
        "1. Project Dashboard: Budget, timeline & progress in one screen.",
        "2. Bill of Quantities (BoQ): Know what is budgeted vs. certified.",
        "3. Site Gate & Daily Diary: Log workers, weather & material deliveries.",
        "4. Quality & Snag Tracking: Record cube tests & site defects.",
        "5. Payment Certificates (IPCs): Pay contractors only for completed work."
    ], 0.55, 4.52, 4.75, 2.25, size=11, color=WHITE, bullet_char="▸  ", space_after=6)

    add_text(s, "Live Demo URL: https://centerestates.com/monitoring",
             0.55, 6.88, 4.8, 0.32, 10, AMBER, True)

    # Right Side: Real Live Screenshot of Karam Apartments Command Center
    cover_shot = SCREENSHOTS / "01_project_overview.png"
    rect(s, 5.82, 0.85, 7.12, 4.85, WHITE, LINE, True, corner=0.02, line_width=2.0)
    if cover_shot.exists():
        s.shapes.add_picture(str(cover_shot), Inches(5.90), Inches(0.93), width=Inches(6.96))
    add_text(s, "ACTUAL LIVE SYSTEM SCREENSHOT — Karam Apartments — Lang'ata (PRJ-KRM-01) on centerestates.com",
             5.82, 5.36, 7.12, 0.28, 9.5, MUTED, True, PP_ALIGN.CENTER)

    # Bottom Right Highlight Strip
    rect(s, 5.82, 5.88, 7.12, 1.15, NAVY_LIGHT, CRIMSON, True, corner=0.04, line_width=1.5)
    add_text(s, "WHY THIS IS EASY FOR YOUR TEAM TO USE", 6.02, 5.98, 6.7, 0.24, 10, AMBER, True)
    add_text(s, "• Clerks of Works log daily site diaries, material deliveries, and photos from their phone or browser.\n• Quantity Surveyors & Project Managers review BoQ progress and issue payment certificates in one click.",
             6.02, 6.24, 6.7, 0.68, 10.8, WHITE)

    # =========================================================================
    # SLIDE 2: Feature 1 — Project Command Center (Real Screenshot 01)
    # =========================================================================
    feature_slide_with_screenshot(
        prs, 1,
        "Feature 01 • Executive Project Overview",
        "One Clear Dashboard for Every Construction Project",
        "Open any development project to see its total budget, physical completion %, active stage, and next milestone.",
        "What You See on This Screen",
        [
            "Project Identity: Karam Apartments — Lang'ata (PRJ-KRM-01) for Client M/S Karam Logistics Ltd.",
            "Overall Physical Progress: Shows exact completion (5 of 90 milestones completed) with a visual bar.",
            "Budget Expenditure: Tracks total contract budget (KSh 966.56M) against certified payments.",
            "Next Milestone Alert: Highlights the immediate upcoming site activity and target finish date."
        ],
        "How Your Team Uses It",
        [
            "Click 'Construction Management' -> 'Project Team' in the top navigation bar.",
            "Use the '+ New Log' button to record today's site activity or 'Share / Reports' to export a summary."
        ],
        "01_project_overview.png",
        "Live Screenshot: Center Estates -> Construction Management -> Project Workspace (Karam Apartments)",
        "Live Link: https://centerestates.com/monitoring?tab=project-memberships&id=ce-construction-karam-001"
    )

    # =========================================================================
    # SLIDE 3: Feature 2 — Programme & Work Schedule (Real Screenshot 02)
    # =========================================================================
    feature_slide_with_screenshot(
        prs, 2,
        "Feature 02 • Work Programme & Timeline",
        "Track Whether the Contractor Is On Time or Behind Schedule",
        "No complicated scheduling software needed—upload your Excel work plan and see instant progress cards.",
        "What You See on This Screen",
        [
            "Overall vs. Planned Progress: Compares actual site completion against what was planned.",
            "Schedule Status Card: Immediately flags whether the project is On Track or Behind Schedule.",
            "Activities Completed Counter: Tracks how many work plan activities are finished (5 of 90 done).",
            "Critical Path Donut Summary: Groups all site tasks into On Track, At Risk, Delayed, and Not Started."
        ],
        "How Your Team Uses It",
        [
            "Click 'Programme & Controls' -> 'Work Programme' in the top menu.",
            "Click 'Download Template' or 'Import Work Plan' to upload your standard Excel project schedule."
        ],
        "02_work_plan_schedule.png",
        "Live Screenshot: Center Estates -> Programme & Controls -> Work Programme (Karam Apartments)",
        "Live Link: https://centerestates.com/monitoring?tab=work-plan&id=ce-construction-karam-001"
    )

    # =========================================================================
    # SLIDE 4: Feature 3 — Bill of Quantities (BoQ) & Budget Control (Real Screenshot 03)
    # =========================================================================
    feature_slide_with_screenshot(
        prs, 3,
        "Feature 03 • Bill of Quantities (BoQ) & Cost Control",
        "Every BoQ Item Tracked from Budget to Certified Payment",
        "Replaces fragile Excel spreadsheets with a live Bill of Quantities register that prevents over-billing.",
        "What You See on This Screen",
        [
            "5 Cost Summary Cards: Shows Budgeted (KES 806.0M), Committed (KES 41.4M), Certified (KES 119.1M), and Paid.",
            "Itemized BoQ Table: Lists every item code, description, unit, quantity, rate, and total amount.",
            "Status Badges: Clearly marks whether each BoQ line is 'budgeted', 'committed', or 'certified'.",
            "One-Click State Actions: Quantity Surveyors can move items from Budgeted to Committed or Certified."
        ],
        "How Your Team Uses It",
        [
            "Click 'Commercial' -> 'BoQ & Cost' in the top navigation bar.",
            "Click 'Import BoQ' to upload your QS Excel Bill of Quantities in seconds."
        ],
        "03_boq_budget_shield.png",
        "Live Screenshot: Center Estates -> Commercial -> BoQ & Cost States (33 BoQ Items on Karam Apartments)",
        "Live Link: https://centerestates.com/monitoring?tab=boq&id=ce-construction-karam-001"
    )

    # =========================================================================
    # SLIDE 5: Feature 4 — Daily Site Diary & Workforce Log (Real Screenshot 04)
    # =========================================================================
    feature_slide_with_screenshot(
        prs, 4,
        "Feature 04 • Clerk of Works Daily Site Diary",
        "Daily Weather, Workforce Headcount & Site Notes in One Place",
        "Replaces paper logbooks and scattered WhatsApp messages with a permanent, searchable daily site diary.",
        "What You See on This Screen",
        [
            "Today's Site KPIs: Shows Daily Logs Recorded (3), Workforce on Site Today (84 workers), and Deliveries (4).",
            "Time-Stamped Daily Entries: Each log captures the date (6 Nov 2026), weather (Sunny 26°C), and headcount.",
            "Daily Activities Summary: Clear plain-text summary of what happened on Block A & Block B that day.",
            "H&S Incident Counter: Tracks any health and safety incidents reported on site."
        ],
        "How Your Team Uses It",
        [
            "Click 'Site Operations' -> 'Daily Logs' in the top menu (or open the Mobile App on site).",
            "Click '+ Record Daily Log' to enter today's weather, worker count, and site observations."
        ],
        "04_daily_logs_deliveries.png",
        "Live Screenshot: Center Estates -> Site Operations -> Daily Logs (84 Workers on Site Today)",
        "Live Link: https://centerestates.com/monitoring?tab=daily-logs&id=ce-construction-karam-001"
    )

    # =========================================================================
    # SLIDE 6: Feature 5 — Gate Material Deliveries & Mobile App (Real Screenshot 04b + Mobile)
    # =========================================================================
    s = base_slide(
        prs,
        "Feature 05 • Site Gate Material Deliveries (Web + Mobile App)",
        "Every Truck Offloaded at the Gate Is Checked Against the BoQ",
        "When cement, steel, or concrete arrives at the gate, the Clerk logs it on the phone or web and links it to the BoQ.",
        5
    )

    # Left: Real Web Screenshot of Material Deliveries (04b)
    shot_mat = SCREENSHOTS / "04b_gate_material_deliveries.png"
    add_screenshot_frame(s, shot_mat, 0.55, 2.02, 7.25,
                         "Live Web ERP Screenshot: Material Deliveries Logged for Karam Apartments (Bamburi Cement, Devki Steel)")

    # Right: Mobile App Gate Intake Mockup + Explanation
    mob_delivery = ASSETS / "mobile_delivery_mockup.png"
    if mob_delivery.exists():
        s.shapes.add_picture(str(mob_delivery), Inches(8.05), Inches(1.92), height=Inches(4.78))

    rect(s, 11.15, 2.02, 1.68, 4.58, WHITE, LINE, True, corner=0.04)
    rect(s, 11.15, 2.02, 1.68, 0.08, GREEN, None, False)
    add_text(s, "Mobile Gate Check", 11.23, 2.15, 1.52, 0.35, 11.5, NAVY, True)
    add_text(s, "1. Pick BoQ Item:\nSelect Cement or Steel from the dropdown.\n\n2. Check Allowance:\nGreen bar shows 650 / 1,200 bags used.\n\n3. Tap Supplier:\nTap Bamburi or Devki chip.\n\n4. Save Offline:\nSyncs automatically to the office Web ERP.",
             11.23, 2.55, 1.52, 3.9, 9.8, MUTED, valign=MSO_ANCHOR.TOP, line_spacing=1.15)

    proof_bar(s, "Prevents paying for phantom deliveries or exceeding budgeted material quantities.")

    # =========================================================================
    # SLIDE 7: Feature 6 — Milestones & Stage-Gate Protection (Real Screenshot 05 + Mobile)
    # =========================================================================
    s = base_slide(
        prs,
        "Feature 06 • Construction Milestones & Stage-Gate Control",
        "Contractors Cannot Claim Upper Floors Before Foundations Are 100% Done",
        "Milestones are tracked visually on the Web ERP and protected by automatic stage-gates on the Mobile App.",
        6
    )

    shot_ms = SCREENSHOTS / "05_milestones_stage_gates.png"
    add_screenshot_frame(s, shot_ms, 0.55, 2.02, 7.25,
                         "Live Web ERP Screenshot: Programme & Milestones (5 Completed, 6 In Progress, 79 Pending)")

    mob_gate = ASSETS / "stage_gate_mockup.png"
    if mob_gate.exists():
        s.shapes.add_picture(str(mob_gate), Inches(8.05), Inches(1.92), height=Inches(4.78))

    rect(s, 11.15, 2.02, 1.68, 4.58, WHITE, LINE, True, corner=0.04)
    rect(s, 11.15, 2.02, 1.68, 0.08, CRIMSON, None, False)
    add_text(s, "Stage-Gate Lock", 11.23, 2.15, 1.52, 0.35, 11.5, NAVY, True)
    add_text(s, "How It Protects You:\n\n• Foundation is at 50%.\n\n• If someone tries to claim Superstructure (Columns/Slabs), the slider locks at 0%.\n\n• Unlocking happens automatically once Foundations hit 100%.",
             11.23, 2.55, 1.52, 3.9, 9.8, MUTED, valign=MSO_ANCHOR.TOP, line_spacing=1.15)

    proof_bar(s, "Live Link: https://centerestates.com/monitoring?tab=milestones&id=ce-construction-karam-001")

    # =========================================================================
    # SLIDE 8: Feature 7 — Concrete Cube & Material Quality Tests (Real Screenshot 06)
    # =========================================================================
    feature_slide_with_screenshot(
        prs, 7,
        "Feature 07 • Quality Assurance & Lab Testing",
        "Track Concrete Cube Crushing & Steel Tensile Tests",
        "Never lose track of 7, 14, and 28-day concrete cube crushing results or steel mill certificates.",
        "What You See on This Screen",
        [
            "Sample ID & Type: Tracks each test sample (e.g. CUBE-KRM-28D-014 concrete_cube, STL-KRM-Y16-008 steel_tensile).",
            "Structural Location & Grade: Records the exact slab/column poured and design grade (C30/37, C35/45).",
            "Lab Result & Target MPa: Shows actual strength achieved (34.8 MPa vs 30.0 MPa target).",
            "Clear Pass / Fail Column: Immediately highlights passed tests ('Yes') and flags any failure ('No') for action."
        ],
        "How Your Team Uses It",
        [
            "Click 'Site Operations' -> 'Quality & Testing' in the top menu.",
            "Log new cube samples when pouring concrete and click 'Export CSV' for engineer audits."
        ],
        "06_quality_cube_tests.png",
        "Live Screenshot: Center Estates -> Site Operations -> Quality Tests (Concrete Cube & Steel Results)",
        "Live Link: https://centerestates.com/monitoring?tab=quality-tests&id=ce-construction-karam-001"
    )

    # =========================================================================
    # SLIDE 9: Feature 8 — Site Issues, Snags & Defect Tracking (Real Screenshot 07)
    # =========================================================================
    feature_slide_with_screenshot(
        prs, 8,
        "Feature 08 • Site Snags, Defects & Issue Resolution",
        "Spot a Defect on Site? Log It, Assign It & Track It to Closure",
        "Ensures construction defects (like low rebar cover or honeycombing) are fixed before the contractor is paid.",
        "What You See on This Screen",
        [
            "Defect Description: Clear issue titles (e.g. 'Insufficient concrete cover 15mm vs 25mm on Block A beam').",
            "Risk & Priority Badges: Color-coded red ('high • urgent'), amber ('medium'), and slate ('low') badges.",
            "One-Click Workflow Buttons: Team members click 'Acknowledge' and 'Resolve' right from the table.",
            "Plan Pinning Support: Allows pinning defects directly onto uploaded architectural floor plans."
        ],
        "How Your Team Uses It",
        [
            "Click 'Site Operations' -> 'Issues & Snags' in the top menu.",
            "Type the defect title, choose Risk Level & Due Date, and click 'Raise ticket'."
        ],
        "07_snag_defect_tickets.png",
        "Live Screenshot: Center Estates -> Site Operations -> Issues & Snags (Active Defect Register)",
        "Live Link: https://centerestates.com/monitoring?tab=tickets&id=ce-construction-karam-001"
    )

    # =========================================================================
    # SLIDE 10: Feature 9 — Payment Certificates (IPCs) & Drawdowns (Real Screenshots 08 & 09)
    # =========================================================================
    s = base_slide(
        prs,
        "Feature 09 • Contractor Payment Certificates (IPCs) & Bank Drawdowns",
        "Turn Verified Site Progress into Payment Certificates & Drawdowns",
        "Once milestones and quality tests are verified, Finance issues Interim Payment Certificates and approves bank drawdowns.",
        9
    )

    shot_ipc = SCREENSHOTS / "08_ipc_certificates.png"
    shot_drw = SCREENSHOTS / "09_drawdown_requests.png"

    add_screenshot_frame(s, shot_ipc, 0.55, 2.02, 5.95,
                         "Live Screenshot 1: Finance -> Certificates (IPC-KRM-001 & IPC-KRM-002 Issued)")
    add_screenshot_frame(s, shot_drw, 6.83, 2.02, 5.95,
                         "Live Screenshot 2: Finance -> Drawdowns (DRW-KRM-2026-02 KSh 76.95M Approved)")

    rect(s, 0.55, 6.18, 12.23, 0.54, WHITE, LINE, True, corner=0.04)
    add_text(s, "HOW IT WORKS:  1. QS generates IPC from verified BoQ progress (with 10% retention held back)   ➔   2. Finance approves the linked Bank Drawdown Request   ➔   3. One click marks funds disbursed.",
             0.75, 6.24, 11.83, 0.42, 11.5, INK, True, PP_ALIGN.CENTER)

    proof_bar(s, "Live Links: centerestates.com/monitoring?tab=certificates  •  centerestates.com/monitoring?tab=drawdowns")

    # =========================================================================
    # SLIDE 11: Step-by-Step 5-Minute Live Demo Script for Your Colleague
    # =========================================================================
    s = base_slide(
        prs,
        "10 • Your 5-Minute Live Demo Guide",
        "How to Demo This Live on centerestates.com in 5 Simple Clicks",
        "Open https://centerestates.com/monitoring and click through Karam Apartments — Lang'ata in this exact order:",
        10
    )

    steps = [
        ("CLICK 1", "Project Overview", "MAIN -> Project Team", "Show the KSh 966.56M budget, 5 of 90 milestones complete, and active project status.", NAVY_LIGHT),
        ("CLICK 2", "Bill of Quantities (BoQ)", "COMMERCIAL -> BoQ & Cost", "Show the 33 BoQ items: KES 806.0M Budgeted, KES 41.4M Committed, and KES 119.1M Certified.", GREEN),
        ("CLICK 3", "Daily Logs & Gate Deliveries", "SITE OPERATIONS -> Daily Logs", "Show the 84 workers on site today and the Bamburi Cement & Devki Steel gate deliveries.", AMBER),
        ("CLICK 4", "Quality Tests & Snags", "SITE OPERATIONS -> Quality & Testing / Issues", "Show the passed 28-day concrete cube test (34.8 MPa) and the urgent rebar cover snag ticket.", CRIMSON),
        ("CLICK 5", "IPC Payment & Drawdown", "FINANCE -> Certificates (IPC) & Drawdowns", "Show IPC-KRM-002 (KES 76.95M) and the approved bank drawdown DRW-KRM-2026-02.", TEAL),
    ]

    y = 2.08
    for badge, title, nav_path, desc, col in steps:
        rect(s, 0.50, y, 12.33, 0.84, WHITE, LINE, True, corner=0.04)
        rect(s, 0.64, y + 0.18, 1.25, 0.48, col, None, True, corner=0.18)
        add_text(s, badge, 0.64, y + 0.18, 1.25, 0.48, 10.5, WHITE, True, PP_ALIGN.CENTER)
        add_text(s, title, 2.05, y + 0.12, 2.75, 0.34, 13.5, INK, True)
        add_text(s, f"Menu: {nav_path}", 2.05, y + 0.44, 2.95, 0.28, 10, col, True)
        add_text(s, desc, 5.10, y + 0.16, 7.55, 0.52, 11.5, MUTED)
        y += 0.92

    proof_bar(s, "Everything shown in this presentation is live right now at https://centerestates.com/monitoring")

    OUT.mkdir(parents=True, exist_ok=True)
    out_path = OUT / "Center_Estates_Construction_and_Mobile_Presentation.pptx"
    prs.save(out_path)
    return out_path


if __name__ == "__main__":
    generated = build_presentation()
    print(f"Presentation successfully created at: {generated}")
