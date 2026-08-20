import logging
from typing import Any, Dict, List
from companion.models import StaffLeaveRequest, Task, TeamFeedbackThread
from companion.agent.state import AgentAction

logger = logging.getLogger(__name__)


def inspect_team_and_hr(organization_id: str) -> Dict[str, Any]:
    """
    Query pending staff leave requests, open team tasks, and feedback tickets.
    """
    try:
        pending_leaves = StaffLeaveRequest.objects.filter(
            organization_id=organization_id,
            status=StaffLeaveRequest.Status.PENDING,
        ).select_related('requester', 'relief_staff')

        open_tasks_count = Task.objects.filter(
            organization_id=organization_id,
            status__in=[Task.Status.PENDING, Task.Status.IN_PROGRESS],
        ).count()

        open_feedback_count = TeamFeedbackThread.objects.filter(
            organization_id=organization_id,
            status__in=[TeamFeedbackThread.Status.OPEN, TeamFeedbackThread.Status.IN_PROGRESS],
        ).count()

        leave_items = []
        actions: List[Dict[str, Any]] = []

        for leave in pending_leaves[:5]:
            staff_name = leave.requester.get_full_name() or leave.requester.username if leave.requester else 'Staff Member'
            relief_name = leave.relief_staff.get_full_name() if leave.relief_staff else 'None assigned'
            days = leave.days_requested or 1

            leave_items.append({
                'leave_id': str(leave.id),
                'staff_name': staff_name,
                'leave_type': leave.leave_type,
                'days_requested': days,
                'start_date': leave.start_date.isoformat() if leave.start_date else None,
                'relief_staff': relief_name,
            })

            # Propose Actionable Leave Approval Intervention
            actions.append(AgentAction(
                id=f"act_leave_{leave.id}",
                action_type="approve_leave",
                title=f"Review Leave Request: {staff_name}",
                description=f"{days} day(s) {leave.leave_type.upper()} starting {leave.start_date}. Relief: {relief_name}.",
                target_module="companion",
                target_id=str(leave.id),
                target_name=staff_name,
                payload={"leave_id": str(leave.id)},
                urgency="medium",
            ).model_dump())

        return {
            'pending_leave_count': pending_leaves.count(),
            'open_tasks_count': open_tasks_count,
            'open_feedback_count': open_feedback_count,
            'pending_leaves': leave_items,
            'proposed_actions': actions,
        }

    except Exception as e:
        logger.error("Error inspecting team and HR: %s", e)
        return {'pending_leave_count': 0, 'open_tasks_count': 0, 'open_feedback_count': 0, 'pending_leaves': [], 'proposed_actions': []}
