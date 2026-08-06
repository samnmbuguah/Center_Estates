from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import JsonResponse
from django.db import connection
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt, csrf_protect
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from core.serializers import MembershipSerializer, serialize_modules
from core.tenancy import get_active_organization
from organizations.models import Membership

IMPERSONATOR_COOKIE = getattr(settings, 'JWT_IMPERSONATOR_COOKIE', 'ce_impersonator')


def _set_token_cookie(response, name, value, max_age, path):
    response.set_cookie(
        name, value, max_age=max_age, httponly=True, secure=not settings.DEBUG,
        samesite='Lax', path=path,
    )


def _issue_session_cookies(response, user):
    refresh = RefreshToken.for_user(user)
    _set_token_cookie(response, settings.JWT_ACCESS_COOKIE, str(refresh.access_token), 15 * 60, '/api/v1/')
    _set_token_cookie(response, settings.JWT_REFRESH_COOKIE, str(refresh), 7 * 24 * 60 * 60, '/api/v1/auth/')
    return response


def _can_switch_demo_identity(user, organization=None):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    if organization is None:
        return False
    membership = Membership.objects.active().filter(user=user, organization=organization).first()
    return bool(membership and membership.is_organization_admin)


def _is_demo_identity(user):
    if not user:
        return False
    if user.is_superuser or user.username == 'admin':
        return True
    return user.username.startswith('role-')


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


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    """Cookie-based JWT login. CSRF-exempt: protected by CORS + rate-limiting.
    Authenticated endpoints are still CSRF-protected via CookieJWTAuthentication."""
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'login'

    def post(self, request):
        serializer = TokenObtainPairSerializer(data=request.data)
        try:
            valid = serializer.is_valid()
        except Exception:
            # simplejwt's TokenObtainPairSerializer raises AuthenticationFailed
            # on bad credentials inside is_valid(); map it to a clean 401.
            return Response({'detail': 'Incorrect username or password.'}, status=401)
        if not valid:
            return Response({'detail': 'Unable to sign in. Please check your credentials.'}, status=401)
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
        response.delete_cookie(IMPERSONATOR_COOKIE, path='/api/v1/')
        return response


class MeView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        memberships = Membership.objects.active().filter(user=request.user).select_related('organization')
        organization = get_active_organization(request, required=False)
        membership = memberships.filter(organization=organization).prefetch_related('roles__permissions').first() if organization else None
        permissions = [] if not membership else (
            ['*'] if membership.is_organization_admin or request.user.is_superuser else list(
                membership.roles.values_list('permissions__key', flat=True).distinct().order_by('permissions__key')
            )
        )
        if request.user.is_superuser and '*' not in permissions:
            permissions = ['*']
        impersonator_id = request.COOKIES.get(IMPERSONATOR_COOKIE)
        impersonating = bool(impersonator_id and str(impersonator_id) != str(request.user.pk))
        role_names = [] if not membership else list(membership.roles.values_list('name', flat=True).order_by('name'))
        return Response({
            'user': {
                'id': request.user.pk,
                'username': request.user.get_username(),
                'email': request.user.email,
                'firstName': request.user.first_name,
                'lastName': request.user.last_name,
                'isSuperuser': request.user.is_superuser,
            },
            'organizations': MembershipSerializer(memberships, many=True).data,
            'activeOrganizationId': str(organization.id) if organization else None,
            'modules': serialize_modules(organization, membership) if organization else [],
            'roles': [] if not membership else list(membership.roles.values_list('slug', flat=True).order_by('slug')),
            'roleNames': role_names,
            'permissions': permissions,
            'impersonating': impersonating,
            'canSwitchIdentity': _can_switch_demo_identity(request.user, organization) or impersonating,
        })


