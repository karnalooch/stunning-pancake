"""
Redis-backed burst protection for coordinated event starts.

Auto mode (default): rate limits apply for large/active events or on load spikes.
Set EVENT_BURST_MODE=on|off to force always/never.
"""

from __future__ import annotations

import json
import logging
import math
import time
import uuid
from typing import Any

from django.utils import timezone

from core.redis_cluster import get_redis

from .models import Event, Participation
from .scale_config import (
    EVENT_BURST_AUTO_MIN_PARTICIPANTS,
    EVENT_BURST_AUTO_TTL_SECONDS,
    EVENT_BURST_LOAD_JOIN_THRESHOLD,
    EVENT_BURST_LOAD_SESSION_THRESHOLD,
    EVENT_BURST_LOAD_SPIKE_JOIN_THRESHOLD,
    EVENT_BURST_MODE,
    EVENT_BURST_PUBLISHED_HOURS_BEFORE_START,
    EVENT_JOIN_RATE_PER_MINUTE,
    EVENT_SESSION_START_RATE_PER_MINUTE,
    EVENT_START_STAGGER_SECONDS,
    SCALE_EVENT_LOAD_TEST,
)

logger = logging.getLogger(__name__)

_WINDOW_SECONDS = 60
_META_TTL = 86400 * 7
_TRACK_LIMIT = 999_999_999  # always record in sliding window for load detection


def _event_tag(event_id: int) -> str:
    """Hash tag for Redis Cluster — all burst keys for one event share a slot."""
    return f"{{{event_id}}}"


def burst_keys(event_id: int) -> dict[str, str]:
    tag = _event_tag(event_id)
    return {
        "join_window": f"{tag}:burst:join:sw",
        "session_window": f"{tag}:burst:session:sw",
        "meta": f"{tag}:burst:meta",
        "warm": f"{tag}:burst:warm",
        "active": f"{tag}:burst:active",
        "auto": f"{tag}:burst:auto",
        "session_queue": f"{tag}:burst:session:queue",
        "active_session": f"{tag}:burst:active_session",
    }


def is_burst_globally_enabled() -> bool:
    """False only when EVENT_BURST_MODE=off (dev)."""
    return EVENT_BURST_MODE != "off"


def is_burst_enabled_for_event(event_id: int, event: Event | None = None) -> bool:
    """
    Whether join/session rate limits apply for this event.

    Auto rules (any): force on, Redis burst:auto (load spike), burst:active (warm),
    participation >= AUTO_MIN + (ACTIVE or PUBLISHED near start).
    """
    if EVENT_BURST_MODE == "off":
        return False
    if EVENT_BURST_MODE == "on":
        return True

    if _redis_flag(burst_keys(event_id)["auto"]) or _redis_flag(burst_keys(event_id)["active"]):
        return True

    event = event or Event.objects.filter(pk=event_id).only("status", "start_date").first()
    if not event or not _event_in_burst_window(event):
        return False

    return participation_count(event_id) >= EVENT_BURST_AUTO_MIN_PARTICIPANTS


def _event_in_burst_window(event: Event) -> bool:
    if event.status == "ACTIVE":
        return True
    if event.status != "PUBLISHED":
        return False
    now = timezone.now()
    if event.start_date <= now:
        return True
    hours = EVENT_BURST_PUBLISHED_HOURS_BEFORE_START
    until_start = (event.start_date - now).total_seconds()
    return 0 <= until_start <= hours * 3600


def participation_count(event_id: int) -> int:
    return Participation.objects.filter(event_id=event_id).count()


def _redis_flag(key: str) -> bool:
    try:
        return bool(get_redis().get(key))
    except Exception:
        return False


def set_burst_auto(event_id: int) -> None:
    """Mark event as load-spike protected (TTL)."""
    try:
        get_redis().set(
            burst_keys(event_id)["auto"],
            "1",
            ex=EVENT_BURST_AUTO_TTL_SECONDS,
        )
        logger.info("event.burst_auto event_id=%s ttl=%ss", event_id, EVENT_BURST_AUTO_TTL_SECONDS)
    except Exception as exc:
        logger.warning("event_burst.auto_flag_failed event_id=%s err=%s", event_id, exc)


