from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings

from core.models import Module

from .models import Membership, MembershipRole, Organization, Permission, Role


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
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

    def test_organization_creation(self):
        org = Organization.objects.create(
            name='NewOrg', slug='new-org', domain='neworg.example.com'
        )
        self.assertIsNotNone(org.id)
        self.assertEqual(org.name, 'NewOrg')
        self.assertEqual(org.slug, 'new-org')
        self.assertTrue(org.is_active)
        self.assertEqual(Organization.objects.count(), 3)

    def test_membership_management(self):
        user_a = get_user_model().objects.create_user(username='mem-a')
        user_b = get_user_model().objects.create_user(username='mem-b')

        mem_a = Membership.objects.create(user=user_a, organization=self.first)
        mem_b = Membership.objects.create(user=user_b, organization=self.first)

        self.assertEqual(Membership.objects.filter(organization=self.first).count(), 3)

        mem_b.delete()
        self.assertEqual(Membership.objects.filter(organization=self.first).count(), 2)

        self.assertFalse(mem_a.has_permission('nonexistent.permission'))

        admin = Membership.objects.create(
            user=get_user_model().objects.create_user(username='mem-admin'),
            organization=self.first, is_organization_admin=True,
        )
        self.assertTrue(admin.has_permission('anything'))