@method_decorator(csrf_protect, name='dispatch')
class DemoIdentitiesView(APIView):
    """List seeded demo users for in-demo role switching (superuser / org admin only)."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        organization = get_active_organization(request, required=False)
        if not organization:
            return Response({'identities': [], 'groups': []})
        # While impersonating, still allow the original admin to list identities.
        actor = request.user
        impersonator_id = request.COOKIES.get(IMPERSONATOR_COOKIE)
        if impersonator_id:
            actor = get_user_model().objects.filter(pk=impersonator_id).first() or request.user
        if not _can_switch_demo_identity(actor, organization) and not actor.is_superuser:
            return Response({'detail': 'Demo identity switching is limited to platform administrators.'}, status=403)

        memberships = (
            Membership.objects.active()
            .filter(organization=organization)
            .select_related('user')
            .prefetch_related('roles')
            .order_by('user__username')
        )
        identities = []
        for membership in memberships:
            user = membership.user
            if not _is_demo_identity(user) and not membership.is_organization_admin:
                continue
            roles = list(membership.roles.all())
            primary = roles[0] if roles else None
            module = primary.permissions.first().module if primary and primary.permissions.exists() else 'platform'
            if membership.is_organization_admin or user.is_superuser:
                module = 'platform'
            identities.append({
                'id': user.pk,
                'username': user.username,
                'label': (
                    f'{user.first_name} {user.last_name}'.strip()
                    or (primary.name if primary else user.username)
                ),
                'roleSlug': primary.slug if primary else ('platform-admin' if membership.is_organization_admin else ''),
                'roleName': (
                    'Super Administrator' if user.is_superuser
                    else (primary.name if primary else 'Organization administrator')
                ),
                'module': module,
                'isAdmin': bool(membership.is_organization_admin or user.is_superuser),
                'isCurrent': user.pk == request.user.pk,
            })
        module_order = ['platform', 'property', 'facility', 'sales', 'tender', 'valuation', 'monitoring']
        groups = []
        for module in module_order:
            items = [item for item in identities if item['module'] == module]
            if items:
                groups.append({'module': module, 'label': module.replace('-', ' ').title(), 'identities': items})
        extras = [item for item in identities if item['module'] not in module_order]
        if extras:
            groups.append({'module': 'other', 'label': 'Other', 'identities': extras})
        return Response({'identities': identities, 'groups': groups})


@method_decorator(csrf_protect, name='dispatch')
class ImpersonateView(APIView):
    """Switch the browser session to a seeded demo identity for product demos."""

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        organization = get_active_organization(request, required=False)
        username = str(request.data.get('username') or '').strip()
        if not username:
            return Response({'detail': 'username is required.'}, status=400)

        # Resolve the acting admin (original user if already impersonating).
        impersonator_id = request.COOKIES.get(IMPERSONATOR_COOKIE)
        actor = request.user
        if impersonator_id:
            actor = get_user_model().objects.filter(pk=impersonator_id).first() or request.user
        if not _can_switch_demo_identity(actor, organization) and not actor.is_superuser:
            return Response({'detail': 'Only platform or organization administrators can switch demo identities.'}, status=403)

        target = get_user_model().objects.filter(username=username).first()
        if not target or not target.is_active:
            return Response({'detail': 'Demo identity not found.'}, status=404)
        if not Membership.objects.active().filter(user=target, organization=organization).exists() and not target.is_superuser:
            return Response({'detail': 'Demo identity is not a member of the active organization.'}, status=400)
        if not _is_demo_identity(target) and not target.is_superuser:
            return Response({'detail': 'Only seeded demo identities can be selected.'}, status=400)

        response = Response({
            'detail': f'Switched to {target.username}.',
            'username': target.username,
        })
        _issue_session_cookies(response, target)
        # Preserve the original admin so demos can return without re-entering the password.
        original_id = impersonator_id or str(actor.pk)
        if str(target.pk) == str(original_id):
            response.delete_cookie(IMPERSONATOR_COOKIE, path='/api/v1/')
        else:
            _set_token_cookie(response, IMPERSONATOR_COOKIE, str(original_id), 7 * 24 * 60 * 60, '/api/v1/')
        return response


@method_decorator(csrf_protect, name='dispatch')
class StopImpersonateView(APIView):
    """Return from a demo identity to the original administrator session."""

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        impersonator_id = request.COOKIES.get(IMPERSONATOR_COOKIE)
        if not impersonator_id:
            return Response({'detail': 'Not currently impersonating a demo identity.'}, status=400)
        actor = get_user_model().objects.filter(pk=impersonator_id).first()
        if not actor or not actor.is_active:
            response = Response({'detail': 'Original administrator session expired. Sign in again.'}, status=400)
            response.delete_cookie(IMPERSONATOR_COOKIE, path='/api/v1/')
            return response
        response = Response({'detail': f'Returned to {actor.username}.', 'username': actor.username})
        _issue_session_cookies(response, actor)
        response.delete_cookie(IMPERSONATOR_COOKIE, path='/api/v1/')
        return response


class WorkspaceInboxView(APIView):
    """Cross-module attention queue for the command center."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        from decimal import Decimal

        from django.db.models import Sum

        from construction.models import Risk, Ticket
        from core.models import Module
        from facilities.models import WorkOrder
        from properties.models import Invoice
        from sales.models import SalePayment
        from tenders.models import Tender
        from valuations.models import ValuationInstruction

        organization = get_active_organization(request, required=False)
        if not organization:
            return Response({'alerts': [], 'tasks': [], 'summary': {}})

        membership = (
            Membership.objects.active()
            .filter(user=request.user, organization=organization)
            .prefetch_related('roles__permissions')
            .first()
        )
        modules = {item['slug'] for item in serialize_modules(organization, membership)}
        alerts = []
        tasks = []

        if Module.PROPERTY in modules:
            outstanding = (
                Invoice.objects.for_organization(organization)
                .exclude(status__in=(Invoice.Status.PAID, Invoice.Status.VOID))
                .aggregate(total=Sum('balance'))['total']
                or Decimal('0')
            )
            overdue = Invoice.objects.for_organization(organization).filter(status=Invoice.Status.OVERDUE).count()
            if outstanding > 0:
                alerts.append({
                    'module': 'property',
                    'severity': 'high',
                    'title': f'Outstanding rent {outstanding}',
                    'detail': f'{overdue} overdue invoices',
                    'href': '/property',
                })
            tasks.append({
                'module': 'property',
                'title': 'Review rent collection & arrears',
                'href': '/property',
                'priority': 2 if outstanding else 5,
            })

        if Module.FACILITY in modules:
            open_orders = WorkOrder.objects.for_organization(organization).exclude(
                status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED),
            ).count()
            if open_orders:
                alerts.append({
                    'module': 'facility',
                    'severity': 'medium',
                    'title': f'{open_orders} open work orders',
                    'detail': 'Facility maintenance queue',
                    'href': '/facility',
                })
            tasks.append({
                'module': 'facility',
                'title': 'Check open work orders & PM due',
                'href': '/facility',
                'priority': 2 if open_orders else 5,
            })

        if Module.MONITORING in modules:
            open_tickets = Ticket.objects.filter(organization=organization).exclude(
                status__in=('resolved', 'closed'),
            ).count()
            high_risks = Risk.objects.filter(
                organization=organization, likelihood__gte=4, impact__gte=4,
            ).exclude(status='closed').count()
            if open_tickets or high_risks:
                alerts.append({
                    'module': 'monitoring',
                    'severity': 'high',
                    'title': f'{open_tickets} issues · {high_risks} high risks',
                    'detail': 'Construction monitoring',
                    'href': '/monitoring',
                })
            tasks.append({
                'module': 'monitoring',
                'title': 'Monitor site risks and drawdowns',
                'href': '/monitoring',
                'priority': 1 if high_risks else 3,
            })

        if Module.SALES in modules:
            pending = SalePayment.objects.for_organization(organization).filter(
                status=SalePayment.Status.PENDING,
            ).count()
            if pending:
                alerts.append({
                    'module': 'sales',
                    'severity': 'medium',
                    'title': f'{pending} payments awaiting verification',
                    'detail': 'Sales collections',
                    'href': '/sales',
                })
            tasks.append({
                'module': 'sales',
                'title': 'Verify buyer payments',
                'href': '/sales',
                'priority': 2 if pending else 5,
            })

        if Module.TENDER in modules:
            active = Tender.objects.for_organization(organization).exclude(
                stage__in=(Tender.Stage.AWARDED, Tender.Stage.REGRETTED, Tender.Stage.SUBMITTED),
            ).count()
            if active:
                alerts.append({
                    'module': 'tender',
                    'severity': 'low',
                    'title': f'{active} active tenders in pipeline',
                    'detail': 'Tender management',
                    'href': '/tender',
                })
            tasks.append({
                'module': 'tender',
                'title': 'Review tender pipeline',
                'href': '/tender',
                'priority': 3,
            })

        if Module.VALUATION in modules:
            active_jobs = ValuationInstruction.objects.for_organization(organization).exclude(
                status__in=(
                    ValuationInstruction.Status.DELIVERED,
                    ValuationInstruction.Status.CANCELLED,
                    ValuationInstruction.Status.FINAL,
                ),
            ).count()
            tasks.append({
                'module': 'valuation',
                'title': f'Review {active_jobs} open valuation instruction(s)',
                'href': '/valuation',
                'priority': 3 if active_jobs else 6,
            })

        tasks = sorted(tasks, key=lambda item: item['priority'])[:8]
        return Response({
            'alerts': alerts,
            'tasks': tasks,
            'summary': {
                'alertCount': len(alerts),
                'taskCount': len(tasks),
                'modules': sorted(modules),
            },
        })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def security_audit(request):
    return Response({
        'debug': settings.DEBUG,
        'secure_ssl_redirect': getattr(settings, 'SECURE_SSL_REDIRECT', False),
        'session_cookie_secure': settings.SESSION_COOKIE_SECURE,
        'csrf_cookie_secure': settings.CSRF_COOKIE_SECURE,
        'hsts_seconds': getattr(settings, 'SECURE_HSTS_SECONDS', None),
        'cors_origins': getattr(settings, 'CORS_ALLOWED_ORIGINS', []),
        'allowed_hosts': settings.ALLOWED_HOSTS,
        'password_validators': [v['NAME'] for v in settings.AUTH_PASSWORD_VALIDATORS],
    })


