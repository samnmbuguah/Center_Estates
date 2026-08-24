from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
import secrets

from core.models import OrganizationOwnedModel


def generate_feedback_qr_token():
    return secrets.token_urlsafe(32)


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
    property = models.ForeignKey(
        'properties.Property', on_delete=models.PROTECT, related_name='companion_tasks',
        null=True, blank=True,
    )
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
    attachment_url = models.URLField(max_length=500, blank=True, default='')
    checklist = models.JSONField(default=list, blank=True)
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


class TeamFeedbackThread(OrganizationOwnedModel):
    class FeedbackType(models.TextChoices):
        BUG = 'bug', 'Bug Report'
        FEATURE = 'feature', 'Feature Request'
        OPERATIONAL = 'operational', 'Operational Feedback'
        GENERAL = 'general', 'General Dialogue'

    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        NORMAL = 'normal', 'Normal'
        HIGH = 'high', 'High'
        URGENT = 'urgent', 'Urgent'

    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        IN_PROGRESS = 'in_progress', 'Investigating / In Progress'
        RESOLVED = 'resolved', 'Resolved'
        CLOSED = 'closed', 'Closed'

    reference = models.CharField(max_length=60, blank=True)
    ticket_no = models.CharField(max_length=60, blank=True, help_text='CeEst Ticket Reference e.g. TT-02541')
    title = models.CharField(max_length=220)
    category = models.CharField(max_length=32, choices=FeedbackType.choices, default=FeedbackType.OPERATIONAL)
    issue_category = models.CharField(max_length=60, blank=True, default='', help_text='Plumbing, Electrical, Cleaning, Security, Lift, Access, Water, Common Area, Other')
    priority = models.CharField(max_length=16, choices=Priority.choices, default=Priority.NORMAL)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    property = models.ForeignKey(
        'properties.Property', on_delete=models.SET_NULL, related_name='feedback_threads',
        null=True, blank=True,
    )
    module = models.CharField(max_length=40, blank=True, default='')
    
    # Requester Information
    requester_name = models.CharField(max_length=160, blank=True, default='')
    contact_channel = models.CharField(max_length=32, blank=True, default='email', choices=[('email', 'Email'), ('whatsapp_number', 'WhatsApp Number'), ('whatsapp_username', 'WhatsApp Username'), ('phone', 'Phone Call')])
    contact_value = models.CharField(max_length=160, blank=True, default='')
    location_detail = models.CharField(max_length=255, blank=True, default='')
    photo_url = models.URLField(max_length=500, blank=True, default='')
    
    # Assignment & SLA
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='assigned_feedback_threads', null=True, blank=True,
    )
    assigned_team = models.CharField(max_length=80, blank=True, default='')
    sla_due_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    
    # Resolution & Closure
    resolution_notes = models.TextField(blank=True, default='')
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='resolved_feedback_threads', null=True, blank=True,
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='confirmed_feedback_threads', null=True, blank=True,
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    reopened_count = models.PositiveIntegerField(default=0)
    
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='created_feedback_threads', null=True, blank=True,
    )
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('-created_at',)

    def clean(self):
        if self.property_id and self.organization_id != self.property.organization_id:
            raise ValidationError('Feedback thread and property must belong to the same organization.')
        if self.created_by_id and not self.created_by.is_active:
            raise ValidationError('The feedback creator must be active.')
        if self.assigned_to_id and not self.organization.memberships.filter(user=self.assigned_to, status='active').exists():
            raise ValidationError('The assignee must be an active member of the feedback organization.')

    def save(self, *args, **kwargs):
        if not self.reference:
            import random
            for _ in range(20):
                candidate = f"TT-{random.randint(10000, 99999)}"
                if not type(self).objects.filter(reference=candidate).exists():
                    self.reference = candidate
                    break
            if not self.reference:
                self.reference = f"TT-{random.randint(100000, 999999)}"
        if not self.ticket_no:
            self.ticket_no = self.reference
        super().save(*args, **kwargs)


