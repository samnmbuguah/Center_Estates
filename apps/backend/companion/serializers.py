from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import (
    Task,
    TaskEvent,
    TaskTemplate,
    TeamFeedbackMessage,
    TeamFeedbackThread,
    PublicFeedbackQrCode,
    IssueRoutingRule,
)


class PublicFeedbackQrCodeSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    building_name = serializers.CharField(source='building.name', read_only=True, default='')

    class Meta:
        model = PublicFeedbackQrCode
        exclude = ('organization',)
        read_only_fields = ('token',)


class IssueRoutingRuleSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True, default='All Properties')
    assigned_user_name = serializers.CharField(source='assigned_user.get_full_name', read_only=True, default='')

    class Meta:
        model = IssueRoutingRule
        exclude = ('organization',)


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

    @extend_schema_field(serializers.BooleanField())
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
        read_only_fields = ('id', 'created_at', 'sender', 'thread')

    @extend_schema_field(serializers.CharField())
    def get_sender_name(self, obj) -> str:
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
            'id', 'reference', 'ticket_no', 'title', 'category', 'issue_category',
            'priority', 'status', 'requester_name', 'contact_channel', 'contact_value',
            'location_detail', 'photo_url', 'assigned_team',
            'property', 'property_name', 'module', 'created_by', 'created_by_name',
            'created_by_role', 'assigned_to', 'assigned_to_name',
            'sla_due_at', 'acknowledged_at', 'resolution_notes',
            'resolved_by', 'resolved_by_name', 'resolved_at',
            'confirmed_by', 'confirmed_by_name', 'confirmed_at', 'reopened_count',
            'metadata', 'messages', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'reference', 'ticket_no', 'created_at', 'updated_at', 'created_by', 'status',
            'assigned_to',
            'resolved_by', 'resolved_at', 'confirmed_by', 'confirmed_at',
        )

    @extend_schema_field(serializers.CharField())
    def get_created_by_name(self, obj) -> str:
        if obj.created_by:
            name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return name or obj.created_by.username
        return "Unknown"

    @extend_schema_field(serializers.CharField())
    def get_created_by_role(self, obj) -> str:
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
            return ""
        name = f"{user.first_name} {user.last_name}".strip()
        return name or user.username

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_assigned_to_name(self, obj) -> str:
        return self._user_display_name(obj.assigned_to)

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_resolved_by_name(self, obj) -> str:
        return self._user_display_name(obj.resolved_by)

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_confirmed_by_name(self, obj) -> str:
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

    @extend_schema_field(serializers.CharField())
    def get_requester_name(self, obj) -> str:
        if obj.requester:
            name = f"{obj.requester.first_name} {obj.requester.last_name}".strip()
            return name or obj.requester.username
        return ""

    @extend_schema_field(serializers.CharField())
    def get_relief_staff_name(self, obj) -> str:
        if obj.relief_staff:
            name = f"{obj.relief_staff.first_name} {obj.relief_staff.last_name}".strip()
            return name or obj.relief_staff.username
        return ""

    @extend_schema_field(serializers.CharField())
    def get_decided_by_name(self, obj) -> str:
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

    @extend_schema_field(serializers.CharField())
    def get_requester_name(self, obj) -> str:
        if obj.requester:
            name = f"{obj.requester.first_name} {obj.requester.last_name}".strip()
            return name or obj.requester.username
        return ""

    @extend_schema_field(serializers.CharField())
    def get_decided_by_name(self, obj) -> str:
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
