from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from core.models import OrganizationOwnedModel


class Task(OrganizationOwnedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACKNOWLEDGED = 'acknowledged', 'Acknowledged'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        DELEGATED = 'delegated', 'Delegated'
        CANCELLED = 'cancelled', 'Cancelled'

    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        NORMAL = 'normal', 'Normal'
        HIGH = 'high', 'High'
        URGENT = 'urgent', 'Urgent'

    reference = models.CharField(max_length=50)
    title = models.CharField(max_length=220)
    description = models.TextField(blank=True)
    source_module = models.CharField(max_length=40, blank=True, default='')
    source_ref = models.CharField(max_length=120, blank=True, default='')
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='companion_assigned_tasks', null=True, blank=True,
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='companion_tasks',
    )
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    due_at = models.DateTimeField(null=True, blank=True)
    sla_due_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    delegated_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='delegated_companion_tasks', null=True, blank=True,
    )
    delegated_from = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='companion_delegations', null=True, blank=True,
    )
    is_recurring = models.BooleanField(default=False)
    recurrence_rule = models.CharField(max_length=120, blank=True, default='')
    escalated = models.BooleanField(default=False)
    escalated_at = models.DateTimeField(null=True, blank=True)
    template = models.ForeignKey(
        'TaskTemplate', on_delete=models.SET_NULL, related_name='tasks',
        null=True, blank=True,
    )

    class Meta:
        ordering = ('due_at', 'created_at')
        indexes = [
            models.Index(fields=('organization', 'assignee', 'status')),
            models.Index(fields=('organization', 'due_at')),
        ]

    def clean(self):
        from organizations.models import Membership
        if self.assignee_id and not Membership.objects.active().filter(
            organization_id=self.organization_id, user_id=self.assignee_id
        ).exists():
            raise ValidationError('Assignee must belong to the same organization.')
        if self.assigned_by_id and not Membership.objects.active().filter(
            organization_id=self.organization_id, user_id=self.assigned_by_id
        ).exists():
            raise ValidationError('Assigner must belong to the same organization.')


class TaskTemplate(OrganizationOwnedModel):
    name = models.CharField(max_length=120)
    title_template = models.CharField(max_length=220)
    description_template = models.TextField(blank=True)
    default_priority = models.CharField(max_length=10, choices=Task.Priority.choices, default=Task.Priority.NORMAL)
    default_days_to_due = models.PositiveIntegerField(default=7)
    sla_hours = models.PositiveIntegerField(default=24)
    source_module = models.CharField(max_length=40, blank=True, default='')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ('name',)


class TaskEvent(OrganizationOwnedModel):
    class Action(models.TextChoices):
        CREATED = 'created', 'Created'
        ASSIGNED = 'assigned', 'Assigned'
        ACKNOWLEDGED = 'acknowledged', 'Acknowledged'
        STARTED = 'started', 'Started'
        COMPLETED = 'completed', 'Completed'
        DELEGATED = 'delegated', 'Delegated'
        CANCELLED = 'cancelled', 'Cancelled'
        ESCALATED = 'escalated', 'Escalated'
        REMINDED = 'reminded', 'Reminded'
        UPDATED = 'updated', 'Updated'

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='events', null=True, blank=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=16, choices=Action.choices)
    note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('created_at',)
