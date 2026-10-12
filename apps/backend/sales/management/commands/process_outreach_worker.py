"""Background worker for autonomous OpenOutreach GTM sequence execution.

Scans active campaigns and eligible prospects across all organizations,
evaluates step delays, dynamically renders personalized copy, dispatches emails
via Django's email backend, and updates CRM prospect state.

Can be run:
  1. As a periodic cron job (e.g., every 15 minutes):
     python manage.py process_outreach_worker --limit 20
  2. As a continuous background daemon:
     python manage.py process_outreach_worker --continuous --interval 300
"""

import time
from datetime import timedelta
from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from sales.models import (
    OutreachCampaign,
    OutreachSequenceStep,
    OutreachProspect,
    OutreachActivity,
)


class Command(BaseCommand):
    help = 'Process and dispatch autonomous OpenOutreach sequence emails for active prospects.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=20,
            help='Maximum number of outreach messages to send in this cycle (default 20).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulate sequence evaluation and rendering without sending emails or updating records.',
        )
        parser.add_argument(
            '--campaign-id',
            type=str,
            default=None,
            help='Optionally target a specific OutreachCampaign UUID.',
        )
        parser.add_argument(
            '--continuous',
            action='store_true',
            help='Run continuously in an autonomous background loop.',
        )
        parser.add_argument(
            '--interval',
            type=int,
            default=300,
            help='Sleep interval in seconds between cycles when --continuous is active (default 300s / 5 mins).',
        )

    def handle(self, *args, **options):
        limit = options['limit']
        dry_run = options['dry_run']
        campaign_id = options['campaign_id']
        continuous = options['continuous']
        interval = options['interval']

        if continuous:
            self.stdout.write(self.style.NOTICE(
                f"Starting continuous OpenOutreach daemon (interval: {interval}s, batch limit: {limit}). Press Ctrl+C to stop."
            ))
            while True:
                try:
                    self.run_cycle(limit=limit, dry_run=dry_run, campaign_id=campaign_id)
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"Error during outreach cycle: {e}"))
                time.sleep(interval)
        else:
            self.run_cycle(limit=limit, dry_run=dry_run, campaign_id=campaign_id)

    def run_cycle(self, limit: int, dry_run: bool, campaign_id: str = None):
        now = timezone.now()
        today = now.date()

        campaign_qs = OutreachCampaign.objects.filter(status=OutreachCampaign.Status.ACTIVE)
        if campaign_id:
            campaign_qs = campaign_qs.filter(id=campaign_id)

        campaigns = list(campaign_qs.prefetch_related('steps'))
        if not campaigns:
            self.stdout.write("No active outreach campaigns found.")
            return

        total_dispatched = 0

        for campaign in campaigns:
            if total_dispatched >= limit:
                break

            # Check daily send limit
            sent_today = OutreachActivity.objects.filter(
                prospect__campaign=campaign,
                activity_type=OutreachActivity.ActivityType.SENT,
                created_at__date=today,
            ).count()

            remaining_daily = max(0, campaign.daily_send_limit - sent_today)
            if remaining_daily <= 0:
                self.stdout.write(f"Campaign '{campaign.name}' reached its daily limit ({campaign.daily_send_limit}). Skipping.")
                continue

            steps_by_num = {s.step_number: s for s in campaign.steps.all()}
            if not steps_by_num:
                continue

            # Eligible prospects
            prospects = OutreachProspect.objects.filter(
                campaign=campaign,
                status__in=[OutreachProspect.Status.QUALIFIED, OutreachProspect.Status.CONTACTED],
            ).exclude(
                email=''
            ).order_by('-fit_score', 'created_at')

            for prospect in prospects:
                if total_dispatched >= limit or remaining_daily <= 0:
                    break

                target_step_num = prospect.current_step + 1
                target_step = steps_by_num.get(target_step_num)

                # If no further steps exist, prospect has completed the sequence
                if not target_step:
                    if prospect.current_step >= max(steps_by_num.keys(), default=1):
                        # If more than 7 days passed since last touch without reply, mark as lost
                        if prospect.last_contacted_at and (now - prospect.last_contacted_at).days >= 7:
                            if not dry_run:
                                prospect.status = OutreachProspect.Status.LOST
                                prospect.notes = f"{prospect.notes}\n[Auto] Completed 3-step sequence without reply."
                                prospect.save(update_fields=['status', 'notes', 'updated_at'])
                    continue

                # Check step delay
                if prospect.current_step > 0:
                    if not prospect.last_contacted_at:
                        continue
                    days_since_touch = (now - prospect.last_contacted_at).total_seconds() / 86400.0
                    if days_since_touch < target_step.delay_days:
                        # Not yet due for next touch
                        continue

                # Render copy
                first_name = prospect.contact_name.split()[0] if prospect.contact_name else 'there'
                booking_url = campaign.booking_url or 'https://centerestates.com/demo'

                replacements = {
                    '{{first_name}}': first_name,
                    '{{contact_name}}': prospect.contact_name,
                    '{{company_name}}': prospect.company_name,
                    '{{job_title}}': prospect.job_title or 'Director',
                    '{{booking_url}}': booking_url,
                }

                subject = target_step.subject_template
                body = target_step.body_template
                for placeholder, val in replacements.items():
                    subject = subject.replace(placeholder, val)
                    body = body.replace(placeholder, val)

                from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@centerestates.com')

                if dry_run:
                    self.stdout.write(
                        f"[DRY RUN] Would send Step {target_step_num} to {prospect.contact_name} <{prospect.email}> at {prospect.company_name}\n"
                        f"  Subject: {subject}\n"
                    )
                    total_dispatched += 1
                    remaining_daily -= 1
                    continue

                # Dispatch Email
                try:
                    with transaction.atomic():
                        send_mail(
                            subject=subject,
                            message=body,
                            from_email=from_email,
                            recipient_list=[prospect.email],
                            fail_silently=False,
                        )

                        # Log Activity
                        OutreachActivity.objects.create(
                            organization=prospect.organization,
                            prospect=prospect,
                            step=target_step,
                            activity_type=OutreachActivity.ActivityType.SENT,
                            subject=subject,
                            content=body,
                            metadata={
                                'step_number': target_step_num,
                                'automated': True,
                                'dispatched_at': now.isoformat(),
                            },
                        )

                        # Update Prospect state
                        prospect.status = OutreachProspect.Status.CONTACTED
                        prospect.current_step = target_step_num
                        prospect.last_contacted_at = now
                        prospect.save(update_fields=['status', 'current_step', 'last_contacted_at', 'updated_at'])

                    total_dispatched += 1
                    remaining_daily -= 1
                    self.stdout.write(self.style.SUCCESS(
                        f"✓ Sent Step {target_step_num} to {prospect.contact_name} <{prospect.email}> ({prospect.company_name})"
                    ))
                except Exception as exc:
                    self.stderr.write(self.style.ERROR(
                        f"Failed sending to {prospect.email}: {exc}"
                    ))

        self.stdout.write(self.style.SUCCESS(
            f"OpenOutreach cycle complete. Dispatched: {total_dispatched} messages."
        ))
