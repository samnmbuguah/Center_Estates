import csv
from drf_spectacular.utils import OpenApiTypes, extend_schema, extend_schema_view
import uuid

from django.db import transaction
from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django.http import HttpResponse
from django.utils import timezone
import calendar
from decimal import Decimal
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet

from core.models import Module
from core.permissions import HasModuleActionPermission
from core.serializers import GenericObjectSerializer
from core.tenancy import get_active_organization
from core.property_scope import scope_model_queryset, scope_queryset_to_property
from properties.models import Building, Property
from notifications.models import Notification
from notifications.services import notify_permission, notify_user

from .models import (
    Contractor, FacilityAsset, Inspection, MeterReading, MeterReconciliation, MeterResetEvent, PreventiveSchedule,
    ServiceRequest, UtilityMeter, WorkOrder, WorkOrderAttachment,
    WorkOrderCostItem, WorkOrderEvent,
)
from .serializers import (
    ContractorSerializer, FacilityAssetSerializer, InspectionSerializer,
    MeterReadingSerializer, MeterReconciliationSerializer, MeterResetEventSerializer, PreventiveScheduleSerializer,
    ServiceRequestSerializer, UtilityMeterSerializer,
    WorkOrderAttachmentSerializer, WorkOrderCostItemSerializer,
    WorkOrderEventSerializer, WorkOrderSerializer,
)


