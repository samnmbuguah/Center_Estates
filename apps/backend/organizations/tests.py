from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase

from core.models import Module

from .models import Membership, MembershipRole, Organization, Permission, Role


class OrganizationRoleTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='roles')
        self.first = Organization.objects.create(name='First', slug='first')
        self.second = Organization.objects.create(name='Second', slug='second')
        self.membership = Membership.objects.create(user=self.user, organization=self.first)

    def test_role_grants_domain_permission(self):
        permission = Permission.objects.create(key='property.lease.approve', label='Approve lease', module=Module.PROPERTY)
        role = Role.objects.create(organization=self.first, name='Property Manager', slug='property-manager')
        role.permissions.add(permission)
        assignment = MembershipRole(membership=self.membership, role=role)
        assignment.full_clean()
        assignment.save()

        self.assertTrue(self.membership.has_permission('property.lease.approve'))

    def test_role_from_another_organization_is_rejected(self):
        role = Role.objects.create(organization=self.second, name='Manager', slug='manager')
        assignment = MembershipRole(membership=self.membership, role=role)

        with self.assertRaises(ValidationError):
            assignment.full_clean()

# Create your tests here.
