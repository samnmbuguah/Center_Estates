from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

from core.models import OrganizationOwnedModel


class Notification(OrganizationOwnedModel):
    class Level(models.TextChoices):
        INFO = 'info', 'Information'
        SUCCESS = 'success', 'Success'
        WARNING = 'warning', 'Warning'
        URGENT = 'urgent', 'Urgent'

    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='erp_notifications')
    title = models.CharField(max_length=200)
    message = models.TextField()
    level = models.CharField(max_length=16, choices=Level.choices, default=Level.INFO)
    action_url = models.CharField(max_length=500, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('-created_at',)
        indexes = [models.Index(fields=('organization', 'recipient', 'read_at'))]

    def __str__(self):
        return self.title

    def clean(self):
        if self.recipient_id and self.organization_id:
            from organizations.models import Membership
            if not Membership.objects.active().filter(
                user_id=self.recipient_id, organization_id=self.organization_id
            ).exists():
                raise ValidationError('Notification recipient must be an active organization member.')
