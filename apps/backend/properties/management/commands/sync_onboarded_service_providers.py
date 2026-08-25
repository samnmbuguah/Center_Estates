from django.core.management.base import BaseCommand
from properties.models import Property
from properties.views import _sync_property_service_providers

class Command(BaseCommand):
    help = 'Syncs service providers from property onboarding metadata to Contractor and ServiceProfile records'

    def handle(self, *args, **options):
        count = 0
        for prop in Property.objects.all():
            providers = prop.metadata.get('service_providers') or []
            if isinstance(providers, list) and len(providers) > 0:
                _sync_property_service_providers(prop)
                count += len(providers)
                self.stdout.write(self.style.SUCCESS(f'Synced {len(providers)} provider(s) for property "{prop.name}" ({prop.code})'))

        self.stdout.write(self.style.SUCCESS(f'Successfully synced {count} service provider(s) across all properties.'))

