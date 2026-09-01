from django.conf import settings
from datetime import datetime
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import JsonResponse
from django.db import connection
from django.db.models import F, Q
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt, csrf_protect
import re
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema, OpenApiTypes

from core.serializers import MembershipSerializer, serialize_modules
from core.models import ClientErrorEvent, FeatureTestProgress, Module
from core.tenancy import get_active_membership, get_active_organization
from core.property_scope import get_active_property, scope_model_queryset
from organizations.models import Membership

IMPERSONATOR_COOKIE = getattr(settings, 'JWT_IMPERSONATOR_COOKIE', 'ce_impersonator')
VISIBLE_DEMO_IDENTITIES = {
    'admin',
    'role-portfolio-manager',
    'role-finance-officer',
    'role-operations-staff',
    'role-read-only',
}


# This is deliberately a curated acceptance catalogue rather than a claim that
# every implementation detail has browser coverage.  It gives operations a
# shared, auditable place to record the workflows they have actually exercised.
TEST_CHECKLIST = (
    ('property.onboarding', 'Property', 'Create, save, resume and activate a property onboarding draft', '/property-onboarding'),
    ('property.units_import', 'Property', 'Add units manually and validate a bulk CSV import before saving', '/property-onboarding?section=units'),
    ('property.unit_billing', 'Property', 'Configure unit billing schedules, deposits, utilities and parking', '/property?tab=units'),
    ('property.tenancy', 'Property', 'Create a tenant, lease, offer details and rent escalation', '/property?tab=tenancy'),
    ('property.billing', 'Property', 'Scan billing candidates, generate invoices and confirm dispatch', '/property?tab=billing'),
    ('property.receipting', 'Property', 'Record tenant or landlord receipt, auto-allocate and retain wallet credit', '/property?tab=receipting'),
    ('property.reconciliation', 'Property', 'Import statement entries and reconcile them to posted receipts', '/property?tab=bank-reconciliation'),
    ('property.recovery', 'Property', 'Review arrears, deposit exposure and issue a recovery notice', '/property?tab=arrears-recovery'),
    ('property.reporting', 'Property', 'Export financial and tenancy reports as the required PDF or CSV', '/property?tab=financial-reports'),
    ('property.tenant_portal', 'Property', 'Tenant views invoices, receipts, documents and submits a service request', '/tenant-portal'),
    ('facility.assets', 'Facility', 'Onboard an asset with lifecycle, service profile, documents and evidence', '/facility?tab=assets'),
    ('facility.meters', 'Facility', 'Capture meter readings as draft and approve a valid reading', '/facility?tab=meter-readings'),
    ('facility.tickets', 'Facility', 'Raise a ticket, assign it, update SLA status and close it with evidence', '/facility?tab=service-requests'),
    ('facility.work_orders', 'Facility', 'Create and complete a work order with photo or video evidence', '/facility?tab=work-orders'),
    ('facility.incidents', 'Facility', 'Report an incident, investigate it and record corrective action', '/facility?tab=incident-reporting'),
    ('facility.procurement', 'Facility', 'Approve requisition, compare quotations, issue LPO and create a job card', '/facility?tab=procurement'),
    ('facility.ppm', 'Facility', 'Schedule and complete planned preventive maintenance', '/facility?tab=planned-maintenance'),
    ('facility.providers', 'Facility', 'Onboard service provider, documents, SLA contract and scorecard', '/facility?tab=contractors'),
    ('facility.caretaker', 'Facility', 'Use the mobile caretaker portal to submit readings, requests and evidence', '/caretaker-portal'),
    ('companion.tasks', 'Companion', 'Assign, accept, update and complete a task', '/companion?tab=my-tasks'),
    ('companion.qm', 'Companion', 'Open Quartermaster, use chat and access a saved conversation', '/companion?tab=quartermaster'),
    ('companion.announcements', 'Companion', 'Create a campaign announcement and confirm appropriate staff visibility', '/companion?tab=team'),
    ('platform.access', 'Platform', 'Verify role permissions, organization scope and denied actions', '/administration?tab=roles'),
    ('platform.reliability', 'Platform', 'Verify sign-in, property switching, responsive layout and graceful errors', '/workspaces'),
    ('platform.api', 'Platform', 'Review authenticated API endpoints and schema in the API console', '/api-console'),
)


class TestingChecklistView(APIView):
    """Organisation-admin acceptance testing dashboard with persistent evidence."""

    permission_classes = (IsAuthenticated,)

    def _organization_for_admin(self, request):
        organization = get_active_organization(request)
        membership = get_active_membership(request, organization)
        if not organization or not (request.user.is_superuser or (membership and membership.is_organization_admin)):
            return None
        return organization

    def get(self, request):
        organization = self._organization_for_admin(request)
        if not organization:
            return Response({'detail': 'Organisation administrator access is required.'}, status=403)
        progress_by_key = {
            row.feature_key: row for row in FeatureTestProgress.objects.filter(organization=organization).select_related('tested_by')
        }
        items = []
        counts = {status: 0 for status in FeatureTestProgress.Status.values}
        for key, module, title, url in TEST_CHECKLIST:
            progress = progress_by_key.get(key)
            status = progress.status if progress else FeatureTestProgress.Status.NOT_STARTED
            counts[status] += 1
            items.append({
                'key': key, 'module': module, 'title': title, 'url': url, 'status': status,
                'notes': progress.notes if progress else '', 'evidence_url': progress.evidence_url if progress else '',
                'tested_at': progress.tested_at if progress else None,
                'tested_by': progress.tested_by.get_full_name() or progress.tested_by.get_username() if progress and progress.tested_by else '',
            })
        return Response({'results': items, 'summary': counts, 'total': len(items)})

    def patch(self, request, feature_key):
        organization = self._organization_for_admin(request)
        if not organization:
            return Response({'detail': 'Organisation administrator access is required.'}, status=403)
        if feature_key not in {item[0] for item in TEST_CHECKLIST}:
            return Response({'detail': 'Unknown checklist item.'}, status=404)
        status = request.data.get('status')
        if status not in FeatureTestProgress.Status.values:
            return Response({'detail': 'Choose a valid checklist status.'}, status=400)
        notes = str(request.data.get('notes', ''))[:4000]
        evidence_url = str(request.data.get('evidence_url', ''))[:500]
        progress, _ = FeatureTestProgress.objects.get_or_create(organization=organization, feature_key=feature_key)
        progress.status = status
        progress.notes = notes
        progress.evidence_url = evidence_url
        progress.tested_by = request.user
        progress.tested_at = timezone.now() if status != FeatureTestProgress.Status.NOT_STARTED else None
        progress.save()
        return Response({'key': feature_key, 'status': progress.status, 'tested_at': progress.tested_at})


