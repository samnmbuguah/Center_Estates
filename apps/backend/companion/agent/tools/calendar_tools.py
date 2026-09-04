import logging
from datetime import timedelta
from typing import Any, Dict, List, Optional
from django.utils import timezone

logger = logging.getLogger(__name__)


def get_upcoming_critical_dates(
    organization_id: str,
    property_id: Optional[str] = None,
    allowed_modules: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Query upcoming lease expirations, invoice due dates, PPM schedules,
    and insurance/regulatory critical dates in the next 30 days.
    Scoped to property_id and allowed_modules, respecting the user's role authorization boundary.
    """
    today = timezone.now().date()
    horizon = today + timedelta(days=30)
    events = []

    can_view_property = allowed_modules is None or "property" in allowed_modules
    can_view_facility = allowed_modules is None or "facility" in allowed_modules

    if can_view_property:
        try:
            from properties.models import Lease, Invoice

            lease_qs = Lease.objects.filter(
                organization_id=organization_id,
                ends_on__gte=today,
                ends_on__lte=horizon,
            ).select_related('tenant', 'unit', 'unit__property')
            if property_id:
                lease_qs = lease_qs.filter(unit__property_id=property_id)

            for lease in lease_qs[:10]:
                days_left = (lease.ends_on - today).days
                tenant_name = getattr(lease.tenant, 'name', 'Tenant')
                unit_code = getattr(lease.unit, 'code', 'N/A')
                prop_name = getattr(getattr(lease.unit, 'property', None), 'name', 'N/A')
                events.append({
                    'type': 'lease_expiry',
                    'date': lease.ends_on.isoformat(),
                    'days_until': days_left,
                    'title': f'Lease Expiry: {tenant_name} — Unit {unit_code} @ {prop_name}',
                    'urgency': 'high' if days_left <= 14 else 'medium',
                })

            inv_qs = Invoice.objects.filter(
                organization_id=organization_id,
                due_on__gte=today,
                due_on__lte=horizon,
                balance__gt=0,
            ).select_related('lease__tenant', 'lease__unit__property')
            if property_id:
                inv_qs = inv_qs.filter(lease__unit__property_id=property_id)

            for inv in inv_qs[:10]:
                days_left = (inv.due_on - today).days
                tenant_name = getattr(getattr(inv.lease, 'tenant', None), 'name', 'Tenant')
                events.append({
                    'type': 'invoice_due',
                    'date': inv.due_on.isoformat(),
                    'days_until': days_left,
                    'title': f'Invoice Due: {inv.number} — KES {float(inv.balance):,.0f} ({tenant_name})',
                    'urgency': 'high' if days_left <= 5 else 'medium',
                })

        except Exception as exc:
            logger.warning("calendar_events lease/invoice query failed: %s", exc)

    if can_view_facility:
        try:
            from facilities.models import PreventiveSchedule
            ppm_qs = PreventiveSchedule.objects.filter(
                organization_id=organization_id,
                is_active=True,
                next_due_on__gte=today,
                next_due_on__lte=horizon,
            ).select_related('asset', 'asset__property')
            if property_id:
                ppm_qs = ppm_qs.filter(asset__property_id=property_id)

            for ppm in ppm_qs[:10]:
                days_left = (ppm.next_due_on - today).days
                asset_name = getattr(ppm.asset, 'name', 'Asset') if ppm.asset else 'General'
                events.append({
                    'type': 'ppm_due',
                    'date': ppm.next_due_on.isoformat(),
                    'days_until': days_left,
                    'title': f'PPM Due: {ppm.name} — {asset_name}',
                    'urgency': 'medium',
                })
        except Exception as exc:
            logger.warning("calendar_events PPM query failed: %s", exc)

    events.sort(key=lambda e: e['date'])
    return {
        'today': today.isoformat(),
        'horizon_days': 30,
        'total_events': len(events),
        'events': events,
    }


def get_sales_pipeline(
    organization_id: str,
    property_id: Optional[str] = None,
    allowed_modules: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Query sales listings, deal stages, pipeline value, and conversion metrics.
    Scoped to property_id and sales module permission.
    """
    if allowed_modules is not None and "sales" not in allowed_modules:
        return {'total_listings': 0, 'listings_by_status': {}, 'active_listings': 0}

    try:
        from sales.models import SaleListing
        listings = SaleListing.objects.filter(organization_id=organization_id)
        if property_id:
            listings = listings.filter(unit__property_id=property_id)

        total = listings.count()
        by_status: Dict[str, int] = {}
        for item in listings.values('status'):
            s = item.get('status', 'unknown')
            by_status[s] = by_status.get(s, 0) + 1

        return {
            'total_listings': total,
            'listings_by_status': by_status,
            'active_listings': listings.filter(status='active').count() if total else 0,
        }
    except Exception as exc:
        logger.warning("get_sales_pipeline failed: %s", exc)
        return {'total_listings': 0, 'listings_by_status': {}, 'active_listings': 0}


def search_tenant_by_name(
    organization_id: str,
    query: str,
    property_id: Optional[str] = None,
    allowed_modules: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Free-text search for tenants by name, phone, or email within the organization.
    Scoped to property_id and property module permission.
    """
    if allowed_modules is not None and "property" not in allowed_modules:
        return {'query': query, 'results': [], 'count': 0}

    try:
        from django.db.models import Q
        from properties.models import Tenant
        tenant_qs = Tenant.objects.filter(organization_id=organization_id)
        if property_id:
            tenant_qs = tenant_qs.filter(
                Q(property_id=property_id) | Q(leases__unit__property_id=property_id)
            ).distinct()

        results = tenant_qs.filter(
            Q(name__icontains=query) | Q(email__icontains=query) | Q(phone__icontains=query)
        )[:10]

        tenant_list = [
            {
                'id': str(t.id),
                'name': t.name,
                'email': getattr(t, 'email', ''),
                'phone': getattr(t, 'phone', ''),
            }
            for t in results
        ]
        return {'query': query, 'results': tenant_list, 'count': len(tenant_list)}
    except Exception as exc:
        logger.warning("search_tenant_by_name failed: %s", exc)
        return {'query': query, 'results': [], 'count': 0}
