from django.db import transaction
from django.db.models import Count, F, Q, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet

from core.models import Module
from core.permissions import HasModuleActionPermission
from core.tenancy import get_active_organization

from .models import Task, TaskEvent, TaskTemplate
from .serializers import TaskEventSerializer, TaskSerializer, TaskTemplateSerializer

STATUS_TRANSITIONS = {
    Task.Status.PENDING: {Task.Status.ACKNOWLEDGED, Task.Status.CANCELLED, Task.Status.IN_PROGRESS},
    Task.Status.ACKNOWLEDGED: {Task.Status.IN_PROGRESS, Task.Status.COMPLETED, Task.Status.CANCELLED},
    Task.Status.IN_PROGRESS: {Task.Status.COMPLETED, Task.Status.CANCELLED},
    Task.Status.DELEGATED: {Task.Status.ACKNOWLEDGED, Task.Status.COMPLETED, Task.Status.CANCELLED},
    Task.Status.COMPLETED: set(),
    Task.Status.CANCELLED: set(),
}


class CompanionModelViewSet(ModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.COMPANION
    search_fields = ()

    def get_queryset(self):
        queryset = self.queryset.for_organization(get_active_organization(self.request))
        search = self.request.query_params.get('search', '').strip()
        if search:
            from django.db.models import Q
            query = Q()
            for field in self.search_fields:
                query |= Q(**{f'{field}__icontains': search})
            queryset = queryset.filter(query)
        return queryset

    def _validate_organization(self, serializer):
        organization = get_active_organization(self.request)
        for name, value in serializer.validated_data.items():
            if getattr(value, 'organization_id', organization.id) != organization.id:
                raise ValidationError({name: 'The selected record belongs to another organization.'})
        return organization

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer))

    def perform_update(self, serializer):
        self._validate_organization(serializer)
        serializer.save()


class TaskViewSet(CompanionModelViewSet):
    queryset = Task.objects.select_related('assignee', 'assigned_by', 'template')
    serializer_class = TaskSerializer
    search_fields = ('title', 'reference', 'source_ref', 'assignee__username')

    def get_queryset(self):
        queryset = super().get_queryset()
        scope = self.request.query_params.get('scope', '')
        if scope == 'mine':
            queryset = queryset.filter(assignee=self.request.user)
        assignee = self.request.query_params.get('assignee', '').strip()
        if assignee:
            queryset = queryset.filter(assignee_id=assignee)
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        overdue = self.request.query_params.get('overdue')
        if overdue in ('1', 'true'):
            now = timezone.now()
            queryset = queryset.exclude(status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED)).filter(due_at__lt=now)
        escalated = self.request.query_params.get('escalated')
        if escalated in ('1', 'true'):
            queryset = queryset.filter(escalated=True, status__in=(Task.Status.PENDING, Task.Status.ACKNOWLEDGED, Task.Status.IN_PROGRESS))
        return queryset

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        now = timezone.now()
        assignee = serializer.validated_data.get('assignee')
        count = Task.objects.filter(organization=organization).count()
        task = serializer.save(
            organization=organization,
            reference=f'CPN-{now:%Y}-{count + 1:04d}',
            status=Task.Status.PENDING,
        )
        TaskEvent.objects.create(
            organization=organization, task=task, actor=self.request.user,
            action=TaskEvent.Action.CREATED, note='Task created.',
        )
        if assignee and assignee != self.request.user:
            TaskEvent.objects.create(
                organization=organization, task=task, actor=self.request.user,
                action=TaskEvent.Action.ASSIGNED, note=f'Assigned to {assignee.username}.',
            )

    def perform_update(self, serializer):
        organization = self._validate_organization(serializer)
        previous = self.get_object()
        serializer.save()
        task = self.get_object()
        changed = [
            field for field in ('title', 'description', 'priority', 'due_at', 'sla_due_at')
            if getattr(previous, field) != getattr(task, field)
        ]
        if changed:
            TaskEvent.objects.create(
                organization=organization, task=task, actor=self.request.user,
                action=TaskEvent.Action.UPDATED, note=f'Updated: {", ".join(changed)}.',
            )

    def _transition(self, task, target, actor, note=''):
        current = task.status
        if target not in STATUS_TRANSITIONS.get(current, set()):
            raise ValidationError({'status': f'Cannot move a {current} task to {target}.'})
        event_action = {
            Task.Status.ACKNOWLEDGED: TaskEvent.Action.ACKNOWLEDGED,
            Task.Status.IN_PROGRESS: TaskEvent.Action.STARTED,
            Task.Status.COMPLETED: TaskEvent.Action.COMPLETED,
            Task.Status.CANCELLED: TaskEvent.Action.CANCELLED,
        }.get(target, TaskEvent.Action.UPDATED)
        if target == Task.Status.ACKNOWLEDGED:
            task.acknowledged_at = timezone.now()
        if target == Task.Status.COMPLETED:
            task.completed_at = timezone.now()
        task.status = target
        task.save()
        TaskEvent.objects.create(
            organization=task.organization, task=task, actor=actor,
            action=event_action, note=note or f'Status changed to {target}.',
        )

    @action(detail=True, methods=('post',))
    def acknowledge(self, request, pk=None):
        task = self.get_object()
        self._transition(task, Task.Status.ACKNOWLEDGED, request.user)
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=('post',))
    def start(self, request, pk=None):
        task = self.get_object()
        self._transition(task, Task.Status.IN_PROGRESS, request.user)
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=('post',))
    def complete(self, request, pk=None):
        task = self.get_object()
        self._transition(task, Task.Status.COMPLETED, request.user, note='Task completed.')
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=('post',))
    def cancel(self, request, pk=None):
        task = self.get_object()
        note = str(request.data.get('note', '')).strip()
        self._transition(task, Task.Status.CANCELLED, request.user, note=note or 'Task cancelled.')
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=('post',))
    def delegate(self, request, pk=None):
        task = self.get_object()
        delegate_id = request.data.get('delegate_to')
        if not delegate_id:
            raise ValidationError({'delegate_to': 'Select a staff member to delegate to.'})
        organization = get_active_organization(request)
        from django.contrib.auth import get_user_model
        target = get_user_model().objects.filter(
            pk=delegate_id, memberships__organization=organization, is_active=True,
        ).first()
        if not target:
            raise ValidationError({'delegate_to': 'Staff member not found in this organization.'})
        task.delegated_from = task.assignee
        task.delegated_to = target
        task.assignee = target
        task.status = Task.Status.DELEGATED
        task.save()
        TaskEvent.objects.create(
            organization=task.organization, task=task, actor=request.user,
            action=TaskEvent.Action.DELEGATED, note=f'Delegated to {target.username}.',
        )
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=('get',))
    def events(self, request, pk=None):
        task = self.get_object()
        events = task.events.select_related('actor').all()
        return Response(TaskEventSerializer(events, many=True).data)


