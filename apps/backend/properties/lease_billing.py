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


def generate_rent_schedule(lease):
    """Create missing monthly schedule rows from commencement to expiry."""
    service_charge = Decimal(str((lease.metadata or {}).get('monthly_service_charge_excl_vat', 0)))
    rows = []
    period_start = lease.starts_on
    while period_start < lease.ends_on:
        period_end = min(add_months(period_start, 1), lease.ends_on)
        effective_rent = lease.effective_rent(period_start)
        due_day = min(lease.billing_day, calendar.monthrange(period_start.year, period_start.month)[1])
        due_on = max(period_start, period_start.replace(day=due_day))
        rows.append(RentSchedule(
            organization=lease.organization, lease=lease, period_start=period_start,
            period_end=period_end, due_on=due_on, base_rent=lease.monthly_rent,
            escalation_amount=effective_rent - lease.monthly_rent,
            service_charge=service_charge, total=effective_rent + service_charge,
        ))
        period_start = period_end
    RentSchedule.objects.bulk_create(rows, ignore_conflicts=True)
    return RentSchedule.objects.filter(lease=lease).count()


def refresh_schedule_amount(schedule):
    """Recalculate an unbilled row from the lease immediately before billing."""
    effective_rent = schedule.lease.effective_rent(schedule.period_start)
    schedule.base_rent = schedule.lease.monthly_rent
    schedule.escalation_amount = effective_rent - schedule.lease.monthly_rent
    schedule.total = effective_rent + schedule.service_charge
    schedule.save(update_fields=('base_rent', 'escalation_amount', 'total', 'updated_at'))
