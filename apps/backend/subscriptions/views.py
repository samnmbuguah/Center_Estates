from rest_framework import viewsets, permissions
from core.tenancy import get_active_organization
from .models import Subscription
from .serializers import SubscriptionSerializer


class SubscriptionViewSet(viewsets.ModelViewSet):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = SubscriptionSerializer

    def get_queryset(self):
        organization = get_active_organization(self.request)
        if not organization:
            return Subscription.objects.none()
        return Subscription.objects.filter(organization=organization)
