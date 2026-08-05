from django.urls import path

from .views import (
    DemoIdentitiesView, ImpersonateView, LoginView, LogoutView, MeView, MobileTokenView,
    PasswordResetRequestView, RefreshView, RegisterView, StopImpersonateView,
    WorkspaceInboxView, csrf, health, security_audit,
)

urlpatterns = [
    path('health/', health, name='health'),
    path('auth/csrf/', csrf, name='csrf'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('auth/mobile-token/', MobileTokenView.as_view(), name='mobile-token'),
    path('auth/refresh/', RefreshView.as_view(), name='refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/demo-identities/', DemoIdentitiesView.as_view(), name='demo-identities'),
    path('auth/impersonate/', ImpersonateView.as_view(), name='impersonate'),
    path('auth/stop-impersonate/', StopImpersonateView.as_view(), name='stop-impersonate'),
    path('workspace/inbox/', WorkspaceInboxView.as_view(), name='workspace-inbox'),
    path('security/audit/', security_audit, name='security-audit'),
]
