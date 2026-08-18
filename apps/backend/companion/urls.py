from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CompanionDashboardViewSet,
    PerformanceViewSet,
    StaffHrRequestViewSet,
    StaffLeaveRequestViewSet,
    TaskTemplateViewSet,
    TaskViewSet,
    TeamFeedbackThreadViewSet,
    PublicFeedbackQrCodeViewSet, public_feedback,
    TelemetryViewSet,
)

router = DefaultRouter()
router.register('dashboard', CompanionDashboardViewSet, basename='companion-dashboard')
router.register('tasks', TaskViewSet, basename='companion-task')
router.register('templates', TaskTemplateViewSet)
router.register('feedback', TeamFeedbackThreadViewSet, basename='companion-feedback')
router.register('feedback-qr-codes', PublicFeedbackQrCodeViewSet, basename='feedback-qr-code')
router.register('performance', PerformanceViewSet, basename='companion-performance')
router.register('telemetry', TelemetryViewSet, basename='companion-telemetry')
router.register('leave', StaffLeaveRequestViewSet, basename='companion-leave')
router.register('hr-requests', StaffHrRequestViewSet, basename='companion-hr-requests')

urlpatterns = [path('public-feedback/<str:token>/', public_feedback, name='public-feedback')] + router.urls
