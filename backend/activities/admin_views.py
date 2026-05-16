import csv
import io
import random
import threading
import time
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Sum, Count, Q
from django.http import HttpResponse
from django.utils import timezone
from datetime import timedelta
from rest_framework.pagination import PageNumberPagination
from .models import Activity
from .serializers import ActivitySerializer
from users.models import Tenant
from users.permissions import IsAdminOrModerator

# Keep IsAdminRole as an alias for backward compatibility
IsAdminRole = IsAdminOrModerator


class ActivityPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 500


class GlobalActivityListView(generics.ListAPIView):
    """
    List all activities for Global Owners.
    """
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)
    pagination_class = ActivityPagination

    def get_queryset(self):
        if self.request.user.role == 'GLOBAL_OWNER':
            return Activity.objects.select_related('user', 'tenant').all()
        return Activity.objects.none()

class TenantActivityListView(generics.ListAPIView):
    """
    List activities for Tenant Admins and Moderators (limited to their tenant).
    """
    serializer_class = ActivitySerializer
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)
    pagination_class = ActivityPagination

    def get_queryset(self):
        if self.request.user.role in ('TENANT_ADMIN', 'TENANT_MODERATOR') and self.request.user.tenant_id:
            return Activity.objects.filter(
                tenant_id=self.request.user.tenant_id
            ).select_related('user')
        return Activity.objects.none()


class AdminDashboardStatsView(APIView):
    """
    Returns high-level platform KPIs for the admin dashboard with per-tenant breakdown.
    """
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

    def get(self, request):
        User = get_user_model()
        now = timezone.now()
        seven_days_ago = now - timedelta(days=7)

        total_users = User.objects.count()
        total_activities = Activity.objects.count()
        total_distance = Activity.objects.aggregate(Sum('distance'))['distance__sum'] or 0
        total_distance_km = round(float(total_distance / 1000.0), 1)

        # Approximate calories: 50 kcal per km (cycling/running mix)
        total_calories = int(total_distance_km * 50)

        new_users_today = User.objects.filter(date_joined__gte=now.replace(hour=0, minute=0, second=0)).count()
        new_users_last_7d = User.objects.filter(date_joined__gte=seven_days_ago).count()
        new_activities_last_7d = Activity.objects.filter(created_at__gte=seven_days_ago).count()

        total_verified = Activity.objects.filter(is_verified=True).count()
        verified_pct = round((total_verified / total_activities * 100), 1) if total_activities > 0 else 0.0

        tenant_qs = Tenant.objects.filter(is_active=True).annotate(
            user_count=Count('users'),
            activity_count=Count('activities'),
            total_distance=Sum('activities__distance'),
            verified_count=Count('activities', filter=Q(activities__is_verified=True)),
        )

        per_tenant_stats = []
        for t in tenant_qs:
            act_count = t.activity_count or 0
            dist = t.total_distance or 0
            verified = t.verified_count or 0
            ver_rate = round((verified / act_count * 100), 1) if act_count > 0 else 0.0
            per_tenant_stats.append({
                "tenant_id": str(t.id),
                "tenant_name": t.name,
                "users": t.user_count,
                "activities": act_count,
                "distance_km": round(float(dist / 1000.0), 1),
                "verified_pct": ver_rate,
                "primary_color": t.primary_color,
                "secondary_color": t.secondary_color,
            })

        # Per-department stats (for tenant admins)
        per_dept_stats = []
        if request.user.role in ('TENANT_ADMIN', 'TENANT_MODERATOR') and request.user.tenant_id:
            from users.departments import Department
            for dept in Department.objects.filter(tenant_id=request.user.tenant_id, is_active=True):
                dept_user_ids = dept.members.values_list('id', flat=True)
                dept_activities = Activity.objects.filter(user_id__in=dept_user_ids)
                dept_act_count = dept_activities.count()
                dept_distance = dept_activities.aggregate(Sum('distance'))['distance__sum'] or 0
                dept_verified = dept_activities.filter(is_verified=True).count()
                per_dept_stats.append({
                    "department_id": dept.id,
                    "department_name": dept.name,
                    "users": dept.members.count(),
                    "activities": dept_act_count,
                    "distance_km": round(float(dept_distance / 1000.0), 1),
                    "verified_pct": round((dept_verified / dept_act_count * 100), 1) if dept_act_count > 0 else 0.0,
                })

        return Response({
            "total_users": total_users,
            "total_activities": total_activities,
            "total_distance_km": total_distance_km,
            "total_calories": total_calories,
            "new_users_today": new_users_today,
            "new_users_last_7d": new_users_last_7d,
            "new_activities_last_7d": new_activities_last_7d,
            "verified_total": total_verified,
            "verified_pct": verified_pct,
            "unverified_total": total_activities - total_verified,
            "per_tenant": per_tenant_stats,
            "per_department": per_dept_stats,
        })


