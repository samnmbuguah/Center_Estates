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
        for schedule_id in schedule_ids:
            schedule = ScheduledReport.objects.select_related('created_by', 'organization', 'property').get(pk=schedule_id)
            headers = {'HTTP_X_ORGANIZATION_ID': str(schedule.organization_id)}
            if schedule.property_id:
                headers['HTTP_X_PROPERTY_ID'] = str(schedule.property_id)
            request = factory.post(
                f'/api/v1/property/scheduled-reports/{schedule.id}/run/', {}, format='json', **headers,
            )
            force_authenticate(request, user=schedule.created_by)
            response = view(request, pk=str(schedule.id))
            if response.status_code >= 400:
                self.stderr.write(self.style.ERROR(f'{schedule.id}: {response.data}'))
                continue
            completed += 1
            self.stdout.write(f'{schedule.id}: generated execution {response.data["id"]}')
        self.stdout.write(self.style.SUCCESS(f'Generated {completed} of {len(schedule_ids)} due report schedules.'))
