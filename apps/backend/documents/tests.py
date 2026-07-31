from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from organizations.models import Organization
from properties.models import Property

from .models import Document


class DocumentTenantTests(TestCase):
    def test_target_must_belong_to_document_organization(self):
        user = get_user_model().objects.create_user(username='docs')
        first = Organization.objects.create(name='First', slug='docs-first')
        second = Organization.objects.create(name='Second', slug='docs-second')
        target = Property.objects.create(organization=first, code='DOC', name='Document target')
        document = Document(
            organization=second,
            uploaded_by=user,
            title='Cross-tenant document',
            original_filename='test.txt',
            file=SimpleUploadedFile('test.txt', b'test'),
            target=target,
        )

        with self.assertRaises(ValidationError):
            document.save()

# Create your tests here.
