import calendar
from datetime import date
from decimal import Decimal

from django.db import migrations, models


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return value.replace(year=year, month=month, day=min(value.day, calendar.monthrange(year, month)[1]))


def backfill_active_schedules(apps, schema_editor):
    Lease = apps.get_model('properties', 'Lease')
    RentSchedule = apps.get_model('properties', 'RentSchedule')
    for lease in Lease.objects.filter(status__in=('active', 'expiring')).iterator():
        service_charge = Decimal(str((lease.metadata or {}).get('monthly_service_charge_excl_vat', 0)))
        period_start = lease.starts_on
        while period_start < lease.ends_on:
            period_end = min(add_months(period_start, 1), lease.ends_on)
            elapsed_months = (period_start.year - lease.starts_on.year) * 12 + period_start.month - lease.starts_on.month
            steps = elapsed_months // max(lease.escalation_interval_months, 1) if lease.escalation_percent else 0
            effective_rent = (lease.monthly_rent * (Decimal('1') + lease.escalation_percent / Decimal('100')) ** steps).quantize(Decimal('0.01'))
            due_day = min(lease.billing_day, calendar.monthrange(period_start.year, period_start.month)[1])
            RentSchedule.objects.get_or_create(
                lease=lease, period_start=period_start,
                defaults={
                    'organization_id': lease.organization_id, 'period_end': period_end,
                    'due_on': max(period_start, period_start.replace(day=due_day)),
                    'base_rent': lease.monthly_rent, 'escalation_amount': effective_rent - lease.monthly_rent,
                    'service_charge': service_charge, 'total': effective_rent + service_charge,
                },
            )
            period_start = period_end


class Migration(migrations.Migration):
    dependencies = [('properties', '0009_paymentgatewayconfiguration_paymentintent_and_more')]
    operations = [
        migrations.AddField(
            model_name='lease',
            name='escalation_interval_months',
            field=models.PositiveSmallIntegerField(default=12),
        ),
        migrations.RunPython(backfill_active_schedules, migrations.RunPython.noop),
    ]
