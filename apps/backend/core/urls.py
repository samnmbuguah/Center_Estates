from django.urls import path

from .views import (
    ChangePasswordView, ClientErrorHealthView, ClientErrorView, DemoIdentitiesView, GoogleLoginView, ImpersonateView, LoginView, LogoutView, MeView, MobileTokenView,
    PasswordResetRequestView, RefreshView, RegisterView, StopImpersonateView,
    CalendarFeedView, TestingAIAuditView, TestingAutoScanView, TestingChecklistView, TestingCIResultsView, TestingCIStatusView, TicketsFeedView, WorkspaceInboxView, WorkspacePulseView, csrf, health, security_audit,
)

urlpatterns = [
    path('health/', health, name='health'),
    path('auth/csrf/', csrf, name='csrf'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/google/', GoogleLoginView.as_view(), name='google-login'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('auth/mobile-token/', MobileTokenView.as_view(), name='mobile-token'),
    path('auth/refresh/', RefreshView.as_view(), name='refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/demo-identities/', DemoIdentitiesView.as_view(), name='demo-identities'),
    path('auth/impersonate/', ImpersonateView.as_view(), name='impersonate'),
    path('auth/stop-impersonate/', StopImpersonateView.as_view(), name='stop-impersonate'),
    path('workspace/inbox/', WorkspaceInboxView.as_view(), name='workspace-inbox'),
    path('workspace/pulse/', WorkspacePulseView.as_view(), name='workspace-pulse'),
    path('client-errors/', ClientErrorView.as_view(), name='client-errors'),
    path('client-errors/health/', ClientErrorHealthView.as_view(), name='client-errors-health'),
    path('calendar-feed/', CalendarFeedView.as_view(), name='calendar-feed'),
    path('tickets-feed/', TicketsFeedView.as_view(), name='tickets-feed'),
    path('testing/checklist/', TestingChecklistView.as_view(), name='testing-checklist'),
    path('testing/auto-scan/', TestingAutoScanView.as_view(), name='testing-auto-scan'),
    path('testing/ai-audit/', TestingAIAuditView.as_view(), name='testing-ai-audit'),
    path('testing/ci-status/', TestingCIStatusView.as_view(), name='testing-ci-status'),
    path('testing/ci-results/', TestingCIResultsView.as_view(), name='testing-ci-results'),
    path('testing/checklist/<str:feature_key>/', TestingChecklistView.as_view(), name='testing-checklist-detail'),
    path('security/audit/', security_audit, name='security-audit'),
]
