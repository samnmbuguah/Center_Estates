from rest_framework.routers import DefaultRouter

from .views import CompanionDashboardViewSet, PerformanceViewSet, TaskTemplateViewSet, TaskViewSet, TelemetryViewSet

router = DefaultRouter()
router.register('dashboard', CompanionDashboardViewSet, basename='companion-dashboard')
router.register('tasks', TaskViewSet, basename='companion-task')
router.register('templates', TaskTemplateViewSet)
router.register('performance', PerformanceViewSet, basename='companion-performance')
router.register('telemetry', TelemetryViewSet, basename='companion-telemetry')

urlpatterns = router.urls
