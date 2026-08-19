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


class EmailConfiguration(OrganizationOwnedModel):
    """
    SMTP Email configuration per organization.
    Allows administrators to configure and test their own mail servers.
    """
    backend_type = models.CharField(max_length=32, default='smtp', choices=[('smtp', 'Custom SMTP Server'), ('console', 'Console / Development')])
    host = models.CharField(max_length=255, default='smtp.gmail.com')
    port = models.PositiveIntegerField(default=587)
    username = models.CharField(max_length=255, blank=True, default='')
    password = models.CharField(max_length=255, blank=True, default='')
    use_tls = models.BooleanField(default=True)
    use_ssl = models.BooleanField(default=False)
    from_email = models.EmailField(default='noreply@centerestates.com')
    from_name = models.CharField(max_length=120, default='Center Estates ERP')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.organization.name} Email SMTP ({self.host}:{self.port})'


class UserNotificationPreference(OrganizationOwnedModel):
    """
    User-level notification channel and category subscriptions.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notification_preferences')
    email_enabled = models.BooleanField(default=True, help_text='Receive critical notifications via email')
    in_app_enabled = models.BooleanField(default=True, help_text='Receive in-app notification bell alerts')
    notify_task_assigned = models.BooleanField(default=True, help_text='Alert when tasks are assigned to you')
    notify_task_due_sla = models.BooleanField(default=True, help_text='Alert for task SLA deadlines and escalations')
    notify_companion_feedback = models.BooleanField(default=True, help_text='Alert when public/team feedback is submitted')
    notify_ticket_updates = models.BooleanField(default=True, help_text='Alert for helpdesk tickets and status changes')
    notify_financial_alerts = models.BooleanField(default=True, help_text='Alert for invoice due dates and M-Pesa receipts')

    class Meta:
        unique_together = ('organization', 'user')
        ordering = ('user__username',)

    def __str__(self):
        return f'{self.user.username} Preferences ({self.organization.name})'

