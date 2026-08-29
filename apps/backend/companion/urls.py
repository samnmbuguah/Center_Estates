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
    PublicFeedbackQrCodeViewSet, public_feedback, public_ticket_status, public_feedback_upload,
    IssueRoutingRuleViewSet,
    TelemetryViewSet,
    StreamingChatView,
    ActionExecutionView,
    DocumentExtractView,
    QmConversationViewSet,
    CompanionAnnouncementViewSet,
)

router = DefaultRouter()
router.register('dashboard', CompanionDashboardViewSet, basename='companion-dashboard')
router.register('tasks', TaskViewSet, basename='companion-task')
router.register('templates', TaskTemplateViewSet)
router.register('feedback', TeamFeedbackThreadViewSet, basename='companion-feedback')
router.register('feedback-qr-codes', PublicFeedbackQrCodeViewSet, basename='feedback-qr-code')
router.register('routing-rules', IssueRoutingRuleViewSet, basename='companion-routing-rule')
router.register('performance', PerformanceViewSet, basename='companion-performance')
router.register('telemetry', TelemetryViewSet, basename='companion-telemetry')
router.register('leave', StaffLeaveRequestViewSet, basename='companion-leave')
router.register('hr-requests', StaffHrRequestViewSet, basename='companion-hr-requests')
router.register('qm-conversations', QmConversationViewSet, basename='companion-qm-conversation')
router.register('announcements', CompanionAnnouncementViewSet, basename='companion-announcement')

urlpatterns = [
    path('chat/stream/', StreamingChatView.as_view(), name='companion-chat-stream'),
    path('actions/execute/', ActionExecutionView.as_view(), name='companion-action-execute'),
    path('extract-document/', DocumentExtractView.as_view(), name='companion-extract-document'),
    path('public-feedback/<str:token>/upload/', public_feedback_upload, name='public-feedback-upload'),
    path('public-feedback/<str:token>/', public_feedback, name='public-feedback'),
    path('public-ticket/<str:reference>/', public_ticket_status, name='public-ticket-status'),
] + router.urls
