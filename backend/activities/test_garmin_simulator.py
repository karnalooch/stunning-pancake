"""Tests for Garmin Simulator v2 — schedule, GPX, routes, live tick chain."""

from datetime import date, datetime, timedelta
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, TestCase, override_settings

from activities.garmin_simulator import (
    MotionProfile,
    RidePlan,
    ScheduleConfig,
    _generate_motion_profile,
    _haversine_m,
    _interpolate_hr,
    _interpolate_cadence,
    _interpolate_elevation,
    _interpolate_position_on_waypoints,
    _jitter_point_km,
    _make_ride_id,
    _ride_name,
    SIEDLCE_CENTER,
    generate_gpx_edge530,
    generate_gpx_from_live_points,
    generate_route,
    generate_schedules,
    get_garmin_batch_state,
    push_ride_point,
    get_ride_points,
    remove_ride_keys,
    schedule_config_from_dict,
    set_garmin_batch_state,
    set_ride_state,
    get_ride_state,
    clear_garmin_batch_state,
    incr_active_rides,
)


class ScheduleGenerationTests(SimpleTestCase):
    def test_default_config_10_users(self):
        config = ScheduleConfig(user_count=10)
        plans = generate_schedules(config)
        self.assertEqual(len(plans), 40)

    def test_single_user_has_4_rides(self):
        config = ScheduleConfig(user_count=1)
        plans = generate_schedules(config)
        self.assertEqual(len(plans), 4)

    def test_three_weekday_rides(self):
        config = ScheduleConfig(user_count=1, weekday_rides=3)
        plans = generate_schedules(config)
        weekday_plans = [p for p in plans if p.date.weekday() < 5]
        weekend_plans = [p for p in plans if p.date.weekday() >= 5]
        self.assertEqual(len(weekday_plans), 3)
        self.assertEqual(len(weekend_plans), 1)

    def test_weekday_distance_in_range(self):
        config = ScheduleConfig(
            user_count=5,
            weekday_distance_min=60, weekday_distance_max=80,
            weekend_distance_min=90, weekend_distance_max=120,
        )
        plans = generate_schedules(config)
        for plan in plans:
            if plan.date.weekday() < 5:
                self.assertGreaterEqual(plan.distance_km, 60)
                self.assertLessEqual(plan.distance_km, 80)
            else:
                self.assertGreaterEqual(plan.distance_km, 90)
                self.assertLessEqual(plan.distance_km, 120)

    def test_speed_in_range(self):
        config = ScheduleConfig(user_count=5, speed_min=20, speed_max=31)
        plans = generate_schedules(config)
        for plan in plans:
            self.assertGreaterEqual(plan.speed_kmh, 20)
            self.assertLessEqual(plan.speed_kmh, 31)

    def test_weekday_start_time_window(self):
        config = ScheduleConfig(user_count=3, weekday_start_h_min=14, weekday_start_h_max=18)
        plans = generate_schedules(config)
        for plan in plans:
            if plan.date.weekday() < 5:
                self.assertGreaterEqual(plan.start_time.hour, 14)
                self.assertLessEqual(plan.start_time.hour, 18)

    def test_weekend_start_time_window(self):
        config = ScheduleConfig(user_count=3, weekend_start_h_min=8, weekend_start_h_max=14)
        plans = generate_schedules(config)
        for plan in plans:
            if plan.date.weekday() >= 5:
                self.assertGreaterEqual(plan.start_time.hour, 8)
                self.assertLessEqual(plan.start_time.hour, 14)

    def test_start_near_siedlce(self):
        config = ScheduleConfig(user_count=3, start_radius_km=5)
        plans = generate_schedules(config)
        for plan in plans:
            dist = _haversine_m(SIEDLCE_CENTER[0], SIEDLCE_CENTER[1], plan.start_lat, plan.start_lon)
            self.assertLessEqual(dist, 5500)

    def test_jitter_circle(self):
        points = [_jitter_point_km(SIEDLCE_CENTER[0], SIEDLCE_CENTER[1], 5) for _ in range(50)]
        for lat, lon in points:
            dist = _haversine_m(SIEDLCE_CENTER[0], SIEDLCE_CENTER[1], lat, lon)
            self.assertLessEqual(dist, 5500)

    def test_schedule_config_from_dict(self):
        cfg = schedule_config_from_dict({"user_count": 7, "weekday_rides": 2, "speed_min": 22})
        self.assertEqual(cfg.user_count, 7)
        self.assertEqual(cfg.weekday_rides, 2)
        self.assertEqual(cfg.speed_min, 22)
        self.assertEqual(cfg.weekday_distance_min, 60)

    def test_plans_sorted_chronologically(self):
        config = ScheduleConfig(user_count=5)
        plans = generate_schedules(config)
        for i in range(len(plans) - 1):
            self.assertLessEqual(plans[i].start_time, plans[i + 1].start_time)

    def test_ride_plan_serialization(self):
        plan = RidePlan(
            user_index=0, date=date.today(),
            start_time=datetime(2026, 6, 17, 15, 30),
            distance_km=70, speed_kmh=25,
            start_lat=52.1659, start_lon=22.2757,
        )
        d = plan.to_dict()
        plan2 = RidePlan.from_dict(d)
        self.assertEqual(plan.user_index, plan2.user_index)
        self.assertEqual(plan.distance_km, plan2.distance_km)
        self.assertEqual(plan.speed_kmh, plan2.speed_kmh)
        self.assertAlmostEqual(plan.motion.hr_base, plan2.motion.hr_base, delta=5)


