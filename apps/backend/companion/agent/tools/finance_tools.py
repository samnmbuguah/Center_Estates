import logging
from typing import Any, Dict, List, Optional
from django.utils import timezone
from django.db.models import Sum, Count, Q
from properties.models import Invoice, Lease
from companion.agent.state import AgentAction

logger = logging.getLogger(__name__)


def inspect_arrears_and_collections(
    organization_id: str,
    property_id: Optional[str] = None,
    allowed_modules: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Query overdue invoices, total outstanding balances, and tenants in arrears.
    Scoped to property_id and user module permissions.
    """
    if allowed_modules is not None and "property" not in allowed_modules:
        return {'total_arrears': 0, 'overdue_count': 0, 'top_defaulters': [], 'proposed_actions': []}

    now = timezone.now().date()
    try:
        base_qs = Invoice.objects.filter(
            organization_id=organization_id,
            status__in=['issued', 'partial', 'overdue', 'approved'],
            due_on__lt=now,
            balance__gt=0,
        ).select_related('lease', 'lease__tenant', 'lease__unit', 'lease__unit__property')

        if property_id:
            base_qs = base_qs.filter(lease__unit__property_id=property_id)

        total_arrears = base_qs.aggregate(total=Sum('balance'))['total'] or 0
        count = base_qs.count()

        top_defaulters = []
        actions: List[Dict[str, Any]] = []

        for inv in base_qs[:5]:
            tenant_name = inv.lease.tenant.name if inv.lease and inv.lease.tenant else 'Unknown Tenant'
            unit_code = inv.lease.unit.code if inv.lease and inv.lease.unit else 'N/A'
            property_name = inv.lease.unit.property.name if inv.lease and inv.lease.unit and inv.lease.unit.property else 'N/A'
            balance = float(inv.balance or 0)

            top_defaulters.append({
                'invoice_id': str(inv.id),
                'invoice_number': inv.number,
                'tenant_name': tenant_name,
                'unit': unit_code,
                'property': property_name,
                'balance_due': balance,
                'due_date': inv.due_on.isoformat() if inv.due_on else None,
            })

            if balance > 0:
                actions.append(AgentAction(
                    id=f"act_rent_{inv.id}",
                    action_type="send_payment_reminder",
                    title=f"Send Rent Arrears Notice to {tenant_name}",
                    description=f"KES {balance:,.0f} overdue for Unit {unit_code} at {property_name}. Dispatch M-Pesa STK reminder and email.",
                    target_module="property",
                    target_id=str(inv.id),
                    target_name=tenant_name,
                    payload={
                        "invoice_id": str(inv.id),
                        "amount": balance,
                        "tenant_email": getattr(inv.lease.tenant, 'email', ''),
                        "tenant_phone": getattr(inv.lease.tenant, 'phone', ''),
                    },
                    urgency="high" if balance > 50000 else "medium",
                ).model_dump())

        return {
            'total_arrears': float(total_arrears),
            'overdue_count': count,
            'top_defaulters': top_defaulters,
            'proposed_actions': actions,
        }

    except Exception as e:
        logger.error("Error inspecting arrears: %s", e)
        return {'total_arrears': 0, 'overdue_count': 0, 'top_defaulters': [], 'proposed_actions': []}