@method_decorator(csrf_exempt, name='dispatch')
class RegisterView(APIView):
    """Self-service account registration. CSRF-exempt: protected by CORS + rate-limiting."""
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def post(self, request):
        User = get_user_model()
        data = request.data
        username = str(data.get('username', '')).strip()
        email = str(data.get('email', '')).strip()
        password = str(data.get('password', ''))
        first_name = str(data.get('first_name', '')).strip()
        last_name = str(data.get('last_name', '')).strip()
        organization_name = str(data.get('organization_name', '')).strip()

        errors = {}
        if not username:
            errors['username'] = ['This field is required.']
        elif User.objects.filter(username=username).exists():
            errors['username'] = ['A user with that username already exists.']
        if not email:
            errors['email'] = ['This field is required.']
        elif User.objects.filter(email=email).exists():
            errors['email'] = ['A user with that email already exists.']
        if not password:
            errors['password'] = ['This field is required.']
        if errors:
            return Response(errors, status=400)

        # Validate password strength
        try:
            validate_password(password)
        except DjangoValidationError as exc:
            return Response({'password': list(exc.messages)}, status=400)

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            is_active=True,
        )

        # Optionally create an organisation and link as admin
        if organization_name:
            try:
                from organizations.models import Organization
                import re
                slug = re.sub(r'[^a-z0-9]+', '-', organization_name.lower()).strip('-')[:50]
                # Make slug unique
                base_slug = slug
                counter = 1
                while Organization.objects.filter(slug=slug).exists():
                    slug = f'{base_slug}-{counter}'
                    counter += 1
                org = Organization.objects.create(name=organization_name, slug=slug)
                Membership.objects.create(user=user, organization=org, is_organization_admin=True, is_default=True)
            except Exception:
                pass  # Organisation creation is optional, don't fail registration

        return Response({
            'detail': 'Account created successfully. You can now sign in.',
            'username': user.username,
        }, status=201)


@method_decorator(csrf_exempt, name='dispatch')
class PasswordResetRequestView(APIView):
    """Initiate a password reset. Always returns 200 to prevent email enumeration.
    CSRF-exempt: no authenticated state; protected by CORS + rate-limiting."""
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def post(self, request):
        email = str(request.data.get('email', '')).strip()
        if email:
            User = get_user_model()
            user = User.objects.filter(email=email, is_active=True).first()
            if user:
                # In production, send a reset email here.
                # For now we log the intent but always return a neutral response.
                import logging
                logging.getLogger(__name__).info('Password reset requested for %s', email)
        return Response({'detail': 'If an account with that email exists, you will receive a reset link shortly.'})