class MotionProfileTests(SimpleTestCase):
    def test_motion_profile_ranges(self):
        profile = _generate_motion_profile(25.0, datetime(2026, 6, 17, 15, 30))
        self.assertGreaterEqual(profile.hr_base, 110)
        self.assertLessEqual(profile.hr_base, 170)
        self.assertGreater(profile.hr_max, profile.hr_base)
        self.assertGreaterEqual(profile.cadence_base, 60)
        self.assertLessEqual(profile.cadence_base, 100)

    def test_temperature_by_time_of_day(self):
        morning = _generate_motion_profile(25.0, datetime(2026, 6, 17, 8, 0))
        afternoon = _generate_motion_profile(25.0, datetime(2026, 6, 17, 15, 0))
        self.assertLess(morning.temperature_c, afternoon.temperature_c + 10)


class UtilsTests(SimpleTestCase):
    def test_haversine_zero(self):
        self.assertAlmostEqual(_haversine_m(52.0, 22.0, 52.0, 22.0), 0, delta=1)

    def test_haversine_known(self):
        d = _haversine_m(52.2297, 21.0122, 52.4067, 16.9288)
        self.assertGreater(d, 250000)
        self.assertLess(d, 350000)

    def test_ride_name(self):
        plan = RidePlan(
            user_index=0, date=date.today(),
            start_time=datetime(2026, 6, 17, 15, 30),
            distance_km=70, speed_kmh=25,
            start_lat=52.1659, start_lon=22.2757,
        )
        self.assertIn("Afternoon", _ride_name(plan))

    def test_make_ride_id(self):
        plan = RidePlan(
            user_index=0, date=date(2026, 6, 17),
            start_time=datetime(2026, 6, 17, 15, 30),
            distance_km=70, speed_kmh=25,
            start_lat=52.1659, start_lon=22.2757,
        )
        rid = _make_ride_id(123, plan)
        self.assertTrue(rid.startswith("123_"))

    def test_interpolate_position(self):
        wp = [(52.0, 22.0), (52.01, 22.01)]
        lat, lon, _ = _interpolate_position_on_waypoints(wp, 0.0)
        self.assertAlmostEqual(lat, 52.0, delta=0.001)
        lat, lon, _ = _interpolate_position_on_waypoints(wp, 1.0)
        self.assertAlmostEqual(lat, 52.01, delta=0.02)


