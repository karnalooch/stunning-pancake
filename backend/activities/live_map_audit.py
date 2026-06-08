"""
Live Map view audit — fire-and-forget operator access logging.
"""

from __future__ import annotations

import hashlib
import logging
from typing import Any

logger = logging.getLogger(__name__)

_AUDIT_DEDUPE_PREFIX = "{livemap}:audit:"
_AUDIT_RATE_TTL = 30


def _client_ip(request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _dedupe_key(user_id: int, session_id: str, bbox_hash: str) -> str:
    digest = hashlib.sha256(f"{user_id}:{session_id}:{bbox_hash}".encode()).hexdigest()[:24]
    return f"{_AUDIT_DEDUPE_PREFIX}{digest}"


def should_skip_audit(user_id: int, session_id: str, bbox_hash: str) -> bool:
    """Idempotent per session+bbox — max 1 audit / 30s."""
    if not session_id or not bbox_hash:
        return False
    try:
        from core.redis_cluster import get_redis

        key = _dedupe_key(user_id, session_id, bbox_hash)
        return not bool(get_redis().set(key, "1", nx=True, ex=_AUDIT_RATE_TTL))
    except Exception:
        return False


def record_live_map_view(request, payload: dict[str, Any]) -> dict[str, Any]:
    """
    Persist LIVE_MAP_VIEW audit row. Returns {recorded, skipped}.
    """
    user = request.user
    if not user or not user.is_authenticated:
        return {"recorded": False, "skipped": True, "reason": "unauthenticated"}

    session_id = str(payload.get("session_id") or "").strip()
    bbox_hash = str(payload.get("bbox_hash") or "").strip()
    if should_skip_audit(user.id, session_id, bbox_hash):
        return {"recorded": False, "skipped": True, "reason": "rate_limited"}

    details = {
        "zoom": payload.get("zoom"),
        "tier": payload.get("tier"),
        "bbox_hash": bbox_hash,
        "filters": payload.get("filters") or {},
        "positions_returned": payload.get("positions_returned"),
        "detail": payload.get("detail"),
        "read_mode": payload.get("read_mode"),
        "session_id": session_id,
    }

    tenant_id = None
    if getattr(user, "tenant_id", None):
        tenant_id = str(user.tenant_id)

    try:
        from users.models import AuditLog

        AuditLog.objects.create(
            impersonator_id=user.id,
            target_user_id=user.id,
            tenant_id=tenant_id,
            action="LIVE_MAP_VIEW",
            details=details,
            ip_address=_client_ip(request),
            status_code=200,
        )
        return {"recorded": True, "skipped": False}
    except Exception as exc:
        logger.warning("live_map.audit.failed err=%s", exc)
        return {"recorded": False, "skipped": False, "error": str(exc)[:120]}
