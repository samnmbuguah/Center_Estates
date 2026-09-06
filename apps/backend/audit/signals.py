import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from core.models import OrganizationOwnedModel
from .models import AuditEvent
from .middleware import get_current_request, get_client_ip, get_client_user_agent

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

    request = get_current_request()
    actor = getattr(request, 'user', None) if request and getattr(request.user, 'is_authenticated', False) else None
    client_ip = get_client_ip(request) if request else ''
    user_agent = get_client_user_agent(request) if request else ''

    context = {'source': 'signal_auto_audit'}
    if client_ip:
        context['ip_address'] = client_ip
    if user_agent:
        context['user_agent'] = user_agent[:255]

    try:
        AuditEvent.objects.create(
            organization_id=org_id,
            actor=actor,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            changes={'status': getattr(instance, 'status', '')} if hasattr(instance, 'status') else {},
            context=context,
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

    request = get_current_request()
    actor = getattr(request, 'user', None) if request and getattr(request.user, 'is_authenticated', False) else None
    client_ip = get_client_ip(request) if request else ''
    user_agent = get_client_user_agent(request) if request else ''

    context = {'source': 'signal_auto_audit'}
    if client_ip:
        context['ip_address'] = client_ip
    if user_agent:
        context['user_agent'] = user_agent[:255]

    try:
        AuditEvent.objects.create(
            organization_id=org_id,
            actor=actor,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            context=context,
        )
    except Exception as exc:
        logger.warning('Failed to record auto audit deletion event for %s %s: %s', entity_type, entity_id, exc)
