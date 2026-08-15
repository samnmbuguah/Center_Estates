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
                    "frame-ancestors 'self' https://posthog.com https://preview.posthog.com https://vercel.com https://us.posthog.com"
                )
            
            response['X-Content-Type-Options'] = 'nosniff'
            response['X-Frame-Options'] = 'SAMEORIGIN'
            response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
            response['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        return response


