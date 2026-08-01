from django.conf import settings
from django.http import JsonResponse
from django.db import connection
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer

from core.serializers import MembershipSerializer, serialize_modules
from core.tenancy import get_active_organization
from organizations.models import Membership


def _set_token_cookie(response, name, value, max_age, path):
    response.set_cookie(
        name, value, max_age=max_age, httponly=True, secure=not settings.DEBUG,
        samesite='Lax', path=path,
    )


def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
    except Exception:
        return JsonResponse({'status': 'unavailable', 'service': 'center-estates-erp', 'database': 'down'}, status=503)
    return JsonResponse({'status': 'ok', 'service': 'center-estates-erp', 'database': 'ok'})


@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({'csrfToken': get_token(request)})


@method_decorator(csrf_protect, name='dispatch')
class LoginView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'login'

    def post(self, request):
        serializer = TokenObtainPairSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = Response({'detail': 'Signed in.'})
        _set_token_cookie(response, settings.JWT_ACCESS_COOKIE, serializer.validated_data['access'], 15 * 60, '/api/v1/')
        _set_token_cookie(response, settings.JWT_REFRESH_COOKIE, serializer.validated_data['refresh'], 7 * 24 * 60 * 60, '/api/v1/auth/')
        return response


class MobileTokenSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["client_kind"] = "mobile"
        return token


class MobileTokenView(APIView):
    """Bearer-token login for the offline Expo construction client."""
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'login'

    def post(self, request):
        serializer = MobileTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response({
            "access": serializer.validated_data["access"],
            "refresh": serializer.validated_data["refresh"],
            "client_kind": "mobile",
        })


@method_decorator(csrf_protect, name='dispatch')
class RefreshView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'token_refresh'

    def post(self, request):
        serializer = TokenRefreshSerializer(data={'refresh': request.COOKIES.get(settings.JWT_REFRESH_COOKIE)})
        serializer.is_valid(raise_exception=True)
        response = Response({'detail': 'Token refreshed.'})
        _set_token_cookie(response, settings.JWT_ACCESS_COOKIE, serializer.validated_data['access'], 15 * 60, '/api/v1/')
        if 'refresh' in serializer.validated_data:
            _set_token_cookie(response, settings.JWT_REFRESH_COOKIE, serializer.validated_data['refresh'], 7 * 24 * 60 * 60, '/api/v1/auth/')
        return response


@method_decorator(csrf_protect, name='dispatch')
class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        response = Response(status=204)
        response.delete_cookie(settings.JWT_ACCESS_COOKIE, path='/api/v1/')
        response.delete_cookie(settings.JWT_REFRESH_COOKIE, path='/api/v1/auth/')
        return response


class MeView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        memberships = Membership.objects.active().filter(user=request.user).select_related('organization')
        organization = get_active_organization(request, required=False)
        return Response({
            'user': {
                'id': request.user.pk,
                'username': request.user.get_username(),
                'email': request.user.email,
                'firstName': request.user.first_name,
                'lastName': request.user.last_name,
            },
            'organizations': MembershipSerializer(memberships, many=True).data,
            'activeOrganizationId': str(organization.id) if organization else None,
            'modules': serialize_modules(organization) if organization else [],
        })

# Create your views here.
