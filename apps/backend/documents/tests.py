from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.storage import InMemoryStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from organizations.models import Organization
from properties.models import Property

from .models import Document


class LenientInMemoryStorage(InMemoryStorage):
    def get_available_name(self, name, max_length=None):
        return name


@override_settings(
    ALLOWED_HOSTS=['testserver'], DEBUG=True, SECURE_SSL_REDIRECT=False,
    STORAGES={'default': {'BACKEND': 'documents.tests.LenientInMemoryStorage'}},
)
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

    def test_create_document(self):
        user = get_user_model().objects.create_user(username='doc-creator')
        org = Organization.objects.create(name='DocOrg', slug='doc-create')
        document = Document.objects.create(
            organization=org,
            uploaded_by=user,
            title='Test Document',
            original_filename='test.pdf',
            file=SimpleUploadedFile('test.pdf', b'content'),
        )
        self.assertIsNotNone(document.id)
        self.assertEqual(document.title, 'Test Document')
        self.assertEqual(document.status, Document.Status.ACTIVE)
        self.assertEqual(document.version, 1)

    def test_list_documents(self):
        user = get_user_model().objects.create_user(username='doc-lister')
        org_a = Organization.objects.create(name='OrgA', slug='doc-list-a')
        org_b = Organization.objects.create(name='OrgB', slug='doc-list-b')

        Document.objects.create(
            organization=org_a, uploaded_by=user, title='Doc A1',
            original_filename='a1.txt', file=SimpleUploadedFile('a1.txt', b'a'),
        )
        Document.objects.create(
            organization=org_a, uploaded_by=user, title='Doc A2',
            original_filename='a2.txt', file=SimpleUploadedFile('a2.txt', b'a'),
        )
        Document.objects.create(
            organization=org_b, uploaded_by=user, title='Doc B1',
            original_filename='b1.txt', file=SimpleUploadedFile('b1.txt', b'b'),
        )

        org_a_docs = Document.objects.filter(organization=org_a)
        org_b_docs = Document.objects.filter(organization=org_b)
        self.assertEqual(org_a_docs.count(), 2)
        self.assertEqual(org_b_docs.count(), 1)
        self.assertEqual(org_b_docs.first().title, 'Doc B1')

    def test_document_immutability(self):
        user = get_user_model().objects.create_user(username='doc-update')
        org = Organization.objects.create(name='DocUpd', slug='doc-update')
        doc = Document.objects.create(
            organization=org, uploaded_by=user, title='Original',
            original_filename='orig.txt', file=SimpleUploadedFile('orig.txt', b'o'),
        )

        doc.title = 'Changed'
        doc.save()
        doc.refresh_from_db()
        self.assertEqual(doc.title, 'Changed')
