from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone

from organizations.models import Organization
from subscriptions.models import Module, Subscription


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
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

    def test_subscription_toggle(self):
        organization = Organization.objects.create(name='Toggle', slug='toggle')
        sub = Subscription.objects.create(
            organization=organization, module=Module.PROPERTY, is_active=True
        )
        self.assertTrue(sub.is_active)

        sub.is_active = False
        sub.save()
        sub.refresh_from_db()
        self.assertFalse(sub.is_active)

        sub.is_active = True
        sub.save()
        sub.refresh_from_db()
        self.assertTrue(sub.is_active)

    def test_subscription_availability(self):
        org = Organization.objects.create(name='Avail', slug='avail')
        now = timezone.now()

        trial = Subscription.objects.create(
            organization=org, module=Module.PROPERTY,
            status=Subscription.Status.TRIAL, is_active=True,
            starts_at=now, ends_at=now + timezone.timedelta(days=30),
        )
        Subscription.objects.create(
            organization=org, module=Module.FACILITY,
            status=Subscription.Status.CANCELLED, is_active=False,
        )
        Subscription.objects.create(
            organization=org, module=Module.SALES,
            status=Subscription.Status.ACTIVE, is_active=True,
            starts_at=now, ends_at=now - timezone.timedelta(days=1),
        )

        available = Subscription.objects.available(now)
        self.assertIn(trial, available)
        self.assertEqual(available.count(), 1)
