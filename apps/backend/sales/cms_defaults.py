"""Default seed data for Center Estates Native Sales Content Management System (CMS).

Pre-engineered with real-estate buyer guides, neighborhood investment analyses,
legal FAQs, and marketing collateral definitions.
"""

CMS_DEFAULT_ARTICLES = [
    {
        'title': "The Complete Off-Plan Homebuyer's Checklist: Navigating Contracts & Escrows",
        'slug': 'complete-off-plan-homebuyers-checklist',
        'category': 'buyer_guide',
        'summary': (
            "A step-by-step due diligence guide for purchasing off-plan residential units, "
            "verifying sectional property titles, and structuring milestone payments."
        ),
        'cover_image_url': 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80',
        'author_name': 'Center Estates Advisory',
        'status': 'published',
        'is_featured': True,
        'read_time_minutes': 5,
        'tags': ['Off-Plan', 'Due Diligence', 'Legal', 'Escrow', 'Investment'],
        'body': (
            "## 1. Introduction: Why Off-Plan Requires Structural Due Diligence\n\n"
            "Buying off-plan allows investors to secure modern residential and commercial property at a discount "
            "to completed market value, typically between **15% to 25% below post-handover prices**.\n\n"
            "However, off-plan success depends on structural safeguards that prevent capital lockup and project delays.\n\n"
            "### Core Verification Steps\n\n"
            "1. **Title & Land Verification**: Confirm that the mother title is unencumbered and registered under the Sectional Properties Act.\n"
            "2. **Architectural & County Approvals**: Verify EIA (NEMA) license, National Construction Authority (NCA) registration, and county planning approval.\n"
            "3. **Staged Escrow Payment Milestones**: Never disburse funds on a pure calendar schedule. Payments must link directly to verified construction milestones.\n\n"
            "## 2. Staged Construction Gateways\n\n"
            "A standard institutional payment structure aligns as follows:\n\n"
            "- **Booking Deposit (10%)**: Secures unit allocation and triggers the draft Letter of Offer.\n"
            "- **Ground Breaking & Foundation (20%)**: Upon completion of substructure and piling.\n"
            "- **Superstructure Completion (30%)**: Upon roof casting and structural framing.\n"
            "- **Internal Finishes & MEP (30%)**: Mechanical, electrical, tiling, and joinery installation.\n"
            "- **Handover & Key Release (10%)**: Final inspection, snagging sign-off, and issuance of Certificate of Practical Completion.\n\n"
            "## 3. Legal Documentation to Demand\n\n"
            "- Signed Agreement for Sale with standard dispute resolution clauses.\n"
            "- Architect-certified Interim Payment Certificates (IPCs).\n"
            "- Warranty and Defects Liability Period (DLP) terms (minimum 6 months post-handover)."
        ),
    },
    {
        'title': 'Nairobi High-Yield Corridors: Rental Yields & Capital Appreciation Analysis',
        'slug': 'nairobi-high-yield-real-estate-corridors',
        'category': 'investment_analysis',
        'summary': (
            "Comprehensive breakdown of gross rental yields, infrastructure drivers, "
            "and tenant absorption rates across Kilimani, Westlands, and Riverside."
        ),
        'cover_image_url': 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
        'author_name': 'Research & Analytics Desk',
        'status': 'published',
        'is_featured': True,
        'read_time_minutes': 6,
        'tags': ['Market Trends', 'Rental Yields', 'Kilimani', 'Westlands', 'ROI'],
        'body': (
            "## Market Overview: Prime Urban Residential Performance\n\n"
            "Nairobi's serviced apartment and residential studio segments have shown remarkable resilience, "
            "driven by corporate relocations, international diplomatic missions, and short-stay business travelers.\n\n"
            "### Comparative Yield Benchmark\n\n"
            "| Submarket | Average Gross Yield | Capital Growth (YoY) | Primary Tenant Demographic |\n"
            "| :--- | :--- | :--- | :--- |\n"
            "| **Kilimani** | 8.8% – 10.2% | +6.4% | Tech workers, expatriates, short-let |\n"
            "| **Westlands** | 9.1% – 11.5% | +7.8% | Multinational executives, commercial staff |\n"
            "| **Riverside** | 7.9% – 9.0% | +5.5% | Diplomats, NGO leadership, families |\n\n"
            "### Key Drivers of Value\n\n"
            "- **Expressway & Bypass Connectivity**: Reduced commute times to JKIA have made Westlands and Kilimani prime hubs for regional headquarters.\n"
            "- **Dual-Source Utilities**: Projects with dedicated high-yield boreholes and full backup generators command an average 18% rental premium over utility-unstable buildings.\n"
            "- **Fiber & Smart Metering**: Individual automated water and power submetering eliminates tenant billing disputes."
        ),
    },
    {
        'title': 'Understanding the Sectional Properties Act & Transfer of Title',
        'slug': 'sectional-properties-act-title-transfer-guide',
        'category': 'faq',
        'summary': (
            "Everything buyers need to know about transitioning from long-term sub-leases "
            "to freehold or leasehold sectional certificate of title."
        ),
        'cover_image_url': 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80',
        'author_name': 'Conveyancing Legal Team',
        'status': 'published',
        'is_featured': False,
        'read_time_minutes': 4,
        'tags': ['Law', 'Conveyancing', 'Title Deeds', 'Sectional Properties'],
        'body': (
            "## What Changed with the Sectional Properties Act?\n\n"
            "Historically, apartment owners in Kenya held property through long-term subleases backed by a "
            "management company holding the mother title. This created hurdles in securing mortgages and charging titles.\n\n"
            "Under the Sectional Properties Act, individual units receive independent Certificates of Title or "
            "Certificates of Lease directly registered with the Ministry of Lands.\n\n"
            "### Benefits for the Individual Unit Owner\n\n"
            "1. **Independent Collateral**: Banks can register a direct legal charge against your specific unit without requiring consent from other unit owners.\n"
            "2. **Separate Land Rent & Rates**: Apportioned directly by the Ministry and County governments.\n"
            "3. **Clear Common Area Ownership**: Common property (elevators, driveways, roofs) is co-owned in undivided shares through the Corporation."
        ),
    },
    {
        'title': 'Construction Quality Milestone: Substructure Casting & Acoustic Glazing',
        'slug': 'construction-quality-milestone-update',
        'category': 'project_update',
        'summary': (
            "Engineering progress teardown showcasing seismic foundation testing, double-glazed acoustic windows, and MEP ducting."
        ),
        'cover_image_url': 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?auto=format&fit=crop&w=1200&q=80',
        'author_name': 'Project Engineering Team',
        'status': 'published',
        'is_featured': False,
        'read_time_minutes': 3,
        'tags': ['Engineering', 'Quality Control', 'Milestone', 'Construction'],
        'body': (
            "## Engineering Integrity & Specifications\n\n"
            "Quality assurance is tracked digitally at every structural milestone. "
            "Here are the recent structural benchmarks passed by our engineering team:\n\n"
            "### 1. Concrete Core Compression Testing\n\n"
            "All batch pour samples achieved compressive strengths exceeding 35 N/mm² at 28 days, "
            "well in excess of the structural engineer's baseline 30 N/mm² specification.\n\n"
            "### 2. Acoustic & Thermal Glazing\n\n"
            "Double-glazed 6mm+12A+6mm laminated tempered glass has been installed on all street-facing facades, "
            "reducing ambient exterior noise by over 36 dB."
        ),
    },
]

