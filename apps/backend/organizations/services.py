from core.models import Module
from .models import Permission, Role


# Single Responsibility: Module Access Policies
class ModuleAccessPolicy:
    """Defines universal module access rules across the system."""
    
    # Universal access policies - modules that should be accessible to all roles
    UNIVERSAL_MODULES = {
        Module.COMPANION: "Staff collaboration and task management available to all users"
    }
    
    # Cross-module access policies - roles that need access to multiple modules
    CROSS_MODULE_ACCESS = {
        "property-manager": {
            Module.FACILITY: ["view", "work", "inspect", "administer", "approve", "report"],
            Module.COMPANION: ["view", "assign", "performance"],
        },
        "portfolio-manager": {
            Module.FACILITY: ["view", "work", "inspect", "administer", "approve", "report"],
            Module.COMPANION: ["view", "assign", "performance"],
        },
        "operations-staff": {
            Module.PROPERTY: ["view"],
            Module.FACILITY: ["view", "manage", "work", "inspect", "report"],
            Module.COMPANION: ["view", "manage", "assign"],
        },
        "caretaker": {
            Module.PROPERTY: ["view"],
            Module.COMPANION: ["view", "manage"],
        },
        "facility-technician": {
            Module.PROPERTY: ["view"],
            Module.COMPANION: ["view"],
        },
        "valuer-inspector": {
            Module.PROPERTY: ["view"],
            Module.COMPANION: ["view"],
        },
        "sales-agent": {
            Module.PROPERTY: ["view"],
            Module.COMPANION: ["view"],
        },
        "leasing-officer": {
            Module.COMPANION: ["view"],
        },
        "property-accountant": {
            Module.COMPANION: ["view"],
        },
        "finance-officer": {
            Module.COMPANION: ["view"],
        },
        "read-only": {
            Module.COMPANION: ["view"],
        },
    }
    
    @classmethod
    def get_additional_modules_for_role(cls, role_slug):
        """Returns additional modules a role should have access to."""
        return cls.CROSS_MODULE_ACCESS.get(role_slug, {})
    
    @classmethod
    def get_universal_modules(cls):
        """Returns modules that should be accessible to all roles."""
        return cls.UNIVERSAL_MODULES.keys()


# Standard Domain Permissions definition across all 7 core modules
DOMAIN_PERMISSIONS = {
    Module.PROPERTY: ("operations", "leasing", "finance"),
    Module.FACILITY: ("work", "inspect", "administer"),
    Module.SALES: ("selling", "visits", "payments", "legal"),
    Module.TENDER: ("intake", "compliance", "proposal", "pricing", "decision"),
    Module.VALUATION: ("coordinate", "field", "review", "finance"),
    Module.MONITORING: ("project_admin", "site", "commercial", "procurement", "finance", "certify"),
    Module.COMPANION: ("assign", "performance"),
}

