"""Comprehensive Seeder for Center Estates Sales Storefront.

Populates high-resolution curated architectural imagery, diverse property categories
(Villas, Apartments, Studios, Commercial, Land), project profiles, and unit renders
so the public storefront displays rich, real-world real estate inventory.
"""
from decimal import Decimal
import random

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from organizations.models import Organization
from properties.models import Building, Project, Property, Unit
from construction.models import Project as ConstructionProject
from sales.models import ListingRender, SaleListing


class Command(BaseCommand):
    help = "Seeds comprehensive property listings, renders, and categories for Center Estates storefront."

    def add_arguments(self, parser):
        parser.add_argument(
            "--org",
            default="center-estates-demo",
            help="Organization slug to seed sales data for (default: center-estates-demo)",
        )

    def handle(self, *args, **options):
        slug = options["org"]
        org = Organization.objects.filter(slug=slug).first()
        if not org:
            self.stdout.write(self.style.ERROR(f"Organization '{slug}' not found."))
            return

        self.stdout.write(f"Seeding rich storefront listings for {org.name} ({org.slug})...")

        with transaction.atomic():
            self._seed_storefront_data(org)

        self.stdout.write(self.style.SUCCESS("Successfully seeded comprehensive storefront data!"))

    def _seed_storefront_data(self, org):
        seeded_listing_ids = []
        # 1. Properties & Developments Catalog
        catalog = [
            {
                "prop_code": "CE-NRB-002",
                "prop_name": "Kilimani Heights Residences",
                "prop_type": "Residential",
                "city": "Nairobi",
                "address": "Kindaruma Road, Kilimani, Nairobi",
                "is_sectional": True,
                "scheme_reg": "ST/NRB/2024/089",
                "building_code": "BLOCK-A",
                "building_name": "Kilimani Heights — Tower A",
                "floors": 14,
                "project_code": "PRJ-SE-03",
                "project_name": "Kilimani Heights Residences — Sales Program",
                "project_stage": "sales",
                "description": (
                    "Executive sectional-title urban development offering contemporary 1, 2, and 3 bedroom "
                    "apartments plus premium sky penthouses in Kilimani. Features rooftop infinity pool, fully equipped "
                    "gym, high-speed panoramic lifts, borehole water supply, full backup generator, and smart access control."
                ),
                "units": [
                    {
                        "code": "A-101",
                        "type": "2 Bedroom",
                        "floor": "1",
                        "area": Decimal("118.00"),
                        "price": Decimal("16500000"),
                        "deposit": Decimal("15"),
                        "progress": Decimal("85"),
                        "status": SaleListing.Status.AVAILABLE,
                        "featured": True,
                        "renders": [
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80", "title": "Tower A Exterior Elevation", "primary": True},
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80", "title": "Living & Dining Area", "primary": False},
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80", "title": "Fitted European Kitchen", "primary": False},
                            {"kind": "floorplan", "url": "https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=1200&q=80", "title": "2-Bed Type A Floor Plan", "primary": False},
                        ],
                    },
                    {
                        "code": "A-201",
                        "type": "3 Bedroom",
                        "floor": "2",
                        "area": Decimal("168.00"),
                        "price": Decimal("24500000"),
                        "deposit": Decimal("20"),
                        "progress": Decimal("85"),
                        "status": SaleListing.Status.AVAILABLE,
                        "featured": True,
                        "renders": [
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80", "title": "Executive 3-Bed Balcony View", "primary": True},
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80", "title": "Spacious Master Suite", "primary": False},
                            {"kind": "floorplan", "url": "https://images.unsplash.com/photo-1574958269340-fa927304f208?auto=format&fit=crop&w=1200&q=80", "title": "3-Bed Type B Layout", "primary": False},
                        ],
                    },
                    {
                        "code": "A-PH1",
                        "type": "Apartment",
                        "floor": "14",
                        "area": Decimal("320.00"),
                        "price": Decimal("48000000"),
                        "deposit": Decimal("20"),
                        "progress": Decimal("85"),
                        "status": SaleListing.Status.AVAILABLE,
                        "featured": True,
                        "renders": [
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80", "title": "Sky Penthouse Lounge", "primary": True},
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80", "title": "Private Rooftop Deck", "primary": False},
                        ],
                    },
                ],
            },
            {
                "prop_code": "CE-NRB-004",
                "prop_name": "Karen Green Valley Villas",
                "prop_type": "Residential",
                "city": "Nairobi",
                "address": "Miotoni Road, Karen, Nairobi",
                "is_sectional": True,
                "scheme_reg": "ST/NRB/2024/112",
                "building_code": "VALLEY-VILLAS",
                "building_name": "Karen Green Valley Gated Enclave",
                "floors": 2,
                "project_code": "PRJ-KRN-01",
                "project_name": "Karen Green Valley — Exclusive Villas",
                "project_stage": "sales",
                "description": (
                    "A private enclave of 12 bespoke luxury villas set on half-acre landscaped gardens in prime Karen. "
                    "Each villa features 5 ensuite bedrooms, double-height living foyer, imported Italian kitchen, "
                    "private heated pool, detached staff quarters for two, solar hybrid power, and multi-tier security."
                ),
                "units": [
                    {
                        "code": "V-04",
                        "type": "Villa",
                        "floor": "1",
                        "area": Decimal("485.00"),
                        "price": Decimal("85000000"),
                        "deposit": Decimal("20"),
                        "progress": Decimal("90"),
                        "status": SaleListing.Status.AVAILABLE,
                        "featured": True,
                        "renders": [
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80", "title": "Villa Front Elevation & Pool", "primary": True},
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80", "title": "Grand Double-Height Foyer", "primary": False},
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=80", "title": "Master Bedroom Retreat", "primary": False},
                            {"kind": "floorplan", "url": "https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=1200&q=80", "title": "Architectural Villa Layout", "primary": False},
                        ],
                    },
                    {
                        "code": "V-07",
                        "type": "Villa",
                        "floor": "1",
                        "area": Decimal("520.00"),
                        "price": Decimal("92000000"),
                        "deposit": Decimal("20"),
                        "progress": Decimal("90"),
                        "status": SaleListing.Status.AVAILABLE,
                        "featured": True,
                        "renders": [
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80", "title": "Rear Garden & Verandah", "primary": True},
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80", "title": "Family Lounge", "primary": False},
                        ],
                    },
                ],
            },
            {
                "prop_code": "CE-NRB-005",
                "prop_name": "Parklands Horizon Suites",
                "prop_type": "Residential",
                "city": "Nairobi",
                "address": "4th Parklands Avenue, Nairobi",
                "is_sectional": True,
                "scheme_reg": "ST/NRB/2025/034",
                "building_code": "HORIZON-TOWER",
                "building_name": "Horizon Suites Block",
                "floors": 12,
                "project_code": "PRJ-PKL-01",
                "project_name": "Parklands Horizon — High-Yield Studios",
                "project_stage": "sales",
                "description": (
                    "High-yield purpose-built investment suites engineered for rental returns (projected 11-13% net ROI). "
                    "Fully serviced and furnished studios in close proximity to major medical facilities (Aga Khan University Hospital) "
                    "and UN diplomatic corridors. Managed turnkey letting and concierge desk."
                ),
                "units": [
                    {
                        "code": "ST-304",
                        "type": "Studio",
                        "floor": "3",
                        "area": Decimal("44.00"),
                        "price": Decimal("6200000"),
                        "deposit": Decimal("10"),
                        "progress": Decimal("95"),
                        "status": SaleListing.Status.AVAILABLE,
                        "featured": True,
                        "renders": [
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80", "title": "Furnished Executive Studio", "primary": True},
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80", "title": "Modern Compact Kitchenette", "primary": False},
                            {"kind": "floorplan", "url": "https://images.unsplash.com/photo-1574958269340-fa927304f208?auto=format&fit=crop&w=1200&q=80", "title": "Studio Floor Diagram", "primary": False},
                        ],
                    },
                    {
                        "code": "ST-508",
                        "type": "Studio",
                        "floor": "5",
                        "area": Decimal("48.00"),
                        "price": Decimal("6700000"),
                        "deposit": Decimal("10"),
                        "progress": Decimal("95"),
                        "status": SaleListing.Status.AVAILABLE,
                        "featured": False,
                        "renders": [
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80", "title": "Balcony Studio Suite", "primary": True},
                        ],
                    },
                ],
            },
            {
                "prop_code": "CE-NRB-001",
                "prop_name": "Westlands Business Centre",
                "prop_type": "Commercial",
                "city": "Nairobi",
                "address": "Chiromo Road, Westlands, Nairobi",
                "is_sectional": True,
                "scheme_reg": "ST/NRB/2023/045",
                "building_code": "TOWER-A",
                "building_name": "Westlands Business Tower A",
                "floors": 16,
                "project_code": "CE-REFURB-01",
                "project_name": "Tower A Commercial Suites",
                "project_stage": "sales",
                "description": (
                    "Grade-A commercial office suites in Nairobi's premier financial and corporate district. "
                    "Floor plates with floor-to-ceiling glass, acoustic damping, fiber connectivity, basement parking "
                    "with ratio 3:100 sqm, and LEED Gold environmentally certified services."
                ),
                "units": [
                    {
                        "code": "OFC-201",
                        "type": "Office",
                        "floor": "2",
                        "area": Decimal("140.00"),
                        "price": Decimal("24500000"),
                        "deposit": Decimal("15"),
                        "progress": Decimal("100"),
                        "status": SaleListing.Status.AVAILABLE,
                        "featured": True,
                        "renders": [
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80", "title": "Tower A Architectural Glass Facade", "primary": True},
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80", "title": "Grade-A Executive Office Suite", "primary": False},
                        ],
                    },
                    {
                        "code": "OFC-301",
                        "type": "Office",
                        "floor": "3",
                        "area": Decimal("155.00"),
                        "price": Decimal("27000000"),
                        "deposit": Decimal("15"),
                        "progress": Decimal("100"),
                        "status": SaleListing.Status.AVAILABLE,
                        "featured": False,
                        "renders": [
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80", "title": "Open Plan Commercial Suite", "primary": True},
                        ],
                    },
                ],
            },
            {
                "prop_code": "CE-MSA-003",
                "prop_name": "Nyali Trade Centre",
                "prop_type": "Mixed Use",
                "city": "Mombasa",
                "address": "Links Road, Nyali, Mombasa",
                "is_sectional": True,
                "scheme_reg": "ST/MSA/2024/018",
                "building_code": "MAIN-BLOCK",
                "building_name": "Nyali Trade Centre Main Block",
                "floors": 6,
                "project_code": "PRJ-SE-01",
                "project_name": "Nyali Trade Centre — Sales Program",
                "project_stage": "sales",
                "description": (
                    "Prime commercial and retail suites on Links Road, Mombasa's premier coastal business corridor. "
                    "High footfall ground floor retail units suitable for banking, pharmacies, and flagship boutiques, "
                    "backed by continuous solar-diesel microgrid power and secure customer parking."
                ),
                "units": [
                    {
                        "code": "G-01",
                        "type": "Retail",
                        "floor": "1",
                        "area": Decimal("118.00"),
                        "price": Decimal("23000000"),
                        "deposit": Decimal("15"),
                        "progress": Decimal("100"),
                        "status": SaleListing.Status.AVAILABLE,
                        "featured": True,
                        "renders": [
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80", "title": "Ground Floor Commercial Retail Frontage", "primary": True},
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80", "title": "Nyali Trade Centre Complex", "primary": False},
                        ],
                    },
                ],
            },
            {
                "prop_code": "CE-KBU-006",
                "prop_name": "Kiambu Ridge Serviced Plots",
                "prop_type": "Land",
                "city": "Kiambu",
                "address": "Off Kiambu Road, Ridgeways / Kiambu",
                "is_sectional": False,
                "scheme_reg": "LR/KBU/2024/8892",
                "building_code": "RIDGE-PLOTS",
                "building_name": "Kiambu Ridge Masterplan",
                "floors": 1,
                "project_code": "PRJ-KBU-01",
                "project_name": "Kiambu Ridge Serviced Land Masterplan",
                "project_stage": "sales",
                "description": (
                    "Fully serviced, beaconed residential plots with ready individual freehold title deeds. "
                    "Features cabro-paved internal access roads, street lighting, perimeter stone wall with razor wire, "
                    "individual water and electricity meter connections, and building guidelines to protect capital appreciation."
                ),
                "units": [
                    {
                        "code": "PLOT-08",
                        "type": "Land",
                        "floor": "1",
                        "area": Decimal("1012.00"),  # ~ 1/4 acre
                        "price": Decimal("14500000"),
                        "deposit": Decimal("10"),
                        "progress": Decimal("100"),
                        "status": SaleListing.Status.AVAILABLE,
                        "featured": True,
                        "renders": [
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80", "title": "Serviced Beaconed Plot View", "primary": True},
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1448630360428-65456885c650?auto=format&fit=crop&w=1200&q=80", "title": "Subdivision Masterplan & Road Access", "primary": False},
                        ],
                    },
                    {
                        "code": "PLOT-14",
                        "type": "Land",
                        "floor": "1",
                        "area": Decimal("2024.00"),  # ~ 1/2 acre
                        "price": Decimal("27000000"),
                        "deposit": Decimal("10"),
                        "progress": Decimal("100"),
                        "status": SaleListing.Status.AVAILABLE,
                        "featured": False,
                        "renders": [
                            {"kind": "render", "url": "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80", "title": "Half-Acre Prime Development Parcel", "primary": True},
                        ],
                    },
                ],
            },
        ]

        total_listings = 0
        total_renders = 0

        for prop_data in catalog:
            # 1. Create or update Property
            prop, _ = Property.objects.update_or_create(
                organization=org,
                code=prop_data["prop_code"],
                defaults={
                    "name": prop_data["prop_name"],
                    "property_type": prop_data["prop_type"],
                    "status": Property.Status.ACTIVE,
                    "city": prop_data["city"],
                    "address": prop_data["address"],
                    "country": "KE",
                    "is_sectional_title": prop_data["is_sectional"],
                    "scheme_registration_number": prop_data["scheme_reg"],
                    "metadata": {
                        "amenities": [
                            "Borehole Water Supply",
                            "Full Backup Generator",
                            "CCTV & Smart Access",
                            "High-Speed Lifts",
                            "Dedicated Parking",
                        ],
                    },
                },
            )

            # 2. Building
            bld, _ = Building.objects.update_or_create(
                organization=org,
                property=prop,
                code=prop_data["building_code"],
                defaults={
                    "name": prop_data["building_name"],
                    "floors": prop_data["floors"],
                },
            )

            # 3. Project
            proj, _ = Project.objects.update_or_create(
                organization=org,
                code=prop_data["project_code"],
                defaults={
                    "name": prop_data["project_name"],
                    "property": prop,
                    "status": Project.Status.ACTIVE,
                    "lifecycle_stage": Project.LifecycleStage.SALES,
                },
            )

            # 4. Construction profile for description
            ConstructionProject.objects.update_or_create(
                portfolio_project=proj,
                defaults={
                    "organization": org,
                    "name": proj.name,
                    "code": proj.code,
                    "description": prop_data["description"],
                    "location": f"{prop.address}, {prop.city}",
                    "stage": "active",
                },
            )

            # 5. Units & Listings
            for u_data in prop_data["units"]:
                unit, _ = Unit.objects.update_or_create(
                    organization=org,
                    property=prop,
                    code=u_data["code"],
                    defaults={
                        "building": bld,
                        "floor": u_data["floor"],
                        "unit_type": u_data["type"],
                        "area": u_data["area"],
                        "status": Unit.Status.AVAILABLE,
                    },
                )

                listing, _ = SaleListing.objects.update_or_create(
                    organization=org,
                    unit=unit,
                    defaults={
                        "project": proj,
                        "list_price": u_data["price"],
                        "minimum_deposit_percent": u_data["deposit"],
                        "construction_progress": u_data["progress"],
                        "status": u_data["status"],
                        "is_featured": u_data["featured"],
                    },
                )
                seeded_listing_ids.append(listing.id)
                total_listings += 1

                # Clean old renders and recreate fresh rich renders
                ListingRender.objects.filter(organization=org, listing=listing).delete()
                for idx, r_data in enumerate(u_data["renders"]):
                    ListingRender.objects.create(
                        organization=org,
                        listing=listing,
                        render_kind=r_data["kind"],
                        title=r_data["title"],
                        file_url=r_data["url"],
                        is_primary=r_data.get("primary", False),
                        sort_order=idx,
                    )
                    total_renders += 1

        # Delete any legacy dummy listings for this org that were not in the catalog
        orphans = SaleListing.objects.filter(organization=org).exclude(id__in=seeded_listing_ids)
        if orphans.exists():
            orphan_count = orphans.count()
            orphans.delete()
            self.stdout.write(f"Removed {orphan_count} legacy dummy listings.")

        self.stdout.write(
            f"Created/updated {total_listings} sale listings with {total_renders} rich photo renders."
        )