CMS_DEFAULT_ASSETS = [
    {
        'title': 'Project Master Brochure & Finishes Specification (PDF)',
        'asset_kind': 'brochure',
        'external_url': 'https://centerestates.com/demo/brochure.pdf',
        'description': 'Comprehensive project brochure including floor plans, finish schedules, sanitary ware specifications, and payment terms.',
        'file_size': 4850000,
        'mime_type': 'application/pdf',
        'is_public': True,
    },
    {
        'title': 'Staged Off-Plan Payment Matrix & Escrow Instructions',
        'asset_kind': 'pricelist',
        'external_url': 'https://centerestates.com/demo/payment-plan.pdf',
        'description': 'Detailed breakdown of standard 10-20-30-30-10 payment terms, banking details, and M-Pesa paybill escrow reference codes.',
        'file_size': 1250000,
        'mime_type': 'application/pdf',
        'is_public': True,
    },
    {
        'title': '2-Bedroom & 3-Bedroom Typology Layout Plans',
        'asset_kind': 'floorplan',
        'external_url': 'https://centerestates.com/demo/floorplans.pdf',
        'description': 'Dimensioned architectural floor plans showing internal square meterage, balcony dimensions, and utility room layouts.',
        'file_size': 3100000,
        'mime_type': 'application/pdf',
        'is_public': True,
    },
    {
        'title': '360° Virtual Walkthrough Experience (Matterport)',
        'asset_kind': 'virtual_tour',
        'external_url': 'https://my.matterport.com/show/?m=sample360tour',
        'description': 'Interactive 3D dollhouse model and walk-through of the fully furnished show apartment.',
        'file_size': 0,
        'mime_type': 'text/html',
        'is_public': True,
    },
    {
        'title': 'Executive Penthouse 4K Video Tour',
        'asset_kind': 'video_tour',
        'external_url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'description': 'High definition drone flyover and interior walkthrough video showcasing panoramic city skyline views.',
        'file_size': 0,
        'mime_type': 'video/mp4',
        'is_public': True,
    },
]
