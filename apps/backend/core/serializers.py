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
    if not organization:
        return []

    # Ensure default core subscriptions exist for the organization
    existing_modules = set(organization.subscriptions.values_list('module', flat=True))
    for mod_choice, _ in Module.choices:
        if mod_choice not in existing_modules:
            Subscription.objects.get_or_create(
                organization=organization,
                module=mod_choice,
                defaults={'is_active': True, 'status': Subscription.Status.ACTIVE}
            )

    subscriptions = Subscription.objects.available().filter(organization=organization)
    is_superuser = bool(membership and getattr(membership.user, 'is_superuser', False))
    by_key = dict(Module.choices)

    if is_superuser:
        subscription_limits = {
            item.module: item.limits
            for item in subscriptions
        }
        return [
            {'slug': module, 'name': by_key.get(module, module), 'limits': subscription_limits.get(module, {})}
            for module, _label in Module.choices
        ]

    if membership and not membership.is_organization_admin:
        # Collect allowed modules from permissions and roles
        allowed_modules = set(
            membership.roles.values_list('permissions__module', flat=True).distinct()
        )
        for role in membership.roles.all():
            role_slug = getattr(role, 'slug', '')
            if 'valuation' in role_slug:
                allowed_modules.add(Module.VALUATION)
            elif 'facility' in role_slug or 'caretaker' in role_slug:
                allowed_modules.add(Module.FACILITY)
            elif 'property' in role_slug or 'leasing' in role_slug or 'finance' in role_slug:
                allowed_modules.add(Module.PROPERTY)
            elif 'sales' in role_slug:
                allowed_modules.add(Module.SALES)
            elif 'tender' in role_slug:
                allowed_modules.add(Module.TENDER)
            elif 'construction' in role_slug or 'monitoring' in role_slug:
                allowed_modules.add(Module.MONITORING)

        subscriptions = subscriptions.filter(module__in=allowed_modules)

    # Start with subscribed modules
    modules = [
        {'slug': subscription.module, 'name': by_key.get(subscription.module, subscription.module), 'limits': subscription.limits}
        for subscription in subscriptions.order_by('module')
    ]

    # Add universal modules (companion) that should be accessible to all users
    existing_slugs = {m['slug'] for m in modules}
    if Module.COMPANION not in existing_slugs:
        modules.append({
            'slug': Module.COMPANION,
            'name': by_key.get(Module.COMPANION, 'Companion'),
            'limits': {}
        })

    return modules
