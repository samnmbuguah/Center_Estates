from __future__ import annotations

from django.core.exceptions import PermissionDenied

from organizations.models import Membership, Organization


def get_active_organization(request, *, required: bool = True):
    """Resolve a user's active organization without trusting a raw header."""

    user = getattr(request, 'user', None)
    requested_id = getattr(request, 'requested_organization_id', None)
    if not user or not user.is_authenticated:
        if required:
            raise PermissionDenied('Authentication is required to select an organization.')
        return None

    memberships = Membership.objects.active().filter(user=user).select_related('organization')
    if requested_id:
        if user.is_superuser:
            organization = Organization.objects.filter(id=requested_id, is_active=True).first()
        else:
            membership = memberships.filter(organization_id=requested_id).first()
            organization = membership.organization if membership else None
        if organization is None and required:
            raise PermissionDenied('You do not belong to the requested organization.')
        return organization

    membership = memberships.filter(is_default=True).first() or memberships.first()
    if membership:
        return membership.organization
    if required:
        raise PermissionDenied('No active organization membership is available.')
    return None


def scope_to_request(queryset, request):
    return queryset.for_organization(get_active_organization(request))

