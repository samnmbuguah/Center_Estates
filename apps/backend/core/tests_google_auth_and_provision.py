from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from organizations.models import Organization, Membership
from sales.models import Buyer, BuyerPortalAccess
from subscriptions.models import Subscription

User = get_user_model()


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class GoogleLoginViewTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(
            name="Center Estates Demo",
            slug="center-estates-demo",
            is_active=True,
        )

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_existing_user_google_login(self, mock_verify):
        user = User.objects.create_user(
            username="testuser",
            email="existing@example.com",
            first_name="Test",
            last_name="User",
        )
        mock_verify.return_value = {
            "email": "existing@example.com",
            "email_verified": True,
            "given_name": "Test",
            "family_name": "User",
        }

        response = self.client.post("/api/v1/auth/google/", {
            "credential": "fake_google_jwt_token",
            "site": "erp",
        }, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertIn("ce_access", response.cookies)
        self.assertIn("ce_refresh", response.cookies)
        self.assertEqual(response.data.get("redirect_to"), "/workspaces")

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_new_visitor_sales_site_google_login(self, mock_verify):
        mock_verify.return_value = {
            "email": "newcustomer@gmail.com",
            "email_verified": True,
            "given_name": "John",
            "family_name": "Kamau",
        }

        response = self.client.post("/api/v1/auth/google/", {
            "credential": "fake_google_jwt_token",
            "site": "sales",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data.get("redirect_to"), "/client-portal")
        self.assertIn("ce_access", response.cookies)

        # Verify user was created
        created_user = User.objects.filter(email="newcustomer@gmail.com").first()
        self.assertIsNotNone(created_user)
        self.assertEqual(created_user.first_name, "John")

        # Verify buyer and portal access were created
        buyer = Buyer.objects.filter(email="newcustomer@gmail.com").first()
        self.assertIsNotNone(buyer)
        self.assertEqual(buyer.organization, self.org)

        portal_access = BuyerPortalAccess.objects.filter(user=created_user, buyer=buyer).first()
        self.assertIsNotNone(portal_access)

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_new_user_erp_site_google_login_forbidden(self, mock_verify):
        mock_verify.return_value = {
            "email": "unknown@example.com",
            "email_verified": True,
            "given_name": "Unknown",
            "family_name": "Person",
        }

        response = self.client.post("/api/v1/auth/google/", {
            "credential": "fake_google_jwt_token",
            "site": "erp",
        }, format="json")

        self.assertEqual(response.status_code, 403)
        self.assertNotIn("ce_access", response.cookies)


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class OrganizationProvisioningTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.superuser = User.objects.create_superuser(
            username="superadmin",
            email="superadmin@centerestates.com",
            password="superpassword123",
        )
        self.regular_user = User.objects.create_user(
            username="regular",
            email="regular@example.com",
            password="regularpassword123",
        )

    def test_superuser_provision_organization_api(self):
        self.client.force_authenticate(user=self.superuser)
        payload = {
            "name": "Apex Towers Kenya",
            "slug": "apex-towers",
            "admin_email": "director@apextowers.co.ke",
            "admin_name": "Faith Wanjiku",
            "modules": ["property", "sales", "facility"],
            "domain": "apextowers.co.ke",
        }
        response = self.client.post("/api/v1/organizations/provision/", payload, format="json")
        self.assertEqual(response.status_code, 201)

        org = Organization.objects.filter(slug="apex-towers").first()
        self.assertIsNotNone(org)
        self.assertEqual(org.name, "Apex Towers Kenya")

        admin_user = User.objects.filter(email="director@apextowers.co.ke").first()
        self.assertIsNotNone(admin_user)

        membership = Membership.objects.filter(organization=org, user=admin_user).first()
        self.assertIsNotNone(membership)
        self.assertTrue(membership.is_organization_admin)

        active_subs = Subscription.objects.filter(organization=org, is_active=True).values_list("module", flat=True)
        self.assertIn("property", active_subs)
        self.assertIn("sales", active_subs)
        self.assertIn("facility", active_subs)

    def test_regular_user_cannot_provision(self):
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.post("/api/v1/organizations/provision/", {
            "name": "Unauthorized Org",
            "slug": "unauthorized-org",
            "admin_email": "test@unauth.com",
        }, format="json")
        self.assertEqual(response.status_code, 403)
