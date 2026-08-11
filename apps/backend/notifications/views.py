from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from core.tenancy import get_active_organization

from .models import Notification
from .serializers import PlatformNotificationSerializer


class NotificationViewSet(ReadOnlyModelViewSet):
    """The signed-in user's organization-scoped notification inbox."""

    permission_classes = (IsAuthenticated,)
    serializer_class = PlatformNotificationSerializer
    search_fields = ('title', 'message')
    ordering_fields = ('created_at', 'read_at', 'level')

    def get_queryset(self):
        organization = get_active_organization(self.request)
        queryset = Notification.objects.for_organization(organization).filter(recipient=self.request.user)
        if self.request.query_params.get('unread') in ('1', 'true'):
            queryset = queryset.filter(read_at__isnull=True)
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(metadata__category=category)
        return queryset

    @action(detail=True, methods=('post',), url_path='mark-read')
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=('read_at', 'updated_at'))
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=('post',), url_path='mark-all-read')
    def mark_all_read(self, request):
        count = self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({'marked_read': count})

    @action(detail=False, methods=('get',))
    def summary(self, request):
        queryset = self.get_queryset().filter(read_at__isnull=True)
        return Response({
            'unread': queryset.count(),
            'urgent': queryset.filter(level=Notification.Level.URGENT).count(),
            'warning': queryset.filter(level=Notification.Level.WARNING).count(),
        })
