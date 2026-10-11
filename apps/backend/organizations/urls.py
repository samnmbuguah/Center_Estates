from django.urls import path

from .views import (
    MemberDetailView,
    MemberListCreateView,
    PermissionListView,
    RoleDetailView,
    RoleListCreateView,
    CurrentUserProfileView,
    SuperAdminOrganizationProvisionView,
)

urlpatterns = [
    path("provision/", SuperAdminOrganizationProvisionView.as_view(), name="organization-provision"),
    path("permissions/", PermissionListView.as_view(), name="permission-list"),
    path("roles/", RoleListCreateView.as_view(), name="role-list-create"),
    path("roles/<uuid:role_id>/", RoleDetailView.as_view(), name="role-detail"),
    path("members/", MemberListCreateView.as_view(), name="member-list-create"),
    path("members/me/", CurrentUserProfileView.as_view(), name="current-user-profile"),
    path("members/<uuid:member_id>/", MemberDetailView.as_view(), name="member-detail"),
]
