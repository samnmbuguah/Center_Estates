from __future__ import annotations

from django.core.exceptions import PermissionDenied

from organizations.models import Membership, Organization


def get_active_organization(request, *, required: bool = True):
    """Resolve a user's active organization without trusting a raw header."""

    user = getattr(request, 'user', None)
    requested_id = getattr(request, 'requested_organization_id', None)
    cache_key = str(requested_id or 'default')
    cached = getattr(request, '_active_organization_cache', {}).get(cache_key)
    if cached is not None:
        return cached
    if not user or not user.is_authenticated:
        if required:
            raise PermissionDenied('Authentication is required to select an organization.')
        return None

    memberships = Membership.objects.active().filter(user=user).select_related('organization')
    if requested_id:
        if user.is_superuser:
            organization = Organization.objects.filter(id=requested_id, is_active=True).first()
            membership = memberships.filter(organization_id=requested_id).first()
        else:
            membership = memberships.filter(organization_id=requested_id).first()
            organization = membership.organization if membership else None
        if organization is None and required:
            raise PermissionDenied('You do not belong to the requested organization.')
        if organization is not None:
            request._active_organization_cache = {cache_key: organization}
            if membership is not None:
                request._active_membership_cache = {str(organization.pk): membership}
        return organization

    membership = memberships.order_by('-is_default', 'id').first()
    if membership:
        request._active_membership_cache = {str(membership.organization_id): membership}
        request._active_organization_cache = {cache_key: membership.organization}
        return membership.organization
    if required:
        raise PermissionDenied('No active organization membership is available.')
    return None


def get_active_membership(request, organization=None):
    """Return the authorized membership, cached only on this request object."""
    organization = organization or get_active_organization(request)
    key = str(organization.pk)
    cached = getattr(request, '_active_membership_cache', {}).get(key)
    if cached is not None:
        return cached
    membership = Membership.objects.active().filter(
        organization=organization, user=request.user,
    ).first()
    cache = getattr(request, '_active_membership_cache', {})
    cache[key] = membership
    request._active_membership_cache = cache
    return membership


def scope_to_request(queryset, request):
    return queryset.for_organization(get_active_organization(request))
