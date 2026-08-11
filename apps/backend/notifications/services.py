from organizations.models import Membership

from .models import Notification


def notify_user(*, organization, recipient, title, message, level=Notification.Level.INFO,
                action_url='', event_key='', category='workflow', metadata=None):
    payload = {**(metadata or {}), 'category': category}
    if event_key:
        payload['event_key'] = event_key
        notification, _ = Notification.objects.update_or_create(
            organization=organization, recipient=recipient, metadata__event_key=event_key,
            defaults={'title': title, 'message': message, 'level': level, 'action_url': action_url, 'metadata': payload},
        )
        return notification
    return Notification.objects.create(
        organization=organization, recipient=recipient, title=title, message=message,
        level=level, action_url=action_url, metadata=payload,
    )


def notify_permission(*, organization, permission_key, title, message, level=Notification.Level.INFO,
                      action_url='', event_key='', category='approval', exclude_user=None, metadata=None):
    memberships = Membership.objects.active().filter(organization=organization, user__is_active=True).filter(
        roles__permissions__key=permission_key,
    ).select_related('user').distinct()
    admin_memberships = Membership.objects.active().filter(
        organization=organization, user__is_active=True, is_organization_admin=True,
    ).select_related('user')
    recipients = {membership.user_id: membership.user for membership in [*memberships, *admin_memberships]}
    for recipient in recipients.values():
        if exclude_user and recipient.pk == exclude_user.pk:
            continue
        notify_user(
            organization=organization, recipient=recipient, title=title, message=message, level=level,
            action_url=action_url, event_key=f'{event_key}:{recipient.pk}' if event_key else '',
            category=category, metadata=metadata,
        )
