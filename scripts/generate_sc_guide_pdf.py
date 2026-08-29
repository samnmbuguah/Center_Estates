import os
import shutil
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
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
            self.draw_header_footer(num_pages)
            super().showPage()
        super().save()

    def draw_header_footer(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#334155"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 11 * inch - 36, "Center Estates · Service Charge Budgeting, Apportionment & Multi-Batch Invoicing Guide")
            self.drawRightString(8.5 * inch - 54, 11 * inch - 36, "Confidential & Operational")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.75)
            self.line(54, 11 * inch - 42, 8.5 * inch - 54, 11 * inch - 42)
            
        # Footer
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.setFont("Helvetica", 8)
        self.drawRightString(8.5 * inch - 54, 34, page_text)
        self.drawString(54, 34, "Legend Management Ltd · Center Estates ERP Platform (v2.6 Live)")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.75)
        self.line(54, 44, 8.5 * inch - 54, 44)
        self.restoreState()

def generate_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    primary_color = colors.HexColor("#090D16")    # Rich Deep Black
    brand_red = colors.HexColor("#DC2626")        # Legend Red
    accent_blue = colors.HexColor("#2563EB")      # Blue 600
    success_green = colors.HexColor("#059669")    # Emerald 600
    dark_text = colors.HexColor("#1E293B")        # Dark Slate 800
    subtle_text = colors.HexColor("#334155")      # Slate 700
    bg_light = colors.HexColor("#F8FAFC")         # Slate 50

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=primary_color,
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=brand_red,
        spaceAfter=12
    )
    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=primary_color,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )
    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=accent_blue,
        spaceBefore=8,
        spaceAfter=3,
        keepWithNext=True
    )
    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=dark_text,
        spaceAfter=5
    )
    bullet_style = ParagraphStyle(
        'BulletCustom',
        parent=body_style,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=3
    )
    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=subtle_text
    )
    table_text = ParagraphStyle(
        'TableText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=dark_text
    )
    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.white
    )

    story = []

    # Title Block
    story.append(Paragraph("Service Charge Setup, Allocation & Reconciliation", title_style))
    story.append(Paragraph("User Testing Guide and Current-Scope Verification Checklist", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=brand_red, spaceBefore=0, spaceAfter=10))

    # Executive Overview
    overview_text = (
        "<b>System Overview:</b> Center Estates incorporates an automated Service Charge management engine "
        "designed for commercial and residential property recoverable operating expenses. The system "
        "encompasses cost-centre scheme definitions, floor-area and equal-share apportionment, "
        "per-unit monthly schedules, invoice generation and period reconciliation. This guide distinguishes "
        "what is ready to test today from the operating rules that testers should keep in mind."
    )
    story.append(Paragraph(overview_text, body_style))
    story.append(Spacer(1, 4))

    # Audit & Status Matrix Table
    story.append(Paragraph("1. Feature Capability & Completeness Audit", h1_style))
    
    audit_data = [
        [
            Paragraph("<b>Component / Subsystem</b>", table_header),
            Paragraph("<b>Current Status</b>", table_header),
            Paragraph("<b>Operational & Financial Logic</b>", table_header),
            Paragraph("<b>Audit Verification</b>", table_header)
        ],
        [
            Paragraph("<b>Scheme Setup & Budgeting</b>", table_text),
            Paragraph("<font color='#059669'><b>Ready to test</b></font>", table_text),
            Paragraph("Annual budget definition, effective date tracking, property-scoped cost centres, Floor Area (m²/sqft) or Equal Share models.", table_text),
            Paragraph("Create a scheme, reload the page and confirm it remains on the selected property.", table_text)
        ],
        [
            Paragraph("<b>Apportionment Engine</b>", table_text),
            Paragraph("<font color='#059669'><b>Ready to test</b></font>", table_text),
            Paragraph("Calculates unit share ratios. Floor area mode enforces positive sqm. Penny rounding absorbed on last unit to guarantee exact 100.00% pool.", table_text),
            Paragraph("Confirm the annual allocation total equals the scheme budget after every generation.", table_text)
        ],
        [
            Paragraph("<b>Unit Allocations Ledger</b>", table_text),
            Paragraph("<font color='#059669'><b>Ready to test</b></font>", table_text),
            Paragraph("Generates atomic annual and monthly figures per unit. Idempotent re-runs update existing records in place.", table_text),
            Paragraph("Re-run generation and confirm the same unit allocations are updated, not duplicated.", table_text)
        ],
        [
            Paragraph("<b>Multi-Batch Billing Pipeline</b>", table_text),
            Paragraph("<font color='#2563EB'><b>Ready for a single active scheme</b></font>", table_text),
            Paragraph("The pipeline creates service-charge lines from a unit allocation. Keep one active scheme per unit during testing; the latest active scheme is the one billed.", table_text),
            Paragraph("Generate once, then repeat the same period and confirm no duplicate invoice is produced.", table_text)
        ],
        [
            Paragraph("<b>Expense Reconciliation</b>", table_text),
            Paragraph("<font color='#059669'><b>Ready to test</b></font>", table_text),
            Paragraph("Prorates a scheme budget by days in the period and compares it with approved or paid expenses for that property. Review, approve and download the statement.", table_text),
            Paragraph("Use a controlled expense and confirm the expected variance before approving the statement.", table_text)
        ]
    ]

    t_audit = Table(audit_data, colWidths=[1.3*inch, 1.0*inch, 2.7*inch, 1.7*inch])
    t_audit.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), primary_color),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, bg_light]),
    ]))
    story.append(t_audit)
    story.append(Spacer(1, 8))

    # Step-by-Step Testing Playbook
    story.append(Paragraph("2. Step-by-Step Quick Navigation & Testing Playbook", h1_style))
    
    story.append(Paragraph("Phase 1: Pre-requisites & Workspace Verification", h2_style))
    story.append(Paragraph("1. Navigate to <b>Property Management</b> in the main navbar.", bullet_style))
    story.append(Paragraph("2. Ensure the desired Property (e.g. <i>BLUESHIELD TOWERS</i>) is selected in the top property selector dropdown.", bullet_style))
    story.append(Paragraph("3. Verify in <b>Units</b> that lettable units have valid area measurements (m² or sqft) configured.", bullet_style))

    story.append(Paragraph("Phase 2: Setting Up a Service Charge Scheme", h2_style))
    story.append(Paragraph("1. In the Property subtabs, click on <b>SERVICE CHARGE &rarr; Service Charge Schemes</b>.", bullet_style))
    story.append(Paragraph("2. Click the <b>+ Set Up Charge</b> button in the top action toolbar.", bullet_style))
    story.append(Paragraph("3. Enter the Scheme Parameters:", bullet_style))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;&bull; <b>Scheme Name:</b> e.g., <i>2026 Commercial Common Area SC</i>", bullet_style))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;&bull; <b>Annual Budget:</b> e.g., <i>KES 2,400,000</i> (yields KES 200,000 monthly billable pool)", bullet_style))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;&bull; <b>Apportionment Method:</b> Select <i>Floor Area (Proportionate)</i> or <i>Equal Share</i>.", bullet_style))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;&bull; <b>Effective Start Date:</b> e.g., <i>2026-01-01</i>", bullet_style))
    story.append(Paragraph("4. Click <b>Save Service Charge</b>. The scheme appears in the Cost Centres ledger. Keep only one active scheme for a unit while testing invoicing.", bullet_style))

    story.append(Paragraph("Phase 3: Generating and Auditing Apportionments", h2_style))
    story.append(Paragraph("1. Locate the created scheme row and click <b>⚡ Generate Allocations</b>.", bullet_style))
    story.append(Paragraph("2. Navigate to the <b>Charge Allocations</b> subtab.", bullet_style))
    story.append(Paragraph("3. Verify the generated ledger table:", bullet_style))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;&bull; Confirm all units intended to share the charge are allocated.", bullet_style))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;&bull; Confirm <b>Total Ratio = 100.00% Balanced</b>.", bullet_style))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;&bull; Confirm total annual allocations equal exactly the annual budget (KES 2,400,000).", bullet_style))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;&bull; Click <b>📥 Export CSV Schedule</b> to download the complete allocation matrix.", bullet_style))

    story.append(Paragraph("Phase 4: Billing Execution", h2_style))
    story.append(Paragraph("1. Click <b>⚡ Bulk Bill Service Charge &rarr;</b> (or navigate to <b>INVOICING &rarr; Billing Pipeline</b>).", bullet_style))
    story.append(Paragraph("2. Choose the period and select service charge candidates that are marked ready.", bullet_style))
    story.append(Paragraph("3. Generate the invoices once, then open the Invoice Register and confirm the distinct service-charge line, amount and status.", bullet_style))
    story.append(Paragraph("4. Repeat the same run only as a duplicate-prevention check: it must not create another invoice for the same lease and period.", bullet_style))

    story.append(Paragraph("Phase 5: Expense Reconciliation & Audit Variance", h2_style))
    story.append(Paragraph("1. Record a controlled operating expense under <b>Expenses & Payables</b> (e.g. Cleaning, Security or Power) and move it to approved or paid.", bullet_style))
    story.append(Paragraph("2. In <b>Service Charge Schemes</b>, click <b>🔄 Reconcile</b> on the scheme row.", bullet_style))
    story.append(Paragraph("3. Enter the audit period (e.g. <i>2026-01-01 to 2026-06-30</i>) and click <b>Create Reconciliation</b>.", bullet_style))
    story.append(Paragraph("4. In <b>Reconciliations</b>, review the Prorated Budgeted OPEX, Actual Incurred Expenses and Net Variance. Use <b>Review & Audit</b>, then <b>Approve</b>, then download the PDF certificate.", bullet_style))

    story.append(Spacer(1, 8))

    # Architecture & Roadmap
    story.append(Paragraph("3. Interface Aids and Testing Boundaries", h1_style))
    
    roadmap_data = [
        [
            Paragraph("<b>Architecture Feature</b>", table_header),
            Paragraph("<b>Benefit to Finance & Property Management</b>", table_header),
            Paragraph("<b>Status</b>", table_header)
        ],
        [
            Paragraph("<b>Visual Workflow Ribbon</b>", table_text),
            Paragraph("The module navigation keeps setup, allocations and reconciliation as separate second-level pages, avoiding duplicate third-level tabs.", table_text),
            Paragraph("<font color='#059669'><b>Live</b></font>", table_text)
        ],
        [
            Paragraph("<b>High-Contrast Typography</b>", table_text),
            Paragraph("KPI cards, labels and status badges use the shared high-contrast theme tokens. Test both light and dark themes before acceptance.", table_text),
            Paragraph("<font color='#2563EB'><b>Test in both themes</b></font>", table_text)
        ],
        [
            Paragraph("<b>Standardized KPI Strips</b>", table_text),
            Paragraph("Clean surface cards with subtle border accents, status badges, and formatted KES currency metrics.", table_text),
            Paragraph("<font color='#059669'><b>Live</b></font>", table_text)
        ],
        [
            Paragraph("<b>Multi-Batch Invoicing</b>", table_text),
            Paragraph("The billing pipeline can generate charge lines from the current unit schedule. Test with one active scheme per unit; multi-scheme stacking is not a release criterion yet.", table_text),
            Paragraph("<font color='#D97706'><b>Controlled test scope</b></font>", table_text)
        ],
        [
            Paragraph("<b>Year-End Audit Certificates</b>", table_text),
            Paragraph("Approved reconciliations can be downloaded as a branded reconciliation statement. The certificate reports the calculated variance; it does not automatically post a credit or balancing invoice.", table_text),
            Paragraph("<font color='#2563EB'><b>Live PDF; posting is manual</b></font>", table_text)
        ]
    ]

    t_road = Table(roadmap_data, colWidths=[1.8*inch, 3.8*inch, 1.1*inch])
    t_road.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), primary_color),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, bg_light]),
    ]))
    story.append(t_road)
    story.append(Spacer(1, 10))

    # Sign-off box
    signoff = (
        "<b>Prepared by:</b> Antigravity Systems & Solutions Architecture Team<br/>"
        "<b>Platform:</b> Center Estates Enterprise ERP (v2.6 Live)<br/>"
        "<b>Testing Status:</b> Use this guide as the acceptance checklist. Record any failed expected result before operating on live financial data."
    )
    story.append(Paragraph(signoff, callout_style))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Generated PDF successfully: {output_path}")

if __name__ == "__main__":
    out_dir = "/root/Dev/Center_Estates/docs"
    os.makedirs(out_dir, exist_ok=True)
    pdf_file = os.path.join(out_dir, "Service_Charge_Testing_And_Audit_Guide.pdf")
    generate_pdf(pdf_file)

    brain_dir = "/root/.gemini/antigravity-ide/brain/df3fd160-8087-4883-a081-0b4c9f2599c6"
    shutil.copy(pdf_file, os.path.join(brain_dir, "Service_Charge_Testing_And_Audit_Guide.pdf"))
    print("Copied PDF to brain artifact directory.")
