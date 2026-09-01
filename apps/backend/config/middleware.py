import logging
import time
import uuid


request_logger = logging.getLogger("center_estates.requests")


class RequestObservabilityMiddleware:
    """Log failed and slow API requests without recording sensitive payloads."""

    slow_request_seconds = 2.0

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:16]
        # Make the same safe correlation ID available to DRF's exception handler.
        request.request_id = request_id
        started = time.monotonic()
        try:
            response = self.get_response(request)
        except Exception:
            elapsed = time.monotonic() - started
            request_logger.exception(
                "request_failed id=%s method=%s path=%s elapsed_ms=%d",
                request_id, request.method, request.path, round(elapsed * 1000),
            )
            raise

        elapsed = time.monotonic() - started
        response["X-Request-ID"] = request_id
        if response.status_code >= 500:
            request_logger.error(
                "request_5xx id=%s method=%s path=%s status=%d elapsed_ms=%d",
                request_id, request.method, request.path, response.status_code,
                round(elapsed * 1000),
            )
        elif elapsed >= self.slow_request_seconds:
            request_logger.warning(
                "request_slow id=%s method=%s path=%s status=%d elapsed_ms=%d",
                request_id, request.method, request.path, response.status_code,
                round(elapsed * 1000),
            )
        return response


class ContentSecurityPolicyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # Check for test mode header from E2E tests
        is_test_mode = request.headers.get('X-Test-Mode') == 'true'
        
        if request.path.startswith('/api/'):
            # In test mode, relax CSP restrictions for easier E2E testing
            if is_test_mode:
                response['Content-Security-Policy'] = (
                    "default-src 'self' *; "
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' *; "
                    "style-src 'self' 'unsafe-inline' *; "
                    "img-src 'self' data: https: *; "
                    "font-src 'self' data: https: *; "
                    "connect-src 'self' https: *; "
                    "frame-ancestors 'self' *; "
                    "frame-src 'self' *;"
                )
            else:
                response['Content-Security-Policy'] = (
                    "default-src 'self'; "
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
                    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
                    "img-src 'self' data: https:; "
                    "font-src 'self' data: https: https://fonts.gstatic.com; "
                    "connect-src 'self' https:; "
                    "frame-ancestors 'self' https://posthog.com https://*.posthog.com https://preview.posthog.com https://vercel.com https://us.posthog.com https://eu.posthog.com;"
                )
            
            response['X-Content-Type-Options'] = 'nosniff'
            response['X-Frame-Options'] = 'SAMEORIGIN'
            response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
            response['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        return response
