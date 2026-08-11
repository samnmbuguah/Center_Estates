from django.db import transaction
from drf_spectacular.utils import OpenApiTypes, extend_schema, extend_schema_view
from django.db.models import Count, F, Q, Sum
from django.utils import timezone
from rest_framework import serializers
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet

from core.models import Module
from core.permissions import HasModuleActionPermission
from core.serializers import GenericObjectSerializer
from core.tenancy import get_active_membership, get_active_organization
from core.property_scope import get_active_property, scope_model_queryset, scope_queryset_to_property

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
        organization = get_active_organization(self.request)
        queryset = scope_queryset_to_property(self.queryset.for_organization(organization), self.request, organization)
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
        organization = self._validate_organization(serializer)
        values = {'organization': organization}
        if serializer.Meta.model is Task and 'property' not in serializer.validated_data:
            values['property'] = get_active_property(self.request, organization)
        serializer.save(**values)

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


from .qm_agent import QMAgentOrchestrator


@extend_schema_view(list=extend_schema(request=None, responses=OpenApiTypes.OBJECT))
class CompanionDashboardViewSet(ViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.COMPANION

    serializer_class = GenericObjectSerializer

    @extend_schema(request=None, responses={200: OpenApiTypes.OBJECT})
    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        organization = get_active_organization(request)
        now = timezone.now()
        tasks = scope_model_queryset(Task, request, organization).select_related(
            'assignee', 'assigned_by', 'delegated_to', 'template',
        ).filter(assignee=request.user)
        active = tasks.exclude(status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED))
        kpis = tasks.aggregate(
            dueToday=Count('id', filter=Q(
                due_at__date=now.date(),
            ) & ~Q(status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED))),
            overdue=Count('id', filter=Q(
                due_at__lt=now,
            ) & ~Q(status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED))),
            escalated=Count('id', filter=Q(
                escalated=True,
            ) & ~Q(status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED))),
            inProgress=Count('id', filter=Q(status=Task.Status.IN_PROGRESS)),
            completed=Count('id', filter=Q(status=Task.Status.COMPLETED)),
        )
        return Response({
            'kpis': kpis,
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

        # QM is read-only and is grounded only in records this user is authorized to see.
        tasks = scope_model_queryset(Task, request, organization).select_related(
            'assignee', 'assigned_by', 'delegated_to', 'template',
        ).filter(assignee=request.user)
        active_tasks = tasks.exclude(status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED))
        overdue_count = active_tasks.filter(due_at__lt=now).count()
        escalated_count = active_tasks.filter(escalated=True).count()
        context = {
            'organization': organization.name,
            'property_scope': getattr(get_active_property(request, organization), 'name', 'Portfolio'),
            'my_tasks': {'active': active_tasks.count(), 'overdue': overdue_count, 'escalated': escalated_count},
        }
        subscribed = set(organization.subscriptions.available().values_list('module', flat=True))
        membership = get_active_membership(request, organization)
        permission_keys = set()
        if membership:
            membership = membership.__class__.objects.prefetch_related('roles__permissions').get(pk=membership.pk)
            permission_keys = {permission.key for role in membership.roles.all() for permission in role.permissions.all()}
        is_admin = bool(request.user.is_superuser or (membership and membership.is_organization_admin))

        def can_view(module):
            return module in subscribed and (is_admin or any(key.startswith(f'{module}.') for key in permission_keys))

        if can_view(Module.PROPERTY):
            from properties.models import Invoice, Lease, Property, Receipt, Unit
            properties = scope_model_queryset(Property, request, organization)
            units = scope_model_queryset(Unit, request, organization)
            invoices = scope_model_queryset(Invoice, request, organization).exclude(status=Invoice.Status.VOID)
            month_start = now.date().replace(day=1)
            receipts = scope_model_queryset(Receipt, request, organization).filter(received_on__gte=month_start)
            context['property'] = {
                'properties': properties.count(), 'units': units.count(),
                'occupied_units': units.filter(status=Unit.Status.OCCUPIED).count(),
                'active_leases': scope_model_queryset(Lease, request, organization).filter(status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING)).count(),
                'outstanding_kes': str(invoices.aggregate(total=Sum('balance'))['total'] or 0),
                'collections_this_month_kes': str(receipts.aggregate(total=Sum('amount'))['total'] or 0),
            }
        if can_view(Module.FACILITY):
            from facilities.models import PreventiveSchedule, WorkOrder
            orders = scope_model_queryset(WorkOrder, request, organization).exclude(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED))
            context['facility'] = {
                'open_work_orders': orders.count(),
                'critical_work_orders': orders.filter(priority=WorkOrder.Priority.CRITICAL).count(),
                'overdue_work_orders': orders.filter(resolution_due_at__lt=now).count(),
                'overdue_ppm': scope_model_queryset(PreventiveSchedule, request, organization).filter(is_active=True, next_due_on__lt=now.date()).count(),
            }

        import json
        context_str = json.dumps(context, indent=2)

        qm_orchestrator = QMAgentOrchestrator(organization_name=organization.name)
        qm_result = qm_orchestrator.execute_agent(
            prompt=raw_prompt,
            user_name=request.user.first_name or request.user.username,
            context_str=context_str,
        )
        llm_response = qm_result.get('response', '')

        if 'property' in prompt or 'rent' in prompt or 'aging' in prompt or 'collection' in prompt:
            data = context.get('property')
            response_text = llm_response or (f"Property information is not available for your role." if not data else (
                f"**Live property summary — {context['property_scope']}**\n"
                f"- Properties: **{data['properties']}**; units: **{data['units']}**; occupied: **{data['occupied_units']}**\n"
                f"- Active leases: **{data['active_leases']}**\n"
                f"- Collected this month: **KES {data['collections_this_month_kes']}**\n"
                f"- Outstanding invoice balance: **KES {data['outstanding_kes']}**"
            ))
            suggested_actions = [
                {"label": "Generate Rent Invoices", "action": "generate_invoices", "href": "/property?tab=rent"},
                {"label": "Send Reminders", "action": "send_reminders", "href": "/property?tab=arrears"},
                {"label": "View Rent Aging Report", "action": "view_report", "href": "/property?tab=reports"},
            ]
        elif 'facility' in prompt or 'work order' in prompt or 'maintenance' in prompt or 'hvac' in prompt:
            data = context.get('facility')
            response_text = llm_response or ("Facility information is not available for your role." if not data else (
                f"**Live facility summary — {context['property_scope']}**\n"
                f"- Open work orders: **{data['open_work_orders']}**\n"
                f"- Critical: **{data['critical_work_orders']}**; overdue: **{data['overdue_work_orders']}**\n"
                f"- Overdue preventive-maintenance schedules: **{data['overdue_ppm']}**"
            ))
            suggested_actions = [
                {"label": "+ Dispatch Work Order", "action": "new_wo", "href": "/facility?tab=work-orders"},
                {"label": "Review Critical Alerts", "action": "alerts", "href": "/facility?tab=overview"},
                {"label": "PPM Schedule", "action": "ppm", "href": "/facility?tab=planned-maintenance"},
            ]
        elif 'construction' in prompt or 'ticket' in prompt or 'project' in prompt or 'site' in prompt:
            response_text = llm_response or "Construction data tools are not enabled for this QM workspace yet. Open Monitoring to review current project records."
            suggested_actions = [
                {"label": "View Projects Directory", "action": "projects", "href": "/monitoring/projects"},
                {"label": "Review Site Issues", "action": "issues", "href": "/monitoring?tab=tickets"},
                {"label": "Open IPC Builder", "action": "ipc", "href": "/monitoring/projects/1/ipc"},
            ]
        else:
            response_text = llm_response or (
                f"🤖 **CeEst Operations Companion Status for {request.user.first_name or request.user.username}**:\n"
                f"- You have **{active_tasks.filter(assignee=request.user).count()} active tasks** assigned to you.\n"
                f"- **{overdue_count} tasks are overdue** and **{escalated_count} tasks require SLA escalation**.\n"
                f"- Answers use your authorized live property scope: **{context['property_scope']}**."
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
            'agent': qm_result.get('agent', 'Quartermaster (QM)'),
            'agentStatus': qm_result.get('status', 'local'),
            'groundedAt': now.isoformat(),
            'timestamp': now.isoformat(),
        })


