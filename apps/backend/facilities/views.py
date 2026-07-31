from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet

from core.models import Module
from core.permissions import HasModuleSubscription
from core.tenancy import get_active_organization
from properties.models import Building, Property

from .models import Contractor, FacilityAsset, Inspection, MeterReading, PreventiveSchedule, ServiceRequest, UtilityMeter, WorkOrder
from .serializers import ContractorSerializer, FacilityAssetSerializer, InspectionSerializer, MeterReadingSerializer, PreventiveScheduleSerializer, ServiceRequestSerializer, UtilityMeterSerializer, WorkOrderSerializer


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

    def perform_create(self, serializer):
        serializer.save(organization=get_active_organization(self.request))


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
        serializer.save(organization=get_active_organization(self.request), reported_by=self.request.user)


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