class FacilityModelViewSet(ModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.FACILITY
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
        status = self.request.query_params.get('status')
        if status and any(field.name == 'status' for field in queryset.model._meta.fields):
            queryset = queryset.filter(status=status)
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


class AssetViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = FacilityAsset.objects.select_related('property', 'building', 'unit')
    serializer_class = FacilityAssetSerializer
    search_fields = ('code', 'name', 'category', 'serial_number', 'property__name')


class ContractorViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = Contractor.objects.all()
    serializer_class = ContractorSerializer
    search_fields = ('code', 'name', 'specialty', 'contact_name')


class WorkOrderViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    permission_map = {'transition': 'facility.work'}
    queryset = WorkOrder.objects.select_related('property', 'asset', 'contractor', 'assigned_to')
    serializer_class = WorkOrderSerializer
    search_fields = ('number', 'title', 'category', 'property__name', 'asset__name')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        work_order = serializer.save(organization=organization, reported_by=self.request.user)
        WorkOrderEvent.objects.create(
            organization=organization, work_order=work_order, event_type='created',
            to_status=work_order.status, notes='Work order created', actor=self.request.user,
        )

    def perform_update(self, serializer):
        if 'status' in serializer.validated_data and serializer.validated_data['status'] != self.get_object().status:
            raise ValidationError({'status': 'Use the transition action so the status change is audited.'})
        super().perform_update(serializer)

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def transition(self, request, pk=None):
        organization = get_active_organization(request)
        scoped_pk = self.get_queryset().filter(pk=pk).values_list('pk', flat=True).first()
        work_order = WorkOrder.objects.select_for_update().filter(pk=scoped_pk).first() if scoped_pk else None
        if not work_order:
            return Response({'detail': 'Work order not found.'}, status=404)
        target = str(request.data.get('status', '')).strip()
        transitions = {
            WorkOrder.Status.OPEN: {WorkOrder.Status.ASSIGNED, WorkOrder.Status.CANCELLED},
            WorkOrder.Status.ASSIGNED: {WorkOrder.Status.IN_PROGRESS, WorkOrder.Status.ON_HOLD, WorkOrder.Status.CANCELLED},
            WorkOrder.Status.IN_PROGRESS: {WorkOrder.Status.ON_HOLD, WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED},
            WorkOrder.Status.ON_HOLD: {WorkOrder.Status.IN_PROGRESS, WorkOrder.Status.CANCELLED},
            WorkOrder.Status.COMPLETED: set(), WorkOrder.Status.CANCELLED: set(),
        }
        if target not in transitions[work_order.status]:
            raise ValidationError({'status': f'Cannot transition from {work_order.status} to {target or "blank"}.'})
        notes = str(request.data.get('notes', '')).strip()
        if target in (WorkOrder.Status.ON_HOLD, WorkOrder.Status.CANCELLED) and not notes:
            raise ValidationError({'notes': 'Notes are required when holding or cancelling work.'})
        previous = work_order.status
        work_order.status = target
        if target == WorkOrder.Status.IN_PROGRESS and work_order.progress == 0:
            work_order.progress = 1
        if target == WorkOrder.Status.COMPLETED:
            if not notes:
                raise ValidationError({'notes': 'Resolution notes are required to complete work.'})
            work_order.progress = 100
            work_order.completed_at = timezone.now()
            work_order.resolution_notes = notes
        work_order.save()
        WorkOrderEvent.objects.create(
            organization=organization, work_order=work_order, event_type='status_change',
            from_status=previous, to_status=target, notes=notes, actor=request.user,
        )
        return Response(WorkOrderSerializer(work_order).data)


class WorkOrderEventViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    queryset = WorkOrderEvent.objects.select_related('work_order', 'actor')
    serializer_class = WorkOrderEventSerializer
    http_method_names = ('get', 'head', 'options')
    search_fields = ('work_order__number', 'notes', 'event_type')


class WorkOrderCostItemViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    queryset = WorkOrderCostItem.objects.select_related('work_order', 'added_by')
    serializer_class = WorkOrderCostItemSerializer
    search_fields = ('work_order__number', 'description', 'supplier', 'reference')

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        item = serializer.save(organization=organization, added_by=self.request.user)
        totals = item.work_order.cost_items.values('kind').annotate(value=Sum('total'))
        by_kind = {row['kind']: row['value'] for row in totals}
        work_order = WorkOrder.objects.select_for_update().get(pk=item.work_order_id)
        work_order.labor_cost = by_kind.get(WorkOrderCostItem.Kind.LABOR, 0)
        work_order.parts_cost = by_kind.get(WorkOrderCostItem.Kind.PART, 0)
        work_order.other_cost = by_kind.get(WorkOrderCostItem.Kind.OTHER, 0)
        work_order.save(update_fields=('labor_cost', 'parts_cost', 'other_cost', 'updated_at'))
        WorkOrderEvent.objects.create(
            organization=organization, work_order=work_order, event_type='cost_added',
            notes=f'{item.description}: {item.total}', actor=self.request.user,
        )


class WorkOrderAttachmentViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    queryset = WorkOrderAttachment.objects.select_related('work_order', 'uploaded_by')
    serializer_class = WorkOrderAttachmentSerializer
    search_fields = ('work_order__number', 'file_name', 'caption')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        attachment = serializer.save(organization=organization, uploaded_by=self.request.user)
        WorkOrderEvent.objects.create(
            organization=organization, work_order=attachment.work_order,
            event_type='attachment_added', notes=attachment.file_name, actor=self.request.user,
        )


class PreventiveScheduleViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = PreventiveSchedule.objects.select_related('asset__property')
    serializer_class = PreventiveScheduleSerializer
    search_fields = ('code', 'name', 'asset__name')

    def perform_update(self, serializer):
        if {'last_completed_on', 'next_due_on'} & set(serializer.validated_data):
            raise ValidationError({'schedule': 'Use the complete action to advance recurrence dates.'})
        super().perform_update(serializer)

    @staticmethod
    def _next_due(current, frequency):
        months = {'monthly': 1, 'quarterly': 3, 'biannual': 6, 'annual': 12}
        if frequency == PreventiveSchedule.Frequency.WEEKLY:
            return current + timezone.timedelta(days=7)
        offset = months[frequency]; month_index = current.month - 1 + offset
        year, month = current.year + month_index // 12, month_index % 12 + 1
        return current.replace(year=year, month=month, day=min(current.day, calendar.monthrange(year, month)[1]))

    @action(detail=True, methods=('post',), url_path='complete')
    @transaction.atomic
    def complete_schedule(self, request, pk=None):
        schedule = PreventiveSchedule.objects.select_for_update().filter(pk=pk, organization=get_active_organization(request)).first()
        if not schedule or not schedule.is_active:
            raise ValidationError({'schedule': 'Only an active schedule can be completed.'})
        completed = timezone.localdate()
        schedule.last_completed_on = completed
        schedule.next_due_on = self._next_due(completed, schedule.frequency)
        schedule.save(update_fields=('last_completed_on', 'next_due_on', 'updated_at'))
        return Response(self.get_serializer(schedule).data)

    @action(detail=True, methods=('post',), url_path='generate-work-order')
    @transaction.atomic
    def generate_work_order(self, request, pk=None):
        schedule = self.get_object(); organization = get_active_organization(request)
        number = f'PM-{schedule.code}-{schedule.next_due_on:%Y%m%d}'
        work_order, created = WorkOrder.objects.get_or_create(
            organization=organization, number=number,
            defaults={
                'title': schedule.name, 'description': schedule.instructions,
                'category': 'preventive_maintenance', 'property': schedule.asset.property,
                'asset': schedule.asset, 'reported_by': request.user,
                'reported_at': timezone.now(), 'scheduled_for': timezone.make_aware(timezone.datetime.combine(schedule.next_due_on, timezone.datetime.min.time())),
            },
        )
        if created:
            WorkOrderEvent.objects.create(organization=organization, work_order=work_order, event_type='generated', to_status=work_order.status, notes=f'Generated from {schedule.code}', actor=request.user)
        return Response(WorkOrderSerializer(work_order).data, status=201 if created else 200)


class InspectionViewSet(FacilityModelViewSet):
    write_permission = 'facility.inspect'
    queryset = Inspection.objects.select_related('property', 'asset', 'inspector')
    serializer_class = InspectionSerializer
    search_fields = ('reference', 'title', 'inspection_type', 'property__name')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), inspector=self.request.user)

    def perform_update(self, serializer):
        raise ValidationError({'inspection': 'Use the complete action to preserve inspection evidence.'})

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def complete(self, request, pk=None):
        inspection = Inspection.objects.select_for_update().filter(pk=pk, organization=get_active_organization(request)).first()
        if not inspection or inspection.status not in (Inspection.Status.SCHEDULED, Inspection.Status.IN_PROGRESS):
            raise ValidationError({'status': 'Only an open inspection can be completed.'})
        findings = str(request.data.get('findings', '')).strip()
        try: score = Decimal(str(request.data.get('score', ''))); violations = int(request.data.get('violations', 0))
        except Exception: raise ValidationError({'score': 'Enter a valid score and violation count.'})
        if score < 0 or score > 100 or violations < 0: raise ValidationError({'score': 'Score must be 0-100 and violations cannot be negative.'})
        if violations and not findings: raise ValidationError({'findings': 'Findings are required when violations are recorded.'})
        inspection.score = score; inspection.violations = violations; inspection.findings = findings
        inspection.completed_on = timezone.localdate(); inspection.status = Inspection.Status.FAILED if violations or score < 70 else Inspection.Status.PASSED
        if inspection.status == Inspection.Status.FAILED and request.data.get('create_work_order', True):
            work_order = WorkOrder.objects.create(
                organization=inspection.organization, number=f'INS-{inspection.reference}', title=f'Corrective action: {inspection.title}',
                description=findings, category='inspection_finding', property=inspection.property, asset=inspection.asset,
                priority=WorkOrder.Priority.HIGH if violations else WorkOrder.Priority.MEDIUM,
                reported_by=request.user, reported_at=timezone.now(),
            )
            WorkOrderEvent.objects.create(organization=inspection.organization, work_order=work_order, event_type='inspection_finding', to_status=work_order.status, notes=findings, actor=request.user)
            inspection.follow_up_work_order = work_order; inspection.status = Inspection.Status.FOLLOW_UP
        inspection.save()
        return Response(self.get_serializer(inspection).data)


class ServiceRequestViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    permission_map = {
        'approve': 'facility.approve', 'reject': 'facility.approve',
        'convert': 'facility.work', 'resolve': 'facility.work',
    }
    queryset = ServiceRequest.objects.select_related('property', 'unit', 'tenant', 'work_order')
    serializer_class = ServiceRequestSerializer
    search_fields = ('reference', 'subject', 'category', 'property__name', 'tenant__name')

    def perform_create(self, serializer):
        serializer.save(
            organization=self._validate_organization(serializer),
            status=ServiceRequest.Status.NEW,
            submitted_at=timezone.now(),
            decision_notes='',
        )

    def perform_update(self, serializer):
        if 'status' in serializer.validated_data: raise ValidationError({'status': 'Use the transition action.'})
        super().perform_update(serializer)

    def _locked_scoped_request(self, pk):
        """Lock a request after the tenant/property-scoped query authorizes it.

        Property scoping uses DISTINCT, which PostgreSQL cannot combine with
        SELECT FOR UPDATE. Resolve the authorized primary key first, then lock
        the base row inside the caller's transaction.
        """
        scoped_pk = self.get_queryset().filter(pk=pk).values_list('pk', flat=True).first()
        if not scoped_pk:
            return None
        return ServiceRequest.objects.select_for_update().filter(pk=scoped_pk).first()

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def approve(self, request, pk=None):
        service_request = self._locked_scoped_request(pk)
        if not service_request or service_request.status != ServiceRequest.Status.NEW:
            raise ValidationError({'status': 'Only a new service request can be approved.'})
        service_request.status = ServiceRequest.Status.APPROVED
        service_request.decision_notes = str(request.data.get('notes', '')).strip()
        service_request.decided_by = request.user
        service_request.decided_at = timezone.now()
        service_request.save(update_fields=('status', 'decision_notes', 'decided_by', 'decided_at', 'updated_at'))
        return Response(self.get_serializer(service_request).data)

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def reject(self, request, pk=None):
        service_request = self._locked_scoped_request(pk)
        notes = str(request.data.get('notes', '')).strip()
        if not service_request or service_request.status != ServiceRequest.Status.NEW:
            raise ValidationError({'status': 'Only a new service request can be rejected.'})
        if not notes:
            raise ValidationError({'notes': 'A rejection reason is required.'})
        service_request.status = ServiceRequest.Status.REJECTED
        service_request.decision_notes = notes
        service_request.decided_by = request.user
        service_request.decided_at = timezone.now()
        service_request.save(update_fields=('status', 'decision_notes', 'decided_by', 'decided_at', 'updated_at'))
        return Response(self.get_serializer(service_request).data)

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def convert(self, request, pk=None):
        service_request = self._locked_scoped_request(pk)
        if not service_request or service_request.work_order_id:
            raise ValidationError({'request': 'The service request is missing or already converted.'})
        if service_request.status != ServiceRequest.Status.APPROVED:
            raise ValidationError({'status': 'Approve the service request before creating a work order.'})
        work_order = WorkOrder.objects.create(
            organization=service_request.organization, number=f'SR-{service_request.reference}', title=service_request.subject,
            description=service_request.description, category=service_request.category, property=service_request.property,
            priority=service_request.priority, reported_by=request.user, reported_at=timezone.now(),
        )
        WorkOrderEvent.objects.create(organization=service_request.organization, work_order=work_order, event_type='service_request', to_status=work_order.status, notes=service_request.reference, actor=request.user)
        service_request.work_order = work_order; service_request.status = ServiceRequest.Status.ASSIGNED; service_request.save(update_fields=('work_order', 'status', 'updated_at'))
        return Response(self.get_serializer(service_request).data)

    @action(detail=True, methods=('post',))
    def resolve(self, request, pk=None):
        service_request = self.get_object()
        if service_request.status not in (ServiceRequest.Status.ASSIGNED, ServiceRequest.Status.IN_PROGRESS): raise ValidationError({'status': 'Only assigned or active requests can be resolved.'})
        if not service_request.work_order_id or service_request.work_order.status != WorkOrder.Status.COMPLETED:
            raise ValidationError({'work_order': 'Complete the linked work order before resolving the service request.'})
        score = request.data.get('satisfaction_score')
        if score is not None and (int(score) < 1 or int(score) > 5): raise ValidationError({'satisfaction_score': 'Score must be 1-5.'})
        service_request.status = ServiceRequest.Status.RESOLVED; service_request.resolved_at = timezone.now(); service_request.satisfaction_score = score
        service_request.save(update_fields=('status', 'resolved_at', 'satisfaction_score', 'updated_at'))
        return Response(self.get_serializer(service_request).data)


