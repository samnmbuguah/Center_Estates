from datetime import date
from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError

from properties.models import BillingItem, BillingProfile, Lease, Property, TaxConfiguration


class Command(BaseCommand):
    help = (
        'Set the default billing frequency for a property and stamp it on its leases. '
        'Other properties are left unchanged.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--property', default='BLUESHIELD TOWERS', help='Property name (case-insensitive contains match).')
        parser.add_argument('--frequency', default='quarterly', choices=('monthly', 'quarterly'), help='Rent frequency.')
        parser.add_argument('--service-charge-frequency', default='monthly', choices=('monthly', 'quarterly'))
        parser.add_argument('--utility-frequency', default='monthly', choices=('monthly', 'quarterly'))
        parser.add_argument('--other-frequency', default='monthly', choices=('monthly', 'quarterly'))
        parser.add_argument('--add-vat-16', action='store_true', help='Configure 16% VAT on rent and service charge.')
        parser.add_argument('--dry-run', action='store_true', help='Show what would change without saving.')

    def handle(self, *args, **options):
        name = options['property']
        frequency = options['frequency']
        sc_freq = options['service_charge_frequency']
        add_vat = options['add_vat_16']
        policy = {
            'rent': frequency,
            'service_charge': sc_freq,
            'utility': options['utility_frequency'],
            'other': options['other_frequency'],
        }
        dry_run = options['dry_run']

        properties = Property.objects.filter(name__icontains=name)
        if not properties.exists():
            raise CommandError(f'No property matched {name!r}.')

        for property_record in properties:
            org = property_record.organization
            metadata = dict(property_record.metadata or {})
            metadata['billing_frequency'] = frequency
            metadata['billing_policy'] = policy
            leases = Lease.objects.filter(unit__property=property_record)

            self.stdout.write(
                f'{property_record.name}: setting policy {policy} on '
                f'{leases.count()} lease(s).'
            )
            if dry_run:
                continue

            vat16 = None
            if add_vat:
                vat16, _ = TaxConfiguration.objects.get_or_create(
                    organization=org,
                    code='VAT16',
                    defaults={
                        'name': 'Output VAT 16%',
                        'rate': Decimal('16.0000'),
                        'effective_from': date(2020, 1, 1),
                        'is_active': True,
                    },
                )
                rent_item, _ = BillingItem.objects.get_or_create(
                    organization=org,
                    code='RENT',
                    defaults={
                        'name': 'Commercial Rent',
                        'calculation': BillingItem.Calculation.FIXED,
                        'income_category': 'rent',
                        'tax_configuration': vat16,
                        'is_recurring': True,
                        'is_active': True,
                    },
                )
                if rent_item.tax_configuration_id != vat16.id:
                    rent_item.tax_configuration = vat16
                    rent_item.save(update_fields=['tax_configuration'])

                sc_item, _ = BillingItem.objects.get_or_create(
                    organization=org,
                    code='SERVICE_CHARGE',
                    defaults={
                        'name': 'Service charge',
                        'calculation': BillingItem.Calculation.AREA_RATE,
                        'income_category': 'service_charge',
                        'tax_configuration': vat16,
                        'is_recurring': True,
                        'is_active': True,
                    },
                )
                if sc_item.tax_configuration_id != vat16.id:
                    sc_item.tax_configuration = vat16
                    sc_item.save(update_fields=['tax_configuration'])

            property_record.metadata = metadata
            property_record.save(update_fields=('metadata', 'updated_at'))

            updated = 0
            for lease in leases:
                lease_metadata = dict(lease.metadata or {})
                lease_metadata['billing_frequency'] = frequency
                lease_metadata['service_charge_billing_frequency'] = sc_freq
                if add_vat:
                    lease_metadata['vat_rate'] = '16.00'
                lease.metadata = lease_metadata
                lease.save(update_fields=('metadata', 'updated_at'))

                # Update or create SERVICE_CHARGE BillingProfile
                sc_prof = lease.billing_profiles.filter(billing_item__code__iexact='SERVICE_CHARGE').first()
                if sc_prof:
                    sc_prof.frequency = sc_freq
                    sc_prof.save(update_fields=['frequency'])

                # Update or create RENT BillingProfile
                if add_vat:
                    rent_item = BillingItem.objects.filter(organization=org, code__iexact='RENT').first()
                    if rent_item:
                        rp, _ = BillingProfile.objects.get_or_create(
                            organization=org,
                            lease=lease,
                            billing_item=rent_item,
                            defaults={
                                'frequency': frequency,
                                'amount': lease.monthly_rent,
                                'effective_from': lease.starts_on,
                            },
                        )
                        if rp.frequency != frequency:
                            rp.frequency = frequency
                            rp.save(update_fields=['frequency'])

                updated += 1

            self.stdout.write(self.style.SUCCESS(f'Updated {updated} lease(s) for {property_record.name}.'))
