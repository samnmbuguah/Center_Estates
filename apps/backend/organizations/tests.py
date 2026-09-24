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

    def test_admin_can_reset_member_password(self):
        target_user = get_user_model().objects.create_user(username='subordinate-user', password='OldPassword123!')
        target_mem = Membership.objects.create(user=target_user, organization=self.organization)

        res = self.client.patch(
            f'/api/v1/access/members/{target_mem.id}/',
            {'password': 'NewSecurePassword456!'},
            format='json',
            **self.headers,
        )
        self.assertEqual(res.status_code, 200, res.data)
        target_user.refresh_from_db()
        self.assertTrue(target_user.check_password('NewSecurePassword456!'))

    def test_admin_can_disable_and_enable_member(self):
        target_user = get_user_model().objects.create_user(username='disable-me', password='InitPassword123!')
        target_mem = Membership.objects.create(user=target_user, organization=self.organization)

        # Disable
        res = self.client.patch(
            f'/api/v1/access/members/{target_mem.id}/',
            {'is_active': False},
            format='json',
            **self.headers,
        )
        self.assertEqual(res.status_code, 200, res.data)
        target_user.refresh_from_db()
        target_mem.refresh_from_db()
        self.assertFalse(target_user.is_active)
        self.assertEqual(target_mem.status, Membership.Status.SUSPENDED)
        self.assertFalse(res.data['is_active'])

        # Re-enable
        res_enable = self.client.patch(
            f'/api/v1/access/members/{target_mem.id}/',
            {'is_active': True},
            format='json',
            **self.headers,
        )
        self.assertEqual(res_enable.status_code, 200, res_enable.data)
        target_user.refresh_from_db()
        target_mem.refresh_from_db()
        self.assertTrue(target_user.is_active)
        self.assertEqual(target_mem.status, Membership.Status.ACTIVE)
        self.assertTrue(res_enable.data['is_active'])

    def test_admin_cannot_disable_self(self):
        res = self.client.patch(
            f'/api/v1/access/members/{self.membership.id}/',
            {'is_active': False},
            format='json',
            **self.headers,
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('cannot disable your own', res.data['detail'])

    def test_list_members_with_include_inactive(self):
        u_active = get_user_model().objects.create_user(username='u-active')
        u_inactive = get_user_model().objects.create_user(username='u-inactive', is_active=False)
        m_active = Membership.objects.create(user=u_active, organization=self.organization, status=Membership.Status.ACTIVE)
        m_inactive = Membership.objects.create(user=u_inactive, organization=self.organization, status=Membership.Status.SUSPENDED)

        # Default: only active
        res_default = self.client.get('/api/v1/access/members/', **self.headers)
        self.assertEqual(res_default.status_code, 200)
        usernames_default = [item['username'] for item in res_default.data]
        self.assertIn('u-active', usernames_default)
        self.assertNotIn('u-inactive', usernames_default)

        # With include_inactive=true: includes suspended/disabled
        res_all = self.client.get('/api/v1/access/members/?include_inactive=true', **self.headers)
        self.assertEqual(res_all.status_code, 200)
        usernames_all = [item['username'] for item in res_all.data]
        self.assertIn('u-active', usernames_all)
        self.assertIn('u-inactive', usernames_all)

    def test_user_can_change_own_password(self):
        user = get_user_model().objects.create_user(username='self-changer', password='CurrentPassword123!')
        client = APIClient()
        client.force_authenticate(user)

        res = client.post(
            '/api/v1/auth/change-password/',
            {
                'current_password': 'CurrentPassword123!',
                'new_password': 'NewChangedPassword789!',
                'confirm_password': 'NewChangedPassword789!',
            },
            format='json',
        )
        self.assertEqual(res.status_code, 200, res.data)
        user.refresh_from_db()
        self.assertTrue(user.check_password('NewChangedPassword789!'))

    def test_user_change_password_validation(self):
        user = get_user_model().objects.create_user(username='bad-changer', password='CurrentPassword123!')
        client = APIClient()
        client.force_authenticate(user)

        # Wrong current password
        res = client.post(
            '/api/v1/auth/change-password/',
            {
                'current_password': 'WrongPassword!',
                'new_password': 'NewChangedPassword789!',
            },
            format='json',
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('current_password', res.data)

        # Identical to current password
        res2 = client.post(
            '/api/v1/auth/change-password/',
            {
                'current_password': 'CurrentPassword123!',
                'new_password': 'CurrentPassword123!',
            },
            format='json',
        )
        self.assertEqual(res2.status_code, 400)
        self.assertIn('new_password', res2.data)
