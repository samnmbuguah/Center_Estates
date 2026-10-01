"""Property & Facility Management Onboarding Checklist Engine.

Generates tailored onboarding checklists, requirements matrices, and audit
documents in PDF, Excel (.xlsx), CSV, and JSON based on management scope,
property type, and operational asset configurations.
"""

from __future__ import annotations

import csv
from datetime import date
from io import BytesIO, StringIO
from typing import Any

from django.http import HttpResponse
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

from .pdf_documents import LINE, MUTED, NAVY, PALE, RED, _doc_response, _styles


# -----------------------------------------------------------------------------
# CHECKLIST REQUIREMENT REPOSITORY
# -----------------------------------------------------------------------------

ALL_REQUIREMENTS: list[dict[str, Any]] = [
    # ---------------- 1. LEGAL & PROPERTY OWNERSHIP RECORDS ----------------
    {
        "id": "legal-title",
        "category": "Legal & Ownership Records",
        "title": "Title Deed / Certificate of Lease (LR Number)",
        "priority": "Mandatory",
        "scope": ("both", "property", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "description": "Certified copy of the Title Deed or Certificate of Lease verifying legal ownership and LR parcel number.",
        "rationale": "Confirms landlord legal locus standi to enter into management contracts and execute leases.",
        "format": "Certified Copy PDF",
        "source": "Landlord / Ministry of Lands",
    },
    {
        "id": "legal-owner-id",
        "category": "Legal & Ownership Records",
        "title": "Landlord / Entity Identification Documents",
        "priority": "Mandatory",
        "scope": ("both", "property", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "description": "National ID / Passport (individual) or Certificate of Incorporation, CR12 & Directors IDs (corporate owner).",
        "rationale": "Mandatory KYC and anti-money laundering compliance for institutional estate management.",
        "format": "Color Scan PDF",
        "source": "Landlord / Company Registry",
    },
    {
        "id": "legal-kra-pin",
        "category": "Legal & Ownership Records",
        "title": "Landlord KRA PIN & Tax Compliance Certificate",
        "priority": "Mandatory",
        "scope": ("both", "property", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "description": "KRA PIN certificate and valid Tax Compliance Certificate (TCC).",
        "rationale": "Required for rental income withholding tax (WHT) filing, eTIMS compliance, and monthly statutory remittances.",
        "format": "KRA Verified PDF",
        "source": "KRA Portal",
    },
    {
        "id": "legal-agency-agreement",
        "category": "Legal & Ownership Records",
        "title": "Executed Property Agency / FM Management Agreement",
        "priority": "Mandatory",
        "scope": ("both", "property", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "description": "Signed management contract stating agency terms, commission rates, disbursement schedule, and authority limits.",
        "rationale": "Authoritative contract empowering Center Estates to collect rent, issue receipts, and manage facilities.",
        "format": "Signed PDF Contract",
        "source": "Center Estates & Landlord",
    },
    {
        "id": "legal-power-attorney",
        "category": "Legal & Ownership Records",
        "title": "Deed of Indemnity / Power of Attorney (if corporate/diaspora)",
        "priority": "Optional",
        "scope": ("both", "property", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "description": "Registered Power of Attorney where property is managed on behalf of overseas, diaspora, or multi-shareholder entities.",
        "rationale": "Authorizes designated local representatives to instruct and approve financial expenditures.",
        "format": "Registered Deed PDF",
        "source": "High Court / Advocate",
    },
    {
        "id": "legal-land-rates",
        "category": "Legal & Ownership Records",
        "title": "Land Rates & Land Rent Clearance Certificates",
        "priority": "Optional",
        "scope": ("both", "property", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "description": "Current County Land Rates clearance receipt and National Land Commission rent statement.",
        "rationale": "Prevents statutory county caveats or council operational interruptions against the building.",
        "format": "Official Clearance Receipt",
        "source": "County Government & Lands Ministry",
    },

    # ---------------- 2. FINANCIAL, BANKING & TAX SETUP ----------------
    {
        "id": "fin-collection-bank",
        "category": "Financial & Banking Setup",
        "title": "Property Collection Bank Account Credentials",
        "priority": "Mandatory",
        "scope": ("both", "property"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "description": "Bank name, branch, account number, swift code, and verified bank confirmation letter.",
        "rationale": "Designates the dedicated rent and collection account for all tenant billings and automated bank matching.",
        "format": "Bank Letter / Header Scan",
        "source": "Commercial Bank",
    },
    {
        "id": "fin-mpesa-paybill",
        "category": "Financial & Banking Setup",
        "title": "M-Pesa Paybill / Buy Goods Account Configuration",
        "priority": "Optional",
        "scope": ("both", "property"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "description": "Safaricom M-Pesa Paybill / Till number, Head Office business number, and API credentials for STK push / IPN.",
        "rationale": "Enables instant automated receipting, payment verification, and tenant checkout via Daraja API.",
        "format": "Safaricom Welcome Letter / Portal",
        "source": "Safaricom / Bank",
    },
    {
        "id": "fin-disbursement-bank",
        "category": "Financial & Banking Setup",
        "title": "Landlord Net Rental Disbursement Account",
        "priority": "Mandatory",
        "scope": ("both", "property"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "description": "Designated landlord bank account for net monthly rental disbursement remittance.",
        "rationale": "Ensures prompt, auditable electronic settlement of net rental proceeds after agency commissions and approved expenses.",
        "format": "Cancelled Cheque / Bank Confirmation",
        "source": "Landlord",
    },
    {
        "id": "fin-vat-certificate",
        "category": "Financial & Banking Setup",
        "title": "VAT Registration Certificate (Commercial Properties)",
        "priority": "Mandatory",
        "scope": ("both", "property"),
        "property_types": ("commercial_office", "commercial_retail", "industrial", "sectional_title"),
        "condition": lambda opt: opt.get("vat_registered", True) or opt.get("property_type") in ("commercial_office", "commercial_retail", "industrial"),
        "description": "KRA VAT registration certificate and designated commercial rent VAT rate.",
        "rationale": "Mandatory for commercial rent 16% output VAT billing and monthly KRA returns.",
        "format": "KRA VAT Certificate",
        "source": "KRA iTax",
    },
    {
        "id": "fin-service-charge-budget",
        "category": "Financial & Banking Setup",
        "title": "Annual Service Charge Budget & Apportionment Matrix",
        "priority": "Mandatory",
        "scope": ("both", "property", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "sectional_title", "residential_gated"),
        "condition": lambda opt: opt.get("service_charge", True),
        "description": "Approved annual operational budget breakdown (security, cleaning, power, lifts, repairs) and sqft rate.",
        "rationale": "Governs statutory service charge invoicing, quarterly allocations, and annual auditor reconciliations.",
        "format": "Approved Budget Excel / PDF",
        "source": "Landlord / Management Company",
    },

    # ---------------- 3. BUILDING ARCHITECTURAL & UNIT SPATIAL REGISTER ----------------
    {
        "id": "arch-as-built-plans",
        "category": "Building Architecture & Unit Register",
        "title": "Approved Architectural & As-Built Engineering Drawings",
        "priority": "Mandatory",
        "scope": ("both", "facility", "property"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "description": "Approved as-built architectural floor plans, plumbing/drainage diagrams, and electrical single-line diagrams.",
        "rationale": "Vital for spatial mapping, tenancy demarcations, pipe routing, emergency shutdowns, and maintenance drills.",
        "format": "PDF / CAD Drawings",
        "source": "Developer / Architect",
    },
    {
        "id": "arch-units-schedule",
        "category": "Building Architecture & Unit Register",
        "title": "Master Schedule of Units & Measured Area (Sq. Ft.)",
        "priority": "Mandatory",
        "scope": ("both", "property", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "description": "Comprehensive list of all units: unit numbers, floor levels, usable/rentable area (sqft), target rents, and use.",
        "rationale": "Core baseline data required to populate Center Estates unit records, rental billing schedules, and occupancy maps.",
        "format": "Center Estates Unit Roster (Excel)",
        "source": "Landlord / Quantity Surveyor",
    },
    {
        "id": "arch-parking-schedule",
        "category": "Building Architecture & Unit Register",
        "title": "Parking Bay Register & Tag Numbering Schedule",
        "priority": "Optional",
        "scope": ("both", "property", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title"),
        "description": "Schedule of all basement and ground level parking bays, bay numbers, unit allocations, and visitor slots.",
        "rationale": "Required to assign tenant parking passes, resolve bay disputes, and enforce barrier access control.",
        "format": "Excel Roster / Floor Plan",
        "source": "Site Management",
    },
    {
        "id": "arch-keys-access",
        "category": "Building Architecture & Unit Register",
        "title": "Master Keys & Electronic Access Tag Handover Inventory",
        "priority": "Mandatory",
        "scope": ("both", "property", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "description": "Physical handover and signing of master keys, vacant unit keys, padlock tags, riser room keys, and RFID tags.",
        "rationale": "Ensures property manager custody, enables scheduled inspections, and protects against unauthorized tenant entry.",
        "format": "Signed Key Inventory Sheet",
        "source": "Caretaker / Handover Team",
    },

    # ---------------- 4. TENANCY, LEASES & DEPOSITS (PROPERTY MANAGEMENT) ----------------
    {
        "id": "pm-tenancy-schedule",
        "category": "Tenancy & Lease Ledger (Property Management)",
        "title": "Current Tenancy Schedule (Rent Roll)",
        "priority": "Mandatory",
        "scope": ("both", "property"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "condition": lambda opt: opt.get("existing_tenants", True),
        "description": "Current rent roll: tenant names, phone numbers, email addresses, national IDs, monthly rent, and billing day.",
        "rationale": "Enables bulk-creation of active tenant profiles and automated invoice runs on day one.",
        "format": "Excel Bulk Lease Template",
        "source": "Current Property Agent / Landlord",
    },
    {
        "id": "pm-executed-leases",
        "category": "Tenancy & Lease Ledger (Property Management)",
        "title": "Signed Tenancy Agreements & Offer Letters",
        "priority": "Mandatory",
        "scope": ("both", "property"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "condition": lambda opt: opt.get("existing_tenants", True),
        "description": "Copies of all signed lease agreements, offer letters, renewal addendums, and escalation terms.",
        "rationale": "Legally binds tenants to payment terms, escalation percentages, deposit terms, and termination clauses.",
        "format": "Scanned PDF Leases",
        "source": "Previous Agent / Landlord Files",
    },
    {
        "id": "pm-deposits-ledger",
        "category": "Tenancy & Lease Ledger (Property Management)",
        "title": "Tenant Security & Utility Deposit Custody Ledger",
        "priority": "Mandatory",
        "scope": ("both", "property"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "condition": lambda opt: opt.get("existing_tenants", True),
        "description": "Detailed statement of all tenant security deposits, water deposits, and electricity deposits held in custody.",
        "rationale": "Crucial to establish the opening Tenant Deposits Register, avoid tenant exit disputes, and calculate arrears exposure.",
        "format": "Certified Deposits Ledger (Excel/PDF)",
        "source": "Previous Agent / Bank Escrow",
    },
    {
        "id": "pm-opening-balances",
        "category": "Tenancy & Lease Ledger (Property Management)",
        "title": "Tenant Opening Balances & Arrears Carried Forward (B/F)",
        "priority": "Mandatory",
        "scope": ("both", "property"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "condition": lambda opt: opt.get("existing_tenants", True),
        "description": "Reconciled ledger balances showing outstanding rent, service charge, and utility arrears per tenant as of handover date.",
        "rationale": "Prevents disputed billing; establishes opening balance brought forward (B/F) for monthly tenant statements.",
        "format": "Certified Aged Debtors Ledger",
        "source": "Outgoing Managing Agent / Accountant",
    },
    {
        "id": "pm-meter-readings",
        "category": "Tenancy & Lease Ledger (Property Management)",
        "title": "Sub-Meter Handover Readings & Photographs",
        "priority": "Mandatory",
        "scope": ("both", "property", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "condition": lambda opt: opt.get("submeters", True),
        "description": "Opening baseline meter readings for all tenant sub-meters (water, electricity, BTU/cooling) with timestamped photos.",
        "rationale": "Ensures incoming tenants are billed solely for their consumption from the date of management takeover.",
        "format": "Signed Meter Sheet + Photos",
        "source": "Joint Handover Inspection Team",
    },

    # ---------------- 5. PLANT, MACHINERY & ASSETS (FACILITY MANAGEMENT) ----------------
    {
        "id": "fm-asset-register",
        "category": "Plant, Machinery & Asset Register (Facility Management)",
        "title": "Master Equipment & Physical Asset Inventory",
        "priority": "Mandatory",
        "scope": ("both", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "description": "Comprehensive list of all critical assets: make, model, serial number, capacity, location, installation date, and vendor.",
        "rationale": "Populates the Facility Management asset catalog, QR code tags, and preventive maintenance schedules.",
        "format": "Center Estates Asset Roster (Excel)",
        "source": "MEP Engineers / Outgoing FM",
    },
    {
        "id": "fm-lift-contract",
        "category": "Plant, Machinery & Asset Register (Facility Management)",
        "title": "Elevator / Lift Service AMC & Rescue Protocol",
        "priority": "Mandatory",
        "scope": ("both", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "sectional_title"),
        "condition": lambda opt: opt.get("lifts", True),
        "description": "Active Annual Maintenance Contract (AMC) with certified elevator vendor (Kone, Schindler, Otis, etc.) and 24/7 rescue contact.",
        "rationale": "Ensures uninterrupted lift operations, passenger safety, rapid entrapment response, and insurance compliance.",
        "format": "Signed AMC PDF",
        "source": "Elevator Contractor",
    },
    {
        "id": "fm-generator-specs",
        "category": "Plant, Machinery & Asset Register (Facility Management)",
        "title": "Backup Generator Specifications & AMC",
        "priority": "Mandatory",
        "scope": ("both", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "sectional_title", "industrial"),
        "condition": lambda opt: opt.get("generator", True),
        "description": "Generator kVA rating, ATS panel specs, fuel tank capacity, vendor service contract, and fuel supplier agreement.",
        "rationale": "Guarantees business continuity, automatic power changeover during blackouts, and controlled diesel replenishment.",
        "format": "Contract PDF + O&M Manual",
        "source": "Generator Vendor",
    },
    {
        "id": "fm-borehole-docs",
        "category": "Plant, Machinery & Asset Register (Facility Management)",
        "title": "Borehole WRMA License & Water Quality Test Report",
        "priority": "Mandatory",
        "scope": ("both", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "condition": lambda opt: opt.get("borehole", True),
        "description": "Water Resources Authority (WRA) permit, borehole pump horsepower, yield report, and certified lab potability test.",
        "rationale": "Statutory water abstraction compliance; safeguards tenant health and confirms whether reverse osmosis/softening is needed.",
        "format": "WRA Permit + Certified Lab Test",
        "source": "WRA / Certified Chemistry Lab",
    },
    {
        "id": "fm-security-cleaning",
        "category": "Plant, Machinery & Asset Register (Facility Management)",
        "title": "Security Guarding, Cleaning & Waste Management Contracts",
        "priority": "Mandatory",
        "scope": ("both", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "description": "Service Level Agreements (SLAs) for 24-hr security guarding, common area janitorial cleaning, and garbage collection.",
        "rationale": "Maintains day-to-day estate hygiene, perimeter security, visitor control, and scheduled waste disposal.",
        "format": "Executed Service Contracts",
        "source": "Security & Cleaning Contractors",
    },
    {
        "id": "fm-om-manuals",
        "category": "Plant, Machinery & Asset Register (Facility Management)",
        "title": "Equipment Operating & Maintenance (O&M) Manuals",
        "priority": "Optional",
        "scope": ("both", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "sectional_title", "industrial"),
        "description": "Manufacturer user manuals, schematics, and recommended service intervals for mechanical, electrical, and plumbing plant.",
        "rationale": "Guides technicians during planned maintenance and emergency troubleshooting without voiding warranties.",
        "format": "PDF / Bound Manuals",
        "source": "Equipment Manufacturers / MEP Contractor",
    },

    # ---------------- 6. STATUTORY COMPLIANCE & SAFETY (FACILITY MANAGEMENT) ----------------
    {
        "id": "comp-occupancy-cert",
        "category": "Statutory Compliance & Safety (Facility Management)",
        "title": "County Certificate of Occupancy / Building Permit",
        "priority": "Mandatory",
        "scope": ("both", "facility", "property"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "description": "County Government Occupancy Certificate certifying the building is completed according to planning regulations.",
        "rationale": "Legal foundation verifying building safety and authorizing human habitation / commercial operation.",
        "format": "County Certified Document",
        "source": "County Planning Department",
    },
    {
        "id": "comp-fire-safety",
        "category": "Statutory Compliance & Safety (Facility Management)",
        "title": "Fire Safety Audit & Annual Equipment Inspection Certificate",
        "priority": "Mandatory",
        "scope": ("both", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "description": "Current County Fire Department compliance certificate, fire hydrants test report, and extinguishers service tags.",
        "rationale": "Mandatory under the Fire Reduction Rules 2007; protects against building closures and validates insurance cover.",
        "format": "County Fire Clearance Certificate",
        "source": "County Fire Services / DOSH Auditor",
    },
    {
        "id": "comp-osha-audit",
        "category": "Statutory Compliance & Safety (Facility Management)",
        "title": "OSHA Workplace Safety & Health Annual Audit Report",
        "priority": "Mandatory",
        "scope": ("both", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "industrial", "sectional_title"),
        "description": "Occupational Safety and Health Act (OSHA 2007) audit conducted by a registered DOSH health & safety adviser.",
        "rationale": "Statutory compliance for all commercial and multi-tenanted workplaces to prevent workplace accidents and fines.",
        "format": "DOSH Audit Report",
        "source": "Registered Safety Auditor",
    },
    {
        "id": "comp-lift-inspection",
        "category": "Statutory Compliance & Safety (Facility Management)",
        "title": "Lift / Hoist Statutory Examination Certificate (DOSH)",
        "priority": "Mandatory",
        "scope": ("both", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "sectional_title"),
        "condition": lambda opt: opt.get("lifts", True),
        "description": "Annual statutory elevator inspection certificate issued by a DOSH-authorized plant inspector.",
        "rationale": "Legal prerequisite to operate passenger elevators under the Factories and Other Places of Work Act.",
        "format": "DOSH Examination Certificate",
        "source": "Approved Lift Inspector",
    },
    {
        "id": "comp-insurance-policy",
        "category": "Statutory Compliance & Safety (Facility Management)",
        "title": "Property All-Risks & Public Liability Insurance Cover",
        "priority": "Mandatory",
        "scope": ("both", "facility", "property"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"),
        "description": "Valid insurance cover for Fire & Perils, Machinery Breakdown, Public Liability, and Terrorism/Political Violence.",
        "rationale": "Safeguards building value, shields management from third-party injury claims, and satisfies bank mortgage covenants.",
        "format": "Insurance Policy / Cover Note",
        "source": "Insurance Underwriter",
    },
    {
        "id": "comp-dlp-defects",
        "category": "Statutory Compliance & Safety (Facility Management)",
        "title": "Defects Liability Period (DLP) Schedule & Contractor Bonds",
        "priority": "Optional",
        "scope": ("both", "facility"),
        "property_types": ("commercial_office", "commercial_retail", "residential_multi", "sectional_title", "industrial"),
        "condition": lambda opt: opt.get("new_development", False),
        "description": "Contractor snags list, defect liability expiration date, and performance bond details for new properties.",
        "rationale": "Allows facility manager to enforce main contractor rectification of construction defects free of charge.",
        "format": "Snagging Register & Contract",
        "source": "Project Manager / Main Contractor",
    },

    # ---------------- 7. SECTIONAL TITLE & STRATA GOVERNANCE ----------------
    {
        "id": "strata-sectional-plan",
        "category": "Sectional Title & Governance (Strata Schemes)",
        "title": "Registered Sectional Plan (Sectional Properties Act 2020)",
        "priority": "Mandatory",
        "scope": ("both", "property", "facility"),
        "property_types": ("sectional_title",),
        "description": "Surveyor sectional plan registered at the Land Registry showing common property boundaries and unit parcels.",
        "rationale": "Legal authority defining individual unit boundaries vs common areas under the Sectional Properties Act 2020.",
        "format": "Registered Sectional Plan PDF",
        "source": "Director of Survey / Land Registry",
    },
    {
        "id": "strata-omc-incorporation",
        "category": "Sectional Title & Governance (Strata Schemes)",
        "title": "Owners Management Company (OMC) Registration Certificate",
        "priority": "Mandatory",
        "scope": ("both", "property", "facility"),
        "property_types": ("sectional_title",),
        "description": "Certificate of Incorporation for the Management Corporation / Owners Association, Memorandum, and list of directors.",
        "rationale": "Legal entity representing the collective unit owners with whom the management agreement is signed.",
        "format": "BRS Registration Certificate",
        "source": "Business Registration Service (BRS)",
    },
    {
        "id": "strata-unit-entitlements",
        "category": "Sectional Title & Governance (Strata Schemes)",
        "title": "Unit Entitlement Schedule & Service Charge Share Factors",
        "priority": "Mandatory",
        "scope": ("both", "property", "facility"),
        "property_types": ("sectional_title",),
        "description": "Statutory schedule stating unit shares / unit entitlements for each unit used to apportion common area expenses.",
        "rationale": "Ensures fair, legally unchallengeable monthly service charge and sinking fund invoicing to unit owners.",
        "format": "Certified Entitlement Matrix",
        "source": "Registered Sectional Plan",
    },
    {
        "id": "strata-bylaws-rules",
        "category": "Sectional Title & Governance (Strata Schemes)",
        "title": "Estate By-Laws, House Rules & Parking Regulations",
        "priority": "Mandatory",
        "scope": ("both", "property", "facility"),
        "property_types": ("sectional_title", "residential_gated"),
        "description": "Approved estate rules governing noise, pets, interior modifications, signage, garbage, and parking etiquette.",
        "rationale": "Empowers managing agent and concierge to enforce orderly community living and issue non-compliance notices.",
        "format": "Approved By-Laws PDF",
        "source": "Owners Management Company / Developer",
    },
    {
        "id": "strata-owners-register",
        "category": "Sectional Title & Governance (Strata Schemes)",
        "title": "Unit Owners Master Contacts & Title Registration Register",
        "priority": "Mandatory",
        "scope": ("both", "property", "facility"),
        "property_types": ("sectional_title",),
        "description": "Master register of all unit owners: full names, contact phones, email addresses, KRA PINs, and Title Deed numbers.",
        "rationale": "Required to bill unit owners for monthly service charges and establish owner portal accounts.",
        "format": "Excel Unit Owner Register",
        "source": "Developer / OMC Secretary",
    },
]


PROPERTY_TYPE_LABELS = {
    "commercial_office": "Commercial Office Building / Corporate Tower",
    "commercial_retail": "Shopping Mall / Retail Centre / Commercial Plaza",
    "residential_multi": "Residential Multi-Family Apartments / Flats",
    "residential_gated": "Residential Gated Community / Townhouses Estate",
    "sectional_title": "Sectional Title Scheme / Mixed-Use Strata Scheme",
    "industrial": "Industrial Park / Warehousing & Logistics Hub",
}

SCOPE_LABELS = {
    "both": "Integrated Property & Facility Management",
    "property": "Property Management Only (Tenancies, Rent & Accounting)",
    "facility": "Facility Management Only (Physical Plant, Maintenance & Safety)",
}


def filter_checklist(
    scope: str = "both",
    property_type: str = "commercial_office",
    options: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Filters the master checklist matrix based on selected criteria."""
    options = dict(options or {})
    options["property_type"] = property_type
    options["scope"] = scope

    filtered: list[dict[str, Any]] = []

    for item in ALL_REQUIREMENTS:
        # 1. Scope filter
        if scope != "both" and scope not in item["scope"] and "both" not in item["scope"]:
            continue

        # 2. Property type filter
        if property_type not in item["property_types"]:
            continue

        # 3. Dynamic feature/condition filter
        condition_fn = item.get("condition")
        if callable(condition_fn):
            try:
                if not condition_fn(options):
                    continue
            except Exception:
                continue

        filtered.append(item)

    # Group by category
    categories: dict[str, list[dict[str, Any]]] = {}
    for item in filtered:
        cat = item["category"]
        categories.setdefault(cat, []).append(item)

    mandatory_count = sum(1 for i in filtered if i["priority"] == "Mandatory")
    optional_count = len(filtered) - mandatory_count

    return {
        "scope": scope,
        "scope_label": SCOPE_LABELS.get(scope, scope.title()),
        "property_type": property_type,
        "property_type_label": PROPERTY_TYPE_LABELS.get(property_type, property_type.title()),
        "total_count": len(filtered),
        "mandatory_count": mandatory_count,
        "optional_count": optional_count,
        "categories_count": len(categories),
        "categories": categories,
        "items": filtered,
    }


# -----------------------------------------------------------------------------
# PDF EXPORT GENERATOR
# -----------------------------------------------------------------------------

def generate_checklist_pdf(
    organization: Any,
    checklist_data: dict[str, Any],
    property_name: str = "New Property Onboarding",
    generated_by: str = "Center Estates Operations",
) -> HttpResponse:
    """Generates an official, beautifully styled Center Estates Onboarding Checklist PDF."""
    s = _styles()
    title = "Onboarding Checklist"
    prop_display = (
        property_name
        if property_name and property_name not in ("Property Onboarding", "Target Property", "New Property Onboarding")
        else checklist_data["property_type_label"]
    )
    period = f"Scope: {checklist_data['scope_label']}"
    filename = f"onboarding-checklist-{checklist_data['property_type']}.pdf"

    # Refined typography for checklist
    title_bold = ParagraphStyle(name="ChecklistTitle", parent=s["DocTitle"], fontSize=13, leading=16, textColor=NAVY)
    badge_style = ParagraphStyle(name="ScopeBadge", parent=s["Small"], fontSize=8.5, leading=12, textColor=MUTED)
    item_title_style = ParagraphStyle(name="ChecklistItemTitle", parent=s["Small"], fontName="Helvetica-Bold", fontSize=8.2, leading=10.5, textColor=NAVY)
    item_desc_style = ParagraphStyle(name="ChecklistItemDesc", parent=s["Small"], fontSize=7.2, leading=9.2, textColor=MUTED)
    mand_badge = ParagraphStyle(name="MandatoryBadge", parent=s["Small"], fontName="Helvetica-Bold", fontSize=7.2, leading=9, textColor=colors.HexColor("#dc2626"), alignment=1)
    opt_badge = ParagraphStyle(name="OptionalBadge", parent=s["Small"], fontName="Helvetica-Bold", fontSize=7.2, leading=9, textColor=colors.HexColor("#475569"), alignment=1)
    checkbox_style = ParagraphStyle(name="CheckboxStyle", parent=s["Small"], fontName="Helvetica-Bold", fontSize=10, leading=10, textColor=colors.HexColor("#64748b"), alignment=1)

    story: list[Any] = []

    # 1. Summary Callout Box (exact 182mm width matching margins)
    summary_data = [
        [
            Paragraph(f"<b>Target Property:</b> {property_name}", s["Small"]),
            Paragraph(f"<b>Management Scope:</b> {checklist_data['scope_label']}", s["Small"]),
            Paragraph(f"<b>Total Required Items:</b> <b>{checklist_data['total_count']}</b>", s["Small"]),
        ],
        [
            Paragraph(f"<b>Property Type:</b> {checklist_data['property_type_label']}", s["Small"]),
            Paragraph(f"<b>Mandatory:</b> {checklist_data['mandatory_count']}  ·  <b>Optional / Contingent:</b> {checklist_data['optional_count']}", s["Small"]),
            Paragraph(f"<b>Date:</b> {timezone.localdate():%d %B %Y}", s["Small"]),
        ],
    ]
    summary_table = Table(summary_data, colWidths=[60 * mm, 78 * mm, 44 * mm], hAlign="LEFT")
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 4 * mm))

    # 2. Checklist Categories (exact 182mm total: 16 + 52 + 24 + 56 + 34 = 182mm)
    col_widths = [16 * mm, 52 * mm, 24 * mm, 56 * mm, 34 * mm]

    for category, items in checklist_data["categories"].items():
        # Section Header
        story.append(Paragraph(f"<b>{category.upper()}</b>", s["Section"]))

        table_data: list[list[Any]] = []
        # Header row
        table_data.append([
            Paragraph("<b>STATUS</b>", s["HeaderCenter"]),
            Paragraph("<b>DOCUMENT / REQUIREMENT</b>", s["HeaderSmall"]),
            Paragraph("<b>PRIORITY</b>", s["HeaderCenter"]),
            Paragraph("<b>PURPOSE & LEGAL RATIONALE</b>", s["HeaderSmall"]),
            Paragraph("<b>ACCEPTED FORMAT</b>", s["HeaderSmall"]),
        ])

        for item in items:
            is_mand = item["priority"] == "Mandatory"
            p_badge = Paragraph("<b>MANDATORY</b>" if is_mand else "OPTIONAL", mand_badge if is_mand else opt_badge)
            cb = Paragraph("[ &nbsp; ]", checkbox_style)
            item_title_p = Paragraph(f"<b>{item['title']}</b>", item_title_style)
            desc_p = Paragraph(f"{item['description']}<br/><font color='#64748b'><i>{item['rationale']}</i></font>", item_desc_style)
            fmt_p = Paragraph(f"{item['format']}<br/><font color='#64748b'>From: {item['source']}</font>", item_desc_style)

            table_data.append([cb, item_title_p, p_badge, desc_p, fmt_p])

        cat_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        cat_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), (colors.white, colors.HexColor("#f8fafc"))),
            ("VALIGN", (0, 0), (-1, 0), "MIDDLE"),
            ("VALIGN", (0, 1), (-1, -1), "TOP"),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (2, 0), (2, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, 0), 4),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
            ("TOPPADDING", (0, 1), (-1, -1), 3.5),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 3.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(cat_table)
        story.append(Spacer(1, 3.5 * mm))

    # 3. Execution / Sign-off Block (exact 182mm width)
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("<b>ONBOARDING VERIFICATION & HANDOVER SIGN-OFF</b>", s["Section"]))
    sign_data = [
        [
            Paragraph("<b>Property Owner / Landlord Representative:</b>", s["Small"]),
            Paragraph("<b>Center Estates Onboarding Manager:</b>", s["Small"]),
        ],
        [
            Paragraph("Name: ____________________________________", s["Small"]),
            Paragraph("Name: ____________________________________", s["Small"]),
        ],
        [
            Paragraph("Signature: ________________________________", s["Small"]),
            Paragraph("Signature: ________________________________", s["Small"]),
        ],
        [
            Paragraph("Date: ____________________", s["Small"]),
            Paragraph(f"Date: {timezone.localdate():%d / %m / %Y}", s["Small"]),
        ],
    ]
    sign_table = Table(sign_data, colWidths=[91 * mm, 91 * mm], hAlign="LEFT")
    sign_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(sign_table)

    return _doc_response(
        organization=organization,
        filename=filename,
        story=story,
        wide=False,  # Portrait A4 for clean checklists
        title=title,
        property_name=prop_display,
        period=period,
        generated_by=generated_by,
    )


# -----------------------------------------------------------------------------
# EXCEL (.XLSX) EXPORT GENERATOR
# -----------------------------------------------------------------------------

def generate_checklist_xlsx(
    checklist_data: dict[str, Any],
    property_name: str = "New Property Onboarding",
    generated_by: str = "Center Estates Operations",
) -> HttpResponse:
    """Generates a professional, fillable openpyxl Excel spreadsheet."""
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Onboarding Checklist"

    header_fill = PatternFill("solid", fgColor="17243B")
    category_fill = PatternFill("solid", fgColor="E2E8F0")
    zebra_fill = PatternFill("solid", fgColor="F8FAFC")
    white_fill = PatternFill("solid", fgColor="FFFFFF")
    mand_fill = PatternFill("solid", fgColor="FEE2E2")
    opt_fill = PatternFill("solid", fgColor="F1F5F9")

    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    title_font = Font(name="Calibri", size=14, bold=True, color="17243B")
    meta_font = Font(name="Calibri", size=10, color="64748B")
    cat_font = Font(name="Calibri", size=11, bold=True, color="1E293B")
    body_font = Font(name="Calibri", size=10)
    bold_body = Font(name="Calibri", size=10, bold=True)
    mand_font = Font(name="Calibri", size=9, bold=True, color="DC2626")
    opt_font = Font(name="Calibri", size=9, color="475569")

    # Title block
    sheet["A1"] = "Center Estates — Property & Facility Onboarding Checklist"
    sheet["A1"].font = title_font
    sheet["A2"] = f"Target: {property_name}  ·  Scope: {checklist_data['scope_label']}  ·  Type: {checklist_data['property_type_label']}"
    sheet["A2"].font = meta_font
    sheet["A3"] = f"Generated by {generated_by}  ·  Date: {timezone.localtime():%d %b %Y %H:%M}  ·  Total: {checklist_data['total_count']} items ({checklist_data['mandatory_count']} Mandatory, {checklist_data['optional_count']} Optional)"
    sheet["A3"].font = meta_font

    start_row = 5
    headers = [
        "Category",
        "Requirement / Document",
        "Priority",
        "Description & Requirements",
        "Purpose & Legal Rationale",
        "Accepted Format / Source",
        "Status (Pending / Received / N/A)",
        "Responsible Party",
        "Verification Notes",
    ]

    for col_idx, h in enumerate(headers, start=1):
        cell = sheet.cell(row=start_row, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.border = thin_border
        cell.alignment = Alignment(horizontal="center" if col_idx in (1, 3, 7) else "left", vertical="center")
    sheet.row_dimensions[start_row].height = 24

    current_row = start_row + 1
    for category, items in checklist_data["categories"].items():
        # Category sub-header row
        cat_cell = sheet.cell(row=current_row, column=1, value=category.upper())
        cat_cell.font = cat_font
        cat_cell.fill = category_fill
        cat_cell.border = thin_border
        for c in range(2, len(headers) + 1):
            empty = sheet.cell(row=current_row, column=c, value="")
            empty.fill = category_fill
            empty.border = thin_border
        sheet.row_dimensions[current_row].height = 20
        current_row += 1

        for idx, item in enumerate(items):
            is_even = idx % 2 == 0
            row_fill = white_fill if is_even else zebra_fill

            row_data = [
                category,
                item["title"],
                item["priority"],
                item["description"],
                item["rationale"],
                f"{item['format']} ({item['source']})",
                "Pending",  # Default status for fillable checklist
                "",         # Responsible party to fill
                "",         # Verification notes to fill
            ]

            for col_idx, val in enumerate(row_data, start=1):
                cell = sheet.cell(row=current_row, column=col_idx, value=val)
                cell.border = thin_border
                cell.fill = row_fill

                if col_idx == 2:
                    cell.font = bold_body
                    cell.alignment = Alignment(vertical="center", wrap_text=True)
                elif col_idx == 3:
                    cell.font = mand_font if val == "Mandatory" else opt_font
                    cell.fill = mand_fill if val == "Mandatory" else opt_fill
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                elif col_idx == 7:
                    cell.font = bold_body
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                else:
                    cell.font = body_font
                    cell.alignment = Alignment(vertical="center", wrap_text=True)

            sheet.row_dimensions[current_row].height = 26
            current_row += 1

    # Column widths
    col_widths = {
        "A": 26,  # Category
        "B": 36,  # Requirement
        "C": 14,  # Priority
        "D": 45,  # Description
        "E": 45,  # Rationale
        "F": 28,  # Format
        "G": 22,  # Status
        "H": 22,  # Responsible
        "I": 30,  # Notes
    }
    for col_letter, width in col_widths.items():
        sheet.column_dimensions[col_letter].width = width

    sheet.auto_filter.ref = f"A{start_row}:I{current_row - 1}"
    sheet.freeze_panes = f"A{start_row + 1}"

    buffer = BytesIO()
    workbook.save(buffer)
    content = buffer.getvalue()

    response = HttpResponse(
        content,
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    filename = f"onboarding-checklist-{checklist_data['property_type']}.xlsx"
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


# -----------------------------------------------------------------------------
# CSV EXPORT GENERATOR
# -----------------------------------------------------------------------------

def generate_checklist_csv(
    checklist_data: dict[str, Any],
) -> HttpResponse:
    """Generates a standard CSV export of the onboarding checklist."""
    output = StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Category",
        "Item / Requirement",
        "Priority",
        "Description",
        "Legal & Operational Rationale",
        "Accepted Format",
        "Typical Source",
        "Status",
    ])

    for item in checklist_data["items"]:
        writer.writerow([
            item["category"],
            item["title"],
            item["priority"],
            item["description"],
            item["rationale"],
            item["format"],
            item["source"],
            "Pending",
        ])

    response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
    filename = f"onboarding-checklist-{checklist_data['property_type']}.csv"
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