@extend_schema_view(list=extend_schema(request=None, responses=OpenApiTypes.OBJECT))
class FacilityPortalViewSet(ViewSet):
    """Occupant-facing facility portal scoped to the linked tenant profile.

    Unlike the staff ServiceRequestViewSet, this view only exposes the
    service requests of the tenant linked to the signed-in user and lets
    them submit new requests against their active lease property.
    """

    permission_classes = (HasModuleActionPermission,)
    required_module = Module.FACILITY
    permission_map = {'service_request': 'facility.view'}

    serializer_class = GenericObjectSerializer

    def _access(self):
        from properties.models import TenantPortalAccess

        organization = get_active_organization(self.request)
        access = TenantPortalAccess.objects.for_organization(organization).filter(
            user=self.request.user, is_active=True,
        ).select_related('tenant').first()
        if not access:
            raise PermissionDenied('No active occupant profile is linked to this account.')
        return access

    def _active_lease(self, access):
        from properties.models import Lease

        return Lease.objects.for_organization(access.organization).filter(
            tenant=access.tenant, status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING),
        ).select_related('unit__property').first()

    @extend_schema(request=None, responses={200: {"type": "object"}})
    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        access = self._access()
        requests = ServiceRequest.objects.for_organization(access.organization).filter(
            tenant=access.tenant,
        ).order_by('-submitted_at')[:12]
        lease = self._active_lease(access)
        return Response({
            'tenant': {
                'id': str(access.tenant.id), 'name': access.tenant.name,
                'code': access.tenant.code,
            },
            'property': {
                'id': str(lease.unit.property.id), 'name': lease.unit.property.name,
                'unit': lease.unit.code,
            } if lease else None,
            'serviceRequests': list(requests.values(
                'id', 'reference', 'subject', 'category', 'priority', 'status',
                'submitted_at', 'resolved_at',
            )),
        })

    @action(detail=False, methods=('post',), url_path='service-requests')
    def service_request(self, request):
        access = self._access()
        lease = self._active_lease(access)
        if not lease:
            raise ValidationError({'lease': 'An active lease is required to report a maintenance issue.'})
        subject = str(request.data.get('subject', '')).strip()
        category = str(request.data.get('category', '')).strip()
        if not subject or not category:
            raise ValidationError({'request': 'Subject and category are required.'})
        priority = str(request.data.get('priority', WorkOrder.Priority.MEDIUM))
        if priority not in WorkOrder.Priority.values:
            raise ValidationError({'priority': 'Select a valid priority.'})
        service_request = ServiceRequest.objects.create(
            organization=access.organization,
            reference=f'REQ-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}',
            subject=subject,
            description=str(request.data.get('description', '')).strip(),
            category=category, property=lease.unit.property, unit=lease.unit,
            tenant=access.tenant, priority=priority, status=ServiceRequest.Status.NEW,
            submitted_at=timezone.now(),
        )
        return Response(ServiceRequestSerializer(service_request).data, status=201)


class UtilityMeterViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = UtilityMeter.objects.select_related('property', 'property_unit').prefetch_related('readings')
    serializer_class = UtilityMeterSerializer
    search_fields = ('code', 'name', 'property__name')


class MeterReadingViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    queryset = MeterReading.objects.select_related('meter', 'meter__property_unit', 'reviewed_by')
    serializer_class = MeterReadingSerializer
    search_fields = ('meter__name', 'notes')

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer); meter = serializer.validated_data['meter']; value = serializer.validated_data['value']; read_at = serializer.validated_data['read_at']
        readings = MeterReading.objects.select_for_update().filter(organization=organization, meter=meter)
        previous = readings.filter(status=MeterReading.Status.APPROVED).order_by('-read_at').first()
        pending = readings.filter(status=MeterReading.Status.PENDING)
        if previous:
            pending = pending.filter(read_at__gt=previous.read_at)
        if pending.exists():
            raise ValidationError({'meter': 'Approve or reject the pending reading before recording another.'})
        if previous and read_at <= previous.read_at:
            raise ValidationError({'read_at': 'The reading date and time must be later than the previous reading.'})
        reset_events = meter.reset_events.filter(effective_at__lte=read_at)
        if previous:
            reset_events = reset_events.filter(effective_at__gt=previous.read_at)
        reset_event = reset_events.order_by('-effective_at').first()
        reverse_without_reset = bool(previous and value < previous.value and not reset_event)
        baseline = reset_event.reset_value if reset_event else previous.value if previous else Decimal(0)
        consumption = max(value - baseline, Decimal(0))
        anomaly = bool(previous and previous.consumption > 0 and consumption > previous.consumption * Decimal('1.5'))
        cost = (consumption * meter.tariff).quantize(Decimal('0.01'))
        serializer.save(
            organization=organization,
            recorded_by=self.request.user,
            previous_value=baseline, consumption=Decimal(0) if reverse_without_reset else consumption,
            cost=Decimal(0) if reverse_without_reset else cost,
            is_anomaly=reverse_without_reset or anomaly,
            status=MeterReading.Status.REJECTED if reverse_without_reset else MeterReading.Status.PENDING,
            review_notes='Reverse reading rejected; authorize a meter reset or replacement before billing.' if reverse_without_reset else '',
        )
        reading = serializer.instance
        if reading.status == MeterReading.Status.PENDING:
            notify_permission(
                organization=organization, permission_key='facility.approve',
                title=f'Meter reading awaiting approval · {meter.name}',
                message=f'{reading.value:g} {meter.unit} recorded for {meter.property.name}.',
                level=Notification.Level.WARNING, action_url='/facility?tab=meters',
                event_key=f'meter-reading-review:{reading.pk}', exclude_user=self.request.user,
                metadata={'meter_reading_id': str(reading.pk), 'property_id': str(meter.property_id)},
            )

    @action(detail=False, methods=('post',), url_path='ingest')
    @transaction.atomic
    def ingest(self, request):
        """Authenticated, idempotent endpoint for smart meters and approved imports.

        Electronic readings enter the same pending-review queue as field readings;
        ingestion never bypasses the manager approval boundary.
        """
        source_reference = str(request.data.get('source_reference', '')).strip()
        method = str(request.data.get('method', MeterReading.Method.IOT))
        if method not in (MeterReading.Method.IOT, MeterReading.Method.IMPORT):
            raise ValidationError({'method': 'Electronic ingestion accepts smart-meter or imported readings only.'})
        if not source_reference:
            raise ValidationError({'source_reference': 'A device event or import-row reference is required for idempotency.'})
        organization = get_active_organization(request)
        existing = MeterReading.objects.for_organization(organization).filter(
            method=method, source_reference=source_reference,
        ).first()
        if existing:
            return Response({**self.get_serializer(existing).data, 'duplicate': True})
        payload = request.data.copy()
        payload['method'] = method
        payload['source_reference'] = source_reference
        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response({**serializer.data, 'duplicate': False}, status=201)

    @action(detail=True, methods=('post',))
    def approve(self, request, pk=None):
        reading = self.get_object()
        if reading.status != MeterReading.Status.PENDING:
            raise ValidationError({'status': 'Only pending meter readings can be approved.'})
        reading.status = MeterReading.Status.APPROVED
        reading.reviewed_by = request.user
        reading.reviewed_at = timezone.now()
        reading.review_notes = str(request.data.get('notes', '')).strip()
        reading.save(update_fields=('status', 'reviewed_by', 'reviewed_at', 'review_notes', 'updated_at'))
        if reading.recorded_by:
            notify_user(
                organization=reading.organization, recipient=reading.recorded_by,
                title=f'Meter reading approved · {reading.meter.name}',
                message=f'The {reading.value:g} {reading.meter.unit} reading is approved for billing.',
                level=Notification.Level.SUCCESS, action_url='/caretaker-portal',
                event_key=f'meter-reading-approved:{reading.pk}', category='approval',
            )
        return Response(self.get_serializer(reading).data)

    @action(detail=True, methods=('post',))
    def reject(self, request, pk=None):
        reading = self.get_object()
        if reading.status != MeterReading.Status.PENDING:
            raise ValidationError({'status': 'Only pending meter readings can be rejected.'})
        notes = str(request.data.get('notes', '')).strip()
        if not notes:
            raise ValidationError({'notes': 'A rejection reason is required.'})
        reading.status = MeterReading.Status.REJECTED
        reading.reviewed_by = request.user
        reading.reviewed_at = timezone.now()
        reading.review_notes = notes
        reading.save(update_fields=('status', 'reviewed_by', 'reviewed_at', 'review_notes', 'updated_at'))
        if reading.recorded_by:
            notify_user(
                organization=reading.organization, recipient=reading.recorded_by,
                title=f'Meter reading rejected · {reading.meter.name}', message=notes,
                level=Notification.Level.URGENT, action_url='/caretaker-portal',
                event_key=f'meter-reading-rejected:{reading.pk}', category='approval',
            )
        return Response(self.get_serializer(reading).data)

    def perform_update(self, serializer): raise ValidationError({'reading': 'Meter readings are immutable.'})
    def perform_destroy(self, instance): raise ValidationError({'reading': 'Meter readings cannot be deleted.'})


class MeterResetEventViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = MeterResetEvent.objects.select_related('meter__property', 'authorized_by')
    serializer_class = MeterResetEventSerializer
    search_fields = ('meter__name', 'meter__code', 'reason')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), authorized_by=self.request.user)

    def perform_update(self, serializer):
        raise ValidationError({'reset': 'Authorized meter reset events are immutable.'})

    def perform_destroy(self, instance):
        raise ValidationError({'reset': 'Authorized meter reset events cannot be deleted.'})


class MeterReconciliationViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    permission_map = {'approve': 'facility.approve'}
    queryset = MeterReconciliation.objects.select_related('bulk_meter__property', 'reviewed_by')
    serializer_class = MeterReconciliationSerializer
    search_fields = ('bulk_meter__name', 'bulk_meter__property__name', 'review_notes')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        bulk = serializer.validated_data['bulk_consumption']
        checks = serializer.validated_data['check_consumption']
        variance = bulk - checks
        variance_percent = (variance / bulk * Decimal('100')).quantize(Decimal('0.001')) if bulk else Decimal('0')
        tolerance = serializer.validated_data.get('tolerance_percent', Decimal('5'))
        status = MeterReconciliation.Status.WITHIN_TOLERANCE if abs(variance_percent) <= tolerance else MeterReconciliation.Status.EXCEPTION
        serializer.save(organization=organization, variance=variance, variance_percent=variance_percent, status=status)

    @action(detail=True, methods=('post',))
    def approve(self, request, pk=None):
        record = self.get_object()
        if record.status == MeterReconciliation.Status.APPROVED:
            raise ValidationError({'status': 'This meter reconciliation is already approved.'})
        notes = str(request.data.get('notes', '')).strip()
        if record.status == MeterReconciliation.Status.EXCEPTION and not notes:
            raise ValidationError({'notes': 'An out-of-tolerance reconciliation requires review notes.'})
        record.status = MeterReconciliation.Status.APPROVED
        record.reviewed_by = request.user; record.reviewed_at = timezone.now(); record.review_notes = notes
        record.save()
        return Response(self.get_serializer(record).data)


