from django.utils.text import slugify
from rest_framework import serializers

from .models import Permission, Role


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ("key", "label", "module", "description")


class RoleSerializer(serializers.ModelSerializer):
    permission_keys = serializers.SlugRelatedField(
        source="permissions",
        slug_field="key",
        queryset=Permission.objects.all(),
        many=True,
        required=False,
    )
    assigned_users = serializers.IntegerField(source="memberships.count", read_only=True)

    class Meta:
        model = Role
        fields = (
            "id", "name", "slug", "description", "is_system",
            "permission_keys", "assigned_users",
        )
        read_only_fields = ("id", "slug", "is_system", "assigned_users")

    def create(self, validated_data):
        permissions = validated_data.pop("permissions", [])
        organization = self.context["organization"]
        base_slug = slugify(validated_data["name"])[:70] or "custom-role"
        slug = base_slug
        suffix = 2
        while Role.objects.filter(organization=organization, slug=slug).exists():
            slug = f"{base_slug[:74]}-{suffix}"
            suffix += 1
        role = Role.objects.create(
            organization=organization,
            slug=slug,
            is_system=False,
            **validated_data,
        )
        role.permissions.set(permissions)
        return role

    def update(self, instance, validated_data):
        permissions = validated_data.pop("permissions", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if permissions is not None:
            instance.permissions.set(permissions)
        return instance
