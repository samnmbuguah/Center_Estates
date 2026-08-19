from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from .models import Notification, EmailConfiguration, UserNotificationPreference


class PlatformNotificationSerializer(serializers.ModelSerializer):
    category = serializers.SerializerMethodField()
    event_key = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        exclude = ('organization', 'recipient')
        read_only_fields = ('title', 'message', 'level', 'action_url', 'metadata', 'created_at', 'updated_at')

    @extend_schema_field(serializers.CharField())
    def get_category(self, obj):
        return (obj.metadata or {}).get('category', 'general')

    @extend_schema_field(serializers.CharField())
    def get_event_key(self, obj):
        return (obj.metadata or {}).get('event_key', '')


class EmailConfigurationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = EmailConfiguration
        fields = (
            'id', 'backend_type', 'host', 'port', 'username', 'password',
            'use_tls', 'use_ssl', 'from_email', 'from_name', 'is_active',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')


class UserNotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserNotificationPreference
        fields = (
            'id', 'email_enabled', 'in_app_enabled',
            'notify_task_assigned', 'notify_task_due_sla',
            'notify_companion_feedback', 'notify_ticket_updates',
            'notify_financial_alerts', 'updated_at',
        )
        read_only_fields = ('id', 'updated_at')

