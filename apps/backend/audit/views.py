from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from core.permissions import HasOrganizationContext
from core.tenancy import scope_to_request
from .models import AuditEvent
from .serializers import AuditEventSerializer


class AuditEventViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Read-only API endpoint for the central organization audit event log."""

    permission_classes = (IsAuthenticated, HasOrganizationContext)
    serializer_class = AuditEventSerializer
    filterset_fields = ('entity_type', 'entity_id', 'action')
    search_fields = ('action', 'entity_type', 'entity_id')

    def get_queryset(self):
        qs = AuditEvent.objects.select_related('actor', 'organization')
        return scope_to_request(qs, self.request)
