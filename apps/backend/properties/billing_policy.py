"""Property-level billing cadence policy.

Rent, service charge and utilities can have independent cycles.  The billing
pipeline creates one run per charge scope so a quarterly rent run never forces
service charge into a quarterly invoice (or vice versa).
"""

from .models import BillingRun

DEFAULT_POLICY = {
    'rent': 'monthly',
    'service_charge': 'monthly',
    'utility': 'monthly',
    'other': 'monthly',
}

VALID_FREQUENCIES = {
    BillingRun.Frequency.MONTHLY,
    BillingRun.Frequency.QUARTERLY,
    BillingRun.Frequency.BIANNUAL,
    BillingRun.Frequency.ANNUAL,
}

FREQUENCY_MONTHS = {
    BillingRun.Frequency.MONTHLY: 1,
    BillingRun.Frequency.QUARTERLY: 3,
    BillingRun.Frequency.BIANNUAL: 6,
    BillingRun.Frequency.ANNUAL: 12,
}

SCOPE_INVOICE_TYPES = {
    BillingRun.ChargeScope.RENT: {'rent'},
    BillingRun.ChargeScope.SERVICE_CHARGE: {'service_charge'},
    BillingRun.ChargeScope.UTILITY: {'water', 'electricity', 'utility'},
    BillingRun.ChargeScope.OTHER: {'other'},
}


def normalize_frequency(value, default='monthly'):
    value = str(value or '').strip().lower()
    return value if value in VALID_FREQUENCIES else default


def property_billing_policy(property_record):
    policy = dict(DEFAULT_POLICY)
    if not property_record:
        return policy
    metadata = property_record.metadata or {}

    # Backwards compatibility: billing_frequency historically meant rent cadence.
    legacy_rent = metadata.get('billing_frequency')
    if legacy_rent:
        policy['rent'] = normalize_frequency(legacy_rent)

    configured = metadata.get('billing_policy')
    if isinstance(configured, dict):
        for scope in policy:
            if configured.get(scope):
                policy[scope] = normalize_frequency(configured[scope], policy[scope])
    return policy


def property_scope_frequency(property_record, scope):
    if scope in (None, BillingRun.ChargeScope.ALL):
        return None
    return property_billing_policy(property_record).get(scope, 'monthly')


def scope_invoice_types(scope):
    return SCOPE_INVOICE_TYPES.get(scope)


def period_months(period_start, period_end):
    return max(1, (period_end.year - period_start.year) * 12 + period_end.month - period_start.month + 1)


def frequency_divides_period(frequency, months):
    interval = FREQUENCY_MONTHS.get(frequency, 1)
    return months % interval == 0
