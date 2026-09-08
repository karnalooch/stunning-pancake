"""
Live simulator tick body — finish/start rides and publish telemetry.

Extracted from simulator_tasks.py (Q-P0-3). Lock handling stays in live_tick_task.
"""

import logging
import os
import random
from datetime import timedelta

from django.utils import timezone

from . import ride_fsm, simulator_routing_backpressure as routing_bp, simulator_state as sim
from .simulator_route_waypoints import (
    STRICT_ROAD_ROUTES,
    _async_routing_enabled,
    _compute_live_motion,
    _generate_route_waypoints,
    _heal_stale_batch_running_flag,
    _interpolate_along_polyline,
    _maybe_log_brouter_grid_fallback,
    _ramp_start_delay_max,
    _sample_athlete_motion_profile,
)

logger = logging.getLogger("activities.simulator")


def _run_live_tick_body():
    """Core tick logic — separated so lock handling stays in the task wrapper."""
    from activities.models import Activity
    from activities.scale_disk_monitor import check_sim_writes_allowed
    from activities.services import TelemetryService
    from activities.simulator_tasks import route_live_ride_task
    from simulate_active_cities import (
        CITIES,
        _generate_activity_params,
        _pick_activity_type,
        resolve_city_for_user,
    )
    from users.models import User

    state = sim.get_live_state()
    if not state.get("running", False):
        return

    if sim.batch_blocks_live_simulation()[0]:
        return

    _heal_stale_batch_running_flag()

    writes_ok, write_reason = check_sim_writes_allowed("simulator")
    if not writes_ok:
        sim.live_log(f"Disk guard (writes): {write_reason}")
        return

    now = timezone.now()
    from activities.scale_config import MAX_TELEMETRY_PUBLISH_PER_TICK, resolve_live_scale_limits
    from events.burst import effective_event_concurrent_cap, max_starts_per_live_tick

    scale_limits = resolve_live_scale_limits(state)
    pool_size = sim.get_live_pool_count()
    active_rides = sim.get_live_rides()

    cheat_ratio = float(state.get("cheat_ratio", 0.05))
    active_ratio = float(state.get("active_ratio", 0.25))
    total_users = int(state.get("total_users", 100))

    activities_to_create = []
    completed = 0
    cheaters = 0

    async_routing = _async_routing_enabled()

    requeued_routing = sim.requeue_stale_routing_rides(rides=active_rides)
    if requeued_routing > 0:
        sim.live_log(f"Requeued {requeued_routing} stale ROUTING rides → PENDING_ROUTE.")
        active_rides = sim.get_live_rides()
    sim.refresh_live_tick_lock()

    # Promote pre-routed rides to ACTIVE when start_time reached
    promoted = 0
    for user_id, ride in list(active_rides.items()):
        if ride_fsm.can_promote_to_active(ride, now):
            sim.set_live_ride(user_id, {**ride, "ride_state": ride_fsm.ACTIVE})
            active_rides[user_id] = {**ride, "ride_state": ride_fsm.ACTIVE}
            promoted += 1

    # ── Phase 1: Finish expired ACTIVE rides ──
    rides_to_remove = []
    for user_id, ride in active_rides.items():
        if ride_fsm.normalize_ride_state(ride) != ride_fsm.ACTIVE:
            continue
        end_time = ride.get("end_time")
        if isinstance(end_time, str):
            end_time = timezone.datetime.fromisoformat(end_time)
        if end_time and now >= end_time:
            rides_to_remove.append(user_id)

    users_map_p2 = {}
    if rides_to_remove:
        users_map_p2 = {
            str(u.id): u
            for u in User.objects.filter(id__in=rides_to_remove).select_related("tenant")
        }

    for user_id in rides_to_remove:
        user = users_map_p2.get(str(user_id))
        if not user:
            continue
        ride = active_rides[user_id]

        distance_m = ride.get("distance_m", 5000)
        act_type = ride.get("act_type", "RUN")
        is_cheater = ride.get("is_cheater", False)
        start_time = ride.get("start_time")
        if isinstance(start_time, str):
            start_time = timezone.datetime.fromisoformat(start_time)

        lat = ride.get("lat", 52.2297)
        lon = ride.get("lon", 21.0122)

        if is_cheater:
            from django.contrib.gis.geos import LineString

            n_points = 8
            coords = [
                (
                    lon + distance_m / 100000.0 * (i / n_points),
                    lat + distance_m / 100000.0 * (i / n_points),
                )
                for i in range(n_points)
            ]
            route = LineString(coords, srid=4326)
            is_verified = False
            score = random.uniform(0.0, 0.25)
            cheaters += 1
        else:
            try:
                from django.contrib.gis.geos import LineString

                waypoints = ride.get("waypoints") or []
                if isinstance(waypoints, list) and len(waypoints) >= 2:
                    # Reuse live route polyline so saved activities follow roads too.
                    route = LineString([(p[1], p[0]) for p in waypoints], srid=4326)
                else:
                    from simulate_active_cities import _generate_gps_track

                    route = _generate_gps_track(lat, lon, distance_m, act_type)
            except Exception:
                route = None
            is_verified = random.random() < 0.92
            score = random.uniform(0.7, 1.0) if is_verified else random.uniform(0.0, 0.4)

        duration_s = max(60, int((now - start_time).total_seconds())) if start_time else 1800
        activities_to_create.append(
            Activity(
                user=user,
                tenant=user.tenant,
                type=act_type,
                start_time=start_time or now,
                end_time=now,
                distance=distance_m,
                duration=timedelta(seconds=duration_s),
                is_verified=is_verified,
                verification_score=score,
                route_path=route,
            )
        )
        completed += 1

    if activities_to_create:
        try:
            Activity.objects.bulk_create(activities_to_create, batch_size=50)
        except Exception:
            for a in activities_to_create:
                try:
                    a.save()
                except Exception:
                    pass

    for uid in rides_to_remove:
        sim.delete_live_ride(uid)
        active_rides.pop(uid, None)

    # ── Phase 2: Start new rides (capped globally + balanced per city) ──
    from activities.simulator_routing_backpressure import compute_live_start_budget

    max_riders = effective_event_concurrent_cap(state)
    tick_seconds = int(state.get("tick_seconds", 8))
    pipeline_count = sim.get_live_rides_in_flight_count()
    fsm_for_budget = ride_fsm.fsm_summary(active_rides)

    from activities.garmin_simulator import get_garmin_batch_state

    garmin_state = get_garmin_batch_state()
    garmin_active = int(garmin_state.get("rides_active", 0) or 0)
    active_on_map = int(fsm_for_budget["ride_on_map"]) + garmin_active
    event_stagger_cap = None
    if state.get("event_id") or state.get("event_load_test"):
        event_stagger_cap = max_starts_per_live_tick(total_users, active_ratio, tick_seconds)
    global_start_cap = int(scale_limits["max_starts_per_live_tick"] or 0)
    from activities.sim_slo import maybe_apply_starts_slo

    fsm_for_slo = ride_fsm.fsm_summary(active_rides)
    global_start_cap = maybe_apply_starts_slo(state, fsm_for_slo, base_max_starts=global_start_cap)
    state = sim.get_live_state()
    start_budget = compute_live_start_budget(
        total_users=total_users,
        active_ratio=active_ratio,
        max_riders=max_riders,
        active_on_map=active_on_map,
        pipeline_count=pipeline_count,
        global_start_cap=global_start_cap,
        event_stagger_cap=event_stagger_cap,
        warming_count=int(fsm_for_budget["ride_warming"]),
    )
    target_riding = int(start_budget["target_on_map"])
    needed = int(start_budget["starts_budget"])
    if async_routing and routing_bp.should_pause_new_starts(
        warming_count=int(fsm_for_budget["ride_warming"]),
        pending_count=int(fsm_for_budget.get("ride_pending_route", 0)),
        target_on_map=target_riding,
    ):
        needed = 0

    started = 0

    db_pool = sim.is_live_pool_db_mode()
    if needed > 0 and (pool_size > 0 or db_pool):
        riding_ids = {str(uid) for uid in active_rides.keys()}
        riding_by_city: dict[str, int] = {}
        count_active_only = start_budget["start_budget_mode"] == "active_on_map"
        for ride in active_rides.values():
            ride_state = ride_fsm.normalize_ride_state(ride)
            if count_active_only:
                if ride_state != ride_fsm.ACTIVE:
                    continue
            elif ride_state not in (
                ride_fsm.ACTIVE,
                ride_fsm.ROUTED,
                ride_fsm.ROUTING,
                ride_fsm.PENDING_ROUTE,
            ):
                continue
            slug = ride.get("city_slug")
            if slug:
                riding_by_city[slug] = riding_by_city.get(slug, 0) + 1

        n_cities = len(CITIES)
        base_per_city = target_riding // max(1, n_cities)
        extra_slots = target_riding % max(1, n_cities)

        # When `needed` is throttled (event stagger / load-test), iterating CITIES in a fixed
        # order biases the first cities (they reach the per-city cap while others stay at 0).
        # Randomize caps + iteration order per tick to keep the overview badges balanced.
        caps: dict[str, int] = {c["slug"]: base_per_city for c in CITIES}
        if extra_slots > 0 and n_cities > 0:
            extra_slugs = random.sample([c["slug"] for c in CITIES], k=min(extra_slots, n_cities))
            for s in extra_slugs:
                caps[s] = caps.get(s, base_per_city) + 1

        starters: list = []
        cities = list(CITIES)
        random.shuffle(cities)
        for city in cities:
            slug = city["slug"]
            city_cap = int(caps.get(slug, base_per_city))
            city_needed = max(0, city_cap - int(riding_by_city.get(slug, 0)))
            if city_needed <= 0 or len(starters) >= needed:
                continue
            city_needed = min(city_needed, needed - len(starters))
            sample_size = min(city_needed * 4, 10_000)
            if db_pool:
                candidates = sim.sample_live_athletes_from_db(slug, sample_size)
            else:
                candidates = sim.sample_live_pool_city(slug, sample_size)
                if len(candidates) < city_needed:
                    candidates = list(
                        dict.fromkeys(
                            candidates + sim.sample_live_pool(min(sample_size, pool_size))
                        )
                    )
            available = [uid for uid in candidates if str(uid) not in riding_ids]
            pick = random.sample(available, min(city_needed, len(available))) if available else []
            for uid in pick:
                riding_ids.add(str(uid))
            starters.extend(pick)

        users_map_p3 = {}
        if starters:
            users_map_p3 = {
                str(u.id): u for u in User.objects.filter(id__in=starters).select_related("tenant")
            }

        routing_dispatch_cap = (
            routing_bp.max_routing_dispatch_per_tick(scale_limits) if async_routing else 0
        )
        fsm_pre = ride_fsm.fsm_summary(active_rides)
        bp_snapshot = routing_bp.routing_backpressure_snapshot(
            fsm_pending=fsm_pre["ride_warming"],
            fsm_routing=fsm_pre.get("ride_routing", 0),
        )
        from activities.sim_profile import maybe_auto_lower_active_ratio_on_backpressure

        lowered = maybe_auto_lower_active_ratio_on_backpressure(state, bp_snapshot)
        if lowered is not None:
            active_ratio = float(lowered)
            state = sim.get_live_state()
        routing_dispatch_cap, dispatch_throttled, backlog_boosted = (
            routing_bp.resolve_routing_dispatch_cap(
                routing_dispatch_cap,
                bp_snapshot,
                pending_route_count=int(fsm_pre.get("ride_pending_route", 0)),
                starters_remaining=len(starters),
                active_on_map=active_on_map,
            )
        )
        bp_snapshot["effective_dispatch_cap"] = routing_dispatch_cap
        if backlog_boosted and routing_dispatch_cap > 0:
            sim.live_log(
                f"Backlog drain: dispatch_cap={routing_dispatch_cap} "
                f"(pending={fsm_pre.get('ride_pending_route', 0)}, depth={bp_snapshot['routing_queue_depth']})"
            )

        routing_dispatched = 0
        dispatches_skipped = 0
        unroutable = 0
        pending_dispatch_ids: list[int] = []
        for user_id in starters:
            user = users_map_p3.get(str(user_id))
            if not user:
                continue

            act_type = _pick_activity_type()
            distance_m, duration_s = _generate_activity_params(act_type)
            duration_s = max(300, min(3600, duration_s))
            is_cheater = random.random() < cheat_ratio

            city_info = resolve_city_for_user(user)
            lat0, lon0 = city_info["lat"], city_info["lon"]
            try:
                start_radius_km = float(os.getenv("SCALE_SIM_CITY_START_RADIUS_KM", "4"))
            except (TypeError, ValueError):
                start_radius_km = 4.0
            start_radius_km = max(0.0, min(start_radius_km, 25.0))

            motion = _sample_athlete_motion_profile(
                act_type,
                start_delay_max=_ramp_start_delay_max(state),
            )
            start_delay_s = int(motion.get("start_delay_s", 0) or 0)
            ride_start = now + timedelta(seconds=start_delay_s)
            ride_end = ride_start + timedelta(seconds=duration_s)

            from users.departments import ride_scope_from_user

            scope = ride_scope_from_user(user)
            ride_payload = {
                "start_time": ride_start.isoformat(),
                "end_time": ride_end.isoformat(),
                "act_type": act_type,
                "distance_m": distance_m,
                "lat": lat0,
                "lon": lon0,
                "anchor_lat": lat0,
                "anchor_lon": lon0,
                "start_radius_km": start_radius_km,
                "city_slug": city_info["slug"],
                "is_cheater": is_cheater,
                "tenant_id": scope["tenant_id"],
                "primary_department_id": scope["primary_department_id"],
                **motion,
            }

            if async_routing:
                sim.set_live_ride(
                    user_id,
                    {
                        **ride_payload,
                        "ride_state": ride_fsm.PENDING_ROUTE,
                    },
                )
                pending_dispatch_ids.append(user_id)
                started += 1
                continue

            waypoints, route_source = _generate_route_waypoints(
                lat0,
                lon0,
                distance_m,
                act_type,
                anchor_lat=lat0,
                anchor_lon=lon0,
                start_radius_km=start_radius_km,
                city_slug=city_info["slug"],
            )
            if not waypoints or len(waypoints) < 2:
                unroutable += 1
                sim.increment_live_routing_counter("routing_unroutable_total")
                continue
            if route_source == "grid":
                _maybe_log_brouter_grid_fallback()
            start_lat, start_lon = waypoints[0][0], waypoints[0][1]
            initial_state = ride_fsm.ACTIVE

            sim.set_live_ride(
                user_id,
                {
                    **ride_payload,
                    "ride_state": initial_state,
                    "waypoints": waypoints,
                    "route_source": route_source,
                    "lat": start_lat,
                    "lon": start_lon,
                },
            )
            started += 1

        if async_routing and (pending_dispatch_ids or routing_dispatch_cap > 0):
            backlog = [
                uid for uid, ride in active_rides.items() if ride_fsm.can_dispatch_routing(ride)
            ]
            pending_set = set(pending_dispatch_ids)
            # Drain older PENDING_ROUTE first — avoids 150 new/tick starving backlog.
            dispatch_order = [uid for uid in backlog if uid not in pending_set] + list(
                pending_dispatch_ids
            )
            backlog_cap = int(os.getenv("SCALE_SIM_MAX_ROUTING_BACKLOG", "400") or "400")
            if len(backlog) > backlog_cap and pending_dispatch_ids:
                allow_new = max(0, routing_dispatch_cap // 3)
                pending_dispatch_ids = pending_dispatch_ids[:allow_new]
                dispatch_order = [
                    uid for uid in backlog if uid not in pending_set
                ] + pending_dispatch_ids
            for user_id in dispatch_order:
                if routing_dispatched >= routing_dispatch_cap:
                    break
                route_live_ride_task.delay(user_id)
                routing_dispatched += 1
            dispatches_skipped = max(0, len(dispatch_order) - routing_dispatched)
        if unroutable > 0 and STRICT_ROAD_ROUTES:
            sim.live_log(
                f"Road-only mode: skipped {unroutable} starts this tick "
                f"(no routable street path; see BRouter routing failed lines above)."
            )
        if async_routing and routing_dispatched > 0:
            sim.live_log(f"Queued {routing_dispatched} rides on routing worker.")
        if async_routing and dispatches_skipped > 0:
            routing_bp.maybe_log_routing_backpressure(
                snapshot=bp_snapshot,
                skipped=dispatches_skipped,
                base_cap=routing_bp.max_routing_dispatch_per_tick(scale_limits),
            )
        if async_routing:
            sim.set_live_state(
                routing_queue_depth=bp_snapshot["routing_queue_depth"],
                routing_backpressure_active=bp_snapshot["routing_backpressure_active"],
                dispatches_throttled=dispatches_skipped > 0 or dispatch_throttled,
                dispatches_throttled_last_tick=dispatches_skipped,
            )

    elif async_routing:
        fsm_pre = ride_fsm.fsm_summary(active_rides)
        bp_snapshot = routing_bp.routing_backpressure_snapshot(
            fsm_pending=fsm_pre["ride_warming"],
            fsm_routing=fsm_pre.get("ride_routing", 0),
        )
        routing_dispatch_cap = routing_bp.max_routing_dispatch_per_tick(scale_limits)
        routing_dispatch_cap, dispatch_throttled, backlog_boosted = (
            routing_bp.resolve_routing_dispatch_cap(
                routing_dispatch_cap,
                bp_snapshot,
                pending_route_count=int(fsm_pre.get("ride_pending_route", 0)),
                starters_remaining=0,
                active_on_map=active_on_map,
            )
        )
        if backlog_boosted and routing_dispatch_cap > 0:
            sim.live_log(
                f"Backlog drain: dispatch_cap={routing_dispatch_cap} "
                f"(pending={fsm_pre.get('ride_pending_route', 0)}, depth={bp_snapshot['routing_queue_depth']})"
            )
        backlog = [uid for uid, ride in active_rides.items() if ride_fsm.can_dispatch_routing(ride)]
        routing_dispatched = 0
        for user_id in backlog:
            if routing_dispatched >= routing_dispatch_cap:
                break
            route_live_ride_task.delay(user_id)
            routing_dispatched += 1
        dispatches_skipped = max(0, len(backlog) - routing_dispatched)
        if routing_dispatched > 0:
            sim.live_log(f"Queued {routing_dispatched} backlog rides on routing worker.")
        if dispatches_skipped > 0:
            routing_bp.maybe_log_routing_backpressure(
                snapshot=bp_snapshot,
                skipped=dispatches_skipped,
                base_cap=routing_bp.max_routing_dispatch_per_tick(scale_limits),
            )
        sim.set_live_state(
            routing_queue_depth=bp_snapshot["routing_queue_depth"],
            routing_backpressure_active=bp_snapshot["routing_backpressure_active"],
            dispatches_throttled=dispatches_skipped > 0 or dispatch_throttled,
            dispatches_throttled_last_tick=dispatches_skipped,
        )

    sim.set_live_state(
        target_on_map=start_budget["target_on_map"],
        slots_free_on_map=start_budget["slots_free_on_map"],
        starts_budget_last_tick=needed,
        max_pipeline_rides=start_budget["max_pipeline_rides"],
        pipeline_capped_last_tick=start_budget["pipeline_capped"],
    )

    sim.refresh_live_tick_lock()

    # ── Phase 3: Interpolate + push telemetry for ALL active riders ──
    # Re-read ride hash so sync starts / promotions from phase 2 are visible this tick.
    active_rides = sim.get_live_rides()
    telemetry_entries = []

    for user_id, ride in active_rides.items():
        if not ride_fsm.telemetry_eligible(ride):
            continue
        start_time = ride.get("start_time")
        end_time = ride.get("end_time")
        if isinstance(start_time, str):
            start_time = timezone.datetime.fromisoformat(start_time)
        if isinstance(end_time, str):
            end_time = timezone.datetime.fromisoformat(end_time)

        if start_time and end_time:
            progress, speed_kmh, _paused_s = _compute_live_motion(ride, now, start_time, end_time)
        else:
            total_s = (end_time - start_time).total_seconds() if start_time and end_time else 1800
            elapsed_s = (now - start_time).total_seconds() if start_time else 0
            progress = max(0, min(1, elapsed_s / total_s if total_s > 0 else 0))
            speed_kmh = ride.get("speed_kmh")
            if not isinstance(speed_kmh, (int, float)):
                speed_kmh = (
                    random.uniform(12, 35)
                    if ride.get("act_type") == "BIKE"
                    else random.uniform(6, 15)
                )

        waypoints = ride.get("waypoints")
        if waypoints and len(waypoints) >= 2:
            clat, clon, course = _interpolate_along_polyline(waypoints, progress)
        else:
            clat = ride.get("lat", 52.2297)
            clon = ride.get("lon", 21.0122)
            course = 0

        act = str(ride.get("act_type", "BIKE") or "BIKE").strip().lower()
        sim_type = "bike" if act in ("bike", "bicycle", "cycling") else "run"
        telemetry_entries.append(
            {
                "deviceId": str(user_id),
                "name": f"Athlete {user_id}",
                "type": sim_type,
                "lat": clat,
                "lng": clon,
                "speed": speed_kmh / 3.6,
                "course": course,
                "tenantId": ride.get("tenant_id"),
                "departmentId": ride.get("primary_department_id"),
            }
        )

    if len(telemetry_entries) > MAX_TELEMETRY_PUBLISH_PER_TICK:
        telemetry_entries = telemetry_entries[:MAX_TELEMETRY_PUBLISH_PER_TICK]
    TelemetryService.push_bulk_positions(telemetry_entries)

    fsm = ride_fsm.fsm_summary(active_rides)
    from simulate_active_cities import CITIES

    city_counts = {c["slug"]: 0 for c in CITIES}
    city_bike_counts = {c["slug"]: 0 for c in CITIES}
    city_run_counts = {c["slug"]: 0 for c in CITIES}
    for ride in active_rides.values():
        if not ride_fsm.telemetry_eligible(ride):
            continue
        slug = ride.get("city_slug") or ""
        if slug not in city_counts:
            continue
        city_counts[slug] += 1
        act = str(ride.get("act_type", "BIKE") or "BIKE").upper()
        if act == "RUN":
            city_run_counts[slug] += 1
        else:
            city_bike_counts[slug] += 1
    sim.persist_live_fsm_snapshot(
        fsm,
        city_counts=city_counts,
        city_bike_counts=city_bike_counts,
        city_run_counts=city_run_counts,
    )
    tick_seq = int(state.get("tick_seq", 0)) + 1
    last_log_riding = int(state.get("last_log_riding", -1))
    new_riding = fsm["ride_on_map"]
    sim.set_live_state(
        currently_riding=new_riding,
        total_completed=int(state.get("total_completed", 0)) + completed,
        cheaters_caught=int(state.get("cheaters_caught", 0)) + cheaters,
        tick_seq=tick_seq,
    )

    warm_n = int(fsm.get("ride_warming", 0))
    target_map = int(state.get("target_on_map", 0) or 0)
    log_activity = started > 0 or completed > 0 or promoted > 0
    log_riding_change = new_riding != last_log_riding
    log_heartbeat = bool(state.get("running")) and tick_seq % 15 == 0 and new_riding > 0

    if log_activity or log_riding_change or log_heartbeat:
        ctx: list[str] = []
        if promoted > 0:
            ctx.append(f"{promoted} → ACTIVE")
        if started > 0:
            hint = " (routing…)" if new_riding == 0 and async_routing else ""
            ctx.append(f"{started} started{hint}")
        if completed > 0:
            ctx.append(f"{completed} completed")
            if cheaters > 0:
                ctx.append(f"{cheaters} cheater{'s' if cheaters > 1 else ''}")
        if not ctx:
            if log_riding_change and new_riding > 0:
                ctx.append("riders on map")
            elif log_heartbeat:
                ctx.append("steady")
        extra = ""
        if warm_n > 0 and new_riding < target_map:
            extra = f", warming={warm_n}"
        sim.live_log(
            f"Tick #{tick_seq}: {', '.join(ctx)} — {new_riding} on map, "
            f"📡 {len(telemetry_entries)} positions{extra}"
        )
        if log_riding_change:
            sim.set_live_state(last_log_riding=new_riding)
