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
from django.db.models import Count, Q
from typing import Dict, Any, Optional, List

import random
import hashlib

JOKE_POOL = [
    # Real Estate & Property Management
    "Why don't property managers ever get lost? They always follow the floor plan!",
    "Why did the tenant bring a ladder to the viewing? They heard the rent was through the roof!",
    "Why did the lease go to therapy? It had too many outstanding issues!",
    "Why is the property manager so calm? They've mastered work-life BALANCE — like a trial balance!",
    "What do you call a well-maintained building? A-work-of-art-itecture!",
    "Why did the estate agent carry a tape measure everywhere? To measure up to customer expectations!",
    "What is a surveyor's favorite musical chord? The one with perfect pitch!",
    "Why did the deed cross the road? To transfer title to the other side!",
    "What did the front door say to the key? You unlock my best potential!",
    "Why are penthouse apartments never stressed? They're always above the drama!",
    "Why did the broker take up gardening? They wanted to see their commission grow organically!",
    "How do real estate agents stay cool in summer? They stand next to their best fans — happy clients!",
    "Why did the open house have a red carpet? Because every prospective buyer deserves VIP square footage!",
    "What did the foundation say to the skyscraper? Stay grounded, I've got your back!",
    "Why do architects make good storytellers? They know how to build suspense from the ground up!",

    # Construction & Civil Engineering
    "Why did the concrete mix go to school? It wanted to become solid in its fundamentals!",
    "How do civil engineers party? They construct great memories and test structural integrity!",
    "What is a builder's favorite kind of tea? Proper-tea with solid biscuit foundations!",
    "Why was the scaffolding so polite? It always provided reliable support!",
    "What did the spirit level say to the crooked wall? Let's be straight with each other!",
    "Why don't contractors play hide and seek? Good luck hiding when your high-vis jacket glows from space!",
    "Why did the excavator get an award? For groundbreaking performance!",
    "What's a crane operator's favorite motto? Always keep your standards high!",
    "Why did the rebar go to the gym? It wanted maximum tensile strength!",
    "How does a quantity surveyor sleep at night? By counting variance line items until balanced!",
    "Why did the hard hat smile at work? It was thrilled to keep everything under control!",
    "What's an engineer's favorite type of coffee? A well-calculated drip with zero structural defects!",

    # Facilities, Plumbing & Maintenance
    "I told my computer a joke about plumbing — it had a leak in its memory!",
    "Estate tip: Hydrate like a borehole — consistently and deeply!",
    "What did the lift say to the staircase? You crack me up, but I lift everyone up!",
    "Why did the HVAC compressor feel appreciated? It kept its cool under heavy pressure!",
    "Why did the generator join the choir? It had incredible standby harmony!",
    "What did the light bulb say to the switch? You really turn on my workday motivation!",
    "Why did the circuit breaker get promoted? It knew exactly when to cut the tension!",
    "Why are maintenance technicians like magicians? They turn emergency calls into peaceful operations!",
    "What is a facility manager's favorite exercise? The preventive maintenance circuit!",
    "Why did the water meter blush? Because it saw the water flowing without a leak!",

    # Workplace Productivity, Tech & Humor
    "Why did the task cross the road? To get to the done column!",
    "Why don't scientists trust atoms? Because they make up everything — like unverified vendor quotes!",
    "Why did the spreadsheet break up with the calculator? It found someone with more formulaic chemistry!",
    "How does a database administrator take a break? With a clean SELECT * FROM weekend WHERE stress = 0!",
    "Why did the calendar get promoted? Its days were always fully booked and productive!",
    "What do you call an espresso for project managers? A critical-path caffeine injection!",
    "Why did the KPI wear sunglasses? Because its future looked exceptionally bright!",
    "Why did the email feel accomplished? It was marked resolved without needing a follow-up meeting!",
    "What's the best time to review your task pipeline? Right before your second cup of tea!",
    "Why did the kanban card celebrate? It finally moved from 'In Progress' to 'Done & Dusted'!",
    "Why did the laptop go to the spa? It needed to clear its cache and cool its processor!",
    "What's a project manager's favorite dance move? The milestone shuffle!",
    "Why did the sticky note never give up? Because it was committed to sticking around until done!",
    "How do smart teams stay synchronized? With clear communication and shared milestones!",
    "Why did the clock get employee of the month? It never missed a second of productive rhythm!",
    "What did Friday afternoon say to the Monday sprint? Rest up, you've earned the weekend buffer!",
    "Why did the ledger take a deep breath? Because all the debits and credits finally balanced out in peace!",
]