class CalendarFeedView(APIView):
    """Role-aware portfolio/property calendar assembled from source records."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def get(self, request):
        organization = get_active_organization(request)
        membership = get_active_membership(request, organization)
        if not membership:
            return Response({'detail': 'An active organization membership is required.'}, status=403)
        membership = Membership.objects.prefetch_related('roles__permissions').get(pk=membership.pk)
        subscribed = set(organization.subscriptions.available().values_list('module', flat=True))
        permission_keys = {
            permission.key for role in membership.roles.all() for permission in role.permissions.all()
        }
        is_admin = membership.is_organization_admin or request.user.is_superuser

        def can(module):
            return module in subscribed and (is_admin or any(key.startswith(f'{module}.') for key in permission_keys))

        today = timezone.localdate()
        starts_on = parse_date(request.query_params.get('start', '')) or today - timezone.timedelta(days=90)
        ends_on = parse_date(request.query_params.get('end', '')) or today + timezone.timedelta(days=365)
        if ends_on < starts_on or (ends_on - starts_on).days > 1095:
            return Response({'detail': 'Choose a valid calendar range of no more than three years.'}, status=400)
        active_property = get_active_property(request, organization)
        events = []

        def add(*, key, title, start, event_type, module, source_url, property_record=None,
                end=None, status='scheduled', priority='normal', subtitle='', all_day=True):
            if not start:
                return
            event_date = start.date() if isinstance(start, datetime) else start
            if event_date < starts_on or event_date > ends_on:
                return
            property_id = str(property_record.id) if property_record else None
            if active_property and property_id != str(active_property.id):
                return
            events.append({
                'id': key, 'title': title, 'starts_at': start.isoformat(),
                'ends_at': (end or start).isoformat(), 'all_day': all_day,
                'event_type': event_type, 'module': module, 'status': status,
                'priority': priority, 'subtitle': subtitle, 'source_url': source_url,
                'property': property_id, 'property_name': property_record.name if property_record else '',
            })

        if can(Module.PROPERTY):
            from properties.models import Invoice, Lease, RentSchedule, TenantDocument
            from documents.models import Document
            from properties.models import Property
            for lease in scope_model_queryset(Lease, request, organization).select_related('tenant', 'unit__property'):
                prop = lease.unit.property
                add(key=f'lease-start:{lease.pk}', title=f'Lease starts · {lease.tenant.name}', start=lease.starts_on,
                    event_type='lease_start', module='property', property_record=prop, status=lease.status,
                    subtitle=f'{lease.reference} · Unit {lease.unit.code}', source_url='/property?tab=leases')
                add(key=f'lease-expiry:{lease.pk}', title=f'Lease expires · {lease.tenant.name}', start=lease.ends_on,
                    event_type='lease_expiry', module='property', property_record=prop,
                    status='overdue' if lease.ends_on < today and lease.status not in (Lease.Status.EXPIRED, Lease.Status.TERMINATED) else lease.status,
                    priority='high', subtitle=f'{lease.reference} · Unit {lease.unit.code}', source_url='/property?tab=critical-dates')
            for invoice in scope_model_queryset(Invoice, request, organization).select_related('lease__tenant', 'lease__unit__property').exclude(status=Invoice.Status.VOID):
                prop = invoice.lease.unit.property
                add(key=f'invoice-due:{invoice.pk}', title=f'Invoice due · {invoice.lease.tenant.name}', start=invoice.due_on,
                    event_type='invoice_due', module='property', property_record=prop,
                    status='overdue' if invoice.due_on < today and invoice.balance > 0 else invoice.status,
                    priority='high' if invoice.balance > 0 else 'normal', subtitle=f'{invoice.number} · KES {invoice.balance:,.2f}', source_url='/property?tab=rent')
            for schedule in scope_model_queryset(RentSchedule, request, organization).select_related('lease__tenant', 'lease__unit__property').exclude(status=RentSchedule.Status.WAIVED):
                add(key=f'rent-due:{schedule.pk}', title=f'Rent due · {schedule.lease.tenant.name}', start=schedule.due_on,
                    event_type='rent_due', module='property', property_record=schedule.lease.unit.property,
                    status=schedule.status, subtitle=f'Unit {schedule.lease.unit.code}', source_url='/property?tab=rent-schedules')
            for document in scope_model_queryset(TenantDocument, request, organization).filter(expires_on__isnull=False).select_related('tenant__property'):
                add(key=f'tenant-document:{document.pk}', title=f'{document.document_type} expires · {document.tenant.name}', start=document.expires_on,
                    event_type='document_expiry', module='property', property_record=document.tenant.property,
                    status='overdue' if document.expires_on < today and document.status != TenantDocument.Status.EXPIRED else document.status,
                    priority='high', subtitle=document.document_number, source_url='/property?tab=tenant-documents')
            properties_by_id = {str(prop.pk): prop for prop in Property.objects.for_organization(organization)}
            for document in Document.objects.for_organization(organization).filter(expires_on__isnull=False, category__startswith='property_'):
                prop = properties_by_id.get(str(document.metadata.get('property_id', '')))
                if prop:
                    add(key=f'property-document:{document.pk}', title=f'Document expires · {document.title}', start=document.expires_on,
                        event_type='document_expiry', module='property', property_record=prop,
                        status='overdue' if document.expires_on < today else document.status, priority='high',
                        subtitle=document.original_filename, source_url='/property?tab=properties')

        if can(Module.FACILITY):
            from facilities.models import Inspection, PreventiveSchedule, ServiceRequest, WorkOrder
            for inspection in scope_model_queryset(Inspection, request, organization).select_related('property', 'inspector'):
                add(key=f'inspection:{inspection.pk}', title=inspection.title, start=inspection.scheduled_on,
                    event_type='inspection', module='facility', property_record=inspection.property, status=inspection.status,
                    subtitle=f'{inspection.reference} · {inspection.inspector.get_username()}', source_url='/facility?tab=inspections')
            for schedule in scope_model_queryset(PreventiveSchedule, request, organization).select_related('asset__property').filter(is_active=True):
                add(key=f'ppm:{schedule.pk}', title=f'Preventive maintenance · {schedule.name}', start=schedule.next_due_on,
                    event_type='maintenance', module='facility', property_record=schedule.asset.property,
                    status='overdue' if schedule.next_due_on < today else 'scheduled', subtitle=schedule.code,
                    priority='high' if schedule.next_due_on < today else 'normal', source_url='/facility?tab=planned-maintenance')
            orders = scope_model_queryset(WorkOrder, request, organization).select_related('property')
            for order in orders.exclude(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED)):
                due = order.scheduled_for or order.resolution_due_at or order.response_due_at
                if due:
                    add(key=f'work-order:{order.pk}', title=f'Work order · {order.title}', start=due,
                        event_type='work_order', module='facility', property_record=order.property, status=order.status,
                        priority=order.priority, subtitle=order.number, source_url='/facility?tab=work-orders', all_day=False)
            requests = scope_model_queryset(ServiceRequest, request, organization).select_related('property').exclude(status__in=(ServiceRequest.Status.RESOLVED, ServiceRequest.Status.CLOSED, ServiceRequest.Status.REJECTED))
            for service_request in requests.filter(response_due_at__isnull=False):
                add(key=f'service-request:{service_request.pk}', title=f'Service response due · {service_request.subject}', start=service_request.response_due_at,
                    event_type='service_sla', module='facility', property_record=service_request.property,
                    status='overdue' if service_request.response_due_at < timezone.now() else service_request.status,
                    priority=service_request.priority, subtitle=service_request.reference, source_url='/facility?tab=service-requests', all_day=False)

        if can(Module.COMPANION):
            from companion.models import Task
            tasks = scope_model_queryset(Task, request, organization).filter(due_at__isnull=False)
            if not is_admin:
                tasks = tasks.filter(Q(assignee=request.user) | Q(assigned_by=request.user))
            for task in tasks.select_related('property', 'assignee'):
                add(key=f'task:{task.pk}', title=task.title, start=task.due_at,
                    event_type='task', module='companion', property_record=task.property, status=task.status,
                    priority=task.priority, subtitle=f'{task.reference} · {task.assignee.get_username()}', source_url='/companion', all_day=False)

        events.sort(key=lambda event: (event['starts_at'], event['title']))
        return Response({'results': events, 'count': len(events), 'start': starts_on, 'end': ends_on})


class TicketsFeedView(APIView):
    """Role-aware, cross-cutting tickets and operational issues feed assembled from active modules.
    
    Tickets are a cross-cutting feature available to all authenticated organization members,
    not a module-specific feature. Users will see tickets from modules they have access to.
    """

    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def get(self, request):
        organization = get_active_organization(request)
        membership = get_active_membership(request, organization)
        is_admin = getattr(request.user, 'is_superuser', False) or (membership and membership.is_organization_admin)
        if not membership and not is_admin:
            return Response({'detail': 'An active organization membership is required.'}, status=403)
        if membership:
            membership = Membership.objects.prefetch_related('roles__permissions').get(pk=membership.pk)
            permission_keys = {
                permission.key for role in membership.roles.all() for permission in role.permissions.all()
            }
        else:
            permission_keys = set()
        subscribed = set(organization.subscriptions.available().values_list('module', flat=True)) if organization else set()

        def can(module):
            return is_admin or (module in subscribed and any(key.startswith(f'{module}.') for key in permission_keys))

        active_property = get_active_property(request, organization)
        module_filter = str(request.query_params.get('module', '')).strip().lower()
        tickets = []

        def add(*, id, reference, title, description, priority, status, module, source_url,
                property_record=None, assigned_to=None, raised_by=None, created_at=None, updated_at=None):
            property_id = str(property_record.id) if property_record else None
            if active_property and property_id and property_id != str(active_property.id):
                return
            tickets.append({
                'id': str(id),
                'reference': reference or f'TICKET-{id}',
                'title': title or 'Untitled Ticket',
                'description': description or '',
                'priority': priority or 'normal',
                'status': status or 'open',
                'module': module,
                'source_url': source_url,
                'property': property_id,
                'property_name': property_record.name if property_record else '',
                'assigned_to': str(assigned_to) if assigned_to else '',
                'raised_by': str(raised_by) if raised_by else '',
                'created_at': created_at.isoformat() if created_at else None,
                'updated_at': updated_at.isoformat() if updated_at else None,
            })

        # Include companion tasks for all organization members (core feature, not module-gated)
        if organization:
            try:
                from companion.models import Task
                companion_tasks = scope_model_queryset(Task, request, organization).select_related('property', 'assignee', 'assigned_by').order_by('-updated_at')[:50]
                if not is_admin:
                    companion_tasks = companion_tasks.filter(Q(assignee=request.user) | Q(assigned_by=request.user))
                for task in companion_tasks:
                    add(
                        id=f'task:{task.pk}',
                        reference=task.reference,
                        title=task.title,
                        description=task.description,
                        priority=task.priority,
                        status=task.status,
                        module='companion',
                        source_url='/companion',
                        property_record=task.property,
                        assigned_to=task.assignee.get_username() if task.assignee else None,
                        raised_by=task.assigned_by.get_username() if task.assigned_by else None,
                        created_at=task.created_at,
                        updated_at=task.updated_at,
                    )
            except Exception:
                pass

        # Include module-specific tickets only if user has module access
        if can(Module.FACILITY) or can(Module.PROPERTY):
            from facilities.models import FacilityIncident, WorkOrder, ServiceRequest
            from companion.models import TeamFeedbackThread
            # Respect actual thread.module verbatim — don't hard-code 'facility'
            feedback_threads = scope_model_queryset(TeamFeedbackThread, request, organization).select_related(
                'property', 'assigned_to', 'created_by'
            ).order_by('-updated_at')[:100]
            for thread in feedback_threads:
                first_message = thread.messages.order_by('created_at').values_list('message', flat=True).first()
                thread_module = thread.module or 'facility'
                add(
                    id=f'feedback:{thread.pk}',
                    reference=thread.ticket_no or thread.reference,
                    title=thread.title,
                    description=first_message or '',
                    priority=thread.priority,
                    status=thread.status,
                    module=thread_module,
                    source_url=f'/companion?tab=feedback&thread={thread.pk}',
                    property_record=thread.property,
                    assigned_to=thread.assigned_to.get_username() if thread.assigned_to else thread.assigned_team,
                    raised_by=thread.requester_name or (thread.created_by.get_username() if thread.created_by else None),
                    created_at=thread.created_at,
                    updated_at=thread.updated_at,
                )
            for order in scope_model_queryset(WorkOrder, request, organization).select_related('property', 'assigned_to', 'reported_by').order_by('-reported_at')[:50]:
                add(
                    id=f'work-order:{order.pk}',
                    reference=order.number,
                    title=order.title,
                    description=order.description,
                    priority=order.priority,
                    status=order.status,
                    module='facility',
                    source_url='/facility?tab=work-orders',
                    property_record=order.property,
                    assigned_to=order.assigned_to.get_username() if order.assigned_to else None,
                    raised_by=order.reported_by.get_username() if order.reported_by else None,
                    created_at=order.reported_at,
                    updated_at=getattr(order, 'updated_at', order.reported_at),
                )
            for req in scope_model_queryset(ServiceRequest, request, organization).select_related('property', 'tenant', 'work_order__assigned_to').order_by('-submitted_at')[:50]:
                add(
                    id=f'service-request:{req.pk}',
                    reference=req.reference,
                    title=req.subject,
                    description=req.description,
                    priority=req.priority,
                    status=req.status,
                    module='facility',
                    source_url='/facility?tab=service-requests',
                    property_record=req.property,
                    assigned_to=req.work_order.assigned_to.get_username() if req.work_order and req.work_order.assigned_to else None,
                    raised_by=req.tenant.name if req.tenant else None,
                    created_at=req.submitted_at,
                    updated_at=getattr(req, 'updated_at', req.submitted_at),
                )
            for incident in scope_model_queryset(FacilityIncident, request, organization).select_related('property', 'reported_by', 'reviewed_by').exclude(status__in=(FacilityIncident.Status.RESOLVED, FacilityIncident.Status.CLOSED)).order_by('-occurred_at')[:30]:
                add(
                    id=f'incident:{incident.pk}',
                    reference=incident.reference,
                    title=f'{incident.category} — {incident.location}',
                    description=incident.narrative[:200] if incident.narrative else '',
                    priority=incident.severity,
                    status=incident.status,
                    module='facility',
                    source_url='/facility?tab=incidents',
                    property_record=incident.property,
                    assigned_to=incident.reviewed_by.get_username() if incident.reviewed_by else None,
                    raised_by=incident.reported_by.get_username() if incident.reported_by else None,
                    created_at=incident.occurred_at,
                    updated_at=getattr(incident, 'updated_at', incident.occurred_at),
                )

        if can(Module.MONITORING):
            try:
                from construction.models import Ticket as ConstructionTicket
                for ticket in scope_model_queryset(ConstructionTicket, request, organization).select_related('project__property', 'assigned_to', 'raised_by').order_by('-updated_at')[:50]:
                    add(
                        id=f'site-ticket:{ticket.pk}',
                        reference=ticket.reference,
                        title=ticket.title,
                        description=ticket.body,
                        priority=ticket.priority,
                        status=ticket.status,
                        module='monitoring',
                        source_url='/monitoring?tab=tickets',
                        property_record=getattr(ticket.project, 'property', None),
                        assigned_to=ticket.assigned_to.get_username() if ticket.assigned_to else None,
                        raised_by=ticket.raised_by.get_username() if ticket.raised_by else None,
                        created_at=ticket.created_at,
                        updated_at=ticket.updated_at,
                    )
            except Exception:
                pass

        # Apply module filter if requested
        if module_filter:
            # Map construction → monitoring alias
            if module_filter == 'construction':
                module_filter = 'monitoring'
            tickets = [t for t in tickets if t.get('module') == module_filter]

        tickets.sort(key=lambda t: t.get('updated_at') or t.get('created_at') or '', reverse=True)
        return Response({'results': tickets, 'count': len(tickets)})


def _set_token_cookie(response, name, value, max_age, path):
    response.set_cookie(
        name, value, max_age=max_age, httponly=True, secure=not settings.DEBUG,
        samesite='Lax', path=path, domain=settings.JWT_COOKIE_DOMAIN,
    )


def _issue_session_cookies(response, user):
    refresh = RefreshToken.for_user(user)
    _set_token_cookie(response, settings.JWT_ACCESS_COOKIE, str(refresh.access_token), 15 * 60, '/api/v1/')
    _set_token_cookie(response, settings.JWT_REFRESH_COOKIE, str(refresh), 7 * 24 * 60 * 60, '/api/v1/auth/')
    return response


def _can_switch_demo_identity(user, organization=None):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    if organization is None:
        return False
    membership = Membership.objects.active().filter(user=user, organization=organization).first()
    return bool(membership and membership.is_organization_admin)


def _is_demo_identity(user):
    if not user:
        return False
    if user.is_superuser or user.username == 'admin':
        return True
    return user.username.startswith('role-')


def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
    except Exception:
        return JsonResponse({'status': 'unavailable', 'service': 'center-estates-erp', 'database': 'down'}, status=503)
    return JsonResponse({'status': 'ok', 'service': 'center-estates-erp', 'database': 'ok'})


@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({'csrfToken': get_token(request)})


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    """Cookie-based JWT login. CSRF-exempt: protected by CORS + rate-limiting.
    Authenticated endpoints are still CSRF-protected via CookieJWTAuthentication."""
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'login'

    @extend_schema(
        request=TokenObtainPairSerializer,
        responses={200: {'type': 'object'}, 401: {'type': 'object'}},
    )
    def post(self, request):
        serializer = TokenObtainPairSerializer(data=request.data)
        try:
            valid = serializer.is_valid()
        except Exception:
            # simplejwt's TokenObtainPairSerializer raises AuthenticationFailed
            # on bad credentials inside is_valid(); map it to a clean 401.
            return Response({'detail': 'Incorrect username or password.'}, status=401)
        if not valid:
            return Response({'detail': 'Unable to sign in. Please check your credentials.'}, status=401)
        response = Response({'detail': 'Signed in.'})
        _set_token_cookie(response, settings.JWT_ACCESS_COOKIE, serializer.validated_data['access'], 15 * 60, '/api/v1/')
        _set_token_cookie(response, settings.JWT_REFRESH_COOKIE, serializer.validated_data['refresh'], 7 * 24 * 60 * 60, '/api/v1/auth/')
        return response


class MobileTokenSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["client_kind"] = "mobile"
        return token


class MobileTokenView(APIView):
    """Bearer-token login for the offline Expo construction client."""
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'login'

    @extend_schema(
        request=MobileTokenSerializer,
        responses={200: MobileTokenSerializer},
    )
    def post(self, request):
        serializer = MobileTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response({
            "access": serializer.validated_data["access"],
            "refresh": serializer.validated_data["refresh"],
            "client_kind": "mobile",
        })


@method_decorator(csrf_protect, name='dispatch')
class RefreshView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'token_refresh'

    @extend_schema(
        request=TokenRefreshSerializer,
        responses={200: {'type': 'object'}},
    )
    def post(self, request):
        serializer = TokenRefreshSerializer(data={'refresh': request.COOKIES.get(settings.JWT_REFRESH_COOKIE)})
        serializer.is_valid(raise_exception=True)
        response = Response({'detail': 'Token refreshed.'})
        _set_token_cookie(response, settings.JWT_ACCESS_COOKIE, serializer.validated_data['access'], 15 * 60, '/api/v1/')
        if 'refresh' in serializer.validated_data:
            _set_token_cookie(response, settings.JWT_REFRESH_COOKIE, serializer.validated_data['refresh'], 7 * 24 * 60 * 60, '/api/v1/auth/')
        return response


class LogoutView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        response = Response(status=204)
        cookie_domain = getattr(settings, 'SESSION_COOKIE_DOMAIN', None)
        cookie_names = (
            getattr(settings, 'JWT_ACCESS_COOKIE', 'ce_access'),
            getattr(settings, 'JWT_REFRESH_COOKIE', 'ce_refresh'),
            IMPERSONATOR_COOKIE,
            'sessionid',
            'csrftoken',
        )
        for path in ('/api/v1/', '/api/v1/auth/', '/'):
            for name in cookie_names:
                response.delete_cookie(name, path=path)
                if cookie_domain:
                    response.delete_cookie(name, path=path, domain=cookie_domain)
                response.delete_cookie(name, path=path, domain='.centerestates.com')
        return response


class MeView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: {'type': 'object'}})
    def get(self, request):
        memberships = Membership.objects.active().filter(user=request.user).select_related('organization')
        organization = get_active_organization(request, required=False)
        membership = memberships.filter(organization=organization).prefetch_related('roles__permissions').first() if organization else None
        permissions = [] if not membership else (
            ['*'] if membership.is_organization_admin or request.user.is_superuser else list(
                membership.roles.values_list('permissions__key', flat=True).distinct().order_by('permissions__key')
            )
        )
        if request.user.is_superuser and '*' not in permissions:
            permissions = ['*']
        impersonator_id = request.COOKIES.get(IMPERSONATOR_COOKIE)
        impersonating = bool(impersonator_id and str(impersonator_id) != str(request.user.pk))
        role_names = [] if not membership else list(membership.roles.values_list('name', flat=True).order_by('name'))
        return Response({
            'user': {
                'id': request.user.pk,
                'username': request.user.get_username(),
                'email': request.user.email,
                'firstName': request.user.first_name,
                'lastName': request.user.last_name,
                'isSuperuser': request.user.is_superuser,
            },
            'organizations': MembershipSerializer(memberships, many=True).data,
            'activeOrganizationId': str(organization.id) if organization else None,
            'modules': serialize_modules(organization, membership) if organization else [],
            'roles': [] if not membership else list(membership.roles.values_list('slug', flat=True).order_by('slug')),
            'roleNames': role_names,
            'permissions': permissions,
            'impersonating': impersonating,
            'canSwitchIdentity': _can_switch_demo_identity(request.user, organization) or impersonating,
        })

    @extend_schema(request=OpenApiTypes.OBJECT, responses={200: {'type': 'object'}})
    def patch(self, request):
        user = request.user
        first_name = request.data.get('firstName')
        last_name = request.data.get('lastName')
        email = request.data.get('email')

        updated_fields = []
        if first_name is not None:
            user.first_name = str(first_name).strip()
            updated_fields.append('first_name')
        if last_name is not None:
            user.last_name = str(last_name).strip()
            updated_fields.append('last_name')
        if email is not None:
            clean_email = str(email).strip().lower()
            if clean_email and get_user_model().objects.filter(email=clean_email).exclude(pk=user.pk).exists():
                return Response({'email': 'This email address is already in use by another user.'}, status=400)
            user.email = clean_email
            updated_fields.append('email')

        if updated_fields:
            user.save(update_fields=updated_fields)
        return self.get(request)


@method_decorator(csrf_protect, name='dispatch')
class DemoIdentitiesView(APIView):
    """List seeded demo users for in-demo role switching (superuser / org admin only)."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: {'type': 'object'}})
    def get(self, request):
        organization = get_active_organization(request, required=False)
        if not organization:
            return Response({'identities': [], 'groups': []})
        # While impersonating, still allow the original admin to list identities.
        actor = request.user
        impersonator_id = request.COOKIES.get(IMPERSONATOR_COOKIE)
        if impersonator_id:
            actor = get_user_model().objects.filter(pk=impersonator_id).first() or request.user
        if not _can_switch_demo_identity(actor, organization) and not actor.is_superuser:
            return Response({'detail': 'Demo identity switching is limited to platform administrators.'}, status=403)

        memberships = (
            Membership.objects.active()
            .filter(organization=organization)
            .select_related('user')
            .prefetch_related('roles')
            .order_by('user__username')
        )
        identities = []
        for membership in memberships:
            user = membership.user
            if not _is_demo_identity(user) and not membership.is_organization_admin:
                continue
            # Keep the client-facing identity switcher concise. Specialist
            # seeded users remain valid for automated acceptance tests and
            # existing bookmarks, but are configured as permission presets
            # rather than presented as separate day-to-day roles.
            if user.username not in VISIBLE_DEMO_IDENTITIES and not membership.is_organization_admin and not user.is_superuser:
                continue
            roles = list(membership.roles.all())
            primary = roles[0] if roles else None
            module = primary.permissions.first().module if primary and primary.permissions.exists() else 'platform'
            if membership.is_organization_admin or user.is_superuser:
                module = 'platform'
            identities.append({
                'id': user.pk,
                'username': user.username,
                'label': (
                    f'{user.first_name} {user.last_name}'.strip()
                    or (primary.name if primary else user.username)
                ),
                'roleSlug': primary.slug if primary else ('platform-admin' if membership.is_organization_admin else ''),
                'roleName': (
                    'Super Administrator' if user.is_superuser
                    else (primary.name if primary else 'Organization administrator')
                ),
                'module': module,
                'isAdmin': bool(membership.is_organization_admin or user.is_superuser),
                'isCurrent': user.pk == request.user.pk,
            })
        module_order = ['platform', 'property', 'facility', 'companion', 'sales', 'tender', 'valuation', 'monitoring']
        groups = []
        for module in module_order:
            items = [item for item in identities if item['module'] == module]
            if items:
                groups.append({'module': module, 'label': module.replace('-', ' ').title(), 'identities': items})
        extras = [item for item in identities if item['module'] not in module_order]
        if extras:
            groups.append({'module': 'other', 'label': 'Other', 'identities': extras})
        return Response({'identities': identities, 'groups': groups})


