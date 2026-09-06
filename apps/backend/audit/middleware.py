from asgiref.local import Local

_current_request = Local()


def get_current_request():
    """Retrieve the current thread/async task HTTP request."""
    return getattr(_current_request, 'request', None)


def set_current_request(request):
    """Bind the current request to thread/task local context."""
    _current_request.request = request


def get_client_ip(request):
    """Extract client IP address, safely handling trusted reverse proxies."""
    if not request:
        return ''
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
        if ip:
            return ip
    return request.META.get('REMOTE_ADDR') or ''


def get_client_user_agent(request):
    """Extract client User-Agent string."""
    if not request:
        return ''
    return request.META.get('HTTP_USER_AGENT') or ''


class AuditRequestMiddleware:
    """Middleware that stores the active HTTP request in thread-local storage

    so signals (such as post_save/post_delete audit loggers) have access to the
    authenticated actor, client IP address, and device User-Agent.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        set_current_request(request)
        try:
            return self.get_response(request)
        finally:
            set_current_request(None)
