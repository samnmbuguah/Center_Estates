from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone
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


class InspectionViewSet(FacilityModelViewSet):
    queryset = Inspection.objects.select_related('property', 'asset', 'inspector')
    serializer_class = InspectionSerializer
    search_fields = ('reference', 'title', 'inspection_type', 'property__name')


class ServiceRequestViewSet(FacilityModelViewSet):
    queryset = ServiceRequest.objects.select_related('property', 'unit', 'tenant', 'work_order')
    serializer_class = ServiceRequestSerializer
    search_fields = ('reference', 'subject', 'category', 'property__name', 'tenant__name')


class UtilityMeterViewSet(FacilityModelViewSet):
    queryset = UtilityMeter.objects.select_related('property').prefetch_related('readings')
    serializer_class = UtilityMeterSerializer
    search_fields = ('code', 'name', 'property__name')


class MeterReadingViewSet(FacilityModelViewSet):
    queryset = MeterReading.objects.select_related('meter')
    serializer_class = MeterReadingSerializer
    search_fields = ('meter__name', 'notes')


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
