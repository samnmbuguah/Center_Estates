from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

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


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class OrganizationAccessApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='access-admin')
        self.organization = Organization.objects.create(name='Access Org', slug='access-org')
        self.membership = Membership.objects.create(
            user=self.user,
            organization=self.organization,
            is_organization_admin=True,
            is_default=True,
        )
        self.headers = {'HTTP_X_ORGANIZATION_ID': str(self.organization.id)}
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.view_permission, _ = Permission.objects.get_or_create(
            key='property.view', defaults={'label': 'View Property Management', 'module': Module.PROPERTY},
        )
        self.manage_permission, _ = Permission.objects.get_or_create(
            key='property.manage', defaults={'label': 'Manage Property Management', 'module': Module.PROPERTY},
        )

    def test_administrator_can_create_update_and_delete_custom_role(self):
        created = self.client.post(
            '/api/v1/access/roles/',
            {'name': 'Regional Supervisor', 'permission_keys': ['property.view']},
            format='json',
            **self.headers,
        )
        self.assertEqual(created.status_code, 201, created.data)
        role_id = created.data['id']
        self.assertEqual(created.data['slug'], 'regional-supervisor')
        self.assertEqual(created.data['permission_keys'], ['property.view'])

        updated = self.client.patch(
            f'/api/v1/access/roles/{role_id}/',
            {'permission_keys': ['property.view', 'property.manage']},
            format='json',
            **self.headers,
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertCountEqual(updated.data['permission_keys'], ['property.view', 'property.manage'])

        deleted = self.client.delete(f'/api/v1/access/roles/{role_id}/', **self.headers)
        self.assertEqual(deleted.status_code, 204)

    def test_non_administrator_cannot_manage_roles(self):
        self.membership.is_organization_admin = False
        self.membership.save()
        response = self.client.get('/api/v1/access/roles/', **self.headers)
        self.assertEqual(response.status_code, 403)

    def test_role_catalog_returns_standard_and_custom_roles(self):
        Role.objects.create(
            organization=self.organization, name='Legacy Inspector', slug='legacy-inspector', is_system=True,
        )
        Role.objects.create(
            organization=self.organization, name='Portfolio Manager', slug='portfolio-manager', is_system=True,
        )
        custom = Role.objects.create(
            organization=self.organization, name='Custom Desk', slug='custom-desk', is_system=False,
        )
        response = self.client.get('/api/v1/access/roles/', **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        slugs = {item['slug'] for item in response.data}
        self.assertIn('portfolio-manager', slugs)
        self.assertIn(custom.slug, slugs)
        self.assertIn('legacy-inspector', slugs)
        self.assertIn('property-manager', slugs)
