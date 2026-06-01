"""
Cached, aggregate-based admin dashboard KPIs — safe during 300k batch runs.
"""
from __future__ import annotations

import json
import time
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum
from django.utils import timezone

from activities.models import Activity
from users.models import Tenant

STATS_CACHE_KEY = '{admin}:dashboard:stats'
STATS_CACHE_TTL = 120  # seconds


def _redis():
    from core.redis_cluster import get_redis
    return get_redis()


def get_cached_dashboard_stats() -> dict | None:
    try:
        raw = _redis().get(STATS_CACHE_KEY)
        if raw:
            return json.loads(raw.decode() if isinstance(raw, bytes) else raw)
    except Exception:
        pass
    return None


def set_cached_dashboard_stats(payload: dict) -> None:
    try:
        _redis().setex(STATS_CACHE_KEY, STATS_CACHE_TTL, json.dumps(payload))
    except Exception:
        pass


def invalidate_dashboard_stats_cache() -> None:
    try:
        _redis().delete(STATS_CACHE_KEY)
    except Exception:
        pass


def _batch_or_live_running() -> bool:
    from activities import simulator_state as sim
    return bool(sim.get_batch_state().get('running') or sim.get_live_state().get('running'))


def build_dashboard_stats(request_user, *, allow_stale: bool = True, refresh: bool = False) -> dict:
    """
    Single round of aggregate queries + Redis cache.
    During batch/live sim, serves cache if available (marked stale).
    """
    if allow_stale and _batch_or_live_running():
        cached = get_cached_dashboard_stats()
        if cached:
            cached = dict(cached)
            cached['stale'] = True
            cached['batch_running'] = True
            return cached

    if not refresh:
        cached = get_cached_dashboard_stats()
        if cached:
            return cached

    User = get_user_model()
    now = timezone.now()
    seven_days_ago = now - timedelta(days=7)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    totals = Activity.objects.aggregate(
        total_activities=Count('id'),
        total_distance=Sum('distance'),
        verified_total=Count('id', filter=Q(is_verified=True)),
        new_activities_last_7d=Count('id', filter=Q(created_at__gte=seven_days_ago)),
    )
    total_activities = totals['total_activities'] or 0
    total_distance = totals['total_distance'] or 0
    total_distance_km = round(float(total_distance) / 1000.0, 1)
    total_verified = totals['verified_total'] or 0
    verified_pct = round((total_verified / total_activities * 100), 1) if total_activities else 0.0

    user_totals = User.objects.aggregate(
        total_users=Count('id'),
        new_users_today=Count('id', filter=Q(date_joined__gte=today_start)),
        new_users_last_7d=Count('id', filter=Q(date_joined__gte=seven_days_ago)),
    )

    per_tenant_stats = list(
        Tenant.objects.filter(is_active=True).annotate(
            users=Count('users', distinct=True),
            activities=Count('activities', distinct=True),
            distance=Sum('activities__distance'),
            verified=Count(
                'activities',
                filter=Q(activities__is_verified=True),
                distinct=True,
            ),
        ).values(
            'id', 'name', 'primary_color', 'secondary_color',
            'users', 'activities', 'distance', 'verified',
        )
    )
    per_tenant = []
    for row in per_tenant_stats:
        act_count = row['activities'] or 0
        dist = row['distance'] or 0
        verified = row['verified'] or 0
        per_tenant.append({
            'tenant_id': str(row['id']),
            'tenant_name': row['name'],
            'users': row['users'] or 0,
            'activities': act_count,
            'distance_km': round(float(dist) / 1000.0, 1),
            'verified_pct': round((verified / act_count * 100), 1) if act_count else 0.0,
            'primary_color': row['primary_color'],
            'secondary_color': row['secondary_color'],
        })

    per_dept_stats = []
    if getattr(request_user, 'role', None) in ('TENANT_ADMIN', 'TENANT_MODERATOR') and request_user.tenant_id:
        from users.departments import Department
        for dept in Department.objects.filter(tenant_id=request_user.tenant_id, is_active=True):
            dept_agg = Activity.objects.filter(user__departments=dept).aggregate(
                act_count=Count('id'),
                dist=Sum('distance'),
                verified=Count('id', filter=Q(is_verified=True)),
            )
            act_count = dept_agg['act_count'] or 0
            dist = dept_agg['dist'] or 0
            verified = dept_agg['verified'] or 0
            per_dept_stats.append({
                'department_id': dept.id,
                'department_name': dept.name,
                'users': dept.members.count(),
                'activities': act_count,
                'distance_km': round(float(dist) / 1000.0, 1),
                'verified_pct': round((verified / act_count * 100), 1) if act_count else 0.0,
            })

    payload = {
        'total_users': user_totals['total_users'] or 0,
        'total_activities': total_activities,
        'total_distance_km': total_distance_km,
        'total_calories': int(total_distance_km * 50),
        'new_users_today': user_totals['new_users_today'] or 0,
        'new_users_last_7d': user_totals['new_users_last_7d'] or 0,
        'new_activities_last_7d': totals['new_activities_last_7d'] or 0,
        'verified_total': total_verified,
        'verified_pct': verified_pct,
        'unverified_total': total_activities - total_verified,
        'per_tenant': per_tenant,
        'per_department': per_dept_stats,
        'stale': False,
        'batch_running': False,
        'cached_at': time.time(),
    }
    set_cached_dashboard_stats(payload)
    return payload