THOUGHTFUL_CLOSERS = [
    "You've got this — one thoughtful step at a time.",
    "Small pauses make big performance.",
    "Your consistency is building something lasting.",
    "Remember: progress, not perfection.",
    "Take a breath — you deserve it.",
    "Every solid structure is built one quality brick at a time.",
    "Rest is not a detour from productivity; it's the fuel that powers it.",
    "Clear minds make confident decisions. Stretch your shoulders!",
    "Great properties take time, precision, and patient stewardship.",
    "Celebrate the small wins today — they compound into big milestones.",
    "Your dedication behind the scenes keeps everything running smoothly.",
    "Pause, hydrate, and recalibrate. You're doing outstanding work.",
    "A 2-minute stretch now prevents an hour of fatigue later.",
    "Quality over rush, clarity over noise.",
    "Stand up, look outside the window, and give your eyes a well-earned break.",
]

def _pick_joke(nudge_id: str, user_id: int) -> str:
    # Rotate dynamically by user and day-of-year so jokes refresh daily
    today_str = timezone.now().strftime("%Y-%m-%d")
    h = int(hashlib.md5(f"{nudge_id}-{user_id}-{today_str}".encode()).hexdigest(), 16)
    return JOKE_POOL[h % len(JOKE_POOL)]

def _pick_closer(nudge_id: str) -> str:
    today_str = timezone.now().strftime("%Y-%m-%d")
    h = int(hashlib.md5(f"{nudge_id}-{today_str}".encode()).hexdigest(), 16)
    return THOUGHTFUL_CLOSERS[h % len(THOUGHTFUL_CLOSERS)]

def _attach_delight(nudge, user):
    if not nudge:
        return nudge
    # Manager-authored campaigns should remain exactly as their author wrote
    # them. Wellness jokes are useful for automated nudges, not deadlines.
    if not nudge.get('is_campaign'):
        uid = getattr(user, 'id', 0) or 0
        nudge['joke'] = _pick_joke(nudge.get('id','ambient'), uid)
        nudge['thought'] = _pick_closer(nudge.get('id','ambient'))
    nudge['animation'] = {'wellness': 'breathe', 'productivity': 'confetti', 'workload': 'pulse', 'planning': 'float'}.get(nudge.get('category','wellness'), 'breathe')
    nudge['requires_acknowledgment'] = True
    return nudge


def _campaign_nudge(organization, delivery: str) -> Optional[Dict[str, Any]]:
    from companion.models import CompanionAnnouncement

    now = timezone.now()
    delivery_values = (CompanionAnnouncement.Delivery.BOTH, delivery)
    campaign = CompanionAnnouncement.objects.filter(
        organization=organization,
        is_active=True,
        starts_at__lte=now,
        delivery__in=delivery_values,
    ).filter(Q(ends_at__isnull=True) | Q(ends_at__gt=now)).order_by('priority', '-created_at').first()
    if not campaign:
        return None
    # Include the update time in the client-side key: an edited message is
    # eligible to be shown again, while an unchanged one still honours cooldown.
    return {
        'id': f'campaign-{campaign.id}-{int(campaign.updated_at.timestamp())}',
        'category': campaign.category,
        'icon': campaign.icon or '📣',
        'title': campaign.title,
        'message': campaign.message,
        'action_label': campaign.action_label or 'Got it',
        'action_href': campaign.action_href or '/companion',
        'urgency': 'medium',
        'is_campaign': True,
        'ends_at': campaign.ends_at.isoformat() if campaign.ends_at else None,
    }


