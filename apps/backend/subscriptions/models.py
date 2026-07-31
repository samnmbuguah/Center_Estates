from django.db import models
from django.utils import timezone

from core.models import Module, TimeStampedModel


class SubscriptionQuerySet(models.QuerySet):
    def available(self, at=None):
        at = at or timezone.now()
        return self.filter(
            is_active=True,
            status__in=(Subscription.Status.TRIAL, Subscription.Status.ACTIVE),
        ).filter(
            models.Q(starts_at__isnull=True) | models.Q(starts_at__lte=at),
            models.Q(ends_at__isnull=True) | models.Q(ends_at__gte=at),
        )


class Subscription(TimeStampedModel):
    class Status(models.TextChoices):
        TRIAL = 'trial', 'Trial'
        ACTIVE = 'active', 'Active'
        PAST_DUE = 'past_due', 'Past due'
        SUSPENDED = 'suspended', 'Suspended'
        CANCELLED = 'cancelled', 'Cancelled'

    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE, related_name='subscriptions'
    )
    module = models.CharField(max_length=32, choices=Module.choices)
    is_active = models.BooleanField(default=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.TRIAL)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    limits = models.JSONField(default=dict, blank=True)
    settings = models.JSONField(default=dict, blank=True)
    objects = SubscriptionQuerySet.as_manager()

    class Meta:
        constraints = [models.UniqueConstraint(
            fields=('organization', 'module'), name='unique_organization_module'
        )]

    def __str__(self):
        return f'{self.organization}: {self.get_module_display()}'

    def is_available(self, at=None):
        return Subscription.objects.filter(pk=self.pk).available(at).exists()

# Create your models here.
