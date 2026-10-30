from django.core.management.base import BaseCommand, CommandError

from properties.models import Lease, Property


class Command(BaseCommand):
    help = (
        'Set the default billing frequency for a property and stamp it on its leases. '
        'Other properties are left unchanged.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--property', default='BLUESHIELD TOWERS', help='Property name (case-insensitive contains match).')
        parser.add_argument('--frequency', default='quarterly', choices=('monthly', 'quarterly'))
        parser.add_argument('--dry-run', action='store_true', help='Show what would change without saving.')

    def handle(self, *args, **options):
        name = options['property']
        frequency = options['frequency']
        dry_run = options['dry_run']

        properties = Property.objects.filter(name__icontains=name)
        if not properties.exists():
            raise CommandError(f'No property matched {name!r}.')

        for property_record in properties:
            metadata = dict(property_record.metadata or {})
            metadata['billing_frequency'] = frequency
            leases = Lease.objects.filter(unit__property=property_record)

            self.stdout.write(
                f'{property_record.name}: setting billing_frequency={frequency} on '
                f'{leases.count()} lease(s).'
            )
            if dry_run:
                continue

            property_record.metadata = metadata
            property_record.save(update_fields=('metadata', 'updated_at'))

            updated = 0
            for lease in leases:
                lease_metadata = dict(lease.metadata or {})
                lease_metadata['billing_frequency'] = frequency
                lease.metadata = lease_metadata
                lease.save(update_fields=('metadata', 'updated_at'))
                updated += 1

            self.stdout.write(self.style.SUCCESS(f'Updated {updated} lease(s) for {property_record.name}.'))
