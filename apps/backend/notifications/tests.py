from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.response import Response
from unittest.mock import patch

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

    def test_inbox_is_recipient_scoped_and_can_mark_read(self):
        user = get_user_model().objects.create_user(username='inbox-reader')
        other = get_user_model().objects.create_user(username='inbox-other')
        org = Organization.objects.create(name='Inbox Org', slug='notify-inbox')
        Membership.objects.create(user=user, organization=org, is_default=True)
        Membership.objects.create(user=other, organization=org)
        own = Notification.objects.create(
            organization=org, recipient=user, title='Lease expires', message='Review renewal',
            level=Notification.Level.WARNING, metadata={'category': 'calendar', 'event_key': 'lease-expiry:1'},
        )
        Notification.objects.create(organization=org, recipient=other, title='Private', message='Hidden')
        client = APIClient(); client.force_authenticate(user)
        headers = {'HTTP_X_ORGANIZATION_ID': str(org.id)}

        inbox = client.get('/api/v1/notifications/', **headers)
        self.assertEqual(inbox.status_code, 200, inbox.data)
        rows = inbox.data.get('results', inbox.data) if isinstance(inbox.data, dict) else inbox.data
        self.assertEqual([row['id'] for row in rows], [str(own.id)])
        self.assertEqual(rows[0]['category'], 'calendar')
        summary = client.get('/api/v1/notifications/summary/', **headers)
        self.assertEqual(summary.data['unread'], 1)
        marked = client.post(f'/api/v1/notifications/{own.id}/mark-read/', {}, format='json', **headers)
        self.assertEqual(marked.status_code, 200, marked.data)
        self.assertIsNotNone(marked.data['read_at'])

    @patch('notifications.management.commands.sync_calendar_notifications.CalendarFeedView.as_view')
    def test_calendar_sync_is_deduplicated_per_recipient_and_event(self, as_view):
        user = get_user_model().objects.create_user(username='calendar-recipient')
        org = Organization.objects.create(name='Calendar Org', slug='notify-calendar')
        Membership.objects.create(user=user, organization=org, is_default=True)
        as_view.return_value = lambda request: Response({'results': [{
            'id': 'lease-expiry:abc', 'title': 'Lease expires · Acme',
            'starts_at': (timezone.now() + timezone.timedelta(days=3)).isoformat(),
            'status': 'active', 'priority': 'high', 'subtitle': 'Unit 4A',
            'source_url': '/property?tab=critical-dates', 'module': 'property',
            'property': 'property-id', 'property_name': 'Finance House',
        }]})
        call_command('sync_calendar_notifications')
        call_command('sync_calendar_notifications')
        notices = Notification.objects.filter(recipient=user, metadata__event_key='lease-expiry:abc')
        self.assertEqual(notices.count(), 1)
        self.assertEqual(notices.get().level, Notification.Level.WARNING)
