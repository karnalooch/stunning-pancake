"""Structured helpers for security-relevant audit events.

T70 treats ``AuditLog`` as an append-only security record.  Callers should
record stable action identifiers and small, non-secret metadata instead of
serialising request bodies or credentials into ``details``.
"""

from __future__ import annotations

from typing import Any

from .models import AuditLog, User


def _client_ip(request) -> str | None:
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",", 1)[0].strip() or None
    return request.META.get("REMOTE_ADDR")


def record_audit_event(
    *,
    actor: User | None,
    action: str,
    status_code: int,
    tenant_id: object | None = None,
    target_user: User | None = None,
    request=None,
    details: dict[str, Any] | None = None,
) -> AuditLog:
    """Append one security audit event.

    ``details`` must contain identifiers/state needed to understand the
    mutation, never tokens, passwords, raw request bodies or GPS coordinates.
    """

    return AuditLog.objects.create(
        impersonator=actor,
        target_user=target_user,
        tenant_id=str(tenant_id) if tenant_id else None,
        action=action,
        details=details or {},
        ip_address=_client_ip(request),
        status_code=status_code,
    )
