from rest_framework import serializers

from .models import Document


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.CharField(source='uploaded_by.username', read_only=True, default='')

    class Meta:
        model = Document
        fields = (
            'id', 'organization', 'title', 'category', 'file',
            'original_filename', 'mime_type', 'size_bytes',
            'checksum_sha256', 'version', 'status', 'expires_on',
            'uploaded_by', 'uploaded_by_username',
            'content_type', 'object_id', 'metadata',
            'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'organization', 'uploaded_by', 'size_bytes',
            'checksum_sha256', 'created_at', 'updated_at',
        )
