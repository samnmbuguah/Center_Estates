import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            # Skip header/footer on cover page
            return

        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#64748B"))

        # Top Running Header
        self.drawString(54, letter[1] - 36, "CENTER ESTATES ERP — USER & OPERATIONAL GUIDE")
        self.setFont("Helvetica", 8)
        self.drawRightString(letter[0] - 54, letter[1] - 36, "Legend Management Edition")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, letter[1] - 42, letter[0] - 54, letter[1] - 42)

        # Bottom Running Footer
        self.line(54, 45, letter[0] - 54, 45)
        self.drawString(54, 32, "Confidential — For Authorized Staff Only")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(letter[0] - 54, 32, page_text)
        self.restoreState()


def build_pdf(output_path):
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom styles
    c_primary = colors.HexColor("#1E3A8A")   # Dark Navy
    c_accent = colors.HexColor("#2563EB")    # Bright Blue
    c_dark = colors.HexColor("#0F172A")      # Slate 900
    c_muted = colors.HexColor("#475569")     # Slate 600
    c_card_bg = colors.HexColor("#F8FAFC")   # Light slate bg
    c_border = colors.HexColor("#E2E8F0")

    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=26,
        leading=32,
        textColor=c_primary,
        spaceAfter=12
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=13,
        leading=18,
        textColor=c_muted,
        spaceAfter=24
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=c_primary,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=c_accent,
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=c_dark,
        spaceAfter=8
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=c_dark,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )

    callout_style = ParagraphStyle(
        'Callout',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1E293B")
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=c_dark
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.white
    )

    story = []

    # ------------------ COVER PAGE ------------------
    story.append(Spacer(1, 40))
    story.append(Paragraph("CENTER ESTATES ERP", ParagraphStyle(
        'BrandTag',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=14,
        textColor=c_accent,
        spaceAfter=15
    )))
    story.append(Paragraph("Property Manager & Team Operational Manual", title_style))
    story.append(Paragraph("A Complete Guide to Property Management, Scoping, Leases, Invoicing, Work Orders, and Multi-Module Operations.", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=3, color=c_accent, spaceBefore=5, spaceAfter=25))

    meta_data = [
        [Paragraph("<b>Target Audience:</b>", table_cell_style), Paragraph("Property Managers, Caretakers, Accountants, Admins", table_cell_style)],
        [Paragraph("<b>Organization:</b>", table_cell_style), Paragraph("Legend Management Limited / Center Estates Ecosystem", table_cell_style)],
        [Paragraph("<b>Version:</b>", table_cell_style), Paragraph("2026.1 Enterprise Release", table_cell_style)],
        [Paragraph("<b>System URL:</b>", table_cell_style), Paragraph("https://centerestates.com & https://centerestates.com/app", table_cell_style)],
        [Paragraph("<b>API Base:</b>", table_cell_style), Paragraph("https://api.centerestates.com", table_cell_style)],
    ]
    meta_table = Table(meta_data, colWidths=[130, 370])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_card_bg),
        ('BOX', (0,0), (-1,-1), 1, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(meta_table)

    story.append(Spacer(1, 40))

    callout_data = [[
        Paragraph(
            "<b>Important Note for New Users:</b><br/>"
            "Center Estates employs strict role-based and property-level isolation. "
            "When your account is first created, you will belong to your organization (e.g. <b>Legend Management Limited</b>) "
            "with your assigned role (e.g. <b>Property Manager</b>). If you have not yet been assigned specific properties, "
            "your property dropdown will be empty until your administrator assigns your assigned buildings.",
            callout_style
        )
    ]]
    callout_table = Table(callout_data, colWidths=[500])
    callout_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EFF6FF")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#BFDBFE")),
        ('LINELEFT', (0,0), (0,-1), 4, c_accent),
        ('PADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(callout_table)

    story.append(PageBreak())

    # ------------------ SECTION 1: SYSTEM OVERVIEW & NAVIGATION ------------------
    story.append(Paragraph("1. System Overview & Navigation", h1_style))
    story.append(Paragraph(
        "Center Estates is a unified Enterprise Real Estate ERP that centralizes property management, facility operations, "
        "construction monitoring, tenders, sales, and valuations into a single high-performance platform.",
        body_style
    ))

    story.append(Paragraph("1.1 Signing In and Authentication", h2_style))
    story.append(Paragraph("• <b>Login URL:</b> Visit <code>https://centerestates.com/login</code>.", bullet_style))
    story.append(Paragraph("• <b>Credentials:</b> Enter your assigned username or email address and password.", bullet_style))
    story.append(Paragraph("• <b>Session Security:</b> Sessions are securely signed with JWT tokens and refreshed automatically.", bullet_style))

    story.append(Paragraph("1.2 The Module Switcher (Blue Left Rail)", h2_style))
    story.append(Paragraph(
        "Inside any active module, a sleek <b>Blue Icon Rail</b> is displayed permanently on the left side of your desktop display. "
        "This rail allows instantaneous 1-click switching between all operational departments you have permission to access:",
        body_style
    ))

    modules_data = [
        [Paragraph("Module", table_header_style), Paragraph("Icon", table_header_style), Paragraph("Key Workflows", table_header_style)],
        [Paragraph("<b>Property Management</b>", table_cell_style), Paragraph("Building", table_cell_style), Paragraph("Units, Leases, Rent Invoicing, Utility Readings, Arrears, Bank Rec", table_cell_style)],
        [Paragraph("<b>Facility Management</b>", table_cell_style), Paragraph("Wrench / Tool", table_cell_style), Paragraph("Maintenance tickets, Work orders, Preventative inspections, Assets", table_cell_style)],
        [Paragraph("<b>Sales Management</b>", table_cell_style), Paragraph("HandCoins", table_cell_style), Paragraph("Off-plan unit reservations, Buyer portals, Commissions, Installments", table_cell_style)],
        [Paragraph("<b>Tender Management</b>", table_cell_style), Paragraph("Scale", table_cell_style), Paragraph("Bid pipelines, Gate evaluations, Compliance scoring, Bid submissions", table_cell_style)],
        [Paragraph("<b>Valuations</b>", table_cell_style), Paragraph("ClipboardCheck", table_cell_style), Paragraph("Valuation instructions, Site inspections, Comparables, Signed PDF reports", table_cell_style)],
        [Paragraph("<b>Construction Monitoring</b>", table_cell_style), Paragraph("HardHat", table_cell_style), Paragraph("Daily site logs, GPS photo timelines, S-curves, Bill of Quantities (BoQs)", table_cell_style)],
    ]
    mod_table = Table(modules_data, colWidths=[120, 80, 300])
    mod_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('BOX', (0,0), (-1,-1), 1, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_card_bg]),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(mod_table)

    story.append(Paragraph("1.3 Property Context & Switching Modal", h2_style))
    story.append(Paragraph(
        "Each property in Center Estates operates in its own isolated ledger. When switching modules or clicking the Property Icon on the rail, "
        "a dialog prompts you whether to continue on the current property or switch to another assigned estate. "
        "You can check <b>'Don't ask me again'</b> to retain your chosen property context seamlessly.",
        body_style
    ))

    story.append(Spacer(1, 10))

    # ------------------ SECTION 2: PROPERTY MANAGEMENT WORKFLOWS ------------------
    story.append(Paragraph("2. Property Management Master Workflows", h1_style))
    story.append(Paragraph(
        "As a Property Manager, your primary day-to-day responsibilities center around property readiness, unit leasing, "
        "billing, and cash flow reconciliation.",
        body_style
    ))

    story.append(Paragraph("2.1 Managing Units & Readiness Statuses", h2_style))
    story.append(Paragraph(
        "Every property is subdivided into individual rentable or saleable units (e.g., Suite 4B, Apartment 102). "
        "Units maintain a real-time lifecycle status: <code>Vacant Ready</code>, <code>Occupied</code>, <code>Maintenance Required</code>, or <code>Reserved</code>. "
        "A unit cannot be leased out until its readiness checklist is certified by the manager.",
        body_style
    ))

    story.append(Paragraph("2.2 Tenant Onboarding & Leases", h2_style))
    story.append(Paragraph("1. <b>Register Tenant:</b> Navigate to Tenants & Leases -> Add Tenant. Enter legal name, national ID/passport, phone number, and KRA PIN.", bullet_style))
    story.append(Paragraph("2. <b>Create Lease Agreement:</b> Select the vacant unit, set the lease commencement date, tenure (e.g. 1 year / 2 years), base monthly rent, and service charge.", bullet_style))
    story.append(Paragraph("3. <b>Security Deposits:</b> Enter agreed deposit amounts (typically 1 or 2 months' rent plus water meter deposit). Deposits are held in escrow.", bullet_style))
    story.append(Paragraph("4. <b>Lease Execution:</b> Upload signed PDF contracts directly to the Tenant Documents tab for audit readiness.", bullet_style))

    story.append(Paragraph("2.3 Utility Readings & Monthly Invoicing", h2_style))
    story.append(Paragraph(
        "Center Estates automates recurring monthly rent and utility billing:",
        body_style
    ))
    story.append(Paragraph("• <b>Water Meter Readings:</b> At the end of each billing cycle, input the current meter reading in the Utility Billing tab. The system computes exact consumption, applies statutory unit tariffs, and flags meter variances.", bullet_style))
    story.append(Paragraph("• <b>Consolidated Invoices:</b> Click <i>Generate Monthly Invoices</i>. The ERP bundles Base Rent, Service Charge, Water Consumption, and Garbage/Parking into a single PDF tax invoice emailed directly to the tenant.", bullet_style))

    story.append(Paragraph("2.4 Rent Collection, Receipts & Bank Reconciliation", h2_style))
    story.append(Paragraph(
        "When a tenant pays via M-Pesa Paybill, RTGS, or Direct Bank Transfer:",
        body_style
    ))
    story.append(Paragraph("• <b>Recording Receipts:</b> Go to Receipts -> Record Payment. Enter the amount paid, payment method, reference (e.g. M-Pesa transaction code), and allocate against outstanding invoices.", bullet_style))
    story.append(Paragraph("• <b>FIFO Allocation:</b> The system automatically applies payments to the oldest arrears first unless specific invoices are selected.", bullet_style))
    story.append(Paragraph("• <b>Bank Reconciliation:</b> Upload bank statement CSV files to perform automated 3-way matching between bank credits and ledger receipts.", bullet_style))

    story.append(PageBreak())

    # ------------------ SECTION 3: ROLES, SCOPING & SECURITY ------------------
    story.append(Paragraph("3. Scoping, Roles & Access Control", h1_style))
    story.append(Paragraph(
        "Center Estates enforces strict multi-tenant boundaries to safeguard confidential financial records between organizations and estates.",
        body_style
    ))

    roles_data = [
        [Paragraph("Role Name", table_header_style), Paragraph("Scope & Permissions", table_header_style)],
        [Paragraph("<b>Platform Administrator</b>", table_cell_style), Paragraph("Full access across all organizations, system settings, audit logs, and global user management.", table_cell_style)],
        [Paragraph("<b>Organization Admin</b>", table_cell_style), Paragraph("Manages organization-wide settings, user memberships, role assignments, and property creation.", table_cell_style)],
        [Paragraph("<b>Property Manager</b>", table_cell_style), Paragraph("Full operational control over assigned properties: unit leases, billing, maintenance, and tenant communications.", table_cell_style)],
        [Paragraph("<b>Property Accountant</b>", table_cell_style), Paragraph("Focuses on invoices, receipts, payment reversals, statement generation, and bank reconciliations.", table_cell_style)],
        [Paragraph("<b>Facility Manager / Technician</b>", table_cell_style), Paragraph("Resolves maintenance work orders, equipment inspections, asset tags, and space utilization.", table_cell_style)],
        [Paragraph("<b>Caretaker / Site Clerk</b>", table_cell_style), Paragraph("Records daily site logs, logs water meter readings, inspects vacant units, and raises site tickets.", table_cell_style)],
    ]
    roles_table = Table(roles_data, colWidths=[150, 350])
    roles_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('BOX', (0,0), (-1,-1), 1, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_card_bg]),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(roles_table)

    story.append(Spacer(1, 14))
    story.append(Paragraph("3.1 Why a New Property Manager Sees 0 Properties", h2_style))
    story.append(Paragraph(
        "By design, when a new user (such as <b>Bryan</b>) is added as a Property Manager in <b>Legend Management Limited</b>, "
        "their <code>assigned_properties</code> list is initially empty. This guarantees that managers only see financial data and tenants "
        "for estates they have been formally assigned to oversee.",
        body_style
    ))

    story.append(Paragraph("3.2 How Administrators Assign Properties", h2_style))
    story.append(Paragraph("1. Log in as an Organization Administrator (or Platform Admin).", bullet_style))
    story.append(Paragraph("2. Navigate to <b>Settings -> Team & Memberships</b>.", bullet_style))
    story.append(Paragraph("3. Locate the user (e.g. Bryan) and click <b>Edit Assignments</b>.", bullet_style))
    story.append(Paragraph("4. Check the desired properties (e.g. <i>BLUESHIELD TOWERS</i>, <i>Litch House</i>) and click <b>Save</b>.", bullet_style))
    story.append(Paragraph("5. The assigned properties will immediately appear in the user's Property Selector dropdown upon next navigation.", bullet_style))

    story.append(Spacer(1, 14))

    # ------------------ SECTION 4: FREQUENTLY ASKED QUESTIONS ------------------
    story.append(Paragraph("4. Frequently Asked Questions (FAQs)", h1_style))

    faq_items = [
        ("Q: Where can I find documentation on the live system?",
         "A: You can visit the public documentation portal at <b>https://centerestates.com/docs</b>. It features module walkthroughs, technical guides, and direct PDF downloads."),
        ("Q: What should I do if my property selector shows 'No properties found'?",
         "A: Check with your Organization Administrator to verify that your account has been assigned to at least one active property under Team & Memberships."),
        ("Q: Can I access the system on my tablet or mobile phone?",
         "A: Yes. Center Estates is built with responsive mobile layouts. On smaller screens, the navigation collapses into an intuitive touch-friendly slide-over drawer."),
        ("Q: How do I export financial statements or tenant rosters?",
         "A: Every data grid (Tenants, Invoices, Receipts, Units) includes an 'Export' button supporting both instant Excel (.xlsx) and printable PDF formats."),
        ("Q: How are water bills calculated for sectional title properties?",
         "A: The system supports both sub-metered individual units and bulk meter shared apportionments based on unit square footage (unit factor)."),
    ]

    for q, a in faq_items:
        story.append(Paragraph(f"<b>{q}</b>", ParagraphStyle('FAQ_Q', parent=body_style, fontName='Helvetica-Bold', textColor=c_primary, spaceBefore=4, spaceAfter=2)))
        story.append(Paragraph(a, ParagraphStyle('FAQ_A', parent=body_style, textColor=c_dark, spaceAfter=6)))

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=1, color=c_border, spaceBefore=10, spaceAfter=15))

    support_data = [[
        Paragraph(
            "<b>Technical Support & Inquiries</b><br/>"
            "Email: <b>support@centerestates.com</b> | Web: <b>https://centerestates.com</b><br/>"
            "Legend Management Limited — Operations Office, Nairobi, Kenya.",
            callout_style
        )
    ]]
    support_table = Table(support_data, colWidths=[500])
    support_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_card_bg),
        ('BOX', (0,0), (-1,-1), 1, c_border),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(support_table)

    # Build PDF with NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully built at: {output_path}")

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'apps/web/public/docs/Center_Estates_User_Guide.pdf'
    build_pdf(target)