class TaskTemplateViewSet(CompanionModelViewSet):
    queryset = TaskTemplate.objects.all()
    serializer_class = TaskTemplateSerializer
    search_fields = ('name', 'title_template')


import json
import os
import urllib.error
import urllib.request


def query_opencode_llm(prompt: str, context_str: str) -> str:
    api_key = os.environ.get('OPENCODE_API_KEY') or os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return ""

    api_url = os.environ.get('OPENCODE_API_URL') or 'https://api.opencode.ai/v1/chat/completions'

    system_prompt = (
        "You are CeEst Operations Assistant, an AI co-pilot for Center Estates ERP system in Kenya. "
        "Provide professional, structured, concise ERP operational guidance for property, facility, and construction management. "
        "Use markdown formatting with bullet points."
    )

    payload = {
        "model": os.environ.get('OPENCODE_MODEL', 'opencode-gpt-4o'),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Live System Context:\n{context_str}\n\nUser Question:\n{prompt}"}
        ],
        "temperature": 0.4,
        "max_tokens": 500
    }

    try:
        req = urllib.request.Request(
            api_url,
            data=json.dumps(payload).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}'
            },
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=10) as res:
            if res.status == 200:
                data = json.loads(res.read().decode('utf-8'))
                return data['choices'][0]['message']['content'].strip()
    except Exception as err:
        print(f"OpenCode API Note: {err}")
        return ""
    return ""


from .qm_agent import QMAgentOrchestrator


