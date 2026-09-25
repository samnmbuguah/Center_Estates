from django.utils import timezone
from drf_spectacular.utils import extend_schema_view, extend_schema, OpenApiParameter, OpenApiTypes
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from core.tenancy import get_active_organization

from .models import Notification
from .serializers import PlatformNotificationSerializer


@extend_schema_view(retrieve=extend_schema(parameters=[OpenApiParameter("pk", OpenApiTypes.UUID, OpenApiParameter.PATH)]))
class NotificationViewSet(ReadOnlyModelViewSet):
    """The signed-in user's organization-scoped notification inbox."""

    permission_classes = (IsAuthenticated,)
    serializer_class = PlatformNotificationSerializer
    search_fields = ('title', 'message')
    ordering_fields = ('created_at', 'read_at', 'level')

    queryset = Notification.objects.all()


    def get_queryset(self):
        organization = get_active_organization(self.request, required=False)
        if not organization:
            return Notification.objects.none()
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

    @action(detail=False, methods=('post',), url_path='broadcast')
    def broadcast(self, request):
        """
        Admin endpoint to dispatch a broadcast notice to all active organization members.
        Delivers via In-App Notification (bell + toast) and optional Outbound Email.
        """
        from organizations.models import Membership
        from .services import notify_user
        from core.tenancy import get_active_membership

        organization = get_active_organization(request)
        membership = get_active_membership(request, organization)
        if not (request.user.is_superuser or (membership and membership.is_organization_admin)):
            return Response({'detail': 'Only administrators can broadcast system notices.'}, status=403)

        title = str(request.data.get('title', '')).strip()
        message = str(request.data.get('message', '')).strip()
        level = request.data.get('level', Notification.Level.INFO)
        send_email = bool(request.data.get('send_email', True))
        action_url = request.data.get('action_url', '/companion')

        if not title or not message:
            return Response({'detail': 'Title and message are required.'}, status=400)

        members = Membership.objects.filter(organization=organization, status=Membership.Status.ACTIVE).select_related('user')
        dispatched_count = 0

        for member in members:
            notify_user(
                organization=organization,
                recipient=member.user,
                title=f"📢 {title}",
                message=message,
                action_url=action_url,
                category="announcement",
                level=level,
                send_email=send_email,
            )
            dispatched_count += 1

        return Response({
            'status': 'success',
            'recipients_count': dispatched_count,
            'detail': f'Broadcast notice dispatched to {dispatched_count} team members.'
        })


from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet
from core.permissions import HasOrganizationContext
from rest_framework import status
from .models import EmailConfiguration, UserNotificationPreference
from .serializers import EmailConfigurationSerializer, UserNotificationPreferenceSerializer
from .services import get_email_connection_and_sender, resolve_email_delivery, send_email_notification


class IsOrganizationEmailAdmin(BasePermission):
    message = 'An active organization membership is required to access email delivery settings.'

    def has_permission(self, request, view):
        from core.tenancy import get_active_membership
        if request.user.is_superuser:
            return True
        organization = get_active_organization(request, required=False)
        membership = get_active_membership(request, organization) if organization else None
        return bool(membership)


