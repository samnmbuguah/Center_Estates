from rest_framework.routers import DefaultRouter

from .views import (
    AssetViewSet, ContractorViewSet, FacilityAnalyticsViewSet, FacilityDashboardViewSet,
    InspectionViewSet, MeterReadingViewSet, PreventiveScheduleViewSet,
    ServiceRequestViewSet, UtilityMeterViewSet, WorkOrderAttachmentViewSet,
    WorkOrderCostItemViewSet, WorkOrderEventViewSet, WorkOrderViewSet,
)

router = DefaultRouter()
router.register('dashboard', FacilityDashboardViewSet, basename='facility-dashboard')
router.register('analytics', FacilityAnalyticsViewSet, basename='facility-analytics')
router.register('assets', AssetViewSet)
router.register('work-orders', WorkOrderViewSet)
router.register('planned-maintenance', PreventiveScheduleViewSet)
router.register('inspections', InspectionViewSet)
router.register('service-requests', ServiceRequestViewSet)
router.register('meters', UtilityMeterViewSet)
router.register('meter-readings', MeterReadingViewSet)
router.register('contractors', ContractorViewSet)
router.register('work-order-events', WorkOrderEventViewSet)
router.register('work-order-cost-items', WorkOrderCostItemViewSet)
router.register('work-order-attachments', WorkOrderAttachmentViewSet)

urlpatterns = router.urls
