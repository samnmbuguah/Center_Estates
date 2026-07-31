from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase

from organizations.models import Membership, Organization

from .models import Notification


class NotificationTenantTests(TestCase):
    def test_recipient_must_belong_to_notification_organization(self):
        user = get_user_model().objects.create_user(username='notify')
        first = Organization.objects.create(name='First', slug='notify-first')
        second = Organization.objects.create(name='Second', slug='notify-second')
        Membership.objects.create(user=user, organization=first)

        with self.assertRaises(ValidationError):
            Notification.objects.create(
                organization=second, recipient=user, title='Wrong tenant', message='Should fail'
            )

# Create your tests here.
