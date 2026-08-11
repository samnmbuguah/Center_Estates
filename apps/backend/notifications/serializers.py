from rest_framework import serializers

from .models import Notification


class PlatformNotificationSerializer(serializers.ModelSerializer):
    category = serializers.SerializerMethodField()
    event_key = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        exclude = ('organization', 'recipient')
        read_only_fields = ('title', 'message', 'level', 'action_url', 'metadata', 'created_at', 'updated_at')

    def get_category(self, obj):
        return (obj.metadata or {}).get('category', 'general')

    def get_event_key(self, obj):
        return (obj.metadata or {}).get('event_key', '')
