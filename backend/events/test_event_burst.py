"""Tests for coordinated event-day burst protection."""
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from events.burst import (
    burst_protection_meta,
    effective_event_concurrent_cap,
    is_burst_enabled_for_event,
    join_event,
    join_rate_limit,
    max_starts_per_live_tick,
    sliding_window_try,
)
from events.scale_config import (
    EVENT_BURST_AUTO_MIN_PARTICIPANTS,
    EVENT_JOIN_RATE_PER_MINUTE,
    EVENT_MAX_CONCURRENT_RIDERS,
    EVENT_TARGET_POOL_USERS,
)


class SlidingWindowTest(SimpleTestCase):
    @patch('events.burst.get_redis')
    def test_allows_under_limit(self, mock_get_redis):
        r = MagicMock()
        mock_get_redis.return_value = r
        r.pipeline.return_value.execute.return_value = [0, 1, 1, True]

        allowed, count, retry = sliding_window_try('test:key', 10)
        self.assertTrue(allowed)
        self.assertEqual(retry, 0)

    @patch('events.burst.get_redis')
    def test_rejects_over_limit(self, mock_get_redis):
        r = MagicMock()
        mock_get_redis.return_value = r
        r.pipeline.return_value.execute.return_value = [0, 1, 11, True]

        allowed, count, retry = sliding_window_try('test:key', 10)
        self.assertFalse(allowed)
        self.assertGreater(retry, 0)
        r.zrem.assert_called_once()


class EventCapMathTest(SimpleTestCase):
    def test_50k_pool_10k_concurrent(self):
        pool = EVENT_TARGET_POOL_USERS
        cap = EVENT_MAX_CONCURRENT_RIDERS
        self.assertEqual(pool, 50_000)
        self.assertGreaterEqual(cap, 5_000)
        self.assertLessEqual(cap, 50_000)
        self.assertLess(cap, pool)

    @patch('events.scale_config.SCALE_EVENT_LOAD_TEST', True)
    def test_effective_cap_event_load_test(self, _flag):
        cap = effective_event_concurrent_cap({})
        self.assertEqual(cap, EVENT_MAX_CONCURRENT_RIDERS)

    def test_effective_cap_with_event_id_in_live_state(self):
        from activities.scale_config import MAX_CONCURRENT_RIDERS
        cap = effective_event_concurrent_cap({'event_id': '42'})
        self.assertEqual(cap, EVENT_MAX_CONCURRENT_RIDERS)
        self.assertGreaterEqual(cap, MAX_CONCURRENT_RIDERS)

    def test_stagger_reduces_per_tick_starts(self):
        per_tick = max_starts_per_live_tick(50_000, 0.3, tick_seconds=8)
        target = int(50_000 * 0.3)
        self.assertLess(per_tick, target)


class AutoBurstModeTest(TestCase):
    def setUp(self):
        from events.models import Event

        self.event = Event.objects.create(
            title='Auto Burst',
            slug='auto-burst',
            start_date=timezone.now(),
            end_date=timezone.now() + timezone.timedelta(days=1),
            status='ACTIVE',
        )

    @patch('events.burst.EVENT_BURST_MODE', 'auto')
    @patch('events.burst.participation_count', return_value=10)
    @patch('events.burst._redis_flag', return_value=False)
    def test_small_active_event_no_burst(self, *_mocks):
        self.assertFalse(is_burst_enabled_for_event(self.event.id, self.event))

    @patch('events.burst.EVENT_BURST_MODE', 'auto')
    @patch('events.burst.participation_count')
    @patch('events.burst._redis_flag', return_value=False)
    def test_large_active_event_auto_burst(self, _redis, mock_count):
        mock_count.return_value = EVENT_BURST_AUTO_MIN_PARTICIPANTS
        self.assertTrue(is_burst_enabled_for_event(self.event.id, self.event))

    @patch('events.burst.EVENT_BURST_MODE', 'auto')
    @patch('events.burst.is_burst_enabled_for_event', return_value=True)
    @patch('events.burst._track_and_check_limit')
    def test_join_rate_limit_when_enabled(self, mock_track, _enabled):
        mock_track.return_value = (False, 6000, 15)
        allowed, _, retry = join_rate_limit(self.event.id)
        self.assertFalse(allowed)
        self.assertEqual(retry, 15)


class JoinEventTest(TestCase):
    def setUp(self):
        from events.models import Event
        from django.contrib.auth import get_user_model

        User = get_user_model()
        self.user = User.objects.create_user(
            username='burst_user',
            email='burst@test.com',
            password='testpass123',
        )
        self.event = Event.objects.create(
            title='Burst Test',
            slug='burst-test',
            start_date=timezone.now(),
            end_date=timezone.now() + timezone.timedelta(days=1),
            status='ACTIVE',
        )

    @patch('events.burst.is_burst_globally_enabled', return_value=False)
    def test_join_idempotent(self):
        p1, created1, err1 = join_event(self.user, self.event)
        self.assertTrue(created1)
        self.assertIsNone(err1)

        p2, created2, err2 = join_event(self.user, self.event)
        self.assertFalse(created2)
        self.assertIsNone(err2)
        self.assertEqual(p1.id, p2.id)

    @patch('events.burst.is_burst_globally_enabled', return_value=True)
    @patch('events.burst.join_rate_limit')
    def test_join_rate_limited(self, mock_limit):
        mock_limit.return_value = (False, 100, 30)
        participation, created, err = join_event(self.user, self.event)
        self.assertIsNone(participation)
        self.assertFalse(created)
        self.assertEqual(err['status'], 429)
        self.assertEqual(err['retry_after'], 30)

    @patch('events.burst.set_burst_auto')
    @patch('events.burst.sliding_window_count', side_effect=[250, 0])
    def test_load_spike_enables_burst(self, _count, mock_auto):
        from events.burst import _maybe_auto_enable_from_load
        _maybe_auto_enable_from_load(self.event.id)
        mock_auto.assert_called_once()


class BurstMetaTest(SimpleTestCase):
    @patch('events.burst.EVENT_BURST_MODE', 'auto')
    @patch('events.burst.is_burst_enabled_for_event', return_value=True)
    @patch('events.burst.sliding_window_count', return_value=0)
    def test_join_allowed_when_under_cap(self, _count, _enabled):
        event = MagicMock()
        event.id = 1
        meta = burst_protection_meta(event)
        self.assertTrue(meta['join_allowed'])
        self.assertEqual(meta['join_rate_per_minute'], EVENT_JOIN_RATE_PER_MINUTE)
        self.assertEqual(meta['mode'], 'auto')
