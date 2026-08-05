from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from django.utils import timezone

from organizations.models import Membership, Organization

from .models import Notification


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
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

    def test_create_notification(self):
        user = get_user_model().objects.create_user(username='creator')
        org = Organization.objects.create(name='TestOrg', slug='notify-create')
        Membership.objects.create(user=user, organization=org)

        notification = Notification.objects.create(
            organization=org, recipient=user, title='Hello', message='World'
        )
        self.assertIsNotNone(notification.id)
        self.assertEqual(notification.title, 'Hello')
        self.assertEqual(notification.message, 'World')
        self.assertEqual(notification.recipient, user)
        self.assertIsNone(notification.read_at)

    def test_list_notifications(self):
        user = get_user_model().objects.create_user(username='lister')
        other = get_user_model().objects.create_user(username='lister-other')
        org = Organization.objects.create(name='ListOrg', slug='notify-list')
        Membership.objects.create(user=user, organization=org)
        Membership.objects.create(user=other, organization=org)

        Notification.objects.create(organization=org, recipient=user, title='N1', message='m1')
        Notification.objects.create(organization=org, recipient=user, title='N2', message='m2')
        Notification.objects.create(organization=org, recipient=other, title='N3', message='m3')

        user_notifications = Notification.objects.filter(recipient=user)
        self.assertEqual(user_notifications.count(), 2)
        self.assertSetEqual(
            set(user_notifications.values_list('title', flat=True)), {'N1', 'N2'}
        )

    def test_mark_read(self):
        user = get_user_model().objects.create_user(username='reader')
        org = Organization.objects.create(name='ReadOrg', slug='notify-read')
        Membership.objects.create(user=user, organization=org)

        notification = Notification.objects.create(
            organization=org, recipient=user, title='ReadMe', message='msg'
        )
        self.assertIsNone(notification.read_at)

        now = timezone.now()
        notification.read_at = now
        notification.save()
        notification.refresh_from_db()

        self.assertIsNotNone(notification.read_at)
