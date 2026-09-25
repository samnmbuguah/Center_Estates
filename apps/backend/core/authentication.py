from django.conf import settings
from rest_framework.authentication import CSRFCheck
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.contrib.auth.backends import ModelBackend


def enforce_csrf(request):
    check = CSRFCheck(lambda req: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise PermissionDenied(f'CSRF validation failed: {reason}')


class CookieJWTAuthentication(JWTAuthentication):
    """Accept bearer JWTs or same-origin HttpOnly access-token cookies."""

    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token is None:
                return None
            validated_token = self.get_validated_token(raw_token)
            return self.get_user(validated_token), validated_token

        raw_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE)
        if not raw_token:
            return None
        if request.method not in ('GET', 'HEAD', 'OPTIONS', 'TRACE'):
            enforce_csrf(request)
        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token


class EmailOrUsernameModelBackend(ModelBackend):
    """Authenticate users with either their username or email address (case-insensitive)."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        if not username:
            return None
        from django.contrib.auth import get_user_model
        from django.db.models import Q
        User = get_user_model()
        user = User.objects.filter(Q(username__iexact=username) | Q(email__iexact=username)).first()
        if user and user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None


