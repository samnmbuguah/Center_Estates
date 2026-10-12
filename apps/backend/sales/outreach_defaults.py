"""Pre-engineered GTM outbound campaigns, ICPs, and multi-step sequences
inspired by Explee Auto-GTM analysis and OpenOutreach architecture.
"""

MODULE_CAMPAIGN_TEMPLATES = [
    {
        'name': 'Commercial Property Management & Tenant Billing Automation',
        'target_module': 'property',
        'target_icp': 'Commercial Property Managers, Estate Agencies, and Sectional Title / HOA Managers managing 30+ units.',
        'pain_points': 'Excel hell at month-end; 3-5 days wasted calculating metered electricity & water consumption; chasing separate rent vs utility payments; manual tenant deposit reconciliation.',
        'value_proposition': 'Consolidated single-invoice tenant billing combining rent, service charges, and metered utilities with automated M-Pesa reconciliation and multi-floor tenant management.',
        'booking_url': 'https://centerestates.com/demo',
        'daily_send_limit': 50,
        'steps': [
            {
                'step_number': 1,
                'title': 'Acute Pain Hook: Month-End Utility & Rent Reconciliation',
                'delay_days': 0,
                'subject_template': 'Quick question regarding tenant utility & rent billing at {{company_name}}',
                'body_template': (
                    "Hi {{first_name}},\n\n"
                    "Saw that {{company_name}} manages prominent commercial and residential portfolios in the region. "
                    "Most property managers I speak with lose 3 to 4 days at the end of every month just reconciling "
                    "tenant water/power submeters against bulk meters, then chasing separate payments.\n\n"
                    "We built Center Estates specifically to automate that: it generates a single consolidated invoice "
                    "combining rent, service charges, and metered utilities with instant tenant receipting.\n\n"
                    "Would you be open to a 10-minute demo this Thursday to see how it cuts monthly billing reconciliation "
                    "down to under an hour?\n\n"
                    "You can pick a convenient time directly here: {{booking_url}}\n\n"
                    "Best regards,\nFounder, Center Estates"
                ),
            },
            {
                'step_number': 2,
                'title': 'Case Proof: Multi-Floor Commercial Tenancy Case Study',
                'delay_days': 3,
                'subject_template': 'Re: Quick question regarding tenant utility & rent billing at {{company_name}}',
                'body_template': (
                    "Hi {{first_name}},\n\n"
                    "Following up on my note earlier. We recently helped a multi-tower commercial property in Nairobi "
                    "automate their tenant billing across multiple floors with both bulk and submetered utilities. "
                    "Their finance team now sends all monthly bills and receipts in one click instead of 4 days of manual calculations.\n\n"
                    "I would love to share this exact workflow with you and the property team at {{company_name}}.\n\n"
                    "Does tomorrow afternoon work for a brief screen share? ({{booking_url}})\n\n"
                    "Best,\nFounder, Center Estates"
                ),
            },
            {
                'step_number': 3,
                'title': 'Breakup & Resource Share',
                'delay_days': 7,
                'subject_template': 'Should I close your file for {{company_name}}?',
                'body_template': (
                    "Hi {{first_name}},\n\n"
                    "I haven't heard back, so I assume automated tenant billing and utility reconciliation isn't a priority for {{company_name}} right now.\n\n"
                    "If that changes in the future, you can explore the property management features anytime at https://centerestates.com/property or schedule a walkthrough at {{booking_url}}.\n\n"
                    "Wishing {{company_name}} continued success!\n\n"
                    "Best regards,\nFounder, Center Estates"
                ),
            },
        ],
    },
    {
        'name': 'Preventative Facility Management (PPM) & Contractor SLAs',
        'target_module': 'facility',
        'target_icp': 'Facility Management Contractors, Commercial Office Parks, Hospitals, and Shopping Mall Operations Heads.',
        'pain_points': 'Unplanned plant breakdowns (backup generators, passenger lifts, borehole pumps); untracked contractor maintenance SLAs; messy paper/WhatsApp incident logging.',
        'value_proposition': 'Mobile caretaker logging, digital PPM calendar, QR asset tagging, and zero unplanned plant downtime.',
        'booking_url': 'https://centerestates.com/demo',
        'daily_send_limit': 50,
        'steps': [
            {
                'step_number': 1,
                'title': 'Acute Pain Hook: Zero Unplanned Plant Downtime',
                'delay_days': 0,
                'subject_template': 'Preventative maintenance & asset logs for {{company_name}}',
                'body_template': (
                    "Hi {{first_name}},\n\n"
                    "Managing scheduled maintenance across lifts, backup generators, and pumps across facilities usually "
                    "turns into an unmonitored WhatsApp group and paper logbooks. When a generator fails during a blackout, "
                    "it is usually because a servicing milestone was missed.\n\n"
                    "With Center Estates' Facilities module, your caretakers and technicians log equipment inspections and PPMs "
                    "directly from their phones, and maintenance SLAs are tracked automatically.\n\n"
                    "Can I show you a 5-minute walkthrough of the maintenance board sometime this week? ({{booking_url}})\n\n"
                    "Best regards,\nFounder, Center Estates"
                ),
            },
            {
                'step_number': 2,
                'title': 'Social Proof: Contractor SLA Audit Trail',
                'delay_days': 3,
                'subject_template': 'Re: Preventative maintenance & asset logs for {{company_name}}',
                'body_template': (
                    "Hi {{first_name}},\n\n"
                    "Just touching base on this. Commercial facility heads love that Center Estates lets them hold external "
                    "contractors (security, cleaning, elevator technicians) accountable with SLA response timers and incident sign-offs.\n\n"
                    "Would you have 10 minutes this Friday for a quick look? {{booking_url}}\n\n"
                    "Best,\nFounder, Center Estates"
                ),
            },
            {
                'step_number': 3,
                'title': 'Breakup Touch',
                'delay_days': 7,
                'subject_template': 'Closing the loop on facility maintenance for {{company_name}}',
                'body_template': (
                    "Hi {{first_name}},\n\n"
                    "Assuming PPM automation isn't top of mind right now for {{company_name}}.\n\n"
                    "Feel free to check out https://centerestates.com/facility if you ever need a modern facilities portal.\n\n"
                    "All the best,\nFounder, Center Estates"
                ),
            },
        ],
    },
    {
        'name': 'Construction Project Monitoring & Digital IPC Certification',
        'target_module': 'construction',
        'target_icp': 'Real Estate Developers, Project Quantity Surveyors, Civil Engineering PMs managing active building sites.',
        'pain_points': 'Construction cost overruns, delayed interim payment certificates (IPCs), unverified subcontractor BOQ claims, lack of visual site progress tracking.',
        'value_proposition': 'Real-time BOQ tracking, subcontractor milestone certification, 3D BIM progress visualization, and zero cost overruns.',
        'booking_url': 'https://centerestates.com/demo',
        'daily_send_limit': 50,
        'steps': [
            {
                'step_number': 1,
                'title': 'Acute Pain Hook: Eliminating BOQ & IPC Disputes',
                'delay_days': 0,
                'subject_template': 'Interim Payment Certificate (IPC) tracking at {{company_name}}',
                'body_template': (
                    "Hi {{first_name}},\n\n"
                    "Noticed {{company_name}} is executing high-profile developments. For most project directors and QSs, "
                    "reviewing contractor payment claims against Bill of Quantities (BOQs) requires digging through spreadsheets "
                    "and site photos, leading to certification delays and cash flow friction.\n\n"
                    "Center Estates digitizes the entire IPC workflow: contractors submit measurement claims, QSs verify against the live BOQ, "
                    "and certificates are issued with full audit trails.\n\n"
                    "Could I demonstrate how this works on an active project in a brief 10-minute call? {{booking_url}}\n\n"
                    "Best regards,\nFounder, Center Estates"
                ),
            },
            {
                'step_number': 2,
                'title': 'BIM & Cost Risk Tracking',
                'delay_days': 4,
                'subject_template': 'Re: Interim Payment Certificate (IPC) tracking at {{company_name}}',
                'body_template': (
                    "Hi {{first_name}},\n\n"
                    "Following up. Beyond IPC certification, our platform syncs 3D BIM models with real site progress "
                    "so stakeholders can see exactly what has been completed before approving valuations.\n\n"
                    "Do you have 10 minutes this week? {{booking_url}}\n\n"
                    "Best,\nFounder, Center Estates"
                ),
            },
            {
                'step_number': 3,
                'title': 'Breakup Touch',
                'delay_days': 8,
                'subject_template': 'Permission to close file — {{company_name}}',
                'body_template': (
                    "Hi {{first_name}},\n\n"
                    "I will assume you have existing systems in place for construction monitoring at {{company_name}}.\n\n"
                    "If you ever want to streamline your project cost controls, you can explore https://centerestates.com/monitoring.\n\n"
                    "Best,\nFounder, Center Estates"
                ),
            },
        ],
    },
    {
        'name': 'Valuation Surveying & Automated Comparable Registry',
        'target_module': 'valuation',
        'target_icp': 'Licensed Valuation Surveyors, Land Appraisal Consultancies, Bank Panel Valuers.',
        'pain_points': 'Slow valuation report turnaround, unindexed comparable sales registry, manual repetitive report assembly in Word.',
        'value_proposition': 'Cut valuation report turnaround by 70% with searchable comparable registries and bank-ready appraisal report generators.',
        'booking_url': 'https://centerestates.com/demo',
        'daily_send_limit': 50,
        'steps': [
            {
                'step_number': 1,
                'title': 'Acute Pain Hook: 70% Faster Valuation Reports',
                'delay_days': 0,
                'subject_template': 'Comparable sales register & valuation reports for {{company_name}}',
                'body_template': (
                    "Hi {{first_name}},\n\n"
                    "As a valuation surveyor at {{company_name}}, how much time does your team spend hunting down past comparable sales "
                    "and retyping property data into valuation report templates?\n\n"
                    "Center Estates gives appraisal firms a centralized, searchable comparable database and generates standardized, "
                    "bank-compliant valuation reports with integrated photo schedules in minutes.\n\n"
                    "Would you be open to seeing a 5-minute preview of the valuation report builder? {{booking_url}}\n\n"
                    "Best regards,\nFounder, Center Estates"
                ),
            },
            {
                'step_number': 2,
                'title': 'Follow Up: Bank-Panel Compliance',
                'delay_days': 3,
                'subject_template': 'Re: Comparable sales register & valuation reports for {{company_name}}',
                'body_template': (
                    "Hi {{first_name}},\n\n"
                    "Quick follow-up. Firms using Center Estates have doubled their inspection-to-report turnaround time, "
                    "allowing their surveyors to handle more instructions from commercial banks and mortgage lenders.\n\n"
                    "Would Thursday morning suit for a quick look? {{booking_url}}\n\n"
                    "Best,\nFounder, Center Estates"
                ),
            },
            {
                'step_number': 3,
                'title': 'Breakup Touch',
                'delay_days': 7,
                'subject_template': 'Valuation workflow — {{company_name}}',
                'body_template': (
                    "Hi {{first_name}},\n\n"
                    "Closing the loop on this. You can review the valuation tools anytime at https://centerestates.com/valuation.\n\n"
                    "Wishing you all the best,\nFounder, Center Estates"
                ),
            },
        ],
    },
    {
        'name': 'Contractor Procurement & Digital Tender Comparison Matrix',
        'target_module': 'tender',
        'target_icp': 'Mid-to-Large Real Estate Developers, Construction Procurement Officers, Commercial Landlords.',
        'pain_points': 'Chaotic contractor bids received across email and WhatsApp; tedious manual comparison spreadsheets; missing audit trail for procurement decisions.',
        'value_proposition': 'Standardized digital RFP distribution, structured contractor tender submissions, and 1-click bid comparison matrices.',
        'booking_url': 'https://centerestates.com/demo',
        'daily_send_limit': 50,
        'steps': [
            {
                'step_number': 1,
                'title': 'Acute Pain Hook: Instant Tender Bid Comparison',
                'delay_days': 0,
                'subject_template': 'Tender evaluation & contractor bids for {{company_name}}',
                'body_template': (
                    "Hi {{first_name}},\n\n"
                    "When {{company_name}} tenders for construction works or facility services, how do you currently compare contractor bids? "
                    "Usually, procurement teams spend days extracting figures from different PDF quotes into Excel.\n\n"
                    "Center Estates provides an automated tender portal: contractors submit itemized prices online, and the system produces "
                    "a side-by-side comparison matrix with variance analysis instantly.\n\n"
                    "Could I share a 10-minute demo with you this week? {{booking_url}}\n\n"
                    "Best regards,\nFounder, Center Estates"
                ),
            },
            {
                'step_number': 2,
                'title': 'Follow-Up: Transparent Procurement Audit Trail',
                'delay_days': 4,
                'subject_template': 'Re: Tender evaluation & contractor bids for {{company_name}}',
                'body_template': (
                    "Hi {{first_name}},\n\n"
                    "Touching base on contractor procurement. The platform also logs a tamper-proof audit trail for stakeholder "
                    "and board transparency, ensuring every award decision is backed by clear scoring criteria.\n\n"
                    "Let me know if you have 10 mins to see it: {{booking_url}}\n\n"
                    "Best,\nFounder, Center Estates"
                ),
            },
            {
                'step_number': 3,
                'title': 'Breakup Touch',
                'delay_days': 8,
                'subject_template': 'Closing tender discussion — {{company_name}}',
                'body_template': (
                    "Hi {{first_name}},\n\n"
                    "I will pause follow-ups here. If tender automation becomes relevant in the future, visit https://centerestates.com/tender.\n\n"
                    "Best,\nFounder, Center Estates"
                ),
            },
        ],
    },
    {
        'name': 'Off-Plan Real Estate Sales & Buyer Installment CRM',
        'target_module': 'sales',
        'target_icp': 'Residential Housing Developers selling off-plan apartments, Land Buying & Subdivision Companies.',
        'pain_points': 'Lost buyer inquiries, untracked payment installments, delayed milestone demand letters, manual reservation receipts.',
        'value_proposition': 'Buyer pipeline CRM, automated milestone installment tracking, buyer self-service portal, and real-time payment reconciliation.',
        'booking_url': 'https://centerestates.com/demo',
        'daily_send_limit': 50,
        'steps': [
            {
                'step_number': 1,
                'title': 'Acute Pain Hook: Eliminating Buyer Installment Defaults',
                'delay_days': 0,
                'subject_template': 'Tracking buyer installments for {{company_name}} off-plan projects',
                'body_template': (
                    "Hi {{first_name}},\n\n"
                    "Selling off-plan units or land subdivisions often creates cash-flow headaches when buyers fall behind "
                    "on their installment schedules without proactive tracking.\n\n"
                    "Center Estates gives developers a specialized sales CRM: unit reservation locking, automated milestone installment reminders, "
                    "instant payment verification, and a self-service buyer portal.\n\n"
                    "Could I show you a 5-minute walkthrough of the buyer installment engine? {{booking_url}}\n\n"
                    "Best regards,\nFounder, Center Estates"
                ),
            },
            {
                'step_number': 2,
                'title': 'Follow Up: 3D Listing Renders & Portal',
                'delay_days': 3,
                'subject_template': 'Re: Tracking buyer installments for {{company_name}} off-plan projects',
                'body_template': (
                    "Hi {{first_name}},\n\n"
                    "Following up. In addition to installment tracking, the platform includes a buyer portal with interactive 3D floor plans "
                    "and instant statement downloads, which buyers love.\n\n"
                    "Would Wednesday afternoon work for a quick look? {{booking_url}}\n\n"
                    "Best,\nFounder, Center Estates"
                ),
            },
            {
                'step_number': 3,
                'title': 'Breakup Touch',
                'delay_days': 7,
                'subject_template': 'Sales CRM for {{company_name}}',
                'body_template': (
                    "Hi {{first_name}},\n\n"
                    "Assuming off-plan sales tracking is running smoothly at {{company_name}}.\n\n"
                    "Feel free to check out https://centerestates.com/sales whenever you launch your next development.\n\n"
                    "Best regards,\nFounder, Center Estates"
                ),
            },
        ],
    },
]

