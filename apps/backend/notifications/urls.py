from rest_framework.routers import DefaultRouter

from .views import NotificationViewSet, EmailConfigurationViewSet, UserNotificationPreferenceViewSet

router = DefaultRouter()
router.register('email-settings', EmailConfigurationViewSet, basename='email-configuration')
router.register('preferences', UserNotificationPreferenceViewSet, basename='notification-preference')
router.register('', NotificationViewSet, basename='notification')

urlpatterns = router.urls