def set_burst_warm_active(event_id: int, event: Event) -> None:
    """Called from warm_event_start for large / load-test events."""
    count = participation_count(event_id)
    if count >= EVENT_BURST_AUTO_MIN_PARTICIPANTS or SCALE_EVENT_LOAD_TEST:
        try:
            get_redis().set(burst_keys(event_id)["active"], "1", ex=_META_TTL)
            logger.info(
                "event.burst_warm_active event_id=%s participants=%s",
                event_id,
                count,
            )
        except Exception as exc:
            logger.warning("event_burst.active_flag_failed event_id=%s err=%s", event_id, exc)


def _maybe_auto_enable_from_load(event_id: int) -> None:
    keys = burst_keys(event_id)
    joins = sliding_window_count(keys["join_window"])
    sessions = sliding_window_count(keys["session_window"])
    if (
        joins > EVENT_BURST_LOAD_SPIKE_JOIN_THRESHOLD
        or joins > EVENT_BURST_LOAD_JOIN_THRESHOLD
        or sessions > EVENT_BURST_LOAD_SESSION_THRESHOLD
    ):
        set_burst_auto(event_id)


def sliding_window_count(
    redis_key: str,
    *,
    window_seconds: int = _WINDOW_SECONDS,
) -> int:
    """Current count in the sliding window without incrementing."""
    now = time.time()
    try:
        r = get_redis()
        r.zremrangebyscore(redis_key, 0, now - window_seconds)
        return int(r.zcard(redis_key) or 0)
    except Exception:
        return 0


def sliding_window_try(
    redis_key: str,
    limit: int,
    *,
    window_seconds: int = _WINDOW_SECONDS,
) -> tuple[bool, int, int]:
    """
    Increment a sliding-window counter. Returns (allowed, current_count, retry_after_seconds).
    """
    if limit <= 0:
        return True, 0, 0

    now = time.time()
    member = f"{now}:{uuid.uuid4().hex[:8]}"
    try:
        r = get_redis()
        pipe = r.pipeline()
        pipe.zremrangebyscore(redis_key, 0, now - window_seconds)
        pipe.zadd(redis_key, {member: now})
        pipe.zcard(redis_key)
        pipe.expire(redis_key, window_seconds + 10)
        _, _, count, _ = pipe.execute()
        count = int(count or 0)
        if count > limit:
            r.zrem(redis_key, member)
            retry = max(1, int(math.ceil(window_seconds - (now % window_seconds))))
            return False, count - 1, retry
        return True, count, 0
    except Exception as exc:
        logger.warning("event_burst.redis_failed key=%s err=%s", redis_key, exc)
        return True, 0, 0


def _track_and_check_limit(
    redis_key: str,
    event_id: int,
    *,
    rate_per_minute: int,
    check_load: bool = True,
) -> tuple[bool, int, int]:
    """Record attempt in window; enforce limit only when burst is enabled for event."""
    _, count, _ = sliding_window_try(redis_key, _TRACK_LIMIT)
    if check_load:
        _maybe_auto_enable_from_load(event_id)
    if not is_burst_enabled_for_event(event_id):
        return True, count, 0
    if count > rate_per_minute:
        retry = max(1, int(math.ceil(_WINDOW_SECONDS - (time.time() % _WINDOW_SECONDS))))
        return False, count, retry
    return True, count, 0


def join_rate_limit(event_id: int) -> tuple[bool, int, int]:
    if not is_burst_globally_enabled():
        return True, 0, 0
    keys = burst_keys(event_id)
    return _track_and_check_limit(
        keys["join_window"],
        event_id,
        rate_per_minute=EVENT_JOIN_RATE_PER_MINUTE,
    )


def session_start_rate_limit(event_id: int) -> tuple[bool, int, int]:
    if not is_burst_globally_enabled():
        return True, 0, 0
    keys = burst_keys(event_id)
    return _track_and_check_limit(
        keys["session_window"],
        event_id,
        rate_per_minute=EVENT_SESSION_START_RATE_PER_MINUTE,
    )


