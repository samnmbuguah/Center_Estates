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

    def get_queryset(self):
        qs = AuditEvent.objects.select_related('actor', 'organization')
        qs = scope_to_request(qs, self.request)
        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        entity_id = self.request.query_params.get('entity_id')
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        action = self.request.query_params.get('action')
        if action:
            qs = qs.filter(action=action)
        return qs