class IssueRoutingRule(OrganizationOwnedModel):
    """
    Automatic Issue Routing Matrix.
    Routes tickets by Issue Category + Property to the responsible team/staff.
    """
    CATEGORY_CHOICES = [
        ('Plumbing', 'Plumbing'),
        ('Electrical', 'Electrical'),
        ('Cleaning', 'Cleaning'),
        ('Security', 'Security'),
        ('Lift', 'Lift'),
        ('Access', 'Access'),
        ('Water', 'Water'),
        ('Common Area', 'Common Area'),
        ('Other', 'Other'),
    ]
    category = models.CharField(max_length=60, choices=CATEGORY_CHOICES)
    property = models.ForeignKey('properties.Property', on_delete=models.CASCADE, null=True, blank=True, related_name='routing_rules')
    location_keyword = models.CharField(max_length=120, blank=True, default='', help_text='Optional keyword match for building/floor/area')
    assigned_team = models.CharField(max_length=80, default='Facility Management')
    assigned_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='routed_issue_rules')
    sla_hours = models.PositiveIntegerField(default=24, help_text='Target resolution time in hours')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ('category', 'property__name')

    def __str__(self):
        return f'{self.category} -> {self.assigned_team} ({self.sla_hours}h SLA)'


class PublicFeedbackQrCode(OrganizationOwnedModel):
    token = models.CharField(max_length=64, unique=True, default=generate_feedback_qr_token)
    label = models.CharField(max_length=160)
    property = models.ForeignKey('properties.Property', on_delete=models.CASCADE, related_name='feedback_qr_codes')
    building = models.ForeignKey('properties.Building', on_delete=models.SET_NULL, null=True, blank=True, related_name='feedback_qr_codes')
    floor = models.CharField(max_length=80, blank=True)
    unit = models.CharField(max_length=80, blank=True)
    active = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('property__name', 'label')

    def __str__(self):
        return f'{self.property} — {self.label}'



class TeamFeedbackMessage(OrganizationOwnedModel):
    thread = models.ForeignKey(
        TeamFeedbackThread, on_delete=models.CASCADE, related_name='messages',
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='feedback_messages', null=True, blank=True,
    )
    sender_name = models.CharField(max_length=120, blank=True)
    message = models.TextField()
    attachment_url = models.CharField(max_length=500, blank=True)
    is_developer_response = models.BooleanField(default=False)

    class Meta:
        ordering = ('created_at',)

    def clean(self):
        if self.thread_id and self.organization_id != self.thread.organization_id:
            raise ValidationError('Feedback message and thread must belong to the same organization.')


class StaffLeaveRequest(OrganizationOwnedModel):
    class LeaveType(models.TextChoices):
        ANNUAL = 'annual', 'Annual / Vacation Leave'
        SICK = 'sick', 'Sick Leave'
        MATERNITY = 'maternity', 'Maternity Leave'
        PATERNITY = 'paternity', 'Paternity Leave'
        COMPASSIONATE = 'compassionate', 'Compassionate / Bereavement'
        STUDY = 'study', 'Study / Exam Leave'
        UNPAID = 'unpaid', 'Unpaid Leave'
        EMERGENCY = 'emergency', 'Emergency Leave'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending Approval'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        CANCELLED = 'cancelled', 'Cancelled'

    reference = models.CharField(max_length=60, blank=True)
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='leave_requests'
    )
    leave_type = models.CharField(max_length=32, choices=LeaveType.choices, default=LeaveType.ANNUAL)
    start_date = models.DateField()
    end_date = models.DateField()
    total_days = models.DecimalField(max_digits=5, decimal_places=1, default=1.0)
    reason = models.TextField()
    attachment_url = models.CharField(max_length=500, blank=True, default='')
    relief_staff = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='relief_leave_coverages', null=True, blank=True,
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='decided_leave_requests', null=True, blank=True,
    )
    decision_notes = models.TextField(blank=True, default='')
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)
        indexes = [
            models.Index(fields=('organization', 'requester', 'status')),
            models.Index(fields=('organization', 'start_date', 'end_date')),
        ]

    def save(self, *args, **kwargs):
        if not self.reference:
            import random
            self.reference = f"LV-{random.randint(1000, 9999)}"
        super().save(*args, **kwargs)


