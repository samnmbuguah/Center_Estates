# Module Access Architecture - SOLID & DRY Compliant

## Overview
This document describes the refactored module access system that follows SOLID principles and DRY (Don't Repeat Yourself) principles to provide flexible, maintainable role-based access control.

## Problem Statement
The original implementation had several issues:
- **Violated DRY**: Permission logic was scattered across multiple if-else statements
- **Violated Single Responsibility**: Role creation handled both data access and permission logic
- **Violated Open/Closed**: Adding new roles required modifying core logic
- **Hard to maintain**: Changes to access policies required updating multiple code sections

## Solution: Policy-Driven Architecture

### 1. Single Responsibility Principle (SRP)
Each class has a single, well-defined responsibility:

#### `ModuleAccessPolicy` Class
**Responsibility**: Define module access rules and policies
```python
class ModuleAccessPolicy:
    """Defines universal module access rules across the system."""
    
    UNIVERSAL_MODULES = {
        Module.COMPANION: "Staff collaboration available to all users"
    }
    
    CROSS_MODULE_ACCESS = {
        "property-manager": {
            Module.FACILITY: ["view", "work", "inspect", ...],
            Module.COMPANION: ["view", "assign", "performance"],
        },
        # ... other roles
    }
```

#### `_build_permission_keys_for_role()` Function
**Responsibility**: Construct permission keys based on policy
```python
def _build_permission_keys_for_role(role_slug, modules, granted, permission_catalog):
    """Build permission keys for a role using the module access policy."""
    # Single responsibility: permission key construction
```

### 2. Open/Closed Principle (OCP)
The system is open for extension but closed for modification:

**Extending for New Roles** (without modifying core logic):
```python
# Simply add to the policy - no core logic changes needed
CROSS_MODULE_ACCESS = {
    "new-role": {
        Module.NEW_MODULE: ["view", "manage"],
    },
}
```

**Extending for New Universal Modules**:
```python
UNIVERSAL_MODULES = {
    Module.COMPANION: "Staff collaboration available to all users",
    Module.NEW_UNIVERSAL: "Available to all users",
}
```

### 3. Don't Repeat Yourself (DRY)
Permission logic is centralized in one place:

**Before (Violating DRY)**:
```python
# Scattered across multiple if-else statements
if role_slug == "property-manager":
    perm_keys.extend(["facility.view", "facility.work", ...])
elif role_slug == "portfolio-manager":
    perm_keys.extend(["facility.view", "facility.work", ...])
elif role_slug == "leasing-officer":
    perm_keys.extend(["companion.view"])
# ... 20+ more conditions
```

**After (DRY Compliant)**:
```python
# Centralized in policy
CROSS_MODULE_ACCESS = {
    "property-manager": {Module.FACILITY: ["view", "work", ...]},
    "portfolio-manager": {Module.FACILITY: ["view", "work", ...]},
    "leasing-officer": {Module.COMPANION: ["view"]},
}

# Applied uniformly
additional_modules = ModuleAccessPolicy.get_additional_modules_for_role(role_slug)
```

### 4. Dependency Inversion Principle (DIP)
High-level modules don't depend on low-level modules:

**Role creation depends on abstraction (Policy)**:
```python
def ensure_standard_roles_for_organization(organization):
    for role_slug, (role_name, modules, granted, desc) in STANDARD_BUSINESS_ROLES.items():
        # High-level logic depends on policy abstraction
        perm_keys = _build_permission_keys_for_role(
            role_slug, modules, granted, permission_catalog
        )
```

## Benefits

### Maintainability
- **Single source of truth**: All access rules in `ModuleAccessPolicy`
- **Easy to update**: Change policy once, affects all roles
- **Clear intent**: Policy structure shows access relationships

### Extensibility
- **Add new roles**: Just add to policy, no core logic changes
- **Add new modules**: Extend universal or cross-module policies
- **Custom policies**: Can create custom policy classes for different domains

### Testability
- **Unit tests**: Policy can be tested independently
- **Mockable**: Policy can be mocked for testing role creation
- **Verifiable**: Test suite validates policy compliance

## Usage

### Adding a New Role
```python
# 1. Add to STANDARD_BUSINESS_ROLES
"new-role": (
    "New Role Name",
    Module.PRIMARY_MODULE,
    ("view", "manage"),
    "Role description",
),

# 2. Add to CROSS_MODULE_ACCESS policy
CROSS_MODULE_ACCESS = {
    "new-role": {
        Module.ADDITIONAL_MODULE: ["view", "manage"],
    },
}
```

### Making a Module Universal
```python
UNIVERSAL_MODULES = {
    Module.COMPANION: "Staff collaboration available to all users",
    Module.NEW_MODULE: "Now available to all users",
}
```

### Running Database Updates
```bash
# On production server
cd /path/to/api.centerestates.com/apps/backend
python3 manage.py update_organization_roles
```

## Testing
Comprehensive test suite validates:
- Single responsibility compliance
- Open/closed principle adherence
- DRY principle verification
- Policy correctness
- Permission deduplication

```bash
# Run module access tests
python3 manage.py test organizations.tests_module_access
```

## Migration from Old System
The old hard-coded approach is deprecated. All new role definitions should use the policy-driven approach. Existing roles are automatically updated using the `update_organization_roles` management command.

## Future Enhancements
- **Dynamic Policy Loading**: Load policies from database for runtime updates
- **Policy Versioning**: Track policy changes over time
- **Policy Validation**: Validate policy consistency before deployment
- **Policy Testing**: Automated policy compliance checks
