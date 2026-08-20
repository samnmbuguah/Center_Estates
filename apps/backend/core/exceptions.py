import logging
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
        logger.error(
            "Unhandled exception in %s on path %s: %s",
            view_name, path, str(exc),
            exc_info=True
        )
        return Response(
            {
                "detail": f"An internal server error occurred while processing this request.",
                "error": str(exc) if hasattr(exc, '__str__') else "Server Error",
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return response
