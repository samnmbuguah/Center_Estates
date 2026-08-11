from rest_framework import serializers

from core.models import Module
from organizations.models import Membership
from subscriptions.models import Subscription


class GenericObjectSerializer(serializers.Serializer):
    """Free-form object payload for read-only dashboard/analytics endpoints."""
    pass


class MembershipSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='organization.id')
    name = serializers.CharField(source='organization.name')
    slug = serializers.CharField(source='organization.slug')
    is_admin = serializers.BooleanField(source='is_organization_admin')

    class Meta:
        model = Membership
        fields = ('id', 'name', 'slug', 'is_default', 'is_admin')


def serialize_modules(organization, membership=None):
    subscriptions = Subscription.objects.available().filter(organization=organization)
    if membership and not membership.is_organization_admin:
        allowed_modules = membership.roles.filter(
            permissions__key__endswith='.view'
        ).values_list('permissions__module', flat=True).distinct()
        subscriptions = subscriptions.filter(module__in=allowed_modules)
    by_key = dict(Module.choices)
    return [
        {'slug': subscription.module, 'name': by_key[subscription.module], 'limits': subscription.limits}
        for subscription in subscriptions.order_by('module')
    ]
