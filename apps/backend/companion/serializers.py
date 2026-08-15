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
    property_name = serializers.CharField(source='property.name', read_only=True, default='')

    class Meta:
        model = TeamFeedbackThread
        fields = (
            'id', 'reference', 'title', 'category', 'priority', 'status',
            'property', 'property_name', 'module', 'created_by', 'created_by_name',
            'assigned_to', 'metadata', 'messages', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'reference', 'created_at', 'updated_at', 'created_by')

    def get_created_by_name(self, obj):
        if obj.created_by:
            name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return name or obj.created_by.username
        return "Unknown"
