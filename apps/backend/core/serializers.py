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
    company_name = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    primary_color = serializers.SerializerMethodField()

    @staticmethod
    def _branding(obj):
        settings = obj.organization.settings or {}
        branding = settings.get('branding', {})
        return branding if isinstance(branding, dict) else {}

    def get_company_name(self, obj):
        return self._branding(obj).get('company_name') or obj.organization.name

    def get_logo_url(self, obj):
        return self._branding(obj).get('logo_url') or ''

    def get_primary_color(self, obj):
        return self._branding(obj).get('primary_color') or ''

    class Meta:
        model = Membership
        fields = (
            'id', 'name', 'slug', 'is_default', 'is_admin',
            'company_name', 'logo_url', 'primary_color',
        )


def serialize_modules(organization, membership=None):
    subscriptions = Subscription.objects.available().filter(organization=organization)
    if membership and not membership.is_organization_admin:
        allowed_modules = membership.roles.filter(
            permissions__key__endswith='.view'
        ).values_list('permissions__module', flat=True).distinct()
        subscriptions = subscriptions.filter(module__in=allowed_modules)
    by_key = dict(Module.choices)
    
    # Start with subscribed modules
    modules = [
        {'slug': subscription.module, 'name': by_key[subscription.module], 'limits': subscription.limits}
        for subscription in subscriptions.order_by('module')
    ]
    
    # Add universal modules (companion) that should be accessible to all users
    # Companion is a cross-cutting feature available to all organization members
    existing_slugs = {m['slug'] for m in modules}
    if Module.COMPANION not in existing_slugs:
        modules.append({
            'slug': Module.COMPANION,
            'name': by_key[Module.COMPANION],
            'limits': {}
        })
    
    return modules