class DepartmentAnalyticsView(APIView):
    """
    Returns per-department statistics for the Department Analytics page.
    GET /api/activities/analytics/department/
    """
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

    def get(self, request):
        from users.departments import Department

        # GLOBAL_OWNER sees all active departments; tenant-scoped roles see only their own
        if request.user.role == 'GLOBAL_OWNER':
            departments = Department.objects.filter(is_active=True)
        elif request.user.role in ('TENANT_ADMIN', 'TENANT_MODERATOR') and request.user.tenant_id:
            departments = Department.objects.filter(tenant_id=request.user.tenant_id, is_active=True)
        else:
            departments = Department.objects.none()

        result = []
        for dept in departments:
            dept_user_ids = dept.members.values_list('id', flat=True)
            dept_activities = Activity.objects.filter(user_id__in=dept_user_ids)
            dept_act_count = dept_activities.count()
            dept_distance = dept_activities.aggregate(Sum('distance'))['distance__sum'] or 0
            dept_verified = dept_activities.filter(is_verified=True).count()
            result.append({
                "department_id": dept.id,
                "department_name": dept.name,
                "users": dept.members.count(),
                "activities": dept_act_count,
                "distance_km": round(float(dept_distance / 1000.0), 1),
                "verified_pct": round((dept_verified / dept_act_count * 100), 1) if dept_act_count > 0 else 0.0,
            })

        return Response(result)


class ActivityApproveView(APIView):
    """
    Approve an activity (marks it as verified, score 1.0).
    """
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

    def post(self, request, activity_id):
        try:
            activity = Activity.objects.get(pk=activity_id)
            activity.is_verified = True
            activity.verification_score = 1.0
            activity.save()
            return Response({
                "status": "approved",
                "activity_id": activity.id,
                "user": activity.user.username,
                "verification_score": activity.verification_score,
            })
        except Activity.DoesNotExist:
            return Response({"error": "activity not found"}, status=status.HTTP_404_NOT_FOUND)


class ActivityRejectView(APIView):
    """
    Reject an activity (marks it as unverified, score 0.0).
    """
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

    def post(self, request, activity_id):
        try:
            activity = Activity.objects.get(pk=activity_id)
            activity.is_verified = False
            activity.verification_score = 0.0
            activity.save()
            return Response({
                "status": "rejected",
                "activity_id": activity.id,
                "user": activity.user.username,
                "verification_score": activity.verification_score,
            })
        except Activity.DoesNotExist:
            return Response({"error": "activity not found"}, status=status.HTTP_404_NOT_FOUND)


