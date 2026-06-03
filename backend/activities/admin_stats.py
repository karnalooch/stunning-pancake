"""
Cached, aggregate-based admin dashboard KPIs — safe during 300k batch runs.
"""

from __future__ import annotations

import json
import logging
import time
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum
from django.utils import timezone

from activities.models import Activity
from users.models import Tenant

logger = logging.getLogger(__name__)

STATS_CACHE_KEY = "{admin}:dashboard:stats"
STATS_CACHE_TTL = 120  # seconds


def _scoped_tenant_id(request_user) -> str | None:
    """Tenant admins/moderators see only their tenant KPIs."""
    role = getattr(request_user, "role", None)
    if role in ("TENANT_ADMIN", "TENANT_MODERATOR") and getattr(request_user, "tenant_id", None):
        return str(request_user.tenant_id)
    return None


def _stats_cache_key(request_user) -> str:
    tid = _scoped_tenant_id(request_user)
    if tid:
        return f"{{admin}}:dashboard:stats:tenant:{tid}"
    return STATS_CACHE_KEY


def _redis():
    from core.redis_cluster import get_redis

    return get_redis()


def get_cached_dashboard_stats(request_user=None) -> dict | None:
    cache_key = _stats_cache_key(request_user) if request_user is not None else STATS_CACHE_KEY
    try:
        raw = _redis().get(cache_key)
        if raw:
            return json.loads(raw.decode() if isinstance(raw, bytes) else raw)
    except Exception:
        pass
    return None


def set_cached_dashboard_stats(payload: dict, request_user=None) -> None:
    cache_key = _stats_cache_key(request_user) if request_user is not None else STATS_CACHE_KEY
    try:
        _redis().setex(cache_key, STATS_CACHE_TTL, json.dumps(payload))
    except Exception:
        pass


def invalidate_dashboard_stats_cache(tenant_id: str | None = None) -> None:
    try:
        r = _redis()
        r.delete(STATS_CACHE_KEY)
        if tenant_id:
            r.delete(f"{{admin}}:dashboard:stats:tenant:{tenant_id}")
    except Exception:
        pass


def _batch_or_live_running() -> bool:
    try:
        from activities import simulator_state as sim

        return bool(sim.get_batch_state().get("running") or sim.get_live_state().get("running"))
    except Exception:
        return False


def _empty_stats(*, stale: bool = False, note: str | None = None) -> dict:
    payload = {
        "total_users": 0,
        "total_activities": 0,
        "total_distance_km": 0.0,
        "total_calories": 0,
        "new_users_today": 0,
        "new_users_last_7d": 0,
        "new_activities_last_7d": 0,
        "verified_total": 0,
        "verified_pct": 0.0,
        "unverified_total": 0,
        "per_tenant": [],
        "per_department": [],
        "stale": stale,
        "batch_running": False,
        "cached_at": time.time(),
    }
    if note:
        payload["stats_note"] = note
    return payload


def _recent_unverified_for_tenant(tenant_id: str, *, limit: int = 25) -> list[dict]:
    """Pending moderation queue for a single tenant."""
    qs = (
        Activity.objects.filter(tenant_id=tenant_id, is_verified=False)
        .select_related("user")
        .order_by("-created_at")[:limit]
    )
    return [
        {
            "id": a.id,
            "activity_id": a.id,
            "user": a.user.username if a.user_id else "Unknown",
            "username": a.user.username if a.user_id else "Unknown",
            "type": a.type,
            "distance": a.distance,
            "score": float(a.verification_score or 0),
        }
        for a in qs
    ]


def _per_tenant_breakdown(*, tenant_id: str | None = None) -> list[dict]:
    """
    Per-tenant KPIs via separate aggregates (avoids broken SQL from
    multiple Count(distinct=True, filter=...) on the same join).
    """
    rows: list[dict] = []
    tenants = Tenant.objects.filter(is_active=True)
    if tenant_id:
        tenants = tenants.filter(id=tenant_id)
    for tenant in tenants.only("id", "name", "primary_color", "secondary_color"):
        try:
            users = tenant.users.count()
            agg = Activity.objects.filter(tenant_id=tenant.id).aggregate(
                activities=Count("id"),
                distance=Sum("distance", filter=Q(is_verified=True)),
                verified=Count("id", filter=Q(is_verified=True)),
            )
            act_count = agg["activities"] or 0
            dist = agg["distance"] or 0
            verified = agg["verified"] or 0
            rows.append(
                {
                    "tenant_id": str(tenant.id),
                    "tenant_name": tenant.name,
                    "users": users,
                    "activities": act_count,
                    "distance_km": round(float(dist) / 1000.0, 1),
                    "verified_pct": round((verified / act_count * 100), 1) if act_count else 0.0,
                    "primary_color": tenant.primary_color,
                    "secondary_color": tenant.secondary_color,
                    "recent_unverified": _recent_unverified_for_tenant(str(tenant.id)),
                }
            )
        except Exception:
            logger.exception("admin/stats per_tenant failed tenant=%s", tenant.id)
    return rows


