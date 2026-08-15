from django.db import transaction
from drf_spectacular.utils import OpenApiTypes, extend_schema, extend_schema_view
from django.db.models import Count, F, Q, Sum
from django.utils import timezone
from rest_framework import serializers
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet

from core.models import Module
from core.permissions import HasModuleActionPermission
from core.serializers import GenericObjectSerializer
from config.throttling import QMChatRateThrottle
from core.tenancy import get_active_membership, get_active_organization
from core.property_scope import get_active_property, scope_model_queryset, scope_queryset_to_property

from .models import (
    StaffHrRequest,
    StaffLeaveBalance,
    StaffLeaveRequest,
    Task,
    TaskEvent,
    TaskTemplate,
    TeamFeedbackMessage,
    TeamFeedbackThread,
)
from .serializers import (
    StaffHrRequestSerializer,
    StaffLeaveBalanceSerializer,
    StaffLeaveRequestSerializer,
    TaskEventSerializer,
    TaskSerializer,
    TaskTemplateSerializer,
    TeamFeedbackMessageSerializer,
    TeamFeedbackThreadSerializer,
)

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
        active_property = get_active_property(self.request, organization)
        requested_property = serializer.validated_data.get('property')
        if active_property and requested_property and requested_property.pk != active_property.pk:
            raise ValidationError({'property': 'Create the task for the property currently selected in the workspace.'})
        count = Task.objects.filter(organization=organization).count()
        task = serializer.save(
            organization=organization,
            property=requested_property or active_property,
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
        note = str(request.data.get('note', '')).strip()
        attachment_url = str(request.data.get('attachment_url', '')).strip()
        checklist = request.data.get('checklist')
        if checklist is not None and isinstance(checklist, list):
            task.checklist = checklist
        if attachment_url:
            task.attachment_url = attachment_url
        self._transition(task, Task.Status.COMPLETED, request.user, note=note or 'Task completed.')
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=('post',), url_path='update-checklist')
    def update_checklist(self, request, pk=None):
        task = self.get_object()
        checklist = request.data.get('checklist', [])
        if isinstance(checklist, list):
            task.checklist = checklist
            task.save(update_fields=['checklist'])
            TaskEvent.objects.create(
                organization=task.organization, task=task, actor=request.user,
                action=TaskEvent.Action.UPDATED, note='Updated task checklist / sub-tasks.',
            )
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
    permission_map = {'chat': 'companion.view'}

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

    @action(detail=False, methods=('post',), throttle_classes=(QMChatRateThrottle,))
    def chat(self, request):
        organization = get_active_organization(request)
        raw_prompt = str(request.data.get('prompt', '')).strip()
        if len(raw_prompt) > 2000:
            raise ValidationError({'prompt': 'Keep your question under 2,000 characters.'})
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

        def can(permission):
            return is_admin or permission in permission_keys

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

        if any(term in prompt for term in ('brief', 'priorit', 'start of day', 'today')):
            parts = [
                f"**Your operational briefing — {context['property_scope']}**",
                f"- Active tasks: **{context['my_tasks']['active']}**; overdue: **{overdue_count}**; escalated: **{escalated_count}**",
            ]
            property_data = context.get('property')
            facility_data = context.get('facility')
            if property_data:
                parts.append(
                    f"- Property: **{property_data['occupied_units']} of {property_data['units']} units occupied**; "
                    f"KES **{property_data['collections_this_month_kes']}** collected this month; "
                    f"KES **{property_data['outstanding_kes']}** outstanding"
                )
            if facility_data:
                parts.append(
                    f"- Facility: **{facility_data['open_work_orders']} open work orders**, "
                    f"including **{facility_data['critical_work_orders']} critical** and **{facility_data['overdue_work_orders']} overdue**; "
                    f"**{facility_data['overdue_ppm']}** overdue PPM schedules"
                )
            response_text = llm_response or '\n'.join(parts)
            suggested_actions = [{"label": "View My Tasks", "action": "my_tasks", "href": "/companion?tab=my-tasks"}]
            if property_data:
                suggested_actions.append({"label": "Review Collections", "action": "collections", "href": "/property?tab=rent"})
            if facility_data:
                suggested_actions.append({"label": "Review Work Orders", "action": "work_orders", "href": "/facility?tab=work-orders"})
        elif 'property' in prompt or 'rent' in prompt or 'aging' in prompt or 'collection' in prompt:
            data = context.get('property')
            response_text = llm_response or (f"Property information is not available for your role." if not data else (
                f"**Live property summary — {context['property_scope']}**\n"
                f"- Properties: **{data['properties']}**; units: **{data['units']}**; occupied: **{data['occupied_units']}**\n"
                f"- Active leases: **{data['active_leases']}**\n"
                f"- Collected this month: **KES {data['collections_this_month_kes']}**\n"
                f"- Outstanding invoice balance: **KES {data['outstanding_kes']}**"
            ))
            suggested_actions = [{"label": "View Rent Aging", "action": "view_report", "href": "/property?tab=arrears"}]
            if can('property.finance'):
                suggested_actions[:0] = [
                    {"label": "Generate Rent Invoices", "action": "generate_invoices", "href": "/property?tab=billing"},
                    {"label": "Send Reminders", "action": "send_reminders", "href": "/property?tab=arrears"},
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
                {"label": "Review Critical Alerts", "action": "alerts", "href": "/facility?tab=overview"},
                {"label": "PPM Schedule", "action": "ppm", "href": "/facility?tab=planned-maintenance"},
            ]
            if can('facility.work') or can('facility.manage'):
                suggested_actions.insert(0, {"label": "+ Dispatch Work Order", "action": "new_wo", "href": "/facility?tab=work-orders"})
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
        if getattr(request.user, 'is_superuser', False):
            return
        organization = get_active_organization(request)
        membership = get_active_membership(request, organization)
        if membership and (membership.is_organization_admin or membership.roles.filter(slug__in=['portfolio-manager', 'property-manager', 'super-admin']).exists()):
            return
        raise PermissionDenied('Performance analytics are available to super administrators and managers only.')

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
            'events': TaskEventSerializer(
                scope_model_queryset(TaskEvent, request, organization)
                .filter(task__assignee=user).select_related('actor').order_by('-created_at')[:50],
                many=True,
            ).data,
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


