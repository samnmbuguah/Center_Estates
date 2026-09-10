"""Notify on expiring sale reservations and release expired ones.

Run on a schedule (for example hourly). Sends an advance warning to the sales
team when a reservation is close to expiry, and automatically cancels and
releases reservations that have passed their expiry, keeping the audit trail.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from sales.models import PropertySale, SaleListing, SalesAuditEvent
from sales.notifications import notify_reservation_expired, notify_reservation_expiring


class Command(BaseCommand):
    help = 'Notify on expiring sale reservations and release expired ones.'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=3, help='Advance warning window in days.')

    def _system_actor(self, organization):
        U = get_user_model()
        actor = U.objects.filter(
            erp_memberships__organization=organization, erp_memberships__is_organization_admin=True,
        ).first()
        return actor or U.objects.filter(is_superuser=True).first()

    def handle(self, *args, **options):
        window = max(int(options.get('days') or 3), 0)
        now = timezone.now()
        soon = now + timedelta(days=window)

        warned = 0
        for listing in SaleListing.objects.select_related('organization').filter(
            status=SaleListing.Status.RESERVED,
            reservation_expires_at__isnull=False,
            reservation_expires_at__gte=now,
            reservation_expires_at__lte=soon,
        ):
            sale = listing.sales.filter(status=PropertySale.Status.RESERVED).order_by('-created_at').first()
            if not sale:
                continue
            days_left = max((listing.reservation_expires_at - now).days, 0)
            notify_reservation_expiring(listing.organization, sale, days_left)
            warned += 1

        expired = 0
        with transaction.atomic():
            listings = SaleListing.objects.select_for_update().select_related('organization').filter(
                status=SaleListing.Status.RESERVED,
                reservation_expires_at__isnull=False,
                reservation_expires_at__lt=now,
            )
            for listing in listings:
                sale = listing.sales.filter(status=PropertySale.Status.RESERVED).order_by('-created_at').first()
                if sale:
                    sale.status = PropertySale.Status.CANCELLED
                    sale.cancellation_reason = 'Reservation expired automatically.'
                    sale.save(update_fields=('status', 'cancellation_reason', 'updated_at'))
                    actor = self._system_actor(listing.organization)
                    if actor is not None:
                        SalesAuditEvent.objects.create(
                            organization=listing.organization, sale=sale, event_type='reservation_expired',
                            from_status=PropertySale.Status.RESERVED, to_status=PropertySale.Status.CANCELLED,
                            notes=sale.cancellation_reason, actor=actor,
                        )
                    notify_reservation_expired(listing.organization, sale)
                listing.status = SaleListing.Status.AVAILABLE
                listing.reservation_expires_at = None
                listing.save(update_fields=('status', 'reservation_expires_at', 'updated_at'))
                expired += 1

        self.stdout.write(self.style.SUCCESS(
            f'Sales reservations: {warned} expiring within {window} day(s), {expired} expired and released.',
        ))
