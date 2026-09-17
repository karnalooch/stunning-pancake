"""Fail-closed pilot read scope for activity detail and GPX export."""

from __future__ import annotations

from .models import Activity
from .views import ActivityDetailView, ActivityGpxExportView

TENANT_READ_ROLES = ("TENANT_ADMIN", "TENANT_MODERATOR")


def scoped_activity_queryset(user):
    """Return the strongest allowed activity read scope for ``user``.

    This is explicit ORM defence in depth on top of PostgreSQL FORCE RLS. A
    tenant-scoped role without a tenant is never promoted to a platform-wide
    read; it receives an empty queryset. Regular athletes remain owner-only.
    """

    qs = Activity.objects.select_related("user")
    role = getattr(user, "role", None)
    if role == "GLOBAL_OWNER":
        return qs
    if role in TENANT_READ_ROLES:
        tenant_id = getattr(user, "tenant_id", None)
        if tenant_id is None:
            return qs.none()
        return qs.filter(tenant_id=tenant_id)
    return qs.filter(user=user)


class PilotSafeActivityDetailView(ActivityDetailView):
    def get_queryset(self):
        return scoped_activity_queryset(self.request.user)


class PilotSafeActivityGpxExportView(ActivityGpxExportView):
    def get_queryset(self):
        return scoped_activity_queryset(self.request.user)