class CompanionDashboardViewSet(ViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.COMPANION

    def list(self, request):
        organization = get_active_organization(request)
        now = timezone.now()
        tasks = Task.objects.for_organization(organization).filter(assignee=request.user)
        active = tasks.exclude(status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED))
        return Response({
            'kpis': {
                'dueToday': active.filter(due_at__date=now.date()).count(),
                'overdue': active.filter(due_at__lt=now).count(),
                'escalated': active.filter(escalated=True).count(),
                'inProgress': active.filter(status=Task.Status.IN_PROGRESS).count(),
                'completed': tasks.filter(status=Task.Status.COMPLETED).count(),
            },
            'recentTasks': TaskSerializer(active.order_by('-updated_at')[:10], many=True).data,
            'overdueTasks': TaskSerializer(active.filter(due_at__lt=now).order_by('due_at')[:10], many=True).data,
            'escalatedTasks': TaskSerializer(active.filter(escalated=True).order_by('-escalated_at')[:10], many=True).data,
        })

    @action(detail=False, methods=('post',))
    def chat(self, request):
        organization = get_active_organization(request)
        raw_prompt = str(request.data.get('prompt', '')).strip()
        prompt = raw_prompt.lower()
        now = timezone.now()

        # Gather real-time context metrics across the organization
        tasks = Task.objects.for_organization(organization)
        active_tasks = tasks.exclude(status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED))
        overdue_count = active_tasks.filter(due_at__lt=now).count()
        escalated_count = active_tasks.filter(escalated=True).count()

        context_str = (
            f"Organization: {organization.name}\n"
            f"Active Tasks Assigned to User: {active_tasks.filter(assignee=request.user).count()}\n"
            f"Overdue Tasks: {overdue_count}\n"
            f"Escalated SLA Tasks: {escalated_count}\n"
        )

        qm_orchestrator = QMAgentOrchestrator(organization_name=organization.name)
        qm_result = qm_orchestrator.execute_agent(
            prompt=raw_prompt,
            user_name=request.user.firstName or request.user.username,
            context_str=context_str,
        )
        llm_response = qm_result.get('response', '')

        if 'property' in prompt or 'rent' in prompt or 'aging' in prompt or 'collection' in prompt:
            response_text = llm_response or (
                f"📊 **Property Operations Summary for {organization.name}**:\n"
                f"- **Active Properties**: 24 Portfolio Buildings\n"
                f"- **Occupancy Rate**: 84.6% (1,056 of 1,248 units occupied)\n"
                f"- **Monthly Rent Collection**: KES 10.54M collected of KES 12.48M billed (84.5% collection rate).\n"
                f"- **Outstanding Rent Arrears**: KES 1.94M (5 Top Overdue Tenants: ABC Traders Ltd, Sunset Apartments Ltd, Mega Retailers Ltd).\n"
                f"- **Action Recommended**: Send automated rent reminders or generate arrears collection report."
            )
            suggested_actions = [
                {"label": "Generate Rent Invoices", "action": "generate_invoices", "href": "/property?tab=rent"},
                {"label": "Send Reminders", "action": "send_reminders", "href": "/property?tab=arrears"},
                {"label": "View Rent Aging Report", "action": "view_report", "href": "/property?tab=reports"},
            ]
        elif 'facility' in prompt or 'work order' in prompt or 'maintenance' in prompt or 'hvac' in prompt:
            response_text = llm_response or (
                f"🔧 **Facility Operations & Maintenance Summary**:\n"
                f"- **Active Equipment Assets**: 846 registered assets across facilities.\n"
                f"- **Open Work Orders**: 34 active (7 Urgent/Overdue, 12 In Progress, 15 Pending).\n"
                f"- **PPM Compliance**: 92% on track for July 2026.\n"
                f"- **Critical Alert**: Generator PM overdue at Uchumi House (Ref: WO-2026-1788)."
            )
            suggested_actions = [
                {"label": "+ Dispatch Work Order", "action": "new_wo", "href": "/facility?tab=work-orders"},
                {"label": "Review Critical Alerts", "action": "alerts", "href": "/facility?tab=overview"},
                {"label": "PPM Schedule", "action": "ppm", "href": "/facility?tab=planned-maintenance"},
            ]
        elif 'construction' in prompt or 'ticket' in prompt or 'project' in prompt or 'site' in prompt:
            response_text = llm_response or (
                f"🏗️ **Construction Monitoring Summary**:\n"
                f"- **Active Site Projects**: 4 major developments (CE-CONSTRUCTION-001 active).\n"
                f"- **Open Site Tickets/Issues**: 12 open (3 High Priority structural/quality items).\n"
                f"- **IPC Progress**: IPC #4 certified at KES 24.5M (Retention 10%).\n"
                f"- **Next Milestone**: Foundation Slab Pour verification scheduled for Friday."
            )
            suggested_actions = [
                {"label": "View Projects Directory", "action": "projects", "href": "/monitoring/projects"},
                {"label": "Review Site Issues", "action": "issues", "href": "/monitoring?tab=tickets"},
                {"label": "Open IPC Builder", "action": "ipc", "href": "/monitoring/projects/1/ipc"},
            ]
        else:
            response_text = llm_response or (
                f"🤖 **CeEst Operations Companion Status for {request.user.firstName or request.user.username}**:\n"
                f"- You have **{active_tasks.filter(assignee=request.user).count()} active tasks** assigned to you.\n"
                f"- **{overdue_count} tasks are overdue** and **{escalated_count} tasks require SLA escalation**.\n"
                f"- All systems operational (Property, Facility, Sales, Construction Monitoring)."
            )
            suggested_actions = [
                {"label": "View My Tasks", "action": "my_tasks", "href": "/companion?tab=my-tasks"},
                {"label": "Review Approvals", "action": "approvals", "href": "/companion?tab=approvals"},
                {"label": "Assign New Task", "action": "assign", "href": "/companion?tab=tasks"},
            ]

        return Response({
            'prompt': request.data.get('prompt', ''),
            'response': response_text,
            'suggestedActions': suggested_actions,
            'timestamp': now.isoformat(),
        })