STANDARD_BUSINESS_ROLES = {
    # 1. Platform & Executive
    "portfolio-manager": (
        "Portfolio Manager",
        Module.PROPERTY,
        ("view", "operations", "leasing", "finance", "report"),
        "Comprehensive cross-portfolio executive oversight for property, facilities, and staff performance.",
    ),
    "finance-officer": (
        "Finance Officer",
        Module.PROPERTY,
        ("view", "finance", "approve", "report"),
        "Manages invoices, bank reconciliations, tax compliance, and financial disbursements.",
    ),
    "operations-staff": (
        "Operations Staff",
        Module.COMPANION,
        ("view", "manage", "assign", "report"),
        "Field operations execution, task management, checklists, and evidence verification.",
    ),
    "read-only": (
        "Read Only Reviewer",
        Module.PROPERTY,
        ("view", "report"),
        "Read-only access to view reports and dashboards across modules.",
    ),

    # 2. Property Management
    "property-manager": (
        "Property Manager",
        Module.PROPERTY,
        ("view", "operations", "leasing", "finance", "approve", "report"),
        "Full management of properties, units, leases, rent roll, tenant ledgers, and expenses.",
    ),
    "leasing-officer": (
        "Leasing Officer",
        Module.PROPERTY,
        ("view", "leasing", "report"),
        "Manages prospective tenants, showings, lease agreements, handovers, and renewals.",
    ),
    "property-accountant": (
        "Property Accountant",
        Module.PROPERTY,
        ("view", "finance", "approve", "report"),
        "Handles rent roll reconciliation, M-Pesa STK push matching, invoices, and expense approvals.",
    ),

    # 3. Facility & Estate Maintenance
    "facility-manager": (
        "Facility Manager",
        Module.FACILITY,
        ("view", "work", "inspect", "administer", "approve", "report"),
        "Manages equipment assets, preventive maintenance schedules, and work order dispatch.",
    ),
    "facility-technician": (
        "Facility Technician",
        Module.FACILITY,
        ("view", "work"),
        "Executes assigned work orders with live checklists and photo proof submission.",
    ),
    "caretaker": (
        "Property Caretaker",
        Module.FACILITY,
        ("view", "work"),
        "On-site caretaker tasks: meter readings (water & power), common area checklists, and tenant move-ins.",
    ),
    "facility-inspector": (
        "Facility Inspector",
        Module.FACILITY,
        ("view", "inspect", "work"),
        "Performs safety audits, equipment compliance checks, and condition assessment reports.",
    ),

    # 4. Sales & Leasing
    "sales-developer": (
        "Sales Developer / Owner",
        Module.SALES,
        ("view", "selling", "visits", "payments", "legal", "manage", "approve", "report"),
        "Oversees development inventory pricing, buyer allocations, and reservation approvals.",
    ),
    "sales-agent": (
        "Sales Agent",
        Module.SALES,
        ("view", "selling", "visits", "report"),
        "Manages buyer leads CRM, conducts viewing tours, and issues property reservations.",
    ),
    "site-clerk": (
        "Site Clerk",
        Module.SALES,
        ("view", "visits"),
        "Registers walk-in visitors and buyer tours at the showhouse/site office.",
    ),
    "sales-financier": (
        "Sales Financier",
        Module.SALES,
        ("view", "payments", "approve", "report"),
        "Tracks mortgage qualifications, buyer deposit disbursements, and escrow releases.",
    ),
    "sales-advocate": (
        "Sales Advocate / Legal",
        Module.SALES,
        ("view", "legal"),
        "Drafts sale agreements, handles title deeds conveyancing, and escrow legal signoffs.",
    ),

    # 5. Tender Engine
    "tender-manager": (
        "Tender Manager",
        Module.TENDER,
        ("view", "intake", "compliance", "proposal", "pricing", "approve", "report"),
        "Publishes RFPs/ITTs, oversees contractor bids, bid evaluations, and award decisions.",
    ),
    "tender-analyst": (
        "Tender Analyst",
        Module.TENDER,
        ("view", "compliance"),
        "Performs contractor statutory compliance, tax PIN, and eligibility scoring.",
    ),
    "pricing-officer": (
        "Pricing Officer",
        Module.TENDER,
        ("view", "pricing"),
        "Analyzes contractor Bill of Quantities (BoQ) rates and tender financial comparisons.",
    ),
    "tender-board-reviewer": (
        "Tender Board Reviewer",
        Module.TENDER,
        ("view", "decision", "approve", "report"),
        "Tender evaluation committee governance, board reviews, and contract award approvals.",
    ),

    # 6. Valuation Services
    "valuation-coordinator": (
        "Valuation Coordinator",
        Module.VALUATION,
        ("view", "coordinate", "report"),
        "Receives valuation instructions from banks/clients, assigns valuers, and tracks timelines.",
    ),
    "valuer-inspector": (
        "Valuer and Inspector",
        Module.VALUATION,
        ("view", "field", "report"),
        "Conducts on-site property measurements, market comparables, and drafts valuation reports.",
    ),
    "valuation-reviewer": (
        "Valuation Reviewer",
        Module.VALUATION,
        ("view", "review", "approve", "report"),
        "RICS / VRB peer reviewer validating valuation methodology and signing certified reports.",
    ),

    # 7. Construction Monitoring & Projects
    "construction-admin": (
        "Construction Project Administrator",
        Module.MONITORING,
        ("view", "project_admin", "site", "commercial", "procurement", "finance", "approve", "certify", "report"),
        "Project charter, programme schedules, baseline S-curves, and contractor administration.",
    ),
    "clerk-of-works": (
        "Clerk of Works",
        Module.MONITORING,
        ("view", "site", "report"),
        "Daily site diary, quality inspection of structural works, and material delivery checks.",
    ),
    "quantity-surveyor": (
        "Quantity Surveyor",
        Module.MONITORING,
        ("view", "commercial", "procurement", "report"),
        "Measurement of work executed on-site, variation order analysis, and interim valuations.",
    ),
    "construction-certifier": (
        "Construction Certifier",
        Module.MONITORING,
        ("view", "certify", "approve", "report"),
        "Reviews and certifies contractor Interim Payment Certificates (IPC) for milestone payment.",
    ),
}