def _evaluate_raw_nudge(user, organization, session_active_minutes: int = 110, delivery: str = 'popup') -> Optional[Dict[str, Any]]:
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
        return None

    campaign = _campaign_nudge(organization, delivery)

    my_tasks = Task.objects.filter(
        organization=organization,
        assignee=user
    )

    active_tasks = my_tasks.exclude(
        status__in=[Task.Status.COMPLETED, Task.Status.CANCELLED]
    )
    soon_deadline = now + timedelta(hours=3)
    metrics = my_tasks.aggregate(
        completed_today=Count('id', filter=Q(status=Task.Status.COMPLETED, completed_at__gte=today_start)),
        active=Count('id', filter=~Q(status__in=[Task.Status.COMPLETED, Task.Status.CANCELLED])),
        approaching=Count('id', filter=(
            ~Q(status__in=[Task.Status.COMPLETED, Task.Status.CANCELLED])
            & Q(due_at__isnull=False, due_at__lte=soon_deadline, due_at__gte=now)
        )),
        overdue=Count('id', filter=(
            ~Q(status__in=[Task.Status.COMPLETED, Task.Status.CANCELLED])
            & Q(due_at__isnull=False, due_at__lt=now)
        )),
    )
    completed_today_count = metrics['completed_today']
    active_count = metrics['active']
    approaching_deadlines = metrics['approaching']
    overdue_count = metrics['overdue']

    # Check approved upcoming leave
    has_upcoming_leave = StaffLeaveRequest.objects.filter(
        organization=organization,
        requester=user,
        status='approved',
        start_date__gte=now.date(),
        start_date__lte=now.date() + timedelta(days=3)
    ).exists()

    # 1. Manager Campaign Broadcasts take top priority
    if campaign:
        return campaign

    # 2. Quiet Mode: If the user has zero workload/tasks today and no campaign, stay quiet
    if not (active_count or completed_today_count or overdue_count or approaching_deadlines or has_upcoming_leave):
        return None

    # ─────────────────────────────────────────────────────────────
    # Nudge Decision Matrix (Prioritized by contextual urgency)
    # ─────────────────────────────────────────────────────────────

    # 1. Evening Wrap-Up & Work-Life Balance Nudge (5:00 PM - 7:30 PM)
    if 17 <= local_hour < 20 and (active_count or completed_today_count or overdue_count or approaching_deadlines):
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
    if 7 <= local_hour < 10 and active_count:
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

    # Do not interrupt staff merely to say there are zero tasks. Companion is
    # intentionally quiet when there is nothing actionable.
    if not (active_count or completed_today_count or overdue_count or approaching_deadlines):
        return None

    completed_clause = f" and {completed_today_count} completed today" if completed_today_count else ""
    return {
        "id": "ambient-checkin",
        "category": "wellness",
        "icon": "✨",
        "title": f"Operating smoothly, {user_name}",
        "message": f"You have {active_count} active task{'s' if active_count != 1 else ''}{completed_clause}. Companion is ready when you need assistance.",
        "action_label": "View Tasks",
        "action_href": "/companion?tab=my-tasks",
        "urgency": "low"
    }

def evaluate_employee_nudge(user, organization, session_active_minutes: int = 110, delivery: str = 'popup'):
    nudge = _evaluate_raw_nudge(user, organization, session_active_minutes, delivery)
    campaign = _campaign_nudge(organization, delivery)
    user_name = user.first_name or user.username or "there" if user else "there"

    if not nudge and campaign:
        nudge = {
            "id": f"ambient-{campaign['id']}",
            "category": "wellness",
            "icon": "✨",
            "title": f"Operating smoothly, {user_name}",
            "message": "You have 0 active tasks and 0 completed today. I'm operating quietly in the background if you need assistance.",
            "action_label": "View Tasks",
            "action_href": "/companion?tab=my-tasks",
            "urgency": "low",
        }

    if not nudge:
        return None

    nudge = _attach_delight(nudge, user)

    if campaign:
        nudge['announcement'] = {
            'id': campaign.get('id'),
            'title': campaign.get('title'),
            'message': campaign.get('message'),
            'category': campaign.get('category'),
            'icon': campaign.get('icon') or '📣',
            'action_label': campaign.get('action_label') or 'View details',
            'action_href': campaign.get('action_href') or '/companion',
        }

    return nudge