def cache_event_meta(event: Event) -> None:
    """Store lightweight event metadata in Redis for fast reads during go-live."""
    keys = burst_keys(event.id)
    count = participation_count(event.id)
    payload = {
        "id": event.id,
        "title": event.title,
        "status": event.status,
        "start_date": event.start_date.isoformat(),
        "end_date": event.end_date.isoformat(),
        "event_type": event.event_type,
        "tenant_id": event.tenant_id,
        "burst_mode": EVENT_BURST_MODE,
        "burst_enabled": is_burst_enabled_for_event(event.id, event),
        "participant_count": count,
        "join_rate_per_minute": EVENT_JOIN_RATE_PER_MINUTE,
        "session_rate_per_minute": EVENT_SESSION_START_RATE_PER_MINUTE,
        "stagger_seconds": EVENT_START_STAGGER_SECONDS,
        "cached_at": timezone.now().isoformat(),
    }
    try:
        r = get_redis()
        r.set(keys["meta"], json.dumps(payload), ex=_META_TTL)
        r.set(keys["warm"], "1", ex=_META_TTL)
    except Exception as exc:
        logger.warning("event_burst.cache_meta_failed event_id=%s err=%s", event.id, exc)


def reset_burst_counters(event_id: int) -> None:
    keys = burst_keys(event_id)
    try:
        r = get_redis()
        r.delete(
            keys["join_window"],
            keys["session_window"],
            keys["session_queue"],
        )
    except Exception as exc:
        logger.warning("event_burst.reset_failed event_id=%s err=%s", event_id, exc)


def get_cached_meta(event_id: int) -> dict | None:
    try:
        raw = get_redis().get(burst_keys(event_id)["meta"])
        if raw:
            return json.loads(raw)
    except Exception:
        pass
    return None


def active_session_redis_key(event_id: int, user_id: int) -> str:
    return f"{burst_keys(event_id)['active_session']}:{user_id}"


def get_active_session_activity_id(event_id: int, user_id: int) -> int | None:
    try:
        raw = get_redis().get(active_session_redis_key(event_id, user_id))
        if raw:
            return int(raw)
    except Exception:
        pass
    return None


def set_active_session(
    event_id: int, user_id: int, activity_id: int, ttl_seconds: int = 86400
) -> None:
    try:
        get_redis().set(
            active_session_redis_key(event_id, user_id), str(activity_id), ex=ttl_seconds
        )
    except Exception as exc:
        logger.warning(
            "event_burst.active_session_set_failed event=%s user=%s err=%s",
            event_id,
            user_id,
            exc,
        )


def clear_active_session(event_id: int, user_id: int) -> None:
    try:
        get_redis().delete(active_session_redis_key(event_id, user_id))
    except Exception as exc:
        logger.warning(
            "event_burst.active_session_clear_failed event=%s user=%s err=%s",
            event_id,
            user_id,
            exc,
        )


def queue_session_start(event_id: int, user_id: int, payload: dict) -> int:
    """Enqueue deferred session create; returns 1-based queue position."""
    keys = burst_keys(event_id)
    entry = json.dumps({"user_id": user_id, "payload": payload, "ts": time.time()})
    try:
        r = get_redis()
        r.lpush(keys["session_queue"], entry)
        r.expire(keys["session_queue"], _META_TTL)
        return int(r.llen(keys["session_queue"]) or 1)
    except Exception as exc:
        logger.warning("event_burst.queue_failed event_id=%s err=%s", event_id, exc)
        return 0


