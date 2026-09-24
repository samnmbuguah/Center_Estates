export type ManagementScope = "both" | "property" | "facility";

export type PropertyTypeCode =
  | "commercial_office"
  | "commercial_retail"
  | "residential_multi"
  | "residential_gated"
  | "sectional_title"
  | "industrial";

export interface PropertyTypeOption {
  code: PropertyTypeCode;
  label: string;
  category: "Commercial" | "Residential" | "Mixed & Industrial";
  description: string;
  iconName: string;
}

export const PROPERTY_TYPES: PropertyTypeOption[] = [
  {
    code: "commercial_office",
    label: "Commercial Office Building",
    category: "Commercial",
    description: "Corporate office towers, business parks, multi-tenanted commercial suites.",
    iconName: "Briefcase",
  },
  {
    code: "commercial_retail",
    label: "Retail Mall & Commercial Plaza",
    category: "Commercial",
    description: "Shopping centres, food courts, retail strips, and commercial arcades.",
    iconName: "Store",
  },
  {
    code: "residential_multi",
    label: "Residential Multi-Family Apartments",
    category: "Residential",
    description: "Multi-storey apartment blocks, residential flats, and studio complexes.",
    iconName: "Building2",
  },
  {
    code: "residential_gated",
    label: "Gated Estate & Townhouses",
    category: "Residential",
    description: "Private residential estates, townhouse clusters, gated courts with common amenities.",
    iconName: "Home",
  },
  {
    code: "sectional_title",
    label: "Sectional Title Scheme (Strata)",
    category: "Mixed & Industrial",
    description: "Sectional Properties Act 2020 schemes, individual unit owners + Owners Management Company.",
    iconName: "Landmark",
  },
  {
    code: "industrial",
    label: "Industrial Park & Warehousing",
    category: "Mixed & Industrial",
    description: "Logistics hubs, godowns, industrial storage units, light manufacturing parks.",
    iconName: "Factory",
  },
];

export interface FeatureFlagOption {
  key: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}

export const FEATURE_FLAGS: FeatureFlagOption[] = [
  {
    key: "submeters",
    label: "Sub-metered Utilities",
    description: "Individual tenant water or electricity meters installed.",
    defaultChecked: true,
  },
  {
    key: "service_charge",
    label: "Service Charge Regime",
    description: "Common area budget and sinking fund apportioned to occupants.",
    defaultChecked: true,
  },
  {
    key: "lifts",
    label: "Passenger / Cargo Lifts",
    description: "Elevators, escalators, or hoist machinery installed.",
    defaultChecked: true,
  },
  {
    key: "generator",
    label: "Standby Generator",
    description: "Backup diesel generator and automatic transfer switch (ATS).",
    defaultChecked: true,
  },
  {
    key: "borehole",
    label: "Borehole / Water Treatment",
    description: "On-site borehole, booster pumps, RO or water softening plant.",
    defaultChecked: true,
  },
  {
    key: "fire_safety",
    label: "Fire Detection & Suppression",
    description: "Wet risers, fire hose reels, smoke detectors, automated alarms.",
    defaultChecked: true,
  },
  {
    key: "security_cctv",
    label: "Guarding & CCTV Access",
    description: "24/7 outsourced security, barrier gates, CCTV surveillance.",
    defaultChecked: true,
  },
  {
    key: "existing_tenants",
    label: "Existing In-Place Tenancies",
    description: "Property is currently occupied with active leases and deposits.",
    defaultChecked: true,
  },
  {
    key: "vat_registered",
    label: "VAT Registered Entity",
    description: "Landlord collects 16% output VAT on commercial rental income.",
    defaultChecked: true,
  },
  {
    key: "new_development",
    label: "Newly Completed Development",
    description: "Newly constructed building within Contractor Defects Liability Period (DLP).",
    defaultChecked: false,
  },
];

export interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  priority: "Mandatory" | "Optional";
  scope: string[];
  property_types: string[];
  description: string;
  rationale: string;
  format: string;
  source: string;
  condition?: (opt: Record<string, boolean | string>) => boolean;
}

