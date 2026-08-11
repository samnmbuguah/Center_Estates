from drf_spectacular.utils import extend_schema_view, extend_schema, OpenApiParameter, OpenApiTypes
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from core.permissions import HasOrganizationContext
from core.tenancy import get_active_organization
from .models import AuditEvent
from .serializers import AuditEventSerializer


class AuditEventViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Read-only API endpoint for the central organization audit event log."""

    permission_classes = (IsAuthenticated, HasOrganizationContext)
    serializer_class = AuditEventSerializer

    queryset = AuditEvent.objects.all()


    def get_queryset(self):
        org = get_active_organization(self.request)
        qs = AuditEvent.objects.filter(organization=org).select_related('actor', 'organization')
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


