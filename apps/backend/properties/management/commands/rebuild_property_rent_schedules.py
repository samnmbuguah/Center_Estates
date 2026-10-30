from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from properties.lease_billing import generate_rent_schedule
from properties.models import Lease, Property, RentSchedule


class Command(BaseCommand):
    help = (
        'Rebuild un-invoiced rent schedules for a property using its configured billing frequency. '
        'Invoiced, paid and waived schedules are never modified.'
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
            leases = Lease.objects.filter(unit__property=property_record).select_related('unit__property')
            eligible = [
                lease for lease in leases
                if str((lease.metadata or {}).get('billing_frequency') or 'monthly').lower() == frequency
            ]
            self.stdout.write(
                f'{property_record.name}: {len(eligible)} of {leases.count()} lease(s) use {frequency} billing.'
            )

            total_deleted = 0
            total_generated = 0
            for lease in eligible:
                invoiced_end = (
                    RentSchedule.objects.filter(lease=lease, invoice__isnull=False)
                    .order_by('-period_end')
                    .values_list('period_end', flat=True)
                    .first()
                )
                start_from = max(lease.starts_on, invoiced_end) if invoiced_end else lease.starts_on
                upcoming = RentSchedule.objects.filter(
                    lease=lease, status=RentSchedule.Status.UPCOMING, invoice__isnull=True,
                )
                if dry_run:
                    self.stdout.write(
                        f'  {lease.reference}: would remove {upcoming.count()} upcoming row(s) and rebuild from {start_from}.'
                    )
                    continue

                with transaction.atomic():
                    deleted, _ = upcoming.delete()
                    total_deleted += deleted
                    if start_from < lease.ends_on:
                        generate_rent_schedule(lease, start_on=start_from)
                generated = RentSchedule.objects.filter(
                    lease=lease, period_start__gte=start_from,
                ).exclude(status=RentSchedule.Status.WAIVED).count()
                total_generated += generated

            if dry_run:
                self.stdout.write(self.style.WARNING('Dry run: no changes saved.'))
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Removed {total_deleted} upcoming row(s); {total_generated} row(s) now cover future periods.'
                    )
                )
