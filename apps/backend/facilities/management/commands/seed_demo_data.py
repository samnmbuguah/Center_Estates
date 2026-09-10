"""
Seed rich demo data for the Center Estates organizations.

Idempotent: every record uses a distinctive code with get_or_create, so this
command can be re-run safely and never duplicates or overwrites live data.

Usage:
    python manage.py seed_demo_data                      # both demo orgs
    python manage.py seed_demo_data --org <slug>         # one org
"""
import random
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from organizations.models import Organization
from properties.models import (
    Building, ExitClearance, Invoice, Lease, Property, TenantHandover, Unit, Tenant,
    Project, PropertyModule,
)
from sales.models import (
    AgentCommission, Buyer, BuyerPortalAccess, Installment, ListingRender, PropertySale,
    SaleDocument, SaleListing, SalePayment, SiteVisit,
)
from facilities.models import (
    ComplianceObligation, Contractor, ContractorContract, FacilityAsset, FacilityExpense,
    FacilityIncident, FacilityRisk, FMBudget, Inspection, PreventiveSchedule,
    RepairRequisition, ServiceProfile, ServiceProfileAllocation, SupplierInvoice,
    UtilityMeter, WorkOrder,
)
from core.models import Module
from subscriptions.models import Subscription

TODAY = timezone.localdate()


def pick(queryset):
    """Return a random instance or None when the queryset is empty."""
    return queryset.order_by('?').first()


