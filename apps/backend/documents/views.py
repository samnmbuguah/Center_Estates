import hashlib

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from core.permissions import HasOrganizationContext
from core.tenancy import get_active_organization, scope_to_request
from .models import Document
from .serializers import DocumentSerializer


class DocumentViewSet(viewsets.ModelViewSet):
    """API endpoint for central document management across all modules."""

    permission_classes = (IsAuthenticated, HasOrganizationContext)
    serializer_class = DocumentSerializer
    filterset_fields = ('category', 'status')
    search_fields = ('title', 'original_filename', 'category')

    def get_queryset(self):
        qs = Document.objects.select_related('uploaded_by', 'organization')
        return scope_to_request(qs, self.request)

    def perform_create(self, serializer):
        org = get_active_organization(self.request)
        uploaded_file = self.request.FILES.get('file')
        size_bytes = uploaded_file.size if uploaded_file else 0
        checksum = ''
        if uploaded_file:
            sha = hashlib.sha256()
            for chunk in uploaded_file.chunks():
                sha.update(chunk)
            checksum = sha.hexdigest()
            orig_filename = uploaded_file.name
        else:
            orig_filename = serializer.validated_data.get('original_filename', '')

        serializer.save(
            organization=org,
            uploaded_by=self.request.user,
            size_bytes=size_bytes,
            checksum_sha256=checksum,
            original_filename=orig_filename,
        )
