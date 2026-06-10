"""
Cached, aggregate-based admin dashboard KPIs — safe during 300k batch runs.
"""

from __future__ import annotations

import json
import logging
import time
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDay
from django.utils import timezone

from activities.models import Activity
from users.models import Tenant

logger = logging.getLogger(__name__)

STATS_CACHE_KEY = "{admin}:dashboard:stats"
STATS_CACHE_TTL = 300  # seconds — warm path for 300k dashboards
DEPT_ANALYTICS_CACHE_TTL = 120


def _scoped_tenant_id(request_user, tenant_override: str | None = None) -> str | None:
    """Tenant admins/moderators see only their tenant KPIs."""
    role = getattr(request_user, "role", None)
    if role in ("TENANT_ADMIN", "TENANT_MODERATOR") and getattr(request_user, "tenant_id", None):
        return str(request_user.tenant_id)
    if tenant_override and role == "GLOBAL_OWNER":
        return str(tenant_override)
    return None


def _weekly_activity_breakdown(tenant_id: str | None) -> list[dict]:
    """Last 7 calendar days — verified activity counts by type (RUN / BIKE / WALK)."""
    if not tenant_id:
        return []

    today = date.today()
    start = today - timedelta(days=6)
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    rows = (
        Activity.objects.filter(
            tenant_id=tenant_id,
            is_verified=True,
            start_time__date__gte=start,
        )
        .annotate(day=TruncDay("start_time"))
        .values("day", "type")
        .annotate(cnt=Count("id"))
    )

    by_day: dict[date, dict[str, int]] = {}
    for row in rows:
        day = row["day"].date() if hasattr(row["day"], "date") else row["day"]
        bucket = by_day.setdefault(day, {"run": 0, "bike": 0, "walk": 0})
        kind = (row["type"] or "").upper()
        if kind == "RUN":
            bucket["run"] += row["cnt"]
        elif kind in ("BIKE", "CYCLING"):
            bucket["bike"] += row["cnt"]
        else:
            bucket["walk"] += row["cnt"]

    chart: list[dict] = []
    for offset in range(7):
        day = start + timedelta(days=offset)
        counts = by_day.get(day, {"run": 0, "bike": 0, "walk": 0})
        chart.append(
            {
                "name": day_names[day.weekday()],
                "run": counts["run"],
                "bike": counts["bike"],
                "walk": counts["walk"],
            }
        )
    return chart


def _stats_cache_key(request_user, tenant_override: str | None = None) -> str:
    tid = _scoped_tenant_id(request_user, tenant_override=tenant_override)
    if tid:
        return f"{{admin}}:dashboard:stats:tenant:{tid}"
    return STATS_CACHE_KEY


def _redis():
    from core.redis_cluster import get_redis

    return get_redis()


def get_cached_dashboard_stats(
    request_user=None,
    tenant_override: str | None = None,
) -> dict | None:
    cache_key = (
        _stats_cache_key(request_user, tenant_override=tenant_override)
        if request_user is not None
        else STATS_CACHE_KEY
    )
    try:
        raw = _redis().get(cache_key)
        if raw:
            return json.loads(raw.decode() if isinstance(raw, bytes) else raw)
    except Exception:
        pass
    return None


def set_cached_dashboard_stats(
    payload: dict,
    request_user=None,
    tenant_override: str | None = None,
) -> None:
    cache_key = (
        _stats_cache_key(request_user, tenant_override=tenant_override)
        if request_user is not None
        else STATS_CACHE_KEY
    )
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


def _redis_bool(val) -> bool:
    if isinstance(val, bool):
        return val
    if val is None:
        return False
    return str(val).strip().lower() in ("1", "true", "yes", "on")