def _per_department_breakdown(request_user) -> list[dict]:
    if getattr(request_user, "role", None) not in ("TENANT_ADMIN", "TENANT_MODERATOR"):
        return []
    if not request_user.tenant_id:
        return []

    from users.departments import Department

    rows: list[dict] = []
    for dept in Department.objects.filter(tenant_id=request_user.tenant_id, is_active=True):
        try:
            dept_agg = Activity.objects.filter(user__departments=dept).aggregate(
                act_count=Count("id"),
                dist=Sum("distance", filter=Q(is_verified=True)),
                verified=Count("id", filter=Q(is_verified=True)),
            )
            act_count = dept_agg["act_count"] or 0
            dist = dept_agg["dist"] or 0
            verified = dept_agg["verified"] or 0
            rows.append(
                {
                    "department_id": dept.id,
                    "department_name": dept.name,
                    "users": dept.get_member_count(),
                    "activities": act_count,
                    "distance_km": round(float(dist) / 1000.0, 1),
                    "verified_pct": round((verified / act_count * 100), 1) if act_count else 0.0,
                }
            )
        except Exception:
            logger.exception("admin/stats per_department failed dept=%s", dept.id)
    return rows


def build_dashboard_stats(request_user, *, allow_stale: bool = True, refresh: bool = False) -> dict:
    """
    Aggregate queries + Redis cache.
    During batch/live sim, serves cache if available (marked stale).
    TENANT_ADMIN / TENANT_MODERATOR receive tenant-scoped totals (not platform-wide).
    """
    scoped_tid = _scoped_tenant_id(request_user)

    if allow_stale and _batch_or_live_running():
        cached = get_cached_dashboard_stats(request_user)
        if cached:
            cached = dict(cached)
            cached["stale"] = True
            cached["batch_running"] = True
            return cached

    if not refresh:
        cached = get_cached_dashboard_stats(request_user)
        if cached:
            return cached

    User = get_user_model()
    now = timezone.now()
    seven_days_ago = now - timedelta(days=7)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    activity_qs = Activity.objects.all()
    user_qs = User.objects.all()
    if scoped_tid:
        activity_qs = activity_qs.filter(tenant_id=scoped_tid)
        user_qs = user_qs.filter(tenant_id=scoped_tid)

    try:
        totals = activity_qs.aggregate(
            total_activities=Count("id"),
            total_distance=Sum("distance"),
            verified_total=Count("id", filter=Q(is_verified=True)),
            new_activities_last_7d=Count("id", filter=Q(created_at__gte=seven_days_ago)),
        )
        user_totals = user_qs.aggregate(
            total_users=Count("id"),
            new_users_today=Count("id", filter=Q(date_joined__gte=today_start)),
            new_users_last_7d=Count("id", filter=Q(date_joined__gte=seven_days_ago)),
        )
    except Exception:
        logger.exception("admin/stats global aggregates failed")
        cached = get_cached_dashboard_stats(request_user)
        if cached:
            out = dict(cached)
            out["stale"] = True
            return out
        return _empty_stats(stale=True, note="aggregates_unavailable")

    total_activities = totals["total_activities"] or 0
    total_distance = totals["total_distance"] or 0
    total_distance_km = round(float(total_distance) / 1000.0, 1)
    total_verified = totals["verified_total"] or 0
    verified_pct = round((total_verified / total_activities * 100), 1) if total_activities else 0.0

    per_tenant = _per_tenant_breakdown(tenant_id=scoped_tid)
    recent_unverified = _recent_unverified_for_tenant(scoped_tid) if scoped_tid else []

    payload = {
        "total_users": user_totals["total_users"] or 0,
        "total_activities": total_activities,
        "total_distance_km": total_distance_km,
        "total_calories": int(total_distance_km * 50),
        "new_users_today": user_totals["new_users_today"] or 0,
        "new_users_last_7d": user_totals["new_users_last_7d"] or 0,
        "new_activities_last_7d": totals["new_activities_last_7d"] or 0,
        "verified_total": total_verified,
        "verified_pct": verified_pct,
        "unverified_total": total_activities - total_verified,
        "per_tenant": per_tenant,
        "per_department": _per_department_breakdown(request_user),
        "recent_unverified": recent_unverified,
        "scoped_tenant_id": scoped_tid,
        "stale": False,
        "batch_running": False,
        "cached_at": time.time(),
    }
    set_cached_dashboard_stats(payload, request_user)
    return payload
