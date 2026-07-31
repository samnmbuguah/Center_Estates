from rest_framework import serializers

from core.models import Module
from organizations.models import Membership
from subscriptions.models import Subscription


class MembershipSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='organization.id')
    name = serializers.CharField(source='organization.name')
    slug = serializers.CharField(source='organization.slug')
    is_admin = serializers.BooleanField(source='is_organization_admin')

    class Meta:
        model = Membership
        fields = ('id', 'name', 'slug', 'is_default', 'is_admin')


def serialize_modules(organization):
    subscriptions = Subscription.objects.available().filter(organization=organization)
    by_key = dict(Module.choices)
    return [
        {'slug': subscription.module, 'name': by_key[subscription.module], 'limits': subscription.limits}
        for subscription in subscriptions.order_by('module')
    ]