@method_decorator(csrf_protect, name='dispatch')
class ImpersonateView(APIView):
    """Switch the browser session to a seeded demo identity for product demos."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: {'type': 'object'}, 400: {'type': 'object'}})
    def post(self, request):
        organization = get_active_organization(request, required=False)
        username = str(request.data.get('username') or '').strip()
        if not username:
            return Response({'detail': 'username is required.'}, status=400)

        # Resolve the acting admin (original user if already impersonating).
        impersonator_id = request.COOKIES.get(IMPERSONATOR_COOKIE)
        actor = request.user
        if impersonator_id:
            actor = get_user_model().objects.filter(pk=impersonator_id).first() or request.user
        if not _can_switch_demo_identity(actor, organization) and not actor.is_superuser:
            return Response({'detail': 'Only platform or organization administrators can switch demo identities.'}, status=403)

        target = get_user_model().objects.filter(username=username).first()
        if not target or not target.is_active:
            return Response({'detail': 'Demo identity not found.'}, status=404)
        if not Membership.objects.active().filter(user=target, organization=organization).exists() and not target.is_superuser:
            return Response({'detail': 'Demo identity is not a member of the active organization.'}, status=400)
        if not _is_demo_identity(target) and not target.is_superuser:
            return Response({'detail': 'Only seeded demo identities can be selected.'}, status=400)

        response = Response({
            'detail': f'Switched to {target.username}.',
            'username': target.username,
        })
        _issue_session_cookies(response, target)
        # Preserve the original admin so demos can return without re-entering the password.
        original_id = impersonator_id or str(actor.pk)
        if str(target.pk) == str(original_id):
            response.delete_cookie(IMPERSONATOR_COOKIE, path='/api/v1/', domain='.centerestates.com')
        else:
            _set_token_cookie(response, IMPERSONATOR_COOKIE, str(original_id), 7 * 24 * 60 * 60, '/api/v1/')
        return response


@method_decorator(csrf_protect, name='dispatch')
class StopImpersonateView(APIView):
    """Return from a demo identity to the original administrator session."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: {'type': 'object'}, 400: {'type': 'object'}})
    def post(self, request):
        impersonator_id = request.COOKIES.get(IMPERSONATOR_COOKIE)
        if not impersonator_id:
            return Response({'detail': 'Not currently impersonating a demo identity.'}, status=400)
        actor = get_user_model().objects.filter(pk=impersonator_id).first()
        if not actor or not actor.is_active:
            response = Response({'detail': 'Original administrator session expired. Sign in again.'}, status=400)
            response.delete_cookie(IMPERSONATOR_COOKIE, path='/api/v1/', domain='.centerestates.com')
            return response
        response = Response({'detail': f'Returned to {actor.username}.', 'username': actor.username})
        _issue_session_cookies(response, actor)
        response.delete_cookie(IMPERSONATOR_COOKIE, path='/api/v1/', domain='.centerestates.com')
        return response


