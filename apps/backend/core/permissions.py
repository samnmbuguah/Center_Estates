from rest_framework.permissions import BasePermission

from core.tenancy import get_active_organization
from organizations.models import Membership
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
        organization = get_active_organization(request)
        membership = Membership.objects.active().filter(
            organization=organization, user=request.user
        ).first()
        key = getattr(view, 'required_permission', self.permission_key)
        return bool(membership and key and membership.has_permission(key))
