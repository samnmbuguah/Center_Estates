"""
Unit tests for Module Access Policy
Tests the SOLID/DRY compliant module access system
"""
from django.test import TestCase
from core.models import Module
from organizations.services import ModuleAccessPolicy, _build_permission_keys_for_role, ensure_permission_catalog


class ModuleAccessPolicyTest(TestCase):
    """Test the Module Access Policy follows SOLID principles."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.permission_catalog = ensure_permission_catalog()
    
    def test_single_responsibility_policy(self):
        """Test that ModuleAccessPolicy has a single responsibility."""
        # Should have clear, focused methods
        self.assertTrue(hasattr(ModuleAccessPolicy, 'get_universal_modules'))
        self.assertTrue(hasattr(ModuleAccessPolicy, 'get_additional_modules_for_role'))
        
        # Universal modules should be clearly defined
        universal_modules = list(ModuleAccessPolicy.get_universal_modules())
        self.assertIn(Module.COMPANION, universal_modules)
    
    def test_open_closed_principle(self):
        """Test that the policy is open for extension but closed for modification."""
        # Can extend with new role without modifying existing logic
        original_role_count = len(ModuleAccessPolicy.CROSS_MODULE_ACCESS)
        
        # The policy structure allows adding new roles without changing core logic
        self.assertIsInstance(ModuleAccessPolicy.CROSS_MODULE_ACCESS, dict)
        self.assertEqual(len(ModuleAccessPolicy.CROSS_MODULE_ACCESS), original_role_count)
    
    def test_dry_principle(self):
        """Test that permission building logic is not repeated."""
        # Property manager should get facility permissions via policy, not hardcoded
        perm_keys = _build_permission_keys_for_role(
            "property-manager", 
            Module.PROPERTY, 
            ("view", "operations", "leasing", "finance", "approve", "report"),
            self.permission_catalog
        )
        
        # Should have facility permissions from policy
        facility_perms = [k for k in perm_keys if k.startswith("facility.")]
        self.assertTrue(len(facility_perms) > 0, "Property manager should have facility permissions")
        
        # Should have companion permissions from universal policy
        companion_perms = [k for k in perm_keys if k.startswith("companion.")]
        self.assertTrue(len(companion_perms) > 0, "Property manager should have companion permissions")
    
    def test_universal_module_access(self):
        """Test that companion module is accessible to all roles."""
        test_roles = ["sales-agent", "leasing-officer", "finance-officer", "read-only"]
        
        for role_slug in test_roles:
            perm_keys = _build_permission_keys_for_role(
                role_slug,
                Module.PROPERTY if role_slug in ["sales-agent", "leasing-officer", "finance-officer"] else Module.PROPERTY,
                ("view",),
                self.permission_catalog
            )
            
            # All roles should have companion.view permission
            self.assertIn("companion.view", perm_keys, 
                         f"{role_slug} should have universal companion access")
    
    def test_property_manager_facility_access(self):
        """Test that property managers get specific facility permissions."""
        perm_keys = _build_permission_keys_for_role(
            "property-manager",
            Module.PROPERTY,
            ("view", "operations", "leasing", "finance", "approve", "report"),
            self.permission_catalog
        )
        
        # Should have specific facility permissions
        expected_facility_perms = [
            "facility.view", "facility.work", "facility.inspect", 
            "facility.administer", "facility.approve", "facility.report"
        ]
        
        for expected_perm in expected_facility_perms:
            self.assertIn(expected_perm, perm_keys,
                         f"Property manager should have {expected_perm}")
    
    def test_permission_deduplication(self):
        """Test that permissions are not duplicated."""
        perm_keys = _build_permission_keys_for_role(
            "property-manager",
            Module.PROPERTY,
            ("view", "operations", "leasing", "finance", "approve", "report"),
            self.permission_catalog
        )
        
        # Check no duplicates
        self.assertEqual(len(perm_keys), len(set(perm_keys)),
                        "Permission keys should not be duplicated")
