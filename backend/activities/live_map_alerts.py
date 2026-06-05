"""
Live Map alert detector — async edge evaluation, never in poll/SSE path.
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any

logger = logging.getLogger(__name__)

_DEDUPE_PREFIX = "livemap:alert:"
_DEDUPE_TTL = 600
_BUCKET_SECONDS = 600

FLAGGED_SPIKE_THRESHOLD = 25
SYNC_STALE_SECONDS = 45


def _bucket_10min() -> int:
    return int(time.time() // _BUCKET_SECONDS) * _BUCKET_SECONDS


def _dedupe_key(tenant_id: str, event: str) -> str:
    return f"{_DEDUPE_PREFIX}{tenant_id}:{event}:{_bucket_10min()}"


def _should_fire(tenant_id: str, event: str) -> bool:
    try:
        from core.redis_cluster import get_redis

        key = _dedupe_key(tenant_id, event)
        return bool(get_redis().set(key, "1", nx=True, ex=_DEDUPE_TTL))
    except Exception:
        return True


def _detect_events(meta: dict[str, Any]) -> list[str]:
    events: list[str] = []
    returned = int(meta.get("positions_returned") or meta.get("viewport_returned") or 0)
    estimate = meta.get("viewport_total_estimate")
    capped = bool(meta.get("capped"))
    ride_on_map = int(meta.get("ride_on_map") or meta.get("active_riding") or 0)
    flagged = int(meta.get("flagged_in_viewport") or 0)
    server_time = float(meta.get("server_time") or time.time())
    last_success = meta.get("last_success_at")

    if capped and isinstance(estimate, (int, float)) and estimate > 2 * returned:
        events.append("viewport_capped")

    if ride_on_map > 0 and returned == 0:
        events.append("zero_positions_anomaly")

    if flagged >= FLAGGED_SPIKE_THRESHOLD:
        events.append("flagged_spike")

    if last_success is not None:
        try:
            lag = server_time - float(last_success)
            if lag > SYNC_STALE_SECONDS:
                events.append("sync_stale")
        except (TypeError, ValueError):
            pass

    return events


def evaluate_live_map_alerts(meta: dict[str, Any], tenant_id: str | None) -> list[str]:
    """
    Evaluate meta snapshot for tenant; enqueue webhook deliveries for matching events.
    Returns list of events dispatched.
    """
    from core.models import FeatureFlag

    if not FeatureFlag.is_enabled("live_map_webhooks"):
        return []
    if not tenant_id:
        return []

    from activities.models_webhooks import LiveMapAlertWebhook

    webhooks = list(
        LiveMapAlertWebhook.objects.filter(tenant_id=tenant_id, enabled=True)
    )
    if not webhooks:
        return []

    fired: list[str] = []
    for event in _detect_events(meta):
        if not _should_fire(str(tenant_id), event):
            continue
        subscribed = [wh for wh in webhooks if event in (wh.events or [])]
        if not subscribed:
            continue
        event_id = str(uuid.uuid4())
        payload = {
            "event": event,
            "event_id": event_id,
            "tenant_id": str(tenant_id),
            "timestamp": time.time(),
            "meta": {
                "positions_returned": meta.get("positions_returned"),
                "viewport_total_estimate": meta.get("viewport_total_estimate"),
                "capped": meta.get("capped"),
                "ride_on_map": meta.get("ride_on_map"),
                "flagged_in_viewport": meta.get("flagged_in_viewport"),
                "read_mode": meta.get("read_mode"),
            },
        }
        from activities.tasks import deliver_live_map_webhook

        for wh in subscribed:
            deliver_live_map_webhook.delay(wh.id, event_id, payload)
        fired.append(event)
        logger.info(
            "live_map.alert.dispatched event=%s tenant=%s webhooks=%s",
            event,
            tenant_id,
            len(subscribed),
        )
    return fired


def build_tenant_alert_meta(tenant_id: str) -> dict[str, Any]:
    """Build meta snapshot for alert detector (Celery / post-snapshot)."""
    from activities.live_map_api import LiveMapRequest, build_live_map_payload

    req = LiveMapRequest(
        bbox_tuple=(14.0, 49.0, 24.0, 55.0),
        limit=500,
        zoom_param=8.0,
        detail="standard",
        fetch_limit=500,
        skip_cache=True,
        activity_type=None,
        city_slug=None,
        tenant_id=str(tenant_id),
        department_id=None,
        department_ids=None,
    )
    body = build_live_map_payload(req)
    meta = body.get("meta") or {}
    meta["positions_returned"] = body.get("meta", {}).get("positions_returned", 0)
    return meta


def evaluate_all_tenant_alerts() -> dict[str, Any]:
    """Beat task — evaluate alerts for tenants with enabled webhooks."""
    from activities.models_webhooks import LiveMapAlertWebhook

    tenant_ids = (
        LiveMapAlertWebhook.objects.filter(enabled=True)
        .values_list("tenant_id", flat=True)
        .distinct()
    )
    total_fired = 0
    for tid in tenant_ids:
        meta = build_tenant_alert_meta(str(tid))
        total_fired += len(evaluate_live_map_alerts(meta, str(tid)))
    return {"tenants": len(tenant_ids), "events_fired": total_fired}