def build_sim_kpi_snapshot() -> dict:
    """
    Platform-wide live/batch simulator KPIs (not athlete DB counts).
    Always fresh — not tied to dashboard stats cache TTL.
    """
    try:
        from activities import simulator_state as sim
        from activities.ride_fsm import fsm_summary
        from activities.simulator_routing_backpressure import (
            max_routing_queue_depth,
            routing_backpressure_snapshot,
        )
        from activities.simulator_tasks import _async_routing_enabled

        batch = sim.get_batch_state()
        live = sim.get_live_state()
        rides = sim.get_live_rides()
        fsm = fsm_summary(rides)
        bp = routing_backpressure_snapshot(
            fsm_pending=fsm["ride_warming"],
            fsm_routing=fsm.get("ride_routing", 0),
        )
        live_running = bool(live.get("running"))
        batch_running = bool(batch.get("running"))
        return {
            "sim_on": live_running or batch_running,
            "live_running": live_running,
            "batch_running": batch_running,
            "live_error": live.get("error"),
            "batch_phase": batch.get("current_phase") or "idle",
            "currently_riding": int(live.get("currently_riding", 0) or fsm["ride_on_map"]),
            "ride_warming": fsm["ride_warming"],
            "ride_routing": fsm["ride_routing"],
            "ride_routed": fsm["ride_routed"],
            "ride_active": fsm["ride_active"],
            "async_routing_enabled": _async_routing_enabled(),
            "routing_queue_depth": int(
                live.get("routing_queue_depth") or bp["routing_queue_depth"]
            ),
            "routing_backpressure_active": _redis_bool(live.get("routing_backpressure_active"))
            or bp["routing_backpressure_active"],
            "dispatches_throttled": _redis_bool(live.get("dispatches_throttled")),
            "max_routing_queue_depth": max_routing_queue_depth(),
            "routing_unroutable_total": int(live.get("routing_unroutable_total", 0) or 0),
            "tick_stale": sim.live_tick_stale() if live_running else False,
            "live_lock_held": sim.is_live_lock_held(),
        }
    except Exception:
        logger.exception("admin/sim_kpi snapshot failed")
        return {
            "sim_on": False,
            "live_running": False,
            "batch_running": False,
            "error": "sim_kpi_unavailable",
        }


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
        "low_score_total": 0,
        "per_tenant": [],
        "per_department": [],
        "stale": stale,
        "batch_running": False,
        "cached_at": time.time(),
    }
    if note:
        payload["stats_note"] = note
    return payload


def _activity_to_unverified_row(a) -> dict:
    return {
        "id": a.id,
        "activity_id": a.id,
        "user": a.user.username if a.user_id else "Unknown",
        "username": a.user.username if a.user_id else "Unknown",
        "type": a.type,
        "distance": a.distance,
        "score": float(a.verification_score or 0),
    }


def _recent_unverified_for_tenant(tenant_id: str, *, limit: int = 25) -> list[dict]:
    """Pending moderation queue for a single tenant."""
    qs = (
        Activity.objects.filter(tenant_id=tenant_id, is_verified=False)
        .select_related("user")
        .order_by("-created_at")[:limit]
    )
    return [_activity_to_unverified_row(a) for a in qs]


def _recent_unverified_platform(*, limit: int = 50) -> list[dict]:
    """Platform-wide moderation queue for GLOBAL_OWNER (newest first)."""
    qs = (
        Activity.objects.filter(is_verified=False)
        .select_related("user")
        .order_by("-created_at")[:limit]
    )
    return [_activity_to_unverified_row(a) for a in qs]


def _recent_unverified_by_tenant(
    tenant_ids: list[str], *, limit_per_tenant: int = 25
) -> dict[str, list[dict]]:
    """Batch moderation queue — one query instead of N per-tenant loops."""
    from collections import defaultdict

    if not tenant_ids:
        return {}
    cap = limit_per_tenant * len(tenant_ids)
    qs = (
        Activity.objects.filter(tenant_id__in=tenant_ids, is_verified=False)
        .select_related("user")
        .order_by("-created_at")[:cap]
    )
    grouped: dict[str, list[dict]] = defaultdict(list)
    for activity in qs:
        tid = str(activity.tenant_id)
        if len(grouped[tid]) < limit_per_tenant:
            grouped[tid].append(_activity_to_unverified_row(activity))
    return dict(grouped)


