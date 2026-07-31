from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from organizations.models import Organization
from subscriptions.models import Module, Subscription


class SubscriptionConstraintTests(TestCase):
    def test_organization_cannot_have_duplicate_module_subscription(self):
        organization = Organization.objects.create(name='Example', slug='example')
        Subscription.objects.create(organization=organization, module=Module.PROPERTY)

        with self.assertRaises(IntegrityError), transaction.atomic():
            Subscription.objects.create(organization=organization, module=Module.PROPERTY)

    def test_only_current_active_or_trial_subscription_is_available(self):
        organization = Organization.objects.create(name='Example', slug='available')
        active = Subscription.objects.create(
            organization=organization, module=Module.PROPERTY, status=Subscription.Status.ACTIVE
        )
        Subscription.objects.create(
            organization=organization, module=Module.FACILITY,
            status=Subscription.Status.SUSPENDED, is_active=True,
        )

        self.assertEqual(list(Subscription.objects.available(timezone.now())), [active])

# Create your tests here.
