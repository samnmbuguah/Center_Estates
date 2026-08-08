from rest_framework import serializers

from .models import Task, TaskEvent, TaskTemplate


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
