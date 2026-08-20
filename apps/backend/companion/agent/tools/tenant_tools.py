import logging
from datetime import timedelta
from typing import Any, Dict, List
from django.utils import timezone
from properties.models import Lease, Unit
from companion.agent.state import AgentAction

logger = logging.getLogger(__name__)


def inspect_leasing_and_occupancy(organization_id: str) -> Dict[str, Any]:
    """
    Query expiring leases (30/60/90 days), vacant units, and upcoming renewals.
    """
    today = timezone.now().date()
    sixty_days = today + timedelta(days=60)
    try:
        expiring_leases = Lease.objects.filter(
            organization_id=organization_id,
            status__in=['active', 'pending'],
            ends_on__gte=today,
            ends_on__lte=sixty_days,
        ).select_related('tenant', 'unit', 'unit__property')

        expiring_count = expiring_leases.count()
        vacant_units_count = Unit.objects.filter(
            property__organization_id=organization_id,
            status='vacant'
        ).count()

        lease_items = []
        actions: List[Dict[str, Any]] = []

        for lease in expiring_leases[:5]:
            tenant_name = lease.tenant.name if lease.tenant else 'Unknown Tenant'
            unit_code = lease.unit.code if lease.unit else 'N/A'
            prop_name = lease.unit.property.name if lease.unit and lease.unit.property else 'N/A'
            days_left = (lease.ends_on - today).days if lease.ends_on else 0

            lease_items.append({
                'lease_id': str(lease.id),
                'tenant_name': tenant_name,
                'unit': unit_code,
                'property': prop_name,
                'days_left': days_left,
                'end_date': lease.ends_on.isoformat() if lease.ends_on else None,
            })

            # Propose Actionable Lease Renewal Notice Intervention
            actions.append(AgentAction(
                id=f"act_lease_{lease.id}",
                action_type="renew_lease",
                title=f"Draft Lease Renewal for {tenant_name}",
                description=f"Lease for Unit {unit_code} at {prop_name} expires in {days_left} days. Send renewal agreement and terms.",
                target_module="property",
                target_id=str(lease.id),
                target_name=tenant_name,
                payload={
                    "lease_id": str(lease.id),
                    "days_left": days_left,
                    "tenant_email": getattr(lease.tenant, 'email', ''),
                },
                urgency="high" if days_left <= 30 else "medium",
            ).model_dump())

        return {
            'expiring_leases_count': expiring_count,
            'vacant_units_count': vacant_units_count,
            'expiring_leases': lease_items,
            'proposed_actions': actions,
        }

    except Exception as e:
        logger.error("Error inspecting leasing and occupancy: %s", e)
        return {'expiring_leases_count': 0, 'vacant_units_count': 0, 'expiring_leases': [], 'proposed_actions': []}