@extend_schema_view(list=extend_schema(request=None, responses=OpenApiTypes.OBJECT))
class PerformanceViewSet(ViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.COMPANION

    serializer_class = GenericObjectSerializer

    def _require_manager(self, request):
        organization = get_active_organization(request)
        membership = get_active_membership(request, organization)
        if not (membership and (membership.is_organization_admin or membership.has_permission('companion.performance.view'))):
            raise ValidationError('Performance analytics are available to administrators and managers only.')

    @extend_schema(request=None, responses={200: OpenApiTypes.OBJECT})
    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        self._require_manager(request)
        organization = get_active_organization(request)
        date_from = request.query_params.get('from', '')
        date_to = request.query_params.get('to', '')

        tasks = scope_model_queryset(Task, request, organization).select_related(
            'assignee', 'assigned_by', 'delegated_to', 'template',
        )
        completed = tasks.filter(status=Task.Status.COMPLETED)
        now = timezone.now()
        active = tasks.exclude(status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED))
        overdue = active.filter(due_at__lt=now)
        escalated = active.filter(escalated=True)

        staff_rows = []
        members = list(organization.memberships.filter(status__in=('active', '')).select_related('user'))
        active_status_filter = ~Q(status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED))
        task_totals = tasks.aggregate(
            total=Count('id'),
            completed=Count('id', filter=Q(status=Task.Status.COMPLETED)),
            overdue=Count('id', filter=active_status_filter & Q(due_at__lt=now)),
            escalated=Count('id', filter=active_status_filter & Q(escalated=True)),
        )
        by_assignee = {
            row['assignee_id']: row
            for row in tasks.values('assignee_id').annotate(
                total=Count('id'),
                completed=Count('id', filter=Q(status=Task.Status.COMPLETED)),
                overdue=Count('id', filter=active_status_filter & Q(due_at__lt=now)),
                active=Count('id', filter=active_status_filter),
            )
        }
        for membership in members:
            user = membership.user
            stats = by_assignee.get(user.pk, {})
            user_total = stats.get('total', 0)
            user_done = stats.get('completed', 0)
            user_overdue = stats.get('overdue', 0)
            user_active = stats.get('active', 0)
            staff_rows.append({
                'user_id': str(user.pk),
                'username': user.username,
                'name': user.get_full_name() or user.username,
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'tasks_assigned': user_total,
                'tasks_completed': user_done,
                'completion_rate': round((user_done / user_total * 100), 1) if user_total else 0,
                'overdue_tasks': user_overdue,
                'active_tasks': user_active,
                'requires_attention': user_overdue > 0,
            })

        staff_rows.sort(key=lambda r: (not r['requires_attention'], -r['overdue_tasks']))

        return Response({
            'kpis': {
                'dailyActiveUsers': sum(1 for member in members if member.user.last_login and member.user.last_login.date() == now.date()),
                'activeUsers': sum(1 for member in members if member.user.last_login),
                'totalStaff': len(members),
                'tasksAssigned': task_totals['total'],
                'tasksCompleted': task_totals['completed'],
                'completionRate': round((task_totals['completed'] / task_totals['total'] * 100), 1) if task_totals['total'] else 0,
                'overdueTasks': task_totals['overdue'],
                'escalatedTasks': task_totals['escalated'],
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
        tasks = scope_model_queryset(Task, request, organization).filter(assignee=user).order_by('-created_at')
        return Response({
            'user': {'id': str(user.pk), 'username': user.username, 'name': user.get_full_name() or user.username},
            'tasks': TaskSerializer(tasks[:50], many=True).data,
            'events': TaskEventSerializer(TaskEvent.objects.filter(organization=organization, task__assignee=user).select_related('actor').order_by('-created_at')[:50], many=True).data,
        })


from rest_framework.permissions import IsAuthenticated

@extend_schema_view(list=extend_schema(request=None, responses=OpenApiTypes.OBJECT))
class TelemetryViewSet(ViewSet):
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: OpenApiTypes.OBJECT})
    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        organization = get_active_organization(request)
        module_param = request.query_params.get('module', '').strip()
        path_param = request.query_params.get('path', '').strip()
        user_param = request.query_params.get('user', '').strip() or request.query_params.get('actor', '').strip()

        queryset = TaskEvent.objects.filter(
            organization=organization,
            note__startswith='Telemetry ['
        ).select_related('actor')

        if module_param:
            queryset = queryset.filter(note__icontains=f"(Module: {module_param})")
        if path_param:
            queryset = queryset.filter(note__icontains=path_param)
        if user_param:
            queryset = queryset.filter(actor__username__icontains=user_param)

        events = queryset.order_by('-created_at')[:100]

        all_telemetry = TaskEvent.objects.filter(
            organization=organization,
            note__startswith='Telemetry ['
        ).select_related('actor')
        page_counts = {}
        user_stats = {}
        for ev in all_telemetry[:1000]:
            note = ev.note
            mod = "dashboard"
            if "(Module: " in note:
                mod = note.split("(Module: ")[-1].rstrip(")")
            page_counts[mod] = page_counts.get(mod, 0) + 1

            actor_name = ev.actor.username if ev.actor else "anonymous"
            stats = user_stats.setdefault(actor_name, {'events': 0, 'modules': set(), 'last_seen': None})
            stats['events'] += 1
            if mod:
                stats['modules'].add(mod)
            if stats['last_seen'] is None or ev.created_at > stats['last_seen']:
                stats['last_seen'] = ev.created_at

        by_user = {}
        for name, stats in user_stats.items():
            by_user[name] = {
                'events': stats['events'],
                'modules': sorted(stats['modules']),
                'last_seen': stats['last_seen'].isoformat() if stats['last_seen'] else None,
            }

        return Response({
            'by_module': page_counts,
            'by_user': by_user,
            'events': [
                {
                    'id': str(e.id),
                    'actor': e.actor.username if e.actor else 'anonymous',
                    'note': e.note,
                    'created_at': e.created_at.isoformat(),
                }
                for e in events
            ]
        })

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def create(self, request):
        organization = get_active_organization(request)
        raw_events = request.data.get('events')
        events = raw_events if isinstance(raw_events, list) else [request.data]
        if not events or len(events) > 100:
            raise ValidationError({'events': 'Submit between 1 and 100 telemetry events.'})
        records = []
        for payload in events:
            if not isinstance(payload, dict):
                raise ValidationError({'events': 'Every telemetry event must be an object.'})
            event = str(payload.get('event', 'user_action'))[:60]
            properties = payload.get('properties', {})
            if not isinstance(properties, dict):
                properties = {}
            module = str(payload.get('module', 'dashboard'))[:40]
            detail = str(properties.get('element', properties.get('path', '')))[:300]
            records.append(TaskEvent(
                organization=organization,
                task=None,
                actor=request.user,
                action=TaskEvent.Action.UPDATED,
                note=f"Telemetry [{event}]: {detail} (Module: {module})",
            ))
        TaskEvent.objects.bulk_create(records)
        return Response({'status': 'ok', 'accepted': len(records)}, status=status.HTTP_201_CREATED)
