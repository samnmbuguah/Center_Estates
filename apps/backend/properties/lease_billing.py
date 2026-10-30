"""Authoritative lease schedule and escalation calculations."""

import calendar
from datetime import date
from decimal import Decimal

from .models import RentSchedule


def validate_lease_billable(lease, as_of: date):
    from rest_framework.exceptions import ValidationError

    if lease.status not in (lease.Status.ACTIVE, lease.Status.EXPIRING):
        raise ValidationError({'lease': 'Only an active lease can be billed. Renew or reactivate the lease first.'})
    if as_of < lease.starts_on:
        raise ValidationError({'lease': f'Billing cannot begin before the lease commencement date ({lease.starts_on:%d %b %Y}).'})
    if as_of >= lease.ends_on:
        raise ValidationError({'lease': f'This lease expired on {lease.ends_on:%d %b %Y}. Revise or renew the lease before billing.'})


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return value.replace(year=year, month=month, day=min(value.day, calendar.monthrange(year, month)[1]))


def billing_interval_months(lease):
    """Return the rent schedule interval configured on the lease."""
    frequency = str((lease.metadata or {}).get('billing_frequency') or 'monthly').lower()
    return 3 if frequency == 'quarterly' else 1


def _period_months(period_start, period_end, default):
    """Return whole months covered by a schedule row, with a safe minimum."""
    return max(1, (period_end.year - period_start.year) * 12 + period_end.month - period_start.month) or default


def generate_rent_schedule(lease, start_on=None):
    """Create missing schedule rows from commencement (or start_on) to expiry."""
    interval = billing_interval_months(lease)
    monthly_service_charge = Decimal(str((lease.metadata or {}).get('monthly_service_charge_excl_vat', 0)))
    if lease.monthly_rent <= 0 and monthly_service_charge <= 0:
        return 0
    rows = []
    period_start = start_on or lease.starts_on
    while period_start < lease.ends_on:
        period_end = min(add_months(period_start, interval), lease.ends_on)
        months = _period_months(period_start, period_end, interval)
        effective_rent = lease.effective_rent(period_start)
        due_day = min(lease.billing_day, calendar.monthrange(period_start.year, period_start.month)[1])
        due_on = max(period_start, period_start.replace(day=due_day))
        rows.append(RentSchedule(
            organization=lease.organization, lease=lease, period_start=period_start,
            period_end=period_end, due_on=due_on,
            base_rent=lease.monthly_rent * months,
            escalation_amount=(effective_rent - lease.monthly_rent) * months,
            service_charge=monthly_service_charge * months,
            total=(effective_rent + monthly_service_charge) * months,
        ))
        period_start = period_end
    RentSchedule.objects.bulk_create(rows, ignore_conflicts=True)
    return RentSchedule.objects.filter(lease=lease).count()


def refresh_schedule_amount(schedule):
    """Recalculate an unbilled row from the lease immediately before billing."""
    months = _period_months(schedule.period_start, schedule.period_end, billing_interval_months(schedule.lease))
    effective_rent = schedule.lease.effective_rent(schedule.period_start)
    schedule.base_rent = schedule.lease.monthly_rent * months
    schedule.escalation_amount = (effective_rent - schedule.lease.monthly_rent) * months
    schedule.total = effective_rent * months + schedule.service_charge
    schedule.save(update_fields=('base_rent', 'escalation_amount', 'total', 'updated_at'))
