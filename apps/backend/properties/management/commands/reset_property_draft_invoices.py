from django.core.management.base import BaseCommand
from organizations.models import Organization
from properties.models import Property, Invoice, BillingRun, BillingCandidate

class Command(BaseCommand):
    help = 'Deletes draft invoices, candidates, and resets billing runs for a property to allow fresh testing'

    def add_arguments(self, parser):
        parser.add_argument('--org', type=str, default='Legend')
        parser.add_argument('--prop', type=str, default='Blueshield')

    def handle(self, *args, **options):
        org_query = options['org']
        prop_query = options['prop']

        org = Organization.objects.filter(name__icontains=org_query).first()
        if not org:
            self.stderr.write(f'Organization matching {org_query} not found.')
            return

        prop = Property.objects.filter(organization=org, name__icontains=prop_query).first()
        if not prop:
            self.stderr.write(f'Property matching {prop_query} not found for {org.name}.')
            return

        draft_invoices = Invoice.objects.filter(
            organization=org, lease__unit__property=prop, status=Invoice.Status.DRAFT
        )
        draft_count = draft_invoices.count()
        draft_invoices.delete()

        candidates = BillingCandidate.objects.filter(organization=org, billing_run__property=prop)
        cand_count = candidates.count()
        candidates.delete()

        runs = BillingRun.objects.filter(organization=org, property=prop)
        run_count = runs.count()
        runs.delete()

        self.stdout.write(self.style.SUCCESS(
            f'Successfully deleted {draft_count} draft invoice(s), {cand_count} candidate(s), and {run_count} billing run(s) for {prop.name} ({org.name}).'
        ))