def burst_protection_meta(
    event: Event,
    *,
    user=None,
    lightweight: bool = False,
) -> dict[str, Any]:
    """Client-facing burst hints for event detail / join responses."""
    enabled = is_burst_enabled_for_event(event.id, event)
    if lightweight:
        from events.scale_config import EVENT_MAX_CONCURRENT_RIDERS

        return {
            "enabled": enabled,
            "mode": EVENT_BURST_MODE,
            "max_concurrent_riders_hint": EVENT_MAX_CONCURRENT_RIDERS,
        }

    join_allowed = True
    queue_position = None
    retry_after = 0

    if enabled:
        keys = burst_keys(event.id)
        count = sliding_window_count(keys["join_window"])
        join_allowed = count < EVENT_JOIN_RATE_PER_MINUTE
        if not join_allowed:
            retry_after = max(1, int(_WINDOW_SECONDS - (time.time() % _WINDOW_SECONDS)))
            queue_position = max(1, count - EVENT_JOIN_RATE_PER_MINUTE + 1)

    stagger_hint = EVENT_START_STAGGER_SECONDS
    if user and user.is_authenticated:
        try:
            Participation.objects.get(event=event, user=user)
        except Participation.DoesNotExist:
            pass

    return {
        "enabled": enabled,
        "mode": EVENT_BURST_MODE,
        "join_allowed": join_allowed,
        "stagger_hint_seconds": stagger_hint,
        "retry_after_seconds": retry_after if not join_allowed else 0,
        "queue_position": queue_position,
        "join_rate_per_minute": EVENT_JOIN_RATE_PER_MINUTE,
        "session_start_rate_per_minute": EVENT_SESSION_START_RATE_PER_MINUTE,
        "max_concurrent_riders_hint": None,  # filled by serializer from scale_config
    }


def join_event(user, event: Event) -> tuple[Participation, bool, dict | None]:
    """
    Idempotent event join with optional rate limit.

    Returns (participation, created, error_dict).
    error_dict is set when rate limited: {'status': 429, 'retry_after': N, 'detail': ...}
    """
    existing = Participation.objects.filter(event=event, user=user).first()
    if existing:
        return existing, False, None

    # Global always-on guard (platform-wide, independent of this event's size).
    try:
        from core.load_guard import check_join as _global_check_join

        gdecision = _global_check_join()
        if not gdecision.allowed:
            return (
                None,
                False,
                {
                    "status": 429,
                    "retry_after": gdecision.retry_after,
                    "detail": "Platform join rate limit exceeded. Please retry shortly.",
                    "detail_pl": "Globalny limit dołączeń — spróbuj za chwilę.",
                },
            )
    except Exception:
        pass

    if is_burst_globally_enabled():
        allowed, _, retry_after = join_rate_limit(event.id)
        if not allowed:
            return (
                None,
                False,
                {
                    "status": 429,
                    "retry_after": retry_after,
                    "detail": "Event join rate limit exceeded. Please retry shortly.",
                    "detail_pl": "Limit dołączeń do wydarzenia — spróbuj za chwilę.",
                },
            )

    participation, created = Participation.objects.get_or_create(event=event, user=user)
    if created:
        logger.info("event.join user_id=%s event_id=%s", user.id, event.id)
    return participation, created, None


def resolve_event_for_session(user, event_id: int | None) -> Event | None:
    """Active event the user participates in (explicit id or first match)."""
    if event_id is not None:
        try:
            event = Event.objects.get(pk=event_id)
        except Event.DoesNotExist:
            return None
        if not Participation.objects.filter(event=event, user=user).exists():
            return None
        if event.status not in ("PUBLISHED", "ACTIVE"):
            return None
        return event

    now = timezone.now()
    return (
        Event.objects.filter(
            participations__user=user,
            status__in=("PUBLISHED", "ACTIVE"),
            start_date__lte=now,
            end_date__gte=now,
        )
        .order_by("-start_date")
        .first()
    )


def max_starts_per_live_tick(total_users: int, active_ratio: float, tick_seconds: int) -> int:
    """Cap new sim rides per tick when staggering event load."""
    target = max(1, int(total_users * active_ratio))
    if EVENT_START_STAGGER_SECONDS <= 0 or tick_seconds <= 0:
        return target
    ticks_in_window = max(1, EVENT_START_STAGGER_SECONDS // tick_seconds)
    return max(1, math.ceil(target / ticks_in_window))


def effective_event_concurrent_cap(live_state: dict | None = None) -> int:
    from activities.scale_config import MAX_CONCURRENT_RIDERS
    from events.scale_config import EVENT_MAX_CONCURRENT_RIDERS, SCALE_EVENT_LOAD_TEST

    state = live_state or {}
    if state.get("event_id") or SCALE_EVENT_LOAD_TEST:
        return EVENT_MAX_CONCURRENT_RIDERS
    return MAX_CONCURRENT_RIDERS
