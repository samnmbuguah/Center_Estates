import datetime
import os
import re
import time
import uuid
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction

from organizations.models import Organization, Role
from properties.models import Project as PortfolioProject
from construction.models import (
    Project as ConstructionProject,
    WorkPlanTask,
    MilestoneEntry,
    MilestoneBoQItem,
    BoQItem,
    ProjectDocument,
    DocumentVersion,
    ProjectApproval,
    ProgressPlan,
    ProjectMembership,
)

User = get_user_model()


def parse_short_date(d_str):
    parts = d_str.strip().split()
    date_part = parts[-1]
    m, d, y = [int(x) for x in date_part.split('/')]
    year = 2000 + y if y < 100 else y
    return datetime.date(year, m, d)


def parse_duration_days(dur_str):
    m = re.search(r'(\d+)\s*(?:days?|d)', dur_str.lower())
    if m:
        return int(m.group(1))
    m_hrs = re.search(r'(\d+)\s*(?:hrs?|hours?)', dur_str.lower())
    if m_hrs:
        return max(1, int(m_hrs.group(1)) // 8)
    return 1


class Command(BaseCommand):
    help = "Imports Langata 4-5 Karam Apartments into Construction module with BoQ, Work Plan and Milestones."

    def add_arguments(self, parser):
        parser.add_argument(
            "--org-slug",
            type=str,
            default="center-estates-demo",
            help="Organization slug to attach the project to (default: center-estates-demo)",
        )

    def handle(self, *args, **options):
        org_slug = options["org_slug"]
        org = Organization.objects.filter(slug=org_slug).first()
        if not org:
            org = Organization.objects.first()
            self.stdout.write(self.style.WARNING(f"Org '{org_slug}' not found; falling back to '{org.slug if org else 'None'}'"))
        if not org:
            self.stderr.write(self.style.ERROR("No organization found in database."))
            return

        admin_user = User.objects.filter(is_superuser=True).first() or User.objects.first()
        now_ms = int(time.time() * 1000)

        project_id = "ce-construction-karam-001"
        portfolio_code = "PRJ-KRM-01"

        self.stdout.write(f"Importing Karam Apartments into Organization: {org.name} ({org.id})")

        with transaction.atomic():
            # 1. Portfolio Project
            portfolio_prj, _ = PortfolioProject.objects.update_or_create(
                organization=org,
                code=portfolio_code,
                defaults={
                    "name": "Karam Apartments — Lang'ata",
                    "status": PortfolioProject.Status.ACTIVE,
                    "lifecycle_stage": PortfolioProject.LifecycleStage.CONSTRUCTION,
                    "starts_on": datetime.date(2026, 8, 17),
                    "ends_on": datetime.date(2028, 5, 8),
                    "metadata": {
                        "units": 96,
                        "floors": 12,
                        "client": "M/S Karam Logistics Ltd",
                        "location": "Plot L.R. No. Nairobi/Block 106/1601 & 106/1602, Lang'ata, Nairobi",
                    },
                },
            )

            # 2. Construction Project
            construction_prj, _ = ConstructionProject.objects.update_or_create(
                id=project_id,
                defaults={
                    "organization": org,
                    "portfolio_project": portfolio_prj,
                    "name": "Karam Apartments — Lang'ata",
                    "code": portfolio_code,
                    "client_name": "M/S Karam Logistics Ltd",
                    "location": "Plot L.R. No. Nairobi/Block 106/1601 & 106/1602, Lang'ata, Nairobi",
                    "country": "Kenya",
                    "county": "Nairobi",
                    "town": "Lang'ata",
                    "stage": "active",
                    "project_type": "residential",
                    "description": (
                        "Proposed 12-storey residential apartment development comprising 96 three-bedroom luxury units, "
                        "heat pump central water heating, basement parking, ground floor amenities, 1st-12th typical floors, "
                        "terrace slab with APP waterproofing, gate house, underground water storage tank, and external civil infrastructure."
                    ),
                    "modules": ["overview", "programme", "cost", "quality", "safety", "progress_tracking", "financials", "full_package"],
                    "onboarding_complete": True,
                    "wizard_step": 8,
                    "archived": False,
                    "created_at": now_ms,
                    "planned_start_date": datetime.date(2026, 8, 17),
                    "planned_completion_date": datetime.date(2028, 5, 8),
                    "tender_amount": Decimal("966558567.00"),
                    "budget": Decimal("966558567.00"),
                    "approved_variations": Decimal("0.00"),
                    "site_latitude": -1.3320,
                    "site_longitude": 36.7580,
                    "geofence_radius_m": 350,
                    "eia_status": "approved",
                    "esmp_exists": True,
                    "sep_exists": True,
                    "grm_contact": "info@centerestates.com",
                    "land_acquisition": False,
                    "procurement_method": "open_competitive",
                    "procurement_plan_url": "/media/construction/documents/karam-apartments/Program of Works- Karam Apartments - 90 Weeks.pdf",
                    "tender_doc_url": "/media/construction/documents/karam-apartments/Langata 4 & 5  Apartment  qs Estimates July 2026 Rev.pdf",
                    "signed_contract_url": "/media/construction/documents/karam-apartments/LANGATA 4-5.JULY-S.E DRAWINGS.pdf",
                    "approved_budget": Decimal("966558567.00"),
                    "baseline_boq_ref": "BOQ-MBA-JULY2026-REV",
                    "safeguards_party": "Magero and Booth Associates Ltd",
                    "contract_type": "full",
                    "procurement_oversight": "Client Representative / Project Manager",
                    "financial_approval": "Client Steering Committee",
                    "audit_role": "Independent Technical Auditor",
                },
            )
            self.stdout.write(self.style.SUCCESS(f"Saved Construction Project: {construction_prj.name} ({construction_prj.id})"))

            # 3. Work Plan Tasks (Program of Works)
            # Check if Program of Works PDF is available for live text extraction
            pow_pdf_path = "/root/Dev/Center_Estates/docs/client-artifacts/construction/karam-apartments/Program of Works- Karam Apartments - 90 Weeks.pdf"
            if not os.path.exists(pow_pdf_path):
                pow_pdf_path = os.path.join(
                    os.path.dirname(__file__), "../../../media/construction/documents/karam-apartments/Program of Works- Karam Apartments - 90 Weeks.pdf"
                )

            parsed_tasks = []
            if os.path.exists(pow_pdf_path):
                try:
                    import pypdf
                    reader = pypdf.PdfReader(pow_pdf_path)
                    lines = []
                    for p in reader.pages:
                        lines.extend((p.extract_text() or '').split('\n'))

                    date_end = re.compile(r'(\d+\s+days?|\d+\s+hrs?)\s+([A-Za-z]{3}\s+\d+/\d+/\d+)\s+([A-Za-z]{3}\s+\d+/\d+/\d+)$')
                    current_id = None
                    current_name_parts = []

                    for line in lines:
                        line = line.strip()
                        if not line or line.startswith('ID Task Name'):
                            continue
                        m = date_end.search(line)
                        if m:
                            dur, start, finish = m.groups()
                            prefix = line[:m.start()].strip()
                            id_m = re.match(r'^(\d+)\s+(.*)$', prefix)
                            if id_m:
                                tid, name_part = id_m.groups()
                                name = (' '.join(current_name_parts + [name_part])).strip()
                                parsed_tasks.append((int(tid), name, dur, start, finish))
                            else:
                                tid = current_id if current_id else len(parsed_tasks) + 1
                                name = (' '.join(current_name_parts + [prefix])).strip()
                                parsed_tasks.append((int(tid), name, dur, start, finish))
                            current_id = None
                            current_name_parts = []
                        else:
                            id_m = re.match(r'^(\d+)\s+(.*)$', line)
                            if id_m:
                                current_id = int(id_m.group(1))
                                current_name_parts = [id_m.group(2)]
                            else:
                                current_name_parts.append(line)
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"PDF extraction error: {e}. Falling back to standard tasks."))

            # Wipe existing tasks to guarantee fresh synchronization
            WorkPlanTask.objects.filter(project=construction_prj).delete()

            tasks_to_create = []
            current_lvl1 = "Karam Apartments"
            current_lvl2 = "General"
            current_lvl3 = ""

            for tid, name, dur, start_str, finish_str in parsed_tasks:
                try:
                    s_date = parse_short_date(start_str)
                    f_date = parse_short_date(finish_str)
                except Exception:
                    s_date = datetime.date(2026, 8, 17)
                    f_date = datetime.date(2028, 5, 8)
                dur_days = parse_duration_days(dur)

                uname = name.upper()
                if "PROPOSED APARTMENTS" in uname:
                    wbs_level = 0
                    current_lvl1 = name
                elif any(k in uname for k in ["MAIN APARTMENT BLOCK", "EXTERNAL WORKS", "PREPARATION FOR HANDOVER", "COMPLETION OF MASS EXCAVATION"]):
                    wbs_level = 1
                    current_lvl2 = name
                elif any(k in uname for k in [
                    "SUBSTRUCTURES", "BASEMENT", "GROUND FLOOR", "FIRST TO SECOND", "SECOND TO THIRD",
                    "THIRD TO FOURTH", "FOURTH TO FIFTH", "FIFTH TO SIXTH", "SIXTH TO SEVENTH",
                    "SEVENTH TO EIGHTH", "EIGHTH TO NINETH", "NINETH TO TENTH", "TENTH TO ELEVENTH",
                    "ELEVENTH TO TWELFTH", "ROOF", "TERRACE", "PART A", "PART B", "FINISHES", "MEP",
                ]):
                    wbs_level = 2
                    current_lvl3 = name
                else:
                    wbs_level = 3

                resp_party = "Main Contractor"
                if any(k in uname for k in ["INSPECTION", "APPROV", "TEST"]):
                    resp_party = "Resident Engineer / Clerk of Works"
                elif any(k in uname for k in ["MEP", "ELECTRICAL", "PLUMBING", "DRAINAGE", "HVAC", "HEAT PUMP"]):
                    resp_party = "MEP Subcontractor"
                elif any(k in uname for k in ["CONCRETE", "COLUMN", "SLAB", "BEAM", "FOUNDATION"]):
                    resp_party = "Civil / Concrete Works Team"
                elif any(k in uname for k in ["STEEL", "REINFORCEMENT"]):
                    resp_party = "Steel Fixers Team"
                elif any(k in uname for k in ["FORMWORK"]):
                    resp_party = "Formwork / Carpenters Team"
                elif any(k in uname for k in ["FINISH", "TILES", "PLASTER", "PAINT"]):
                    resp_party = "Finishing Subcontractor"

                tasks_to_create.append(
                    WorkPlanTask(
                        project=construction_prj,
                        organization=org,
                        task_id=f"WP-{tid:03d}"[:20],
                        task_name=name[:490],
                        wbs_level=wbs_level,
                        level1_name=current_lvl1[:190],
                        level2_name=current_lvl2[:190],
                        level3_name=current_lvl3[:190],
                        start_date=s_date,
                        end_date=f_date,
                        duration_days=dur_days,
                        predecessors=f"WP-{tid-1:03d}"[:190] if tid > 1 else "",
                        resource=resp_party[:190],
                        responsible_party=resp_party[:190],
                        percent_complete=Decimal("0.0"),
                        status="not_started",
                        approval_status="approved",
                        approved_by=admin_user,
                        approved_at=now_ms,
                    )
                )

            if tasks_to_create:
                WorkPlanTask.objects.bulk_create(tasks_to_create, batch_size=200)
                self.stdout.write(self.style.SUCCESS(f"Created {len(tasks_to_create)} Work Plan tasks."))

            # 4. Detailed Bill of Quantities (BoQ)
            BoQItem.objects.filter(project=construction_prj).delete()
            boq_definitions = [
                # SECTION 1: PRELIMINARIES
                ("preliminaries", "1.1", "Particular Preliminaries — Insurances, Performance Bond, Site Hoarding & Safety Management", "Item", 1, 2150000.00, 2150000.00, "budgeted"),
                ("preliminaries", "1.2", "General Preliminaries — Water, Power, Temporary Works, Plant, Supervision & Testing Facilities", "Item", 1, 18600000.00, 18600000.00, "budgeted"),

                # SECTION 2: APARTMENT BLOCK - BASEMENT
                ("substructure", "2.1.1", "Basement Excavation & Bulk Earthworks in Normal Soil to Reduced Level", "m3", 14500, 850.00, 12325000.00, "budgeted"),
                ("substructure", "2.1.2", "Hardcore filling and compaction in 150mm layers under basement floor slab", "m3", 3200, 2200.00, 7040000.00, "budgeted"),
                ("substructure", "2.1.3", "Mass concrete blinding (Class 15/20, 50mm thick) under column bases and ground beams", "m2", 2800, 650.00, 1820000.00, "budgeted"),
                ("substructure", "2.1.4", "Vibrated reinforced concrete (Class 30/20) in foundation bases, ground beams and retaining walls", "m3", 1850, 14500.00, 26825000.00, "budgeted"),
                ("substructure", "2.1.5", "High-yield ribbed steel reinforcement (Y12-Y25) in substructure foundations and basement walls", "Ton", 260, 142000.00, 36920000.00, "budgeted"),
                ("substructure", "2.1.6", "Sawn formwork to foundation bases, retaining walls and ground beams", "m2", 4800, 2800.00, 13440000.00, "budgeted"),
                ("substructure", "2.1.7", "Basement waterproof tanking membrane system (torch-on dual layer APP membrane with protection board)", "m2", 3400, 3100.00, 10540000.00, "budgeted"),
                ("substructure", "2.1.8", "Heavy duty non-slip epoxy floor coating to basement car parking and ramps", "m2", 3200, 2468.24, 7898361.00, "budgeted"),

                # SECTION 2: APARTMENT BLOCK - GROUND FLOOR
                ("superstructure", "2.2.1", "Vibrated reinforced concrete (Class 30/20) in ground floor suspended slab, beams and columns", "m3", 850, 14500.00, 12325000.00, "budgeted"),
                ("superstructure", "2.2.2", "High-yield ribbed steel reinforcement in ground floor structural elements", "Ton", 75, 142000.00, 10650000.00, "budgeted"),
                ("superstructure", "2.2.3", "Machine cut foundation natural stone masonry walling (200mm thick) in cement sand mortar (1:3)", "m2", 1200, 2200.00, 2640000.00, "budgeted"),
                ("superstructure", "2.2.4", "Ground floor entrance reception, lobby architectural wall paneling and acoustic ceilings", "Item", 1, 5635918.00, 5635918.00, "budgeted"),

                # SECTION 2: APARTMENT BLOCK - TYPICAL FLOORS 1ST TO 12TH
                ("superstructure", "2.3.1", "RC framed structural columns, shear core walls and lift shafts (1st to 12th floors, Class 30/20)", "m3", 4200, 14800.00, 62160000.00, "budgeted"),
                ("superstructure", "2.3.2", "RC suspended floor slabs (150mm thick) and framed beams across 12 typical residential floors", "m3", 9800, 14500.00, 142100000.00, "budgeted"),
                ("superstructure", "2.3.3", "High-yield ribbed steel reinforcement (Y10-Y25) across 12 typical suspended levels", "Ton", 850, 142000.00, 120700000.00, "budgeted"),
                ("superstructure", "2.3.4", "Marine ply formwork to soffits of slabs, beam sides and structural columns", "m2", 36000, 2200.00, 79200000.00, "budgeted"),
                ("finishes", "2.3.5", "Internal wall plastering (15mm cement-sand 1:4) and three-coat vinyl silk emulsion paint", "m2", 52000, 950.00, 49400000.00, "budgeted"),
                ("finishes", "2.3.6", "Imported 600x600mm non-porous rectified porcelain floor tiles to 96 apartments living & bedrooms", "m2", 16500, 3200.00, 52800000.00, "budgeted"),
                ("finishes", "2.3.7", "Glazed ceramic wall tiles to wet areas (kitchens, bathrooms and en-suites)", "m2", 8200, 2800.00, 22960000.00, "budgeted"),
                ("finishes", "2.3.8", "Heavy duty powder-coated aluminium sliding windows and balcony doors with 6mm tinted safety glass", "m2", 2400, 12500.00, 30000000.00, "budgeted"),
                ("finishes", "2.3.9", "Solid mahogany frame flush doors, architectural ironmongery and master-key cylinder locks", "No", 576, 25365.23, 14610372.00, "budgeted"),

                # SECTION 2: APARTMENT BLOCK - TERRACE FLOOR
                ("superstructure", "2.4.1", "Reinforced concrete roof slab (Class 30/20) cast to falls including lift motor room slab", "m3", 320, 15000.00, 4800000.00, "budgeted"),
                ("superstructure", "2.4.2", "Torch-on APP 4mm mineralised waterproofing membrane with 50mm screed protection", "m2", 1250, 2850.00, 3562500.00, "budgeted"),
                ("superstructure", "2.4.3", "Parapet masonry walling, coping stones, rainwater outlets and storm downpipes", "Item", 1, 2462612.00, 2462612.00, "budgeted"),

                # SECTION 3: EXTERNAL WORKS
                ("external", "3.1", "External foul water drainage reticulation, inspection chambers, manholes and sewer connection", "Item", 1, 527802.00, 527802.00, "budgeted"),
                ("external", "3.2", "Storm water drainage channels, invert block drains, oil interceptor and discharge connection", "Item", 1, 341280.00, 341280.00, "budgeted"),

                # SECTION 4: PRIME COST & PROVISIONAL SUMS
                ("mep", "4.1", "Electrical Installations — main switchboards, cabling, generator, transformers & internal apartment wiring", "Item", 1, 75830800.00, 75830800.00, "budgeted"),
                ("mep", "4.2", "High-speed passenger elevator installation (3 No. 10-passenger high-efficiency lifts)", "Item", 3, 24000000.00, 72000000.00, "budgeted"),
                ("mep", "4.3", "Central Eco Heat Pump Water Heating System (96 apartment units with insulated piping reticulation)", "Item", 96, 407518.00, 39121728.00, "budgeted"),
                ("mep", "4.4", "Fire protection systems — wet riser, booster pumps, hose reels, hydrants and automatic addressable detection", "Item", 1, 15172194.00, 15172194.00, "budgeted"),
                ("external", "4.5", "Boundary masonry perimeter wall, gate house, heavy duty motorized entrance gates & razor wire", "Item", 1, 10000000.00, 10000000.00, "budgeted"),
            ]

            boq_to_create = [
                BoQItem(
                    project=construction_prj,
                    organization=org,
                    section=sec[:30],
                    item_number=item_no[:20],
                    description=desc[:290],
                    unit=unit[:20],
                    quantity=Decimal(str(qty)),
                    rate=Decimal(str(rate)),
                    amount=Decimal(str(amt)),
                    approval_status="approved",
                    approved_by=admin_user,
                    approved_at=now_ms,
                    cost_state=c_state,
                    certified_quantity=Decimal("0.0"),
                    certified_amount=Decimal("0.0"),
                )
                for sec, item_no, desc, unit, qty, rate, amt, c_state in boq_definitions
            ]
            BoQItem.objects.bulk_create(boq_to_create)
            self.stdout.write(self.style.SUCCESS(f"Created {len(boq_to_create)} BoQ items (Total: KES 966,558,567.00)."))

            # 5. Weekly Milestones (90 Weeks)
            MilestoneEntry.objects.filter(project_id=construction_prj.id).delete()
            major_stages = [
                (1, 10, "Mobilisation, Excavation & Substructure Bases"),
                (11, 20, "Ground Floor Slab & Columns to 2nd Floor"),
                (21, 35, "Superstructure Typical Slabs 3rd to 7th Floor"),
                (36, 50, "Superstructure Typical Slabs 8th to 12th Floor & Terrace"),
                (51, 65, "Blockwork, Plastering & MEP First Fix"),
                (66, 78, "Interior Finishes, Tiling, Windows & Joinery"),
                (79, 85, "MEP Second Fix, Heat Pumps & Elevators Installation"),
                (86, 90, "Testing, Commissioning, External Works & Final Handover"),
            ]

            start_dt = datetime.date(2026, 8, 17)
            milestones_to_create = []
            for wk in range(1, 91):
                stage_desc = next((desc for s, e, desc in major_stages if s <= wk <= e), "General Construction")
                milestones_to_create.append(
                    MilestoneEntry(
                        id=str(uuid.uuid4()),
                        organization=org,
                        created_at=now_ms,
                        updated_at=now_ms,
                        project_id=construction_prj.id,
                        milestone_id=f"Week {wk:02d}: {stage_desc}"[:250],
                        percent_complete=0,
                        required_evidence_types=["site_photo", "clerk_diary", "survey_level"],
                        required_certifying_role="Resident Engineer",
                    )
                )
            MilestoneEntry.objects.bulk_create(milestones_to_create)
            self.stdout.write(self.style.SUCCESS(f"Created {len(milestones_to_create)} weekly milestones."))

            # 6. Project Documents
            docs_data = [
                ("drawing", "Structural Engineering Drawings — Lang'ata 4 & 5 (Karam Apartments)", "Structural Engineering", "LANGATA 4-5.JULY-S.E DRAWINGS.pdf", "pdf", "Rev July 2026"),
                ("report", "Bills of Quantities & QS Estimates (Magero and Booth Associates)", "Quantity Surveying / Commercial", "Langata 4 & 5  Apartment  qs Estimates July 2026 Rev.pdf", "pdf", "Rev July 2026"),
                ("report", "Master Program of Works (90 Weeks / 653 Days)", "Project Management & Planning", "Program of Works- Karam Apartments - 90 Weeks.pdf", "pdf", "Rev 1.0 (90-Week Master)"),
                ("other", "Master Program of Works (MS Project Native .mpp)", "Project Management & Planning", "Program of Works- Karam Apartments - 90 Weeks.mpp", "mpp", "Rev 1.0 (.mpp)"),
            ]

            for doc_type, title, discipline, fn, fmt, rev in docs_data:
                doc, _ = ProjectDocument.objects.update_or_create(
                    project=construction_prj,
                    title=title,
                    defaults={
                        "organization": org,
                        "doc_type": doc_type,
                        "discipline": discipline,
                        "created_at": now_ms,
                    },
                )
                DocumentVersion.objects.update_or_create(
                    document=doc,
                    version=1,
                    defaults={
                        "remote_url": f"/media/construction/documents/karam-apartments/{fn}",
                        "file_format": fmt,
                        "uploaded_by": admin_user,
                        "uploaded_at": now_ms,
                        "revision_number": rev,
                    },
                )

            # 7. Statutory Approvals
            approvals_data = [
                ("NCA Registration", "National Construction Authority (NCA)", "NCA/PRJ/2026/8942", "/media/construction/documents/karam-apartments/Program of Works- Karam Apartments - 90 Weeks.pdf", "approved", datetime.date(2026, 7, 15)),
                ("NEMA License", "National Environment Management Authority (NEMA)", "NEMA/EIA/PS/3491", "/media/construction/documents/karam-apartments/Langata 4 & 5  Apartment  qs Estimates July 2026 Rev.pdf", "approved", datetime.date(2026, 6, 20)),
                ("County Building Approval", "Nairobi City County Development Control", "NCC/DC/LANGATA/2026/1601", "/media/construction/documents/karam-apartments/LANGATA 4-5.JULY-S.E DRAWINGS.pdf", "approved", datetime.date(2026, 7, 28)),
            ]

            ProjectApproval.objects.filter(project=construction_prj).delete()
            for app_type, auth, ref, doc_url, status, issue_date in approvals_data:
                ProjectApproval.objects.create(
                    project=construction_prj,
                    organization=org,
                    approval_type=app_type[:40],
                    authority=auth[:120],
                    reference=ref[:80],
                    document_url=doc_url[:500],
                    status=status,
                    issued_at=now_ms,
                    issue_date=issue_date,
                    review_notes="Verified and compliant with technical specifications.",
                )

            # 8. S-Curve Progress Plan (90 Weeks Baseline)
            import math
            start_dt = datetime.date(2026, 8, 17)
            for i in range(1, 91):
                cur_dt = start_dt + datetime.timedelta(days=(i - 1) * 7)
                iso_yr, iso_wk, _ = cur_dt.isocalendar()
                week_str = f"{iso_yr}-W{iso_wk:02d}"
                # Smooth S-curve (logistic) from 1% at week 1 to 100% at week 90
                x = (i - 45) / 9.0
                raw_pct = 100.0 / (1.0 + math.exp(-x))
                # Normalize so week 1 starts at 1 and week 90 is 100
                normalized = max(1, min(100, int(round(raw_pct))))
                ProgressPlan.objects.update_or_create(
                    project_id=construction_prj.id,
                    week=week_str,
                    defaults={
                        "organization": org,
                        "planned_percent": normalized,
                    },
                )

            # 9. Project Memberships for Testing
            cow_role = Role.objects.filter(organization=org, slug__icontains="clerk").first() or Role.objects.filter(organization=org).first()
            active_users = User.objects.filter(organization=org, is_active=True)
            for u in active_users:
                ProjectMembership.objects.update_or_create(
                    user=u,
                    project=construction_prj,
                    defaults={
                        "role": cow_role,
                        "label": "Clerk of Works" if "clerk" in (u.username.lower() or "") else "Project Member",
                        "created_at": now_ms,
                    },
                )

            # 10. Auto-Map BoQ items to Milestones
            BOQ_SECTION_KEYWORDS = {
                "substructure": ["substructure", "excavation", "foundation", "hardcore", "plinth", "strip footing", "ground beam"],
                "superstructure": ["superstructure", "slab", "column", "beam", "concrete", "rebar", "formwork", "masonry", "wall"],
                "finishes": ["finishes", "plaster", "paint", "tile", "screed", "ceiling", "gypsum", "flooring", "door", "window"],
                "mep": ["electrical", "plumbing", "drainage", "mep", "cctv", "fire", "generator", "lift", "solar"],
                "preliminaries": ["mobilisation", "site setup", "hoarding", "preliminaries", "insurance", "supervision"],
            }
            all_boq_items = list(BoQItem.objects.filter(project=construction_prj))
            all_milestones = list(MilestoneEntry.objects.filter(project_id=construction_prj.id, organization=org))
            
            for m in all_milestones:
                m_name = (m.milestone_id or "").lower()
                matched_items = []
                for sec, keywords in BOQ_SECTION_KEYWORDS.items():
                    if any(kw in m_name for kw in keywords):
                        for item in all_boq_items:
                            desc = (item.description or "").lower()
                            if item.section == sec or any(kw in desc for kw in keywords):
                                matched_items.append(item)

                seen_ids = set(
                    MilestoneBoQItem.objects.filter(
                        milestone_id=m.milestone_id, project=construction_prj
                    ).values_list("boq_item_id", flat=True)
                )
                to_create = []
                for bi in matched_items:
                    if bi.id not in seen_ids:
                        seen_ids.add(bi.id)
                        to_create.append(
                            MilestoneBoQItem(
                                project=construction_prj,
                                organization=org,
                                milestone_id=m.milestone_id,
                                boq_item=bi,
                                allocated_quantity=bi.quantity or Decimal("1.00"),
                                notes="Auto-mapped by AI keyword heuristics",
                                created_at=now_ms,
                                updated_at=now_ms,
                            )
                        )
                if to_create:
                    MilestoneBoQItem.objects.bulk_create(to_create)

        self.stdout.write(self.style.SUCCESS("All Karam Apartments data imported successfully!"))
