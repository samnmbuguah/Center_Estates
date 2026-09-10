"""Sales notification helpers.

Thin wrappers around the shared notification service so sales events surface in
the in-app notification bell and (per user preference) email. Every call is
best-effort: a notification failure must never break the underlying sale,
payment or commission workflow.
"""

import logging

logger = logging.getLogger(__name__)


def notify_payment_submitted(organization, payment):
    try:
        from notifications.services import notify_permission
        buyer = payment.sale.buyer.full_name if payment.sale_id and payment.sale.buyer_id else 'A buyer'
        notify_permission(
            organization=organization, permission_key='sales.payments',
            title='Payment submitted for verification',
            message=(
                f'{buyer} submitted {payment.amount} via {payment.method} for sale '
                f'{payment.sale.reference} (ref {payment.external_reference}). '
                f'Verify it in the payments queue.'
            ),
            level='warning', action_url='/sales?tab=payments',
            event_key=f'sale-payment-{payment.id}', category='financial',
            metadata={'payment_id': str(payment.id), 'sale_id': str(payment.sale_id)},
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning('Failed to notify payment submitted %s: %s', getattr(payment, 'id', ''), exc)


def notify_commission_eligible(organization, commission):
    try:
        from notifications.services import notify_permission, notify_user
        from organizations.models import Membership
        sale_ref = commission.sale.reference if commission.sale_id else ''
        agent = commission.agent
        message = (
            f'Commission {commission.reference} for sale {sale_ref} has cleared its gates '
            f'and is ready for approval ({commission.amount}).'
        )
        # Finance / approvers.
        notify_permission(
            organization=organization, permission_key='sales.payments',
            title='Commission eligible for approval',
            message=message, level='success', action_url='/sales?tab=commissions',
            event_key=f'sale-commission-{commission.id}', category='approval',
            metadata={'commission_id': str(commission.id)},
        )
        # The agent, when they are an active member of the organization.
        if agent and Membership.objects.active().filter(user=agent, organization=organization).exists():
            notify_user(
                organization=organization, recipient=agent,
                title='Your commission is eligible',
                message=message, level='success', action_url='/agent-portal',
                event_key=f'sale-commission-agent-{commission.id}', category='workflow',
                metadata={'commission_id': str(commission.id)},
            )
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning('Failed to notify commission eligible %s: %s', getattr(commission, 'id', ''), exc)


def notify_reservation_expiring(organization, sale, days_left):
    try:
        from notifications.services import notify_permission
        buyer = sale.buyer.full_name if sale.buyer_id else 'A buyer'
        when = 'today' if days_left <= 0 else f'in {days_left} day(s)'
        notify_permission(
            organization=organization, permission_key='sales.selling',
            title='Sale reservation expiring',
            message=(
                f'Reservation {sale.reference} for {buyer} expires {when}. '
                f'Contact the buyer or release the unit.'
            ),
            level='warning' if days_left > 0 else 'urgent',
            action_url='/sales?tab=sales',
            event_key=f'sale-reservation-{sale.id}-{days_left}', category='workflow',
            metadata={'sale_id': str(sale.id)},
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning('Failed to notify reservation expiring %s: %s', getattr(sale, 'id', ''), exc)


def notify_reservation_expired(organization, sale):
    try:
        from notifications.services import notify_permission
        notify_permission(
            organization=organization, permission_key='sales.selling',
            title='Sale reservation expired',
            message=(
                f'Reservation {sale.reference} expired and the unit has been released back '
                f'to available inventory.'
            ),
            level='urgent', action_url='/sales?tab=inventory',
            event_key=f'sale-reservation-expired-{sale.id}', category='workflow',
            metadata={'sale_id': str(sale.id)},
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning('Failed to notify reservation expired %s: %s', getattr(sale, 'id', ''), exc)