class GpxGenerationTests(SimpleTestCase):
    def _make_ride_plan(self, date_val=date(2026, 6, 17), hour=15):
        return RidePlan(
            user_index=0, date=date_val,
            start_time=datetime(2026, 6, 17, hour, 30),
            distance_km=2, speed_kmh=25,
            start_lat=52.1659, start_lon=22.2757,
        )

    def _simple_waypoints(self):
        return [(52.1659, 22.2757), (52.1700, 22.2800), (52.1720, 22.2850)]

    def test_generates_valid_xml(self):
        import xml.etree.ElementTree as ET
        plan = self._make_ride_plan()
        gpx = generate_gpx_edge530(self._simple_waypoints(), plan)
        root = ET.fromstring(gpx)
        self.assertIn("creator", root.attrib)
        self.assertEqual(root.attrib["creator"], "Garmin Edge 530")

    def test_contains_hr_and_cadence(self):
        plan = self._make_ride_plan()
        gpx = generate_gpx_edge530(self._simple_waypoints(), plan)
        self.assertIn("gpxtpx:hr", gpx)
        self.assertIn("gpxtpx:cad", gpx)
        self.assertIn("gpxx:atemp", gpx)

    def test_gpx_from_live_points(self):
        plan = self._make_ride_plan()
        pts = [
            {"tick": 0, "lat": 52.16, "lon": 22.27, "ele": 152, "hr": 130,
             "cad": 80, "atemp": 22, "time": plan.start_time.isoformat(), "speed_kmh": 25},
            {"tick": 1, "lat": 52.17, "lon": 22.28, "ele": 153, "hr": 135,
             "cad": 82, "atemp": 22, "time": (plan.start_time + timedelta(seconds=1)).isoformat(), "speed_kmh": 25},
        ]
        gpx = generate_gpx_from_live_points(pts, plan)
        self.assertIn("Garmin Edge 530", gpx)
        self.assertIn("gpxtpx:hr", gpx)
        self.assertIn("trkpt", gpx)


class RouteGenerationTests(SimpleTestCase):
    def test_synthetic_loop_fallback(self):
        from activities.garmin_simulator import _synthetic_loop
        waypoints = _synthetic_loop(52.1659, 22.2757, 10)
        self.assertGreaterEqual(len(waypoints), 2)

    def test_generate_route_returns_waypoints(self):
        waypoints, source = generate_route(52.1659, 22.2757, 10, "BIKE")
        self.assertGreaterEqual(len(waypoints), 2)
        self.assertIn(source, ("road", "grid", "synthetic"))


class _FakeRedis:
    def __init__(self):
        self.hashes = {}
        self.strings = {}
        self.lists = {}

    def hset(self, key, key_or_mapping=None, value=None, mapping=None):
        if mapping:
            self.hashes.setdefault(key, {}).update(mapping)
            return len(mapping)
        elif isinstance(key_or_mapping, dict):
            self.hashes.setdefault(key, {}).update(key_or_mapping)
            return len(key_or_mapping)
        elif key_or_mapping is not None and value is not None:
            self.hashes.setdefault(key, {})[key_or_mapping] = value
            return 1
        return 0

    def hget(self, key, field):
        val = self.hashes.get(key, {}).get(field)
        if val is None:
            return None
        return val.encode() if isinstance(val, str) else val

    def hgetall(self, key):
        return {
            (k.encode() if isinstance(k, str) else k): (v.encode() if isinstance(v, str) else v)
            for k, v in self.hashes.get(key, {}).items()
        }

    def rpush(self, key, *values):
        self.lists.setdefault(key, []).extend(values)
        return len(self.lists[key])

    def ltrim(self, key, start, stop):
        if key in self.lists:
            self.lists[key] = self.lists[key][start:stop+1] if stop != -1 else self.lists[key][start:]

    def lrange(self, key, start, end):
        lst = self.lists.get(key, [])
        if end == -1:
            res = lst[start:]
        else:
            res = lst[start:end+1]
        return [item.encode() if isinstance(item, str) else item for item in res]

    def set(self, key, value, nx=False, ex=None):
        if nx and key in self.strings:
            return False
        self.strings[key] = value
        return True

    def get(self, key):
        val = self.strings.get(key)
        if val is None:
            return None
        return val.encode() if isinstance(val, str) else val

    def delete(self, *keys):
        deleted = 0
        for key in keys:
            if key in self.hashes:
                self.hashes.pop(key)
                deleted += 1
            if key in self.strings:
                self.strings.pop(key)
                deleted += 1
            if key in self.lists:
                self.lists.pop(key)
                deleted += 1
        return deleted

    def exists(self, key):
        return key in self.hashes or key in self.strings or key in self.lists

    def expire(self, key, ttl):
        pass


