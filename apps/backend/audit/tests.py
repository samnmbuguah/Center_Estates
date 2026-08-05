from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from organizations.models import Membership, Organization

from .models import AuditEvent


@override_settings(ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False)
class AuditEventTests(TestCase):
    def test_event_cannot_be_changed_or_deleted(self):
        organization = Organization.objects.create(name='Audit', slug='audit')
        event = AuditEvent.objects.create(
            organization=organization, action='property.created', entity_type='property', entity_id='123'
        )
        event.action = 'changed'

        with self.assertRaises(TypeError):
            event.save()
        with self.assertRaises(TypeError):
            event.delete()

    def test_audit_event_listing(self):
        org = Organization.objects.create(name='ListAudit', slug='audit-list')
        AuditEvent.objects.create(organization=org, action='lease.created', entity_type='lease', entity_id='1')
        AuditEvent.objects.create(organization=org, action='payment.received', entity_type='payment', entity_id='2')

        events = AuditEvent.objects.filter(organization=org)
        self.assertEqual(events.count(), 2)
        actions = set(events.values_list('action', flat=True))
        self.assertSetEqual(actions, {'lease.created', 'payment.received'})

    def test_audit_event_org_scoping(self):
        user = get_user_model().objects.create_user(username='audit-scope')
        org_a = Organization.objects.create(name='AuditA', slug='audit-scope-a')
        org_b = Organization.objects.create(name='AuditB', slug='audit-scope-b')
        Membership.objects.create(user=user, organization=org_a)

        AuditEvent.objects.create(organization=org_a, action='a.event', entity_type='x', entity_id='1')
        AuditEvent.objects.create(organization=org_b, action='b.event', entity_type='y', entity_id='2')

        user_orgs = Organization.objects.filter(memberships__user=user)
        scoped_events = AuditEvent.objects.filter(organization__in=user_orgs)

        self.assertEqual(scoped_events.count(), 1)
        self.assertEqual(scoped_events.first().action, 'a.event')
