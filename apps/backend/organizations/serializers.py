from django.contrib.auth import get_user_model
from django.utils.text import slugify
from rest_framework import serializers

from properties.models import Property

from .models import Membership, MembershipRole, Permission, Role

User = get_user_model()


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


class MemberSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source="user.pk", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    full_name = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()
    assigned_properties = serializers.SerializerMethodField()

    class Meta:
        model = Membership
        fields = (
            "id", "user_id", "username", "first_name", "last_name", "full_name",
            "email", "phone_number", "is_organization_admin", "status",
            "roles", "assigned_properties", "created_at",
        )

    def get_full_name(self, obj):
        name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return name or obj.user.username

    def get_roles(self, obj):
        return [
            {"id": str(r.id), "name": r.name, "slug": r.slug}
            for r in obj.roles.all()
        ]

    def get_assigned_properties(self, obj):
        return [
            {"id": str(p.id), "code": p.code, "name": p.name}
            for p in obj.assigned_properties.all()
        ]


class CreateMemberSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    phone_number = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, default="Pass1234!")
    is_organization_admin = serializers.BooleanField(default=False)
    role_ids = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)
    property_ids = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)

    def create(self, validated_data):
        organization = self.context["organization"]
        username = validated_data["username"].strip()
        email = validated_data.get("email", "").strip()
        first_name = validated_data.get("first_name", "").strip()
        last_name = validated_data.get("last_name", "").strip()
        phone_number = validated_data.get("phone_number", "").strip()
        password = validated_data.get("password") or "Pass1234!"
        is_admin = validated_data.get("is_organization_admin", False)
        role_ids = validated_data.get("role_ids", [])
        property_ids = validated_data.get("property_ids", [])

        user = User.objects.filter(username=username).first()
        if not user:
            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                password=password,
            )
        else:
            if first_name:
                user.first_name = first_name
            if last_name:
                user.last_name = last_name
            if email:
                user.email = email
            user.save()

        membership, created = Membership.objects.get_or_create(
            organization=organization,
            user=user,
            defaults={
                "is_organization_admin": is_admin,
                "phone_number": phone_number,
                "status": Membership.Status.ACTIVE,
            },
        )
        if not created:
            membership.is_organization_admin = is_admin
            if phone_number:
                membership.phone_number = phone_number
            membership.status = Membership.Status.ACTIVE
            membership.save()

        if role_ids:
            roles = Role.objects.filter(organization=organization, id__in=role_ids)
            for role in roles:
                MembershipRole.objects.get_or_create(membership=membership, role=role)

        if property_ids:
            properties = Property.objects.filter(organization=organization, id__in=property_ids)
            membership.assigned_properties.set(properties)

        return membership
