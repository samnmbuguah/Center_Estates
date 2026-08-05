import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from core.models import OrganizationOwnedModel
from .models import AuditEvent

logger = logging.getLogger(__name__)

EXCLUDED_MODELS = {
    'AuditEvent', 'SalesAuditEvent', 'TenderAuditEvent',
    'ValuationAuditEvent', 'AdminAuditLog', 'Notification',
}


@receiver(post_save)
def auto_audit_post_save(sender, instance, created, **kwargs):
    if not issubclass(sender, OrganizationOwnedModel) or sender.__name__ in EXCLUDED_MODELS:
        return
    org_id = getattr(instance, 'organization_id', None)
    if not org_id:
        return

    action = f'{sender._meta.model_name}.{"created" if created else "updated"}'
    entity_type = sender._meta.model_name
    entity_id = str(instance.pk)

    try:
        AuditEvent.objects.create(
            organization_id=org_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            changes={'status': getattr(instance, 'status', '')} if hasattr(instance, 'status') else {},
            context={'source': 'signal_auto_audit'},
        )
    except Exception as exc:
        logger.warning('Failed to record auto audit event for %s %s: %s', entity_type, entity_id, exc)


@receiver(post_delete)
def auto_audit_post_delete(sender, instance, **kwargs):
    if not issubclass(sender, OrganizationOwnedModel) or sender.__name__ in EXCLUDED_MODELS:
        return
    org_id = getattr(instance, 'organization_id', None)
    if not org_id:
        return

    action = f'{sender._meta.model_name}.deleted'
    entity_type = sender._meta.model_name
    entity_id = str(instance.pk)

    try:
        AuditEvent.objects.create(
            organization_id=org_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            context={'source': 'signal_auto_audit'},
        )
    except Exception as exc:
        logger.warning('Failed to record auto audit deletion event for %s %s: %s', entity_type, entity_id, exc)
