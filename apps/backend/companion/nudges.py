"""
Intelligent Context-Aware Employee Wellness & Workload Nudge Engine for Center Estates Companion.

Evaluates multi-dimensional signals:
- Real-time Workload & Task Pipeline
- Task Completions today
- Approaching Deadlines & Overdue Items
- Working Hours & Time of Day
- Session Activity & Fatigue Risk
- Calendar & Leave Status
"""

from datetime import datetime, time, timedelta
from django.utils import timezone
from django.db.models import Q
from typing import Dict, Any, Optional, List


def evaluate_employee_nudge(user, organization, session_active_minutes: int = 110) -> Optional[Dict[str, Any]]:
    """
    Evaluates the user's workload, task state, calendar, and time of day
    to generate an empathetic, actionable, ambient nudge.
    """
    from companion.models import Task, StaffLeaveRequest

    now = timezone.now()
    # Assume local business timezone (EAT / Africa/Nairobi is UTC+3)
    local_hour = (now.hour + 3) % 24
    local_minute = now.minute

    user_name = user.first_name or user.username or "there" if user else "there"

    # 1. Fetch Task Metrics for this user today
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    if not organization or not user or not user.is_authenticated:
        return {
            "id": "ambient-ready",
            "category": "wellness",
            "icon": "✨",
            "title": f"Welcome, {user_name}",
            "message": "Operations companion is active and monitoring portfolio workflows.",
            "action_label": "View Tasks",
            "action_href": "/companion",
            "urgency": "low",
        }

    my_tasks = Task.objects.filter(
        organization=organization,
        assignee=user
    )

    completed_today_count = my_tasks.filter(
        status=Task.Status.COMPLETED,
        completed_at__gte=today_start
    ).count()

    active_tasks = my_tasks.exclude(
        status__in=[Task.Status.COMPLETED, Task.Status.CANCELLED]
    )
    active_count = active_tasks.count()

    # Tasks due within next 3 hours
    soon_deadline = now + timedelta(hours=3)
    approaching_deadlines = active_tasks.filter(
        due_at__isnull=False,
        due_at__lte=soon_deadline,
        due_at__gte=now
    ).count()

    overdue_count = active_tasks.filter(
        due_at__isnull=False,
        due_at__lt=now
    ).count()

    # Check approved upcoming leave
    has_upcoming_leave = StaffLeaveRequest.objects.filter(
        organization=organization,
        requester=user,
        status='approved',
        start_date__gte=now.date(),
        start_date__lte=now.date() + timedelta(days=3)
    ).exists()

    # ─────────────────────────────────────────────────────────────
    # Nudge Decision Matrix (Prioritized by contextual urgency)
    # ─────────────────────────────────────────────────────────────

    # 1. Evening Wrap-Up & Work-Life Balance Nudge (5:00 PM - 7:30 PM)
    if 17 <= local_hour < 20:
        if active_count == 0 or (overdue_count == 0 and approaching_deadlines == 0):
            return {
                "id": "evening-wrapup-done",
                "category": "wellness",
                "icon": "🌿",
                "title": f"Great work today, {user_name}!",
                "message": f"You've completed today's priority tasks ({completed_today_count} finished). Consider wrapping up rather than carrying non-urgent work into the evening.",
                "action_label": "Review Day Summary",
                "action_href": "/companion?tab=performance",
                "urgency": "low"
            }
        else:
            return {
                "id": "evening-wrapup-plan",
                "category": "workload",
                "icon": "🌅",
                "title": f"End of Day Planning, {user_name}",
                "message": f"You have {active_count} remaining items. Would you like me to reschedule non-urgent tasks to tomorrow morning so you can log off peacefully?",
                "action_label": "Reschedule to Tomorrow",
                "action_href": "/companion?tab=my-tasks",
                "urgency": "medium"
            }

    # 2. Upcoming Leave Handover Nudge
    if has_upcoming_leave and 9 <= local_hour <= 16:
        return {
            "id": "leave-handover",
            "category": "planning",
            "icon": "✈️",
            "title": f"Upcoming Leave Handover",
            "message": f"You have approved leave starting soon. Would you like me to help draft a delegation list for your relief colleague?",
            "action_label": "View Leave & Delegation",
            "action_href": "/companion?tab=dialogue",
            "urgency": "medium"
        }

    # 3. Smart Deadline & Priority Triage Nudge (Afternoon 2:30 PM - 4:30 PM)
    if 14 <= local_hour < 17 and (approaching_deadlines >= 2 or (active_count >= 5 and overdue_count > 0)):
        return {
            "id": "deadline-triage",
            "category": "productivity",
            "icon": "🧠",
            "title": f"Priority Triage Assistance",
            "message": f"You have {active_count} outstanding tasks and {approaching_deadlines or overdue_count} are approaching their deadlines. Would you like me to prioritise them for you?",
            "action_label": "Prioritize Tasks",
            "action_href": "/companion?tab=my-tasks",
            "urgency": "high"
        }

    # 4. Mindful Lunch & Break Pause Nudge (12:45 PM - 2:00 PM)
    if (local_hour == 12 and local_minute >= 45) or (local_hour == 13 and local_minute <= 45):
        return {
            "id": "lunch-break",
            "category": "wellness",
            "icon": "🍽️",
            "title": "Time for a Lunch Break",
            "message": f"It’s lunchtime, {user_name}. Consider stepping away from your workstation rather than eating while working. Your tasks will be safely waiting when you return.",
            "action_label": "Step Away",
            "action_href": "/companion",
            "urgency": "low"
        }

    # 5. Productivity Momentum & Movement Reset (11:00 AM - 12:30 PM)
    if 11 <= local_hour < 13 and completed_today_count >= 3:
        return {
            "id": "movement-reset",
            "category": "wellness",
            "icon": "🧍",
            "title": "Productive Morning!",
            "message": f"You’ve completed {completed_today_count} tasks this morning. A quick 3-minute movement or stretch break might help you reset your focus.",
            "action_label": "Take 3-Min Reset",
            "action_href": "/companion",
            "urgency": "low"
        }

    # 6. Hydration & Focus Nudge (9:30 AM - 11:30 AM or prolonged active session)
    if (9 <= local_hour < 12 or session_active_minutes >= 90) and active_count > 0:
        return {
            "id": "hydration-nudge",
            "category": "wellness",
            "icon": "💧",
            "title": f"Good morning, {user_name}",
            "message": f"You have been active on the system for {session_active_minutes // 60 or 1}+ hours. Take a moment to hydrate and refresh your focus.",
            "action_label": "Hydrate & Continue",
            "action_href": "/companion",
            "urgency": "low"
        }

    # Default Morning Focus Nudge (8:00 AM - 9:30 AM)
    if 7 <= local_hour < 10:
        return {
            "id": "morning-kickoff",
            "category": "productivity",
            "icon": "☀️",
            "title": f"Good morning, {user_name}",
            "message": f"Ready to start the day? You have {active_count} active tasks lined up. Would you like a 60-second briefing on today's top priorities?",
            "action_label": "Brief Me",
            "action_href": "/companion?tab=my-tasks",
            "urgency": "low"
        }

    # Fallback balanced nudge
    return {
        "id": "ambient-checkin",
        "category": "wellness",
        "icon": "✨",
        "title": f"Operating smoothly, {user_name}",
        "message": f"You have {active_count} active tasks and {completed_today_count} completed today. I'm operating quietly in the background if you need assistance.",
        "action_label": "View Tasks",
        "action_href": "/companion?tab=my-tasks",
        "urgency": "low"
    }
