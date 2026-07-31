from rest_framework.routers import DefaultRouter

from .views import AssetViewSet, ContractorViewSet, FacilityDashboardViewSet, InspectionViewSet, MeterReadingViewSet, PreventiveScheduleViewSet, ServiceRequestViewSet, UtilityMeterViewSet, WorkOrderViewSet

router = DefaultRouter()
router.register('dashboard', FacilityDashboardViewSet, basename='facility-dashboard')
router.register('assets', AssetViewSet)
router.register('work-orders', WorkOrderViewSet)
router.register('planned-maintenance', PreventiveScheduleViewSet)
router.register('inspections', InspectionViewSet)
router.register('service-requests', ServiceRequestViewSet)
router.register('meters', UtilityMeterViewSet)
router.register('meter-readings', MeterReadingViewSet)
router.register('contractors', ContractorViewSet)

urlpatterns = router.urls
