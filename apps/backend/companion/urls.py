from rest_framework.routers import DefaultRouter

from .views import (
    CompanionDashboardViewSet,
    PerformanceViewSet,
    StaffHrRequestViewSet,
    StaffLeaveRequestViewSet,
    TaskTemplateViewSet,
    TaskViewSet,
    TeamFeedbackThreadViewSet,
    TelemetryViewSet,
)

router = DefaultRouter()
router.register('dashboard', CompanionDashboardViewSet, basename='companion-dashboard')
router.register('tasks', TaskViewSet, basename='companion-task')
router.register('templates', TaskTemplateViewSet)
router.register('feedback', TeamFeedbackThreadViewSet, basename='companion-feedback')
router.register('performance', PerformanceViewSet, basename='companion-performance')
router.register('telemetry', TelemetryViewSet, basename='companion-telemetry')
router.register('leave', StaffLeaveRequestViewSet, basename='companion-leave')
router.register('hr-requests', StaffHrRequestViewSet, basename='companion-hr-requests')

urlpatterns = router.urls
