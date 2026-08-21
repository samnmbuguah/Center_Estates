import logging
from typing import Any, Dict, Optional
from django.utils import timezone
from organizations.models import Membership
from notifications.models import Notification

logger = logging.getLogger(__name__)


def execute_agent_action(
    action_type: str,
    params: Dict[str, Any],
    organization,
    user,
) -> Dict[str, Any]:
    """
    Execute a validated Human-in-the-Loop AI Action Intent.
    """
    action_type = (action_type or "").strip().lower()

    if action_type == "send_rent_reminder":
        tenant_id = params.get("tenant_id")
        amount = params.get("amount", 0)
        from properties.models import Tenant
        tenant = Tenant.objects.for_organization(organization).filter(id=tenant_id).first() if tenant_id else None
        if not tenant:
            return {"success": False, "error": "Tenant not found in this organization."}
        
        # Log notification
        title = f"Rent Payment Reminder: {tenant.name}"
        message = f"Reminder regarding outstanding balance of KES {amount:,.0f} for your lease at {organization.name}."
        Notification.objects.create(
            recipient=user,
            organization=organization,
            title=title,
            message=message,
            level=Notification.Level.INFO,
            action_url=f"/property/tenants/{tenant.id}",
        )
        return {
            "success": True,
            "message": f"Payment reminder queued and logged for {tenant.name}.",
            "action": "send_rent_reminder",
            "details": {"tenant_name": tenant.name, "amount": amount},
        }

    elif action_type == "schedule_work_order":
        title = params.get("title") or "Scheduled Maintenance"
        priority = params.get("priority", "medium")
        description = params.get("description", "Created via Quartermaster Copilot")
        from facilities.models import WorkOrder
        wo = WorkOrder.objects.create(
            organization=organization,
            title=title,
            priority=priority,
            description=description,
            status=WorkOrder.Status.OPEN if hasattr(WorkOrder, "Status") else "open",
        )
        return {
            "success": True,
            "message": f"Work Order #{str(wo.id)[:8]} scheduled successfully.",
            "action": "schedule_work_order",
            "details": {"work_order_id": str(wo.id), "title": wo.title},
        }

    elif action_type == "approve_leave_request":
        leave_id = params.get("leave_id")
        from companion.models import StaffLeaveRequest
        leave = StaffLeaveRequest.objects.for_organization(organization).filter(id=leave_id).first() if leave_id else None
        if not leave:
            return {"success": False, "error": "Leave request not found."}
        
        leave.status = StaffLeaveRequest.Status.APPROVED if hasattr(StaffLeaveRequest, "Status") else "approved"
        leave.decided_by = user
        leave.decided_at = timezone.now()
        leave.save()
        return {
            "success": True,
            "message": f"Leave request for {leave.staff.get_full_name() or leave.staff.username} approved.",
            "action": "approve_leave_request",
            "details": {"leave_id": str(leave.id), "status": "approved"},
        }

    elif action_type == "broadcast_system_notice":
        notice_title = params.get("title", "Operational Update")
        notice_msg = params.get("message", "")
        if not notice_msg:
            return {"success": False, "error": "Message content is required."}
        
        created = 0
        for m in Membership.objects.active().filter(organization=organization).select_related("user"):
            Notification.objects.create(
                recipient=m.user,
                organization=organization,
                title=notice_title,
                message=notice_msg,
                level=Notification.Level.INFO,
                action_url="/companion",
            )
            created += 1
        return {
            "success": True,
            "message": f"Broadcast notice dispatched to {created} organization members.",
            "action": "broadcast_system_notice",
        }

    else:
        return {"success": False, "error": f"Unknown action type '{action_type}'."}
