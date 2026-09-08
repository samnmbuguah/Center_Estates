import logging
from django.conf import settings
from django.core.mail import get_connection, EmailMultiAlternatives
from django.utils.html import escape
from organizations.models import Membership

from .models import Notification, EmailConfiguration, UserNotificationPreference

logger = logging.getLogger(__name__)

DEFAULT_TEST_RECIPIENT = 'albin.sigei@gmail.com'


def get_effective_email_configuration(organization):
    config = EmailConfiguration.objects.filter(organization=organization, is_active=True).first() if organization else None
    if not config:
        platform_slug = getattr(settings, 'PLATFORM_EMAIL_ORGANIZATION_SLUG', 'center-estates-demo')
        config = EmailConfiguration.objects.filter(organization__slug=platform_slug, is_active=True).first()
    return config


def resolve_email_delivery(organization, intended_recipients):
    """Return (actual recipients, is_test, intended recipients).

    Test mode is deliberately the fail-safe. A missing SMTP configuration must
    never cause tenant/customer mail to escape during implementation testing.
    """
    intended = [str(value).strip() for value in intended_recipients if str(value).strip()]
    config = get_effective_email_configuration(organization)
    if not config or config.delivery_mode != 'live':
        target = (config.test_recipient if config else '') or getattr(settings, 'EMAIL_TEST_RECIPIENT', DEFAULT_TEST_RECIPIENT)
        return [target], True, intended
    return intended, False, intended


def get_email_connection_and_sender(organization):
    """
    Retrieve the active EmailConfiguration for the organization, falling back
    to the platform sender when a customer has not configured its own gateway.

    The platform fallback deliberately reuses the persisted Center Estates
    connection instead of copying SMTP credentials into every organization.
    A customer's active configuration always takes precedence.
    Returns (connection, from_email, from_name).
    """
    config = get_effective_email_configuration(organization)
    if config and config.backend_type == 'smtp' and config.host:
        connection = get_connection(
            backend='django.core.mail.backends.smtp.EmailBackend',
            host=config.host,
            port=config.port,
            username=config.username,
            password=config.password,
            use_tls=config.use_tls,
            use_ssl=config.use_ssl,
            timeout=10,
        )
        from_email = f'{config.from_name} <{config.from_email}>' if config.from_name else config.from_email
        return connection, from_email, config.from_name

    # Fallback to default Django mail settings or console
    connection = get_connection()
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@centerestates.com')
    return connection, from_email, 'CeEst ERP'


def send_email_notification(*, recipient_email, recipient_name, subject, message, action_url='', organization=None):
    """
    Format and send an HTML + plaintext email notification.
    """
    if not recipient_email or '@' not in recipient_email:
        return False

    try:
        connection, from_email, sender_name = get_email_connection_and_sender(organization)
        full_action_url = action_url
        if action_url and action_url.startswith('/'):
            domain = getattr(settings, 'FRONTEND_URL', 'https://centerestates.com').rstrip('/')
            full_action_url = f'{domain}{action_url}'

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }}
  .card {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }}
  .header {{ background: #0f172a; padding: 20px 24px; color: #ffffff; }}
  .header h1 {{ margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -0.02em; }}
  .header p {{ margin: 4px 0 0; font-size: 12px; color: #94a3b8; }}
  .body {{ padding: 24px; line-height: 1.6; font-size: 14px; }}
  .btn {{ display: inline-block; background: #dc2626; color: #ffffff !important; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 700; margin-top: 18px; font-size: 13px; }}
  .footer {{ background: #f1f5f9; padding: 14px 24px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }}
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>CeEst</h1>
      <p>{escape(sender_name)} Notification</p>
    </div>
    <div class="body">
      <p>Hello <strong>{escape(recipient_name or 'there')}</strong>,</p>
      <p>{escape(message)}</p>
      {f'<p><a href="{escape(full_action_url)}" class="btn">View in CeEst &rarr;</a></p>' if full_action_url else ''}
    </div>
    <div class="footer">
      This is an automated notification from CeEst Property & Workplace Management.<br>
      Manage your notification settings inside your user profile.
    </div>
  </div>
</body>
</html>
"""
        plain_text = f"Hello {recipient_name or 'there'},\n\n{message}\n\n"
        if full_action_url:
            plain_text += f"View details here: {full_action_url}\n\n"
        plain_text += "---\nCeEst Property & Workplace Management"

        actual_recipients, is_test, intended_recipients = resolve_email_delivery(organization, [recipient_email])
        if is_test:
            intended_label = ', '.join(intended_recipients) or 'no recipient supplied'
            subject = f'[TEST — intended for {intended_label}] {subject}'
            plain_text = f'TEST DELIVERY — original recipient: {intended_label}\n\n{plain_text}'
            html_content = f'<div style="padding:10px;background:#fff7ed;border:1px solid #fdba74;font-weight:700">TEST DELIVERY — original recipient: {escape(intended_label)}</div>{html_content}'

        email = EmailMultiAlternatives(
            subject=subject,
            body=plain_text,
            from_email=from_email,
            to=actual_recipients,
            connection=connection,
            headers={'X-CeEst-Original-To': ', '.join(intended_recipients)},
        )
        email.attach_alternative(html_content, 'text/html')
        email.send(fail_silently=False)
        return True
    except Exception as exc:
        logger.warning('Failed to send email notification for intended recipient %s: %s', recipient_email, exc)
        return False


def is_category_enabled_for_user(user, organization, category):
    """
    Check if the user wants email alerts for this specific category.
    """
    pref = UserNotificationPreference.objects.filter(user=user, organization=organization).first()
    if not pref:
        return True  # Default to true if no preference set

    if not pref.email_enabled:
        return False

    category_map = {
        'task': pref.notify_task_assigned,
        'task_due': pref.notify_task_due_sla,
        'companion': pref.notify_companion_feedback,
        'ticket': pref.notify_ticket_updates,
        'financial': pref.notify_financial_alerts,
        'workflow': True,
        'approval': True,
    }
    return category_map.get(category, True)


def notify_user(*, organization, recipient, title, message, level=Notification.Level.INFO,
                action_url='', event_key='', category='workflow', metadata=None, send_email=True):
    payload = {**(metadata or {}), 'category': category}
    notification = None
    if event_key:
        payload['event_key'] = event_key
        notification, _ = Notification.objects.update_or_create(
            organization=organization, recipient=recipient, metadata__event_key=event_key,
            defaults={'title': title, 'message': message, 'level': level, 'action_url': action_url, 'metadata': payload},
        )
    else:
        notification = Notification.objects.create(
            organization=organization, recipient=recipient, title=title, message=message,
            level=level, action_url=action_url, metadata=payload,
        )

    # Trigger Email if recipient has an email and preference allows
    if send_email and recipient and recipient.email:
        if is_category_enabled_for_user(recipient, organization, category):
            send_email_notification(
                recipient_email=recipient.email,
                recipient_name=recipient.get_full_name() or recipient.username,
                subject=f'[CeEst] {title}',
                message=message,
                action_url=action_url,
                organization=organization,
            )

    return notification


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