SEED_PROSPECTS = [
    {
        'company_name': 'Knight Frank Kenya',
        'website': 'https://www.knightfrank.co.ke',
        'contact_name': 'Mark Dunford',
        'job_title': 'Managing Director',
        'email': 'mark.dunford@ke.knightfrank.com',
        'phone': '+254204239000',
        'city': 'Nairobi',
        'country': 'Kenya',
        'target_module': 'property',
        'fit_score': 96,
        'fit_reasoning': 'High-profile commercial & sectional portfolio manager with high billing volume across Nairobi CBD & Westlands.',
        'status': 'qualified',
        'notes': 'Manages top prime office towers; major target for consolidated tenant utility billing.',
    },
    {
        'company_name': 'Broll Property Group Kenya',
        'website': 'https://broll.co.ke',
        'contact_name': 'Peter Small',
        'job_title': 'Head of Property & Asset Management',
        'email': 'psmall@broll.co.ke',
        'phone': '+254709848000',
        'city': 'Nairobi',
        'country': 'Kenya',
        'target_module': 'facility',
        'fit_score': 94,
        'fit_reasoning': 'Regional institutional facility & estate manager needing SLA monitoring and preventative PPM tracking.',
        'status': 'qualified',
        'notes': 'Manages large commercial business parks and corporate headquarters.',
    },
    {
        'company_name': 'Regent Management Limited',
        'website': 'https://regent-mgt.com',
        'contact_name': 'David Mwangi',
        'job_title': 'Operations Director',
        'email': 'dmwangi@regent-mgt.com',
        'phone': '+254722880000',
        'city': 'Nairobi',
        'country': 'Kenya',
        'target_module': 'property',
        'fit_score': 92,
        'fit_reasoning': 'Large residential and commercial agency managing extensive sectional title schemes in Upper Hill and Kilimani.',
        'status': 'qualified',
        'notes': 'Sectional title body corporate accounting and service charge collection is their primary operational bottleneck.',
    },
    {
        'company_name': 'HassConsult Real Estate',
        'website': 'https://hassconsult.co.ke',
        'contact_name': 'Farhana Hassanali',
        'job_title': 'Head of Development Consulting & Sales',
        'email': 'fhassanali@hassconsult.co.ke',
        'phone': '+254724222000',
        'city': 'Nairobi',
        'country': 'Kenya',
        'target_module': 'sales',
        'fit_score': 95,
        'fit_reasoning': 'Premier off-plan development sales agency handling multi-unit residential towers with structured installment plans.',
        'status': 'qualified',
        'notes': 'Ideal fit for the Sales CRM module with installment schedules and buyer self-service portals.',
    },
    {
        'company_name': 'Crystal Valuers Limited',
        'website': 'https://crystalvaluers.com',
        'contact_name': 'Patrick Odera',
        'job_title': 'Principal Valuation Surveyor',
        'email': 'podera@crystalvaluers.com',
        'phone': '+254720123456',
        'city': 'Nairobi',
        'country': 'Kenya',
        'target_module': 'valuation',
        'fit_score': 91,
        'fit_reasoning': 'Leading valuation consultancy on major commercial bank panels conducting mortgage and asset appraisals.',
        'status': 'qualified',
        'notes': 'Needs comparable sales indexing and rapid standardized valuation report generation.',
    },
    {
        'company_name': 'Mentor Management Limited (MML Turner & Townsend)',
        'website': 'https://turnerandtownsend.com',
        'contact_name': 'James Hoddell',
        'job_title': 'Project Director',
        'email': 'jhoddell@mml.co.ke',
        'phone': '+254203740000',
        'city': 'Nairobi',
        'country': 'Kenya',
        'target_module': 'construction',
        'fit_score': 93,
        'fit_reasoning': 'Top-tier project management and quantity surveying firm managing mega commercial and industrial building sites.',
        'status': 'qualified',
        'notes': 'Key prospect for Interim Payment Certificate (IPC) verification and live BOQ cost control.',
    },
]
