from drf_spectacular.utils import extend_schema_view, extend_schema, OpenApiParameter, OpenApiTypes
from rest_framework import viewsets, permissions
from core.tenancy import get_active_organization
from .models import Subscription
from .serializers import SubscriptionSerializer


@extend_schema_view(retrieve=extend_schema(parameters=[OpenApiParameter("pk", OpenApiTypes.UUID, OpenApiParameter.PATH)]), update=extend_schema(parameters=[OpenApiParameter("pk", OpenApiTypes.UUID, OpenApiParameter.PATH)]), partial_update=extend_schema(parameters=[OpenApiParameter("pk", OpenApiTypes.UUID, OpenApiParameter.PATH)]), destroy=extend_schema(parameters=[OpenApiParameter("pk", OpenApiTypes.UUID, OpenApiParameter.PATH)]))
class SubscriptionViewSet(viewsets.ModelViewSet):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = SubscriptionSerializer

    queryset = Subscription.objects.all()


    def get_queryset(self):
        organization = get_active_organization(self.request)
        if not organization:
            return Subscription.objects.none()
        return Subscription.objects.filter(organization=organization)
