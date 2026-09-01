import logging
import uuid
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    # Call REST framework's default exception handler first to get standard error response.
    response = exception_handler(exc, context)

    # If an unhandled exception occurred, format it as a clean JSON response instead of crashing
    if response is None:
        view = context.get('view')
        view_name = view.__class__.__name__ if view else 'UnknownView'
        request = context.get('request')
        path = getattr(request, 'path', 'UnknownPath')
        django_request = getattr(request, '_request', request)
        request_id = (
            getattr(request, 'request_id', None)
            or getattr(django_request, 'request_id', None)
            or uuid.uuid4().hex[:16]
        )
        logger.error(
            "Unhandled exception id=%s in %s on path %s: %s",
            request_id, view_name, path, str(exc),
            exc_info=True
        )
        return Response(
            {
                # Internal exception text can reveal implementation details and is
                # not actionable for an end user.  Keep it in the server log,
                # correlated with this safe reference for support follow-up.
                "detail": "We could not complete this request right now. Please retry.",
                "error_id": request_id,
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return response