class TeamFeedbackThreadViewSet(CompanionModelViewSet):
    queryset = TeamFeedbackThread.objects.all()
    serializer_class = TeamFeedbackThreadSerializer
    search_fields = ('title', 'reference', 'module')

    def get_queryset(self):
        organization = get_active_organization(self.request)
        queryset = self.queryset.filter(organization=organization).prefetch_related('messages__sender', 'property')
        status_param = self.request.query_params.get('status')
        category_param = self.request.query_params.get('category')
        property_param = self.request.query_params.get('property')
        if status_param:
            queryset = queryset.filter(status=status_param)
        if category_param:
            queryset = queryset.filter(category=category_param)
        if property_param:
            queryset = queryset.filter(property_id=property_param)
        return queryset

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        thread = serializer.save(
            organization=organization,
            created_by=self.request.user,
            property=get_active_property(self.request, organization),
        )
        initial_message = self.request.data.get('initial_message')
        attachment_url = self.request.data.get('attachment_url', '')
        if initial_message:
            TeamFeedbackMessage.objects.create(
                organization=organization,
                thread=thread,
                sender=self.request.user,
                sender_name=f"{self.request.user.first_name} {self.request.user.last_name}".strip() or self.request.user.username,
                message=initial_message,
                attachment_url=attachment_url,
            )

    @action(detail=False, methods=['post'], url_path='upload')
    def upload_attachment(self, request):
        upload = request.FILES.get('file')
        if not upload:
            raise ValidationError({'file': 'No file was provided for upload.'})
        if upload.size > 25 * 1024 * 1024:
            raise ValidationError({'file': 'Attachment exceeds maximum 25 MB size limit.'})
        
        import os, uuid
        from django.core.files.storage import default_storage
        ext = os.path.splitext(upload.name)[1].lower() or '.png'
        filename = f"companion/feedback/{request.user.id}/{uuid.uuid4().hex[:12]}_{upload.name}"
        saved_path = default_storage.save(filename, upload)
        file_url = default_storage.url(saved_path)
        if not file_url.startswith('http'):
            if not file_url.startswith('/'):
                file_url = f"/media/{saved_path}"
            if hasattr(request, 'build_absolute_uri'):
                file_url = request.build_absolute_uri(file_url)
        
        return Response({
            'url': file_url,
            'name': upload.name,
            'size': upload.size,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='messages')
    def add_message(self, request, pk=None):
        thread = self.get_object()
        organization = get_active_organization(request)
        message_text = request.data.get('message', '').strip()
        attachment_url = request.data.get('attachment_url', '')
        is_dev = bool(request.data.get('is_developer_response', False) or request.user.is_superuser)
        if not message_text:
            raise ValidationError({'message': 'Message text is required.'})
        
        msg = TeamFeedbackMessage.objects.create(
            organization=organization,
            thread=thread,
            sender=request.user,
            sender_name=f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username,
            message=message_text,
            attachment_url=attachment_url,
            is_developer_response=is_dev,
        )
        return Response(TeamFeedbackMessageSerializer(msg).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='update-status')
    def update_status(self, request, pk=None):
        thread = self.get_object()
        new_status = request.data.get('status')
        if new_status not in TeamFeedbackThread.Status.values:
            raise ValidationError({'status': 'Invalid status choice.'})
        thread.status = new_status
        thread.save()
        return Response(TeamFeedbackThreadSerializer(thread).data)


class StaffLeaveRequestViewSet(CompanionModelViewSet):
    queryset = StaffLeaveRequest.objects.select_related('requester', 'relief_staff', 'decided_by')
    serializer_class = StaffLeaveRequestSerializer

    def get_queryset(self):
        organization = get_active_organization(self.request)
        qs = self.queryset.for_organization(organization)
        membership = get_active_membership(self.request)
        is_admin = bool(self.request.user.is_superuser or (membership and membership.is_organization_admin))

        # Non-admins only see their own leave requests unless filtering for team calendar
        scope = self.request.query_params.get('scope')
        if not is_admin and scope != 'team':
            qs = qs.filter(requester=self.request.user)

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        leave_type = self.request.query_params.get('leave_type')
        if leave_type:
            qs = qs.filter(leave_type=leave_type)

        user_id = self.request.query_params.get('user')
        if user_id:
            qs = qs.filter(requester_id=user_id)

        return qs

    def perform_create(self, serializer):
        organization = get_active_organization(self.request)
        start_date = serializer.validated_data.get('start_date')
        end_date = serializer.validated_data.get('end_date')
        if start_date and end_date and end_date < start_date:
            raise ValidationError({'end_date': 'End date cannot precede start date.'})
        
        # Calculate working days roughly if not explicitly provided
        total_days = serializer.validated_data.get('total_days')
        if not total_days and start_date and end_date:
            import datetime
            delta = (end_date - start_date).days + 1
            total_days = max(1, delta)

        serializer.save(
            organization=organization,
            requester=self.request.user,
            total_days=total_days,
            status=StaffLeaveRequest.Status.PENDING,
        )

    @action(detail=True, methods=['post'], url_path='decide')
    def decide(self, request, pk=None):
        membership = get_active_membership(request)
        is_admin = bool(request.user.is_superuser or (membership and membership.is_organization_admin))
        if not is_admin:
            raise PermissionDenied('Only organization administrators can approve or reject leave requests.')

        leave_req = self.get_object()
        decision = request.data.get('decision')
        notes = request.data.get('notes', '').strip()

        if decision not in ('approved', 'rejected', 'cancelled'):
            raise ValidationError({'decision': 'Decision must be approved, rejected, or cancelled.'})

        leave_req.status = decision
        leave_req.decided_by = request.user
        leave_req.decision_notes = notes
        leave_req.decided_at = timezone.now()
        leave_req.save()

        return Response(StaffLeaveRequestSerializer(leave_req).data)

    @action(detail=False, methods=['get'], url_path='balance')
    def get_balance(self, request):
        organization = get_active_organization(request)
        user_id = request.query_params.get('user')
        target_user = request.user
        if user_id:
            membership = get_active_membership(request)
            is_admin = bool(request.user.is_superuser or (membership and membership.is_organization_admin))
            if is_admin:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                target_user = User.objects.filter(id=user_id).first() or request.user

        current_year = timezone.now().year
        balance, _ = StaffLeaveBalance.objects.get_or_create(
            organization=organization,
            user=target_user,
            year=current_year,
            defaults={'annual_entitlement': 21.0, 'carried_forward': 0.0}
        )

        name = f"{target_user.first_name} {target_user.last_name}".strip() or target_user.username
        data = {
            'user_id': target_user.id,
            'user_name': name,
            'user_username': target_user.username,
            'year': current_year,
            'annual_entitlement': float(balance.annual_entitlement),
            'carried_forward': float(balance.carried_forward),
            'total_entitlement': float(balance.total_entitlement),
            'taken_days': balance.get_taken_days(),
            'pending_days': balance.get_pending_days(),
            'remaining_days': balance.remaining_days,
        }
        return Response(data)


class StaffHrRequestViewSet(CompanionModelViewSet):
    queryset = StaffHrRequest.objects.select_related('requester', 'decided_by')
    serializer_class = StaffHrRequestSerializer

    def get_queryset(self):
        organization = get_active_organization(self.request)
        qs = self.queryset.for_organization(organization)
        membership = get_active_membership(self.request)
        is_admin = bool(self.request.user.is_superuser or (membership and membership.is_organization_admin))

        if not is_admin:
            qs = qs.filter(requester=self.request.user)

        request_type = self.request.query_params.get('request_type')
        if request_type:
            qs = qs.filter(request_type=request_type)

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        return qs

    def perform_create(self, serializer):
        organization = get_active_organization(self.request)
        serializer.save(
            organization=organization,
            requester=self.request.user,
            status=StaffHrRequest.Status.PENDING,
        )

    @action(detail=True, methods=['post'], url_path='decide')
    def decide(self, request, pk=None):
        membership = get_active_membership(request)
        is_admin = bool(request.user.is_superuser or (membership and membership.is_organization_admin))
        if not is_admin:
            raise PermissionDenied('Only organization administrators can review and decide HR requests.')

        hr_req = self.get_object()
        decision = request.data.get('decision')
        notes = request.data.get('notes', '').strip()

        if decision not in ('approved', 'rejected', 'under_review'):
            raise ValidationError({'decision': 'Decision must be approved, rejected, or under_review.'})

        hr_req.status = decision
        hr_req.decided_by = request.user
        hr_req.decision_notes = notes
        hr_req.decided_at = timezone.now()
        hr_req.save()

        return Response(StaffHrRequestSerializer(hr_req).data)