class RedisStateTests(TestCase):
    def setUp(self):
        super().setUp()
        self.fake_redis = _FakeRedis()
        self.get_redis_patcher = patch("activities.garmin_simulator.get_redis", return_value=self.fake_redis)
        self.get_redis_patcher.start()

    def tearDown(self):
        self.get_redis_patcher.stop()
        super().tearDown()

    @override_settings(REDIS_URL="redis://127.0.0.1:6379/15")
    def test_batch_state_defaults(self):
        clear_garmin_batch_state()
        state = get_garmin_batch_state()
        self.assertFalse(state["running"])
        self.assertEqual(state["phase"], "idle")

    @override_settings(REDIS_URL="redis://127.0.0.1:6379/15")
    def test_batch_state_set_and_get(self):
        set_garmin_batch_state(running=True, phase="testing", total_rides=40)
        state = get_garmin_batch_state()
        self.assertTrue(state["running"])
        self.assertEqual(state["phase"], "testing")
        self.assertEqual(state["total_rides"], 40)

    @override_settings(REDIS_URL="redis://127.0.0.1:6379/15")
    def test_ride_state_lifecycle(self):
        ride_id = "test_ride_123"
        remove_ride_keys(ride_id)
        set_ride_state(ride_id, status="PENDING", user_id=42, duration_s=3600, tick=0)
        state = get_ride_state(ride_id)
        self.assertIsNotNone(state)
        self.assertEqual(state["status"], "PENDING")
        self.assertEqual(state["user_id"], 42)
        remove_ride_keys(ride_id)
        self.assertIsNone(get_ride_state(ride_id))

    @override_settings(REDIS_URL="redis://127.0.0.1:6379/15")
    def test_ride_points_push_and_get(self):
        ride_id = "test_ride_points"
        remove_ride_keys(ride_id)
        push_ride_point(ride_id, {"tick": 0, "lat": 52.16, "lon": 22.27})
        push_ride_point(ride_id, {"tick": 1, "lat": 52.17, "lon": 22.28})
        pts = get_ride_points(ride_id)
        self.assertEqual(len(pts), 2)
        self.assertEqual(pts[0]["tick"], 0)
        remove_ride_keys(ride_id)