export const CLIENT_CHECKLIST_DATA: ChecklistItem[] = [
  // 1. LEGAL & PROPERTY OWNERSHIP RECORDS
  {
    id: "legal-title",
    category: "Legal & Ownership Records",
    title: "Title Deed / Certificate of Lease (LR Number)",
    priority: "Mandatory",
    scope: ["both", "property", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    description: "Certified copy of the Title Deed or Certificate of Lease verifying legal ownership and LR parcel number.",
    rationale: "Confirms landlord legal locus standi to enter into management contracts and execute leases.",
    format: "Certified Copy PDF",
    source: "Landlord / Ministry of Lands",
  },
  {
    id: "legal-owner-id",
    category: "Legal & Ownership Records",
    title: "Landlord / Entity Identification Documents",
    priority: "Mandatory",
    scope: ["both", "property", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    description: "National ID / Passport (individual) or Certificate of Incorporation, CR12 & Directors IDs (corporate owner).",
    rationale: "Mandatory KYC and anti-money laundering compliance for institutional estate management.",
    format: "Color Scan PDF",
    source: "Landlord / Company Registry",
  },
  {
    id: "legal-kra-pin",
    category: "Legal & Ownership Records",
    title: "Landlord KRA PIN & Tax Compliance Certificate",
    priority: "Mandatory",
    scope: ["both", "property", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    description: "KRA PIN certificate and valid Tax Compliance Certificate (TCC).",
    rationale: "Required for rental income withholding tax (WHT) filing, eTIMS compliance, and monthly remittances.",
    format: "KRA Verified PDF",
    source: "KRA Portal",
  },
  {
    id: "legal-agency-agreement",
    category: "Legal & Ownership Records",
    title: "Executed Property Agency / FM Management Agreement",
    priority: "Mandatory",
    scope: ["both", "property", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    description: "Signed management contract stating agency terms, commission rates, disbursement schedule, and authority limits.",
    rationale: "Authoritative contract empowering Center Estates to collect rent, issue receipts, and manage facilities.",
    format: "Signed PDF Contract",
    source: "Center Estates & Landlord",
  },
  {
    id: "legal-power-attorney",
    category: "Legal & Ownership Records",
    title: "Deed of Indemnity / Power of Attorney (if corporate/diaspora)",
    priority: "Optional",
    scope: ["both", "property", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    description: "Registered Power of Attorney where property is managed on behalf of overseas, diaspora, or multi-shareholder entities.",
    rationale: "Authorizes designated local representatives to instruct and approve financial expenditures.",
    format: "Registered Deed PDF",
    source: "High Court / Advocate",
  },
  {
    id: "legal-land-rates",
    category: "Legal & Ownership Records",
    title: "Land Rates & Land Rent Clearance Certificates",
    priority: "Optional",
    scope: ["both", "property", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    description: "Current County Land Rates clearance receipt and National Land Commission rent statement.",
    rationale: "Prevents statutory county caveats or council operational interruptions against the building.",
    format: "Official Clearance Receipt",
    source: "County Government & Lands Ministry",
  },

  // 2. FINANCIAL & BANKING CONFIGURATION
  {
    id: "fin-collection-bank",
    category: "Financial & Banking Setup",
    title: "Property Collection Bank Account Credentials",
    priority: "Mandatory",
    scope: ["both", "property"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    description: "Bank name, branch, account number, swift code, and verified bank confirmation letter.",
    rationale: "Designates the dedicated rent and collection account for all tenant billings and automated bank matching.",
    format: "Bank Letter / Header Scan",
    source: "Commercial Bank",
  },
  {
    id: "fin-mpesa-paybill",
    category: "Financial & Banking Setup",
    title: "M-Pesa Paybill / Buy Goods Account Configuration",
    priority: "Optional",
    scope: ["both", "property"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    description: "Safaricom M-Pesa Paybill / Till number, Head Office business number, and API credentials for STK push / IPN.",
    rationale: "Enables instant automated receipting, payment verification, and tenant checkout via Daraja API.",
    format: "Safaricom Welcome Letter / Portal",
    source: "Safaricom / Bank",
  },
  {
    id: "fin-disbursement-bank",
    category: "Financial & Banking Setup",
    title: "Landlord Net Rental Disbursement Account",
    priority: "Mandatory",
    scope: ["both", "property"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    description: "Designated landlord bank account for net monthly rental disbursement remittance.",
    rationale: "Ensures prompt, auditable electronic settlement of net rental proceeds after agency commissions.",
    format: "Cancelled Cheque / Bank Confirmation",
    source: "Landlord",
  },
  {
    id: "fin-vat-certificate",
    category: "Financial & Banking Setup",
    title: "VAT Registration Certificate (Commercial Properties)",
    priority: "Mandatory",
    scope: ["both", "property"],
    property_types: ["commercial_office", "commercial_retail", "industrial", "sectional_title"],
    condition: (opt) => Boolean(opt.vat_registered) || ["commercial_office", "commercial_retail", "industrial"].includes(String(opt.property_type)),
    description: "KRA VAT registration certificate and designated commercial rent VAT rate.",
    rationale: "Mandatory for commercial rent 16% output VAT billing and monthly KRA returns.",
    format: "KRA VAT Certificate",
    source: "KRA iTax",
  },
  {
    id: "fin-service-charge-budget",
    category: "Financial & Banking Setup",
    title: "Annual Service Charge Budget & Apportionment Matrix",
    priority: "Mandatory",
    scope: ["both", "property", "facility"],
    property_types: ["commercial_office", "commercial_retail", "sectional_title", "residential_gated"],
    condition: (opt) => Boolean(opt.service_charge),
    description: "Approved annual operational budget breakdown (security, cleaning, power, lifts, repairs) and sqft rate.",
    rationale: "Governs statutory service charge invoicing, quarterly allocations, and annual auditor reconciliations.",
    format: "Approved Budget Excel / PDF",
    source: "Landlord / Management Company",
  },

  // 3. BUILDING ARCHITECTURAL & UNIT SPATIAL REGISTER
  {
    id: "arch-as-built-plans",
    category: "Building Architecture & Unit Register",
    title: "Approved Architectural & As-Built Engineering Drawings",
    priority: "Mandatory",
    scope: ["both", "facility", "property"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    description: "Approved as-built architectural floor plans, plumbing/drainage diagrams, and electrical single-line diagrams.",
    rationale: "Vital for spatial mapping, tenancy demarcations, pipe routing, emergency shutdowns, and maintenance drills.",
    format: "PDF / CAD Drawings",
    source: "Developer / Architect",
  },
  {
    id: "arch-units-schedule",
    category: "Building Architecture & Unit Register",
    title: "Master Schedule of Units & Measured Area (Sq. Ft.)",
    priority: "Mandatory",
    scope: ["both", "property", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    description: "Comprehensive list of all units: unit numbers, floor levels, usable/rentable area (sqft), target rents, and use.",
    rationale: "Core baseline data required to populate Center Estates unit records, rental billing schedules, and occupancy maps.",
    format: "Center Estates Unit Roster (Excel)",
    source: "Landlord / Quantity Surveyor",
  },
  {
    id: "arch-parking-schedule",
    category: "Building Architecture & Unit Register",
    title: "Parking Bay Register & Tag Numbering Schedule",
    priority: "Optional",
    scope: ["both", "property", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title"],
    description: "Schedule of all basement and ground level parking bays, bay numbers, unit allocations, and visitor slots.",
    rationale: "Required to assign tenant parking passes, resolve bay disputes, and enforce barrier access control.",
    format: "Excel Roster / Floor Plan",
    source: "Site Management",
  },
  {
    id: "arch-keys-access",
    category: "Building Architecture & Unit Register",
    title: "Master Keys & Electronic Access Tag Handover Inventory",
    priority: "Mandatory",
    scope: ["both", "property", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    description: "Physical handover and signing of master keys, vacant unit keys, padlock tags, riser room keys, and RFID tags.",
    rationale: "Ensures property manager custody, enables scheduled inspections, and protects against unauthorized tenant entry.",
    format: "Signed Key Inventory Sheet",
    source: "Caretaker / Handover Team",
  },

  // 4. TENANCY, LEASES & DEPOSITS (PROPERTY MANAGEMENT)
  {
    id: "pm-tenancy-schedule",
    category: "Tenancy & Lease Ledger (Property Management)",
    title: "Current Tenancy Schedule (Rent Roll)",
    priority: "Mandatory",
    scope: ["both", "property"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    condition: (opt) => Boolean(opt.existing_tenants),
    description: "Current rent roll: tenant names, phone numbers, email addresses, national IDs, monthly rent, and billing day.",
    rationale: "Enables bulk-creation of active tenant profiles and automated invoice runs on day one.",
    format: "Excel Bulk Lease Template",
    source: "Current Property Agent / Landlord",
  },
  {
    id: "pm-executed-leases",
    category: "Tenancy & Lease Ledger (Property Management)",
    title: "Signed Tenancy Agreements & Offer Letters",
    priority: "Mandatory",
    scope: ["both", "property"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    condition: (opt) => Boolean(opt.existing_tenants),
    description: "Copies of all signed lease agreements, offer letters, renewal addendums, and escalation terms.",
    rationale: "Legally binds tenants to payment terms, escalation percentages, deposit terms, and termination clauses.",
    format: "Scanned PDF Leases",
    source: "Previous Agent / Landlord Files",
  },
  {
    id: "pm-deposits-ledger",
    category: "Tenancy & Lease Ledger (Property Management)",
    title: "Tenant Security & Utility Deposit Custody Ledger",
    priority: "Mandatory",
    scope: ["both", "property"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    condition: (opt) => Boolean(opt.existing_tenants),
    description: "Detailed statement of all tenant security deposits, water deposits, and electricity deposits held in custody.",
    rationale: "Crucial to establish the opening Tenant Deposits Register, avoid tenant exit disputes, and calculate arrears exposure.",
    format: "Certified Deposits Ledger (Excel/PDF)",
    source: "Previous Agent / Bank Escrow",
  },
  {
    id: "pm-opening-balances",
    category: "Tenancy & Lease Ledger (Property Management)",
    title: "Tenant Opening Balances & Arrears Carried Forward (B/F)",
    priority: "Mandatory",
    scope: ["both", "property"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    condition: (opt) => Boolean(opt.existing_tenants),
    description: "Reconciled ledger balances showing outstanding rent, service charge, and utility arrears per tenant as of handover date.",
    rationale: "Prevents disputed billing; establishes opening balance brought forward (B/F) for monthly tenant statements.",
    format: "Certified Aged Debtors Ledger",
    source: "Outgoing Managing Agent / Accountant",
  },
  {
    id: "pm-meter-readings",
    category: "Tenancy & Lease Ledger (Property Management)",
    title: "Sub-Meter Handover Readings & Photographs",
    priority: "Mandatory",
    scope: ["both", "property", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    condition: (opt) => Boolean(opt.submeters),
    description: "Opening baseline meter readings for all tenant sub-meters (water, electricity, BTU/cooling) with timestamped photos.",
    rationale: "Ensures incoming tenants are billed solely for their consumption from the date of management takeover.",
    format: "Signed Meter Sheet + Photos",
    source: "Joint Handover Inspection Team",
  },

  // 5. PLANT, MACHINERY & ASSETS (FACILITY MANAGEMENT)
  {
    id: "fm-asset-register",
    category: "Plant, Machinery & Asset Register (Facility Management)",
    title: "Master Equipment & Physical Asset Inventory",
    priority: "Mandatory",
    scope: ["both", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    description: "Comprehensive list of all critical assets: make, model, serial number, capacity, location, installation date, and vendor.",
    rationale: "Populates the Facility Management asset catalog, QR code tags, and preventive maintenance schedules.",
    format: "Center Estates Asset Roster (Excel)",
    source: "MEP Engineers / Outgoing FM",
  },
  {
    id: "fm-lift-contract",
    category: "Plant, Machinery & Asset Register (Facility Management)",
    title: "Elevator / Lift Service AMC & Rescue Protocol",
    priority: "Mandatory",
    scope: ["both", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "sectional_title"],
    condition: (opt) => Boolean(opt.lifts),
    description: "Active Annual Maintenance Contract (AMC) with certified elevator vendor (Kone, Schindler, Otis, etc.) and 24/7 rescue contact.",
    rationale: "Ensures uninterrupted lift operations, passenger safety, rapid entrapment response, and insurance compliance.",
    format: "Signed AMC PDF",
    source: "Elevator Contractor",
  },
  {
    id: "fm-generator-specs",
    category: "Plant, Machinery & Asset Register (Facility Management)",
    title: "Backup Generator Specifications & AMC",
    priority: "Mandatory",
    scope: ["both", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "sectional_title", "industrial"],
    condition: (opt) => Boolean(opt.generator),
    description: "Generator kVA rating, ATS panel specs, fuel tank capacity, vendor service contract, and fuel supplier agreement.",
    rationale: "Guarantees business continuity, automatic power changeover during blackouts, and controlled diesel replenishment.",
    format: "Contract PDF + O&M Manual",
    source: "Generator Vendor",
  },
  {
    id: "fm-borehole-docs",
    category: "Plant, Machinery & Asset Register (Facility Management)",
    title: "Borehole WRMA License & Water Quality Test Report",
    priority: "Mandatory",
    scope: ["both", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    condition: (opt) => Boolean(opt.borehole),
    description: "Water Resources Authority (WRA) permit, borehole pump horsepower, yield report, and certified lab potability test.",
    rationale: "Statutory water abstraction compliance; safeguards tenant health and confirms whether treatment is needed.",
    format: "WRA Permit + Certified Lab Test",
    source: "WRA / Certified Chemistry Lab",
  },
  {
    id: "fm-security-cleaning",
    category: "Plant, Machinery & Asset Register (Facility Management)",
    title: "Security Guarding, Cleaning & Waste Management Contracts",
    priority: "Mandatory",
    scope: ["both", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    description: "Service Level Agreements (SLAs) for 24-hr security guarding, common area janitorial cleaning, and garbage collection.",
    rationale: "Maintains day-to-day estate hygiene, perimeter security, visitor control, and scheduled waste disposal.",
    format: "Executed Service Contracts",
    source: "Security & Cleaning Contractors",
  },
  {
    id: "fm-om-manuals",
    category: "Plant, Machinery & Asset Register (Facility Management)",
    title: "Equipment Operating & Maintenance (O&M) Manuals",
    priority: "Optional",
    scope: ["both", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "sectional_title", "industrial"],
    description: "Manufacturer user manuals, schematics, and recommended service intervals for mechanical and electrical plant.",
    rationale: "Guides technicians during planned maintenance and emergency troubleshooting without voiding warranties.",
    format: "PDF / Bound Manuals",
    source: "Equipment Manufacturers / MEP Contractor",
  },

  // 6. STATUTORY COMPLIANCE & SAFETY (FACILITY MANAGEMENT)
  {
    id: "comp-occupancy-cert",
    category: "Statutory Compliance & Safety (Facility Management)",
    title: "County Certificate of Occupancy / Building Permit",
    priority: "Mandatory",
    scope: ["both", "facility", "property"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    description: "County Government Occupancy Certificate certifying the building is completed according to planning regulations.",
    rationale: "Legal foundation verifying building safety and authorizing human habitation / commercial operation.",
    format: "County Certified Document",
    source: "County Planning Department",
  },
  {
    id: "comp-fire-safety",
    category: "Statutory Compliance & Safety (Facility Management)",
    title: "Fire Safety Audit & Annual Equipment Inspection Certificate",
    priority: "Mandatory",
    scope: ["both", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    description: "Current County Fire Department compliance certificate, fire hydrants test report, and extinguishers service tags.",
    rationale: "Mandatory under the Fire Reduction Rules 2007; protects against building closures and validates insurance cover.",
    format: "County Fire Clearance Certificate",
    source: "County Fire Services / DOSH Auditor",
  },
  {
    id: "comp-osha-audit",
    category: "Statutory Compliance & Safety (Facility Management)",
    title: "OSHA Workplace Safety & Health Annual Audit Report",
    priority: "Mandatory",
    scope: ["both", "facility"],
    property_types: ["commercial_office", "commercial_retail", "industrial", "sectional_title"],
    description: "Occupational Safety and Health Act (OSHA 2007) audit conducted by a registered DOSH health & safety adviser.",
    rationale: "Statutory compliance for all commercial and multi-tenanted workplaces to prevent workplace accidents and fines.",
    format: "DOSH Audit Report",
    source: "Registered Safety Auditor",
  },
  {
    id: "comp-lift-inspection",
    category: "Statutory Compliance & Safety (Facility Management)",
    title: "Lift / Hoist Statutory Examination Certificate (DOSH)",
    priority: "Mandatory",
    scope: ["both", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "sectional_title"],
    condition: (opt) => Boolean(opt.lifts),
    description: "Annual statutory elevator inspection certificate issued by a DOSH-authorized plant inspector.",
    rationale: "Legal prerequisite to operate passenger elevators under the Factories and Other Places of Work Act.",
    format: "DOSH Examination Certificate",
    source: "Approved Lift Inspector",
  },
  {
    id: "comp-insurance-policy",
    category: "Statutory Compliance & Safety (Facility Management)",
    title: "Property All-Risks & Public Liability Insurance Cover",
    priority: "Mandatory",
    scope: ["both", "facility", "property"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "residential_gated", "sectional_title", "industrial"],
    description: "Valid insurance cover for Fire & Perils, Machinery Breakdown, Public Liability, and Terrorism/Political Violence.",
    rationale: "Safeguards building value, shields management from third-party injury claims, and satisfies bank mortgage covenants.",
    format: "Insurance Policy / Cover Note",
    source: "Insurance Underwriter",
  },
  {
    id: "comp-dlp-defects",
    category: "Statutory Compliance & Safety (Facility Management)",
    title: "Defects Liability Period (DLP) Schedule & Contractor Bonds",
    priority: "Optional",
    scope: ["both", "facility"],
    property_types: ["commercial_office", "commercial_retail", "residential_multi", "sectional_title", "industrial"],
    condition: (opt) => Boolean(opt.new_development),
    description: "Contractor snags list, defect liability expiration date, and performance bond details for new properties.",
    rationale: "Allows facility manager to enforce main contractor rectification of construction defects free of charge.",
    format: "Snagging Register & Contract",
    source: "Project Manager / Main Contractor",
  },

  // 7. SECTIONAL TITLE & STRATA GOVERNANCE
  {
    id: "strata-sectional-plan",
    category: "Sectional Title & Governance (Strata Schemes)",
    title: "Registered Sectional Plan (Sectional Properties Act 2020)",
    priority: "Mandatory",
    scope: ["both", "property", "facility"],
    property_types: ["sectional_title"],
    description: "Surveyor sectional plan registered at the Land Registry showing common property boundaries and unit parcels.",
    rationale: "Legal authority defining individual unit boundaries vs common areas under the Sectional Properties Act 2020.",
    format: "Registered Sectional Plan PDF",
    source: "Director of Survey / Land Registry",
  },
  {
    id: "strata-omc-incorporation",
    category: "Sectional Title & Governance (Strata Schemes)",
    title: "Owners Management Company (OMC) Registration Certificate",
    priority: "Mandatory",
    scope: ["both", "property", "facility"],
    property_types: ["sectional_title"],
    description: "Certificate of Incorporation for the Management Corporation / Owners Association, Memorandum, and list of directors.",
    rationale: "Legal entity representing the collective unit owners with whom the management agreement is signed.",
    format: "BRS Registration Certificate",
    source: "Business Registration Service (BRS)",
  },
  {
    id: "strata-unit-entitlements",
    category: "Sectional Title & Governance (Strata Schemes)",
    title: "Unit Entitlement Schedule & Service Charge Share Factors",
    priority: "Mandatory",
    scope: ["both", "property", "facility"],
    property_types: ["sectional_title"],
    description: "Statutory schedule stating unit shares / unit entitlements for each unit used to apportion common area expenses.",
    rationale: "Ensures fair, legally unchallengeable monthly service charge and sinking fund invoicing to unit owners.",
    format: "Certified Entitlement Matrix",
    source: "Registered Sectional Plan",
  },
  {
    id: "strata-bylaws-rules",
    category: "Sectional Title & Governance (Strata Schemes)",
    title: "Estate By-Laws, House Rules & Parking Regulations",
    priority: "Mandatory",
    scope: ["both", "property", "facility"],
    property_types: ["sectional_title", "residential_gated"],
    description: "Approved estate rules governing noise, pets, interior modifications, signage, garbage, and parking etiquette.",
    rationale: "Empowers managing agent and concierge to enforce orderly community living and issue non-compliance notices.",
    format: "Approved By-Laws PDF",
    source: "Owners Management Company / Developer",
  },
  {
    id: "strata-owners-register",
    category: "Sectional Title & Governance (Strata Schemes)",
    title: "Unit Owners Master Contacts & Title Registration Register",
    priority: "Mandatory",
    scope: ["both", "property", "facility"],
    property_types: ["sectional_title"],
    description: "Master register of all unit owners: full names, contact phones, email addresses, KRA PINs, and Title Deed numbers.",
    rationale: "Required to bill unit owners for monthly service charges and establish owner portal accounts.",
    format: "Excel Unit Owner Register",
    source: "Developer / OMC Secretary",
  },
];

export function filterClientChecklist(
  scope: ManagementScope = "both",
  propertyType: PropertyTypeCode = "commercial_office",
  options: Record<string, boolean> = {}
) {
  const mergedOptions: Record<string, boolean | string> = {
    ...options,
    scope,
    property_type: propertyType,
  };

  const filtered = CLIENT_CHECKLIST_DATA.filter((item) => {
    if (scope !== "both" && !item.scope.includes(scope) && !item.scope.includes("both")) {
      return false;
    }
    if (!item.property_types.includes(propertyType)) {
      return false;
    }
    if (item.condition && !item.condition(mergedOptions)) {
      return false;
    }
    return true;
  });

  const categories: Record<string, ChecklistItem[]> = {};
  for (const item of filtered) {
    if (!categories[item.category]) categories[item.category] = [];
    categories[item.category].push(item);
  }

  const mandatoryCount = filtered.filter((i) => i.priority === "Mandatory").length;
  const optionalCount = filtered.length - mandatoryCount;

  return {
    items: filtered,
    categories,
    totalCount: filtered.length,
    mandatoryCount,
    optionalCount,
    categoriesCount: Object.keys(categories).length,
  };
}

export function downloadClientChecklistCsv(
  items: ChecklistItem[],
  propertyType: PropertyTypeCode,
  propertyName = "New Property"
) {
  const headers = [
    "Category",
    "Requirement / Document",
    "Priority",
    "Description",
    "Purpose & Legal Rationale",
    "Accepted Format",
    "Source",
    "Status (Pending / Received / N/A)",
  ];

  const rows = items.map((i) => [
    `"${i.category.replace(/"/g, '""')}"`,
    `"${i.title.replace(/"/g, '""')}"`,
    `"${i.priority}"`,
    `"${i.description.replace(/"/g, '""')}"`,
    `"${i.rationale.replace(/"/g, '""')}"`,
    `"${i.format.replace(/"/g, '""')}"`,
    `"${i.source.replace(/"/g, '""')}"`,
    `"Pending"`,
  ]);

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `onboarding-checklist-${propertyType}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
