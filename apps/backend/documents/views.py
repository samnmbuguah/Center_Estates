import hashlib

from drf_spectacular.utils import extend_schema_view, extend_schema, OpenApiParameter, OpenApiTypes
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from core.permissions import HasOrganizationContext
from core.tenancy import get_active_organization, scope_to_request
from .models import Document
from .serializers import DocumentSerializer


@extend_schema_view(retrieve=extend_schema(parameters=[OpenApiParameter("pk", OpenApiTypes.UUID, OpenApiParameter.PATH)]), update=extend_schema(parameters=[OpenApiParameter("pk", OpenApiTypes.UUID, OpenApiParameter.PATH)]), partial_update=extend_schema(parameters=[OpenApiParameter("pk", OpenApiTypes.UUID, OpenApiParameter.PATH)]), destroy=extend_schema(parameters=[OpenApiParameter("pk", OpenApiTypes.UUID, OpenApiParameter.PATH)]))
class DocumentViewSet(viewsets.ModelViewSet):
    """API endpoint for central document management across all modules."""

    permission_classes = (IsAuthenticated, HasOrganizationContext)
    serializer_class = DocumentSerializer

    queryset = Document.objects.all()


    def get_queryset(self):
        qs = Document.objects.select_related('uploaded_by', 'organization')
        qs = scope_to_request(qs, self.request)
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return qs


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
