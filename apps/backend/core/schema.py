from django.conf import settings
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from drf_spectacular.plumbing import build_bearer_security_scheme_object


class CookieJWTScheme(OpenApiAuthenticationExtension):
    """Document both authentication transports accepted by the unified API."""

    target_class = 'core.authentication.CookieJWTAuthentication'
    name = ['jwtAuth', 'cookieAuth']

    def get_security_requirement(self, auto_schema):
        # The authentication class accepts either transport; they are not an
        # AND pair. Cookie mutations additionally require the CSRF cookie and
        # X-CSRFToken header, documented in the scheme description.
        return [{'jwtAuth': []}, {'cookieAuth': []}]

    def get_security_definition(self, auto_schema):
        return [
            build_bearer_security_scheme_object(
                header_name='HTTP_AUTHORIZATION',
                token_prefix='Bearer',
                bearer_format='JWT',
            ),
            {
                'type': 'apiKey',
                'in': 'cookie',
                'name': settings.JWT_ACCESS_COOKIE,
                'description': (
                    'Same-origin HttpOnly JWT cookie. Unsafe requests also '
                    'require the csrftoken cookie and matching X-CSRFToken header.'
                ),
            },
        ]