class WorkspaceInboxView(APIView):
    """Cross-module attention queue for the command center."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: {'type': 'object'}})
    def get(self, request):
        from decimal import Decimal

        from django.db.models import Sum

        from construction.models import Risk, Ticket
        from core.models import Module
        from facilities.models import WorkOrder
        from properties.models import Invoice
        from sales.models import SalePayment
        from tenders.models import Tender
        from valuations.models import ValuationInstruction

        organization = get_active_organization(request, required=False)
        if not organization:
            return Response({'alerts': [], 'tasks': [], 'summary': {}})

        membership = (
            Membership.objects.active()
            .filter(user=request.user, organization=organization)
            .prefetch_related('roles__permissions')
            .first()
        )
        modules = {item['slug'] for item in serialize_modules(organization, membership)}
        alerts = []
        tasks = []

        if Module.PROPERTY in modules:
            outstanding = (
                Invoice.objects.for_organization(organization)
                .exclude(status__in=(Invoice.Status.PAID, Invoice.Status.VOID))
                .aggregate(total=Sum('balance'))['total']
                or Decimal('0')
            )
            overdue = Invoice.objects.for_organization(organization).filter(status=Invoice.Status.OVERDUE).count()
            if outstanding > 0:
                alerts.append({
                    'module': 'property',
                    'severity': 'high',
                    'title': f'Outstanding rent {outstanding}',
                    'detail': f'{overdue} overdue invoices',
                    'href': '/property',
                })
            tasks.append({
                'module': 'property',
                'title': 'Review rent collection & arrears',
                'href': '/property',
                'priority': 2 if outstanding else 5,
            })

        if Module.FACILITY in modules:
            open_orders = WorkOrder.objects.for_organization(organization).exclude(
                status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED),
            ).count()
            if open_orders:
                alerts.append({
                    'module': 'facility',
                    'severity': 'medium',
                    'title': f'{open_orders} open work orders',
                    'detail': 'Facility maintenance queue',
                    'href': '/facility',
                })
            tasks.append({
                'module': 'facility',
                'title': 'Check open work orders & PM due',
                'href': '/facility',
                'priority': 2 if open_orders else 5,
            })

        if Module.MONITORING in modules:
            open_tickets = Ticket.objects.filter(organization=organization).exclude(
                status__in=('resolved', 'closed'),
            ).count()
            high_risks = Risk.objects.filter(
                organization=organization, likelihood__gte=4, impact__gte=4,
            ).exclude(status='closed').count()
            if open_tickets or high_risks:
                alerts.append({
                    'module': 'monitoring',
                    'severity': 'high',
                    'title': f'{open_tickets} issues · {high_risks} high risks',
                    'detail': 'Construction monitoring',
                    'href': '/monitoring',
                })
            tasks.append({
                'module': 'monitoring',
                'title': 'Monitor site risks and drawdowns',
                'href': '/monitoring',
                'priority': 1 if high_risks else 3,
            })

        if Module.SALES in modules:
            pending = SalePayment.objects.for_organization(organization).filter(
                status=SalePayment.Status.PENDING,
            ).count()
            if pending:
                alerts.append({
                    'module': 'sales',
                    'severity': 'medium',
                    'title': f'{pending} payments awaiting verification',
                    'detail': 'Sales collections',
                    'href': '/sales',
                })
            tasks.append({
                'module': 'sales',
                'title': 'Verify buyer payments',
                'href': '/sales',
                'priority': 2 if pending else 5,
            })

        if Module.TENDER in modules:
            active = Tender.objects.for_organization(organization).exclude(
                stage__in=(Tender.Stage.AWARDED, Tender.Stage.REGRETTED, Tender.Stage.SUBMITTED),
            ).count()
            if active:
                alerts.append({
                    'module': 'tender',
                    'severity': 'low',
                    'title': f'{active} active tenders in pipeline',
                    'detail': 'Tender management',
                    'href': '/tender',
                })
            tasks.append({
                'module': 'tender',
                'title': 'Review tender pipeline',
                'href': '/tender',
                'priority': 3,
            })

        if Module.VALUATION in modules:
            active_jobs = ValuationInstruction.objects.for_organization(organization).exclude(
                status__in=(
                    ValuationInstruction.Status.DELIVERED,
                    ValuationInstruction.Status.CANCELLED,
                    ValuationInstruction.Status.FINAL,
                ),
            ).count()
            tasks.append({
                'module': 'valuation',
                'title': f'Review {active_jobs} open valuation instruction(s)',
                'href': '/valuation',
                'priority': 3 if active_jobs else 6,
            })

        tasks = sorted(tasks, key=lambda item: item['priority'])[:8]
        return Response({
            'alerts': alerts,
            'tasks': tasks,
            'summary': {
                'alertCount': len(alerts),
                'taskCount': len(tasks),
                'modules': sorted(modules),
            },
        })


class WorkspacePulseView(APIView):
    """Small portfolio KPIs for every entitled command-center module.

    Keeping this aggregation behind one authenticated request avoids a burst
    of seven parallel WSGI requests on constrained cPanel runtimes.
    """

    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: {'type': 'object'}})
    def get(self, request):
        from decimal import Decimal

        from django.db.models import Count, Q, Sum
        from django.utils import timezone

        from companion.models import Task
        from construction.models import Disbursement, Project, Risk, Ticket
        from core.models import Module
        from facilities.models import FacilityAsset, PreventiveSchedule, WorkOrder
        from properties.models import Invoice, Property, Tenant, Unit
        from sales.models import PropertySale, SaleListing, SalePayment
        from tenders.models import Tender
        from valuations.models import ValuationInstruction, ValuationInvoice

        organization = get_active_organization(request, required=False)
        if not organization:
            return Response({'pulse': {}})
        membership = get_active_membership(request, organization)
        entitled = {item['slug'] for item in serialize_modules(organization, membership)}
        pulse = {}

        if Module.PROPERTY in entitled:
            unit_totals = Unit.objects.for_organization(organization).aggregate(
                total=Count('id'), occupied=Count('id', filter=Q(status=Unit.Status.OCCUPIED)),
            )
            outstanding = Invoice.objects.for_organization(organization).exclude(
                status__in=(Invoice.Status.PAID, Invoice.Status.VOID),
            ).aggregate(total=Sum('balance'))['total'] or Decimal('0')
            pulse['property'] = {
                'properties': Property.objects.for_organization(organization).count(),
                'outstanding': outstanding,
                'occupancy': round(unit_totals['occupied'] / unit_totals['total'] * 100, 1) if unit_totals['total'] else 0,
                'tenants': Tenant.objects.for_organization(organization).filter(status=Tenant.Status.ACTIVE).count(),
            }

        if Module.FACILITY in entitled:
            now = timezone.localdate()
            work_orders = WorkOrder.objects.for_organization(organization)
            schedules = PreventiveSchedule.objects.for_organization(organization).filter(is_active=True)
            schedule_totals = schedules.aggregate(
                total=Count('id'), overdue=Count('id', filter=Q(next_due_on__lte=now)),
            )
            pulse['facility'] = {
                'openWorkOrders': work_orders.exclude(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED)).count(),
                'compliance': round((schedule_totals['total'] - schedule_totals['overdue']) / schedule_totals['total'] * 100, 1) if schedule_totals['total'] else 100,
                'assets': FacilityAsset.objects.for_organization(organization).filter(is_active=True).count(),
            }

        if Module.SALES in entitled:
            listings = SaleListing.objects.for_organization(organization)
            pulse['sales'] = {
                'availableUnits': listings.filter(status=SaleListing.Status.AVAILABLE).count(),
                'salesValue': PropertySale.objects.for_organization(organization).exclude(
                    status=PropertySale.Status.CANCELLED,
                ).aggregate(total=Sum('agreed_price'))['total'] or Decimal('0'),
                'pendingPayments': SalePayment.objects.for_organization(organization).filter(status=SalePayment.Status.PENDING).count(),
            }

        if Module.MONITORING in entitled:
            projects = Project.objects.filter(organization=organization, archived=False)
            total_budget = projects.aggregate(value=Sum('budget'))['value'] or Decimal('0')
            spent = Disbursement.objects.filter(
                organization=organization, status='paid',
            ).aggregate(value=Sum('amount'))['value'] or Decimal('0')
            pulse['monitoring'] = {
                'activeProjects': projects.filter(stage='active').count(),
                'openTickets': Ticket.objects.filter(organization=organization).exclude(status__in=('closed', 'resolved')).count(),
                'highRisks': Risk.objects.filter(organization=organization, likelihood__gte=4, impact__gte=4).exclude(status='closed').count(),
                'budgetUtilization': round(float(spent / total_budget * 100), 1) if total_budget else 0,
            }

        if Module.TENDER in entitled:
            tenders = Tender.objects.for_organization(organization)
            active = tenders.exclude(stage__in=(Tender.Stage.AWARDED, Tender.Stage.REGRETTED))
            pulse['tender'] = {
                'activeTenders': active.count(),
                'pipelineValue': active.aggregate(value=Sum('estimated_value'))['value'] or Decimal('0'),
            }

        if Module.VALUATION in entitled:
            active = ValuationInstruction.objects.for_organization(organization).exclude(
                status__in=(ValuationInstruction.Status.DELIVERED, ValuationInstruction.Status.CANCELLED),
            )
            outstanding = ValuationInvoice.objects.for_organization(organization).exclude(
                status__in=(ValuationInvoice.Status.PAID, ValuationInvoice.Status.VOID),
            ).aggregate(value=Sum('balance'))['value'] or Decimal('0')
            pulse['valuation'] = {'activeInstructions': active.count(), 'outstanding': outstanding}

        if Module.COMPANION in entitled:
            active = Task.objects.for_organization(organization).filter(assignee=request.user).exclude(
                status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED),
            )
            now = timezone.now()
            totals = active.aggregate(
                dueToday=Count('id', filter=Q(due_at__date=now.date())),
                overdue=Count('id', filter=Q(due_at__lt=now)),
                escalated=Count('id', filter=Q(escalated=True)),
            )
            pulse['companion'] = totals

        return Response({'pulse': pulse})


@extend_schema(request=None, responses={200: {'type': 'object'}})
@api_view(['GET'])
@permission_classes([IsAdminUser])
def security_audit(request):
    return Response({
        'debug': settings.DEBUG,
        'secure_ssl_redirect': getattr(settings, 'SECURE_SSL_REDIRECT', False),
        'session_cookie_secure': settings.SESSION_COOKIE_SECURE,
        'csrf_cookie_secure': settings.CSRF_COOKIE_SECURE,
        'hsts_seconds': getattr(settings, 'SECURE_HSTS_SECONDS', None),
        'cors_origins': getattr(settings, 'CORS_ALLOWED_ORIGINS', []),
        'allowed_hosts': settings.ALLOWED_HOSTS,
        'password_validators': [v['NAME'] for v in settings.AUTH_PASSWORD_VALIDATORS],
    })


@method_decorator(csrf_exempt, name='dispatch')
class RegisterView(APIView):
    """Self-service account registration. CSRF-exempt: protected by CORS + rate-limiting."""
    authentication_classes = ()
    permission_classes = (AllowAny,)

    @extend_schema(request=None, responses={201: {'type': 'object'}, 400: {'type': 'object'}})
    def post(self, request):
        User = get_user_model()
        data = request.data
        username = str(data.get('username', '')).strip()
        email = str(data.get('email', '')).strip()
        password = str(data.get('password', ''))
        first_name = str(data.get('first_name', '')).strip()
        last_name = str(data.get('last_name', '')).strip()
        organization_name = str(data.get('organization_name', '')).strip()

        errors = {}
        if not email:
            errors['email'] = ['This field is required.']
        elif User.objects.filter(email=email).exists():
            errors['email'] = ['A user with that email already exists.']
        if not password:
            errors['password'] = ['This field is required.']
        if errors:
            return Response(errors, status=400)

        # The public sign-up form only collects an email address; derive a
        # unique username from it when the client doesn't send one explicitly.
        if not username:
            base = re.sub(r'[^a-zA-Z0-9._-]+', '', email.split('@')[0]).lower()[:60] or 'user'
            candidate = base
            counter = 1
            while User.objects.filter(username=candidate).exists():
                candidate = f'{base}-{counter}'
                counter += 1
            username = candidate
        elif User.objects.filter(username=username).exists():
            errors['username'] = ['A user with that username already exists.']
            return Response(errors, status=400)

        # Validate password strength
        try:
            validate_password(password)
        except DjangoValidationError as exc:
            return Response({'password': list(exc.messages)}, status=400)

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            is_active=True,
        )

        from organizations.models import Membership, Organization, Role

        if organization_name:
            # Registrant explicitly asked for their own organisation: create it
            # and link them as admin.
            try:
                slug = re.sub(r'[^a-z0-9]+', '-', organization_name.lower()).strip('-')[:50]
                base_slug = slug
                counter = 1
                while Organization.objects.filter(slug=slug).exists():
                    slug = f'{base_slug}-{counter}'
                    counter += 1
                org = Organization.objects.create(name=organization_name, slug=slug)
                Membership.objects.create(user=user, organization=org, is_organization_admin=True, is_default=True)
            except Exception:
                pass  # Organisation creation is optional, don't fail registration
        else:
            # Default onboarding: join the Center Estates organisation as a
            # property manager so new users land in a usable workspace.
            try:
                org = Organization.objects.filter(slug='center-estates-demo').first()
                if org is None:
                    org = Organization.objects.filter(name='Center Estates Demo', is_active=True).first()
                if org is None:
                    org = Organization.objects.filter(is_active=True).order_by('created_at').first()
                if org is None:
                    org = Organization.objects.create(name='Center Estates Demo', slug='center-estates-demo', is_active=True)
                membership, membership_created = Membership.objects.get_or_create(
                    user=user,
                    organization=org,
                    defaults={'is_default': True},
                )
                if membership_created and not Membership.objects.filter(user=user, is_default=True).exists():
                    membership.is_default = True
                    membership.save()
                role = Role.objects.filter(organization=org, slug='property-manager').first()
                if role is not None:
                    membership.roles.add(role)
            except Exception:
                pass  # Default organisation assignment is best-effort

        return Response({
            'detail': 'Account created successfully. You can now sign in.',
            'username': user.username,
        }, status=201)


@method_decorator(csrf_exempt, name='dispatch')
class PasswordResetRequestView(APIView):
    """Initiate a password reset. Always returns 200 to prevent email enumeration.
    CSRF-exempt: no authenticated state; protected by CORS + rate-limiting."""
    authentication_classes = ()
    permission_classes = (AllowAny,)

    @extend_schema(request=None, responses={200: {'type': 'object'}})
    def post(self, request):
        email = str(request.data.get('email', '')).strip()
        if email:
            User = get_user_model()
            user = User.objects.filter(email=email, is_active=True).first()
            if user:
                # In production, send a reset email here.
                # For now we log the intent but always return a neutral response.
                import logging
                logging.getLogger(__name__).info('Password reset requested for %s', email)
        return Response({'detail': 'If an account with that email exists, you will receive a reset link shortly.'})


@method_decorator(csrf_exempt, name='dispatch')
class ClientErrorView(APIView):
    """Receive client-side error reports from the frontend.
    CSRF-exempt: called from global error handlers before any session exists."""
    authentication_classes = ()
    permission_classes = (AllowAny,)

    @extend_schema(request=None, responses={202: {'type': 'object'}})
    def post(self, request):
        import hashlib
        import logging
        logger = logging.getLogger('client-errors')
        data = request.data
        message = str(data.get('message', ''))[:500]
        stack = str(data.get('stack', ''))[:2000]
        component_stack = str(data.get('componentStack', ''))[:2000]
        url = str(data.get('url', ''))[:500]
        release = str(data.get('release', ''))[:50]
        extra = data.get('extra', {}) if isinstance(data.get('extra', {}), dict) else {}
        organization = None
        organization_id = str(data.get('organizationId', ''))[:64]
        if organization_id:
            from organizations.models import Organization
            organization = Organization.objects.filter(id=organization_id).first()
        fingerprint = hashlib.sha256(
            f'{release}|{message}|{url}|{component_stack[:500]}'.encode('utf-8')
        ).hexdigest()
        now = timezone.now()
        try:
            event, created = ClientErrorEvent.objects.get_or_create(
                organization=organization,
                fingerprint=fingerprint,
                defaults={
                    'message': message or 'Client error',
                    'stack': stack,
                    'component_stack': component_stack,
                    'url': url,
                    'release': release,
                    'extra': extra,
                    'first_seen_at': now,
                    'last_seen_at': now,
                },
            )
            if not created:
                ClientErrorEvent.objects.filter(pk=event.pk).update(
                    occurrences=F('occurrences') + 1,
                    last_seen_at=now,
                    stack=stack or F('stack'),
                    component_stack=component_stack or F('component_stack'),
                    extra=extra or F('extra'),
                )
        except Exception:
            logger.exception('Unable to persist client error event')
        logger.warning('CLIENT ERROR [%s] %s | url=%s | extra=%s', release, message, url, extra)
        if stack:
            logger.debug('Stack: %s', stack[:500])
        return Response({'detail': 'Error logged.'}, status=202)


class ClientErrorHealthView(APIView):
    """Organisation administrators can triage current browser failures."""

    permission_classes = (IsAuthenticated,)

    def _organization_for_admin(self, request):
        organization = get_active_organization(request)
        membership = get_active_membership(request, organization)
        if not (request.user.is_superuser or (membership and membership.is_organization_admin)):
            return None
        return organization

    @extend_schema(request=None, responses={200: {'type': 'object'}})
    def get(self, request):
        organization = self._organization_for_admin(request)
        if not organization:
            return Response({'detail': 'Organisation administrator access is required.'}, status=403)
        all_events = ClientErrorEvent.objects.filter(organization=organization)
        events = all_events
        status_filter = request.query_params.get('status')
        if status_filter in ClientErrorEvent.Status.values:
            events = events.filter(status=status_filter)
        try:
            limit = int(request.query_params.get('limit', 50))
        except (TypeError, ValueError):
            limit = 50
        limit = min(max(limit, 1), 100)
        rows = list(events[:limit])
        return Response({
            # Keep the headline useful even when the table is filtered to a
            # resolved or ignored state.
            'open_count': all_events.filter(status=ClientErrorEvent.Status.OPEN).count(),
            'results': [{
                'id': str(event.id), 'message': event.message, 'url': event.url,
                'release': event.release, 'occurrences': event.occurrences,
                'first_seen_at': event.first_seen_at, 'last_seen_at': event.last_seen_at,
                'status': event.status, 'extra': event.extra,
            } for event in rows],
        })

    @extend_schema(request=None, responses={200: {'type': 'object'}})
    def patch(self, request):
        organization = self._organization_for_admin(request)
        if not organization:
            return Response({'detail': 'Organisation administrator access is required.'}, status=403)
        event_id = str(request.data.get('id', ''))
        status = request.data.get('status')
        if status not in (ClientErrorEvent.Status.RESOLVED, ClientErrorEvent.Status.IGNORED):
            return Response({'detail': 'Status must be resolved or ignored.'}, status=400)
        event = ClientErrorEvent.objects.filter(id=event_id, organization=organization).first()
        if not event:
            return Response({'detail': 'Error event was not found.'}, status=404)
        event.status = status
        event.save(update_fields=('status', 'updated_at'))
        return Response({'id': str(event.id), 'status': event.status})
