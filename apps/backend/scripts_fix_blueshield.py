import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from properties.models import Lease, Property
from properties.lease_billing import generate_rent_schedule

def run():
    leases = Lease.objects.filter(unit__property__name__icontains='BLUESHIELD')
    print(f"Found {leases.count()} leases for Blueshield Towers.")
    updated = 0
    for lease in leases:
        meta = dict(lease.metadata or {})
        area = Decimal(str(lease.unit.area or 0))
        sc_rate = Decimal('25.00')
        monthly_sc = (area * sc_rate).quantize(Decimal('0.01'))
        meta['service_charge_rate_per_sqft'] = str(sc_rate)
        meta['monthly_service_charge_excl_vat'] = str(monthly_sc)
        meta['service_charge'] = str(monthly_sc)
        lease.metadata = meta
        lease.escalation_percent = Decimal('10.00')
        lease.escalation_interval_months = 24
        lease.save(update_fields=['metadata', 'escalation_percent', 'escalation_interval_months', 'updated_at'])
        generate_rent_schedule(lease)
        updated += 1
        print(f"Updated Lease {lease.reference}: Tenant={lease.tenant.name}, Area={area}, Monthly SC={monthly_sc}, Escalation={lease.escalation_percent}%, Interval={lease.escalation_interval_months}m")

    print(f"Successfully completed update of {updated} leases.")

if __name__ == '__main__':
    run()
