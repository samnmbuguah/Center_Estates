import os
from decimal import Decimal
from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from core.models import Module
from facilities.models import (
    Contractor, FacilityAsset, Inspection, MeterReading, MeterReconciliation, PreventiveSchedule,
    ServiceRequest, UtilityMeter, WorkOrder, WorkOrderAttachment,
    WorkOrderCostItem, WorkOrderEvent,
)
from organizations.models import Membership, MembershipRole, Organization, Permission, Role
from notifications.models import Notification
from properties.models import (
    BankTransaction, BillingItem, BillingProfile, Building, Budget, CreditNote, Expense, Invoice,
    InvoiceReminder, Lease, Project, Property, Receipt, ReceiptAllocation,
    RentSchedule, ServiceCharge,
    ServiceChargeAllocation, ServiceChargeReconciliation, TaxConfiguration, Tenant, TenantDocument,
    TenantMovement, TenantPortalAccess, Unit, UnitStatusHistory,
)
from sales.models import AgentCommission, Buyer, Installment, PropertySale, SaleDocument, SaleListing, SalePayment, SalesAuditEvent, SiteVisit
from subscriptions.models import Subscription
from tenders.models import BidDecision, CompanyDocument, FinancialItem, ProposalSection, Tender, TenderAuditEvent, TenderOutcome, TenderRequirement, TenderReview, TenderSubmission, TenderTask
from valuations.models import ComparableEvidence, DraftValuationReport, FinalValuationReport, ValuationAuditEvent, ValuationClient, ValuationInspection, ValuationInstruction, ValuationInvoice, ValuationPayment
from companion.models import Task as CompanionTask, TaskTemplate, TaskEvent
from construction.models import Project as ConstructionProject