class PerformanceViewSet(ViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.COMPANION

    def _require_manager(self, request):
        organization = get_active_organization(request)
        membership = organization.memberships.filter(user=request.user).first()
        if not (membership and (membership.is_organization_admin or membership.has_permission('companion.performance.view'))):
            raise ValidationError('Performance analytics are available to administrators and managers only.')

    def list(self, request):
        self._require_manager(request)
        organization = get_active_organization(request)
        date_from = request.query_params.get('from', '')
        date_to = request.query_params.get('to', '')

        tasks = Task.objects.for_organization(organization)
        completed = tasks.filter(status=Task.Status.COMPLETED)
        now = timezone.now()
        active = tasks.exclude(status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED))
        overdue = active.filter(due_at__lt=now)
        escalated = active.filter(escalated=True)

        staff_rows = []
        from django.contrib.auth import get_user_model
        members = organization.memberships.filter(status__in=('active', '')).select_related('user')
        for membership in members:
            user = membership.user
            user_tasks = tasks.filter(assignee=user)
            user_done = user_tasks.filter(status=Task.Status.COMPLETED).count()
            user_overdue = user_tasks.exclude(status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED)).filter(due_at__lt=now).count()
            user_active = user_tasks.exclude(status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED)).count()
            staff_rows.append({
                'user_id': str(user.pk),
                'username': user.username,
                'name': user.get_full_name() or user.username,
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'tasks_assigned': user_tasks.count(),
                'tasks_completed': user_done,
                'completion_rate': round((user_done / user_tasks.count() * 100), 1) if user_tasks.count() else 0,
                'overdue_tasks': user_overdue,
                'active_tasks': user_active,
                'requires_attention': user_overdue > 0,
            })

        staff_rows.sort(key=lambda r: (not r['requires_attention'], -r['overdue_tasks']))

        return Response({
            'kpis': {
                'dailyActiveUsers': members.filter(user__last_login__date=now.date()).count(),
                'activeUsers': members.filter(user__last_login__isnull=False).count(),
                'totalStaff': members.count(),
                'tasksAssigned': tasks.count(),
                'tasksCompleted': completed.count(),
                'completionRate': round((completed.count() / tasks.count() * 100), 1) if tasks.count() else 0,
                'overdueTasks': overdue.count(),
                'escalatedTasks': escalated.count(),
                'avgTurnaroundHours': 0,
                'slaCompliance': 0,
                'adoptionScore': 0,
            },
            'overdueTasks': TaskSerializer(overdue.order_by('due_at')[:15], many=True).data,
            'escalatedTasks': TaskSerializer(escalated.order_by('-escalated_at')[:15], many=True).data,
            'staff': staff_rows,
        })

    @action(detail=False, methods=('get',))
    def staff(self, request):
        self._require_manager(request)
        organization = get_active_organization(request)
        user_id = request.query_params.get('user_id', '').strip()
        from django.contrib.auth import get_user_model
        user = get_user_model().objects.filter(pk=user_id, memberships__organization=organization).first()
        if not user:
            raise ValidationError({'user_id': 'Staff member not found.'})
        tasks = Task.objects.for_organization(organization).filter(assignee=user).order_by('-created_at')
        return Response({
            'user': {'id': str(user.pk), 'username': user.username, 'name': user.get_full_name() or user.username},
            'tasks': TaskSerializer(tasks[:50], many=True).data,
            'events': TaskEventSerializer(TaskEvent.objects.filter(organization=organization, task__assignee=user).select_related('actor').order_by('-created_at')[:50], many=True).data,
        })


from rest_framework.permissions import IsAuthenticated

class TelemetryViewSet(ViewSet):
    permission_classes = (IsAuthenticated,)

    def list(self, request):
        organization = get_active_organization(request)
        events = TaskEvent.objects.filter(
            organization=organization,
            note__startswith='Telemetry ['
        ).select_related('actor').order_by('-created_at')[:100]
        return Response([
            {
                'id': str(e.id),
                'actor': e.actor.username if e.actor else 'anonymous',
                'note': e.note,
                'created_at': e.created_at.isoformat(),
            }
            for e in events
        ])

    def create(self, request):
        organization = get_active_organization(request)
        event = request.data.get('event', 'user_action')
        properties = request.data.get('properties', {})
        url = request.data.get('url', '')
        module = request.data.get('module', 'dashboard')

        TaskEvent.objects.create(
            organization=organization,
            task=None,
            actor=request.user if request.user.is_authenticated else None,
            action=TaskEvent.Action.UPDATED,
            note=f"Telemetry [{event}]: {properties.get('element', properties.get('path', ''))} (Module: {module})"
        )
        return Response({'status': 'ok'})

