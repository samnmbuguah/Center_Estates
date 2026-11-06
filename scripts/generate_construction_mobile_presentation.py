#!/usr/bin/env python3
"""
Generate an executive-grade, visually rich Center Estates Construction Oversight & Mobile Field App
Presentation (.pptx) with 300-DPI UI mockups, data charts, crisp typography, and zero text overflow.
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
LOGO = ROOT / "apps" / "web" / "public" / "center-estates-logo.png"
HERO = ROOT / "apps" / "web" / "public" / "images" / "hero.jpg"
FACILITY = ROOT / "apps" / "web" / "public" / "images" / "facility.jpg"

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
BAR_BG = RGBColor(238, 244, 251)

FONT_REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FONT_MONO = "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"


def pil_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


# ---------------------------------------------------------------------------
# HIGH-RESOLUTION 300-DPI MOCKUP & CHART GENERATORS (Pillow)
# ---------------------------------------------------------------------------

def draw_badge_icon(d, kind, x, y, color=(255, 255, 255)):
    """Draws crisp vector icons in Pillow so we never rely on missing emoji glyphs."""
    if kind == "search":
        d.ellipse([x, y, x + 14, y + 14], outline=color, width=3)
        d.line([(x + 12, y + 12), (x + 19, y + 19)], fill=color, width=3)
    elif kind == "shield":
        pts = [(x + 9, y), (x + 18, y + 4), (x + 18, y + 11), (x + 9, y + 19), (x, y + 11), (x, y + 4)]
        d.polygon(pts, outline=color, fill=None)
    elif kind == "lock":
        d.rounded_rectangle([x + 2, y + 8, x + 16, y + 19], radius=3, fill=color)
        d.arc([x + 4, y, x + 14, y + 12], start=180, end=0, fill=color, width=2)
    elif kind == "check":
        d.line([(x + 2, y + 10), (x + 7, y + 16), (x + 17, y + 4)], fill=color, width=3)
    elif kind == "tag":
        pts = [(x, y + 3), (x + 11, y + 3), (x + 18, y + 10), (x + 11, y + 17), (x, y + 17)]
        d.polygon(pts, outline=color, fill=None)
    elif kind == "stop":
        d.ellipse([x, y, x + 18, y + 18], fill=color)
        d.line([(x + 4, y + 9), (x + 14, y + 9)], fill=(255, 255, 255), width=3)


def generate_mobile_delivery_mockup() -> Path:
    """Renders a crisp mobile phone UI mockup for Site Gate Material Deliveries & BoQ Shield."""
    ASSETS.mkdir(parents=True, exist_ok=True)
    w, h = 920, 1220
    img = Image.new("RGBA", (w, h), (248, 250, 252, 0))
    d = ImageDraw.Draw(img)

    # Outer phone bezel
    d.rounded_rectangle([20, 10, w - 20, h - 10], radius=56, fill=(15, 23, 42), outline=(51, 65, 85), width=6)
    # Inner screen
    sx1, sy1, sx2, sy2 = 44, 38, w - 44, h - 38
    d.rounded_rectangle([sx1, sy1, sx2, sy2], radius=40, fill=(248, 250, 252))

    # Top header bar (Navy)
    d.rounded_rectangle([sx1, sy1, sx2, sy1 + 145], radius=40, fill=(10, 33, 61))
    d.rectangle([sx1, sy1 + 95, sx2, sy1 + 145], fill=(10, 33, 61))

    # Status bar & Notch
    d.rounded_rectangle([w // 2 - 90, sy1 + 12, w // 2 + 90, sy1 + 36], radius=12, fill=(7, 22, 44))
    d.text((sx1 + 32, sy1 + 14), "09:42", font=pil_font(FONT_BOLD, 20), fill=(255, 255, 255))
    d.text((sx2 - 175, sy1 + 14), "GPS LOCK • 5G", font=pil_font(FONT_BOLD, 17), fill=(74, 222, 128))

    # App Header
    d.text((sx1 + 32, sy1 + 56), "←  Site Gate Material Intake", font=pil_font(FONT_BOLD, 28), fill=(255, 255, 255))
    d.text((sx1 + 32, sy1 + 96), "Karam Apartments — Lang'ata (PRJ-KRM-01)", font=pil_font(FONT_REG, 20), fill=(148, 163, 184))

    y = sy1 + 170
    # Card 1: BoQ Line Item Selection
    d.rounded_rectangle([sx1 + 26, y, sx2 - 26, y + 175], radius=20, fill=(255, 255, 255), outline=(203, 213, 225), width=2)
    d.text((sx1 + 48, y + 18), "LINKED BILL OF QUANTITIES (BoQ) ITEM", font=pil_font(FONT_BOLD, 17), fill=(220, 38, 38))
    d.rounded_rectangle([sx1 + 48, y + 50, sx2 - 48, y + 112], radius=12, fill=(241, 245, 249), outline=(148, 163, 184), width=2)
    draw_badge_icon(d, "search", sx1 + 66, y + 71, (220, 38, 38))
    d.text((sx1 + 96, y + 67), "BOQ-02.04 • Ordinary Portland Cement (50kg)", font=pil_font(FONT_BOLD, 22), fill=(15, 23, 42))
    d.text((sx1 + 48, y + 128), "Unit: 50kg Bags   •   Rate: KES 920   •   Budget: KES 1,104,000", font=pil_font(FONT_REG, 19), fill=(71, 85, 105))

    y += 195
    # Card 2: Planned Allowance Shield (Green/Amber progress bar)
    d.rounded_rectangle([sx1 + 26, y, sx2 - 26, y + 215], radius=20, fill=(240, 253, 244), outline=(34, 197, 94), width=3)
    d.rounded_rectangle([sx1 + 48, y + 18, sx1 + 380, y + 52], radius=8, fill=(22, 163, 74))
    draw_badge_icon(d, "shield", sx1 + 62, y + 25, (255, 255, 255))
    d.text((sx1 + 88, y + 24), "PLANNED ALLOWANCE SHIELD", font=pil_font(FONT_BOLD, 17), fill=(255, 255, 255))
    d.text((sx2 - 220, y + 24), "WITHIN ALLOWANCE", font=pil_font(FONT_BOLD, 17), fill=(22, 163, 74))

    d.text((sx1 + 48, y + 68), "Cumulative Delivered: 650 / 1,200 Bags (54.2%)", font=pil_font(FONT_BOLD, 23), fill=(15, 23, 42))
    # Progress Bar
    bx1, by1, bx2, by2 = sx1 + 48, y + 108, sx2 - 48, y + 136
    d.rounded_rectangle([bx1, by1, bx2, by2], radius=14, fill=(226, 232, 240))
    fill_w = int((bx2 - bx1) * 0.542)
    d.rounded_rectangle([bx1, by1, bx1 + fill_w, by2], radius=14, fill=(22, 163, 74))
    # Current intake highlight
    cur_w = int((bx2 - bx1) * 0.125)
    d.rounded_rectangle([bx1 + fill_w - 6, by1, bx1 + fill_w + cur_w, by2], radius=10, fill=(217, 119, 6))
    d.text((sx1 + 48, y + 150), "Today's Intake: +150 Bags   •   Remaining Balance: 400 Bags", font=pil_font(FONT_BOLD, 19), fill=(21, 128, 61))
    d.text((sx1 + 48, y + 180), "Auto-blocks unapproved deliveries exceeding 1,200 Bags.", font=pil_font(FONT_REG, 17), fill=(71, 85, 105))

    y += 235
    # Card 3: Kenyan Supplier Quick-Select Chips
    d.rounded_rectangle([sx1 + 26, y, sx2 - 26, y + 190], radius=20, fill=(255, 255, 255), outline=(203, 213, 225), width=2)
    d.text((sx1 + 48, y + 18), "VERIFIED KENYAN SUPPLIER (ONE-TAP)", font=pil_font(FONT_BOLD, 17), fill=(10, 33, 61))
    chips = [
        ("Bamburi Cement", True, sx1 + 48, y + 54, 235),
        ("Apex Steel", False, sx1 + 298, y + 54, 175),
        ("Devki Steel", False, sx1 + 488, y + 54, 175),
        ("Savannah Cement", False, sx1 + 48, y + 116, 220),
        ("Simba Cement", False, sx1 + 283, y + 116, 195),
        ("Tononoka", False, sx1 + 493, y + 116, 170),
    ]
    for label, active, cx, cy, cw in chips:
        bg_c = (10, 33, 61) if active else (241, 245, 249)
        fg_c = (255, 255, 255) if active else (51, 65, 85)
        out_c = (10, 33, 61) if active else (203, 213, 225)
        d.rounded_rectangle([cx, cy, cx + cw, cy + 48], radius=24, fill=bg_c, outline=out_c, width=2)
        if active:
            draw_badge_icon(d, "check", cx + 18, cy + 14, (74, 222, 128))
            d.text((cx + 44, cy + 12), label, font=pil_font(FONT_BOLD, 19), fill=fg_c)
        else:
            d.text((cx + 22, cy + 12), label, font=pil_font(FONT_REG, 19), fill=fg_c)

    y += 210
    # Card 4: Work Plan Activity & Delivery Note
    d.rounded_rectangle([sx1 + 26, y, sx2 - 26, y + 150], radius=20, fill=(255, 255, 255), outline=(203, 213, 225), width=2)
    d.text((sx1 + 48, y + 18), "CPM WORK PLAN ACTIVITY & DELIVERY NOTE", font=pil_font(FONT_BOLD, 17), fill=(10, 33, 61))
    d.rounded_rectangle([sx1 + 48, y + 52, sx2 - 48, y + 96], radius=10, fill=(248, 250, 252), outline=(203, 213, 225), width=2)
    draw_badge_icon(d, "tag", sx1 + 64, y + 64, (18, 54, 91))
    d.text((sx1 + 92, y + 63), "WP-002 • First Floor Slab & Columns", font=pil_font(FONT_BOLD, 20), fill=(18, 54, 91))
    d.text((sx1 + 48, y + 110), "Delivery Note: DN-88412  •  Truck: KDK 412P  •  SQLite Draft Saved", font=pil_font(FONT_BOLD, 18), fill=(22, 163, 74))

    y += 170
    # Submit Button
    d.rounded_rectangle([sx1 + 26, y, sx2 - 26, y + 76], radius=18, fill=(220, 38, 38))
    draw_badge_icon(d, "lock", w // 2 - 235, y + 26, (255, 255, 255))
    d.text((w // 2 - 205, y + 23), "RECORD & SEAL GATE DELIVERY (SHA-256)", font=pil_font(FONT_BOLD, 22), fill=(255, 255, 255))

    out_file = ASSETS / "mobile_delivery_mockup.png"
    img.save(out_file, "PNG")
    return out_file


def generate_stage_gate_mockup() -> Path:
    """Renders a crisp mobile phone UI mockup showing the Contractual Stage-Gate Lockout."""
    ASSETS.mkdir(parents=True, exist_ok=True)
    w, h = 920, 1180
    img = Image.new("RGBA", (w, h), (248, 250, 252, 0))
    d = ImageDraw.Draw(img)

    # Outer phone bezel
    d.rounded_rectangle([20, 10, w - 20, h - 10], radius=56, fill=(15, 23, 42), outline=(51, 65, 85), width=6)
    sx1, sy1, sx2, sy2 = 44, 38, w - 44, h - 38
    d.rounded_rectangle([sx1, sy1, sx2, sy2], radius=40, fill=(248, 250, 252))

    # Top header bar (Navy)
    d.rounded_rectangle([sx1, sy1, sx2, sy1 + 145], radius=40, fill=(10, 33, 61))
    d.rectangle([sx1, sy1 + 95, sx2, sy1 + 145], fill=(10, 33, 61))
    d.rounded_rectangle([w // 2 - 90, sy1 + 12, w // 2 + 90, sy1 + 36], radius=12, fill=(7, 22, 44))
    d.text((sx1 + 32, sy1 + 14), "09:45", font=pil_font(FONT_BOLD, 20), fill=(255, 255, 255))
    d.text((sx2 - 185, sy1 + 14), "STAGE-GATE GUARD", font=pil_font(FONT_BOLD, 16), fill=(248, 113, 113))

    d.text((sx1 + 32, sy1 + 56), "←  Milestone Inspection & Claim", font=pil_font(FONT_BOLD, 28), fill=(255, 255, 255))
    d.text((sx1 + 32, sy1 + 96), "MS-02: Superstructure Frame (Columns & Slabs)", font=pil_font(FONT_REG, 20), fill=(203, 213, 225))

    y = sy1 + 168
    # Red Stage-Gate Lock Banner
    d.rounded_rectangle([sx1 + 26, y, sx2 - 26, y + 255], radius=20, fill=(254, 242, 242), outline=(220, 38, 38), width=4)
    d.rounded_rectangle([sx1 + 48, y + 20, sx2 - 48, y + 66], radius=10, fill=(220, 38, 38))
    draw_badge_icon(d, "lock", sx1 + 66, y + 32, (255, 255, 255))
    d.text((sx1 + 94, y + 30), "CONTRACTUAL STAGE-GATE LOCKED", font=pil_font(FONT_BOLD, 22), fill=(255, 255, 255))

    d.text((sx1 + 48, y + 84), "Progress claims (>0%) are blocked until all prerequisite", font=pil_font(FONT_BOLD, 20), fill=(153, 27, 27))
    d.text((sx1 + 48, y + 112), "structural milestones reach 100% certified completion:", font=pil_font(FONT_BOLD, 20), fill=(153, 27, 27))

    # Prerequisite pill inside banner
    d.rounded_rectangle([sx1 + 48, y + 150, sx2 - 48, y + 230], radius=14, fill=(255, 255, 255), outline=(248, 113, 113), width=2)
    draw_badge_icon(d, "stop", sx1 + 66, y + 167, (220, 38, 38))
    d.text((sx1 + 94, y + 164), "MS-01: Substructure & Raft Foundation", font=pil_font(FONT_BOLD, 21), fill=(15, 23, 42))
    d.text((sx1 + 68, y + 196), "Current Certified Progress: 50%  (Requires 100% to Unlock)", font=pil_font(FONT_BOLD, 18), fill=(220, 38, 38))

    y += 280
    # Locked Progress Slider Card
    d.rounded_rectangle([sx1 + 26, y, sx2 - 26, y + 175], radius=20, fill=(255, 255, 255), outline=(203, 213, 225), width=2)
    d.text((sx1 + 48, y + 20), "CLAIMED PHYSICAL COMPLETION (%)", font=pil_font(FONT_BOLD, 18), fill=(100, 116, 139))
    d.text((sx2 - 140, y + 16), "0%", font=pil_font(FONT_BOLD, 34), fill=(148, 163, 184))
    # Disabled slider track
    d.rounded_rectangle([sx1 + 48, y + 78, sx2 - 48, y + 102], radius=12, fill=(226, 232, 240))
    d.ellipse([sx1 + 44, y + 68, sx1 + 88, y + 112], fill=(148, 163, 184), outline=(100, 116, 139), width=3)
    d.text((sx1 + 48, y + 126), "Slider locked at 0% by Stage-Gate Governance Engine", font=pil_font(FONT_REG, 18), fill=(100, 116, 139))

    y += 198
    # Evidence & Cryptographic Status Card
    d.rounded_rectangle([sx1 + 26, y, sx2 - 26, y + 185], radius=20, fill=(255, 255, 255), outline=(203, 213, 225), width=2)
    d.text((sx1 + 48, y + 20), "CRYPTOGRAPHIC & GEOLOCATION VERIFICATION", font=pil_font(FONT_BOLD, 18), fill=(10, 33, 61))
    draw_badge_icon(d, "check", sx1 + 48, y + 62, (22, 163, 74))
    d.text((sx1 + 76, y + 60), "GPS Geofence: Verified Inside Karam Perimeter (14m)", font=pil_font(FONT_BOLD, 19), fill=(22, 163, 74))
    draw_badge_icon(d, "shield", sx1 + 48, y + 100, (18, 54, 91))
    d.text((sx1 + 76, y + 98), "Device Key: Ed25519 Hardware Biometric Ready", font=pil_font(FONT_REG, 19), fill=(51, 65, 85))
    draw_badge_icon(d, "lock", sx1 + 48, y + 138, (220, 38, 38))
    d.text((sx1 + 76, y + 136), "API Guard: HTTP 400 enforced on /sync/push & PATCH", font=pil_font(FONT_REG, 19), fill=(51, 65, 85))

    y += 210
    # Disabled Submit Button
    d.rounded_rectangle([sx1 + 26, y, sx2 - 26, y + 80], radius=18, fill=(203, 213, 225), outline=(148, 163, 184), width=2)
    draw_badge_icon(d, "lock", w // 2 - 215, y + 28, (71, 85, 105))
    d.text((w // 2 - 185, y + 25), "STAGE-GATE LOCKED (CANNOT SUBMIT)", font=pil_font(FONT_BOLD, 22), fill=(71, 85, 105))

    out_file = ASSETS / "stage_gate_mockup.png"
    img.save(out_file, "PNG")
    return out_file


def generate_web_erp_scurve_chart() -> Path:
    """Renders an executive Web ERP Financial Command Card with Earned Value S-Curve & Mini-BoQ IPC table."""
    ASSETS.mkdir(parents=True, exist_ok=True)
    w, h = 1350, 960
    img = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    d = ImageDraw.Draw(img)

    # Outer Browser/Dashboard Window
    d.rounded_rectangle([10, 10, w - 10, h - 10], radius=28, fill=(255, 255, 255), outline=(203, 213, 225), width=4)
    # Top Browser Chrome
    d.rounded_rectangle([10, 10, w - 10, 82], radius=28, fill=(10, 33, 61))
    d.rectangle([10, 50, w - 10, 82], fill=(10, 33, 61))
    d.ellipse([36, 34, 56, 54], fill=(239, 68, 68))
    d.ellipse([68, 34, 88, 54], fill=(245, 158, 11))
    d.ellipse([100, 34, 120, 54], fill=(34, 197, 94))
    d.text((155, 30), "Center Estates Web ERP  •  Karam Apartments — Lang'ata (PRJ-KRM-01)  •  Commercial & IPC Valuation", font=pil_font(FONT_BOLD, 22), fill=(255, 255, 255))

    # Top KPI Strip
    kpis = [
        ("CONTRACT SUM (BoQ)", "KES 420.0M", "Approved Baseline", (10, 33, 61)),
        ("CERTIFIED TO DATE (IPC #4)", "KES 148.5M", "35.4% Earned Value", (22, 163, 74)),
        ("RETENTION HELD (10%)", "KES 14.85M", "Escrow Protected", (217, 119, 6)),
        ("MATERIAL VARIANCE", "-0.4% (SAVING)", "BoQ Shield Active", (13, 148, 136)),
    ]
    kx = 36
    kw = 302
    for label, val, sub, col in kpis:
        d.rounded_rectangle([kx, 104, kx + kw, 232], radius=16, fill=(248, 250, 252), outline=(226, 232, 240), width=2)
        d.rectangle([kx, 104, kx + 8, 232], fill=col)
        d.text((kx + 24, 120), label, font=pil_font(FONT_BOLD, 16), fill=(100, 116, 139))
        d.text((kx + 24, 148), val, font=pil_font(FONT_BOLD, 30), fill=col)
        d.text((kx + 24, 192), sub, font=pil_font(FONT_REG, 17), fill=(71, 85, 105))
        kx += kw + 22

    # Middle Section: Earned Value S-Curve Chart
    cx1, cy1, cx2, cy2 = 36, 254, w - 36, 615
    d.rounded_rectangle([cx1, cy1, cx2, cy2], radius=18, fill=(255, 255, 255), outline=(226, 232, 240), width=2)
    d.text((cx1 + 28, cy1 + 18), "EARNED VALUE S-CURVE: PLANNED (PV) vs. CERTIFIED (EV)", font=pil_font(FONT_BOLD, 19), fill=(15, 23, 42))

    # Legend
    d.rectangle([cx2 - 520, cy1 + 22, cx2 - 490, cy1 + 30], fill=(10, 33, 61))
    d.text((cx2 - 480, cy1 + 16), "Planned (PV)", font=pil_font(FONT_BOLD, 16), fill=(10, 33, 61))
    d.rectangle([cx2 - 340, cy1 + 22, cx2 - 310, cy1 + 30], fill=(22, 163, 74))
    d.text((cx2 - 300, cy1 + 16), "Certified (EV)", font=pil_font(FONT_BOLD, 16), fill=(22, 163, 74))
    d.rectangle([cx2 - 155, cy1 + 22, cx2 - 125, cy1 + 30], fill=(220, 38, 38))
    d.text((cx2 - 115, cy1 + 16), "Actual (AC)", font=pil_font(FONT_BOLD, 16), fill=(220, 38, 38))

    # Plot Area
    px1, py1, px2, py2 = cx1 + 95, cy1 + 65, cx2 - 45, cy2 - 48
    # Horizontal grid lines
    for i, pct in enumerate(["100%", "75%", "50%", "25%", "0%"]):
        gy = py1 + int((py2 - py1) * (i / 4.0))
        d.line([(px1, gy), (px2, gy)], fill=(226, 232, 240), width=2)
        d.text((px1 - 65, gy - 10), pct, font=pil_font(FONT_REG, 16), fill=(100, 116, 139))

    months = ["M1", "M2", "M3", "M4 (Now)", "M5", "M6", "M7", "M8"]
    pv_vals = [0.05, 0.14, 0.25, 0.36, 0.52, 0.70, 0.88, 1.00]
    ev_vals = [0.05, 0.13, 0.24, 0.354]
    ac_vals = [0.05, 0.135, 0.238, 0.348]

    def pt_xy(idx, val):
        x = px1 + int((px2 - px1) * (idx / (len(months) - 1)))
        y = py2 - int((py2 - py1) * val)
        return (x, y)

    for idx, m in enumerate(months):
        mx, _ = pt_xy(idx, 0)
        d.text((mx - 18, py2 + 12), m, font=pil_font(FONT_BOLD if idx == 3 else FONT_REG, 16), fill=(15, 23, 42))

    # Draw PV curve
    pv_pts = [pt_xy(i, v) for i, v in enumerate(pv_vals)]
    d.line(pv_pts, fill=(10, 33, 61), width=4)
    for pt in pv_pts:
        d.ellipse([pt[0] - 5, pt[1] - 5, pt[0] + 5, pt[1] + 5], fill=(10, 33, 61))

    # Draw EV curve
    ev_pts = [pt_xy(i, v) for i, v in enumerate(ev_vals)]
    d.line(ev_pts, fill=(22, 163, 74), width=6)
    for pt in ev_pts:
        d.ellipse([pt[0] - 7, pt[1] - 7, pt[0] + 7, pt[1] + 7], fill=(22, 163, 74))

    # Draw AC curve
    ac_pts = [pt_xy(i, v) for i, v in enumerate(ac_vals)]
    d.line(ac_pts, fill=(220, 38, 38), width=4)
    for pt in ac_pts:
        d.ellipse([pt[0] - 5, pt[1] - 5, pt[0] + 5, pt[1] + 5], fill=(220, 38, 38))

    # Vertical "NOW" marker at M4
    now_x, now_y = pt_xy(3, 0.354)
    d.line([(now_x, py1), (now_x, py2)], fill=(217, 119, 6), width=2)
    d.rounded_rectangle([now_x + 12, now_y - 38, now_x + 275, now_y + 12], radius=8, fill=(240, 253, 244), outline=(22, 163, 74), width=2)
    d.text((now_x + 22, now_y - 26), "IPC #4 Certified: KES 148.5M", font=pil_font(FONT_BOLD, 17), fill=(21, 128, 61))

    # Bottom Section: Mini-BoQ Interim Valuation Table
    tx1, ty1, tx2, ty2 = 36, 636, w - 36, h - 32
    d.rounded_rectangle([tx1, ty1, tx2, ty2], radius=18, fill=(248, 250, 252), outline=(226, 232, 240), width=2)
    d.rounded_rectangle([tx1, ty1, tx2, ty1 + 48], radius=18, fill=(18, 54, 91))
    d.rectangle([tx1, ty1 + 24, tx2, ty1 + 48], fill=(18, 54, 91))

    headers = [("BoQ CODE", 24), ("ELEMENT DESCRIPTION", 180), ("BUDGET (KES)", 600), ("VERIFIED %", 800), ("CERTIFIED IPC", 965), ("AUDIT STATUS", 1130)]
    for h_text, hx in headers:
        d.text((tx1 + hx, ty1 + 14), h_text, font=pil_font(FONT_BOLD, 16), fill=(255, 255, 255))

    rows = [
        ("BOQ-01.01", "Substructure & Raft Foundation", "84,000,000", "100.0%", "84,000,000", "SHA-256 Sealed", "check", (22, 163, 74)),
        ("BOQ-02.04", "Superstructure RC Frame (Fl 1-3)", "112,000,000", "57.6%", "64,500,000", "GPS + Photo Verified", "check", (22, 163, 74)),
        ("BOQ-03.01", "Roofing & Structural Waterproofing", "48,000,000", "0.0%", "0", "Stage-Gate Locked", "lock", (220, 38, 38)),
    ]
    ry = ty1 + 60
    for code, desc, bud, pct, cert, status, ikind, scol in rows:
        d.line([(tx1 + 16, ry + 52), (tx2 - 16, ry + 52)], fill=(226, 232, 240), width=1)
        d.text((tx1 + 24, ry + 14), code, font=pil_font(FONT_MONO, 17), fill=(15, 23, 42))
        d.text((tx1 + 180, ry + 14), desc, font=pil_font(FONT_BOLD, 18), fill=(15, 23, 42))
        d.text((tx1 + 600, ry + 14), bud, font=pil_font(FONT_REG, 18), fill=(71, 85, 105))
        d.text((tx1 + 800, ry + 14), pct, font=pil_font(FONT_BOLD, 18), fill=scol)
        d.text((tx1 + 965, ry + 14), cert, font=pil_font(FONT_BOLD, 18), fill=(15, 23, 42))
        draw_badge_icon(d, ikind, tx1 + 1105, ry + 15, scol)
        d.text((tx1 + 1130, ry + 14), status, font=pil_font(FONT_BOLD, 16), fill=scol)
        ry += 62

    out_file = ASSETS / "web_erp_scurve.png"
    img.save(out_file, "PNG")
    return out_file


# ---------------------------------------------------------------------------
# PPTX SHAPE & TEXT HELPERS (Multi-line safe + crisp corner radius)
# ---------------------------------------------------------------------------

def add_text(slide, text, x, y, w, h, size=16, color=INK, bold=False,
             align=PP_ALIGN.LEFT, font="Liberation Sans", margin=0.04,
             valign=MSO_ANCHOR.MIDDLE, line_spacing=1.15):
    """Multi-line safe text helper that explicitly styles EVERY paragraph."""
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
    rect(slide, 0, 0, 13.333, 0.16, NAVY, None, False)
    rect(slide, 0, 0.16, 13.333, 0.72, WHITE, LINE, False)

    if LOGO.exists():
        slide.shapes.add_picture(str(LOGO), Inches(0.55), Inches(0.24), height=Inches(0.52))
    add_text(slide, "Center Estates ERP", 1.25, 0.25, 3.2, 0.28, 16, NAVY, True)
    add_text(slide, "CONSTRUCTION OVERSIGHT  •  FIELD TELEMETRY  •  STAGE-GATE GOVERNANCE", 1.25, 0.52, 7.8, 0.2, 8.5, MUTED, True)

    if number is not None:
        rect(slide, 12.15, 0.30, 0.65, 0.38, NAVY, None, True, corner=0.2)
        add_text(slide, f"{number:02d}", 12.15, 0.30, 0.65, 0.38, 11, WHITE, True, PP_ALIGN.CENTER)

    # Section Pill & Slide Title
    add_text(slide, section.upper(), 0.55, 1.02, 6.0, 0.24, 9.5, CRIMSON, True)
    add_text(slide, title, 0.55, 1.26, 12.2, 0.46, 24, INK, True)
    if subtitle:
        add_text(slide, subtitle, 0.55, 1.72, 12.2, 0.32, 12.5, MUTED)
    return slide


def bullets(slide, items, x, y, w, h, size=13.5, color=INK, bullet_char="▸  ", space_after=8):
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
        r1.font.color.rgb = CRIMSON

        # Support "Bold Prefix: Rest of text"
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


def proof_bar(slide, text, label="GOVERNANCE GUARANTEE"):
    rect(slide, 0.55, 6.82, 12.23, 0.44, NAVY, None, True, corner=0.08)
    rect(slide, 0.65, 6.90, 2.25, 0.28, CRIMSON, None, True, corner=0.15)
    add_text(slide, label, 0.65, 6.90, 2.25, 0.28, 8.5, WHITE, True, PP_ALIGN.CENTER)
    add_text(slide, text, 3.05, 6.88, 9.6, 0.32, 11, WHITE, True)


def card(slide, x, y, w, h, title, body=None, bullet_list=None, accent=CRIMSON, badge=None, body_size=11.5):
    """Modern executive card with top accent header bar, badge pill, and properly formatted paragraphs/bullets."""
    rect(slide, x, y, w, h, CARD_BG, LINE, True, corner=0.025)
    # Top accent bar
    rect(slide, x, y, w, 0.09, accent, None, False)

    header_y = y + 0.18
    if badge:
        bw = 0.56 if len(str(badge)) >= 3 else 0.44
        rect(slide, x + 0.22, header_y, bw, 0.36, accent, None, True, corner=0.2)
        add_text(slide, badge, x + 0.22, header_y, bw, 0.36, 11.5, WHITE, True, PP_ALIGN.CENTER)
        tx = x + 0.32 + bw
    else:
        tx = x + 0.22

    add_text(slide, title, tx, header_y, w - (tx - x) - 0.18, 0.38, 14, INK, True)

    content_y = y + 0.64
    if body:
        add_text(slide, body, x + 0.22, content_y, w - 0.44, h - 0.74, body_size, MUTED,
                 valign=MSO_ANCHOR.TOP, margin=0.02, line_spacing=1.18)
        if bullet_list:
            # Estimate offset after short intro paragraph
            lines_count = max(1, len(body) // 48 + body.count("\n") + 1)
            b_y = content_y + lines_count * 0.24 + 0.08
            bullets(slide, bullet_list, x + 0.18, b_y, w - 0.36, h - (b_y - y) - 0.12, size=body_size, color=MUTED, space_after=6)
    elif bullet_list:
        bullets(slide, bullet_list, x + 0.18, content_y, w - 0.36, h - 0.74, size=body_size, color=MUTED, space_after=6)


# ---------------------------------------------------------------------------
# MAIN PRESENTATION BUILDER (11 SLIDES)
# ---------------------------------------------------------------------------

def build_presentation():
    img_delivery = generate_mobile_delivery_mockup()
    img_stage_gate = generate_stage_gate_mockup()
    img_scurve = generate_web_erp_scurve_chart()

    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # =========================================================================
    # SLIDE 1: Cover Slide (Full-Bleed Architectural Hero + Executive Overlay)
    # =========================================================================
    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = NAVY_DARK

    if HERO.exists():
        s.shapes.add_picture(str(HERO), Inches(5.0), Inches(0), width=Inches(8.333), height=Inches(7.5))

    # Left Executive Panel
    rect(s, 0, 0, 5.85, 7.5, NAVY_DARK, None, False)
    rect(s, 5.75, 0, 0.12, 7.5, CRIMSON, None, False)

    if LOGO.exists():
        s.shapes.add_picture(str(LOGO), Inches(0.6), Inches(0.55), height=Inches(0.75))
    add_text(s, "Center Estates ERP", 1.5, 0.62, 3.8, 0.35, 22, WHITE, True)
    add_text(s, "CONSTRUCTION OVERSIGHT & FIELD TELEMETRY", 1.5, 0.96, 4.0, 0.22, 9, AMBER, True)

    rect(s, 0.6, 1.65, 3.4, 0.32, CRIMSON, None, True, corner=0.2)
    add_text(s, "LIVE STAKEHOLDER BRIEFING", 0.6, 1.65, 3.4, 0.32, 9.5, WHITE, True, PP_ALIGN.CENTER)

    add_text(s, "Eliminating Capital\nLeakage in Real Estate\nConstruction.", 0.6, 2.15, 4.9, 1.65, 28, WHITE, True, valign=MSO_ANCHOR.TOP, line_spacing=1.12)
    add_text(s, "Connecting the physical site gate directly to bank drawdown approvals via BoQ Allowance Shields, Contractual Stage-Gates, and Offline-First Mobile Telemetry.",
             0.6, 3.95, 4.8, 1.05, 12.5, RGBColor(203, 213, 225), valign=MSO_ANCHOR.TOP, line_spacing=1.25)

    # KPI Metric Pills on Left
    metrics = [
        ("100%", "BoQ-Bound Gate Intake", GREEN),
        ("SHA-256", "Tamper-Evident Seals", AMBER),
        ("0% Leakage", "Stage-Gate Protected", CRIMSON),
    ]
    for i, (m_val, m_lbl, m_col) in enumerate(metrics):
        mx = 0.6 + i * 1.62
        rect(s, mx, 5.25, 1.52, 0.92, NAVY_LIGHT, m_col, True, corner=0.08, line_width=1.5)
        add_text(s, m_val, mx + 0.08, 5.35, 1.36, 0.36, 14, WHITE, True, PP_ALIGN.CENTER)
        add_text(s, m_lbl, mx + 0.06, 5.72, 1.40, 0.34, 8.5, RGBColor(203, 213, 225), False, PP_ALIGN.CENTER)

    add_text(s, "Featured Project: Karam Apartments — Lang'ata (PRJ-KRM-01)  •  centerestates.com",
             0.6, 6.75, 5.0, 0.35, 9.5, SLATE_LIGHT)

    # Floating Executive Summary Card on Right over Hero Image
    rect(s, 6.35, 0.75, 6.45, 6.0, WHITE, LINE, True, corner=0.025)
    rect(s, 6.35, 0.75, 6.45, 0.10, CRIMSON, None, False)
    add_text(s, "EXECUTIVE OVERVIEW", 6.65, 1.02, 5.5, 0.25, 10, CRIMSON, True)
    add_text(s, "One Auditable Chain from Site Gate to IPC Drawdown", 6.65, 1.28, 5.85, 0.55, 18, INK, True)
    bullets(s, [
        "Bill of Quantities (BoQ) Shield: Every material delivery at the gate is validated against contractual budget limits before offloading.",
        "Contractual Stage-Gate Engine: Downstream milestones remain mathematically locked until prerequisite structural works reach 100%.",
        "Offline-First Mobile App: Complete Clerk of Works field diary with local SQLite persistence and automatic delta-sync.",
        "Cryptographic Non-Repudiation: Ed25519 biometric hardware signatures, GPS geofence guards, and SHA-256 evidence seals.",
        "Automated Mini-BoQ Valuations: Real-time Interim Payment Certificates (IPCs) backed by verified field evidence."
    ], 6.62, 1.95, 5.9, 4.5, size=12.5, space_after=10)

    # =========================================================================
    # SLIDE 2: Industry Challenge
    # =========================================================================
    s = base_slide(prs, "01 • Industry Challenge", "The Three Critical Blind Spots in Construction Execution",
                   "Why 15% to 25% of commercial development capital is lost between the site gate and the finance office.", 1)
    card(s, 0.55, 2.22, 3.9, 4.35, "Phantom & Over-Deliveries",
         "Paper delivery notes signed at the site gate with zero live cross-reference to the approved Bill of Quantities.",
         [
             "Budget Overruns: Materials delivered beyond contractual allowances without real-time visibility.",
             "Supplier Opacity: No standardized tracking of batch quality or approved manufacturers.",
             "Retrospective Discovery: Variances only uncovered months later during final account audits."
         ], CRIMSON, "01", body_size=11.5)

    card(s, 4.71, 2.22, 3.9, 4.35, "Premature Progress Claims",
         "Contractors claiming completion on downstream finishes before critical structural foundations are certified.",
         [
             "Front-Loaded Claims: Capital disbursed ahead of actual physical progress on site.",
             "Subjective Valuations: Visual estimates disconnected from measured BoQ sub-elements.",
             "Dispute Exposure: Lack of immutable stage-gate prerequisites triggers arbitration."
         ], AMBER, "02", body_size=11.5)

    card(s, 8.87, 2.22, 3.9, 4.35, "Disconnected Site Diaries",
         "Clerk of Works observations scattered across paper logbooks, email threads, and unverified WhatsApp photos.",
         [
             "Unverified Media: Site photos lack hardware GPS coordinates and tamper-evident hashes.",
             "Missed Concrete Tests: 7, 14, and 28-day cylinder crushing tests forgotten or unlinked.",
             "Snag Amnesia: Structural defects logged verbally fail to reach the QS before payment."
         ], NAVY_LIGHT, "03", body_size=11.5)

    proof_bar(s, "Traditional oversight relies on trust and post-mortem audits. Center Estates enforces proactive digital stage-gates.")

    # =========================================================================
    # SLIDE 3: System Architecture
    # =========================================================================
    s = base_slide(prs, "02 • Unified Platform Architecture", "End-to-End Architecture: Mobile Field App ↔ REST API ↔ Web ERP",
                   "A single continuous operating record connecting field engineers, quantity surveyors, and project financiers.", 2)

    card(s, 0.55, 2.22, 3.75, 4.35, "Mobile Field App (Expo / RN)",
         "Authoritative source of physical site truth for Clerks of Works and Resident Engineers.",
         [
             "Offline-First SQLite: TinyBase reactive store persists all logs & drafts without 4G.",
             "Rugged Field UX: Searchable BoQ picker and one-tap Kenyan supplier chips.",
             "GPS Geofencing: Hardware coordinate lock against project site boundaries.",
             "Biometric Sign-Off: Ed25519 hardware key signatures on every submission."
         ], CRIMSON, "APP", body_size=11.2)

    # Connector Arrow 1
    rect(s, 4.34, 4.05, 0.36, 0.55, NAVY, None, True, corner=0.2)
    add_text(s, "⇄", 4.34, 4.05, 0.36, 0.55, 16, WHITE, True, PP_ALIGN.CENTER)

    card(s, 4.74, 2.22, 3.85, 4.35, "Central API (Django & MySQL)",
         "Production governance engine running at api.centerestates.com.",
         [
             "Atomic Delta-Sync: Idempotent /sync/pull and /sync/push endpoints.",
             "Stage-Gate Validator: Rejects progress >0% if prerequisite milestones <100%.",
             "SHA-256 Evidence Seals: Cryptographic hash computed over payload + photo bytes.",
             "Role-Based Access: Strict separation of Clerk, Consultant, and Owner permissions."
         ], NAVY_LIGHT, "API", body_size=11.2)

    # Connector Arrow 2
    rect(s, 8.63, 4.05, 0.36, 0.55, NAVY, None, True, corner=0.2)
    add_text(s, "⇄", 8.63, 4.05, 0.36, 0.55, 16, WHITE, True, PP_ALIGN.CENTER)

    card(s, 9.03, 2.22, 3.75, 4.35, "Office Web ERP (Next.js 14)",
         "Executive command center for Developers, Project Managers, and QSs.",
         [
             "CPM Work Plan & Gantt: Predecessor scheduling and critical path tracking.",
             "Bill of Quantities (BoQ): Live line-item budgets, rates, and variance shields.",
             "Mini-BoQ Valuations: Automated Interim Payment Certificates (IPCs).",
             "Live Snag Kanban: Instant visibility into field-reported quality defects."
         ], GREEN, "WEB", body_size=11.2)

    proof_bar(s, "Immutable Field Truth: Office users can review and certify, but can never alter or delete raw field evidence.")

    # =========================================================================
    # SLIDE 4: Mobile Gate Deliveries & BoQ Shield (WITH HIGH-RES PHONE MOCKUP)
    # =========================================================================
    s = base_slide(prs, "03 • Field Material Control", "Site Gate Deliveries Bound to BoQ Allowances",
                   "Preventing material over-delivery and budget leakage before the truck leaves the site perimeter.", 3)

    # Left: 2x2 Feature Grid + Bottom Callout
    card(s, 0.55, 2.20, 3.75, 2.08, "Searchable BoQ Item Picker",
         "Clerk selects directly from the project's approved Bill of Quantities (e.g. BOQ-02.04 Cement). Automatically binds item code, unit, and contractual rate.",
         accent=CRIMSON, badge="01", body_size=11)

    card(s, 4.48, 2.20, 3.75, 2.08, "Kenyan Supplier Quick-Chips",
         "One-tap verified supplier chips (Bamburi, Apex Steel, Devki, Savannah, Simba, Tononoka) eliminate typos and standardize procurement audits.",
         accent=AMBER, badge="02", body_size=11)

    card(s, 0.55, 4.44, 3.75, 2.15, "Planned Allowance Shield",
         "Live progress bar compares cumulative delivered quantity against total BoQ allowance. Triggers an immediate red warning if intake exceeds budget.",
         accent=GREEN, badge="03", body_size=11)

    card(s, 4.48, 4.44, 3.75, 2.15, "Work Plan Task Tagging",
         "Every material intake is tagged to a specific CPM Work Plan activity (e.g. WP-002 First Floor Slab) and persists locally via useFormDraft.",
         accent=NAVY_LIGHT, badge="04", body_size=11)

    # Right: High-Res Phone Mockup
    s.shapes.add_picture(str(img_delivery), Inches(8.55), Inches(1.92), height=Inches(4.78))

    proof_bar(s, "100% Traceability: Every bag of cement and ton of steel is linked to a BoQ line item, supplier, and work plan task.")

    # =========================================================================
    # SLIDE 5: Contractual Stage-Gate Engine (WITH HIGH-RES PHONE MOCKUP)
    # =========================================================================
    s = base_slide(prs, "04 • Contractual Governance", "The Stage-Gate Engine: Mathematical Payout Protection",
                   "Downstream milestones cannot advance above 0% until all prerequisite structural works reach 100%.", 4)

    # Left: Stage-Gate Progression Diagram + Governance Bullets
    stages = [
        ("MS-01: Substructure & Raft", "50% IN PROGRESS", "Prerequisite Incomplete", AMBER),
        ("MS-02: Superstructure Frame", "🔒 LOCKED AT 0%", "Blocked by MS-01 (<100%)", CRIMSON),
        ("MS-03: Roofing & Finishes", "🔒 LOCKED AT 0%", "Blocked by MS-02 (<100%)", NAVY_LIGHT),
    ]
    for i, (st_title, st_badge, st_sub, st_col) in enumerate(stages):
        sx = 0.55 + i * 2.62
        rect(s, sx, 2.20, 2.42, 1.65, WHITE, st_col, True, corner=0.04, line_width=2.0)
        rect(s, sx, 2.20, 2.42, 0.09, st_col, None, False)
        add_text(s, st_title, sx + 0.12, 2.36, 2.18, 0.45, 12, INK, True, PP_ALIGN.CENTER)
        rect(s, sx + 0.22, 2.88, 1.98, 0.34, st_col, None, True, corner=0.2)
        add_text(s, st_badge, sx + 0.22, 2.88, 1.98, 0.34, 9.5, WHITE, True, PP_ALIGN.CENTER)
        add_text(s, st_sub, sx + 0.12, 3.32, 2.18, 0.35, 10, MUTED, True, PP_ALIGN.CENTER)
        if i < 2:
            add_text(s, "➔", sx + 2.43, 2.82, 0.20, 0.35, 16, MUTED, True, PP_ALIGN.CENTER)

    card(s, 0.55, 4.05, 7.68, 2.55, "Dual-Layer Enforcement (Mobile UI + Backend API)",
         bullet_list=[
             "Mobile Stage-Gate Lock Banner: MilestoneDetailScreen evaluates evaluateMilestoneGovernance() in real time, displaying the exact blocking predecessors and disabling the submit button.",
             "Strict Backend Validation: Both PATCH /milestones/<id>/ and POST /sync/push call milestone.get_incomplete_prerequisites() and return HTTP 400 if any predecessor is <100%.",
             "Zero Premature Drawdowns: Protects developers and lenders from paying for superstructure or finishes before foundational integrity is 100% certified."
         ], accent=CRIMSON, badge="🔒", body_size=11.2)

    # Right: High-Res Stage-Gate Phone Mockup
    s.shapes.add_picture(str(img_stage_gate), Inches(8.55), Inches(1.92), height=Inches(4.78))

    proof_bar(s, "Stage-gates turn construction contracts into executable code—eliminating subjective certification bias.")

    # =========================================================================
    # SLIDE 6: Quality & Compliance
    # =========================================================================
    s = base_slide(prs, "05 • Quality, Structural Testing & HSE", "Field Snagging, Concrete Cube Lifecycle & Safety Escalation",
                   "Capturing structural quality tests and engineering defects at the source with live Kanban synchronization.", 5)

    card(s, 0.55, 2.22, 3.9, 4.35, "Mobile Snag & Defect Ticketing",
         "Resident Engineers log structural and finishing defects directly from the floor plate.",
         [
             "Severity & Category: Urgent / High / Normal routing across Structural, MEP, and Finishes.",
             "Geotagged Photo Proof: Mandatory camera capture with hardware GPS coordinates.",
             "Live Office Kanban: Syncs immediately to the Web ERP oversight board for contractor resolution.",
             "Closure Verification: Requires before-and-after photographic sign-off."
         ], CRIMSON, "⚡", body_size=11.2)

    card(s, 4.71, 2.22, 3.9, 4.35, "Concrete Cube Curing Scheduler",
         "Automated structural pour compliance aligned with BS 8110 / Eurocode 2 standards.",
         [
             "Batch & Slump Intake: Logs concrete grade (e.g. C30/37), mixer truck, and slump test results.",
             "Automated 7 / 14 / 28-Day Alerts: Automatically schedules mandatory lab crushing tests.",
             "Pass/Fail Thresholds: Highlights compressive strength shortfalls (MPa) before slab loading.",
             "Permanent Audit Archive: Lab certificates attached directly to the structural milestone."
         ], AMBER, "🧱", body_size=11.2)

    card(s, 8.87, 2.22, 3.9, 4.35, "HSE & Regulatory Compliance",
         "Immediate escalation protocol for site safety inspections, near-misses, and NCA/DOSHS compliance.",
         [
             "PPE & Scaffold Audits: Daily digital checklists completed by the Clerk of Works.",
             "Incident Root-Cause Tracking: Severity grading and Corrective Action Plan (CAP) workflows.",
             "Statutory Readiness: Maintains full National Construction Authority (NCA) inspection logs.",
             "Zero-Delay Escalation: High-severity incidents trigger instant executive alerts."
         ], NAVY_LIGHT, "🦺", body_size=11.2)

    proof_bar(s, "Quality assurance records and concrete test certificates form an immutable structural passport for handover.")

    # =========================================================================
    # SLIDE 7: Financial Control & Mini-BoQ Valuations (WITH S-CURVE & IPC MOCKUP)
    # =========================================================================
    s = base_slide(prs, "06 • Commercial & Financial Control", "Earned Value S-Curve & Automated Mini-BoQ Valuations (IPCs)",
                   "Converting verified field progress into audit-ready Interim Payment Certificates in minutes.", 6)

    # Left: 3 Stacked Commercial Control Cards
    card(s, 0.55, 2.20, 4.95, 1.38, "1. Mini-BoQ Line-Item Valuation",
         "Quantity Surveyors inspect the exact BoQ sub-elements linked to each milestone, calculating certified KES earned value with zero spreadsheet formulas.",
         accent=NAVY_LIGHT, badge="QS", body_size=10.8)

    card(s, 0.55, 3.70, 4.95, 1.38, "2. AI Progress & Variance Audit",
         "Automated variance engine compares Planned Value (PV), Earned Value (EV), and Actual Cost (AC), flagging schedule slippage and material anomalies.",
         accent=CRIMSON, badge="AI", body_size=10.8)

    card(s, 0.55, 5.20, 4.95, 1.38, "3. Escrow & Retention Drawdowns",
         "Generates bank-ready PDF Interim Payment Certificates with automatic 10% retention deductions and cryptographic links to supporting site photos.",
         accent=GREEN, badge="IPC", body_size=10.8)

    # Right: High-Res Web ERP S-Curve & Mini-BoQ Table Image
    s.shapes.add_picture(str(img_scurve), Inches(5.72), Inches(2.15), width=Inches(7.05))

    proof_bar(s, "Every shilling certified on an Interim Payment Certificate is backed by geotagged photos and sealed gate deliveries.")

    # =========================================================================
    # SLIDE 8: Anti-Fraud & Offline Resilience
    # =========================================================================
    s = base_slide(prs, "07 • Anti-Fraud Architecture", "Offline Resilience & Cryptographic Non-Repudiation",
                   "Purpose-built for deep basements and remote sites without sacrificing bank-grade security.", 7)

    card(s, 0.55, 2.22, 2.88, 4.35, "Offline SQLite Engine",
         "Deep excavations and basements rarely have reliable 4G.",
         [
             "Local Persistence: All BoQ items, milestones, and daily logs cached in SQLite.",
             "Draft Recovery: useFormDraft hook prevents data loss if battery dies mid-inspection.",
             "Auto Delta-Sync: Queued payloads sync atomically once connectivity returns."
         ], NAVY_LIGHT, "01", body_size=11)

    card(s, 3.63, 2.22, 2.88, 4.35, "Biometric Hardware Keys",
         "Eliminates shared passwords and unauthorized proxy sign-offs.",
         [
             "Ed25519 Keypair: Generated inside the mobile device's secure hardware keystore.",
             "Biometric Prompt: Fingerprint / FaceID required to sign milestone submissions.",
             "Non-Repudiation: Cryptographic proof of the exact engineer who certified the work."
         ], GREEN, "02", body_size=11)

    card(s, 6.71, 2.22, 2.88, 4.35, "GPS Geofence Guard",
         "Prevents off-site photo uploads and Recycled Photo fraud.",
         [
             "Perimeter Lock: Compares hardware GPS coordinates against project polygon.",
             "Distance Telemetry: Records exact meter offset and GPS accuracy radius.",
             "Fraud Flagging: Out-of-bounds submissions are automatically flagged for audit."
         ], AMBER, "03", body_size=11)

    card(s, 9.79, 2.22, 2.98, 4.35, "SHA-256 Evidence Seals",
         "Tamper-evident cryptographic sealing at the moment of capture.",
         [
             "Composite Hash: Computed over milestone ID, progress %, notes, GPS, and photo bytes.",
             "Server Verification: Re-verified upon ingestion by api.centerestates.com.",
             "Audit Certificate: Displayed on Web ERP alongside the green Verified badge."
         ], CRIMSON, "04", body_size=11)

    proof_bar(s, "Security is embedded directly into the mobile data capture layer—making fraudulent progress claims mathematically impossible.")

    # =========================================================================
    # SLIDE 9: Live Demo Run of Show
    # =========================================================================
    s = base_slide(prs, "08 • Live Demonstration Script", "Recommended 5-Step Live Demonstration Flow (8 Minutes)",
                   "A high-impact, cohesive walkthrough using Karam Apartments — Lang'ata (PRJ-KRM-01).", 8)

    rows = [
        ("STEP 01", "Office Baseline Setup (Web ERP)", "Open Karam Apartments (PRJ-KRM-01). Show the CPM Work Plan Gantt and approved BoQ allowances.", "1.5 MIN", NAVY_LIGHT),
        ("STEP 02", "Site Gate Delivery (Mobile App)", "Open Daily Log -> Material Delivery. Pick 'BOQ-02.04 Cement', tap 'Bamburi', show Planned Allowance Shield.", "2.0 MIN", GREEN),
        ("STEP 03", "Stage-Gate Lockout (Mobile App)", "Open 'Superstructure Frame'. Highlight the red '🔒 Contractual Stage-Gate Locked' banner blocking claims.", "1.5 MIN", CRIMSON),
        ("STEP 04", "Live Defect Sync (Mobile -> Web)", "Capture a rebar spacing snag on Mobile. Switch to Web ERP to show immediate appearance on the Kanban board.", "1.5 MIN", AMBER),
        ("STEP 05", "Mini-BoQ & IPC Valuation (Web)", "Open Milestones -> Mini-BoQ Valuation. Inspect certified KES value, retention deduction, and AI Progress Audit.", "1.5 MIN", TEAL),
    ]
    y = 2.22
    for step, title, desc, dur, col in rows:
        rect(s, 0.55, y, 12.23, 0.78, WHITE, LINE, True, corner=0.05)
        rect(s, 0.68, y + 0.16, 1.25, 0.46, col, None, True, corner=0.18)
        add_text(s, step, 0.68, y + 0.16, 1.25, 0.46, 10.5, WHITE, True, PP_ALIGN.CENTER)
        add_text(s, title, 2.12, y + 0.14, 3.35, 0.50, 13, INK, True)
        add_text(s, desc, 5.55, y + 0.14, 5.75, 0.50, 11.2, MUTED)
        rect(s, 11.45, y + 0.18, 1.15, 0.42, PALE, LINE, True, corner=0.18)
        add_text(s, dur, 11.45, y + 0.18, 1.15, 0.42, 10.5, NAVY, True, PP_ALIGN.CENTER)
        y += 0.88

    proof_bar(s, "Keep the entire demonstration anchored inside Karam Apartments (PRJ-KRM-01) to prove end-to-end data continuity.")

    # =========================================================================
    # SLIDE 10: Business Case & Stakeholder ROI
    # =========================================================================
    s = base_slide(prs, "09 • Business Case & ROI", "Measurable Financial Impact Across Every Project Stakeholder",
                   "Why institutional developers, consultants, and project financiers standardize on Center Estates.", 9)

    card(s, 0.55, 2.22, 3.9, 4.35, "Real Estate Developers",
         "Protects equity capital and accelerates project delivery.",
         [
             "15%–20% Cost Protection: Eliminates phantom deliveries and unapproved BoQ overages.",
             "Real-Time Visibility: Live executive S-Curve across all active development sites.",
             "Seamless Handover: Completed units transition directly into Center Estates Sales & Lettings."
         ], CRIMSON, "DEV", body_size=11.5)

    card(s, 4.71, 2.22, 3.9, 4.35, "Project Managers & QSs",
         "Replaces manual spreadsheet reconciliation with automated governance.",
         [
             "80% Faster IPC Valuations: Mini-BoQ calculations generated in minutes instead of days.",
             "Standardized Site Records: Automated concrete cube schedules and daily weather/labour logs.",
             "Dispute Defense: Time-stamped, geotagged photographic proof resolves contractor claims."
         ], AMBER, "QS", body_size=11.5)

    card(s, 8.87, 2.22, 3.9, 4.35, "Banks & Project Financiers",
         "De-risks construction debt drawdowns with cryptographic proof.",
         [
             "Verified Drawdowns: Every tranche disbursement tied to 100% stage-gated milestones.",
             "Anti-Collusion Controls: Ed25519 biometric signatures + GPS geofence validation.",
             "ESG & Statutory Audit: Complete NCA, DOSHS, and structural quality compliance trail."
         ], GREEN, "FIN", body_size=11.5)

    proof_bar(s, "Center Estates transforms construction monitoring from a passive reporting chore into an active financial shield.")

    # =========================================================================
    # SLIDE 11: Closing Slide
    # =========================================================================
    s = base_slide(prs, "10 • Summary & Live Q&A", "One Operating Record: From Groundbreaking to Estate Handover",
                   "The mobile app is live, the backend is synchronized, and Karam Apartments is ready for inspection.", 10)

    rect(s, 0.55, 2.22, 12.23, 1.05, NAVY, None, True, corner=0.04)
    add_text(s, "GATE INTAKE (BoQ)   ➔   FIELD VERIFICATION   ➔   STAGE-GATE GUARD   ➔   IPC CERTIFICATION   ➔   ESTATE HANDOVER",
             0.75, 2.52, 11.83, 0.45, 13.5, WHITE, True, PP_ALIGN.CENTER)

    add_text(s, "Ready for Live Walkthrough & Stakeholder Scenarios",
             0.8, 3.50, 11.7, 0.50, 22, INK, True, PP_ALIGN.CENTER)

    card(s, 0.55, 4.20, 5.95, 2.35, "Live Demonstration Environment",
         bullet_list=[
             "Web ERP Command Center: https://centerestates.com",
             "Presentation & Resource Hub: https://centerestates.com/presentations/",
             "Featured Project: Karam Apartments — Lang'ata (PRJ-KRM-01)",
             "Automated Test Suite: 100% Pass Rate (135 Web + 73 Mobile Tests)"
         ], accent=NAVY_LIGHT, badge="🌐", body_size=11.5)

    card(s, 6.83, 4.20, 5.95, 2.35, "Platform & Engineering Governance",
         bullet_list=[
             "Suite: Center Estates Enterprise Construction & Field Mobility",
             "Architecture: Next.js 14 Web • Expo React Native • Django REST API",
             "Security: Ed25519 Biometrics • SHA-256 Seals • SQLite Offline Sync",
             "Organization: Center Estates Enterprise Engineering"
         ], accent=CRIMSON, badge="🛡", body_size=11.5)

    proof_bar(s, "Thank you. Let us open Karam Apartments (PRJ-KRM-01) for the live demonstration.")

    OUT.mkdir(parents=True, exist_ok=True)
    out_path = OUT / "Center_Estates_Construction_and_Mobile_Presentation.pptx"
    prs.save(out_path)
    return out_path


if __name__ == "__main__":
    generated = build_presentation()
    print(f"Presentation successfully created at: {generated}")