class EmailConfigurationViewSet(ModelViewSet):
    """Admin endpoint for configuring organizational SMTP settings."""
    permission_classes = (HasOrganizationContext, IsAuthenticated, IsOrganizationEmailAdmin)
    serializer_class = EmailConfigurationSerializer
    queryset = EmailConfiguration.objects.all()

    def get_queryset(self):
        organization = get_active_organization(self.request)
        return EmailConfiguration.objects.for_organization(organization)

    def perform_create(self, serializer):
        organization = get_active_organization(self.request)
        # Deactivate previous configs if this one is active
        if serializer.validated_data.get('is_active', True):
            EmailConfiguration.objects.filter(organization=organization).update(is_active=False)
        serializer.save(organization=organization)

    def perform_update(self, serializer):
        organization = get_active_organization(self.request)
        if serializer.validated_data.get('is_active', False):
            EmailConfiguration.objects.filter(organization=organization).exclude(pk=self.get_object().pk).update(is_active=False)
        serializer.save()

    @action(detail=False, methods=('post',), url_path='test')
    def test_connection(self, request):
        """Send a test email to the requesting user using the current or saved SMTP settings."""
        organization = get_active_organization(request)
        recipient_email = request.data.get('test_email') or request.user.email
        if not recipient_email:
            return Response({'detail': 'Please provide a valid recipient test_email address.'}, status=status.HTTP_400_BAD_REQUEST)

        # Allow testing unsaved form data directly
        host = request.data.get('host')
        port = int(request.data.get('port') or 587)
        username = request.data.get('username', '')
        password = request.data.get('password', '')
        if not password:
            saved_config = EmailConfiguration.objects.for_organization(organization).first()
            if saved_config and saved_config.password:
                password = saved_config.password
        use_tls = bool(request.data.get('use_tls', True))
        use_ssl = bool(request.data.get('use_ssl', False))
        from_email = request.data.get('from_email') or 'noreply@centerestates.com'
        from_name = request.data.get('from_name') or 'Center Estates Test'

        if host:
            from django.core.mail import get_connection, EmailMultiAlternatives
            try:
                connection = get_connection(
                    backend='django.core.mail.backends.smtp.EmailBackend',
                    host=host, port=port, username=username, password=password,
                    use_tls=use_tls, use_ssl=use_ssl, timeout=10,
                )
                actual_recipients, is_test, intended = resolve_email_delivery(organization, [recipient_email])
                subject = '[Center Estates] SMTP Configuration Test'
                body = f'This is a diagnostic test email from Center Estates sent by {request.user.username}.\n\nSMTP settings: {host}:{port} (TLS: {use_tls}, SSL: {use_ssl})'
                if is_test:
                    subject = f'[TEST — intended for {", ".join(intended)}] {subject}'
                    body = f'TEST DELIVERY — original recipient: {", ".join(intended)}\n\n{body}'
                email = EmailMultiAlternatives(
                    subject=subject,
                    body=body,
                    from_email=f'{from_name} <{from_email}>',
                    to=actual_recipients,
                    connection=connection,
                )
                email.send(fail_silently=False)
                return Response({'detail': f'Test email successfully dispatched to {recipient_email}!'})
            except Exception as exc:
                return Response({'detail': f'SMTP Connection Failed: {str(exc)}'}, status=status.HTTP_400_BAD_REQUEST)

        # Fallback to saved configuration
        sent = send_email_notification(
            recipient_email=recipient_email,
            recipient_name=request.user.get_full_name() or request.user.username,
            subject='[Center Estates] SMTP Configuration Test',
            message=f'This is a test notification confirming your email gateway is active and operational.\n\nTriggered by: {request.user.username}',
            action_url='/settings?tab=notifications',
            organization=organization,
        )
        if sent:
            return Response({'detail': f'Test email successfully dispatched to {recipient_email}!'})
        return Response({'detail': 'Failed to send email. Check SMTP credentials.'}, status=status.HTTP_400_BAD_REQUEST)


class UserNotificationPreferenceViewSet(ModelViewSet):
    """User-specific notification subscriptions and channel settings."""
    permission_classes = (HasOrganizationContext, IsAuthenticated)
    serializer_class = UserNotificationPreferenceSerializer
    queryset = UserNotificationPreference.objects.all()

    def get_queryset(self):
        organization = get_active_organization(self.request)
        return UserNotificationPreference.objects.filter(organization=organization, user=self.request.user)

    @action(detail=False, methods=('get', 'put', 'patch'), url_path='mine')
    def mine(self, request):
        organization = get_active_organization(request)
        pref, _ = UserNotificationPreference.objects.get_or_create(
            organization=organization, user=request.user,
        )
        if request.method in ('PUT', 'PATCH'):
            serializer = UserNotificationPreferenceSerializer(pref, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(UserNotificationPreferenceSerializer(pref).data)