class FacilityDashboardViewSet(ViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.FACILITY

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        organization = get_active_organization(request)
        now = timezone.now()
        assets = scope_model_queryset(FacilityAsset, request, organization)
        work_orders = scope_model_queryset(WorkOrder, request, organization)
        schedules = scope_model_queryset(PreventiveSchedule, request, organization)
        requests = scope_model_queryset(ServiceRequest, request, organization)
        readings = scope_model_queryset(MeterReading, request, organization)
        active_work = work_orders.exclude(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED))
        overdue = active_work.filter(resolution_due_at__lt=now)
        due_schedules = schedules.filter(is_active=True, next_due_on__lte=timezone.localdate())
        compliant = schedules.filter(is_active=True).count() - due_schedules.count()
        schedule_count = schedules.filter(is_active=True).count()
        return Response({
            'kpis': {
                'buildings': scope_model_queryset(Building, request, organization).count(),
                'activeAssets': assets.filter(is_active=True).count(),
                'assetValue': assets.aggregate(total=Sum('purchase_value'))['total'] or 0,
                'openWorkOrders': active_work.count(), 'overdueWorkOrders': overdue.count(),
                'maintenanceCompliance': round(compliant / schedule_count * 100, 1) if schedule_count else 100,
                'openRequests': requests.exclude(status__in=(ServiceRequest.Status.RESOLVED, ServiceRequest.Status.CLOSED)).count(),
                'utilityConsumption': readings.filter(read_at__year=now.year).aggregate(total=Sum('consumption'))['total'] or 0,
                'utilityCost': readings.filter(read_at__year=now.year).aggregate(total=Sum('cost'))['total'] or 0,
                'contractors': Contractor.objects.for_organization(organization).filter(status=Contractor.Status.ACTIVE).count(),
            },
            'recentWorkOrders': WorkOrderSerializer(work_orders[:6], many=True).data,
            'urgentWorkOrders': WorkOrderSerializer(active_work.filter(priority__in=(WorkOrder.Priority.HIGH, WorkOrder.Priority.CRITICAL))[:5], many=True).data,
            'requestSummary': list(requests.values('status').annotate(count=Count('id')).order_by('status')),
            'assetCategories': list(assets.values('category').annotate(count=Count('id')).order_by('-count')),
            'dueMaintenance': PreventiveScheduleSerializer(due_schedules[:5], many=True).data,
        })