class StaffHrRequest(OrganizationOwnedModel):
    class RequestType(models.TextChoices):
        RAISE_REVIEW = 'raise_review', 'Salary / Raise Review'
        OVERTIME_CLAIM = 'overtime_claim', 'Overtime / Shift Claim'
        EXPENSE_REIMBURSEMENT = 'expense_reimbursement', 'Expense Reimbursement'
        SALARY_ADVANCE = 'salary_advance', 'Salary Advance / Loan'
        GENERAL_HR = 'general_hr', 'General HR Request / Inquiry'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending Review'
        UNDER_REVIEW = 'under_review', 'Under Consideration'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    reference = models.CharField(max_length=60, blank=True)
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='hr_requests'
    )
    request_type = models.CharField(max_length=32, choices=RequestType.choices, default=RequestType.GENERAL_HR)
    title = models.CharField(max_length=220)
    description = models.TextField()
    proposed_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=8, default='KES')
    attachment_url = models.CharField(max_length=500, blank=True, default='')
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='decided_hr_requests', null=True, blank=True,
    )
    decision_notes = models.TextField(blank=True, default='')
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)
        indexes = [
            models.Index(fields=('organization', 'requester', 'status')),
        ]

    def save(self, *args, **kwargs):
        if not self.reference:
            import random
            self.reference = f"HR-{random.randint(1000, 9999)}"
        super().save(*args, **kwargs)


class StaffLeaveBalance(OrganizationOwnedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='leave_balances'
    )
    year = models.PositiveIntegerField(default=2026)
    annual_entitlement = models.DecimalField(max_digits=5, decimal_places=1, default=21.0)
    carried_forward = models.DecimalField(max_digits=5, decimal_places=1, default=0.0)

    class Meta:
        unique_together = ('organization', 'user', 'year')
        ordering = ('user', 'year')

    @property
    def total_entitlement(self):
        return float(self.annual_entitlement) + float(self.carried_forward)

    def get_taken_days(self):
        approved = StaffLeaveRequest.objects.filter(
            organization=self.organization,
            requester=self.user,
            leave_type=StaffLeaveRequest.LeaveType.ANNUAL,
            status=StaffLeaveRequest.Status.APPROVED,
            start_date__year=self.year,
        ).aggregate(models.Sum('total_days'))['total_days__sum'] or 0.0
        return float(approved)

    def get_pending_days(self):
        pending = StaffLeaveRequest.objects.filter(
            organization=self.organization,
            requester=self.user,
            leave_type=StaffLeaveRequest.LeaveType.ANNUAL,
            status=StaffLeaveRequest.Status.PENDING,
            start_date__year=self.year,
        ).aggregate(models.Sum('total_days'))['total_days__sum'] or 0.0
        return float(pending)

    @property
    def remaining_days(self):
        return max(0.0, self.total_entitlement - self.get_taken_days())


class QmConversation(OrganizationOwnedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='qm_conversations')
    property = models.ForeignKey('properties.Property', on_delete=models.SET_NULL, null=True, blank=True, related_name='qm_conversations')
    title = models.CharField(max_length=180, default='Quartermaster conversation')
    is_archived = models.BooleanField(default=False)

    class Meta:
        ordering = ('-updated_at',)
        indexes = [models.Index(fields=('organization', 'user', 'is_archived'))]


class QmMessage(OrganizationOwnedModel):
    class Role(models.TextChoices):
        USER = 'user', 'User'
        ASSISTANT = 'assistant', 'Assistant'

    conversation = models.ForeignKey(QmConversation, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=12, choices=Role.choices)
    content = models.TextField()
    response_metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('created_at',)
        indexes = [models.Index(fields=('organization', 'conversation', 'created_at'))]
