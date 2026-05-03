"""
Consistent API response helpers and error handler for SPORT Platform.

Usage:
    from core.api_response import success, error, paginated

    return success(data={"user": ...})
    return error("Not found", status=404)
"""

from rest_framework.response import Response
from rest_framework import status


def success(data=None, message=None, status_code=status.HTTP_200_OK):
    """Return a consistent success response."""
    body = {"ok": True}
    if data is not None:
        body["data"] = data
    if message:
        body["message"] = message
    return Response(body, status=status_code)


def error(message, details=None, status_code=status.HTTP_400_BAD_REQUEST):
    """Return a consistent error response."""
    body = {"ok": False, "error": message}
    if details:
        body["details"] = details
    return Response(body, status=status_code)


def paginated(queryset, serializer_class, request, context=None):
    """Return a paginated response. Falls back to full list if no pagination configured."""
    from rest_framework.pagination import PageNumberPagination
    paginator = PageNumberPagination()
    page = paginator.paginate_queryset(queryset, request)
    if page is not None:
        serialized = serializer_class(page, many=True, context=context)
        return paginator.get_paginated_response(serialized.data)
    serialized = serializer_class(queryset, many=True, context=context)
    return Response(serialized.data)
