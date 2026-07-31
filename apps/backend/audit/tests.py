from django.test import TestCase

from organizations.models import Organization

from .models import AuditEvent


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

# Create your tests here.