class Command(BaseCommand):
    help = "Seed rich, realistic demo data (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument('--org', type=str, default=None, help='Organization slug (default: both demo orgs)')

    # ── helpers ──────────────────────────────────────────────────────────

    def ensure_subscription(self, org, module_slug):
        Subscription.objects.get_or_create(
            organization=org, module=module_slug,
            defaults={'status': Subscription.Status.ACTIVE, 'is_active': True},
        )

    def get_or_create_record(self, model, org, code, defaults):
        record, created = model.objects.get_or_create(
            organization=org, code=code, defaults=defaults,
        )
        return record, created

    # ── seeders per domain ───────────────────────────────────────────────

    def seed_contractors(self, org):
        contractors = [
            ('CON-SE-01', 'Acme Plumbing Services', 'Plumbing & drainage', 'active', 'approved', '4.60'),
            ('CON-SE-02', 'BrightSpark Electrical Ltd', 'Electrical installations', 'active', 'approved', '4.80'),
            ('CON-SE-03', 'LiftCare Kenya', 'Vertical transport', 'active', 'approved', '4.20'),
            ('CON-SE-04', 'GreenScape Grounds', 'Landscaping & grounds', 'review', 'pending', '3.90'),
            ('CON-SE-05', 'SecureGuard Systems', 'Security systems', 'active', 'approved', '4.50'),
            ('CON-SE-06', 'CoolBreeze HVAC', 'HVAC & refrigeration', 'suspended', 'rejected', '2.80'),
        ]
        created_count = 0
        for code, name, specialty, status, approval, rating in contractors:
            _, created = self.get_or_create_record(Contractor, org, code, {
                'name': name, 'specialty': specialty,
                'contact_name': name.split()[0] + ' Contact',
                'email': f'{code.lower()}@providers.example',
                'phone': '+25470000000' + code[-1],
                'emergency_phone': '+25471100000' + code[-1],
                'status': status, 'approval_status': approval, 'rating': Decimal(rating),
                'insurance_expires_on': TODAY + timedelta(days=random.choice([25, 45, 120, 300])),
                'license_expires_on': TODAY + timedelta(days=random.choice([15, 90, 200])),
                'tax_compliance_expires_on': TODAY + timedelta(days=random.choice([55, 150, 400])),
                'pin_number': f'P0{code[-1]}123456X',
            })
            created_count += int(created)
        return created_count

    def seed_contracts(self, org):
        count = 0
        for contractor in Contractor.objects.filter(organization=org, status='active'):
            _, created = ContractorContract.objects.get_or_create(
                organization=org, contractor=contractor, contract_number=f'CT-{contractor.code}-2026',
                defaults={
                    'scope_of_work': f'{contractor.name} annual service agreement covering planned and reactive works.',
                    'status': 'active',
                    'start_date': TODAY - timedelta(days=90),
                    'end_date': TODAY + timedelta(days=275),
                    'contract_value': Decimal(random.choice(['240000.00', '480000.00', '960000.00'])),
                    'response_sla_hours': 4,
                    'resolution_sla_hours': 48,
                },
            )
            count += int(created)
        return count

    def seed_service_profiles(self, org, properties, user):
        profiles = [
            ('SVC-SE-01', 'Daily common-area cleaning', 'Cleaning & hygiene', 'routine', 'high', 'Daily'),
            ('SVC-SE-02', 'Passenger lift maintenance', 'Vertical transport', 'preventive', 'critical', 'Monthly'),
            ('SVC-SE-03', 'Generator servicing', 'Backup power', 'preventive', 'high', 'Quarterly'),
            ('SVC-SE-04', 'Pest control rounds', 'Pest control', 'routine', 'medium', 'Monthly'),
            ('SVC-SE-05', 'Water quality testing', 'Health & safety', 'specialist', 'high', 'Quarterly'),
        ]
        count = 0
        for code, name, category, service_type, criticality, frequency in profiles:
            profile, created = self.get_or_create_record(ServiceProfile, org, code, {
                'name': name, 'category': category, 'service_type': service_type,
                'criticality': criticality, 'default_frequency': frequency,
                'description': f'{name} as required for the property portfolio.',
                'status': 'active', 'created_by': user,
            })
            count += int(created)
            if created and properties:
                ServiceProfileAllocation.objects.get_or_create(
                    organization=org, service_profile=profile,
                    property=properties[0],
                    defaults={
                        'provider': pick(Contractor.objects.filter(organization=org, status='active')),
                        'starts_on': TODAY - timedelta(days=60),
                        'response_target_minutes': 120,
                        'resolution_target_minutes': 2880,
                        'quality_target_percent': Decimal('90.00'),
                        'is_active': True,
                    },
                )
        return count

    def seed_assets_and_meters(self, org, properties):
        assets = [
            ('AST-SE-01', 'Standby generator 500kVA', 'Backup power', 2500000),
            ('AST-SE-02', 'Passenger lift — Bank wing', 'Vertical transport', 4800000),
            ('AST-SE-03', 'Borehole pump set', 'Water systems', 1200000),
            ('AST-SE-04', 'CCTV & access control hub', 'Security systems', 850000),
            ('AST-SE-05', 'HVAC chiller unit', 'HVAC', 3600000),
            ('AST-SE-06', 'Fire suppression system', 'Fire safety', 1500000),
        ]
        count = 0
        for i, (code, name, category, value) in enumerate(assets):
            if not properties:
                break
            _, created = self.get_or_create_record(FacilityAsset, org, code, {
                'name': name, 'category': category,
                'property': properties[i % len(properties)],
                'criticality': random.choice(['critical', 'high', 'medium']),
                'condition': random.choice(['good', 'excellent', 'fair']),
                'purchase_value': Decimal(value),
                'installed_on': TODAY - timedelta(days=random.randint(400, 2000)),
                'serial_number': f'AST-KE-{random.randint(10000, 99999)}',
            })
            count += int(created)
        # Meters for utility management
        for i, prop in enumerate(properties[:3]):
            utility = random.choice(['electricity', 'water'])
            _, created = self.get_or_create_record(UtilityMeter, org, f'MTR-SE-{i+1:02d}', {
                'property': prop, 'utility_type': utility, 'meter_role': 'bulk',
                'name': f'{prop.name} bulk {utility} meter',
                'is_active': True,
            })
            count += int(created)
        return count

    def seed_incidents(self, org, properties, user):
        incidents = [
            ('INC-SE-01', 'Break-in at gate house', 'Break-in', 'critical', 'resolved',
             'Night guard reported forced entry at the gate house around 2am. Entry gained through the rear padlock.',
             'Police notified within 20 minutes; site secured and padlock replaced.',
             'Install floodlights on the rear fence and upgrade to a shackle padlock.'),
            ('INC-SE-02', 'Office locking failure — master key', 'Access failure', 'medium', 'closed',
             'Master key broke inside the management office lock on Monday morning, locking out the admin team.',
             'Locksmith attended within one hour; lock cylinder replaced the same day.',
             'Cut a spare master key and store it in the safe.'),
            ('INC-SE-03', 'Water leak on 3rd floor corridor', 'Leak', 'high', 'under_review',
             'A riser pipe joint failed above the 3rd floor corridor, wetting the carpet over roughly 12 square metres.',
             'Water supply to the riser isolated; wet vacuuming arranged the same afternoon.',
             'Replace the corroded joint and repaint the ceiling patch.'),
            ('INC-SE-04', 'Power outage — full building', 'Outage', 'high', 'submitted',
             'KPLC supply interrupted at 09:40. Generator auto-started but failed to pick up the lift circuit.',
             'Facility team on site; KPLC fault reference logged; lift circuit manually transferred.',
             'Service the ATS changeover contactor and verify lift circuit breaker.'),
        ]
        count = 0
        for i, (ref, title, category, severity, status, narrative, action, recommendation) in enumerate(incidents):
            if not properties:
                break
            _, created = FacilityIncident.objects.get_or_create(
                organization=org, reference=ref,
                defaults={
                    'property': properties[i % len(properties)],
                    'location': f"{random.choice(['Gate house', 'Management office', '3rd floor corridor', 'Main DB room'])} — {title}",
                    'occurred_at': timezone.now() - timedelta(days=random.randint(2, 20)),
                    'category': category, 'severity': severity, 'status': status,
                    'narrative': narrative, 'immediate_action': action,
                    'recommended_action': recommendation,
                    'reported_by': user,
                },
            )
            count += int(created)
        return count

    def seed_inspections(self, org, properties, user):
        count = 0
        for i in range(3):
            if not properties:
                break
            _, created = Inspection.objects.get_or_create(
                organization=org, reference=f'INS-SE-{i+1:02d}',
                defaults={
                    'property': properties[i % len(properties)],
                    'title': f'Quarterly property inspection Q{(i % 4) + 1}',
                    'inspection_type': random.choice(['Routine', 'Safety', 'Move-out']),
                    'status': random.choice(['scheduled', 'in_progress', 'passed']),
                    'scheduled_on': timezone.now() + timedelta(days=random.randint(1, 30)),
                    'inspector': user,
                    'score': Decimal(random.choice(['78.00', '85.50', '92.00'])),
                    'findings': 'Walkthrough of common areas, plant room and sample units completed.',
                },
            )
            count += int(created)
        return count

    def seed_compliance_and_risks(self, org, properties):
        count = 0
        compliance = [
            ('CMP-SE-01', 'Fire safety certificate', 'Fire safety', 'expired', TODAY - timedelta(days=10)),
            ('CMP-SE-02', 'Lift inspection certificate', 'Vertical transport', 'active', TODAY + timedelta(days=40)),
            ('CMP-SE-03', 'Water permit renewal', 'Water', 'active', TODAY + timedelta(days=75)),
            ('CMP-SE-04', 'Business permit', 'County', 'active', TODAY + timedelta(days=200)),
        ]
        for code, title, category, status, due in compliance:
            if not properties:
                break
            _, created = ComplianceObligation.objects.get_or_create(
                organization=org, certificate_number=code,
                defaults={
                    'title': title, 'category': category, 'status': status,
                    'expiry_date': due, 'property': properties[0],
                    'notes': 'Renewal handled by the compliance calendar.',
                    'issuing_authority': random.choice(['DOSHS', 'County Government', 'EPRA', 'WARMA']),
                },
            )
            count += int(created)
        risks = [
            ('RSK-SE-01', 'Ageing lift controller', 'Operational', 'high', 3, 4),
            ('RSK-SE-02', 'Single water supply dependency', 'Utility', 'medium', 2, 5),
            ('RSK-SE-03', 'Guarding contractor concentration', 'Commercial', 'medium', 2, 3),
        ]
        for code, title, category, severity, likelihood, impact in risks:
            _, created = FacilityRisk.objects.get_or_create(
                organization=org, risk_id=code,
                defaults={
                    'property': properties[0],
                    'description': f'{title} ({severity} severity).', 'category': category,
                    'likelihood': likelihood, 'impact': impact,
                    'mitigation_controls': 'Mitigation plan tracked in the FM strategic plan.',
                    'status': 'open',
                },
            )
            count += int(created)
        return count

    def seed_fm_finance(self, org, properties, user):
        count = 0
        year = TODAY.year
        budget = None
        for i, category in enumerate(['Repairs & maintenance', 'Cleaning', 'Security', 'Utilities']):
            if not properties:
                break
            b, created = FMBudget.objects.get_or_create(
                organization=org, category=category, financial_year=year,
                period_month=TODAY.month,
                defaults={
                    'property': properties[i % len(properties)],
                    'allocated_amount': Decimal(random.choice(['180000.00', '240000.00', '320000.00', '500000.00'])),
                    'committed_amount': Decimal(random.choice(['20000.00', '60000.00', '120000.00'])),
                    'actual_amount': Decimal(random.choice(['10000.00', '45000.00', '90000.00'])),
                    'notes': 'Monthly FM operating allocation.',
                },
            )
            budget = budget or b
            count += int(created)
        for i in range(4):
            if not properties:
                break
            _, created = FacilityExpense.objects.get_or_create(
                organization=org, receipt_reference=f'FMX-SE-{i+1:02d}',
                defaults={
                    'property': properties[i % len(properties)],
                    'category': random.choice(['Repairs', 'Cleaning', 'Security', 'Utilities']),
                    'description': random.choice([
                        'Plumbing repairs — 2nd floor washrooms',
                        'Monthly cleaning contract run',
                        'Guarding invoice — gatehouse coverage',
                        'Bulk electricity purchase',
                    ]),
                    'amount': Decimal(random.choice(['18500.00', '42000.00', '96000.00', '125000.00'])),
                    'spent_on': TODAY - timedelta(days=random.randint(5, 60)),
                    'status': random.choice(['pending', 'approved', 'rejected']),
                    'recorded_by': user,
                    'supplier': pick(Contractor.objects.filter(organization=org)),
                },
            )
            count += int(created)
        return count

    def seed_requisitions(self, org, properties, user):
        reqs = [
            ('RQR-SE-01', 'Replace corridor lighting ballasts', 'draft', 'medium'),
            ('RQR-SE-02', 'Repair gate automation motor', 'submitted', 'high'),
            ('RQR-SE-03', 'Unblock main drainage line', 'approved', 'emergency'),
            ('RQR-SE-04', 'Repaint stairwell B', 'converted', 'low'),
        ]
        count = 0
        for i, (code, title, status, priority) in enumerate(reqs):
            if not properties:
                break
            defaults = {
                'title': title, 'property': properties[i % len(properties)],
                'location': random.choice(['Block A', 'Block B', 'Ground floor', 'Parking deck']),
                'issue_description': f'{title} reported during weekly walkthrough.',
                'required_repair': f'Scope, quote and execute: {title.lower()}.',
                'estimated_cost': Decimal(random.choice(['15000.00', '48000.00', '125000.00'])),
                'priority': priority, 'status': status, 'requester': user,
            }
            if status in ('approved', 'converted'):
                defaults.update({
                    'manager': user, 'manager_approved_at': timezone.now(),
                    'manager_notes': 'Approved — within quarterly maintenance budget.',
                })
            if status == 'converted':
                defaults['converted_at'] = timezone.now()
            _, created = self.get_or_create_record(RepairRequisition, org, code, defaults)
            count += int(created)
        return count

    def seed_supplier_invoices(self, org, properties, user):
        count = 0
        plumbing = Contractor.objects.filter(organization=org, code='CON-SE-01').first()
        electrical = Contractor.objects.filter(organization=org, code='CON-SE-02').first()
        invoices = [
            ('SIN-SE-01', plumbing, 'ACME-INV-2211', 'repair', 'paid', 34800),
            ('SIN-SE-02', electrical, 'BS-INV-0091', 'repair', 'payment_processing', 61250),
            ('SIN-SE-03', plumbing, 'ACME-INV-2245', 'recurring', 'approved', 96000),
            ('SIN-SE-04', electrical, 'BS-INV-0104', 'repair', 'submitted', 22800),
        ]
        for i, (code, supplier, number, classification, status, total) in enumerate(invoices):
            if not properties or supplier is None:
                continue
            subtotal = Decimal(total) / Decimal('1.16')
            vat = Decimal(total) - subtotal
            defaults = {
                'property': properties[i % len(properties)], 'supplier': supplier,
                'supplier_invoice_number': number, 'classification': classification,
                'description': 'Services rendered as per contract / work order.',
                'subtotal': subtotal.quantize(Decimal('0.01')), 'vat_rate': Decimal('16.00'),
                'vat_amount': vat.quantize(Decimal('0.01')), 'total': Decimal(total),
                'cost_centre': 'FM-MAINT', 'status': status,
            }
            if status in ('submitted', 'verified', 'approved', 'payment_processing', 'paid'):
                defaults.update({'submitted_by': user, 'submitted_at': timezone.now()})
            if status in ('verified', 'approved', 'payment_processing', 'paid'):
                defaults.update({'verified_by': user, 'verified_at': timezone.now()})
            if status in ('approved', 'payment_processing', 'paid'):
                defaults.update({'approved_by': user, 'approved_at': timezone.now()})
            if status == 'paid':
                defaults.update({'paid_at': timezone.now(), 'payment_reference': f'RTGS-{random.randint(10000, 99999)}'})
            _, created = self.get_or_create_record(SupplierInvoice, org, code, defaults)
            count += int(created)
        return count

    def seed_sales(self, org, user):
        """Seed a rich, idempotent sales dataset across every property.

        Ensures the organization is subscribed to Sales and that each property
        is enabled for the module, then creates listings (with 3D showcase
        assets), buyers, sales with installment plans and verified/pending
        payments, commissions, site visits and legal documents.
        """
        from django.contrib.auth import get_user_model
        from organizations.models import Membership
        U = get_user_model()
        count = 0

        self.ensure_subscription(org, Module.SALES)
        properties = list(Property.objects.filter(organization=org).order_by('code'))
        if not properties:
            return count
        for prop in properties:
            PropertyModule.objects.get_or_create(
                organization=org, property=prop, module=Module.SALES,
                defaults={'is_enabled': True},
            )

        # A dedicated demo buyer account linked to a buyer profile.
        buyer_user, _ = U.objects.get_or_create(
            username='sales-demo', defaults={'email': 'sales-demo@example.com'},
        )
        if not Membership.objects.filter(user=buyer_user, organization=org).exists():
            Membership.objects.create(
                user=buyer_user, organization=org, is_organization_admin=True, is_default=True,
            )

        buyer_names = [
            ('Jane Wanjiku', 'NCBA Bank'), ('Peter Otieno', 'KCB Bank'),
            ('Grace Muthoni', 'Equity Bank'), ('David Kiprop', 'Co-operative Bank'),
            ('Amina Hassan', ''), ('Samuel Njoroge', 'Absa Bank'),
            ('Faith Chebet', ''), ('Brian Ochieng', 'Stanbic Bank'),
            ('Mercy Wambui', 'Family Bank'), ('Kevin Mutua', ''),
        ]
        buyer_statuses = [Buyer.Status.ACTIVE, Buyer.Status.QUALIFIED, Buyer.Status.LEAD]

        for pi, prop in enumerate(properties, start=1):
            project, _ = Project.objects.get_or_create(
                organization=org, code=f'PRJ-SE-{pi:02d}',
                defaults={
                    'property': prop, 'name': f'{prop.name} — Sales Program',
                    'status': Project.Status.ACTIVE,
                },
            )
            units = list(Unit.objects.filter(organization=org, property=prop).order_by('code'))
            if not units:
                continue

            # Listings for up to five units with a spread of statuses.
            listings = []
            listing_statuses = [
                SaleListing.Status.AVAILABLE, SaleListing.Status.AVAILABLE,
                SaleListing.Status.AVAILABLE, SaleListing.Status.RESERVED, SaleListing.Status.RESERVED,
            ]
            for i, unit in enumerate(units[:5]):
                listing = SaleListing.objects.filter(organization=org, unit=unit).first()
                if listing is None:
                    listing = SaleListing.objects.create(
                        organization=org, unit=unit, project=project,
                        list_price=Decimal(15000000 + (pi * 7 + i) * 1750000),
                        minimum_deposit_percent=Decimal('10'),
                        construction_progress=Decimal(random.randint(25, 95)),
                        status=listing_statuses[i % len(listing_statuses)],
                    )
                    count += 1
                listings.append(listing)

            # 3D / floor-plan showcase assets.
            for idx, listing in enumerate(listings):
                if ListingRender.objects.filter(organization=org, listing=listing).exists():
                    continue
                is_model = (pi == 1 and idx == 0)
                defaults = {
                    'render_kind': ListingRender.RenderKind.MODEL_3D if is_model else ListingRender.RenderKind.FLOORPLAN,
                    'title': f'{listing.unit.code} — 3D showcase',
                    'caption': 'Interactive 3D view of the unit layout.',
                    'is_primary': True,
                    'sort_order': 0,
                }
                if is_model:
                    defaults['file_url'] = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Box/glTF-Binary/Box.glb'
                    defaults['mime_type'] = 'model/gltf-binary'
                ListingRender.objects.create(organization=org, listing=listing, **defaults)
                count += 1

            # Buyers for this property.
            prop_buyers = []
            for bi in range(3):
                name, financier = buyer_names[((pi - 1) * 3 + bi) % len(buyer_names)]
                status = buyer_statuses[bi % len(buyer_statuses)]
                buyer, created = Buyer.objects.get_or_create(
                    organization=org, reference=f'B-SE-{pi:02d}-{bi + 1}',
                    defaults={
                        'full_name': name,
                        'email': f'{name.split()[0].lower()}.{pi}{bi}@example.com',
                        'phone': f'07{random.randint(10, 99)} {random.randint(100, 999)} {random.randint(100, 999)}',
                        'id_number': f'ID-{pi:02d}{bi + 1}3345{random.randint(10, 99)}',
                        'financing_type': 'bank' if financier else 'self', 'financier': financier,
                        'status': status, 'assigned_agent': user,
                        'confirmed_at': timezone.now() if status == Buyer.Status.ACTIVE else None,
                    },
                )
                prop_buyers.append(buyer)
                if created:
                    count += 1

            # Sales: one contracted (with a verified and a pending payment) and
            # one reserved, so the pipeline, payment queue and commissions all
            # have representative data.
            sale_specs = [
                (PropertySale.Status.CONTRACTED, prop_buyers[0]),
                (PropertySale.Status.RESERVED, prop_buyers[1]),
            ]
            for si, (status, buyer) in enumerate(sale_specs, start=1):
                listing = listings[(si - 1) % len(listings)] if listings else None
                if listing is None:
                    continue
                agreed = Decimal(listing.list_price)
                reservation_fee = (agreed * Decimal('0.1')).quantize(Decimal('0.01'))
                sale, created = PropertySale.objects.get_or_create(
                    organization=org, reference=f'SALE-SE-{pi:02d}-{si}',
                    defaults={
                        'buyer': buyer, 'listing': listing, 'agent': user,
                        'agreed_price': agreed, 'reservation_fee': reservation_fee,
                        'status': status,
                        'reserved_at': timezone.now() - timedelta(days=90 - si * 10),
                        'contracted_on': (TODAY - timedelta(days=70)) if status == PropertySale.Status.CONTRACTED else None,
                    },
                )
                if created:
                    count += 1
                if listing.status == SaleListing.Status.AVAILABLE:
                    listing.status = SaleListing.Status.RESERVED
                    listing.save(update_fields=('status', 'updated_at'))

                # Installment plan: 25% deposit + three tranches. The contracted
                # sale carries a paid deposit and an overdue tranche; the
                # reserved sale carries a past-due deposit, so the collections
                # cockpit shows a realistic aging spread.
                deposit = (agreed * Decimal('0.25')).quantize(Decimal('0.01'))
                tranche = ((agreed - deposit) / 3).quantize(Decimal('0.01'))
                plan = [
                    (1, 'Reservation deposit', deposit),
                    (2, 'First tranche', tranche),
                    (3, 'Second tranche', tranche),
                    (4, 'Balance on completion', agreed - deposit - tranche * 2),
                ]
                due_offsets = (
                    {1: -75, 2: -40, 3: 30, 4: 90}
                    if status == PropertySale.Status.CONTRACTED
                    else {1: -20, 2: 40, 3: 80, 4: 120}
                )
                installments = []
                for seq, desc, amount in plan:
                    due_on = TODAY + timedelta(days=due_offsets[seq])
                    inst_status = (
                        Installment.Status.OVERDUE if due_on < TODAY
                        else Installment.Status.DUE if due_on == TODAY
                        else Installment.Status.UPCOMING
                    )
                    inst, inst_created = Installment.objects.get_or_create(
                        organization=org, sale=sale, sequence=seq,
                        defaults={
                            'description': desc, 'due_on': due_on, 'amount': amount,
                            'status': inst_status, 'milestone': desc,
                        },
                    )
                    # Converge demo data: backdate an unpaid installment whose
                    # schedule drifted from the seeded plan.
                    if not inst_created and inst.paid_amount == 0 and inst.due_on != due_on:
                        inst.due_on = due_on
                        inst.status = inst_status
                        inst.save(update_fields=('due_on', 'status', 'updated_at'))
                    installments.append(inst)

                if status == PropertySale.Status.CONTRACTED:
                    inst = installments[0]
                    inst.paid_amount = deposit
                    inst.status = Installment.Status.PAID
                    inst.save(update_fields=('paid_amount', 'status', 'updated_at'))
                    _, pay_created = SalePayment.objects.get_or_create(
                        organization=org, reference=f'SP-SE-{pi:02d}-{si}',
                        defaults={
                            'sale': sale, 'installment': inst,
                            'paid_on': TODAY - timedelta(days=60), 'amount': deposit,
                            'method': 'bank', 'external_reference': f'RTGS-SE-{pi:02d}{si}',
                            'status': SalePayment.Status.VERIFIED,
                            'verified_by': user, 'verified_at': timezone.now(),
                        },
                    )
                    count += int(pay_created)
                    # A pending payment for the verification queue.
                    _, pending_created = SalePayment.objects.get_or_create(
                        organization=org, reference=f'SP-SE-{pi:02d}-{si}-P',
                        defaults={
                            'sale': sale, 'installment': installments[1],
                            'paid_on': TODAY - timedelta(days=5), 'amount': tranche,
                            'method': 'paybill', 'external_reference': f'MPESA-SE-{pi:02d}{si}',
                            'status': SalePayment.Status.PENDING,
                        },
                    )
                    count += int(pending_created)

                _, commission_created = AgentCommission.objects.get_or_create(
                    organization=org, reference=f'CM-SE-{pi:02d}-{si}',
                    defaults={
                        'sale': sale, 'agent': user, 'rate_percent': Decimal('2.5'),
                        'amount': (agreed * Decimal('0.025')).quantize(Decimal('0.01')),
                        'required_paid_percent': Decimal('20'),
                        'required_construction_percent': Decimal('0'),
                        'status': (AgentCommission.Status.ELIGIBLE if status == PropertySale.Status.CONTRACTED
                                   else AgentCommission.Status.PENDING),
                    },
                )
                count += int(commission_created)

                _, document_created = SaleDocument.objects.get_or_create(
                    organization=org, sale=sale,
                    checksum=f'sha256:sales-demo-agreement-{pi:02d}-{si}',
                    defaults={
                        'document_type': 'sale_agreement',
                        'title': f'Sale Agreement — Unit {listing.unit.code}',
                        'is_final': True, 'signed_on': TODAY - timedelta(days=70), 'file_url': '',
                    },
                )
                count += int(document_created)

            # Site visits for this property.
            for vi in range(1, 3):
                visitor, _ = buyer_names[((pi - 1) * 3 + vi) % len(buyer_names)]
                _, visit_created = SiteVisit.objects.get_or_create(
                    organization=org, reference=f'SV-SE-{pi:02d}-{vi}',
                    defaults={
                        'visitor_name': visitor,
                        'email': f'visit{pi}{vi}@example.com',
                        'phone': f'07{random.randint(10, 99)} {random.randint(100, 999)} {random.randint(100, 999)}',
                        'project': project,
                        'interested_unit_type': random.choice(
                            ['2 Bedroom', '3 Bedroom', 'Studio', 'Penthouse', 'Commercial'],
                        ),
                        'introducing_agent': user,
                        'visited_at': timezone.now() - timedelta(days=random.randint(3, 60)),
                        'follow_up_on': TODAY + timedelta(days=random.randint(2, 21)),
                        'notes': 'Follow-up scheduled with the sales team.',
                    },
                )
                count += int(visit_created)

        # Link the demo buyer account to a buyer profile for portal access.
        first_buyer = Buyer.objects.filter(
            organization=org, reference__startswith='B-SE-',
        ).order_by('reference').first()
        if first_buyer:
            BuyerPortalAccess.objects.get_or_create(
                organization=org, user=buyer_user, buyer=first_buyer, defaults={'is_active': True},
            )
        return count

    def seed_handovers(self, org, user):
        count = 0
        leases = Lease.objects.filter(organization=org, status__in=('active', 'expiring')).select_related('unit', 'tenant')[:3]
        for i, lease in enumerate(leases):
            _, created = TenantHandover.objects.get_or_create(
                organization=org, code=f'HND-SE-{i+1:02d}',
                defaults={
                    'lease': lease, 'unit': lease.unit, 'tenant': lease.tenant,
                    'status': random.choice(['in_progress', 'completed', 'acknowledged']),
                    'handover_date': TODAY - timedelta(days=random.randint(10, 90)),
                    'condition_lines': [
                        {'item': 'Flooring', 'condition': 'Good', 'notes': 'Tiles intact'},
                        {'item': 'Walls', 'condition': 'Good', 'notes': ''},
                        {'item': 'Doors & locks', 'condition': 'Excellent', 'notes': 'New lockset'},
                        {'item': 'Plumbing', 'condition': 'Good', 'notes': 'No leaks observed'},
                    ],
                    'keys_items': [{'item': 'Main door key', 'quantity': 2}, {'item': 'Gate remote', 'quantity': 1}],
                    'electricity_meter_number': f'KPLC-{random.randint(100000, 999999)}',
                    'electricity_opening_reading': Decimal(random.randint(50, 400)),
                    'caretaker_name': 'Site Caretaker',
                    'caretaker_signed_at': timezone.now(),
                    'notes': 'Move-in handover completed at premises.',
                },
            )
            count += int(created)
        return count

    def seed_exit_clearances(self, org, user):
        count = 0
        leases = Lease.objects.filter(organization=org, status__in=('active', 'expiring', 'expired')).select_related('unit', 'tenant')[:2]
        for i, lease in enumerate(leases):
            status = 'gate_pass_issued' if i == 0 else 'in_progress'
            defaults = {
                'lease': lease, 'tenant': lease.tenant, 'status': status,
                'move_out_date': TODAY + timedelta(days=random.randint(5, 30)),
                'move_out_conditions': 'Vacate by noon; remove all belongings; surrender keys at the management office.',
                'deposit_amount': Decimal(lease.monthly_rent or 0) * 2 or None,
                'utilities_cleared': status != 'in_progress',
                'inspection_passed': status != 'in_progress',
                'rent_cleared': status != 'in_progress',
                'service_charge_cleared': status != 'in_progress',
                'deductions': [{'item': 'Repainting', 'amount': '8000', 'notes': 'Scuffed walls'}],
            }
            if status == 'gate_pass_issued':
                deposit = defaults['deposit_amount'] or Decimal('0')
                defaults.update({
                    'refund_amount': deposit - Decimal('8000'),
                    'manager_approved_by': user, 'manager_approved_at': timezone.now(),
                    'finance_approved_by': user, 'finance_approved_at': timezone.now(),
                    'gate_pass_number': f'GP-SE-{i+1:02d}',
                    'gate_pass_issued_at': timezone.now(),
                })
            _, created = self.get_or_create_record(ExitClearance, org, f'EXC-SE-{i+1:02d}', defaults)
            count += int(created)
        return count

    def seed_ppm(self, org, user):
        count = 0
        assets = FacilityAsset.objects.filter(organization=org)
        for i, asset in enumerate(assets[:3]):
            _, created = PreventiveSchedule.objects.get_or_create(
                organization=org, code=f'PPM-SE-{i+1:02d}',
                defaults={
                    'asset': asset, 'name': f'{asset.name} — quarterly service',
                    'frequency': 'quarterly', 'is_active': True,
                    'next_due_on': TODAY + timedelta(days=random.randint(5, 60)),
                    'last_completed_on': TODAY - timedelta(days=random.randint(40, 110)),
                    'instructions': 'Follow manufacturer service checklist and log readings.',
                },
            )
            count += int(created)
        return count

    # ── entry point ──────────────────────────────────────────────────────

    def handle(self, *args, **options):
        slug = options.get('org')
        orgs = Organization.objects.filter(slug=slug) if slug else Organization.objects.filter(
            slug__in=['center-estates-demo'],
        )
        if not orgs.exists():
            self.stderr.write(f'No matching organization for "{slug}".')
            return

        from django.contrib.auth import get_user_model
        U = get_user_model()

        for org in orgs:
            self.stdout.write(f'=== Seeding {org.slug} ===')
            for module in (Module.FACILITY, Module.PROPERTY, Module.COMPANION, Module.SALES):
                self.ensure_subscription(org, module)

            admin = U.objects.filter(
                erp_memberships__organization=org, erp_memberships__is_organization_admin=True,
            ).first() or U.objects.filter(is_superuser=True).first()
            properties = list(Property.objects.filter(organization=org))

            results = {
                'contractors': self.seed_contractors(org),
                'contracts': self.seed_contracts(org),
                'service_profiles': self.seed_service_profiles(org, properties, admin),
                'assets_meters': self.seed_assets_and_meters(org, properties),
                'incidents': self.seed_incidents(org, properties, admin),
                'inspections': self.seed_inspections(org, properties, admin),
                'compliance_risks': self.seed_compliance_and_risks(org, properties),
                'fm_finance': self.seed_fm_finance(org, properties, admin),
                'requisitions': self.seed_requisitions(org, properties, admin),
                'supplier_invoices': self.seed_supplier_invoices(org, properties, admin),
                'sales': self.seed_sales(org, admin),
                'handovers': self.seed_handovers(org, admin),
                'exit_clearances': self.seed_exit_clearances(org, admin),
                'ppm': self.seed_ppm(org, admin),
            }
            for name, created in results.items():
                self.stdout.write(f'  {name}: +{created} new')
        self.stdout.write(self.style.SUCCESS('Demo seeding complete.'))
