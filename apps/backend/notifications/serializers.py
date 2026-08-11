from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from .models import Notification


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