def ensure_permission_catalog():
    """Ensure all granular permissions across the 7 modules exist in the database."""
    permission_catalog = {}
    for module, module_label in Module.choices:
        # Standard CRUD/Management actions
        for suffix, action_label in (
            ("view", "View"),
            ("manage", "Manage"),
            ("approve", "Approve"),
            ("report", "Export reports"),
        ):
            key = f"{module}.{suffix}"
            perm, _ = Permission.objects.update_or_create(
                key=key,
                defaults={"label": f"{action_label} {module_label}", "module": module},
            )
            permission_catalog[key] = perm

        # Domain-specific actions
        for suffix in DOMAIN_PERMISSIONS.get(module, ()):
            key = f"{module}.{suffix}"
            perm, _ = Permission.objects.update_or_create(
                key=key,
                defaults={
                    "label": f"{module_label}: {suffix.replace('_', ' ').title()}",
                    "module": module,
                },
            )
            permission_catalog[key] = perm

    return permission_catalog


def ensure_standard_roles_for_organization(organization):
    """Ensure all standard business roles and permissions exist for an organization."""
    permission_catalog = ensure_permission_catalog()

    # 1. Platform Admin Role (Superuser)
    admin_role, _ = Role.objects.get_or_create(
        organization=organization,
        slug="platform-admin",
        defaults={
            "name": "Platform Administrator",
            "is_system": True,
            "description": "Full system-wide administrative access across all modules and settings.",
        },
    )
    admin_role.permissions.set(permission_catalog.values())

    # 2. Standard Business Roles
    for role_slug, (role_name, modules, granted, desc) in STANDARD_BUSINESS_ROLES.items():
        role_obj, _ = Role.objects.get_or_create(
            organization=organization,
            slug=role_slug,
            defaults={
                "name": role_name,
                "is_system": True,
                "description": desc,
            },
        )
        
        # Build permission set using policy-driven approach
        perm_keys = _build_permission_keys_for_role(
            role_slug, modules, granted, permission_catalog
        )

        target_perms = [permission_catalog[k] for k in perm_keys if k in permission_catalog]
        if target_perms:
            role_obj.permissions.set(target_perms)

    return True


def _build_permission_keys_for_role(role_slug, modules, granted, permission_catalog):
    """
    Build permission keys for a role using the module access policy.
    Single Responsibility: Handles permission key construction logic.
    """
    perm_keys = []
    
    # Handle single or multiple modules
    module_list = modules if isinstance(modules, (list, tuple)) else [modules]
    
    # Add base permissions for assigned modules
    for module in module_list:
        perm_keys.extend([
            f"{module}.{suffix}" 
            for suffix in granted 
            if f"{module}.{suffix}" in permission_catalog
        ])
    
    # Apply universal module access policy
    for universal_module in ModuleAccessPolicy.get_universal_modules():
        if f"{universal_module}.view" in permission_catalog:
            perm_keys.append(f"{universal_module}.view")
    
    # Apply cross-module access policy with specific permissions
    additional_modules = ModuleAccessPolicy.get_additional_modules_for_role(role_slug)
    for additional_module, specific_permissions in additional_modules.items():
        # Add specific permissions for additional modules
        for perm_suffix in specific_permissions:
            key = f"{additional_module}.{perm_suffix}"
            if key in permission_catalog:
                perm_keys.append(key)
    
    # Remove duplicates while preserving order
    return list(dict.fromkeys(perm_keys))
