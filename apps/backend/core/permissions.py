from rest_framework.permissions import BasePermission
from rest_framework.permissions import SAFE_METHODS

from core.tenancy import get_active_membership, get_active_organization
from django.db.models import prefetch_related_objects
from subscriptions.models import Subscription


class HasOrganizationContext(BasePermission):
    message = 'An active organization membership is required.'

    def has_permission(self, request, view):
        return get_active_organization(request, required=False) is not None


class HasModuleSubscription(HasOrganizationContext):
    module = None
    message = 'The active organization is not subscribed to this module.'

    def has_permission(self, request, view):
        organization = get_active_organization(request, required=False)
        module = getattr(view, 'required_module', self.module)
        return bool(organization and module and Subscription.objects.available().filter(
            organization=organization, module=module
        ).exists())


class HasDomainPermission(HasModuleSubscription):
    permission_key = None
    message = 'Your role does not grant this action.'

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if getattr(request.user, 'is_superuser', False):
            return True
        organization = get_active_organization(request)
        membership = get_active_membership(request, organization)
        key = getattr(view, 'required_permission', self.permission_key)
        return bool(membership and key and membership.has_permission(key))


class HasModuleActionPermission(HasModuleSubscription):
    """Require a module role permission selected from the requested action.

    Organization administrators and superusers remain unrestricted. Other members must receive
    explicit ``<module>.view``, ``<module>.manage``, ``<module>.approve`` or
    ``<module>.report`` permission through an organization role.
    """

    approval_actions = {
        'approve', 'decide', 'verify', 'reject', 'reverse', 'void',
        'mark_paid', 'mark-paid', 'transition', 'deliver',
    }
    report_actions = {'export', 'exports', 'download'}

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if getattr(request.user, 'is_superuser', False):
            return True
        organization = get_active_organization(request)
        membership = get_active_membership(request, organization)
        if not membership:
            return False
        if membership.is_organization_admin:
            return True
        prefetch_related_objects([membership], 'roles__permissions')

        module = getattr(view, 'required_module', self.module)
        action = getattr(view, 'action', '') or ''
        permission_map = getattr(view, 'permission_map', {})
        resolver = getattr(view, 'get_action_permission', None)
        key = resolver(request, action) if resolver else permission_map.get(action)
        if not key:
            if request.method in SAFE_METHODS and action not in self.report_actions:
                suffix = 'view'
            elif action in self.approval_actions:
                suffix = 'approve'
            elif action in self.report_actions:
                suffix = 'report'
            else:
                key = getattr(view, 'write_permission', None)
                suffix = 'manage'
            if not key:
                key = f'{module}.{suffix}'
        return membership.has_permission(key)
