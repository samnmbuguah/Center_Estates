from rest_framework import serializers
from .models import Subscription


class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = ('id', 'organization', 'module', 'is_active', 'status', 'starts_at', 'ends_at', 'limits', 'settings')
        read_only_fields = ('id', 'organization', 'module')
