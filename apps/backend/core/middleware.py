class OrganizationContextMiddleware:
    """Capture tenant intent; authorization occurs in get_active_organization."""

    header_name = 'HTTP_X_ORGANIZATION_ID'

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.requested_organization_id = request.META.get(self.header_name) or None
        request.organization = None
        if getattr(request, 'user', None) and request.user.is_authenticated:
            from .tenancy import get_active_organization
            request.organization = get_active_organization(request, required=False)
        return self.get_response(request)
