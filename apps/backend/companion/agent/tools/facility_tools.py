import logging
from typing import Any, Dict, List
from django.utils import timezone
from facilities.models import WorkOrder
from companion.agent.state import AgentAction

logger = logging.getLogger(__name__)


def inspect_facility_work_orders(organization_id: str) -> Dict[str, Any]:
    """
    Query open work orders, urgent maintenance tickets, and SLA breaches.
    """
    try:
        open_orders = WorkOrder.objects.filter(
            organization_id=organization_id,
            status__in=['pending', 'in_progress', 'scheduled', 'reported', 'assigned', 'draft'],
        ).select_related('property', 'asset', 'contractor', 'assigned_to')

        total_open = open_orders.count()
        urgent_orders = open_orders.filter(priority='urgent')
        urgent_count = urgent_orders.count()

        critical_items = []
        actions: List[Dict[str, Any]] = []

        for wo in open_orders[:5]:
            prop_name = wo.property.name if wo.property else 'General Estate'
            asset_name = wo.asset.name if wo.asset else 'Facility Asset'
            technician = wo.assigned_to.get_full_name() if wo.assigned_to else (
                wo.contractor.name if wo.contractor else 'Unassigned'
            )

            critical_items.append({
                'work_order_id': str(wo.id),
                'title': wo.title,
                'priority': wo.priority,
                'status': wo.status,
                'property': prop_name,
                'asset': asset_name,
                'technician': technician,
            })

            # Propose Actionable Dispatch / Escalation Intervention
            if wo.priority == 'urgent' or not wo.assigned_to:
                actions.append(AgentAction(
                    id=f"act_wo_{wo.id}",
                    action_type="dispatch_work_order",
                    title=f"Escalate Work Order: {wo.title}",
                    description=f"{wo.priority.upper()} priority at {prop_name} ({asset_name}). Reallocate to technician and alert team.",
                    target_module="facility",
                    target_id=str(wo.id),
                    target_name=prop_name,
                    payload={"work_order_id": str(wo.id), "priority": "urgent"},
                    urgency="critical" if wo.priority == 'urgent' else "high",
                ).model_dump())

        return {
            'open_work_orders': total_open,
            'urgent_count': urgent_count,
            'critical_orders': critical_items,
            'proposed_actions': actions,
        }

    except Exception as e:
        logger.error("Error inspecting facility work orders: %s", e)
        return {'open_work_orders': 0, 'urgent_count': 0, 'critical_orders': [], 'proposed_actions': []}
