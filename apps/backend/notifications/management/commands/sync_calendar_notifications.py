from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.test import APIRequestFactory, force_authenticate

from core.views import CalendarFeedView
from organizations.models import Membership
from notifications.models import Notification


class Command(BaseCommand):
    help = 'Create deduplicated, role-aware notifications for overdue and upcoming calendar events.'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=14)

    def handle(self, *args, **options):
        today = timezone.localdate()
        horizon = today + timedelta(days=max(1, min(options['days'], 90)))
        factory = APIRequestFactory()
        created = updated = 0
        memberships = Membership.objects.active().select_related('user', 'organization').filter(user__is_active=True)
        for membership in memberships.iterator():
            request = factory.get(
                '/api/v1/calendar-feed/', {'start': today - timedelta(days=365), 'end': horizon},
                HTTP_X_ORGANIZATION_ID=str(membership.organization_id), HTTP_X_PROPERTY_SCOPE='portfolio',
            )
            force_authenticate(request, membership.user)
            response = CalendarFeedView.as_view()(request)
            if response.status_code != 200:
                continue
            for event in response.data.get('results', []):
                starts_at = parse_datetime(event['starts_at'])
                event_date = starts_at.date() if starts_at else today
                overdue = event.get('status') == 'overdue' or event_date < today
                high_priority = event.get('priority') in ('high', 'critical', 'urgent')
                if not overdue and not high_priority and event_date > today + timedelta(days=7):
                    continue
                defaults = {
                    'title': event['title'],
                    'message': event.get('subtitle') or f"Due {event_date:%d %b %Y}",
                    'level': Notification.Level.URGENT if overdue else Notification.Level.WARNING if high_priority else Notification.Level.INFO,
                    'action_url': event.get('source_url', ''),
                    'metadata': {
                        'category': 'calendar', 'event_key': event['id'], 'module': event.get('module'),
                        'property': event.get('property'), 'property_name': event.get('property_name'),
                        'starts_at': event['starts_at'], 'status': event.get('status'),
                    },
                }
                _, was_created = Notification.objects.update_or_create(
                    organization=membership.organization, recipient=membership.user,
                    metadata__event_key=event['id'], defaults=defaults,
                )
                created += int(was_created); updated += int(not was_created)
        self.stdout.write(self.style.SUCCESS(f'Calendar notifications synchronized: {created} created, {updated} updated.'))
