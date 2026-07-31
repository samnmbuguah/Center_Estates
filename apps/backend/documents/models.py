from django.db import models
from django.core.exceptions import ValidationError
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

from core.models import OrganizationOwnedModel


def document_upload_path(instance, filename):
    return f'organizations/{instance.organization_id}/documents/{instance.id}/{filename}'


class Document(OrganizationOwnedModel):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        ACTIVE = 'active', 'Active'
        ARCHIVED = 'archived', 'Archived'

    title = models.CharField(max_length=240)
    category = models.CharField(max_length=80, blank=True, db_index=True)
    file = models.FileField(upload_to=document_upload_path)
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=120, blank=True)
    size_bytes = models.PositiveBigIntegerField(default=0)
    checksum_sha256 = models.CharField(max_length=64, blank=True, db_index=True)
    version = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    expires_on = models.DateField(null=True, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='erp_documents')
    content_type = models.ForeignKey(ContentType, on_delete=models.PROTECT, null=True, blank=True)
    object_id = models.UUIDField(null=True, blank=True)
    target = GenericForeignKey('content_type', 'object_id')
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('-created_at',)
        indexes = [models.Index(fields=('organization', 'category', 'status'))]

    def __str__(self):
        return self.title

    def clean(self):
        if self.target is not None and hasattr(self.target, 'organization_id'):
            if self.target.organization_id != self.organization_id:
                raise ValidationError('A document target must belong to the same organization.')