class Command(BaseCommand):
    help = 'Create idempotent platform demo/admin data for development and acceptance testing.'

    def handle(self, *args, **options):
        password = os.environ.get('SEED_ADMIN_PASSWORD')
        if not password:
            raise CommandError('SEED_ADMIN_PASSWORD is required.')
        username = os.environ.get('SEED_ADMIN_USERNAME', 'admin')
        user, _ = get_user_model().objects.get_or_create(username=username)
        user.is_staff = True
        user.is_superuser = True
        user.first_name = user.first_name or 'Super'
        user.last_name = user.last_name or 'Administrator'
        user.email = user.email or 'admin@centerestates.demo'
        user.set_password(password)
        user.save()

        organization, _ = Organization.objects.update_or_create(
            slug='center-estates-demo',
            defaults={'name': 'Center Estates Demo', 'is_active': True, 'domain': 'erp.169-58-102-217.sslip.io'},
        )
        organization_settings = organization.settings or {}
        branding = organization_settings.get('branding') if isinstance(organization_settings.get('branding'), dict) else {}
        branding.update({
            'company_name': 'Center Estates',
            'address': 'Nairobi, Kenya',
            'phone': '',
            'email': 'management@centerestates.com',
            'logo_url': '',
        })
        organization_settings['branding'] = branding
        organization.settings = organization_settings
        organization.save(update_fields=('settings',))
        Membership.objects.update_or_create(
            organization=organization, user=user,
            defaults={'is_default': True, 'is_organization_admin': True, 'status': Membership.Status.ACTIVE},
        )
        # Explicit super-admin membership with platform-admin role for demo switching.
        for module, _label in Module.choices:
            Subscription.objects.update_or_create(
                organization=organization, module=module,
                defaults={'is_active': True, 'status': Subscription.Status.ACTIVE},
            )

        permission_catalog = {}
        domain_permissions = {
            Module.PROPERTY: ('operations', 'leasing', 'finance'),
            Module.FACILITY: ('work', 'inspect', 'administer'),
            Module.SALES: ('selling', 'visits', 'payments', 'legal'),
            Module.TENDER: ('intake', 'compliance', 'proposal', 'pricing', 'decision'),
            Module.VALUATION: ('coordinate', 'field', 'review', 'finance'),
            Module.MONITORING: ('project_admin', 'site', 'commercial', 'procurement', 'finance', 'certify'),
            Module.COMPANION: ('assign', 'performance'),
        }
        for module, module_label in Module.choices:
            for suffix, action_label in (
                ('view', 'View'), ('manage', 'Manage'), ('approve', 'Approve'), ('report', 'Export reports'),
            ):
                key = f'{module}.{suffix}'
                permission_catalog[key], _ = Permission.objects.update_or_create(
                    key=key, defaults={'label': f'{action_label} {module_label}', 'module': module},
                )
            for suffix in domain_permissions[module]:
                key = f'{module}.{suffix}'
                permission_catalog[key], _ = Permission.objects.update_or_create(
                    key=key,
                    defaults={'label': f'{module_label}: {suffix.replace("_", " ").title()}', 'module': module},
                )
        role, _ = Role.objects.get_or_create(
            organization=organization, slug='platform-admin', defaults={'name': 'Platform Administrator', 'is_system': True}
        )
        role.permissions.set(permission_catalog.values())
        MembershipRole.objects.get_or_create(
            membership=Membership.objects.get(organization=organization, user=user),
            role=role,
        )

        role_password = os.environ.get('SEED_ROLE_PASSWORD', password)

        def seed_role_user(username, first_name, last_name, role_obj, *, is_org_admin=False):
            # Roles exist with their permissions, but dummy user accounts are not created.
            return None

        for module, module_label in Module.choices:
            role_definitions = (
                ('viewer', f'{module_label} Viewer', ('view', 'report'), 'Viewer'),
                ('operator', f'{module_label} Operator', ('view', 'manage', 'report'), 'Operator'),
                ('approver', f'{module_label} Approver', ('view', 'approve', 'report'), 'Approver'),
            )
            for role_suffix, role_name, granted, person in role_definitions:
                role_slug = f'{module}-{role_suffix}'
                module_role, _ = Role.objects.update_or_create(
                    organization=organization, slug=role_slug,
                    defaults={'name': role_name, 'is_system': True},
                )
                module_role.permissions.set(permission_catalog[f'{module}.{suffix}'] for suffix in granted)
                seed_role_user(
                    f'role-{role_slug}',
                    module_label.split()[0],
                    person,
                    module_role,
                )

        business_roles = {
            'property-manager': ('Property Manager', Module.PROPERTY, ('view', 'operations', 'leasing', 'finance', 'approve', 'report'), 'Amina', 'Manager'),
            'leasing-officer': ('Leasing Officer', Module.PROPERTY, ('view', 'leasing', 'report'), 'Brian', 'Leasing'),
            'property-accountant': ('Property Accountant', Module.PROPERTY, ('view', 'finance', 'approve', 'report'), 'Carol', 'Accounts'),
            'facility-manager': ('Facility Manager', Module.FACILITY, ('view', 'work', 'inspect', 'administer', 'approve', 'report'), 'Daniel', 'Facilities'),
            'facility-technician': ('Facility Technician', Module.FACILITY, ('view', 'work'), 'Esther', 'Technician'),
            'caretaker': ('Property Caretaker', Module.FACILITY, ('view', 'work'), 'Peter', 'Caretaker'),
            'facility-inspector': ('Facility Inspector', Module.FACILITY, ('view', 'inspect', 'work'), 'Felix', 'Inspector'),
            'facility-occupant': ('Facility Occupant', Module.FACILITY, ('view',), 'Grace', 'Occupant'),
            'sales-developer': ('Sales Developer / Owner', Module.SALES, ('view', 'selling', 'visits', 'payments', 'legal', 'manage', 'approve', 'report'), 'Hassan', 'Developer'),
            'sales-agent': ('Sales Agent', Module.SALES, ('view', 'selling', 'visits', 'report'), 'Irene', 'Agent'),
            'site-clerk': ('Site Clerk', Module.SALES, ('view', 'visits'), 'James', 'Clerk'),
            'sales-financier': ('Sales Financier', Module.SALES, ('view', 'payments', 'approve', 'report'), 'Karen', 'Financier'),
            'sales-advocate': ('Sales Advocate', Module.SALES, ('view', 'legal'), 'Leo', 'Advocate'),
            'sales-relationship': ('Sales Relationship Manager', Module.SALES, ('view', 'report'), 'Mary', 'Relations'),
            'tender-manager': ('Tender Manager', Module.TENDER, ('view', 'intake', 'compliance', 'proposal', 'pricing', 'approve', 'report'), 'Nathan', 'Tenders'),
            'tender-analyst': ('Tender Analyst', Module.TENDER, ('view', 'compliance'), 'Olivia', 'Analyst'),
            'technical-author': ('Technical Author', Module.TENDER, ('view', 'proposal'), 'Paul', 'Author'),
            'pricing-officer': ('Pricing Officer', Module.TENDER, ('view', 'pricing'), 'Queenie', 'Pricing'),
            'tender-board-reviewer': ('Tender Board Reviewer', Module.TENDER, ('view', 'decision', 'approve', 'report'), 'Robert', 'Board'),
            'valuation-coordinator': ('Valuation Coordinator', Module.VALUATION, ('view', 'coordinate', 'report'), 'Sarah', 'Coordinator'),
            'valuer-inspector': ('Valuer and Inspector', Module.VALUATION, ('view', 'field', 'report'), 'Tom', 'Valuer'),
            'valuation-reviewer': ('Valuation Reviewer', Module.VALUATION, ('view', 'review', 'approve', 'report'), 'Uma', 'Reviewer'),
            'valuation-finance': ('Valuation Finance Officer', Module.VALUATION, ('view', 'finance', 'report'), 'Victor', 'ValFinance'),
            'construction-admin': ('Construction Project Administrator', Module.MONITORING, ('view', 'project_admin', 'site', 'commercial', 'procurement', 'finance', 'approve', 'certify', 'report'), 'Wanjiku', 'PM'),
            'clerk-of-works': ('Clerk of Works', Module.MONITORING, ('view', 'site', 'report'), 'Xavier', 'CoW'),
            'quantity-surveyor': ('Quantity Surveyor', Module.MONITORING, ('view', 'commercial', 'procurement', 'report'), 'Yvonne', 'QS'),
            'construction-certifier': ('Construction Certifier', Module.MONITORING, ('view', 'certify', 'approve', 'report'), 'Zuberi', 'Certifier'),
            'construction-finance': ('Construction Finance Officer', Module.MONITORING, ('view', 'finance', 'report'), 'Alice', 'ConFinance'),
            'construction-auditor': ('Construction Auditor', Module.MONITORING, ('view', 'report'), 'Ben', 'Auditor'),
        }
        for role_slug, (role_name, module, granted, first_name, last_name) in business_roles.items():
            business_role, _ = Role.objects.update_or_create(
                organization=organization, slug=role_slug,
                defaults={'name': role_name, 'is_system': True},
            )
            business_role.permissions.set(permission_catalog[f'{module}.{suffix}'] for suffix in granted)
            # Facility roles that create work orders need read-only access to
            # property references for the work-order property dropdown.
            if module == Module.FACILITY and ('work' in granted or 'inspect' in granted or 'administer' in granted):
                business_role.permissions.add(permission_catalog['property.view'])
            seed_role_user(f'role-{role_slug}', first_name, last_name, business_role)

        # Keep the client-facing role catalogue deliberately small. The
        # specialist roles above remain available to existing demo journeys,
        # while administrators configure day-to-day access from these four
        # broad presets or create a custom role in the feature matrix.
        core_roles = {
            'portfolio-manager': (
                'Portfolio Manager',
                tuple(key for key in permission_catalog if key.startswith(('property.', 'facility.', 'companion.'))),
            ),
            'finance-officer': (
                'Finance Officer',
                ('property.view', 'property.finance', 'property.approve', 'property.report', 'companion.view'),
            ),
            'operations-staff': (
                'Operations Staff',
                (
                    'property.view', 'facility.view', 'facility.manage', 'facility.work',
                    'facility.inspect', 'facility.report', 'companion.view', 'companion.manage',
                    'companion.assign',
                ),
            ),
            'read-only': (
                'Read Only',
                (
                    'property.view', 'property.report', 'facility.view', 'facility.report',
                    'companion.view', 'companion.report',
                ),
            ),
        }
        core_people = {
            'portfolio-manager': ('Morgan', 'Manager'),
            'finance-officer': ('Faith', 'Finance'),
            'operations-staff': ('Otieno', 'Operations'),
            'read-only': ('Rita', 'Reviewer'),
        }
        for role_slug, (role_name, keys) in core_roles.items():
            core_role, created = Role.objects.get_or_create(
                organization=organization,
                slug=role_slug,
                defaults={'name': role_name, 'is_system': True},
            )
            if created:
                core_role.permissions.set(permission_catalog[key] for key in keys)
            first_name, last_name = core_people[role_slug]
            seed_role_user(f'role-{role_slug}', first_name, last_name, core_role)

        prop, _ = Property.objects.update_or_create(
            organization=organization, code='CE-NRB-001',
            defaults={
                'name': 'Westlands Business Centre',
                'property_type': 'Commercial',
                'status': Property.Status.ACTIVE,
                'city': 'Nairobi',
                'address': 'Waiyaki Way, Westlands, Nairobi',
                'latitude': Decimal('-1.267600'),
                'longitude': Decimal('36.810800'),
                'metadata': {
                    'cover_image': 'commercial-westlands',
                    'map_label': 'WBC',
                    'neighborhood': 'Westlands',
                    'lr_number': 'Nairobi/Block 90/441',
                    'landlord': {
                        'name': 'Center Estates Holdings Ltd',
                        'vat_registered': True,
                        'pin': 'P051234567X',
                    },
                },
            },
        )
        organization_settings = organization.settings or {}
        branding = organization_settings.get('branding') if isinstance(organization_settings.get('branding'), dict) else {}
        branding.update({
            'company_name': 'Center Estates',
            'address': 'Dolphine Plaza, Mbagathi Road, Nairobi, Kenya',
            'phone': '+254 722 574 400',
            'email': 'management@centerestates.com',
            'tax_pin': 'P051234567X',
        })
        organization_settings['branding'] = branding
        organization.settings = organization_settings
        organization.save(update_fields=('settings',))
        building, _ = Building.objects.update_or_create(
            organization=organization, property=prop, code='TOWER-A',
            defaults={'name': 'Tower A', 'floors': 12},
        )
        units = {}
        for number, unit_type, area, status in (
            (101, 'Office', '125.00', Unit.Status.OCCUPIED),
            (102, 'Retail', '84.50', Unit.Status.OCCUPIED),
            (201, 'Office', '140.00', Unit.Status.AVAILABLE),
            (301, 'Office', '155.00', Unit.Status.AVAILABLE),
        ):
            units[number], _ = Unit.objects.update_or_create(
                organization=organization, property=prop, code=str(number),
                defaults={
                    'building': building, 'floor': str(number)[0], 'unit_type': unit_type,
                    'area': Decimal(area), 'status': status,
                },
            )
        project, _ = Project.objects.update_or_create(
            organization=organization, code='CE-REFURB-01',
            defaults={'name': 'Tower A Refurbishment', 'property': prop, 'status': Project.Status.ACTIVE},
        )

        today = timezone.localdate()
        tenant_one, _ = Tenant.objects.update_or_create(
            organization=organization, code='TEN-001',
            defaults={
                'name': 'Acacia Consulting Ltd', 'tenant_type': 'company',
                'email': 'accounts@acacia.example', 'phone': '+254 700 111 222',
                'property': prop, 'tax_id': 'P051234567A', 'registration_number': 'CPR/2016/18421',
                'directors': ['Jane Wanjiku', 'Peter Otieno'], 'status': Tenant.Status.ACTIVE,
                'billing_address': 'Westlands, Nairobi',
            },
        )
        tenant_two, _ = Tenant.objects.update_or_create(
            organization=organization, code='TEN-002',
            defaults={
                'name': 'Bluebird Retail Kenya', 'tenant_type': 'company',
                'email': 'finance@bluebird.example', 'phone': '+254 711 333 444',
                'property': prop, 'tax_id': 'P051987654B', 'registration_number': 'CPR/2019/34782',
                'directors': ['Amina Hassan'], 'status': Tenant.Status.ACTIVE, 'billing_address': 'Parklands, Nairobi',
            },
        )
        TenantPortalAccess.objects.update_or_create(
            organization=organization, user=user,
            defaults={'tenant': tenant_one, 'is_active': True},
        )
        occupant_user = get_user_model().objects.filter(username='role-facility-occupant').first()
        if occupant_user:
            TenantPortalAccess.objects.update_or_create(
                organization=organization, user=occupant_user,
                defaults={'tenant': tenant_one, 'is_active': True},
            )
        Notification.objects.update_or_create(
            organization=organization, recipient=user, title='Water shutdown notice',
            defaults={
                'message': 'Tower A water service will pause from 10:00 to 12:00 for planned maintenance.',
                'level': Notification.Level.INFO, 'action_url': '/tenant-portal',
                'metadata': {'audience': 'tenant'},
            },
        )
        lease_one, _ = Lease.objects.update_or_create(
            organization=organization, reference='LS-2026-001',
            defaults={
                'unit': units[101], 'tenant': tenant_one,
                'starts_on': today - timedelta(days=180), 'ends_on': today + timedelta(days=550),
                'monthly_rent': Decimal('185000.00'), 'deposit': Decimal('370000.00'),
                'escalation_percent': Decimal('7.50'), 'billing_day': 1, 'status': Lease.Status.ACTIVE,
            },
        )
        lease_two, _ = Lease.objects.update_or_create(
            organization=organization, reference='LS-2025-014',
            defaults={
                'unit': units[102], 'tenant': tenant_two,
                'starts_on': today - timedelta(days=330), 'ends_on': today + timedelta(days=35),
                'monthly_rent': Decimal('120000.00'), 'deposit': Decimal('240000.00'),
                'escalation_percent': Decimal('5.00'), 'billing_day': 5, 'status': Lease.Status.EXPIRING,
            },
        )
        tenant_prospect, _ = Tenant.objects.update_or_create(
            organization=organization, code='TEN-003',
            defaults={
                'name': 'Cedar Design Studio', 'tenant_type': 'company',
                'email': 'admin@cedar.example', 'phone': '+254 722 456 789',
                'property': prop, 'tax_id': 'P051222333C', 'registration_number': 'BN/2024/90817',
                'directors': ['Lucy Muthoni'], 'status': Tenant.Status.PROSPECT, 'billing_address': 'Kilimani, Nairobi',
            },
        )
        Lease.objects.update_or_create(
            organization=organization, reference='LS-2026-DRAFT',
            defaults={
                'unit': units[201], 'tenant': tenant_prospect,
                'starts_on': today + timedelta(days=14), 'ends_on': today + timedelta(days=744),
                'monthly_rent': Decimal('210000.00'), 'deposit': Decimal('420000.00'),
                'escalation_percent': Decimal('7.50'), 'billing_day': 1, 'status': Lease.Status.DRAFT,
            },
        )
        invoice_one, _ = Invoice.objects.update_or_create(
            organization=organization, number='INV-2026-0701',
            defaults={
                'lease': lease_one, 'invoice_type': 'rent', 'issued_on': today - timedelta(days=30),
                'due_on': today - timedelta(days=23), 'amount': Decimal('185000.00'),
                'balance': Decimal('0.00'), 'status': Invoice.Status.PAID,
            },
        )
        invoice_two, _ = Invoice.objects.update_or_create(
            organization=organization, number='INV-2026-0702',
            defaults={
                'lease': lease_two, 'invoice_type': 'rent', 'issued_on': today - timedelta(days=30),
                'due_on': today - timedelta(days=20), 'amount': Decimal('120000.00'),
                'balance': Decimal('100000.00'), 'status': Invoice.Status.OVERDUE,
            },
        )
        Invoice.objects.update_or_create(
            organization=organization, number='INV-2026-DRAFT',
            defaults={
                'lease': lease_one, 'invoice_type': 'service_charge', 'issued_on': today,
                'due_on': today + timedelta(days=14), 'amount': Decimal('25000.00'),
                'balance': Decimal('25000.00'), 'status': Invoice.Status.DRAFT,
            },
        )
        receipt, _ = Receipt.objects.update_or_create(
            organization=organization, number='RCT-2026-0418',
            defaults={
                'tenant': tenant_one, 'invoice': invoice_one, 'received_on': today - timedelta(days=25),
                'amount': Decimal('185000.00'), 'payment_method': 'bank_transfer',
                'external_reference': 'FT260418ACACIA', 'received_by': user,
            },
        )
        ReceiptAllocation.objects.update_or_create(
            organization=organization, receipt=receipt, invoice=invoice_one,
            defaults={'amount': Decimal('185000.00'), 'allocated_by': user},
        )
        BankTransaction.objects.update_or_create(
            organization=organization, reference='FT260418ACACIA',
            defaults={
                'transacted_on': receipt.received_on, 'description': 'Acacia Consulting rent payment',
                'amount': receipt.amount, 'status': BankTransaction.Status.MATCHED,
                'receipt': receipt, 'matched_by': user, 'matched_at': timezone.now() - timedelta(days=25),
            },
        )
        reminder_message = f'Invoice {invoice_two.number} has an outstanding balance of {invoice_two.balance}.'
        InvoiceReminder.objects.update_or_create(
            organization=organization, invoice=invoice_two, channel=InvoiceReminder.Channel.PORTAL,
            recipient=tenant_two.name, message=reminder_message,
            defaults={
                'sent_at': timezone.now() - timedelta(days=2), 'sent_by': user,
            },
        )
        CreditNote.objects.update_or_create(
            organization=organization, number='CN-2026-0021',
            defaults={
                'invoice': invoice_two, 'issued_on': today - timedelta(days=8),
                'amount': Decimal('20000.00'), 'reason': 'Approved service interruption abatement',
                'status': CreditNote.Status.ISSUED, 'issued_by': user,
            },
        )
        TenantDocument.objects.update_or_create(
            organization=organization, tenant=tenant_one,
            document_type='tax_compliance', document_number='TCC-ACACIA-2026',
            defaults={
                'file_url': '/media/tenant-documents/acacia-tax-compliance.pdf',
                'issued_on': today - timedelta(days=90), 'expires_on': today + timedelta(days=275),
                'status': TenantDocument.Status.VERIFIED, 'verified_by': user,
                'verified_at': timezone.now() - timedelta(days=89),
            },
        )
        TenantDocument.objects.update_or_create(
            organization=organization, tenant=tenant_two,
            document_type='business_registration', document_number='BR-BLUEBIRD-2026',
            defaults={
                'file_url': '/media/tenant-documents/bluebird-registration.pdf',
                'issued_on': today - timedelta(days=45), 'expires_on': today + timedelta(days=320),
                'status': TenantDocument.Status.PENDING,
            },
        )
        RentSchedule.objects.update_or_create(
            organization=organization, invoice=invoice_two,
            defaults={
                'lease': lease_two, 'period_start': today.replace(day=1),
                'period_end': (today.replace(day=28) + timedelta(days=4)).replace(day=1),
                'due_on': today.replace(day=lease_two.billing_day),
                'base_rent': Decimal('120000.00'), 'escalation_amount': Decimal('0.00'),
                'service_charge': Decimal('0.00'), 'total': Decimal('120000.00'),
                'status': RentSchedule.Status.INVOICED,
            },
        )
        next_period = (today.replace(day=28) + timedelta(days=4)).replace(day=1)
        following_period = (next_period.replace(day=28) + timedelta(days=4)).replace(day=1)
        RentSchedule.objects.update_or_create(
            organization=organization, lease=lease_one, period_start=next_period,
            defaults={
                'period_end': following_period, 'due_on': next_period,
                'base_rent': lease_one.monthly_rent, 'escalation_amount': Decimal('0.00'),
                'service_charge': Decimal('25000.00'), 'total': lease_one.monthly_rent + Decimal('25000.00'),
                'status': RentSchedule.Status.UPCOMING, 'invoice': None,
            },
        )
        Expense.objects.update_or_create(
            organization=organization, property=prop, invoice_number='EXP-POWER-0726',
            defaults={
                'supplier': 'Nairobi Power Services', 'category': 'Utilities',
                'incurred_on': today - timedelta(days=12), 'amount': Decimal('68500.00'),
                'status': Expense.Status.APPROVED, 'description': 'Common-area electricity and generator service.',
            },
        )
        Expense.objects.update_or_create(
            organization=organization, property=prop, invoice_number='EXP-LIFT-PENDING',
            defaults={
                'supplier': 'Vertical Transport Services', 'category': 'Repairs & maintenance',
                'incurred_on': today - timedelta(days=2), 'amount': Decimal('145000.00'),
                'status': Expense.Status.PENDING, 'description': 'Quarterly lift maintenance awaiting approval.',
            },
        )
        Budget.objects.update_or_create(
            organization=organization, property=prop, year=today.year, category='Repairs & maintenance',
            defaults={
                'amount': Decimal('2400000.00'), 'status': Budget.Status.APPROVED,
                'approved_by': user, 'approved_at': timezone.now() - timedelta(days=90),
            },
        )
        Budget.objects.update_or_create(
            organization=organization, property=prop, year=today.year, category='Utilities',
            defaults={'amount': Decimal('1800000.00'), 'status': Budget.Status.PENDING},
        )
        service_charge, _ = ServiceCharge.objects.update_or_create(
            organization=organization, property=prop, name=f'{today.year} Commercial Service Charge',
            defaults={
                'method': ServiceCharge.Method.AREA, 'annual_budget': Decimal('3600000.00'),
                'starts_on': today.replace(month=1, day=1), 'is_active': True,
            },
        )
        total_area = sum((unit.area or Decimal('0') for unit in units.values()), Decimal('0'))
        allocated_amount = Decimal('0')
        allocation_rows = []
        for index, unit in enumerate(units.values()):
            ratio = ((unit.area or Decimal('0')) / total_area).quantize(Decimal('0.000001'))
            annual_amount = (service_charge.annual_budget * ratio).quantize(Decimal('0.01'))
            if index == len(units) - 1:
                annual_amount = service_charge.annual_budget - allocated_amount
                ratio = Decimal('1') - sum((row.ratio for row in allocation_rows), Decimal('0'))
            allocation, _ = ServiceChargeAllocation.objects.update_or_create(
                organization=organization, service_charge=service_charge, unit=unit,
                defaults={
                    'ratio': ratio, 'annual_amount': annual_amount,
                    'monthly_amount': (annual_amount / Decimal('12')).quantize(Decimal('0.01')),
                },
            )
            allocation_rows.append(allocation)
            allocated_amount += annual_amount
        ytd_budget = (service_charge.annual_budget * Decimal(today.timetuple().tm_yday) / Decimal('366' if today.year % 4 == 0 else '365')).quantize(Decimal('0.01'))
        ServiceChargeReconciliation.objects.update_or_create(
            organization=organization, service_charge=service_charge,
            period_start=today.replace(month=1, day=1), period_end=today,
            defaults={
                'budgeted_amount': ytd_budget, 'actual_amount': Decimal('68500.00'),
                'variance': ytd_budget - Decimal('68500.00'),
                'status': ServiceChargeReconciliation.Status.DRAFT, 'prepared_by': user,
            },
        )
        contractor, _ = Contractor.objects.update_or_create(
            organization=organization, code='CTR-001',
            defaults={
                'name': 'AquaFix Services Ltd', 'specialty': 'Plumbing & drainage',
                'contact_name': 'Miriam Wanjiku', 'email': 'service@aquafix.example',
                'phone': '+254 722 555 100', 'status': Contractor.Status.ACTIVE,
                'rating': Decimal('4.70'), 'insurance_expires_on': today + timedelta(days=240),
                'license_expires_on': today + timedelta(days=150),
            },
        )
        lift, _ = FacilityAsset.objects.update_or_create(
            organization=organization, code='LFT-TA-01',
            defaults={
                'name': 'Tower A Passenger Lift 1', 'category': 'Mechanical', 'property': prop,
                'building': building, 'manufacturer': 'KONE', 'model_number': 'MonoSpace 500',
                'serial_number': 'KNE-22190', 'installed_on': today - timedelta(days=730),
                'warranty_expires_on': today + timedelta(days=365), 'purchase_value': Decimal('8400000.00'),
                'condition': FacilityAsset.Condition.GOOD, 'is_active': True,
            },
        )
        generator, _ = FacilityAsset.objects.update_or_create(
            organization=organization, code='GEN-TA-01',
            defaults={
                'name': 'Tower A Standby Generator', 'category': 'Electrical', 'property': prop,
                'building': building, 'manufacturer': 'Cummins', 'model_number': 'C275D5',
                'serial_number': 'CMN-77501', 'purchase_value': Decimal('5700000.00'),
                'condition': FacilityAsset.Condition.FAIR, 'is_active': True,
            },
        )
        work_order, _ = WorkOrder.objects.update_or_create(
            organization=organization, number='WO-2026-1787',
            defaults={
                'title': 'Water leakage near lift lobby', 'description': 'Investigate and repair leaking cold-water pipe joint.',
                'category': 'Plumbing & drainage', 'property': prop, 'asset': lift, 'contractor': contractor,
                'assigned_to': user, 'reported_by': user, 'priority': WorkOrder.Priority.HIGH,
                'status': WorkOrder.Status.IN_PROGRESS, 'reported_at': timezone.now() - timedelta(days=1),
                'response_due_at': timezone.now() - timedelta(hours=18),
                'resolution_due_at': timezone.now() + timedelta(hours=5), 'scheduled_for': timezone.now(),
                'labor_cost': Decimal('2500.00'), 'parts_cost': Decimal('2470.00'),
                'other_cost': Decimal('300.00'), 'progress': 60,
            },
        )
        WorkOrderEvent.objects.update_or_create(
            organization=organization, work_order=work_order, event_type='status_change',
            from_status=WorkOrder.Status.ASSIGNED, to_status=WorkOrder.Status.IN_PROGRESS,
            defaults={'notes': 'Technician checked in and isolated the leaking joint.', 'actor': user},
        )
        WorkOrderCostItem.objects.update_or_create(
            organization=organization, work_order=work_order, kind=WorkOrderCostItem.Kind.PART,
            description='Compression fitting and pipe section',
            defaults={
                'quantity': Decimal('1.000'), 'unit_cost': Decimal('2470.00'),
                'total': Decimal('2470.00'), 'supplier': 'AquaFix Stores',
                'reference': 'AF-DEL-8102', 'added_by': user,
            },
        )
        WorkOrderAttachment.objects.update_or_create(
            organization=organization, work_order=work_order, file_name='leak-before-repair.jpg',
            defaults={
                'file_url': '/media/work-orders/WO-2026-1787/leak-before-repair.jpg',
                'media_type': 'image/jpeg', 'caption': 'Leak location before isolation',
                'uploaded_by': user,
            },
        )
        WorkOrder.objects.update_or_create(
            organization=organization, number='WO-2026-1789',
            defaults={
                'title': 'Generator preventive service overdue', 'category': 'Electrical',
                'property': prop, 'asset': generator, 'assigned_to': user, 'reported_by': user,
                'priority': WorkOrder.Priority.CRITICAL, 'status': WorkOrder.Status.ASSIGNED,
                'reported_at': timezone.now() - timedelta(days=3),
                'response_due_at': timezone.now() - timedelta(days=2),
                'resolution_due_at': timezone.now() - timedelta(hours=6), 'progress': 15,
            },
        )
        PreventiveSchedule.objects.update_or_create(
            organization=organization, code='PM-LIFT-MONTHLY',
            defaults={
                'name': 'Monthly lift safety service', 'asset': lift,
                'frequency': PreventiveSchedule.Frequency.MONTHLY,
                'last_completed_on': today - timedelta(days=32), 'next_due_on': today - timedelta(days=2),
                'estimated_hours': Decimal('3.00'), 'instructions': 'Inspect brakes, doors, controls and emergency communication.',
            },
        )
        PreventiveSchedule.objects.update_or_create(
            organization=organization, code='PM-GEN-QUARTERLY',
            defaults={
                'name': 'Quarterly generator service', 'asset': generator,
                'frequency': PreventiveSchedule.Frequency.QUARTERLY,
                'last_completed_on': today - timedelta(days=55), 'next_due_on': today + timedelta(days=35),
                'estimated_hours': Decimal('5.00'), 'instructions': 'Load test, change filters and inspect starter batteries.',
            },
        )
        Inspection.objects.update_or_create(
            organization=organization, reference='INS-2026-0081',
            defaults={
                'title': 'Monthly fire and life safety inspection', 'inspection_type': 'Safety',
                'property': prop, 'inspector': user, 'scheduled_on': today - timedelta(days=5),
                'completed_on': today - timedelta(days=5), 'status': Inspection.Status.FOLLOW_UP,
                'score': Decimal('86.00'), 'findings': 'One fire extinguisher service tag has expired.',
                'violations': 1, 'follow_up_work_order': work_order,
            },
        )
        Inspection.objects.update_or_create(
            organization=organization, reference='INS-2026-0082',
            defaults={
                'title': 'Quarterly electrical distribution inspection', 'inspection_type': 'Electrical',
                'property': prop, 'inspector': user, 'scheduled_on': today + timedelta(days=3),
                'status': Inspection.Status.SCHEDULED,
            },
        )
        ServiceRequest.objects.update_or_create(
            organization=organization, reference='SR-2026-00123',
            defaults={
                'subject': 'Water leakage reported', 'description': 'Water dripping near the basement lift lobby.',
                'category': 'Plumbing', 'property': prop, 'unit': units[101], 'tenant': tenant_one,
                'status': ServiceRequest.Status.IN_PROGRESS, 'priority': WorkOrder.Priority.HIGH,
                'submitted_at': timezone.now() - timedelta(days=1),
                'response_due_at': timezone.now() - timedelta(hours=18), 'work_order': work_order,
            },
        )
        meter, _ = UtilityMeter.objects.update_or_create(
            organization=organization, code='ELC-TA-MAIN',
            defaults={
                'name': 'Tower A Unit 101 Electricity Meter', 'property': prop, 'property_unit': units[101],
                'utility_type': UtilityMeter.Utility.ELECTRICITY, 'unit': 'kWh',
                'tariff': Decimal('27.4500'), 'is_active': True,
            },
        )
        MeterReading.objects.update_or_create(
            organization=organization, meter=meter, read_at=timezone.now().replace(minute=0, second=0, microsecond=0),
            defaults={
                'value': Decimal('198420.000'), 'previous_value': Decimal('197175.000'),
                'consumption': Decimal('1245.000'), 'cost': Decimal('34175.25'),
                'is_anomaly': False, 'status': MeterReading.Status.APPROVED,
                'reviewed_by': user, 'reviewed_at': timezone.now(), 'review_notes': 'Seeded verified reading.',
            },
        )
        tax_vat, _ = TaxConfiguration.objects.update_or_create(
            organization=organization, code='VAT16', effective_from=today.replace(month=1, day=1),
            defaults={'name': 'Output VAT 16%', 'rate': Decimal('16.0000'), 'is_active': True},
        )
        rent_item, _ = BillingItem.objects.update_or_create(
            organization=organization, code='RENT',
            defaults={
                'name': 'Monthly rent', 'calculation': BillingItem.Calculation.FIXED,
                'income_category': 'rent', 'tax_configuration': tax_vat, 'is_recurring': True, 'is_active': True,
            },
        )
        water_item, _ = BillingItem.objects.update_or_create(
            organization=organization, code='WATER',
            defaults={
                'name': 'Water consumption', 'calculation': BillingItem.Calculation.METERED,
                'income_category': 'utilities', 'is_recurring': True, 'is_active': True,
            },
        )
        BillingProfile.objects.update_or_create(
            organization=organization, lease=lease_one, billing_item=rent_item,
            effective_from=lease_one.starts_on,
            defaults={
                'frequency': BillingProfile.Frequency.MONTHLY, 'calculation': BillingItem.Calculation.FIXED,
                'amount': lease_one.monthly_rent, 'billing_day': lease_one.billing_day, 'is_active': True,
            },
        )
        BillingProfile.objects.update_or_create(
            organization=organization, lease=lease_one, billing_item=water_item,
            effective_from=lease_one.starts_on,
            defaults={
                'frequency': BillingProfile.Frequency.METERED, 'calculation': BillingItem.Calculation.METERED,
                'amount': Decimal('0'), 'billing_day': lease_one.billing_day, 'is_active': True,
            },
        )
        primary_bulk_water, _ = UtilityMeter.objects.update_or_create(
            organization=organization, code='WATER-BULK-CE-NRB-001',
            defaults={
                'name': 'Westlands Bulk Water', 'property': prop,
                'utility_type': UtilityMeter.Utility.WATER, 'meter_role': UtilityMeter.MeterRole.BULK,
                'unit': 'm3', 'tariff': Decimal('120.0000'), 'is_active': True,
            },
        )
        primary_check_water, _ = UtilityMeter.objects.update_or_create(
            organization=organization, code='WATER-CE-NRB-001-U101',
            defaults={
                'name': 'Tower A Unit 101 Water', 'property': prop, 'property_unit': units[101],
                'utility_type': UtilityMeter.Utility.WATER, 'meter_role': UtilityMeter.MeterRole.CHECK,
                'parent_meter': primary_bulk_water, 'unit': 'm3', 'tariff': Decimal('120.0000'), 'is_active': True,
            },
        )
        MeterReading.objects.update_or_create(
            organization=organization, meter=primary_check_water,
            read_at=timezone.now().replace(minute=0, second=0, microsecond=0) - timedelta(hours=2),
            defaults={
                'value': Decimal('920'), 'previous_value': Decimal('880'), 'consumption': Decimal('40'),
                'cost': Decimal('4800'), 'status': MeterReading.Status.APPROVED, 'reviewed_by': user,
                'reviewed_at': timezone.now(), 'method': MeterReading.Method.MANUAL, 'recorded_by': user,
                'review_notes': 'Seeded approved primary water reading.',
            },
        )
        MeterReconciliation.objects.update_or_create(
            organization=organization, bulk_meter=primary_bulk_water, period_start=today.replace(day=1),
            defaults={
                'period_end': today, 'bulk_consumption': Decimal('1100'), 'check_consumption': Decimal('980'),
                'variance': Decimal('120'), 'variance_percent': Decimal('10.909'), 'tolerance_percent': Decimal('5'),
                'status': MeterReconciliation.Status.APPROVED, 'reviewed_by': user, 'reviewed_at': timezone.now(),
                'review_notes': 'Seeded approved bulk/check reconciliation for Westlands.',
            },
        )
        UnitStatusHistory.objects.update_or_create(
            organization=organization, unit=units[101], effective_from=lease_one.starts_on,
            defaults={
                'status': Unit.Status.OCCUPIED, 'reason': 'Seeded primary lease commencement',
                'expected_monthly_rent': lease_one.monthly_rent, 'expected_service_charge': Decimal('25000'),
                'recorded_by': user,
            },
        )
        UnitStatusHistory.objects.update_or_create(
            organization=organization, unit=units[301], effective_from=today - timedelta(days=60),
            defaults={
                'status': Unit.Status.AVAILABLE, 'reason': 'Seeded vacancy for occupancy reports',
                'expected_monthly_rent': Decimal('198000'), 'expected_service_charge': Decimal('18000'),
                'recorded_by': user,
            },
        )
        TenantMovement.objects.update_or_create(
            organization=organization, lease=lease_one, kind=TenantMovement.Kind.MOVE_IN,
            effective_on=lease_one.starts_on,
            defaults={'tenant': lease_one.tenant, 'unit': units[101], 'reason': 'Seeded move-in', 'recorded_by': user},
        )
        listing_one, _ = SaleListing.objects.update_or_create(
            organization=organization, unit=units[201],
            defaults={
                'project': project, 'list_price': Decimal('28500000.00'),
                'minimum_deposit_percent': Decimal('20.00'), 'status': SaleListing.Status.RESERVED,
                'construction_progress': Decimal('72.00'), 'reservation_expires_at': timezone.now() + timedelta(days=14),
            },
        )
        listing_two, _ = SaleListing.objects.update_or_create(
            organization=organization, unit=units[301],
            defaults={
                'project': project, 'list_price': Decimal('19800000.00'),
                'minimum_deposit_percent': Decimal('15.00'), 'status': SaleListing.Status.AVAILABLE,
                'construction_progress': Decimal('72.00'),
            },
        )
        buyer, _ = Buyer.objects.update_or_create(
            organization=organization, reference='BUY-2026-0042',
            defaults={
                'full_name': 'Grace Wambui Njoroge', 'email': 'grace.wambui@example.com',
                'phone': '+254 712 808 424', 'id_number': '28910422', 'tax_number': 'A009281042L',
                'address': 'Kilimani, Nairobi', 'financing_type': 'bank', 'financier': 'Housing Finance Kenya',
                'status': Buyer.Status.ACTIVE, 'assigned_agent': user, 'confirmed_at': timezone.now() - timedelta(days=28),
            },
        )
        Buyer.objects.update_or_create(
            organization=organization, reference='BUY-2026-0043',
            defaults={
                'full_name': 'Peter Kamau Mwangi', 'email': 'peter.kamau@example.com',
                'phone': '+254 701 303 030', 'id_number': '31124567',
                'address': 'Lavington, Nairobi', 'financing_type': 'self',
                'status': Buyer.Status.LEAD, 'assigned_agent': user,
            },
        )
        sale, _ = PropertySale.objects.update_or_create(
            organization=organization, reference='SALE-2026-0031',
            defaults={
                'buyer': buyer, 'listing': listing_one, 'agent': user,
                'agreed_price': Decimal('27800000.00'), 'reservation_fee': Decimal('250000.00'),
                'reserved_at': timezone.now() - timedelta(days=25), 'contracted_on': today - timedelta(days=14),
                'expected_completion_on': today + timedelta(days=250), 'status': PropertySale.Status.CONTRACTED,
            },
        )
        deposit, _ = Installment.objects.update_or_create(
            organization=organization, sale=sale, sequence=1,
            defaults={
                'description': '20% contract deposit', 'due_on': today - timedelta(days=10),
                'amount': Decimal('5560000.00'), 'paid_amount': Decimal('5560000.00'),
                'status': Installment.Status.PAID, 'milestone': 'Contract signing',
            },
        )
        second_installment, _ = Installment.objects.update_or_create(
            organization=organization, sale=sale, sequence=2,
            defaults={
                'description': 'Second construction installment', 'due_on': today + timedelta(days=45),
                'amount': Decimal('4170000.00'), 'paid_amount': Decimal('0.00'),
                'status': Installment.Status.UPCOMING, 'milestone': 'Roof slab completion',
            },
        )
        verified_payment, _ = SalePayment.objects.update_or_create(
            organization=organization, reference='PAY-2026-0098',
            defaults={
                'sale': sale, 'installment': deposit, 'paid_on': today - timedelta(days=11),
                'amount': Decimal('5560000.00'), 'method': 'bank', 'external_reference': 'FT26201GWAM',
                'status': SalePayment.Status.VERIFIED, 'verified_by': user,
                'verified_at': timezone.now() - timedelta(days=10),
            },
        )
        pending_payment, _ = SalePayment.objects.update_or_create(
            organization=organization, reference='PAY-2026-0106',
            defaults={
                'sale': sale, 'installment': second_installment, 'paid_on': today,
                'amount': Decimal('250000.00'), 'method': 'paybill', 'external_reference': 'RGA4K8Z21P',
                'status': SalePayment.Status.PENDING,
            },
        )
        SiteVisit.objects.update_or_create(
            organization=organization, reference='VIS-2026-0155',
            defaults={
                'visitor_name': 'Daniel Otieno', 'email': 'daniel.otieno@example.com',
                'phone': '+254 723 515 515', 'project': project, 'interested_unit_type': 'Office',
                'introducing_agent': user, 'visited_at': timezone.now() - timedelta(days=2),
                'follow_up_on': today + timedelta(days=2), 'notes': 'Interested in upper-floor corner units.',
            },
        )
        AgentCommission.objects.update_or_create(
            organization=organization, reference='COM-2026-0029',
            defaults={
                'sale': sale, 'agent': user, 'rate_percent': Decimal('2.00'),
                'amount': Decimal('556000.00'), 'required_paid_percent': Decimal('20.00'),
                'required_construction_percent': Decimal('50.00'),
                'status': AgentCommission.Status.ELIGIBLE,
            },
        )
        SalesAuditEvent.objects.update_or_create(
            organization=organization, payment=verified_payment, event_type='payment_verified',
            defaults={
                'sale': sale, 'from_status': SalePayment.Status.PENDING,
                'to_status': SalePayment.Status.VERIFIED,
                'details': {'allocated': str(verified_payment.amount), 'installment': deposit.sequence},
                'actor': user,
            },
        )
        SalesAuditEvent.objects.update_or_create(
            organization=organization, payment=pending_payment, event_type='payment_submitted',
            defaults={
                'sale': sale, 'to_status': SalePayment.Status.PENDING,
                'details': {'source': 'seed demonstration'}, 'actor': user,
            },
        )
        SalesAuditEvent.objects.update_or_create(
            organization=organization, sale=sale, payment=None, event_type='sale_status_change',
            defaults={
                'from_status': PropertySale.Status.RESERVED,
                'to_status': PropertySale.Status.CONTRACTED,
                'notes': 'Agreement executed after deposit clearance.', 'actor': user,
            },
        )
        SaleDocument.objects.update_or_create(
            organization=organization, sale=sale, checksum='demo-sale-agreement-v1-sha256',
            defaults={
                'document_type': 'sale_agreement', 'title': 'Executed Agreement for Sale',
                'file_url': '', 'signed_on': today - timedelta(days=14), 'is_final': True,
            },
        )
        tender, _ = Tender.objects.update_or_create(
            organization=organization, reference='TND-2026-0047',
            defaults={
                'title': 'Integrated Facilities Management Services', 'client': 'Nairobi Metropolitan Authority',
                'description': 'Three-year facilities management framework for public office complexes.',
                'category': 'Facilities management', 'source': 'Public Procurement Portal',
                'published_on': today - timedelta(days=12),
                'clarification_deadline': timezone.now() + timedelta(days=4),
                'submission_deadline': timezone.now() + timedelta(days=12),
                'estimated_value': Decimal('185000000.00'), 'currency': 'KES',
                'stage': Tender.Stage.TECHNICAL, 'owner': user, 'property': prop, 'readiness_score': Decimal('64.00'),
            },
        )
        for category, text, status, confidence, citation in (
            ('Eligibility', 'Valid tax compliance certificate', 'met', '98.00', 'Section 2.1, page 14'),
            ('Technical', 'At least three comparable contracts completed in five years', 'confirmed', '94.00', 'Section 4.3, page 31'),
            ('Financial', 'Bid security of KES 2,000,000', 'gap', '99.00', 'Tender Data Sheet, page 8'),
        ):
            TenderRequirement.objects.update_or_create(
                organization=organization, tender=tender, category=category, text=text,
                defaults={'mandatory': True, 'status': status, 'confidence': Decimal(confidence), 'citation': citation, 'model_version': 'extraction-v1', 'confirmed_by': user},
            )
        BidDecision.objects.update_or_create(
            organization=organization, tender=tender,
            defaults={
                'eligibility_score': Decimal('92'), 'profitability_score': Decimal('78'),
                'capacity_score': Decimal('84'), 'risk_score': Decimal('35'),
                'recommendation': 'bid', 'decision': 'approved',
                'rationale': 'Strong eligibility and delivery capacity with acceptable commercial risk.',
                'decided_by': user, 'decided_at': timezone.now() - timedelta(days=7),
            },
        )
        task_one, _ = TenderTask.objects.update_or_create(
            organization=organization, tender=tender, title='Complete technical methodology',
            defaults={'stage': Tender.Stage.TECHNICAL, 'owner': user, 'starts_on': today - timedelta(days=2), 'due_on': today + timedelta(days=3), 'status': 'in_progress', 'progress': 70},
        )
        TenderTask.objects.update_or_create(
            organization=organization, tender=tender, title='Obtain bid security',
            defaults={'stage': Tender.Stage.FINANCIAL, 'owner': user, 'starts_on': today, 'due_on': today + timedelta(days=5), 'status': 'pending', 'progress': 10, 'dependency': task_one},
        )
        CompanyDocument.objects.update_or_create(
            organization=organization, checksum='tax-compliance-demo-2026',
            defaults={'name': 'Tax Compliance Certificate', 'document_type': 'Tax compliance', 'version': '2026.1', 'issued_on': today - timedelta(days=120), 'expires_on': today + timedelta(days=22), 'status': 'expiring'},
        )
        ProposalSection.objects.update_or_create(
            organization=organization, tender=tender, sequence=1,
            defaults={'title': 'Technical approach and methodology', 'section_type': 'technical', 'owner': user, 'content': 'Mobilisation, preventive maintenance, helpdesk and SLA governance approach.', 'status': 'review', 'ai_assisted': True, 'version': 3},
        )
        FinancialItem.objects.update_or_create(
            organization=organization, tender=tender, code='FM-001',
            defaults={'description': 'Annual integrated facilities management fee', 'quantity': Decimal('3'), 'unit': 'year', 'unit_rate': Decimal('58500000'), 'amount': Decimal('175500000'), 'approved': False},
        )
        TenderReview.objects.update_or_create(
            organization=organization, tender=tender, reviewer=user, gate='Technical proposal review',
            defaults={'status': 'pending', 'comments': 'Awaiting final CV and mobilisation schedule.'},
        )
        submitted_tender, _ = Tender.objects.update_or_create(
            organization=organization, reference='TND-2026-0039',
            defaults={'title': 'Property Valuation Framework', 'client': 'County Pension Fund', 'category': 'Professional services', 'source': 'Direct invitation', 'published_on': today - timedelta(days=40), 'submission_deadline': timezone.now() - timedelta(days=5), 'estimated_value': Decimal('24000000'), 'currency': 'KES', 'stage': Tender.Stage.SUBMITTED, 'owner': user, 'property': prop, 'readiness_score': Decimal('100')},
        )
        tender_submission, _ = TenderSubmission.objects.update_or_create(
            organization=organization, tender=submitted_tender,
            defaults={'channel': 'e-procurement portal', 'submitted_at': timezone.now() - timedelta(days=5, hours=2), 'submitted_by': user, 'package_version': 'FINAL-1.0', 'package_checksum': 'demo-tender-package-sha256', 'receipt_reference': 'PPIP-RCT-260726-1048', 'compliant': True},
        )
        TenderAuditEvent.objects.update_or_create(
            organization=organization, tender=submitted_tender, event_type='submitted',
            defaults={
                'from_stage': Tender.Stage.PACKAGING, 'to_stage': Tender.Stage.SUBMITTED,
                'details': {'receipt_reference': tender_submission.receipt_reference, 'package_checksum': tender_submission.package_checksum},
                'actor': user,
            },
        )
        TenderAuditEvent.objects.update_or_create(
            organization=organization, tender=tender, event_type='stage_transition',
            from_stage=Tender.Stage.PLANNING, to_stage=Tender.Stage.TECHNICAL,
            defaults={
                'notes': 'Bid plan assigned and approved for technical response production.', 'actor': user,
            },
        )
        closed_tender, _ = Tender.objects.update_or_create(
            organization=organization, reference='TND-2026-0028',
            defaults={
                'title': 'County Office Maintenance Contract', 'client': 'Kiambu County Government',
                'category': 'Maintenance', 'source': 'Public Procurement Portal',
                'published_on': today - timedelta(days=90), 'submission_deadline': timezone.now() - timedelta(days=50),
                'estimated_value': Decimal('68000000'), 'currency': 'KES', 'stage': Tender.Stage.REGRETTED,
                'owner': user, 'property': prop, 'readiness_score': Decimal('100'),
            },
        )
        TenderOutcome.objects.update_or_create(
            organization=organization, tender=closed_tender,
            defaults={
                'result': 'regretted', 'notified_on': today - timedelta(days=25),
                'winner': 'Benchmark Facilities Ltd',
                'feedback': 'Strong technical response; competing price was lower.',
                'lessons_learned': 'Validate supplier rate assumptions earlier and increase pricing review time.',
            },
        )
        valuation_client, _ = ValuationClient.objects.update_or_create(
            organization=organization, code='VAL-CLI-001',
            defaults={
                'name': 'Equity Commercial Bank', 'client_type': 'bank',
                'contact_name': 'Jane Njeri', 'email': 'securities@equity.example',
                'phone': '+254 763 000 111', 'tax_number': 'P000112233Q', 'payment_terms_days': 30,
            },
        )
        instruction, _ = ValuationInstruction.objects.update_or_create(
            organization=organization, reference='VAL-2026-0184',
            defaults={
                'client': valuation_client, 'property': prop,
                'property_description': 'Westlands Business Centre, Tower A',
                'address': 'Waiyaki Way, Westlands, Nairobi', 'valuation_type': 'Commercial property',
                'purpose': 'Mortgage security', 'priority': 'high', 'valuer': user,
                'instructed_on': today - timedelta(days=12), 'due_on': today + timedelta(days=4),
                'quoted_fee': Decimal('185000.00'), 'status': ValuationInstruction.Status.REVIEW,
                'instructions': 'Provide market and forced-sale values with comparable evidence.',
            },
        )
        ValuationInspection.objects.update_or_create(
            organization=organization, reference='VINS-2026-0112',
            defaults={
                'instruction': instruction, 'inspector': user,
                'scheduled_at': timezone.now() - timedelta(days=7), 'completed_at': timezone.now() - timedelta(days=7, hours=-3),
                'contact_person': 'Peter Kamau', 'contact_phone': '+254 720 111 432',
                'latitude': Decimal('-1.267600'), 'longitude': Decimal('36.810800'),
                'status': ValuationInspection.Status.COMPLETED,
                'checklist': {'access': True, 'measurements': True, 'photographs': True, 'title_documents': True},
                'findings': 'Well-maintained Grade A commercial tower with strong occupancy and access.',
                'issues': 'Minor deferred maintenance to basement ventilation.', 'evidence_count': 28,
            },
        )
        ComparableEvidence.objects.update_or_create(
            organization=organization, instruction=instruction, reference='COMP-001',
            defaults={
                'address': 'Riverside Drive, Nairobi', 'property_type': 'Commercial office',
                'transaction_date': today - timedelta(days=95), 'transaction_price': Decimal('520000000.00'),
                'area': Decimal('4650.00'), 'rate_per_area': Decimal('111827.96'),
                'source': 'Registered transfer and market verification', 'adjustment_percent': Decimal('4.50'),
                'adjusted_value': Decimal('543400000.00'),
            },
        )
        draft, _ = DraftValuationReport.objects.update_or_create(
            organization=organization, instruction=instruction, version=2,
            defaults={
                'template': 'Commercial Mortgage Security', 'valuation_method': 'Investment and comparable methods',
                'assessed_value': Decimal('610000000.00'), 'market_value': Decimal('585000000.00'),
                'forced_sale_value': Decimal('438750000.00'), 'prepared_by': user, 'reviewer': user,
                'status': DraftValuationReport.Status.REVIEW,
                'review_notes': 'Confirm current passing rent and capitalization rate before approval.',
            },
        )
        final_instruction, _ = ValuationInstruction.objects.update_or_create(
            organization=organization, reference='VAL-2026-0161',
            defaults={
                'client': valuation_client, 'property': prop, 'property_description': 'Tower A Retail Unit 102',
                'address': 'Waiyaki Way, Westlands, Nairobi', 'valuation_type': 'Retail unit',
                'purpose': 'Financial reporting', 'priority': 'normal', 'valuer': user,
                'instructed_on': today - timedelta(days=35), 'due_on': today - timedelta(days=18),
                'quoted_fee': Decimal('95000.00'), 'status': ValuationInstruction.Status.DELIVERED,
            },
        )
        final_draft, _ = DraftValuationReport.objects.update_or_create(
            organization=organization, instruction=final_instruction, version=1,
            defaults={'template': 'Retail Unit Standard', 'valuation_method': 'Comparable method', 'assessed_value': Decimal('22500000'), 'market_value': Decimal('21800000'), 'forced_sale_value': Decimal('16350000'), 'prepared_by': user, 'reviewer': user, 'status': DraftValuationReport.Status.APPROVED},
        )
        final_report, _ = FinalValuationReport.objects.update_or_create(
            organization=organization, instruction=final_instruction,
            defaults={'draft': final_draft, 'report_number': 'VR-2026-0161-F', 'issued_on': today - timedelta(days=20), 'signed_by': user, 'market_value': Decimal('21800000'), 'checksum': 'valuation-final-report-demo-sha256', 'delivered_at': timezone.now() - timedelta(days=19), 'delivery_method': 'Secure client portal'},
        )
        valuation_invoice, _ = ValuationInvoice.objects.update_or_create(
            organization=organization, number='VINV-2026-0068',
            defaults={'instruction': final_instruction, 'issued_on': today - timedelta(days=20), 'due_on': today + timedelta(days=10), 'subtotal': Decimal('95000'), 'tax': Decimal('15200'), 'total': Decimal('110200'), 'balance': Decimal('55200'), 'status': ValuationInvoice.Status.PARTIAL},
        )
        valuation_payment, _ = ValuationPayment.objects.update_or_create(
            organization=organization, reference='VPAY-2026-0032',
            defaults={'invoice': valuation_invoice, 'paid_on': today - timedelta(days=4), 'amount': Decimal('55000'), 'method': 'bank_transfer', 'external_reference': 'EFT-VAL-260727', 'received_by': user},
        )
        ValuationAuditEvent.objects.update_or_create(
            organization=organization, instruction=final_instruction, event_type='final_report_issued',
            defaults={'from_status': ValuationInstruction.Status.REVIEW, 'to_status': ValuationInstruction.Status.FINAL, 'details': {'report_number': final_report.report_number, 'checksum': final_report.checksum}, 'actor': user},
        )
        ValuationAuditEvent.objects.update_or_create(
            organization=organization, instruction=final_instruction, event_type='delivered',
            defaults={'from_status': ValuationInstruction.Status.FINAL, 'to_status': ValuationInstruction.Status.DELIVERED, 'details': {'delivery_method': final_report.delivery_method}, 'actor': user},
        )
        ValuationAuditEvent.objects.update_or_create(
            organization=organization, instruction=final_instruction, event_type='payment_allocated',
            details={'payment_reference': valuation_payment.reference, 'invoice': valuation_invoice.number, 'amount': str(valuation_payment.amount)},
            defaults={'actor': user},
        )

        # Two additional, fully linked properties make cross-property context
        # switching observable in every operational module. Keep identifiers
        # deterministic so reseeding remains idempotent.
        additional_properties = (
            {
                'code': 'CE-NRB-002', 'name': 'Kilimani Heights Residences', 'type': 'Residential',
                'city': 'Nairobi', 'address': 'Kindaruma Road, Kilimani, Nairobi',
                'building': 'BLOCK-A', 'units': (('A-101', '2 Bedroom'), ('A-102', '2 Bedroom'), ('A-201', '3 Bedroom')),
                'tenant': ('TEN-KHR-001', 'Mara Family Holdings'), 'rent': Decimal('95000'),
                'asset': ('KHR-GEN-01', 'Standby Generator', 'Generator'),
            },
            {
                'code': 'CE-MSA-003', 'name': 'Nyali Trade Centre', 'type': 'Mixed Use',
                'city': 'Mombasa', 'address': 'Links Road, Nyali, Mombasa',
                'building': 'MAIN-BLOCK', 'units': (('G-01', 'Retail'), ('1-01', 'Office'), ('1-02', 'Office')),
                'tenant': ('TEN-NTC-001', 'Coastal Merchants Limited'), 'rent': Decimal('145000'),
                'asset': ('NTC-AC-01', 'Central Air Handling Unit', 'HVAC'),
            },
        )
        for index, spec in enumerate(additional_properties, start=2):
            scoped_property, _ = Property.objects.update_or_create(
                organization=organization, code=spec['code'],
                defaults={
                    'name': spec['name'], 'property_type': spec['type'], 'status': Property.Status.ACTIVE,
                    'city': spec['city'], 'address': spec['address'], 'country': 'KE',
                    'metadata': {
                        'seed_profile': 'comprehensive', 'portfolio_order': index,
                        'lr_number': f'LR/{spec["code"]}/{index:03d}',
                        'landlord': {
                            'name': 'Center Estates Holdings Ltd',
                            'vat_registered': True,
                            'pin': 'P051234567X',
                        },
                    },
                },
            )
            scoped_building, _ = Building.objects.update_or_create(
                organization=organization, property=scoped_property, code=spec['building'],
                defaults={'name': f"{spec['name']} — Main Building", 'floors': 8 if index == 2 else 5},
            )
            scoped_units = []
            for unit_index, (unit_code, unit_type) in enumerate(spec['units']):
                scoped_unit, _ = Unit.objects.update_or_create(
                    organization=organization, property=scoped_property, code=unit_code,
                    defaults={
                        'building': scoped_building, 'floor': str(unit_index + 1), 'unit_type': unit_type,
                        'area': Decimal('118.00') + Decimal(unit_index * 17),
                        'status': Unit.Status.OCCUPIED if unit_index == 0 else Unit.Status.AVAILABLE,
                    },
                )
                scoped_units.append(scoped_unit)
            scoped_project, _ = Project.objects.update_or_create(
                organization=organization, code=f'PRJ-{spec["code"]}',
                defaults={'name': f'{spec["name"]} Improvement Programme', 'property': scoped_property, 'status': Project.Status.ACTIVE},
            )
            ConstructionProject.objects.update_or_create(
                portfolio_project=scoped_project,
                defaults={
                    'organization': organization, 'name': scoped_project.name,
                    'code': f'CON-{spec["code"]}', 'client_name': 'Center Estates',
                    'location': spec['address'], 'country': 'Kenya', 'town': spec['city'],
                    'stage': 'active', 'project_type': 'mixed_use' if index == 3 else 'residential',
                    'description': f'Construction monitoring workspace for {spec["name"]}.',
                    'modules': ['overview', 'programme', 'cost', 'quality', 'safety'],
                    'onboarding_complete': True, 'wizard_step': 6,
                    'created_at': int(timezone.now().timestamp() * 1000),
                },
            )
            scoped_tenant, _ = Tenant.objects.update_or_create(
                organization=organization, code=spec['tenant'][0],
                defaults={
                    'name': spec['tenant'][1], 'tenant_type': 'company',
                    'email': f'accounts-{index}@centerestates.demo', 'phone': f'+254 700 300 00{index}',
                    'property': scoped_property, 'tax_id': f'P00000000{index}X',
                    'registration_number': f'CPR/202{index}/{index}0017',
                    'directors': [f'{spec["tenant"][1]} Director'], 'status': Tenant.Status.ACTIVE,
                    'billing_address': spec['address'],
                },
            )
            scoped_lease, _ = Lease.objects.update_or_create(
                organization=organization, reference=f'LS-2026-00{index}',
                defaults={
                    'unit': scoped_units[0], 'tenant': scoped_tenant,
                    'starts_on': today - timedelta(days=120), 'ends_on': today + timedelta(days=610),
                    'monthly_rent': spec['rent'], 'deposit': spec['rent'] * 2,
                    'escalation_percent': Decimal('7.50'), 'billing_day': 1, 'status': Lease.Status.ACTIVE,
                },
            )
            scoped_invoice, _ = Invoice.objects.update_or_create(
                organization=organization, number=f'INV-2026-08{index:02d}',
                defaults={
                    'lease': scoped_lease, 'invoice_type': 'rent', 'issued_on': today - timedelta(days=8),
                    'due_on': today - timedelta(days=1), 'amount': spec['rent'],
                    'balance': spec['rent'] / 2, 'status': Invoice.Status.PARTIAL,
                },
            )
            scoped_receipt, _ = Receipt.objects.update_or_create(
                organization=organization, number=f'RCT-2026-05{index:02d}',
                defaults={
                    'tenant': scoped_tenant, 'invoice': scoped_invoice, 'received_on': today - timedelta(days=3),
                    'amount': spec['rent'] / 2, 'payment_method': 'mpesa',
                    'external_reference': f'MPESA-SEED-{index}', 'received_by': user,
                },
            )
            ReceiptAllocation.objects.update_or_create(
                organization=organization, receipt=scoped_receipt, invoice=scoped_invoice,
                defaults={'amount': scoped_receipt.amount, 'allocated_by': user},
            )
            Budget.objects.update_or_create(
                organization=organization, property=scoped_property, year=today.year, category='Maintenance',
                defaults={'amount': Decimal('2400000') + Decimal(index * 350000), 'status': Budget.Status.APPROVED, 'approved_by': user, 'approved_at': timezone.now()},
            )
            scoped_charge, _ = ServiceCharge.objects.update_or_create(
                organization=organization, property=scoped_property, name=f'{today.year} Service Charge',
                defaults={'method': ServiceCharge.Method.AREA, 'annual_budget': Decimal('1800000') + Decimal(index * 200000), 'starts_on': today.replace(month=1, day=1), 'is_active': True},
            )
            ServiceChargeAllocation.objects.update_or_create(
                organization=organization, service_charge=scoped_charge, unit=scoped_units[0],
                defaults={'ratio': Decimal('1.000000'), 'annual_amount': scoped_charge.annual_budget, 'monthly_amount': (scoped_charge.annual_budget / 12).quantize(Decimal('0.01'))},
            )
            scoped_asset, _ = FacilityAsset.objects.update_or_create(
                organization=organization, code=spec['asset'][0],
                defaults={
                    'name': spec['asset'][1], 'category': spec['asset'][2], 'property': scoped_property,
                    'building': scoped_building, 'purchase_value': Decimal('3800000') + Decimal(index * 500000),
                    'condition': FacilityAsset.Condition.GOOD, 'is_active': True,
                },
            )
            scoped_work_order, _ = WorkOrder.objects.update_or_create(
                organization=organization, number=f'WO-2026-20{index}',
                defaults={
                    'title': f'Preventive service — {scoped_asset.name}', 'description': 'Comprehensive seeded maintenance workflow.',
                    'category': spec['asset'][2], 'property': scoped_property, 'asset': scoped_asset,
                    'assigned_to': user, 'reported_by': user, 'priority': WorkOrder.Priority.MEDIUM,
                    'status': WorkOrder.Status.IN_PROGRESS, 'reported_at': timezone.now() - timedelta(days=index),
                    'response_due_at': timezone.now() + timedelta(hours=4), 'resolution_due_at': timezone.now() + timedelta(days=2), 'progress': 45,
                },
            )
            Inspection.objects.update_or_create(
                organization=organization, reference=f'INS-2026-01{index}',
                defaults={
                    'title': f'{spec["name"]} compliance inspection', 'inspection_type': 'Compliance',
                    'property': scoped_property, 'asset': scoped_asset, 'inspector': user,
                    'scheduled_on': today + timedelta(days=index), 'status': Inspection.Status.SCHEDULED,
                },
            )
            scoped_meter, _ = UtilityMeter.objects.update_or_create(
                organization=organization, code=f'ELC-{spec["code"]}',
                defaults={
                    'name': f'{spec["name"]} Main Electricity', 'property': scoped_property,
                    'property_unit': scoped_units[0], 'utility_type': UtilityMeter.Utility.ELECTRICITY,
                    'unit': 'kWh', 'tariff': Decimal('28.1500'), 'is_active': True,
                },
            )
            MeterReading.objects.update_or_create(
                organization=organization, meter=scoped_meter, read_at=timezone.now().replace(minute=0, second=0, microsecond=0),
                defaults={'value': Decimal(10000 + index * 1250), 'previous_value': Decimal(9500 + index * 1200), 'consumption': Decimal(400 + index * 50), 'cost': Decimal(11260 + index * 1407), 'status': MeterReading.Status.APPROVED, 'reviewed_by': user, 'reviewed_at': timezone.now()},
            )
            bulk_water, _ = UtilityMeter.objects.update_or_create(
                organization=organization, code=f'WATER-BULK-{spec["code"]}',
                defaults={
                    'name': f'{spec["name"]} Bulk Water', 'property': scoped_property,
                    'utility_type': UtilityMeter.Utility.WATER, 'meter_role': UtilityMeter.MeterRole.BULK,
                    'unit': 'm3', 'tariff': Decimal('120.0000'), 'is_active': True,
                },
            )
            check_water, _ = UtilityMeter.objects.update_or_create(
                organization=organization, code=f'WATER-{spec["code"]}-U1',
                defaults={
                    'name': f'{spec["name"]} Unit water', 'property': scoped_property,
                    'property_unit': scoped_units[0], 'utility_type': UtilityMeter.Utility.WATER,
                    'meter_role': UtilityMeter.MeterRole.CHECK, 'parent_meter': bulk_water,
                    'unit': 'm3', 'tariff': Decimal('120.0000'), 'is_active': True,
                },
            )
            MeterReading.objects.update_or_create(
                organization=organization, meter=check_water,
                read_at=timezone.now().replace(minute=0, second=0, microsecond=0) - timedelta(hours=index),
                defaults={
                    'value': Decimal(800 + index * 40), 'previous_value': Decimal(760 + index * 35),
                    'consumption': Decimal(40 + index * 5), 'cost': Decimal((40 + index * 5) * 120),
                    'status': MeterReading.Status.APPROVED, 'reviewed_by': user, 'reviewed_at': timezone.now(),
                    'method': MeterReading.Method.MANUAL, 'recorded_by': user,
                    'review_notes': 'Seeded approved unit water reading for billing.',
                },
            )
            MeterReconciliation.objects.update_or_create(
                organization=organization, bulk_meter=bulk_water, period_start=today.replace(day=1),
                defaults={
                    'period_end': today, 'bulk_consumption': Decimal('1100') + Decimal(index * 25),
                    'check_consumption': Decimal('980') + Decimal(index * 20),
                    'variance': Decimal('120') + Decimal(index * 5),
                    'variance_percent': Decimal('10.909'), 'tolerance_percent': Decimal('5'),
                    'status': MeterReconciliation.Status.EXCEPTION if index == 1 else MeterReconciliation.Status.APPROVED,
                    'reviewed_by': user if index != 1 else None,
                    'reviewed_at': timezone.now() if index != 1 else None,
                    'review_notes': '' if index == 1 else 'Seeded approved bulk/check reconciliation.',
                },
            )
            BillingProfile.objects.update_or_create(
                organization=organization, lease=scoped_lease, billing_item=rent_item,
                effective_from=scoped_lease.starts_on,
                defaults={
                    'frequency': BillingProfile.Frequency.MONTHLY, 'calculation': BillingItem.Calculation.FIXED,
                    'amount': scoped_lease.monthly_rent, 'billing_day': scoped_lease.billing_day, 'is_active': True,
                },
            )
            BillingProfile.objects.update_or_create(
                organization=organization, lease=scoped_lease, billing_item=water_item,
                effective_from=scoped_lease.starts_on,
                defaults={
                    'frequency': BillingProfile.Frequency.METERED, 'calculation': BillingItem.Calculation.METERED,
                    'amount': Decimal('0'), 'billing_day': scoped_lease.billing_day, 'is_active': True,
                },
            )
            UnitStatusHistory.objects.update_or_create(
                organization=organization, unit=scoped_units[0], effective_from=scoped_lease.starts_on,
                defaults={
                    'status': Unit.Status.OCCUPIED, 'reason': 'Seeded lease commencement',
                    'expected_monthly_rent': scoped_lease.monthly_rent,
                    'expected_service_charge': Decimal('15000'), 'recorded_by': user,
                },
            )
            if len(scoped_units) > 1:
                UnitStatusHistory.objects.update_or_create(
                    organization=organization, unit=scoped_units[1], effective_from=today - timedelta(days=45),
                    defaults={
                        'status': Unit.Status.AVAILABLE, 'reason': 'Seeded vacancy for occupancy reports',
                        'expected_monthly_rent': scoped_lease.monthly_rent,
                        'expected_service_charge': Decimal('15000'), 'recorded_by': user,
                    },
                )
            TenantMovement.objects.update_or_create(
                organization=organization, lease=scoped_lease, kind=TenantMovement.Kind.MOVE_IN,
                effective_on=scoped_lease.starts_on,
                defaults={
                    'tenant': scoped_tenant, 'unit': scoped_units[0],
                    'reason': 'Seeded move-in', 'recorded_by': user,
                },
            )
            SaleListing.objects.update_or_create(
                organization=organization, unit=scoped_units[1],
                defaults={'project': scoped_project, 'list_price': Decimal('16500000') + Decimal(index * 3250000), 'minimum_deposit_percent': Decimal('15'), 'status': SaleListing.Status.AVAILABLE, 'construction_progress': Decimal('100')},
            )
            ValuationInstruction.objects.update_or_create(
                organization=organization, reference=f'VAL-2026-02{index}',
                defaults={
                    'client': valuation_client, 'property': scoped_property, 'property_description': spec['name'],
                    'address': spec['address'], 'valuation_type': spec['type'], 'purpose': 'Insurance review',
                    'priority': 'normal', 'valuer': user, 'instructed_on': today - timedelta(days=index),
                    'due_on': today + timedelta(days=10 + index), 'quoted_fee': Decimal('125000') + Decimal(index * 15000),
                    'status': ValuationInstruction.Status.NEW,
                },
            )

        # Twelve reconciled periods across every seeded property make trends,
        # aging, income/expense and scheduled-report previews meaningful.
        def month_start(months_back):
            value = today.year * 12 + today.month - 1 - months_back
            return today.replace(year=value // 12, month=value % 12 + 1, day=1)

        leases_for_history = Lease.objects.for_organization(organization).select_related('tenant', 'unit__property').filter(
            status=Lease.Status.ACTIVE,
        )
        for lease_index, history_lease in enumerate(leases_for_history, start=1):
            history_property = history_lease.unit.property
            for months_back in range(12):
                period = month_start(months_back)
                rent = history_lease.effective_rent(period)
                number = f'HIST-{history_property.code}-{period:%Y%m}'
                paid_ratio = Decimal('0.70') if months_back == 0 else Decimal('1.00')
                tax_amount = (rent * Decimal('0.16')).quantize(Decimal('0.01'))
                gross = rent + tax_amount
                history_invoice, _ = Invoice.objects.update_or_create(
                    organization=organization, number=number,
                    defaults={
                        'lease': history_lease, 'invoice_type': 'rent', 'issued_on': period,
                        'due_on': period + timedelta(days=max(history_lease.billing_day - 1, 0)),
                        'subtotal': rent, 'tax_rate': Decimal('16'), 'tax_amount': tax_amount,
                        'amount': gross, 'balance': (gross * (Decimal('1') - paid_ratio)).quantize(Decimal('0.01')),
                        'status': Invoice.Status.PARTIAL if paid_ratio < 1 else Invoice.Status.PAID,
                        'prepared_by': user, 'reviewed_by': user, 'reviewed_at': timezone.now(),
                        'issued_by': user, 'issued_at': timezone.now(),
                        'metadata': {'billing_period': period.strftime('%Y-%m'), 'source': 'seed_history', 'tax_code': 'VAT16'},
                    },
                )
                paid_amount = (gross * paid_ratio).quantize(Decimal('0.01'))
                history_receipt, _ = Receipt.objects.update_or_create(
                    organization=organization, number=f'HIST-RCT-{history_property.code}-{period:%Y%m}',
                    defaults={
                        'tenant': history_lease.tenant, 'invoice': history_invoice,
                        'received_on': min(period + timedelta(days=4), today), 'amount': paid_amount,
                        'payment_method': 'bank_transfer', 'external_reference': f'SEED-{history_property.code}-{period:%Y%m}',
                        'received_by': user,
                    },
                )
                ReceiptAllocation.objects.update_or_create(
                    organization=organization, receipt=history_receipt, invoice=history_invoice,
                    defaults={'amount': paid_amount, 'allocated_by': user},
                )
                Expense.objects.update_or_create(
                    organization=organization, property=history_property,
                    invoice_number=f'HIST-EXP-{history_property.code}-{period:%Y%m}',
                    defaults={
                        'supplier': 'Portfolio Operations Services',
                        'category': ('Utilities', 'Repairs & maintenance', 'Security')[months_back % 3],
                        'incurred_on': min(period + timedelta(days=12), today),
                        'amount': (rent * (Decimal('0.16') + Decimal(months_back % 3) / Decimal('100'))).quantize(Decimal('0.01')),
                        'status': Expense.Status.APPROVED, 'description': f'Seeded operating expense for {period:%B %Y}.',
                    },
                )

        for meter_index, history_meter in enumerate(UtilityMeter.objects.for_organization(organization).filter(is_active=True), start=1):
            base_value = Decimal(5000 + meter_index * 1000)
            for months_back in reversed(range(12)):
                period = month_start(months_back)
                read_at = timezone.make_aware(datetime.combine(min(period + timedelta(days=27), today), time(hour=9)))
                sequence = Decimal(12 - months_back)
                previous = base_value + (sequence - 1) * Decimal(475 + meter_index * 25)
                consumption = Decimal(475 + meter_index * 25)
                MeterReading.objects.update_or_create(
                    organization=organization, meter=history_meter, read_at=read_at,
                    defaults={
                        'value': previous + consumption, 'previous_value': previous,
                        'consumption': consumption, 'cost': (consumption * history_meter.tariff).quantize(Decimal('0.01')),
                        'method': MeterReading.Method.IOT if history_meter.utility_type == UtilityMeter.Utility.ELECTRICITY else MeterReading.Method.MANUAL,
                        'source_reference': f'SEED-{history_meter.code}-{period:%Y%m}',
                        'status': MeterReading.Status.APPROVED, 'recorded_by': user,
                        'reviewed_by': user, 'reviewed_at': timezone.now(), 'review_notes': 'Seeded approved monthly reading.',
                    },
                )

        Tender.objects.filter(organization=organization, reference='TND-2026-0039').update(
            property=Property.objects.get(organization=organization, code='CE-NRB-002'),
        )
        Tender.objects.filter(organization=organization, reference='TND-2026-0028').update(
            property=Property.objects.get(organization=organization, code='CE-MSA-003'),
        )

        # ── Companion tasks ──────────────────────────────────────────────────
        now = timezone.now()
        template_review, _ = TaskTemplate.objects.update_or_create(
            organization=organization, name='Review deliverable',
            defaults={'title_template': 'Review {deliverable} for approval', 'default_priority': 'normal', 'default_days_to_due': 5, 'sla_hours': 48, 'source_module': 'property'},
        )
        template_inspection, _ = TaskTemplate.objects.update_or_create(
            organization=organization, name='Scheduled inspection',
            defaults={'title_template': 'Conduct scheduled inspection at {location}', 'default_priority': 'high', 'default_days_to_due': 3, 'sla_hours': 24, 'source_module': 'facility'},
        )
        task1, _ = CompanionTask.objects.update_or_create(
            organization=organization, reference='CPN-2026-0001',
            defaults={'title': 'Approve Q3 service charge budget', 'description': 'Review and approve the Q3 budget for service charge allocations.', 'property': prop, 'assignee': user, 'assigned_by': user, 'priority': 'high', 'status': 'pending', 'due_at': now + timedelta(days=3), 'sla_due_at': now + timedelta(hours=48), 'source_module': 'property', 'source_ref': 'Service charge FY2026'},
        )
        CompanionTask.objects.update_or_create(
            organization=organization, reference='CPN-2026-0002',
            defaults={'title': 'Complete overdue lift inspection', 'description': 'Finance House lift 2 annual inspection is overdue.', 'property': prop, 'assignee': user, 'assigned_by': user, 'priority': 'urgent', 'status': 'acknowledged', 'due_at': now - timedelta(days=2), 'sla_due_at': now - timedelta(days=1), 'acknowledged_at': now - timedelta(hours=18), 'escalated': True, 'escalated_at': now - timedelta(hours=6), 'source_module': 'facility', 'source_ref': 'WO-2026-1789'},
        )
        CompanionTask.objects.update_or_create(
            organization=organization, reference='CPN-2026-0003',
            defaults={'title': 'Draft valuation report for Equity Bank', 'description': 'Prepare draft valuation report for Westlands Business Centre mortgage security.', 'property': prop, 'assignee': user, 'assigned_by': user, 'priority': 'normal', 'status': 'in_progress', 'due_at': now + timedelta(days=5), 'sla_due_at': now + timedelta(days=7), 'acknowledged_at': now - timedelta(hours=24), 'source_module': 'valuation', 'source_ref': 'VAL-2026-0184'},
        )
        CompanionTask.objects.update_or_create(
            organization=organization, reference='CPN-2026-0004',
            defaults={'title': 'Collect outstanding rent from ABC Traders', 'description': 'Follow up on KES 400,000 outstanding rent for Finance House 5th Floor.', 'property': Property.objects.get(organization=organization, code='CE-NRB-002'), 'assignee': user, 'assigned_by': user, 'priority': 'high', 'status': 'pending', 'due_at': now + timedelta(days=1), 'sla_due_at': now + timedelta(hours=24), 'source_module': 'property', 'source_ref': 'Rent invoice INV-2026-0702'},
        )
        CompanionTask.objects.update_or_create(
            organization=organization, reference='CPN-2026-0005',
            defaults={'title': 'Review tender proposal for NMA facilities contract', 'description': 'Technical and financial proposal review for TND-2026-0047.', 'property': Property.objects.get(organization=organization, code='CE-MSA-003'), 'assignee': user, 'assigned_by': user, 'priority': 'high', 'status': 'completed', 'due_at': now - timedelta(days=1), 'completed_at': now - timedelta(hours=12), 'source_module': 'tender', 'source_ref': 'TND-2026-0047'},
        )
        CompanionTask.objects.update_or_create(
            organization=organization, reference='CPN-2026-0006',
            defaults={'title': 'Schedule site visit for Sunset Apartments buyer', 'description': 'Site visit requested by buyer for Unit SA-201.', 'property': Property.objects.get(organization=organization, code='CE-MSA-003'), 'assignee': user, 'assigned_by': user, 'priority': 'normal', 'status': 'pending', 'due_at': now + timedelta(days=2), 'source_module': 'sales', 'source_ref': 'Buyer: Sunset Apartments Ltd'},
        )
        TaskEvent.objects.update_or_create(
            organization=organization, task=task1, actor=user,
            action='created', created_at=now - timedelta(days=1),
            defaults={'note': 'Task created for Q3 budget approval.'},
        )

        self.stdout.write(self.style.SUCCESS(f'Seeded platform data for {organization.name}.'))
