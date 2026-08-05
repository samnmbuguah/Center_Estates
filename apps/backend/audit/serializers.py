from rest_framework import serializers

from .models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='actor.username', read_only=True, default='')

    class Meta:
        model = AuditEvent
        fields = (
            'id', 'organization', 'actor', 'actor_username',
            'action', 'entity_type', 'entity_id',
            'changes', 'context', 'created_at',
        )
        read_only_fields = fields
