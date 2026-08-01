from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone
import calendar
from decimal import Decimal
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet

from core.models import Module
from core.permissions import HasModuleSubscription
from core.tenancy import get_active_organization
from properties.models import Building, Property

from .models import (
    Contractor, FacilityAsset, Inspection, MeterReading, PreventiveSchedule,
    ServiceRequest, UtilityMeter, WorkOrder, WorkOrderAttachment,
    WorkOrderCostItem, WorkOrderEvent,
)
from .serializers import (
    ContractorSerializer, FacilityAssetSerializer, InspectionSerializer,
    MeterReadingSerializer, PreventiveScheduleSerializer,
    ServiceRequestSerializer, UtilityMeterSerializer,
    WorkOrderAttachmentSerializer, WorkOrderCostItemSerializer,
    WorkOrderEventSerializer, WorkOrderSerializer,
)


class FacilityModelViewSet(ModelViewSet):
    permission_classes = (HasModuleSubscription,)
    required_module = Module.FACILITY
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
    queryset = FacilityAsset.objects.select_related('property', 'building', 'unit')
    serializer_class = FacilityAssetSerializer
    search_fields = ('code', 'name', 'category', 'serial_number', 'property__name')


class ContractorViewSet(FacilityModelViewSet):
    queryset = Contractor.objects.all()
    serializer_class = ContractorSerializer
    search_fields = ('code', 'name', 'specialty', 'contact_name')


class WorkOrderViewSet(FacilityModelViewSet):
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
        work_order = WorkOrder.objects.select_for_update().filter(pk=pk, organization=organization).first()
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
    queryset = WorkOrderEvent.objects.select_related('work_order', 'actor')
    serializer_class = WorkOrderEventSerializer
    http_method_names = ('get', 'head', 'options')
    search_fields = ('work_order__number', 'notes', 'event_type')


class WorkOrderCostItemViewSet(FacilityModelViewSet):
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
    queryset = WorkOrderAttachment.objects.select_related('work_order', 'uploaded_by')
    serializer_class = WorkOrderAttachmentSerializer
    search_fields = ('work_order__number', 'file_name', 'caption')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), uploaded_by=self.request.user)


class PreventiveScheduleViewSet(FacilityModelViewSet):
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
    queryset = ServiceRequest.objects.select_related('property', 'unit', 'tenant', 'work_order')
    serializer_class = ServiceRequestSerializer
    search_fields = ('reference', 'subject', 'category', 'property__name', 'tenant__name')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), status=ServiceRequest.Status.NEW, submitted_at=timezone.now())

    def perform_update(self, serializer):
        if 'status' in serializer.validated_data: raise ValidationError({'status': 'Use the transition action.'})
        super().perform_update(serializer)

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def convert(self, request, pk=None):
        service_request = ServiceRequest.objects.select_for_update().filter(pk=pk, organization=get_active_organization(request)).first()
        if not service_request or service_request.work_order_id:
            raise ValidationError({'request': 'The service request is missing or already converted.'})
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
        score = request.data.get('satisfaction_score')
        if score is not None and (int(score) < 1 or int(score) > 5): raise ValidationError({'satisfaction_score': 'Score must be 1-5.'})
        service_request.status = ServiceRequest.Status.RESOLVED; service_request.resolved_at = timezone.now(); service_request.satisfaction_score = score
        service_request.save(update_fields=('status', 'resolved_at', 'satisfaction_score', 'updated_at'))
        return Response(self.get_serializer(service_request).data)


class UtilityMeterViewSet(FacilityModelViewSet):
    queryset = UtilityMeter.objects.select_related('property').prefetch_related('readings')
    serializer_class = UtilityMeterSerializer
    search_fields = ('code', 'name', 'property__name')


class MeterReadingViewSet(FacilityModelViewSet):
    queryset = MeterReading.objects.select_related('meter')
    serializer_class = MeterReadingSerializer
    search_fields = ('meter__name', 'notes')

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer); meter = serializer.validated_data['meter']; value = serializer.validated_data['value']
        previous = MeterReading.objects.select_for_update().filter(organization=organization, meter=meter).order_by('-read_at').first()
        if previous and value < previous.value: raise ValidationError({'value': 'Meter readings cannot move backwards.'})
        consumption = value - previous.value if previous else Decimal(0)
        anomaly = bool(previous and previous.consumption > 0 and consumption > previous.consumption * Decimal('1.5'))
        cost = (consumption * meter.tariff).quantize(Decimal('0.01'))
        serializer.save(organization=organization, consumption=consumption, cost=cost, is_anomaly=anomaly)

    def perform_update(self, serializer): raise ValidationError({'reading': 'Meter readings are immutable.'})
    def perform_destroy(self, instance): raise ValidationError({'reading': 'Meter readings cannot be deleted.'})


class FacilityDashboardViewSet(ViewSet):
    permission_classes = (HasModuleSubscription,)
    required_module = Module.FACILITY

    def list(self, request):
        organization = get_active_organization(request)
        now = timezone.now()
        assets = FacilityAsset.objects.for_organization(organization)
        work_orders = WorkOrder.objects.for_organization(organization)
        schedules = PreventiveSchedule.objects.for_organization(organization)
        requests = ServiceRequest.objects.for_organization(organization)
        readings = MeterReading.objects.for_organization(organization)
        active_work = work_orders.exclude(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED))
        overdue = active_work.filter(resolution_due_at__lt=now)
        due_schedules = schedules.filter(is_active=True, next_due_on__lte=timezone.localdate())
        compliant = schedules.filter(is_active=True).count() - due_schedules.count()
        schedule_count = schedules.filter(is_active=True).count()
        return Response({
            'kpis': {
                'buildings': Building.objects.for_organization(organization).count(),
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
