from django.core.management.base import BaseCommand
from properties.models import Property
from facilities.models import Contractor
import uuid

class Command(BaseCommand):
    help = 'Syncs service providers from property onboarding metadata to Contractor records'

    def handle(self, *args, **options):
        count = 0
        for prop in Property.objects.all():
            providers = prop.metadata.get('service_providers') or []
            if not isinstance(providers, list):
                continue
            for prov in providers:
                if not isinstance(prov, dict):
                    continue
                name = str(prov.get('name') or prov.get('provider_name') or '').strip()
                if not name:
                    continue
                specialty = str(prov.get('service') or 'General Maintenance').strip()
                contact = str(prov.get('contact') or prov.get('contact_person') or '').strip()
                email = str(prov.get('email') or '').strip()
                phone = str(prov.get('phone') or '').strip()

                contractor = Contractor.objects.filter(
                    organization=prop.organization, name__iexact=name
                ).first()
                if not contractor:
                    code = f'SP-{uuid.uuid4().hex[:8].upper()}'
                    while Contractor.objects.filter(organization=prop.organization, code=code).exists():
                        code = f'SP-{uuid.uuid4().hex[:8].upper()}'
                    contractor = Contractor.objects.create(
                        organization=prop.organization,
                        code=code,
                        name=name,
                        specialty=specialty,
                        contact_name=contact,
                        email=email,
                        phone=phone,
                        status=Contractor.Status.ACTIVE,
                        approval_status=Contractor.ApprovalStatus.APPROVED,
                    )
                    self.stdout.write(self.style.SUCCESS(f'Created contractor {name} ({code}) for {prop.organization.name}'))
                    count += 1
                else:
                    self.stdout.write(f'Contractor {name} already exists for {prop.organization.name}')
                contractor.assigned_properties.add(prop)

        self.stdout.write(self.style.SUCCESS(f'Successfully synced {count} service provider(s) across all properties.'))