class GarminLiveSimulatorTests(TestCase):
    def setUp(self):
        super().setUp()
        self.fake_redis = _FakeRedis()
        self.get_redis_patcher = patch("activities.garmin_simulator.get_redis", return_value=self.fake_redis)
        self.get_redis_patcher.start()

    def tearDown(self):
        self.get_redis_patcher.stop()
        super().tearDown()

    @patch("activities.garmin_simulator_tasks.run_garmin_live_tick.apply_async")
    def test_schedule_rides_success(self, mock_apply_async):
        from activities.garmin_simulator import schedule_rides, ScheduleConfig
        credentials = [{"email": "test1@garmin.local", "password": "pwd"}]
        config = ScheduleConfig(user_count=1, weekday_rides=1)
        
        res = schedule_rides(credentials, config, task_id="test_task_123")
        self.assertEqual(res["status"], "scheduled")
        self.assertEqual(res["total_rides"], 2)  # 1 weekday + 1 weekend
        self.assertTrue(mock_apply_async.called)
        self.assertEqual(mock_apply_async.call_count, 2)

    @patch("activities.services.TelemetryService.push_simulator_position")
    @patch("activities.garmin_simulator_tasks.run_garmin_live_tick.apply_async")
    def test_run_live_tick_0(self, mock_apply_async, mock_push):
        from activities.garmin_simulator import run_live_tick, set_ride_state, RidePlan
        from datetime import date, datetime
        import json
        
        ride_id = "test_ride_0"
        plan = RidePlan(
            user_index=0, date=date(2026, 6, 17),
            start_time=datetime(2026, 6, 17, 15, 30),
            distance_km=10, speed_kmh=25,
            start_lat=52.1659, start_lon=22.2757,
        )
        set_ride_state(
            ride_id,
            user_id=1,
            status="PENDING",
            duration_s=1440,
            tick=0,
            plan_json=json.dumps(plan.to_dict()),
        )
        
        res = run_live_tick(ride_id, 0, 1440)
        self.assertEqual(res["status"], "tick")
        self.assertEqual(res["tick"], 0)
        
        mock_apply_async.assert_called_once_with(
            args=[ride_id, 1, 1440],
            countdown=1,
        )

    @patch("activities.services.TelemetryService.push_simulator_position")
    @patch("activities.garmin_simulator_tasks.finish_garmin_ride.delay")
    def test_run_live_tick_final(self, mock_finish_delay, mock_push):
        from activities.garmin_simulator import run_live_tick, set_ride_state, RidePlan
        from datetime import date, datetime
        import json
        
        ride_id = "test_ride_final"
        plan = RidePlan(
            user_index=0, date=date(2026, 6, 17),
            start_time=datetime(2026, 6, 17, 15, 30),
            distance_km=10, speed_kmh=25,
            start_lat=52.1659, start_lon=22.2757,
        )
        set_ride_state(
            ride_id,
            user_id=1,
            status="ACTIVE",
            duration_s=1440,
            tick=1439,
            plan_json=json.dumps(plan.to_dict()),
        )
        
        res = run_live_tick(ride_id, 1440, 1440)
        self.assertEqual(res["status"], "final_tick")
        self.assertEqual(res["tick"], 1440)
        
        mock_finish_delay.assert_called_once_with(ride_id)

    @patch("activities.models.Activity.objects.create")
    @patch("activities.garmin_upload.GarminUploadService.upload_for_user")
    @patch("activities.gpx_storage.store_gpx")
    def test_finish_garmin_ride_success(self, mock_store_gpx, mock_upload, mock_activity_create):
        from activities.garmin_simulator import finish_garmin_ride, set_ride_state, push_ride_point, RidePlan
        from datetime import date, datetime
        from django.contrib.auth import get_user_model
        from users.models import Tenant
        import json
        
        User = get_user_model()
        tenant, _ = Tenant.objects.get_or_create(name="Garmin Sim")
        user = User.objects.create(username="garmin_sim_01", tenant=tenant)
        
        ride_id = f"{user.id}_2026-06-17_1530"
        plan = RidePlan(
            user_index=0, date=date(2026, 6, 17),
            start_time=datetime(2026, 6, 17, 15, 30),
            distance_km=10, speed_kmh=25,
            start_lat=52.1659, start_lon=22.2757,
        )
        set_ride_state(
            ride_id,
            user_id=user.id,
            status="FINISHING",
            duration_s=1440,
            plan_json=json.dumps(plan.to_dict()),
        )
        
        push_ride_point(ride_id, {"lat": 52.16, "lon": 22.27, "ele": 152.0, "hr": 130, "cad": 80, "atemp": 22, "time": "2026-06-17T15:30:00Z"})
        push_ride_point(ride_id, {"lat": 52.17, "lon": 22.28, "ele": 153.0, "hr": 135, "cad": 82, "atemp": 22, "time": "2026-06-17T15:30:01Z"})
        
        mock_upload.return_value = 99999
        mock_activity_create.return_value = MagicMock()
        
        res = finish_garmin_ride(ride_id)
            
        self.assertEqual(res["status"], "complete")
        self.assertEqual(res["garmin_id"], 99999)
        self.assertTrue(mock_activity_create.called)