class ExportDataView(APIView):
    """
    Export data in multiple formats: csv, json, pdf.
    GET /api/activities/export/<resource>/?format=csv
    Resources: activities, users, statistics
    """
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

    def get(self, request, resource):
        export_format = request.query_params.get('format', 'json')

        if resource == 'activities':
            data = self._export_activities(export_format)
        elif resource == 'users':
            data = self._export_users(export_format)
        elif resource == 'statistics':
            data = self._export_statistics(export_format)
        else:
            return Response({'error': f'Unknown resource: {resource}'}, status=status.HTTP_400_BAD_REQUEST)

        if export_format == 'json':
            return Response(data)
        elif export_format == 'csv':
            return self._build_csv_response(data, resource)
        elif export_format == 'pdf':
            return self._build_text_report_response(data, resource)
        else:
            return Response(data)

    def _build_csv_response(self, data, resource):
        """Build a CSV HTTP response from export data."""
        output = io.StringIO()
        records = data.get('data', [])
        if records:
            writer = csv.DictWriter(output, fieldnames=records[0].keys())
            writer.writeheader()
            writer.writerows(records)
        else:
            output.write('No data available.\r\n')
        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{resource}.csv"'
        return response

    def _build_text_report_response(self, data, resource):
        """Build a plain-text report HTTP response for PDF-requested exports.
        Uses text/plain since PDF-generation libraries (ReportLab/WeasyPrint)
        are not available; the file is delivered as a downloadable text report.
        """
        lines = [f"4VELO Export: {data.get('resource', resource)}", "=" * 50, ""]
        stats = data.get('data', {})
        if isinstance(stats, dict):
            for key, value in stats.items():
                lines.append(f"  {key}: {value}")
        elif isinstance(stats, list):
            for item in stats:
                lines.append(f"  - {item}")
        else:
            lines.append(str(stats))
        lines.append("")
        lines.append(f"Generated: {timezone.now().isoformat()}")
        body = "\r\n".join(lines)
        response = HttpResponse(body, content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{resource}.pdf"'
        return response

    def _export_activities(self, fmt):
        qs = Activity.objects.select_related('user').all()[:10000]
        activities = []
        for a in qs:
            activities.append({
                'id': a.id,
                'user': a.user.username,
                'type': a.type,
                'start_time': str(a.start_time),
                'end_time': str(a.end_time) if a.end_time else None,
                'distance_m': a.distance,
                'is_verified': a.is_verified,
                'verification_score': a.verification_score,
            })
        return {'resource': 'activities', 'format': fmt, 'count': len(activities), 'data': activities}

    def _export_users(self, fmt):
        User = get_user_model()
        qs = User.objects.all()[:10000]
        users = []
        for u in qs:
            users.append({
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'role': u.role,
                'tenant_id': str(u.tenant_id) if u.tenant_id else None,
                'date_joined': str(u.date_joined),
            })
        return {'resource': 'users', 'format': fmt, 'count': len(users), 'data': users}

    def _export_statistics(self, fmt):
        total_activities = Activity.objects.count()
        total_users = get_user_model().objects.count()
        total_distance = Activity.objects.aggregate(Sum('distance'))['distance__sum'] or 0
        verified = Activity.objects.filter(is_verified=True).count()
        return {
            'resource': 'statistics',
            'format': fmt,
            'data': {
                'total_activities': total_activities,
                'total_users': total_users,
                'total_distance_km': round(float(total_distance) / 1000.0, 1),
                'verified_count': verified,
                'verified_pct': round(verified / max(total_activities, 1) * 100, 1),
            }
        }


# ---------------------------------------------------------------------------
# Simulation state (in-process — resets on deploy)
# ---------------------------------------------------------------------------
_simulation_state = {
    'running': False,
    'started_at': None,
    'completed_at': None,
    'scale': 0.0,
    'days': 0,
    'error': None,
    'log': [],          # ring buffer of [timestamp, message]
    'abort_flag': False,
    'continuous': False,
    'interval': 60,
    'batch_count': 0,
}
_sim_lock = threading.Lock()


def _sim_log(msg: str):
    """Append a timestamped log line (thread-safe, max 200 lines)."""
    ts = time.strftime('%H:%M:%S')
    with _sim_lock:
        _simulation_state['log'].append([ts, msg])
        if len(_simulation_state['log']) > 200:
            _simulation_state['log'] = _simulation_state['log'][-200:]


def _run_simulation_in_background(scale: float, days: int, clear: bool, continuous: bool, interval: int, skip_activities: bool = False, total_users: int = None):
    """Run the simulation in the current thread, updating global state."""
    from simulate_active_cities import run
    with _sim_lock:
        _simulation_state['running'] = True
        _simulation_state['started_at'] = time.time()
        _simulation_state['scale'] = scale
        _simulation_state['days'] = days
        _simulation_state['error'] = None
        _simulation_state['completed_at'] = None
        _simulation_state['log'] = []
        _simulation_state['abort_flag'] = False
        _simulation_state['continuous'] = continuous
        _simulation_state['interval'] = interval
        _simulation_state['batch_count'] = 0

    mode_str = "CONTINUOUS" if continuous else "ONE-SHOT"
    _sim_log(f"Simulation starting: scale={scale}, days={days}, clear={clear}, mode={mode_str}")

    try:
        run(scale=scale, days=days, clear=clear, dry_run=False, skip_activities=skip_activities, total_users=total_users)
        _sim_log("Initial batch complete.")

        if continuous:
            _sim_log(f"Entering continuous mode — generating every {interval}s. Press Abort to stop.")
            while not _simulation_state['abort_flag']:
                time.sleep(interval)
                if _simulation_state['abort_flag']:
                    break
                _generate_live_legacy_batch(scale)
            _sim_log("Continuous mode stopped by user.")

        _sim_log("Simulation completed successfully.")
    except Exception as e:
        _simulation_state['error'] = str(e)
        _sim_log(f"ERROR: {e}")
        print(f"[SIMULATION ERROR] {e}")
    finally:
        with _sim_lock:
            _simulation_state['running'] = False
            _simulation_state['completed_at'] = time.time()


# ---------------------------------------------------------------------------
# Live Simulator — real-time ride simulation
# ---------------------------------------------------------------------------
_live_state = {
    'running': False,
    'started_at': None,
    'error': None,
    'log': [],
    'abort_flag': False,
    'total_users': 0,
    'active_ratio': 0.0,
    'cheat_ratio': 0.0,
    'tick_seconds': 10,
    'duration_min': 300,
    'duration_max': 3600,
    'currently_riding': 0,
    'total_completed': 0,
    'cheaters_caught': 0,
    'user_pool': [],        # list of user_ids in the pool
    'active_rides': {},     # {user_id: (start_time, end_time, act_type, lat, lon, is_cheater)}
}
_live_lock = threading.Lock()


def _live_log(msg: str):
    ts = time.strftime('%H:%M:%S')
    with _live_lock:
        _live_state['log'].append([ts, msg])
        if len(_live_state['log']) > 300:
            _live_state['log'] = _live_state['log'][-300:]


def _generate_cheater_track(lat: float, lon: float, distance_m: float) -> object:
    """Generate a suspicious GPS track (too straight, impossible speed)."""
    from django.contrib.gis.geos import LineString, Point
    import math
    cos_lat = math.cos(math.radians(lat))
    deg_per_km = 1.0 / 111.0
    total_deg = (distance_m / 1000.0) * deg_per_km

    n_points = 8  # Suspiciously few points
    coords = []
    for i in range(n_points):
        t = i / (n_points - 1)
        # Nearly straight line with minimal jitter
        coords.append((
            lon + total_deg * t / cos_lat + (0 if i == 0 or i == n_points - 1 else random.uniform(-0.00001, 0.00001)),
            lat + total_deg * t + (0 if i == 0 or i == n_points - 1 else random.uniform(-0.00001, 0.00001)),
        ))
    return LineString(coords, srid=4326)


def _generate_normal_track(lat: float, lon: float, distance_m: float, act_type: str) -> object:
    """Generate a realistic GPS track."""
    from simulate_active_cities import _generate_gps_track
    return _generate_gps_track(lat, lon, distance_m, act_type)


def _live_tick():
    """One tick of the live simulator: finish rides that ended, start new rides."""
    from users.models import User
    from activities.models import Activity
    from simulate_active_cities import CITIES, _pick_activity_type, _generate_activity_params
    from datetime import timedelta

    now = timezone.now()
    activities_to_create = []
    rides_to_remove = []
    completed = 0
    cheaters = 0

    with _live_lock:
        pool = list(_live_state['user_pool'])
        active = dict(_live_state['active_rides'])
        cheat_ratio = _live_state['cheat_ratio']
        active_ratio = _live_state['active_ratio']
        dur_min = _live_state['duration_min']
        dur_max = _live_state['duration_max']
        total_users = _live_state['total_users']

    # Phase 1: Finish rides whose end_time has passed
    for user_id, ride in active.items():
        if now >= ride['end_time']:
            rides_to_remove.append(user_id)

            # Find user's city for GPS
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                continue

            tenant_name = user.tenant.name if user.tenant else None
            city_info = next((c for c in CITIES if c['name'] == tenant_name), None)
            if not city_info:
                continue

            distance_m = ride['distance_m']
            act_type = ride['act_type']
            is_cheater = ride['is_cheater']
            start_time = ride['start_time']

            if is_cheater:
                route = _generate_cheater_track(city_info['lat'], city_info['lon'], distance_m)
                is_verified = False
                score = random.uniform(0.0, 0.25)  # Very low score
                cheaters += 1
            else:
                try:
                    route = _generate_normal_track(city_info['lat'], city_info['lon'], distance_m, act_type)
                except Exception:
                    route = None
                is_verified = random.random() < 0.92
                score = random.uniform(0.7, 1.0) if is_verified else random.uniform(0.0, 0.4)

            activities_to_create.append(Activity(
                user=user, tenant=user.tenant, type=act_type,
                start_time=start_time, end_time=now,
                distance=distance_m, duration=timedelta(seconds=(now - start_time).total_seconds()),
                is_verified=is_verified, verification_score=score,
                route_path=route,
            ))
            completed += 1

    # Bulk create completed activities
    if activities_to_create:
        try:
            Activity.objects.bulk_create(activities_to_create)
        except Exception:
            for a in activities_to_create:
                try: a.save()
                except Exception: pass

    # Phase 2: Start new rides
    new_rides = {}
    n_riding = len(active) - len(rides_to_remove)
    target_riding = max(1, int(total_users * active_ratio))
    needed = max(0, target_riding - n_riding)

    if needed > 0 and pool:
        starters = random.sample(pool, min(needed, len(pool)))
        for user_id in starters:
            act_type = _pick_activity_type()
            distance_m, duration_s = _generate_activity_params(act_type)
            duration_s = max(dur_min, min(dur_max, duration_s))
            start_time = now
            end_time = now + timedelta(seconds=duration_s)
            is_cheater = random.random() < cheat_ratio

            # Find user's city
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                continue
            tenant_name = user.tenant.name if user.tenant else None
            city_info = next((c for c in CITIES if c['name'] == tenant_name), None)
            lat = city_info['lat'] if city_info else 52.2297
            lon = city_info['lon'] if city_info else 21.0122

            new_rides[user_id] = {
                'start_time': start_time,
                'end_time': end_time,
                'act_type': act_type,
                'distance_m': distance_m,
                'lat': lat,
                'lon': lon,
                'is_cheater': is_cheater,
            }

    # Update state
    with _live_lock:
        for uid in rides_to_remove:
            _live_state['active_rides'].pop(uid, None)
        _live_state['active_rides'].update(new_rides)
        _live_state['currently_riding'] = len(_live_state['active_rides'])
        _live_state['total_completed'] += completed
        _live_state['cheaters_caught'] += cheaters

    if completed > 0:
        ctx = f"{completed} completed"
        if cheaters > 0:
            ctx += f", {cheaters} cheater{'s' if cheaters>1 else ''}"
        _live_log(f"Tick: {len(new_rides)} started, {ctx} — {_live_state['currently_riding']} riding")


def _live_simulation_thread(total_users: int, active_ratio: float, cheat_ratio: float, tick_seconds: int):
    """Background thread for the live ride simulator."""
    from users.models import User
    with _live_lock:
        _live_state['running'] = True
        _live_state['started_at'] = time.time()
        _live_state['error'] = None
        _live_state['log'] = []
        _live_state['abort_flag'] = False
        _live_state['total_users'] = total_users
        _live_state['active_ratio'] = active_ratio
        _live_state['cheat_ratio'] = cheat_ratio
        _live_state['tick_seconds'] = tick_seconds
        _live_state['currently_riding'] = 0
        _live_state['total_completed'] = 0
        _live_state['cheaters_caught'] = 0
        _live_state['active_rides'] = {}

    # Build user pool
    user_ids = list(User.objects.filter(role='ATHLETE').values_list('id', flat=True)[:total_users])
    if len(user_ids) < total_users:
        _live_log(f"WARNING: Only {len(user_ids)} athlete users available (requested {total_users})")
    with _live_lock:
        _live_state['user_pool'] = user_ids

    _live_log(f"LIVE SIMULATION: {len(user_ids)} users, {active_ratio*100:.0f}% active, {cheat_ratio*100:.0f}% cheaters, tick={tick_seconds}s")

    try:
        while not _live_state['abort_flag']:
            _live_tick()
            # Sleep in small chunks to be responsive to abort
            for _ in range(tick_seconds):
                if _live_state['abort_flag']:
                    break
                time.sleep(1)
        _live_log("Live simulation stopped by user.")
    except Exception as e:
        _live_state['error'] = str(e)
        _live_log(f"FATAL ERROR: {e}")
        print(f"[LIVE SIM ERROR] {e}")
    finally:
        with _live_lock:
            _live_state['running'] = False


def _generate_live_legacy_batch(scale: float):
    """Legacy batch generator for the old continuous mode."""
    from users.models import User
    from activities.models import Activity
    from simulate_active_cities import _pick_activity_type, _generate_activity_params, _generate_gps_track, CITIES
    from datetime import timedelta

    n_users = max(10, int(scale * 200))
    users = list(User.objects.filter(role='ATHLETE').order_by('?')[:n_users])
    if not users:
        return
    activities = []
    now = timezone.now()
    for user in users:
        tenant_name = user.tenant.name if user.tenant else None
        city_info = next((c for c in CITIES if c['name'] == tenant_name), None)
        if not city_info:
            continue
        for _ in range(random.randint(0, 2)):
            act_type = _pick_activity_type()
            dist, dur = _generate_activity_params(act_type)
            start_t = now - timedelta(seconds=random.randint(0, 55))
            end_t = start_t + timedelta(seconds=dur)
            try:
                route = _generate_gps_track(city_info['lat'], city_info['lon'], dist, act_type)
            except Exception:
                route = None
            activities.append(Activity(
                user=user, tenant=user.tenant, type=act_type,
                start_time=start_t, end_time=end_t, distance=dist,
                duration=timedelta(seconds=dur), is_verified=random.random() < 0.9,
                verification_score=random.uniform(0.7, 1.0), route_path=route,
            ))
    if activities:
        try:
            Activity.objects.bulk_create(activities)
        except Exception:
            for a in activities:
                try: a.save()
                except Exception: pass
    with _sim_lock:
        _simulation_state['batch_count'] += 1
    _sim_log(f"Legacy batch #{_simulation_state['batch_count']}: {len(activities)} activities")


class LiveSimulationView(APIView):
    """
    POST   /api/activities/admin/live-simulate/   — start live ride simulation
    GET    /api/activities/admin/live-simulate/   — status + logs + stats
    DELETE /api/activities/admin/live-simulate/   — abort
    Body: { total_users, active_ratio, cheat_ratio, tick_seconds }
    """
    permission_classes = [IsAdminRole]

    def get(self, request):
        elapsed = 0.0
        if _live_state['started_at']:
            elapsed = time.time() - _live_state['started_at']
        with _live_lock:
            log_snapshot = list(_live_state['log'])
        return Response({
            'running': _live_state['running'],
            'elapsed_seconds': round(elapsed, 1),
            'error': _live_state['error'],
            'total_users': _live_state['total_users'],
            'active_ratio': _live_state['active_ratio'],
            'cheat_ratio': _live_state['cheat_ratio'],
            'tick_seconds': _live_state['tick_seconds'],
            'currently_riding': _live_state['currently_riding'],
            'total_completed': _live_state['total_completed'],
            'cheaters_caught': _live_state['cheaters_caught'],
            'log': log_snapshot,
        })

    def delete(self, request):
        if not _live_state['running']:
            return Response({'error': 'No live simulation running.'}, status=status.HTTP_400_BAD_REQUEST)
        with _live_lock:
            _live_state['abort_flag'] = True
        _live_log("⚠️ Abort requested by user.")
        return Response({'status': 'abort_requested'})

    def post(self, request):
        if _live_state['running']:
            return Response({'error': 'Live simulation already running.'}, status=status.HTTP_409_CONFLICT)

        pool_pct = float(request.data.get('pool_pct', 0.5))
        active_ratio = float(request.data.get('active_ratio', 0.3))
        cheat_ratio = float(request.data.get('cheat_ratio', 0.05))
        tick_seconds = int(request.data.get('tick_seconds', 10))

        if active_ratio <= 0 or active_ratio > 1:
            return Response({'error': 'active_ratio must be 0–1'}, status=400)
        if cheat_ratio < 0 or cheat_ratio > 1:
            return Response({'error': 'cheat_ratio must be 0–1'}, status=400)
        if tick_seconds < 2 or tick_seconds > 300:
            return Response({'error': 'tick_seconds must be 2–300'}, status=400)

        # Calculate actual user count from pool percentage
        from users.models import User
        total_athletes = User.objects.filter(role='ATHLETE').count()
        total_users = max(10, int(total_athletes * pool_pct))

        thread = threading.Thread(
            target=_live_simulation_thread,
            args=(total_users, active_ratio, cheat_ratio, tick_seconds),
            daemon=True,
        )
        thread.start()

        return Response({
            'status': 'started',
            'running': True,
            'total_users': total_users,
            'active_ratio': active_ratio,
            'cheat_ratio': cheat_ratio,
            'tick_seconds': tick_seconds,
            'message': f'Live simulation: {total_users} users, {active_ratio*100:.0f}% active, {cheat_ratio*100:.0f}% cheaters',
        })


class WipeDataView(APIView):
    """
    DELETE /api/activities/admin/wipe-data/?confirm=true
    Deletes ALL data except GLOBAL_OWNER users.
    """
    permission_classes = [IsAdminRole]

    def delete(self, request):
        from django.db import connection
        confirm = request.data.get('confirm', False) or request.query_params.get('confirm') == 'true'
        if not confirm:
            return Response({'error': 'Must send ?confirm=true'}, status=status.HTTP_400_BAD_REQUEST)

        errors = []

        with connection.cursor() as cursor:
            # Disable FK triggers for the session (PostgreSQL)
            try:
                cursor.execute("SET session_replication_role = 'replica'")
            except Exception:
                pass

            # Delete all child tables first, then users, then tenants
            tables_in_order = [
                'activities_activity',
                'activities_leaderboardentry',
                'activities_betafeedback',
                'activities_event',
                'activities_leaderboard',
                'activities_sponsorship',
                'users_userdepartment',
                'users_userrole',
                'users_rolepermission',
                'users_role',
                'users_department',
                'users_user_groups',
                'users_user_user_permissions',
                'users_user_departments',
                'django_admin_log',
                'authtoken_token',
                'rewards_voucher',
                'rewards_voucher_redemption',
                'rewards_pool',
            ]
            for table in tables_in_order:
                try:
                    cursor.execute(f'DELETE FROM {table}')
                except Exception:
                    pass

            # Now safe to delete users
            try:
                cursor.execute("DELETE FROM users_user WHERE role != 'GLOBAL_OWNER'")
            except Exception as e:
                errors.append(f'users: {e}')

            # Then tenants
            try:
                cursor.execute("DELETE FROM users_tenant")
            except Exception as e:
                errors.append(f'tenants: {e}')

        _sim_log(f"🧹 WIPE DATA completed" + (f" ERRORS: {errors}" if errors else ""))

        return Response({
            'status': 'wiped' if not errors else 'partial',
            'errors': errors if errors else None,
        })


class RunSimulationView(APIView):
    """
    POST   /api/activities/admin/simulate/        — start simulation
    GET    /api/activities/admin/simulate/        — status + logs
    DELETE /api/activities/admin/simulate/        — abort running simulation
    """
    permission_classes = [IsAdminRole]

    def get(self, request):
        elapsed = 0.0
        if _simulation_state['started_at']:
            end = _simulation_state['completed_at'] or time.time()
            elapsed = end - _simulation_state['started_at']

        with _sim_lock:
            log_snapshot = list(_simulation_state['log'])

        return Response({
            'running': _simulation_state['running'],
            'elapsed_seconds': round(elapsed, 1),
            'scale': _simulation_state['scale'],
            'days': _simulation_state['days'],
            'error': _simulation_state['error'],
            'log': log_snapshot,
        })

    def delete(self, request):
        """Abort the running simulation."""
        if not _simulation_state['running']:
            return Response({'error': 'No simulation is currently running.'}, status=status.HTTP_400_BAD_REQUEST)
        with _sim_lock:
            _simulation_state['abort_flag'] = True
        _sim_log("⚠️ Abort requested by user.")
        return Response({'status': 'abort_requested', 'message': 'Simulation will stop at the next checkpoint.'})

    def post(self, request):
        if _simulation_state['running']:
            elapsed = time.time() - (_simulation_state['started_at'] or 0)
            return Response({
                'error': f'Simulation already running ({elapsed:.0f}s elapsed). Wait for it to finish.',
                'running': True,
                'elapsed_seconds': round(elapsed, 1),
            }, status=status.HTTP_409_CONFLICT)

        scale = float(request.data.get('scale', 0.01))
        days = int(request.data.get('days', 30))
        clear = bool(request.data.get('clear', False))
        skip_activities = bool(request.data.get('skip_activities', False))
        total_users = request.data.get('total_users')  # optional, overrides scale

        if not total_users and (scale < 0.001 or scale > 1.0):
            return Response(
                {'error': 'scale must be between 0.001 and 1.0'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        thread = threading.Thread(
            target=_run_simulation_in_background,
            args=(scale, days, clear, False, 60, skip_activities, total_users),
            daemon=True,
        )
        thread.start()

        return Response({
            'status': 'started',
            'running': True,
            'scale': scale,
            'days': days,
            'clear': clear,
            'message': f'Simulation started. Estimated time: ~{int(scale * 30)} minutes.',
        })

