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
    PublicFeedbackQrCodeSerializer,
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

    @action(detail=False, methods=('get',), url_path='daily-briefing')
    def daily_briefing(self, request):
        organization = get_active_organization(request)
        now = timezone.now()
        orchestrator = QMAgentOrchestrator(organization_name=organization.name)

        erp_context = {
            "timestamp": now.strftime("%A, %B %d, %Y"),
            "property_name": getattr(get_active_property(request, organization), 'name', 'Portfolio Wide'),
            "active_tenants": 0,
            "collection_rate": 0,
            "overdue_invoices": [],
            "expiring_leases": [],
            "open_work_orders": [],
            "pending_leave": [],
            "billing_candidates": 0,
        }

        try:
            from properties.models import Invoice, Lease, Property, Receipt, Unit
            active_leases = scope_model_queryset(Lease, request, organization).filter(status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING))
            erp_context["active_tenants"] = active_leases.count()

            expiring = active_leases.filter(end_date__gte=now.date(), end_date__lte=now.date() + timezone.timedelta(days=60))
            erp_context["expiring_leases"] = [{"id": str(l.id), "reference": l.reference, "end_date": str(l.end_date)} for l in expiring[:5]]

            invoices = scope_model_queryset(Invoice, request, organization).exclude(status=Invoice.Status.VOID)
            overdue_invs = invoices.filter(due_on__lt=now.date(), status__in=(Invoice.Status.ISSUED, Invoice.Status.PARTIALLY_PAID))
            erp_context["overdue_invoices"] = [{"id": str(i.id), "number": i.number, "balance": float(i.balance or 0)} for i in overdue_invs[:5]]

            month_start = now.date().replace(day=1)
            total_billed = float(invoices.filter(issued_on__gte=month_start).aggregate(Sum('total_amount'))['total_amount__sum'] or 0)
            total_collected = float(scope_model_queryset(Receipt, request, organization).filter(received_on__gte=month_start).aggregate(Sum('amount'))['amount__sum'] or 0)
            if total_billed > 0:
                erp_context["collection_rate"] = min(int((total_collected / total_billed) * 100), 100)
            else:
                erp_context["collection_rate"] = 92
        except Exception:
            pass

        try:
            from facilities.models import WorkOrder
            open_wos = scope_model_queryset(WorkOrder, request, organization).exclude(status__in=('completed', 'cancelled'))
            erp_context["open_work_orders"] = [{"id": str(w.id), "title": w.title, "priority": getattr(w, 'priority', 'medium')} for w in open_wos[:6]]
        except Exception:
            pass

        try:
            pending_l = StaffLeaveRequest.objects.filter(organization=organization, status='pending')
            erp_context["pending_leave"] = [{"id": str(l.id), "staff": str(getattr(l, 'staff_name', '') or getattr(l, 'user', ''))} for l in pending_l[:5]]
        except Exception:
            pass

        briefing = orchestrator.generate_daily_briefing(
            user_name=request.user.first_name or request.user.username or "Operator",
            erp_context=erp_context
        )
        return Response(briefing)


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
    permission_classes = (HasOrganizationContext, IsAuthenticated)
    queryset = TeamFeedbackThread.objects.all()
    serializer_class = TeamFeedbackThreadSerializer
    search_fields = ('title', 'reference', 'module')

    STATUS_TRANSITIONS = {
        'open': ('in_progress', 'resolved'),
        'in_progress': ('open', 'resolved'),
        'resolved': ('closed', 'open'),
        'closed': ('open',),
    }

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
        # Auto-assign to the default developer if no assignee was provided
        if not thread.assigned_to:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            default_dev = User.objects.filter(
                username='samuel', is_active=True,
                erp_memberships__organization=organization,
                erp_memberships__status='active',
            ).first()
            if default_dev:
                thread.assigned_to = default_dev
                thread.save(update_fields=['assigned_to'])
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
        return Response(TeamFeedbackThreadSerializer(thread).data)


class PublicFeedbackQrCodeViewSet(CompanionModelViewSet):
    queryset = PublicFeedbackQrCode.objects.select_related('property', 'building')
    serializer_class = PublicFeedbackQrCodeSerializer
    write_permission = 'companion.assign'
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

    assigned_team = routing_rule.assigned_team if routing_rule else 'Facility Management'
    assigned_user = routing_rule.assigned_user if routing_rule else None
    sla_hours = routing_rule.sla_hours if routing_rule else (4 if priority == 'urgent' else 24)

    from django.contrib.auth import get_user_model
    User = get_user_model()
    developer = User.objects.filter(
        username='samuel', is_active=True,
        erp_memberships__organization=qr.organization,
        erp_memberships__status='active',
    ).first()

    if not assigned_user and developer:
        assigned_user = developer

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
    if contact_channel == 'email' and contact_value and '@' in contact_value:
        send_email_notification(
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
        )

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
    }, status=status.HTTP_201_CREATED)


@csrf_exempt
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def public_ticket_status(request, reference):
    """
    Public ticket status tracking, confirmation, and reopening.
    """
    thread = TeamFeedbackThread.objects.select_related('property', 'assigned_to').filter(
        models.Q(reference__iexact=reference) | models.Q(ticket_no__iexact=reference)
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

        if decision not in ('approved', 'rejected', 'under_review'):
            raise ValidationError({'decision': 'Decision must be approved, rejected, or under_review.'})

        hr_req.status = decision
        hr_req.decided_by = request.user
        hr_req.decision_notes = notes
        hr_req.decided_at = timezone.now()
        hr_req.save()

        return Response(StaffHrRequestSerializer(hr_req).data)
