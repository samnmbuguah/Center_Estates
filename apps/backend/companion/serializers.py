from rest_framework import serializers

from .models import (
    Task,
    TaskEvent,
    TaskTemplate,
    TeamFeedbackMessage,
    TeamFeedbackThread,
)


class TaskSerializer(serializers.ModelSerializer):
    assignee_name = serializers.CharField(source='assignee.get_full_name', read_only=True, default='')
    assignee_username = serializers.CharField(source='assignee.username', read_only=True, default='')
    assigned_by_name = serializers.CharField(source='assigned_by.get_full_name', read_only=True, default='')
    delegated_to_name = serializers.CharField(source='delegated_to.get_full_name', read_only=True, default='')
    template_name = serializers.CharField(source='template.name', read_only=True, default='')
    overdue = serializers.SerializerMethodField()

    class Meta:
        model = Task
        exclude = ('organization',)
        read_only_fields = ('reference', 'status', 'acknowledged_at', 'completed_at', 'escalated', 'escalated_at', 'delegated_from')

    def get_overdue(self, obj) -> bool:
        if obj.status in (Task.Status.COMPLETED, Task.Status.CANCELLED):
            return False
        return bool(obj.due_at and obj.due_at < __import__('django').utils.timezone.now())


class TaskTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskTemplate
        exclude = ('organization',)


class TaskEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.get_full_name', read_only=True, default='')
    actor_username = serializers.CharField(source='actor.username', read_only=True, default='')

    class Meta:
        model = TaskEvent
        exclude = ('organization',)


class TeamFeedbackMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = TeamFeedbackMessage
        fields = (
            'id', 'thread', 'sender', 'sender_name', 'message',
            'attachment_url', 'is_developer_response', 'created_at',
        )
        read_only_fields = ('id', 'created_at', 'sender')

    def get_sender_name(self, obj):
        if obj.sender:
            name = f"{obj.sender.first_name} {obj.sender.last_name}".strip()
            return name or obj.sender.username
        return obj.sender_name or "System / Developer"


class TeamFeedbackThreadSerializer(serializers.ModelSerializer):
    messages = TeamFeedbackMessageSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()
    created_by_role = serializers.SerializerMethodField()
    property_name = serializers.CharField(source='property.name', read_only=True, default='')
    assigned_to_name = serializers.SerializerMethodField()
    resolved_by_name = serializers.SerializerMethodField()
    confirmed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TeamFeedbackThread
        fields = (
            'id', 'reference', 'title', 'category', 'priority', 'status',
            'property', 'property_name', 'module', 'created_by', 'created_by_name',
            'created_by_role', 'assigned_to', 'assigned_to_name',
            'resolved_by', 'resolved_by_name', 'resolved_at',
            'confirmed_by', 'confirmed_by_name', 'confirmed_at',
            'metadata', 'messages', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'reference', 'created_at', 'updated_at', 'created_by',
            'resolved_by', 'resolved_at', 'confirmed_by', 'confirmed_at',
        )

    def get_created_by_name(self, obj):
        if obj.created_by:
            name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return name or obj.created_by.username
        return "Unknown"

    def get_created_by_role(self, obj):
        if obj.created_by:
            if obj.created_by.is_superuser:
                return "Administrator"
            from organizations.models import Membership
            member = Membership.objects.filter(organization=obj.organization, user=obj.created_by).first()
            if member and member.roles.exists():
                return member.roles.first().name
            if member and member.is_organization_admin:
                return "Administrator"
            return "Property Manager"
        return "Staff"

    def _user_display_name(self, user):
        if not user:
            return None
        name = f"{user.first_name} {user.last_name}".strip()
        return name or user.username

    def get_assigned_to_name(self, obj):
        return self._user_display_name(obj.assigned_to)

    def get_resolved_by_name(self, obj):
        return self._user_display_name(obj.resolved_by)

    def get_confirmed_by_name(self, obj):
        return self._user_display_name(obj.confirmed_by)


class StaffLeaveRequestSerializer(serializers.ModelSerializer):
    requester_name = serializers.SerializerMethodField()
    requester_username = serializers.CharField(source='requester.username', read_only=True, default='')
    relief_staff_name = serializers.SerializerMethodField()
    decided_by_name = serializers.SerializerMethodField()
    leave_type_display = serializers.CharField(source='get_leave_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        from .models import StaffLeaveRequest
        model = StaffLeaveRequest
        fields = (
            'id', 'reference', 'requester', 'requester_name', 'requester_username',
            'leave_type', 'leave_type_display', 'start_date', 'end_date', 'total_days',
            'reason', 'attachment_url', 'relief_staff', 'relief_staff_name',
            'status', 'status_display', 'decided_by', 'decided_by_name',
            'decision_notes', 'decided_at', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'reference', 'requester', 'status', 'decided_by',
            'decision_notes', 'decided_at', 'created_at', 'updated_at',
        )

    def get_requester_name(self, obj):
        if obj.requester:
            name = f"{obj.requester.first_name} {obj.requester.last_name}".strip()
            return name or obj.requester.username
        return ""

    def get_relief_staff_name(self, obj):
        if obj.relief_staff:
            name = f"{obj.relief_staff.first_name} {obj.relief_staff.last_name}".strip()
            return name or obj.relief_staff.username
        return ""

    def get_decided_by_name(self, obj):
        if obj.decided_by:
            name = f"{obj.decided_by.first_name} {obj.decided_by.last_name}".strip()
            return name or obj.decided_by.username
        return ""


class StaffHrRequestSerializer(serializers.ModelSerializer):
    requester_name = serializers.SerializerMethodField()
    requester_username = serializers.CharField(source='requester.username', read_only=True, default='')
    decided_by_name = serializers.SerializerMethodField()
    request_type_display = serializers.CharField(source='get_request_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        from .models import StaffHrRequest
        model = StaffHrRequest
        fields = (
            'id', 'reference', 'requester', 'requester_name', 'requester_username',
            'request_type', 'request_type_display', 'title', 'description',
            'proposed_amount', 'currency', 'attachment_url',
            'status', 'status_display', 'decided_by', 'decided_by_name',
            'decision_notes', 'decided_at', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'reference', 'requester', 'status', 'decided_by',
            'decision_notes', 'decided_at', 'created_at', 'updated_at',
        )

    def get_requester_name(self, obj):
        if obj.requester:
            name = f"{obj.requester.first_name} {obj.requester.last_name}".strip()
            return name or obj.requester.username
        return ""

    def get_decided_by_name(self, obj):
        if obj.decided_by:
            name = f"{obj.decided_by.first_name} {obj.decided_by.last_name}".strip()
            return name or obj.decided_by.username
        return ""


class StaffLeaveBalanceSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    user_name = serializers.CharField()
    user_username = serializers.CharField()
    year = serializers.IntegerField()
    annual_entitlement = serializers.FloatField()
    carried_forward = serializers.FloatField()
    total_entitlement = serializers.FloatField()
    taken_days = serializers.FloatField()
    pending_days = serializers.FloatField()
    remaining_days = serializers.FloatField()