@extend_schema_view(list=extend_schema(request=None, responses=OpenApiTypes.OBJECT))
class FacilityAnalyticsViewSet(ViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.FACILITY

    serializer_class = GenericObjectSerializer

    @extend_schema(request=None, responses={200: {"type": "object"}})
    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        organization = get_active_organization(request)
        assets = scope_model_queryset(FacilityAsset, request, organization)
        work_orders = scope_model_queryset(WorkOrder, request, organization)
        inspections = scope_model_queryset(Inspection, request, organization)
        contractors = Contractor.objects.for_organization(organization)
        readings = scope_model_queryset(MeterReading, request, organization)

        return Response({
            'summary': {
                'total_assets': assets.count(),
                'active_assets': assets.filter(is_active=True).count(),
                'total_work_orders': work_orders.count(),
                'completed_work_orders': work_orders.filter(status='completed').count(),
                'open_work_orders': work_orders.exclude(status__in=('completed', 'cancelled')).count(),
                'total_inspections': inspections.count(),
                'completed_inspections': inspections.filter(status='completed').count(),
                'total_contractors': contractors.count(),
                'active_contractors': contractors.filter(status='active').count(),
                'total_meter_readings': readings.count(),
                'total_consumption': float(readings.aggregate(total=Sum('consumption'))['total'] or 0),
                'total_utility_cost': float(readings.aggregate(total=Sum('cost'))['total'] or 0),
            },
            'work_orders_by_status': list(work_orders.values('status').annotate(count=Count('id')).order_by('status')),
            'work_orders_by_priority': list(work_orders.values('priority').annotate(count=Count('id')).order_by('priority')),
            'assets_by_category': list(assets.values('category').annotate(count=Count('id')).order_by('-count')[:10]),
            'inspections_by_month': [
                {'month': m['month'].isoformat(), 'count': m['count']}
                for m in (
                    inspections.filter(completed_on__isnull=False)
                    .annotate(month=TruncMonth('completed_on'))
                    .values('month').annotate(count=Count('id'))
                    .order_by('month')[:12]
                )
            ],
        })

    @action(detail=False, methods=('get',))
    def exports(self, request):
        organization = get_active_organization(request)
        export_type = request.query_params.get('type', '')

        if export_type == 'assets':
            rows = scope_model_queryset(FacilityAsset, request, organization).values_list('code', 'name', 'category', 'condition', 'is_active')
            header = ['Code', 'Name', 'Category', 'Condition', 'Active']
        elif export_type == 'work-orders':
            rows = scope_model_queryset(WorkOrder, request, organization).values_list('number', 'title', 'priority', 'status', 'reported_at')
            header = ['Number', 'Title', 'Priority', 'Status', 'Reported']
        elif export_type == 'inspections':
            rows = scope_model_queryset(Inspection, request, organization).values_list('reference', 'title', 'status', 'completed_on')
            header = ['Reference', 'Title', 'Status', 'Completed']
        elif export_type == 'contractors':
            rows = Contractor.objects.for_organization(organization).values_list('name', 'category', 'status', 'rating')
            header = ['Name', 'Category', 'Status', 'Rating']
        else:
            return Response({'error': 'Unknown export type. Use: assets, work-orders, inspections, contractors'}, status=400)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="facility-{export_type}.csv"'
        writer = csv.writer(response)
        writer.writerow(header)
        for row in rows:
            writer.writerow(row)
        return response
