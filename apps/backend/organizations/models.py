from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from core.models import Module, TimeStampedModel


class Organization(TimeStampedModel):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=80, unique=True)
    is_active = models.BooleanField(default=True)
    domain = models.CharField(max_length=200, blank=True)
    settings = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('name',)

    def __str__(self):
        return self.name


class Permission(TimeStampedModel):
    key = models.CharField(max_length=120, unique=True)
    label = models.CharField(max_length=160)
    module = models.CharField(max_length=32, choices=Module.choices, blank=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ('module', 'key')

    def __str__(self):
        return self.key


class Role(TimeStampedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='roles')
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=80)
    description = models.TextField(blank=True)
    permissions = models.ManyToManyField(Permission, blank=True, related_name='roles')
    is_system = models.BooleanField(default=False)

    class Meta:
        ordering = ('name',)
        constraints = [models.UniqueConstraint(
            fields=('organization', 'slug'), name='unique_organization_role_slug'
        )]

    def __str__(self):
        return f'{self.organization}: {self.name}'


class MembershipQuerySet(models.QuerySet):
    def active(self):
        return self.filter(status=Membership.Status.ACTIVE, organization__is_active=True)


class Membership(TimeStampedModel):
    class Status(models.TextChoices):
        INVITED = 'invited', 'Invited'
        ACTIVE = 'active', 'Active'
        SUSPENDED = 'suspended', 'Suspended'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='erp_memberships')
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    is_organization_admin = models.BooleanField(default=False)
    is_default = models.BooleanField(default=False)
    roles = models.ManyToManyField(Role, through='MembershipRole', related_name='memberships', blank=True)
    objects = MembershipQuerySet.as_manager()

    class Meta:
        constraints = [models.UniqueConstraint(
            fields=('organization', 'user'), name='unique_organization_member'
        )]

    def clean(self):
        if self.is_default and Membership.objects.exclude(pk=self.pk).filter(
            user=self.user, is_default=True
        ).exists():
            raise ValidationError({'is_default': 'A user can have only one default organization.'})

    def has_permission(self, permission_key):
        if self.is_organization_admin:
            return True
        prefetched_roles = getattr(self, '_prefetched_objects_cache', {}).get('roles')
        if prefetched_roles is not None:
            return any(
                permission.key == permission_key
                for role in prefetched_roles
                for permission in role.permissions.all()
            )
        return self.roles.filter(permissions__key=permission_key).exists()

    def __str__(self):
        return f'{self.user} @ {self.organization}'

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class MembershipRole(TimeStampedModel):
    membership = models.ForeignKey(Membership, on_delete=models.CASCADE, related_name='role_assignments')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='membership_assignments')

    class Meta:
        constraints = [models.UniqueConstraint(
            fields=('membership', 'role'), name='unique_membership_role'
        )]

    def clean(self):
        if self.membership_id and self.role_id and self.membership.organization_id != self.role.organization_id:
            raise ValidationError('A role can only be assigned inside its own organization.')

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

# Create your models here.
