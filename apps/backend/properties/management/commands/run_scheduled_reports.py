from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from properties.models import ScheduledReport
from properties.views import ScheduledReportViewSet


class Command(BaseCommand):
    help = 'Generate every active property report schedule that is due.'

    def handle(self, *args, **options):
        schedule_ids = list(ScheduledReport.objects.filter(
            is_active=True, next_run_at__lte=timezone.now(),
        ).values_list('id', flat=True))
        factory = APIRequestFactory()
        view = ScheduledReportViewSet.as_view({'post': 'run'})
        completed = 0
        failed = 0
        for schedule_id in schedule_ids:
            schedule = ScheduledReport.objects.select_related('created_by', 'organization', 'property').get(pk=schedule_id)
            headers = {'HTTP_X_ORGANIZATION_ID': str(schedule.organization_id)}
            if schedule.property_id:
                headers['HTTP_X_PROPERTY_ID'] = str(schedule.property_id)
            request = factory.post(
                f'/api/v1/property/scheduled-reports/{schedule.id}/run/', {}, format='json', **headers,
            )
            force_authenticate(request, user=schedule.created_by)
            try:
                response = view(request, pk=str(schedule.id))
            except Exception as exc:  # pragma: no cover - defensive operator path
                schedule.last_delivery_status = 'generation_failed'
                schedule.last_delivery_error = str(exc)[:1000]
                schedule.next_run_at = timezone.now() + timedelta(hours=1)
                schedule.save(update_fields=(
                    'last_delivery_status', 'last_delivery_error', 'next_run_at', 'updated_at',
                ))
                failed += 1
                self.stderr.write(self.style.ERROR(f'{schedule.id}: generation failed: {exc}'))
                continue
            if response.status_code >= 400:
                schedule.last_delivery_status = 'generation_failed'
                schedule.last_delivery_error = str(response.data)[:1000]
                schedule.next_run_at = timezone.now() + timedelta(hours=1)
                schedule.save(update_fields=(
                    'last_delivery_status', 'last_delivery_error', 'next_run_at', 'updated_at',
                ))
                failed += 1
                self.stderr.write(self.style.ERROR(f'{schedule.id}: {response.data}'))
                continue
            schedule.refresh_from_db(fields=('last_delivery_status', 'last_delivery_error'))
            if schedule.last_delivery_status == 'delivery_failed':
                failed += 1
                self.stderr.write(self.style.WARNING(
                    f'{schedule.id}: generated but delivery failed: {schedule.last_delivery_error}',
                ))
            else:
                completed += 1
                self.stdout.write(f'{schedule.id}: generated execution {response.data["id"]}')
        self.stdout.write(self.style.SUCCESS(
            f'Generated {completed} of {len(schedule_ids)} due report schedules ({failed} failed).',
        ))