def _per_tenant_breakdown(*, tenant_id: str | None = None) -> list[dict]:
    """Per-tenant KPIs via GROUP BY aggregates (one pass over activities + users)."""
    rows: list[dict] = []
    tenants = Tenant.objects.filter(is_active=True)
    if tenant_id:
        tenants = tenants.filter(id=tenant_id)
    tenant_list = list(tenants.only("id", "name", "primary_color", "secondary_color"))
    if not tenant_list:
        return rows

    tenant_ids = [t.id for t in tenant_list]
    tenant_by_id = {t.id: t for t in tenant_list}

    try:
        activity_by_tenant = {
            row["tenant_id"]: row
            for row in Activity.objects.filter(tenant_id__in=tenant_ids)
            .values("tenant_id")
            .annotate(
                activities=Count("id"),
                distance=Sum("distance", filter=Q(is_verified=True)),
                verified=Count("id", filter=Q(is_verified=True)),
            )
        }
        User = get_user_model()
        users_by_tenant = {
            row["tenant_id"]: row["users"]
            for row in User.objects.filter(tenant_id__in=tenant_ids)
            .values("tenant_id")
            .annotate(users=Count("id"))
        }
    except Exception:
        logger.exception("admin/stats per_tenant group aggregates failed")
        return rows

    unverified_by_tenant = _recent_unverified_by_tenant([str(t.id) for t in tenant_list])

    for tid in tenant_ids:
        tenant = tenant_by_id[tid]
        try:
            agg = activity_by_tenant.get(tid, {})
            act_count = agg.get("activities") or 0
            dist = agg.get("distance") or 0
            verified = agg.get("verified") or 0
            tid_str = str(tenant.id)
            rows.append(
                {
                    "tenant_id": tid_str,
                    "tenant_name": tenant.name,
                    "users": users_by_tenant.get(tid, 0),
                    "activities": act_count,
                    "distance_km": round(float(dist) / 1000.0, 1),
                    "verified_pct": round((verified / act_count * 100), 1) if act_count else 0.0,
                    "primary_color": tenant.primary_color,
                    "secondary_color": tenant.secondary_color,
                    "recent_unverified": unverified_by_tenant.get(tid_str, []),
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


def build_dashboard_stats(
    request_user,
    *,
    allow_stale: bool = True,
    refresh: bool = False,
    tenant_override: str | None = None,
) -> dict:
    """
    Aggregate queries + Redis cache.
    During batch/live sim, serves cache if available (marked stale).
    TENANT_ADMIN / TENANT_MODERATOR receive tenant-scoped totals (not platform-wide).
    """
    scoped_tid = _scoped_tenant_id(request_user, tenant_override=tenant_override)

    if allow_stale and _batch_or_live_running():
        cached = get_cached_dashboard_stats(request_user, tenant_override=tenant_override)
        if cached:
            cached = dict(cached)
            cached["stale"] = True
            cached["batch_running"] = True
            if getattr(request_user, "role", None) == "GLOBAL_OWNER" and not tenant_override:
                cached["sim_kpi"] = build_sim_kpi_snapshot()
            return cached

    if not refresh:
        cached = get_cached_dashboard_stats(request_user, tenant_override=tenant_override)
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
            low_score_total=Count("id", filter=Q(verification_score__lt=0.3)),
            new_activities_last_7d=Count("id", filter=Q(created_at__gte=seven_days_ago)),
        )
        user_totals = user_qs.aggregate(
            total_users=Count("id"),
            new_users_today=Count("id", filter=Q(date_joined__gte=today_start)),
            new_users_last_7d=Count("id", filter=Q(date_joined__gte=seven_days_ago)),
        )
    except Exception:
        logger.exception("admin/stats global aggregates failed")
        cached = get_cached_dashboard_stats(request_user, tenant_override=tenant_override)
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
    recent_unverified = (
        _recent_unverified_for_tenant(scoped_tid)
        if scoped_tid
        else _recent_unverified_platform(limit=50)
    )

    payload: dict = {
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
        "low_score_total": totals.get("low_score_total") or 0,
        "per_tenant": per_tenant,
        "per_department": _per_department_breakdown(request_user),
        "recent_unverified": recent_unverified,
        "weekly_activity_breakdown": _weekly_activity_breakdown(scoped_tid),
        "scoped_tenant_id": scoped_tid,
        "stale": False,
        "batch_running": False,
        "cached_at": time.time(),
    }
    if getattr(request_user, "role", None) == "GLOBAL_OWNER":
        payload["sim_kpi"] = build_sim_kpi_snapshot()
    set_cached_dashboard_stats(payload, request_user, tenant_override=tenant_override)
    return payload


def _dept_analytics_cache_key(request_user) -> str:
    tid = _scoped_tenant_id(request_user)
    if tid:
        return f"{{admin}}:analytics:department:tenant:{tid}"
    return "{admin}:analytics:department:global"


def get_cached_department_analytics(request_user) -> list | None:
    try:
        raw = _redis().get(_dept_analytics_cache_key(request_user))
        if raw:
            return json.loads(raw.decode() if isinstance(raw, bytes) else raw)
    except Exception:
        pass
    return None


def set_cached_department_analytics(request_user, payload: list) -> None:
    try:
        _redis().setex(
            _dept_analytics_cache_key(request_user),
            DEPT_ANALYTICS_CACHE_TTL,
            json.dumps(payload),
        )
    except Exception:
        pass


def build_department_analytics(request_user, *, refresh: bool = False) -> list[dict]:
    """Grouped department stats — replaces N+1 loop in DepartmentAnalyticsView."""
    if not refresh:
        cached = get_cached_department_analytics(request_user)
        if cached is not None:
            return cached

    from users.departments import Department

    role = getattr(request_user, "role", None)
    if role == "GLOBAL_OWNER":
        departments = Department.objects.filter(is_active=True)
    elif role in ("TENANT_ADMIN", "TENANT_MODERATOR") and request_user.tenant_id:
        departments = Department.objects.filter(tenant_id=request_user.tenant_id, is_active=True)
    else:
        return []

    dept_list = list(departments.only("id", "name"))
    if not dept_list:
        return []

    dept_ids = [d.id for d in dept_list]
    dept_by_id = {d.id: d for d in dept_list}

    try:
        activity_stats = {
            row["user__departments"]: row
            for row in Activity.objects.filter(user__departments__in=dept_ids)
            .values("user__departments")
            .annotate(
                activities=Count("id"),
                distance=Sum("distance"),
                verified=Count("id", filter=Q(is_verified=True)),
            )
        }
        member_stats = {
            row["id"]: row["users"]
            for row in Department.objects.filter(id__in=dept_ids)
            .annotate(users=Count("members"))
            .values("id", "users")
        }
    except Exception:
        logger.exception("admin/analytics/department group aggregates failed")
        cached = get_cached_department_analytics(request_user)
        return cached if cached is not None else []

    result: list[dict] = []
    for dept_id in dept_ids:
        dept = dept_by_id[dept_id]
        stats = activity_stats.get(dept_id, {})
        act_count = stats.get("activities") or 0
        dept_distance = stats.get("distance") or 0
        dept_verified = stats.get("verified") or 0
        result.append(
            {
                "department_id": dept.id,
                "department_name": dept.name,
                "users": member_stats.get(dept_id, 0),
                "activities": act_count,
                "distance_km": round(float(dept_distance) / 1000.0, 1),
                "verified_pct": round((dept_verified / act_count * 100), 1)
                if act_count > 0
                else 0.0,
            }
        )

    set_cached_department_analytics(request_user, result)
    return result
