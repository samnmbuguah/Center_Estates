import logging
from datetime import timedelta

from django.db import transaction
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.utils import OpenApiTypes, extend_schema, extend_schema_view
from django.db.models import Count, F, Q, Sum
from django.utils import timezone
from rest_framework import serializers
from rest_framework import status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet, ViewSet

from core.models import Module
from core.permissions import HasModuleActionPermission, HasOrganizationContext
from rest_framework.permissions import AllowAny, IsAuthenticated
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
    PublicFeedbackQrCode,
    QmConversation,
    QmMessage,
    CompanionAnnouncement,
)
from .serializers import (
    StaffHrRequestSerializer,
    StaffLeaveBalanceSerializer,
    StaffLeaveRequestSerializer,
    TaskEventSerializer,
    TaskSerializer,
    TaskTemplateSerializer,
    TeamFeedbackThreadSerializer,
    PublicFeedbackQrCodeSerializer,
    QmConversationSerializer,
    CompanionAnnouncementSerializer,
)
from notifications.models import Notification
from notifications.services import notify_user, send_email_notification
from .qm_agent import QMAgentOrchestrator

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
    permission_map = {
        'acknowledge': 'companion.view',
        'start': 'companion.view',
        'complete': 'companion.view',
        'update_checklist': 'companion.view',
        'upload': 'companion.view',
    }

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
            due_str = f"Due: {task.due_at.strftime('%d %b %Y, %H:%M')}" if task.due_at else "No deadline"
            notify_user(
                organization=organization,
                recipient=assignee,
                title=f"📋 New Task Assigned: {task.title}",
                message=f"You have been assigned task {task.reference} ({task.priority.upper()}). {due_str}.\n\n{task.description or 'View task details in Companion.'}",
                action_url=f"/companion?tab=tasks&task={task.id}",
                category="task",
                level=Notification.Level.URGENT if task.priority == Task.Priority.URGENT else Notification.Level.INFO,
                send_email=True,
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
        if 'assignee' in serializer.validated_data:
            new_assignee = serializer.validated_data.get('assignee')
            if new_assignee and new_assignee != previous.assignee and new_assignee != self.request.user:
                TaskEvent.objects.create(
                    organization=organization, task=task, actor=self.request.user,
                    action=TaskEvent.Action.ASSIGNED, note=f'Reassigned to {new_assignee.username}.',
                )
                due_str = f"Due: {task.due_at.strftime('%d %b %Y, %H:%M')}" if task.due_at else "No deadline"
                notify_user(
                    organization=organization,
                    recipient=new_assignee,
                    title=f"📋 Task Reassigned: {task.title}",
                    message=f"Task {task.reference} has been reassigned to you ({task.priority.upper()}). {due_str}.\n\n{task.description or 'View task details in Companion.'}",
                    action_url=f"/companion?tab=tasks&task={task.id}",
                    category="task",
                    level=Notification.Level.URGENT if task.priority == Task.Priority.URGENT else Notification.Level.INFO,
                    send_email=True,
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


class QmConversationViewSet(CompanionModelViewSet):
    serializer_class = QmConversationSerializer
    queryset = QmConversation.objects.select_related('property', 'user').prefetch_related('messages')
    required_permission = 'companion.view'

    def get_queryset(self):
        queryset = super().get_queryset().filter(user=self.request.user)
        archived = self.request.query_params.get('is_archived')
        if archived is not None:
            queryset = queryset.filter(is_archived=archived.lower() in ('1', 'true', 'yes'))
        return queryset

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        serializer.save(organization=organization, user=self.request.user, property=get_active_property(self.request, organization))

    @action(detail=True, methods=('post',))
    def archive(self, request, pk=None):
        conversation = self.get_object()
        conversation.is_archived = True
        conversation.save(update_fields=('is_archived', 'updated_at'))
        return Response(self.get_serializer(conversation).data)


class CompanionAnnouncementViewSet(CompanionModelViewSet):
    """Manager-maintained messages that Companion can surface to staff."""

    queryset = CompanionAnnouncement.objects.select_related('created_by')
    serializer_class = CompanionAnnouncementSerializer
    search_fields = ('title', 'message')
    required_permission = 'companion.manage'

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        serializer.save(organization=organization, created_by=self.request.user)


@extend_schema_view(list=extend_schema(request=None, responses=OpenApiTypes.OBJECT))
class CompanionDashboardViewSet(ViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.COMPANION
    permission_map = {
        'chat': 'companion.view',
        'daily_briefing': 'companion.view',
        'execute_actions': 'companion.view',
    }

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
        active_tasks_list = list(active.order_by('-updated_at')[:30])
        recent_tasks = active_tasks_list[:10]
        overdue_tasks = sorted([t for t in active_tasks_list if t.due_at and t.due_at < now], key=lambda t: t.due_at)[:10]
        escalated_tasks = sorted([t for t in active_tasks_list if t.escalated], key=lambda t: t.escalated_at or t.updated_at, reverse=True)[:10]
        from .nudges import evaluate_employee_nudge
        active_nudge = evaluate_employee_nudge(request.user, organization, delivery='overview')
        return Response({
            'kpis': kpis,
            'activeNudge': active_nudge,
            'recentTasks': TaskSerializer(recent_tasks, many=True).data,
            'overdueTasks': TaskSerializer(overdue_tasks, many=True).data,
            'escalatedTasks': TaskSerializer(escalated_tasks, many=True).data,
        })

    @action(detail=False, methods=('get',))
    def nudge(self, request):
        organization = get_active_organization(request)
        from .nudges import evaluate_employee_nudge
        active_nudge = evaluate_employee_nudge(request.user, organization, delivery='popup')
        return Response(active_nudge or {})

    @action(detail=False, methods=('post',), throttle_classes=(QMChatRateThrottle,))
    def chat(self, request):
        organization = get_active_organization(request)
        raw_prompt = str(request.data.get('prompt', '')).strip() or 'Give me my operational briefing.'
        if len(raw_prompt) > 2000:
            raise ValidationError({'prompt': 'Keep your question under 2,000 characters.'})
        prompt = raw_prompt.lower()
        now = timezone.now()
        conversation_id = request.data.get('conversation_id')
        conversation = QmConversation.objects.filter(
            id=conversation_id, organization=organization, user=request.user, is_archived=False,
        ).first() if conversation_id else None
        if conversation is None:
            conversation = QmConversation.objects.create(
                organization=organization, user=request.user, property=get_active_property(request, organization),
                title=raw_prompt[:177] + ('…' if len(raw_prompt) > 177 else ''),
            )
        QmMessage.objects.create(
            organization=organization, conversation=conversation, role=QmMessage.Role.USER, content=raw_prompt,
        )


        # QM is grounded in live ERP records with full portfolio & temporal awareness.
        tasks = scope_model_queryset(Task, request, organization).select_related(
            'assignee', 'assigned_by', 'delegated_to', 'template',
        ).filter(assignee=request.user)
        active_tasks = tasks.exclude(status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED))
        overdue_count = active_tasks.filter(due_at__lt=now).count()
        escalated_count = active_tasks.filter(escalated=True).count()
        
        local_now = timezone.localtime(now)
        active_prop = get_active_property(request, organization)

        context = {
            'organization': organization.name,
            'current_date_time': {
                'formatted': local_now.strftime('%A, %d %B %Y, %I:%M %p %Z'),
                'date': local_now.strftime('%Y-%m-%d'),
                'day_of_week': local_now.strftime('%A'),
                'time': local_now.strftime('%H:%M:%S'),
                'timezone': str(timezone.get_current_timezone_name()),
            },
            'active_workspace_property_scope': active_prop.name if active_prop else 'Portfolio Wide (All Properties)',
            'my_tasks': {'active': active_tasks.count(), 'overdue': overdue_count, 'escalated': escalated_count},
        }
        recent_messages = list(conversation.messages.order_by('-created_at')[:9])
        if recent_messages:
            context['recent_conversation'] = [
                {'role': message.role, 'content': message.content[:600]}
                for message in reversed(recent_messages)
            ]
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
            from properties.models import Invoice, Lease, Property, Receipt, Unit, Tenant

            scoped_properties = scope_model_queryset(Property, request, organization)
            scoped_units = scope_model_queryset(Unit, request, organization)
            scoped_invoices = scope_model_queryset(Invoice, request, organization).exclude(status=Invoice.Status.VOID)
            scoped_leases = scope_model_queryset(Lease, request, organization)
            month_start = now.date().replace(day=1)
            scoped_receipts = scope_model_queryset(Receipt, request, organization).filter(received_on__gte=month_start)

            prop_list = []
            for p in scoped_properties.prefetch_related('units'):
                p_units = p.units.all()
                total_u = p_units.count()
                occ_u = p_units.filter(status=Unit.Status.OCCUPIED).count()
                prop_list.append({
                    'id': str(p.id),
                    'name': p.name,
                    'code': p.code,
                    'type': p.property_type,
                    'total_units': total_u,
                    'occupied_units': occ_u,
                    'vacant_units': total_u - occ_u,
                })

            # QM sees exactly what the user is scoped to — no cross-property leakage.
            context['properties'] = {
                'scope': active_prop.name if active_prop else 'Portfolio Wide',
                'properties_list': prop_list,
                'total_properties': scoped_properties.count(),
                'total_units': scoped_units.count(),
                'occupied_units': scoped_units.filter(status=Unit.Status.OCCUPIED).count(),
                'total_tenants': scope_model_queryset(Tenant, request, organization).count(),
                'active_leases': scoped_leases.filter(status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING)).count(),
                'outstanding_kes': str(scoped_invoices.aggregate(total=Sum('balance'))['total'] or 0),
                'collections_this_month_kes': str(scoped_receipts.aggregate(total=Sum('amount'))['total'] or 0),
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
        context_str = json.dumps(context, indent=2, default=str)

        # Diagnostic and knowledge-based explanation handlers for system assistance
        validation_explanation = ''
        if any(w in prompt for w in ('invalid building', 'building number', 'building #')):
            validation_explanation = (
                "**Building Number Guidance**\n\n"
                "- When adding units, the **Building #** field assigns a unit to a specific building (1, 2, 3... corresponding to the building index).\n"
                "- If your property is a single building or you do not wish to assign building numbers, you can simply leave the Building # field blank, or enter `1`.\n"
                "- The system now automatically recognizes values like `N/A`, `none`, or `-` as unassigned."
            )
        elif 'utilities must be a list' in prompt or 'utility records' in prompt:
            validation_explanation = (
                "**Utility Records & Meter Setup**\n\n"
                "- The system supports full multi-unit utility setups (up to 1,000 meters per property).\n"
                "- You can register individual water, electricity (prepaid or postpaid), and gas meters for each unit, or use the **Bulk Add Unit Meters** tool in the Utilities tab to auto-generate meters for all units in seconds."
            )
        elif 'no more than' in prompt and ('character' in prompt or 'characters' in prompt):
            validation_explanation = (
                "**Field Character Limit Guidance**\n\n"
                "- One of the submitted fields exceeded the allowed character limit (e.g. Country or code).\n"
                "- The country field now supports standard country names up to 60 characters with automatic ISO code normalization (e.g. `Kenya` → `KE`)."
            )
        elif any(w in prompt for w in ('how to', 'how do i', 'guide', 'workflow', 'onboarding')):
            validation_explanation = (
                "**Center Estates System Guidance**\n\n"
                "Here are key workflows available in your workspace:\n"
                "1. **Property Onboarding**: Register properties, buildings, sectional units, utility meters, and service lines.\n"
                "2. **Facilities & Service Lines**: Assign service providers and contract SLAs to service line slots created during onboarding.\n"
                "3. **Tenancy & Leases**: Allocate tenants to units, set up automated rent schedules, and generate monthly billing runs.\n"
                "4. **Finance & Banking**: Automatic statement narrative matching, manual receipting, and instant allocation to oldest invoices."
            )

        qm_result = {}
        llm_response = ''
        tools_executed = []
        suggested_actions = [
            {"label": "Portfolio Overview", "action": "overview", "href": "/overview"},
            {"label": "Properties Register", "action": "properties", "href": "/property"},
            {"label": "Facility Maintenance", "action": "facility", "href": "/facility?tab=overview"},
        ]

        # ── LangGraph Agent Invocation (primary path) ──────────────────────────
        # Build conversation history from the stored QmMessages for this session
        _conv_history = [
            {'role': msg.role, 'content': msg.content[:800]}
            for msg in conversation.messages.order_by('-created_at')[:8]
        ]
        _conv_history.reverse()  # chronological order

        allowed_modules = [m for m in Module.values if can_view(m)]

        _agent_state = {
            'organization_id': str(organization.id),
            'user_id': str(request.user.id),
            'user_name': request.user.get_full_name() or request.user.username,
            'user_role': 'admin' if (request.user.is_superuser or is_admin) else 'member',
            'mode': 'chat',
            'input_query': raw_prompt,
            'conversation_history': _conv_history,
            # Pass the user's active property scope and allowed modules so QM queries only authorized data
            'active_property_id': str(active_prop.id) if active_prop else None,
            'active_property_name': active_prop.name if active_prop else None,
            'allowed_modules': allowed_modules,
        }
        try:
            from companion.agent import agent_orchestrator
            _graph_result = agent_orchestrator.invoke(_agent_state)
            llm_response = _graph_result.get('final_response', '')
            tools_executed = _graph_result.get('tools_executed', [])
            qm_result = {'agent': 'Quartermaster (LangGraph)', 'status': 'grounded'}
        except Exception:
            logging.getLogger(__name__).warning("LangGraph agent invocation failed, falling back", exc_info=True)
            # Fallback: try legacy QMAgentOrchestrator
            try:
                qm_orchestrator = QMAgentOrchestrator(organization_name=organization.name)
                _legacy = qm_orchestrator.execute_agent(
                    prompt=raw_prompt,
                    user_name=request.user.first_name or request.user.username,
                    context_str=context_str,
                    organization=organization,
                    request=request,
                    allowed_modules=allowed_modules,
                )
                llm_response = _legacy.get('response', '')
                qm_result = _legacy
            except Exception:
                logging.getLogger(__name__).warning("QM legacy fallback also failed", exc_info=True)

        if llm_response:
            response_text = llm_response
        elif validation_explanation:
            response_text = validation_explanation
            suggested_actions = [
                {"label": "Properties Register", "action": "properties", "href": "/property"},
                {"label": "Facility Overview", "action": "facility", "href": "/facility?tab=overview"},
            ]
        # 1. Schedule, Calendar, Next Week & Tasks intent
        elif any(term in prompt for term in ('schedule', 'calendar', 'next week', 'this week', 'upcoming', 'due', 'agenda', 'my task', 'assigned task', 'timeline')):

            from datetime import timedelta
            next_week_end = now + timedelta(days=14)
            my_upcoming_tasks = list(
                Task.objects.filter(
                    assignee=request.user,
                ).exclude(status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED)).order_by('due_at')[:5]
            )
            from facilities.models import PreventiveSchedule, WorkOrder
            upcoming_ppm = list(
                PreventiveSchedule.objects.filter(
                    organization=organization, is_active=True,
                    next_due_on__gte=now.date(), next_due_on__lte=now.date() + timedelta(days=14),
                ).order_by('next_due_on')[:5]
            )
            urgent_wo = list(
                WorkOrder.objects.filter(
                    organization=organization,
                    priority__in=(WorkOrder.Priority.CRITICAL, WorkOrder.Priority.HIGH),
                ).exclude(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED)).order_by('resolution_due_at')[:5]
            )

            lines = [f"📅 **Upcoming Schedule & Operational Agenda — {organization.name}**\n"]
            if my_upcoming_tasks:
                lines.append(f"**Your Assigned Tasks ({len(my_upcoming_tasks)}):**")
                for t in my_upcoming_tasks:
                    due_str = t.due_at.strftime('%a, %d %b %H:%M') if t.due_at else 'No deadline'
                    lines.append(f"- **{t.title}** (Due: *{due_str}*, Priority: *{t.priority}*)")
            else:
                lines.append("• **Your Assigned Tasks**: No pending tasks currently assigned to you.")

            if upcoming_ppm:
                lines.append(f"\n**Facility Planned Maintenance (Next 14 Days):**")
                for p in upcoming_ppm:
                    lines.append(f"- **{p.title}** (Scheduled: *{p.next_due_on.strftime('%a, %d %b')}*, Asset: *{p.asset.name if p.asset else 'General'}*)")

            if urgent_wo:
                lines.append(f"\n**High Priority Work Orders:**")
                for w in urgent_wo:
                    lines.append(f"- **{w.title}** (*{w.property.name if w.property else 'General'}*, Priority: *{w.priority}*)")

            if not my_upcoming_tasks and not upcoming_ppm and not urgent_wo:
                lines.append("\n*You have a clear operational schedule for next week. No overdue tasks or critical maintenance items are currently pending.*")

            response_text = '\n'.join(lines)
            suggested_actions = [
                {"label": "View My Tasks", "action": "my_tasks", "href": "/companion?tab=my-tasks"},
                {"label": "PPM Maintenance Calendar", "action": "ppm", "href": "/facility?tab=planned-maintenance"},
                {"label": "Facility Overview", "action": "facility", "href": "/facility?tab=overview"},
            ]

        # 2. Properties & Portfolio intent
        elif any(term in prompt for term in ('propert', 'portfolio', 'estate', 'how many unit', 'building', 'units count', 'unit count', 'occupan')):
            from properties.models import Building, Lease, Property, Unit

            all_props = Property.objects.filter(organization=organization)
            prop_count = all_props.count()
            prop_names = list(all_props.values_list('name', flat=True)[:8])
            prop_names_str = ', '.join(f'**{name}**' for name in prop_names) if prop_names else 'None registered yet'
            if prop_count > 8:
                prop_names_str += f' *(and {prop_count - 8} more)*'
            
            all_units = Unit.objects.filter(organization=organization)
            total_units = all_units.count()
            occupied_units = all_units.filter(status=Unit.Status.OCCUPIED).count()
            available_units = all_units.filter(status=Unit.Status.AVAILABLE).count()
            occupancy_rate = f"{(occupied_units / total_units * 100):.1f}%" if total_units > 0 else "0%"
            
            buildings_count = Building.objects.filter(organization=organization).count()
            active_leases = Lease.objects.filter(organization=organization, status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING)).count()
            
            response_text = (
                f"📊 **Portfolio & Property Overview — {organization.name}**\n\n"
                f"- **Total Properties**: **{prop_count}** ({prop_names_str})\n"
                f"- **Total Units**: **{total_units}** registered across portfolio\n"
                f"- **Occupancy**: **{occupied_units} occupied** ({occupancy_rate}), **{available_units} available/vacant**\n"
                f"- **Buildings Registered**: **{buildings_count}**\n"
                f"- **Active Tenancies / Leases**: **{active_leases}**"
            )
            suggested_actions = [
                {"label": "View Properties Directory", "action": "properties", "href": "/property"},
                {"label": "+ Onboard New Property", "action": "onboard", "href": "/property/onboarding"},
                {"label": "View Units Directory", "action": "units", "href": "/property?tab=units"},
            ]


        # 2. Financials, Rent, Invoices, Receipts & Arrears
        elif any(term in prompt for term in ('rent', 'arrear', 'collection', 'invoice', 'receipt', 'balance', 'outstanding', 'financial', 'income', 'kes', 'payment', 'money')):
            from properties.models import Invoice, Receipt, Tenant
            month_start = now.date().replace(day=1)
            receipts = Receipt.objects.filter(organization=organization, received_on__gte=month_start)
            month_collections = receipts.aggregate(total=Sum('amount'))['total'] or 0
            
            invoices = Invoice.objects.filter(organization=organization).exclude(status=Invoice.Status.VOID)
            outstanding_balance = invoices.aggregate(total=Sum('balance'))['total'] or 0
            open_invoices_count = invoices.filter(status__in=(Invoice.Status.ISSUED, Invoice.Status.PARTIALLY_PAID)).count()
            
            response_text = (
                f"💰 **Financial & Collections Summary — {organization.name}**\n\n"
                f"- **Collections This Month**: **KES {month_collections:,.2f}**\n"
                f"- **Outstanding Invoice Balance**: **KES {outstanding_balance:,.2f}**\n"
                f"- **Open / Pending Invoices**: **{open_invoices_count}** invoices awaiting payment\n"
                f"- **Payment Methods**: Direct M-Pesa automated match, Bank Statement reconciliation, and Manual Receipting with statement preview."
            )
            suggested_actions = [
                {"label": "View Rent & Collections", "action": "collections", "href": "/property?tab=rent"},
                {"label": "Rent Arrears Aging", "action": "arrears", "href": "/property?tab=arrears"},
                {"label": "Manual Receipting", "action": "receipts", "href": "/property?tab=receipts"},
            ]

        # 3. Tenants & Leases
        elif any(term in prompt for term in ('tenant', 'lease', 'tenanc', 'occupan', 'agreement')):
            from properties.models import Lease, Tenant, Unit
            all_tenants = Tenant.objects.filter(organization=organization)
            tenants_count = all_tenants.count()
            active_leases = Lease.objects.filter(organization=organization, status=Lease.Status.ACTIVE).count()
            expiring_leases = Lease.objects.filter(organization=organization, status=Lease.Status.EXPIRING).count()
            
            response_text = (
                f"👥 **Tenants & Leasing Status — {organization.name}**\n\n"
                f"- **Total Registered Tenants**: **{tenants_count}**\n"
                f"- **Active Leases**: **{active_leases}**\n"
                f"- **Expiring Leases (Next 60 Days)**: **{expiring_leases}**\n"
                f"- **Automated Workflows**: Monthly rent invoicing, rent escalation tracking, automated SMS/Email reminders, and move-in/move-out inspections."
            )
            suggested_actions = [
                {"label": "View Tenants Directory", "action": "tenants", "href": "/property?tab=tenants"},
                {"label": "Lease Agreements", "action": "leases", "href": "/property?tab=leases"},
            ]

        # 4. Facilities, Maintenance, Work Orders, PPM & Contractors
        elif any(term in prompt for term in ('facilit', 'work order', 'maintenance', 'contractor', 'service line', 'repair', 'ppm', 'meter', 'utilit', 'hvac', 'plumb', 'electric')):
            from facilities.models import Contractor, PreventiveSchedule, UtilityMeter, WorkOrder
            orders = WorkOrder.objects.filter(organization=organization).exclude(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED))
            open_wo = orders.count()
            critical_wo = orders.filter(priority=WorkOrder.Priority.CRITICAL).count()
            overdue_wo = orders.filter(resolution_due_at__lt=now).count()
            active_ppm = PreventiveSchedule.objects.filter(organization=organization, is_active=True).count()
            contractors_count = Contractor.objects.filter(organization=organization).count()
            meters_count = UtilityMeter.objects.filter(organization=organization).count()
            
            response_text = (
                f"🛠️ **Facilities & Operations Summary — {organization.name}**\n\n"
                f"- **Open Work Orders**: **{open_wo}** (**{critical_wo} critical**, **{overdue_wo} overdue**)\n"
                f"- **Active PPM Schedules**: **{active_ppm}** preventive maintenance routines\n"
                f"- **Registered Service Providers / Contractors**: **{contractors_count}**\n"
                f"- **Utility Meters (Water / Power / Gas)**: **{meters_count}** metered accounts registered"
            )
            suggested_actions = [
                {"label": "Facility Overview", "action": "facility", "href": "/facility?tab=overview"},
                {"label": "Work Orders", "action": "wo", "href": "/facility?tab=work-orders"},
                {"label": "Service Providers", "action": "contractors", "href": "/facility?tab=contractors"},
            ]

        # 5. Construction & Monitoring
        elif any(term in prompt for term in ('construction', 'project', 'site', 'ticket', 'ipc')):
            response_text = (
                f"🏗️ **Construction & Project Monitoring**\n\n"
                f"- Track project milestones, Interim Payment Certificates (IPCs), site logs, quality inspections, and contractor defects."
            )
            suggested_actions = [
                {"label": "Projects Directory", "action": "projects", "href": "/monitoring/projects"},
                {"label": "Site Issues & Tickets", "action": "tickets", "href": "/monitoring?tab=tickets"},
            ]

        # 6. Operational Briefings / Start of Day
        elif any(term in prompt for term in ('brief', 'priorit', 'start of day', 'today')):
            from properties.models import Property, Receipt, Unit
            all_props = Property.objects.filter(organization=organization).count()
            all_units = Unit.objects.filter(organization=organization)
            occupied = all_units.filter(status=Unit.Status.OCCUPIED).count()
            total_u = all_units.count()
            month_start = now.date().replace(day=1)
            collections = Receipt.objects.filter(organization=organization, received_on__gte=month_start).aggregate(total=Sum('amount'))['total'] or 0
            
            parts = [
                f"📋 **Your Operational Briefing — {organization.name}**",
                f"- **Assigned Tasks**: **{context['my_tasks']['active']} active**; overdue: **{overdue_count}**; escalated: **{escalated_count}**",
                f"- **Portfolio**: **{occupied} of {total_u} units occupied** across **{all_props} properties**",
                f"- **Collections (This Month)**: **KES {collections:,.2f}**",
            ]
            response_text = '\n'.join(parts)
            suggested_actions = [
                {"label": "View My Tasks", "action": "my_tasks", "href": "/companion?tab=my-tasks"},
                {"label": "Review Collections", "action": "collections", "href": "/property?tab=rent"},
                {"label": "Facility Overview", "action": "facility", "href": "/facility?tab=overview"},
            ]

        # 7. General Assistant Comprehensive Status
        else:
            from properties.models import Property, Receipt, Unit
            all_props = Property.objects.filter(organization=organization).count()
            all_units = Unit.objects.filter(organization=organization)
            occupied = all_units.filter(status=Unit.Status.OCCUPIED).count()
            total_u = all_units.count()
            month_start = now.date().replace(day=1)
            collections = Receipt.objects.filter(organization=organization, received_on__gte=month_start).aggregate(total=Sum('amount'))['total'] or 0
            
            response_text = (
                f"🤖 **Quartermaster AI — {organization.name}**\n\n"
                f"- **Properties**: **{all_props}** registered\n"
                f"- **Units**: **{occupied} occupied** / **{total_u} total**\n"
                f"- **Month Collections**: **KES {collections:,.2f}**\n"
                f"- **Your Active Tasks**: **{active_tasks.count()}**\n\n"
                f"*You can ask me anything about properties, units, rent arrears, tenant leases, utility meters, work orders, or operational workflows.*"
            )
            suggested_actions = [
                {"label": "View Properties", "action": "properties", "href": "/property"},
                {"label": "Rent & Arrears", "action": "arrears", "href": "/property?tab=arrears"},
                {"label": "Facilities & Work Orders", "action": "facility", "href": "/facility?tab=overview"},
            ]


        payload = {
            'prompt': request.data.get('prompt', ''),
            'response': response_text,
            'suggestedActions': suggested_actions,
            'agent': qm_result.get('agent', 'Quartermaster (QM)'),
            'agentStatus': qm_result.get('status', 'grounded'),
            'groundedAt': now.isoformat(),
            'timestamp': now.isoformat(),
            'conversationId': str(conversation.id),
            'toolsExecuted': tools_executed,
        }
        QmMessage.objects.create(
            organization=organization, conversation=conversation, role=QmMessage.Role.ASSISTANT,
            content=response_text, response_metadata={
                'suggestedActions': suggested_actions,
                'agent': payload['agent'],
                'agentStatus': payload['agentStatus'],
                'groundedAt': payload['groundedAt'],
                'toolsExecuted': tools_executed,
            },
        )
        conversation.save(update_fields=('updated_at',))
        return Response(payload)

    @action(detail=False, methods=('get', 'post'), url_path='daily-briefing')
    def daily_briefing(self, request):
        organization = get_active_organization(request)
        user_name = request.user.get_full_name() or request.user.username or "Operator"
        from datetime import timedelta
        from facilities.models import FacilityIncident, PreventiveSchedule, WorkOrder
        from properties.models import Invoice, Lease

        now = timezone.now()
        today = timezone.localdate()
        active_work = scope_model_queryset(
            WorkOrder, request, organization,
        ).exclude(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED))
        overdue_work = active_work.filter(resolution_due_at__lt=now)
        critical_work = active_work.filter(priority=WorkOrder.Priority.CRITICAL)
        unassigned_work = active_work.filter(assigned_to__isnull=True, contractor__isnull=True)
        active_incidents = scope_model_queryset(
            FacilityIncident, request, organization,
        ).exclude(status__in=(FacilityIncident.Status.RESOLVED, FacilityIncident.Status.CLOSED))
        critical_incidents = active_incidents.filter(severity__in=(FacilityIncident.Severity.HIGH, FacilityIncident.Severity.CRITICAL))
        overdue_ppm = scope_model_queryset(
            PreventiveSchedule, request, organization,
        ).filter(is_active=True, next_due_on__lt=today)
        overdue_invoices = scope_model_queryset(
            Invoice, request, organization,
        ).filter(status__in=('issued', 'partial', 'overdue'), due_on__lt=today)
        total_arrears = overdue_invoices.aggregate(total=Sum('balance'))['total'] or 0
        expiring_leases = scope_model_queryset(
            Lease, request, organization,
        ).filter(status='active', ends_on__range=(today, today + timedelta(days=60)))
        due_tasks = scope_model_queryset(Task, request, organization).filter(
            assignee=request.user,
        ).exclude(status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED)).filter(due_at__date__lte=today)

        penalty = min(35, overdue_work.count() * 5 + critical_work.count() * 8)
        penalty += min(25, critical_incidents.count() * 8 + overdue_ppm.count() * 3)
        penalty += min(20, overdue_invoices.count() * 2)
        health_score = max(0, 100 - penalty)
        health_status = 'Optimal' if health_score >= 85 else 'Action required' if health_score >= 65 else 'Critical attention needed'
        alerts = []
        if critical_incidents.exists(): alerts.append(f'{critical_incidents.count()} high or critical incident(s) require manager review.')
        if overdue_work.exists(): alerts.append(f'{overdue_work.count()} work order(s) are past their resolution SLA.')
        if overdue_ppm.exists(): alerts.append(f'{overdue_ppm.count()} preventive-maintenance task(s) are overdue.')
        if overdue_invoices.exists(): alerts.append(f'{overdue_invoices.count()} invoice(s) are overdue with KES {total_arrears:,.0f} outstanding.')
        if unassigned_work.exists(): alerts.append(f'{unassigned_work.count()} active work order(s) still need an assignee or provider.')
        if due_tasks.exists(): alerts.append(f'{due_tasks.count()} personal task(s) are due or overdue.')
        if not alerts: alerts.append('No overdue operational exceptions were found in the records you can access.')

        deterministic = {
            'date': now.strftime('%A, %d %B %Y'),
            'headline': f'{health_status} — {len(alerts)} briefing item(s)',
            'portfolio_health_score': health_score,
            'health_status': health_status,
            'key_metrics': {
                'total_arrears': total_arrears,
                'overdue_invoices': overdue_invoices.count(),
                'urgent_work_orders': critical_work.count(),
                'open_work_orders': active_work.count(),
                'overdue_work_orders': overdue_work.count(),
                'overdue_ppm': overdue_ppm.count(),
                'open_incidents': active_incidents.count(),
                'critical_incidents': critical_incidents.count(),
                'unassigned_work_orders': unassigned_work.count(),
                'expiring_leases_60d': expiring_leases.count(),
                'tasks_due': due_tasks.count(),
            },
            'critical_alerts': alerts,
            'briefing_narrative': f'Good day, {user_name}. This briefing is calculated from live records within your organization and property access.',
            'recommended_focus': alerts[:3],
            'proposed_actions': [],
            'grounded_at': now.isoformat(),
        }
        if request.method == 'GET' or not request.data.get('include_ai'):
            return Response(deterministic)
        initial_state = {
            'organization_id': str(organization.id),
            'user_name': user_name,
            'user_role': 'Super Administrator' if request.user.is_superuser else 'Estate Manager',
            'mode': 'briefing',
            'input_query': 'Generate Executive Daily Briefing',
            'conversation_history': [],
        }
        try:
            # Import the LangGraph stack only when an AI briefing is requested.
            # Loading it at URL-registration time made every API worker pay the
            # considerable AI dependency startup cost, including health/auth.
            from .agent import agent_orchestrator
            result = agent_orchestrator.invoke(initial_state)
            briefing = result.get('daily_briefing', {})
            briefing['health_score'] = result.get('health_score', health_score)
            briefing['proposed_actions'] = result.get('proposed_actions', [])
            briefing['grounded_at'] = now.isoformat()
            return Response(briefing)
        except Exception:
            return Response(deterministic)

    @action(detail=False, methods=('post',), url_path='execute-actions')
    def execute_actions(self, request):
        organization = get_active_organization(request)
        action_ids = request.data.get('action_ids', [])
        if not action_ids:
            raise ValidationError({'action_ids': 'Specify one or more action IDs to execute.'})
        
        user_name = request.user.get_full_name() or request.user.username or "Operator"
        state = {
            'organization_id': str(organization.id),
            'user_name': user_name,
            'mode': 'action_execution',
            'approved_action_ids': action_ids,
            'proposed_actions': request.data.get('proposed_actions', []),
            'conversation_history': [],
        }
        from .agent import agent_orchestrator
        result = agent_orchestrator.invoke(state)
        return Response({
            'status': 'success',
            'executed_count': len(result.get('execution_results', [])),
            'results': result.get('execution_results', []),
        })

    @action(detail=False, methods=('get',), url_path='nudges')
    def nudges(self, request):
        """Scan for proactive arrears and lease escalation opportunities with ready-to-dispatch drafts."""
        organization = get_active_organization(request)
        today = timezone.localdate()
        from datetime import timedelta
        from decimal import Decimal
        from properties.models import Invoice, Lease

        # 1. Arrears Nudges (> 7 days overdue)
        overdue_invoices = scope_model_queryset(Invoice, request, organization).filter(
            status__in=(Invoice.Status.ISSUED, Invoice.Status.PARTIAL, Invoice.Status.OVERDUE),
            due_on__lt=today - timedelta(days=7),
            balance__gt=0,
        ).select_related('lease__tenant', 'lease__unit', 'lease__unit__property')

        tenant_arrears = {}
        for inv in overdue_invoices:
            if not inv.lease_id or not inv.lease.tenant:
                continue
            t_id = str(inv.lease.tenant.id)
            if t_id not in tenant_arrears:
                unit_label = (inv.lease.unit.code if hasattr(inv.lease, 'unit') and inv.lease.unit else '—')
                prop_name = (inv.lease.unit.property.name if hasattr(inv.lease, 'unit') and inv.lease.unit and inv.lease.unit.property else 'Property')
                tenant_arrears[t_id] = {
                    'tenant_id': t_id,
                    'tenant_name': inv.lease.tenant.name,
                    'tenant_phone': inv.lease.tenant.phone,
                    'tenant_email': inv.lease.tenant.email,
                    'unit_code': unit_label,
                    'property_name': prop_name,
                    'oldest_due_on': str(inv.due_on),
                    'days_overdue': (today - inv.due_on).days,
                    'total_balance': Decimal('0.00'),
                    'invoices': [],
                }

            tenant_arrears[t_id]['total_balance'] += inv.balance
            tenant_arrears[t_id]['invoices'].append({'id': str(inv.id), 'number': inv.number, 'balance': str(inv.balance)})
            days = (today - inv.due_on).days
            if days > tenant_arrears[t_id]['days_overdue']:
                tenant_arrears[t_id]['days_overdue'] = days
                tenant_arrears[t_id]['oldest_due_on'] = str(inv.due_on)

        arrears_nudges = []
        for t in tenant_arrears.values():
            arrears_nudges.append({
                'id': f"nudge-arrears-{t['tenant_id']}",
                'type': 'arrears',
                'severity': 'high' if t['days_overdue'] > 30 else 'medium',
                'tenant_id': t['tenant_id'],
                'tenant_name': t['tenant_name'],
                'unit_code': t['unit_code'],
                'property_name': t['property_name'],
                'days_overdue': t['days_overdue'],
                'total_balance': str(t['total_balance']),
                'whatsapp_draft': f"Dear {t['tenant_name']}, this is a reminder from {organization.name} regarding your overdue balance of KES {t['total_balance']:,.2f} for Unit {t['unit_code']} ({t['property_name']}). Please settle your balance or contact property management. Thank you.",
                'sms_draft': f"Dear {t['tenant_name']}, your rent balance for Unit {t['unit_code']} is KES {t['total_balance']:,.2f} ({t['days_overdue']} days overdue). Kindly pay via M-Pesa / Bank. - {organization.name}",
                'email_draft': {
                    'subject': f"Overdue Payment Notice — Unit {t['unit_code']} ({organization.name})",
                    'body': f"Dear {t['tenant_name']},\n\nOur records show an outstanding balance of KES {t['total_balance']:,.2f} for Unit {t['unit_code']} at {t['property_name']}, with the oldest invoice due since {t['oldest_due_on']} ({t['days_overdue']} days overdue).\n\nPlease arrange for payment as soon as possible.\n\nBest regards,\nProperty Management Team\n{organization.name}",
                }
            })

        # 2. Escalation Nudges (Upcoming within 30 days)
        active_leases = scope_model_queryset(Lease, request, organization).filter(
            status=Lease.Status.ACTIVE,
            escalation_percent__gt=0,
        ).select_related('tenant', 'unit__property')

        escalation_nudges = []
        for lease in active_leases:
            if not lease.tenant or not lease.starts_on:
                continue
            interval_months = lease.escalation_interval_months or 12
            # Check 1-year / interval anniversary
            anniversary = lease.starts_on + timedelta(days=int(interval_months * 30.4375))
            days_to_escalation = (anniversary - today).days
            if 0 <= days_to_escalation <= 45:
                esc_pct = lease.escalation_percent
                old_rent = lease.monthly_rent
                new_rent = (old_rent * (Decimal('1') + (esc_pct / Decimal('100')))).quantize(Decimal('0.01'))
                unit_label = lease.unit.code if lease.unit else '—'
                prop_name = lease.unit.property.name if lease.unit and lease.unit.property else 'Property'

                escalation_nudges.append({
                    'id': f"nudge-escalation-{lease.id}",
                    'type': 'escalation',
                    'lease_id': str(lease.id),
                    'tenant_id': str(lease.tenant.id),
                    'tenant_name': lease.tenant.name,
                    'unit_code': unit_label,
                    'property_name': prop_name,
                    'effective_date': anniversary.isoformat(),
                    'days_until': days_to_escalation,
                    'escalation_percent': str(esc_pct),
                    'old_rent': str(old_rent),
                    'new_rent': str(new_rent),
                    'notice_draft': f"Dear {lease.tenant.name}, notice of annual rent escalation for Unit {unit_label} at {prop_name}: effective {anniversary.strftime('%d %B %Y')}, your monthly contract rent will adjust from KES {old_rent:,.2f} to KES {new_rent:,.2f} (+{esc_pct}%). Thank you for your continued tenancy with {organization.name}.",
                })

        return Response({
            'arrears_count': len(arrears_nudges),
            'escalation_count': len(escalation_nudges),
            'total_nudges': len(arrears_nudges) + len(escalation_nudges),
            'arrears_nudges': arrears_nudges,
            'escalation_nudges': escalation_nudges,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=('post',), url_path='nudges/dispatch')
    def dispatch_nudge(self, request):
        """Dispatch an individual arrears reminder or escalation notice via the configured channel."""
        organization = get_active_organization(request)
        nudge_type = request.data.get('type')
        channel = request.data.get('channel', 'in_app')
        tenant_id = request.data.get('tenant_id')
        message = request.data.get('message', '').strip()

        if not tenant_id or not message:
            raise ValidationError({'detail': 'Specify tenant_id and message.'})

        from properties.models import Tenant
        tenant = Tenant.objects.filter(pk=tenant_id, organization=organization).first()
        if not tenant:
            raise ValidationError({'tenant_id': 'Tenant was not found.'})

        # Create audit notification record
        Notification.objects.create(
            organization=organization,
            recipient=request.user,
            title=f"Dispatched {nudge_type.title()} Nudge: {tenant.name}",
            message=f"Dispatched via {channel.upper()}: {message[:120]}...",
            level=Notification.Level.INFO,
            action_url='/property?tab=arrears' if nudge_type == 'arrears' else '/property?tab=leases',
            metadata={'tenant_id': str(tenant.id), 'channel': channel, 'nudge_type': nudge_type},
        )

        return Response({
            'success': True,
            'message': f"Successfully dispatched {nudge_type} notification to {tenant.name} via {channel}.",
        }, status=status.HTTP_200_OK)



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

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        organization = get_active_organization(request)
        try:
            window_days = int(request.query_params.get('days', '30'))
        except (TypeError, ValueError):
            raise ValidationError({'days': 'Enter a whole number of days.'})
        if window_days < 1 or window_days > 365:
            raise ValidationError({'days': 'Choose a reporting window between 1 and 365 days.'})
        generated_at = timezone.now()
        period_start = generated_at - timedelta(days=window_days)
        module_param = request.query_params.get('module', '').strip()
        path_param = request.query_params.get('path', '').strip()
        user_param = request.query_params.get('user', '').strip() or request.query_params.get('actor', '').strip()

        from organizations.models import Membership
        from audit.models import AuditEvent

        queryset = TaskEvent.objects.filter(
            organization=organization,
            note__startswith='Telemetry [',
            created_at__gte=period_start,
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
            note__startswith='Telemetry [',
            created_at__gte=period_start,
        ).select_related('actor')

        all_audits = AuditEvent.objects.filter(
            organization=organization,
            created_at__gte=period_start,
        ).select_related('actor')

        page_counts = {
            'property': 0,
            'facility': 0,
            'sales': 0,
            'tender': 0,
            'valuation': 0,
            'monitoring': 0,
            'companion': 0,
        }
        user_stats = {}
        hourly_counts = [0] * 24

        members = Membership.objects.filter(
            organization=organization,
            status=Membership.Status.ACTIVE,
            user__is_active=True,
        ).select_related('user').prefetch_related('roles')

        membership_counts = Membership.objects.filter(organization=organization).aggregate(
            active=Count('id', filter=Q(status=Membership.Status.ACTIVE, user__is_active=True)),
            inactive=Count('id', filter=~Q(status=Membership.Status.ACTIVE) | Q(user__is_active=False)),
        )

        for m in members:
            u_name = m.user.username
            role_name = m.roles.first().name if m.roles.exists() else ("Administrator" if m.is_organization_admin else "Staff")
            full_name = f"{m.user.first_name} {m.user.last_name}".strip() or u_name
            user_stats[u_name] = {
                'user_id': str(m.user.id),
                'username': u_name,
                'full_name': full_name,
                'email': m.user.email or '',
                'role': role_name,
                'is_admin': bool(m.user.is_superuser or m.is_organization_admin),
                'events': 0,
                'modules': set(),
                'last_seen': None,
                'tier': 'inactive',
            }

        # Do not cap these querysets: the analytics page must report the complete
        # selected period. iterator() keeps memory bounded for larger estates.
        for ev in all_telemetry.iterator(chunk_size=2000):
            note = ev.note
            mod = "companion"
            if "(Module: " in note:
                mod = note.split("(Module: ")[-1].split(")")[0].strip().lower()
            if mod in page_counts:
                page_counts[mod] += 1
            else:
                page_counts[mod] = page_counts.get(mod, 0) + 1

            if ev.created_at:
                hourly_counts[ev.created_at.hour] += 1

            actor_name = ev.actor.username if ev.actor else None
            # Adoption is intentionally scoped to current active staff. Former,
            # disabled, tenant, and landlord portal users must not alter it.
            if actor_name and actor_name in user_stats:
                stats = user_stats[actor_name]
                stats['events'] += 1
                if mod:
                    stats['modules'].add(mod)
                if stats['last_seen'] is None or ev.created_at > stats['last_seen']:
                    stats['last_seen'] = ev.created_at

        for audit in all_audits.iterator(chunk_size=2000):
            mod_guess = "property" if "property" in audit.entity_type.lower() or "tenant" in audit.entity_type.lower() or "lease" in audit.entity_type.lower() else (
                "facility" if "facility" in audit.entity_type.lower() or "work_order" in audit.entity_type.lower() or "asset" in audit.entity_type.lower() or "contractor" in audit.entity_type.lower() else (
                    "valuation" if "valuation" in audit.entity_type.lower() else (
                        "monitoring" if "project" in audit.entity_type.lower() or "ticket" in audit.entity_type.lower() else "companion"
                    )
                )
            )
            page_counts[mod_guess] = page_counts.get(mod_guess, 0) + 1
            if audit.created_at:
                hourly_counts[audit.created_at.hour] += 1
            if audit.actor:
                u_name = audit.actor.username
                if u_name in user_stats:
                    user_stats[u_name]['events'] += 1
                    user_stats[u_name]['modules'].add(mod_guess)
                    if user_stats[u_name]['last_seen'] is None or audit.created_at > user_stats[u_name]['last_seen']:
                        user_stats[u_name]['last_seen'] = audit.created_at

        now = timezone.now()
        for name, stats in user_stats.items():
            ev_count = stats['events']
            if ev_count >= 20:
                stats['tier'] = 'power'
            elif ev_count >= 5:
                stats['tier'] = 'active'
            elif ev_count >= 1:
                stats['tier'] = 'casual'
            else:
                stats['tier'] = 'inactive'

        by_user = {}
        for name, stats in user_stats.items():
            by_user[name] = {
                'user_id': stats['user_id'],
                'username': stats['username'],
                'full_name': stats['full_name'],
                'email': stats['email'],
                'role': stats['role'],
                'is_admin': stats['is_admin'],
                'events': stats['events'],
                'modules': sorted(stats['modules']),
                'last_seen': stats['last_seen'].isoformat() if stats['last_seen'] else None,
                'tier': stats['tier'],
            }

        total_users = len(user_stats)
        total_events = sum(page_counts.values())
        staff_events = sum(s['events'] for s in user_stats.values())
        active_users_count = sum(1 for s in user_stats.values() if s['tier'] in ('power', 'active', 'casual'))
        adoption_rate = round((active_users_count / total_users * 100), 1) if total_users else 0.0

        insights = []
        if adoption_rate >= 70:
            insights.append({
                'type': 'success',
                'title': 'High Organization Adoption',
                'description': f'{adoption_rate}% of registered staff ({active_users_count}/{total_users}) are actively utilizing Center Estates ERP workflows.',
            })
        else:
            insights.append({
                'type': 'warning',
                'title': 'Onboarding & Training Opportunity',
                'description': f'{total_users - active_users_count} registered staff accounts are currently dormant or have low activity. Consider scheduling module onboarding.',
            })

        sorted_modules = sorted(page_counts.items(), key=lambda x: x[1], reverse=True)
        if sorted_modules and sorted_modules[0][1] > 0:
            top_mod_name = sorted_modules[0][0].capitalize()
            insights.append({
                'type': 'info',
                'title': f'{top_mod_name} is Primary Driver',
                'description': f'{top_mod_name} represents the largest volume of operational transactions ({sorted_modules[0][1]} actions recorded).',
            })

        dormant_users = [s['full_name'] for s in user_stats.values() if s['tier'] == 'inactive']
        if dormant_users:
            insights.append({
                'type': 'neutral',
                'title': 'Dormant Staff Accounts',
                'description': f"{len(dormant_users)} staff accounts ({', '.join(dormant_users[:3])}{'...' if len(dormant_users) > 3 else ''}) have 0 recorded actions.",
            })

        return Response({
            'summary': {
                'total_events': total_events,
                'staff_events': staff_events,
                'non_staff_or_system_events': max(0, total_events - staff_events),
                'total_members': total_users,
                'active_members': active_users_count,
                'adoption_rate': adoption_rate,
                'top_module': sorted_modules[0][0] if sorted_modules and sorted_modules[0][1] > 0 else 'facility',
                'window_days': window_days,
                'period_start': period_start.isoformat(),
                'generated_at': generated_at.isoformat(),
                'inactive_or_pending_members': membership_counts['inactive'] or 0,
                'scope_label': 'Active organization staff accounts',
                'activity_sources': ['UI telemetry', 'server audit events'],
            },
            'by_module': page_counts,
            'by_user': by_user,
            'hourly_distribution': hourly_counts,
            'insights': insights,
            'events': [
                {
                    'id': str(e.id),
                    'actor': e.actor.username if e.actor else 'anonymous',
                    'note': e.note,
                    'created_at': e.created_at.isoformat(),
                }
                for e in events
            ]
        }, headers={
            'Cache-Control': 'private, no-store, max-age=0',
            'Pragma': 'no-cache',
        })

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def create(self, request):
        try:
            organization = get_active_organization(request, required=False)
            if not organization:
                return Response({'status': 'ok', 'accepted': 0, 'detail': 'No active organization'}, status=status.HTTP_200_OK)
            raw_events = request.data.get('events') if isinstance(request.data, dict) else request.data
            events = raw_events if isinstance(raw_events, list) else [request.data]
            if not events:
                return Response({'status': 'ok', 'accepted': 0}, status=status.HTTP_200_OK)
            if len(events) > 100:
                raise ValidationError({'events': 'Submit no more than 100 telemetry events per batch.'})
            client_ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR') or ''
            records = []
            for payload in events[:100]:
                if not isinstance(payload, dict):
                    continue
                event = str(payload.get('event', 'user_action'))[:60]
                properties = payload.get('properties', {})
                if not isinstance(properties, dict):
                    properties = {}
                module = str(payload.get('module', 'dashboard'))[:40]
                detail = str(properties.get('element', properties.get('path', '')))[:260]
                ip_tag = f" [IP: {client_ip}]" if client_ip else ""
                records.append(TaskEvent(
                    organization=organization,
                    task=None,
                    actor=request.user if request.user.is_authenticated else None,
                    action=TaskEvent.Action.UPDATED,
                    note=f"Telemetry [{event}]{ip_tag}: {detail} (Module: {module})",
                ))
            if records:
                TaskEvent.objects.bulk_create(records)
            return Response({'status': 'ok', 'accepted': len(records)}, status=status.HTTP_201_CREATED)
        except ValidationError:
            raise
        except Exception:
            return Response({'status': 'ok', 'accepted': 0}, status=status.HTTP_200_OK)


class TeamFeedbackThreadViewSet(CompanionModelViewSet):
    permission_classes = (HasOrganizationContext, IsAuthenticated)
    queryset = TeamFeedbackThread.objects.all()
    serializer_class = TeamFeedbackThreadSerializer
    search_fields = ('title', 'reference', 'module')

    def get_queryset(self):
        queryset = super().get_queryset()
        organization = get_active_organization(self.request)
        membership = get_active_membership(self.request, organization)
        is_dev_admin = bool(
            getattr(self.request.user, 'is_superuser', False)
            or (membership and membership.is_organization_admin)
            or (membership and membership.roles.filter(slug__in=['engineering', 'developer', 'platform-admin']).exists())
        )
        # Bug reports assigned to the developer/engineering team are private engineering telemetry
        if not is_dev_admin:
            queryset = queryset.exclude(
                Q(category=TeamFeedbackThread.FeedbackType.BUG)
                & ~Q(created_by=self.request.user)
                & ~Q(assigned_to=self.request.user)
            )
        return queryset

    STATUS_TRANSITIONS = {
        'open': ('open', 'in_progress', 'resolved', 'closed'),
        'in_progress': ('open', 'in_progress', 'resolved', 'closed'),
        'resolved': ('open', 'in_progress', 'resolved', 'closed'),
        'closed': ('open', 'in_progress', 'resolved', 'closed'),
    }

    @action(detail=True, methods=['post'], url_path='create-work-order')
    @transaction.atomic
    def create_work_order(self, request, pk=None):
        """Promote an operational ticket into the audited Facility work-order lifecycle."""
        import uuid
        from facilities.models import WorkOrder, WorkOrderEvent

        thread = self.get_object()
        organization = get_active_organization(request)
        membership = get_active_membership(request, organization)
        can_dispatch = bool(
            request.user.is_superuser
            or (membership and membership.is_organization_admin)
            or (membership and membership.has_permission('facility.work'))
        )
        if not can_dispatch:
            raise PermissionDenied('Your role does not grant permission to dispatch facility work.')
        if not thread.property_id:
            raise ValidationError({'property': 'Assign the ticket to a property before creating a work order.'})

        existing_id = str((thread.metadata or {}).get('work_order_id') or '')
        if existing_id:
            existing = WorkOrder.objects.filter(organization=organization, pk=existing_id).first()
            if existing:
                return Response({'work_order_id': str(existing.id), 'number': existing.number, 'created': False})

        number = f'WO-{timezone.localdate():%Y}-{uuid.uuid4().hex[:6].upper()}'
        while WorkOrder.objects.filter(organization=organization, number=number).exists():
            number = f'WO-{timezone.localdate():%Y}-{uuid.uuid4().hex[:6].upper()}'
        first_message = thread.messages.order_by('created_at').values_list('message', flat=True).first() or ''
        priority = {
            TeamFeedbackThread.Priority.URGENT: WorkOrder.Priority.CRITICAL,
            TeamFeedbackThread.Priority.HIGH: WorkOrder.Priority.HIGH,
            TeamFeedbackThread.Priority.NORMAL: WorkOrder.Priority.MEDIUM,
            TeamFeedbackThread.Priority.LOW: WorkOrder.Priority.LOW,
        }[thread.priority]
        work_order = WorkOrder.objects.create(
            organization=organization, number=number, title=thread.title,
            description=first_message, category=thread.issue_category or 'General',
            source='helpdesk_ticket', property=thread.property, assigned_to=thread.assigned_to,
            reported_by=request.user, priority=priority, status=WorkOrder.Status.OPEN,
            reported_at=thread.created_at, response_due_at=thread.sla_due_at,
            resolution_due_at=thread.sla_due_at,
        )
        WorkOrderEvent.objects.create(
            organization=organization, work_order=work_order, event_type='ticket_conversion',
            to_status=work_order.status, notes=f'Created from helpdesk ticket {thread.ticket_no}', actor=request.user,
        )
        thread.metadata = {**(thread.metadata or {}), 'work_order_id': str(work_order.id), 'work_order_number': work_order.number}
        if thread.status == TeamFeedbackThread.Status.OPEN:
            thread.status = TeamFeedbackThread.Status.IN_PROGRESS
        if not thread.acknowledged_at:
            thread.acknowledged_at = timezone.now()
        thread.save(update_fields=('metadata', 'status', 'acknowledged_at', 'updated_at'))
        TeamFeedbackMessage.objects.create(
            organization=organization, thread=thread, sender=request.user,
            sender_name=request.user.get_full_name() or request.user.username,
            message=f'Work order {work_order.number} created and dispatched from this ticket.',
            is_developer_response=True,
        )
        return Response({'work_order_id': str(work_order.id), 'number': work_order.number, 'created': True}, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        organization = get_active_organization(self.request)
        queryset = scope_queryset_to_property(
            self.queryset.filter(organization=organization).prefetch_related('messages__sender', 'property'),
            self.request,
            organization,
        )
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
        # Intelligent routing based on category
        if not thread.assigned_to:
            from django.contrib.auth import get_user_model
            from organizations.models import Membership
            User = get_user_model()
            if thread.category in (TeamFeedbackThread.FeedbackType.BUG, TeamFeedbackThread.FeedbackType.FEATURE):
                # Developer / Engineering feedback -> Route to developer role or superuser
                developer = User.objects.filter(
                    is_active=True, is_superuser=True,
                    erp_memberships__organization=organization,
                    erp_memberships__status='active',
                ).first()
                if not developer:
                    developer = User.objects.filter(
                        is_active=True,
                        erp_memberships__organization=organization,
                        erp_memberships__status='active',
                        erp_memberships__roles__slug__in=['engineering', 'developer', 'platform-admin'],
                    ).first()
                if developer:
                    thread.assigned_to = developer
                    thread.assigned_team = 'Engineering & Platform Development'
                    thread.module = 'platform'
                    thread.save(update_fields=['assigned_to', 'assigned_team', 'module'])
            else:
                # Operational / Facility feedback -> Route to Property Manager or Org Admin
                manager_membership = Membership.objects.active().filter(
                    organization=organization,
                    roles__slug__in=['property-manager', 'facility-manager', 'admin'],
                ).select_related('user').first()
                if not manager_membership:
                    manager_membership = Membership.objects.active().filter(
                        organization=organization,
                        is_organization_admin=True,
                    ).select_related('user').first()
                if manager_membership:
                    thread.assigned_to = manager_membership.user
                    if not thread.assigned_team:
                        thread.assigned_team = 'Property Management'
                    thread.save(update_fields=['assigned_to', 'assigned_team'])
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

    @action(detail=False, methods=['post'], url_path='developer-report')
    def report_to_developer(self, request):
        """Submit platform bug, error, or technical feedback directly to the lead developer (Samuel N)."""
        organization = get_active_organization(request)
        title = str(request.data.get('title') or 'System Bug / Developer Report').strip()
        message = str(request.data.get('message') or '').strip()
        if not message:
            raise ValidationError({'message': 'Issue description is required.'})
        priority = str(request.data.get('priority') or TeamFeedbackThread.Priority.HIGH).strip()
        if priority not in TeamFeedbackThread.Priority.values:
            priority = TeamFeedbackThread.Priority.HIGH
        attachment_url = str(request.data.get('attachment_url') or '').strip()
        system_metadata = request.data.get('metadata') if isinstance(request.data.get('metadata'), dict) else {}

        from django.contrib.auth import get_user_model
        from organizations.models import Membership
        User = get_user_model()
        developer = User.objects.filter(
            is_active=True, is_superuser=True,
            erp_memberships__organization=organization,
            erp_memberships__status='active',
        ).first()
        if not developer:
            developer = User.objects.filter(
                is_active=True,
                erp_memberships__organization=organization,
                erp_memberships__status='active',
                erp_memberships__roles__slug__in=['engineering', 'developer', 'platform-admin'],
            ).first()

        thread = TeamFeedbackThread.objects.create(
            organization=organization,
            title=title,
            category=TeamFeedbackThread.FeedbackType.BUG,
            issue_category='System & Developer Bug',
            priority=priority,
            created_by=request.user,
            assigned_to=developer,
            assigned_team='Engineering & Platform Development',
            module=str(request.data.get('module') or 'platform'),
            metadata={
                'source': 'developer_report_dialog',
                'reported_by_user': request.user.username,
                'user_email': request.user.email,
                **system_metadata,
            },
        )
        TeamFeedbackMessage.objects.create(
            organization=organization,
            thread=thread,
            sender=request.user,
            sender_name=f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username,
            message=message,
            attachment_url=attachment_url,
        )
        if developer:
            notify_user(
                organization=organization,
                recipient=developer,
                title=f"[Developer Bug] {title}",
                message=f"New platform bug reported by {request.user.username}:\n{message[:200]}...",
                module='companion',
                action_url=f"/companion?tab=feedback&thread={thread.id}",
                priority='high',
            )
        return Response(self.get_serializer(thread).data, status=status.HTTP_201_CREATED)

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

        # Notify requester via email if email was provided
        if thread.contact_channel == 'email' and thread.contact_value and '@' in thread.contact_value:
            try:
                from notifications.services import send_email_notification
                send_email_notification(
                    recipient_email=thread.contact_value,
                    recipient_name=thread.requester_name or "Occupant",
                    subject=f'Update on Ticket {thread.ticket_no}: {thread.title}',
                    message=(
                        f"Hello {thread.requester_name or 'there'},\n\n"
                        f"A new reply has been posted regarding your ticket ({thread.ticket_no} - {thread.title}):\n\n"
                        f"\"{message_text}\"\n\n"
                        f"Responder: {request.user.get_full_name() or request.user.username} ({organization.name})\n\n"
                        f"Thank you for your patience."
                    ),
                    organization=organization,
                )
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Failed to dispatch ticket reply email: {e}")

        return Response(TeamFeedbackMessageSerializer(msg).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='update-status')
    def update_status(self, request, pk=None):
        from django.utils import timezone as tz
        thread = self.get_object()
        organization = get_active_organization(request)
        membership = get_active_membership(request, organization)
        is_admin = bool(request.user.is_superuser or (membership and membership.is_organization_admin))
        new_status = request.data.get('status')
        if new_status not in TeamFeedbackThread.Status.values:
            raise ValidationError({'status': 'Invalid status choice.'})
        allowed = self.STATUS_TRANSITIONS.get(thread.status, ())
        if new_status not in allowed:
            raise ValidationError({
                'status': f'Cannot transition from "{thread.status}" to "{new_status}". '
                          f'Allowed transitions: {", ".join(allowed)}.'
            })
        if new_status == 'resolved' and not is_admin and thread.assigned_to_id != request.user.id:
            raise PermissionDenied('Only the assigned developer or an organization administrator can mark feedback complete.')
        if new_status == 'closed' and not is_admin and thread.created_by_id != request.user.id:
            raise PermissionDenied('Only the person who raised the feedback or an organization administrator can confirm it done.')
        if new_status == 'open' and not is_admin and request.user.id not in {thread.created_by_id, thread.assigned_to_id}:
            raise PermissionDenied('Only the requester, assigned developer, or an organization administrator can reopen feedback.')
        thread.status = new_status
        now = tz.now()
        if new_status == 'resolved':
            thread.resolved_by = request.user
            thread.resolved_at = now
        elif new_status == 'closed':
            thread.confirmed_by = request.user
            thread.confirmed_at = now
        elif new_status == 'open':
            # Reopening — clear resolution timestamps
            thread.resolved_by = None
            thread.resolved_at = None
            thread.confirmed_by = None
            thread.confirmed_at = None
        thread.save()

        # Notify requester via email if email was provided
        if thread.contact_channel == 'email' and thread.contact_value and '@' in thread.contact_value:
            try:
                from notifications.services import send_email_notification
                status_label = new_status.replace('_', ' ').upper()
                send_email_notification(
                    recipient_email=thread.contact_value,
                    recipient_name=thread.requester_name or "Occupant",
                    subject=f'Status Update: Ticket {thread.ticket_no} is now {status_label}',
                    message=(
                        f"Hello {thread.requester_name or 'there'},\n\n"
                        f"Your Helpdesk Ticket ({thread.ticket_no} - {thread.title}) status has been updated to: {status_label}.\n\n"
                        f"Location: {thread.location_detail}\n"
                        f"Updated by: {request.user.get_full_name() or request.user.username} ({organization.name})\n\n"
                        f"Thank you for contacting {organization.name}."
                    ),
                    organization=organization,
                )
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Failed to dispatch ticket status email: {e}")
        return Response(TeamFeedbackThreadSerializer(thread).data)


class PublicFeedbackQrCodeViewSet(CompanionModelViewSet):
    permission_classes = (IsAuthenticated, HasOrganizationContext)
    required_module = None
    queryset = PublicFeedbackQrCode.objects.select_related('property', 'building')
    serializer_class = PublicFeedbackQrCodeSerializer
    write_permission = None
    read_permission = None
    search_fields = ('label', 'property__name', 'building__name', 'floor', 'unit')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        serializer.save(organization=organization)


from notifications.services import notify_user, send_email_notification
from .models import IssueRoutingRule
from .serializers import IssueRoutingRuleSerializer


class IssueRoutingRuleViewSet(CompanionModelViewSet):
    queryset = IssueRoutingRule.objects.select_related('property', 'assigned_user')
    serializer_class = IssueRoutingRuleSerializer
    write_permission = 'companion.assign'
    search_fields = ('category', 'property__name', 'assigned_team', 'assigned_user__username')


@extend_schema(request=None, responses={201: {"type": "object"}})
@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def public_feedback_upload(request, token):
    qr = PublicFeedbackQrCode.objects.filter(token=token, active=True).first()
    if not qr:
        return Response({'detail': 'This feedback link is no longer active.'}, status=status.HTTP_404_NOT_FOUND)
    
    upload = request.FILES.get('file')
    if not upload:
        raise ValidationError({'file': 'No file was provided for upload.'})
    if upload.size > 25 * 1024 * 1024:
        raise ValidationError({'file': 'Attachment exceeds maximum 25 MB size limit.'})
    
    import os, uuid
    from django.core.files.storage import default_storage
    ext = os.path.splitext(upload.name)[1].lower() or '.jpg'
    filename = f"companion/public_feedback/{qr.organization_id}/{uuid.uuid4().hex[:12]}_{upload.name}"
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


@extend_schema(request=None, responses={200: {"type": "object"}, 201: {"type": "object"}})
@csrf_exempt
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def public_feedback(request, token):
    qr = PublicFeedbackQrCode.objects.select_related('organization', 'property', 'building').filter(token=token, active=True).first()
    if not qr:
        return Response({'detail': 'This feedback link is no longer active.'}, status=status.HTTP_404_NOT_FOUND)
    
    categories = [
        {'id': 'Plumbing', 'label': 'Plumbing & Drainage', 'icon': '🚰'},
        {'id': 'Electrical', 'label': 'Electrical & Lighting', 'icon': '⚡'},
        {'id': 'Cleaning', 'label': 'Cleaning & Janitorial', 'icon': '🧹'},
        {'id': 'Security', 'label': 'Security & Guarding', 'icon': '🛡️'},
        {'id': 'Lift', 'label': 'Elevator / Lift', 'icon': '🛗'},
        {'id': 'Access', 'label': 'Access Control & Doors', 'icon': '🚪'},
        {'id': 'Water', 'label': 'Water Supply & Pumps', 'icon': '💧'},
        {'id': 'Common Area', 'label': 'Common Area & Facilities', 'icon': '🏢'},
        {'id': 'Other', 'label': 'General / Other Inquiry', 'icon': '📝'},
    ]

    if request.method == 'GET':
        return Response({
            'label': qr.label,
            'property': qr.property.name,
            'property_id': str(qr.property.id),
            'building': qr.building.name if qr.building else '',
            'floor': qr.floor,
            'unit': qr.unit,
            'categories': categories,
        })

    # POST - Create Helpdesk Ticket
    issue_category = str(request.data.get('category') or request.data.get('issue_category') or 'Other').strip()
    title = str(request.data.get('title') or f"{issue_category} Request - {qr.label}").strip()
    message = str(request.data.get('message') or request.data.get('description') or '').strip()
    if not message:
        raise ValidationError({'message': 'Issue description is required.'})

    name = str(request.data.get('name') or 'Public Visitor').strip()
    contact_channel = str(request.data.get('contact_channel') or 'email').strip()
    contact_value = str(request.data.get('contact_value') or request.data.get('contact') or '').strip()
    priority = str(request.data.get('priority') or TeamFeedbackThread.Priority.NORMAL).strip()
    if priority not in TeamFeedbackThread.Priority.values:
        priority = TeamFeedbackThread.Priority.NORMAL

    attachment_url = str(request.data.get('attachment_url') or request.data.get('photo_url') or '').strip()

    # 1. Match Issue Routing Rule
    routing_rule = IssueRoutingRule.objects.filter(
        organization=qr.organization, is_active=True,
        category__iexact=issue_category, property=qr.property,
    ).first()
    if not routing_rule:
        routing_rule = IssueRoutingRule.objects.filter(
            organization=qr.organization, is_active=True,
            category__iexact=issue_category, property__isnull=True,
        ).first()

    assigned_team = routing_rule.assigned_team if routing_rule else f"{qr.property.name} Management Office"
    assigned_user = routing_rule.assigned_user if routing_rule else None
    sla_hours = routing_rule.sla_hours if routing_rule else (4 if priority == 'urgent' else 24)

    if not assigned_user:
        # Fallback to Property Manager or Organization Admin for the property's organization
        from organizations.models import Membership
        manager_membership = Membership.objects.active().filter(
            organization=qr.organization,
            roles__slug__in=['property-manager', 'facility-manager', 'admin'],
        ).select_related('user').first()

        if not manager_membership:
            manager_membership = Membership.objects.active().filter(
                organization=qr.organization,
                is_organization_admin=True,
            ).select_related('user').first()

        if manager_membership:
            assigned_user = manager_membership.user

    # Public submissions also notify the platform developer when that account
    # exists. Resolve it explicitly here; previously this branch referenced an
    # undefined ``developer`` variable after the ticket had already been saved,
    # causing an otherwise successful submission to return HTTP 500.
    from django.contrib.auth import get_user_model
    from organizations.models import Membership
    User = get_user_model()
    developer = User.objects.filter(
        is_active=True, is_superuser=True,
        erp_memberships__organization=qr.organization,
        erp_memberships__status='active',
    ).first()
    if not developer:
        developer = User.objects.filter(
            is_active=True,
            erp_memberships__organization=qr.organization,
            erp_memberships__status='active',
            erp_memberships__roles__slug__in=['engineering', 'developer', 'platform-admin'],
        ).first()

    import datetime
    now = timezone.now()
    sla_due_at = now + datetime.timedelta(hours=sla_hours)

    location_desc = f"{qr.property.name}"
    if qr.building:
        location_desc += f" · {qr.building.name}"
    if qr.floor:
        location_desc += f" · Floor {qr.floor}"
    if qr.unit:
        location_desc += f" · Unit {qr.unit}"

    # 2. Create the ticket thread
    thread = TeamFeedbackThread.objects.create(
        organization=qr.organization,
        property=qr.property,
        title=title,
        category=TeamFeedbackThread.FeedbackType.OPERATIONAL,
        issue_category=issue_category,
        priority=priority,
        requester_name=name,
        contact_channel=contact_channel,
        contact_value=contact_value,
        location_detail=location_desc,
        photo_url=attachment_url,
        assigned_team=assigned_team,
        assigned_to=assigned_user,
        sla_due_at=sla_due_at,
        module='facility',
        metadata={
            'public_qr': True,
            'qr_label': qr.label,
            'floor': qr.floor,
            'unit': qr.unit,
            'token': token,
            'sla_hours': sla_hours,
        },
    )

    # 3. Create initial message
    TeamFeedbackMessage.objects.create(
        organization=qr.organization,
        thread=thread,
        message=message,
        sender_name=name,
        attachment_url=attachment_url,
    )

    # 4. Requester Acknowledgement
    acknowledgement_status = 'not_requested'
    if contact_channel == 'email' and contact_value and '@' in contact_value:
        acknowledgement_status = 'queued' if send_email_notification(
            recipient_email=contact_value,
            recipient_name=name,
            subject=f'Ticket Acknowledged: {thread.ticket_no} - {issue_category}',
            message=(
                f"Thank you, {name}. Your request has been received under Ticket Reference {thread.ticket_no}.\n\n"
                f"Issue: {issue_category}\n"
                f"Location: {location_desc}\n"
                f"Assigned Team: {assigned_team}\n"
                f"Target Resolution: within {sla_hours} hours\n\n"
                f"Description: {message}\n\n"
                f"We will attend to this promptly."
            ),
            action_url=f"/feedback/{token}?ref={thread.ticket_no}",
            organization=qr.organization,
        ) else 'failed'
    thread.metadata = {**(thread.metadata or {}), 'acknowledgement_email_status': acknowledgement_status}
    thread.save(update_fields=('metadata', 'updated_at'))

    # 5. Staff Notification (in-app + email)
    assignee_name = assigned_user.get_full_name() or assigned_user.username if assigned_user else assigned_team
    if assigned_user:
        notify_user(
            organization=qr.organization,
            recipient=assigned_user,
            title=f"New Helpdesk Ticket {thread.ticket_no}: {issue_category}",
            message=f"New {priority} ticket from {name} at {location_desc}: {message[:120]} (SLA: {sla_hours}h)",
            action_url=f"/companion?tab=feedback&thread={thread.id}",
            category="companion",
            level=Notification.Level.URGENT if priority == 'urgent' else Notification.Level.INFO,
        )

    if developer and (not assigned_user or developer.pk != assigned_user.pk):
        notify_user(
            organization=qr.organization,
            recipient=developer,
            title=f"Smart Helpdesk: {thread.ticket_no} at {qr.property.name}",
            message=f"{issue_category} raised by {name} ({contact_channel}: {contact_value or 'none'}). Assigned to {assignee_name}.",
            action_url=f"/companion?tab=feedback&thread={thread.id}",
            category="companion",
        )

    return Response({
        'reference': thread.ticket_no,
        'ticket_no': thread.ticket_no,
        'status': thread.status,
        'assigned_team': assigned_team,
        'assigned_to': assignee_name,
        'sla_hours': sla_hours,
        'sla_due_at': thread.sla_due_at.isoformat() if thread.sla_due_at else None,
        'detail': f'Thank you. Your request has been logged under Ticket {thread.ticket_no}.',
        'acknowledgement_email_status': acknowledgement_status,
    }, status=status.HTTP_201_CREATED)


@extend_schema(request=None, responses={200: {"type": "object"}, 201: {"type": "object"}})
@csrf_exempt
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def public_ticket_status(request, reference):
    """
    Public ticket status tracking, confirmation, and reopening.
    """
    thread = TeamFeedbackThread.objects.select_related('property', 'assigned_to').filter(
        Q(reference__iexact=reference) | Q(ticket_no__iexact=reference)
    ).first()
    if not thread:
        return Response({'detail': 'Ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        messages = thread.messages.all().order_by('created_at')
        return Response({
            'reference': thread.ticket_no or thread.reference,
            'title': thread.title,
            'category': thread.issue_category or thread.category,
            'status': thread.status,
            'priority': thread.priority,
            'property_name': thread.property.name if thread.property else '',
            'location_detail': thread.location_detail,
            'assigned_team': thread.assigned_team or 'Facility Management',
            'assigned_to': thread.assigned_to.get_full_name() or thread.assigned_to.username if thread.assigned_to else 'Pending allocation',
            'created_at': thread.created_at.isoformat(),
            'sla_due_at': thread.sla_due_at.isoformat() if thread.sla_due_at else None,
            'resolved_at': thread.resolved_at.isoformat() if thread.resolved_at else None,
            'confirmed_at': thread.confirmed_at.isoformat() if thread.confirmed_at else None,
            'resolution_notes': thread.resolution_notes,
            'reopened_count': thread.reopened_count,
            'acknowledgement_email_status': (thread.metadata or {}).get('acknowledgement_email_status', 'unknown'),
            'messages': [
                {
                    'sender': m.sender_name or (m.sender.username if m.sender else 'System'),
                    'message': m.message,
                    'is_developer_response': m.is_developer_response,
                    'created_at': m.created_at.isoformat(),
                }
                for m in messages
            ],
        })

    # POST - Confirm or Reopen
    action_type = request.data.get('action') # 'confirm' or 'reopen'
    note = str(request.data.get('note') or '').strip()

    if action_type == 'confirm':
        thread.status = TeamFeedbackThread.Status.CLOSED
        thread.confirmed_at = timezone.now()
        thread.save(update_fields=['status', 'confirmed_at'])
        TeamFeedbackMessage.objects.create(
            organization=thread.organization,
            thread=thread,
            message=f"Requester confirmed resolution: {note or 'Issue resolved to satisfaction.'}",
            sender_name=thread.requester_name or 'Requester',
        )
        return Response({'detail': f'Ticket {thread.ticket_no} confirmed and closed. Thank you!'})

    elif action_type == 'reopen':
        thread.status = TeamFeedbackThread.Status.OPEN
        thread.reopened_count += 1
        thread.resolved_at = None
        thread.resolved_by = None
        thread.save(update_fields=['status', 'reopened_count', 'resolved_at', 'resolved_by'])
        TeamFeedbackMessage.objects.create(
            organization=thread.organization,
            thread=thread,
            message=f"Requester reopened ticket: {note or 'Issue still persists.'}",
            sender_name=thread.requester_name or 'Requester',
        )
        # Alert assignee
        if thread.assigned_to:
            notify_user(
                organization=thread.organization,
                recipient=thread.assigned_to,
                title=f"Ticket Reopened: {thread.ticket_no}",
                message=f"Requester reopened {thread.ticket_no} at {thread.location_detail}: {note or 'Issue still persists.'}",
                action_url=f"/companion?tab=feedback&thread={thread.id}",
                category="companion",
                level=Notification.Level.URGENT,
            )
        return Response({'detail': f'Ticket {thread.ticket_no} has been reopened and escalated.'})

    return Response({'detail': 'Invalid action. Specify confirm or reopen.'}, status=status.HTTP_400_BAD_REQUEST)



class StaffLeaveRequestViewSet(CompanionModelViewSet):
    permission_classes = (HasOrganizationContext, IsAuthenticated)
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
    permission_classes = (HasOrganizationContext, IsAuthenticated)
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

        hr_req.status = decision
        hr_req.decided_by = request.user
        hr_req.decision_notes = notes
        hr_req.decided_at = timezone.now()
        hr_req.save()

        return Response(StaffHrRequestSerializer(hr_req).data)


class StreamingChatView(APIView):
    permission_classes = (IsAuthenticated, HasOrganizationContext)

    @extend_schema(request=None, responses={200: {"type": "string"}})
    def post(self, request):
        import json
        from django.http import StreamingHttpResponse
        from .agent.gateway import LLMGateway
        from .agent.tools.finance_tools import inspect_arrears_and_collections
        from .agent.tools.facility_tools import inspect_facility_work_orders
        from .agent.tools.tenant_tools import inspect_leasing_and_occupancy
        from .agent.tools.calendar_tools import get_upcoming_critical_dates

        organization = get_active_organization(request)
        org_id = str(organization.id) if organization else None
        messages = request.data.get('messages', [])
        if not messages:
            last_msg = request.data.get('message', '')
            if last_msg:
                messages = [{'role': 'user', 'content': str(last_msg)}]

        # Resolve the user's active property scope and role permissions
        from core.property_scope import get_active_property
        from core.models import Module
        from core.membership import get_active_membership

        membership = get_active_membership(request, organization)
        permission_keys = set()
        if membership:
            membership = membership.__class__.objects.prefetch_related('roles__permissions').get(pk=membership.pk)
            permission_keys = {permission.key for role in membership.roles.all() for permission in role.permissions.all()}
        is_admin = bool(request.user.is_superuser or (membership and membership.is_organization_admin))
        subscribed = set(organization.subscriptions.available().values_list('module', flat=True)) if organization else set()

        def can_view(module):
            return module in subscribed and (is_admin or any(key.startswith(f'{module}.') for key in permission_keys))

        allowed_modules = [m for m in Module.values if can_view(m)]

        active_prop_stream = None
        prop_id_stream = None
        try:
            active_prop_stream = get_active_property(request, organization)
            prop_id_stream = str(active_prop_stream.id) if active_prop_stream else None
        except Exception:
            pass
        scope_label = active_prop_stream.name if active_prop_stream else 'Portfolio Wide'

        # Gather live grounded context for streaming (scoped to authorized modules and property)
        grounded_facts = ""
        tools_used = []
        if org_id:
            try:
                fin = inspect_arrears_and_collections(org_id, property_id=prop_id_stream, allowed_modules=allowed_modules)
                fac = inspect_facility_work_orders(org_id, property_id=prop_id_stream, allowed_modules=allowed_modules)
                lease = inspect_leasing_and_occupancy(org_id, property_id=prop_id_stream, allowed_modules=allowed_modules)
                cal = get_upcoming_critical_dates(org_id, property_id=prop_id_stream, allowed_modules=allowed_modules)

                if "property" in allowed_modules:
                    tools_used.extend(["finance_data", "leasing_data"])
                if "facility" in allowed_modules:
                    tools_used.append("facility_data")
                if cal.get("events"):
                    tools_used.append("calendar_events")

                from django.utils import timezone as tz
                local_now = tz.localtime(tz.now())
                fact_lines = [
                    f"TODAY'S DATE: {local_now.strftime('%A, %d %B %Y, %I:%M %p %Z')}",
                    f"DATA SCOPE: {scope_label}",
                ]
                if "property" in allowed_modules:
                    fact_lines.append(f"FINANCE: KES {fin.get('total_arrears', 0):,.0f} in arrears across {fin.get('overdue_count', 0)} overdue invoices.")
                    fact_lines.append(f"LEASING: {lease.get('expiring_leases_count', 0)} leases expiring within 60 days.")
                if "facility" in allowed_modules:
                    fact_lines.append(f"FACILITY: {fac.get('open_work_orders', 0)} open work orders, {fac.get('urgent_count', 0)} critical.")
                if cal.get("events"):
                    fact_lines.append(f"CALENDAR EVENTS: {json.dumps(cal.get('events', [])[:6], default=str)}")

                grounded_facts = "\n".join(fact_lines)
            except Exception:
                import logging
                logging.getLogger(__name__).warning("Streaming: context ingestion failed", exc_info=True)

        gateway = LLMGateway()
        system_prompt = (
            f"You are Quartermaster, the AI Operations Agent for {organization.name if organization else 'Center Estates'}.\n\n"
            + (f"LIVE GROUNDED SYSTEM DATA:\n{grounded_facts}\n\n" if grounded_facts else "")
            + "DIRECTIVES:\n"
            "1. Ground every answer in the live data above. Use clean markdown bullets.\n"
            "2. ROLE & SCOPE BOUNDARIES: You operate strictly within the authorized scope of the logged-in operator. All data provided is already scoped to what the operator is authorized to see. Never include disclaimers, contrasts, or 'Note:' remarks about workspace filters or portfolio differences. Answer directly and factually for the data visible to the operator.\n"
            "3. Be concise, professional, and definitive."
        )

        def event_stream():
            try:
                # First emit which tools were used
                if tools_used:
                    meta = json.dumps({"toolsExecuted": tools_used})
                    yield f"data: {meta}\n\n"
                for token in gateway.stream_chat(system_prompt, messages):
                    payload = json.dumps({"token": token})
                    yield f"data: {payload}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                err_payload = json.dumps({"error": str(e)})
                yield f"data: {err_payload}\n\n"

        response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response


class ActionExecutionView(APIView):
    permission_classes = (IsAuthenticated, HasOrganizationContext)

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def post(self, request):
        from .agent.interactive_actions import execute_agent_action

        organization = get_active_organization(request)
        action_type = request.data.get('action_type', '')
        params = request.data.get('params', {})
        result = execute_agent_action(action_type, params, organization, request.user)
        status_code = 200 if result.get('success') else 400
        return Response(result, status=status_code)


class DocumentExtractView(APIView):
    permission_classes = (IsAuthenticated, HasOrganizationContext)

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def post(self, request):
        from .agent.gateway import LLMGateway
        from .parsers.document_extractor import extract_lease_data

        text = request.data.get('text', '')
        if not text and request.FILES.get('file'):
            uploaded_file = request.FILES['file']
            try:
                text = uploaded_file.read().decode('utf-8', errors='ignore')
            except Exception:
                text = ""

        gateway = LLMGateway()
        result = extract_lease_data(text, gateway=gateway)
        status_code = 200 if result.get('success') else 400
        return Response(result, status=status_code)
