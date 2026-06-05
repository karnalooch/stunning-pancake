"""Tests for per-session simulator scale_overrides (wizard sliders)."""

import json
from unittest.mock import patch

from django.test import SimpleTestCase

from activities.scale_config import (
    OVERRIDE_MAX_BROUTER_CALLS_HARD_CAP,
    OVERRIDE_MAX_STARTS_HARD_CAP,
    OVERRIDE_ROUTE_ATTEMPTS_MAX,
    parse_scale_overrides_payload,
    resolve_live_scale_limits,
    scale_overrides_for_storage,
)


class ParseScaleOverridesTest(SimpleTestCase):
    def test_clamps_starts_to_hard_cap(self):
        parsed = parse_scale_overrides_payload({"max_starts_per_live_tick": 2000})
        self.assertEqual(parsed["max_starts_per_live_tick"], OVERRIDE_MAX_STARTS_HARD_CAP)

    def test_accepts_1000_starts(self):
        parsed = parse_scale_overrides_payload({"max_starts_per_live_tick": 1000})
        self.assertEqual(parsed["max_starts_per_live_tick"], 1000)

    def test_clamps_brouter_calls(self):
        parsed = parse_scale_overrides_payload({"brouter_max_calls_per_tick": 500})
        self.assertEqual(parsed["brouter_max_calls_per_tick"], OVERRIDE_MAX_BROUTER_CALLS_HARD_CAP)

    def test_clamps_route_attempts(self):
        parsed = parse_scale_overrides_payload({"brouter_route_attempts": 99})
        self.assertEqual(parsed["brouter_route_attempts"], OVERRIDE_ROUTE_ATTEMPTS_MAX)

    def test_invalid_payload_returns_none(self):
        self.assertIsNone(parse_scale_overrides_payload("not-json"))
        self.assertIsNone(parse_scale_overrides_payload([]))

    def test_storage_roundtrip(self):
        raw = {"max_starts_per_live_tick": 50, "brouter_max_calls_per_tick": 40}
        stored = scale_overrides_for_storage(parse_scale_overrides_payload(raw))
        self.assertIsNotNone(stored)
        parsed = parse_scale_overrides_payload(json.loads(stored))
        self.assertEqual(parsed["max_starts_per_live_tick"], 50)
        self.assertEqual(parsed["brouter_max_calls_per_tick"], 40)


class ResolveLiveScaleLimitsTest(SimpleTestCase):
    @patch.dict("os.environ", {}, clear=True)
    def test_session_override_beats_env(self):
        state = {
            "scale_overrides": json.dumps(
                {
                    "max_starts_per_live_tick": 80,
                    "brouter_max_calls_per_tick": 60,
                }
            ),
        }
        with patch.dict(
            "os.environ",
            {
                "SCALE_MAX_STARTS_PER_LIVE_TICK": "10",
                "SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK": "10",
            },
            clear=False,
        ):
            limits = resolve_live_scale_limits(state)
        self.assertEqual(limits["max_starts_per_live_tick"], 80)
        self.assertEqual(limits["brouter_max_calls_per_tick"], 60)

    @patch.dict(
        "os.environ",
        {
            "SCALE_MAX_STARTS_PER_LIVE_TICK": "45",
            "SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK": "30",
            "SCALE_SIM_BROUTER_ROUTE_ATTEMPTS": "6",
        },
        clear=False,
    )
    def test_env_beats_module_default_without_session(self):
        limits = resolve_live_scale_limits({})
        self.assertEqual(limits["max_starts_per_live_tick"], 45)
        self.assertEqual(limits["brouter_max_calls_per_tick"], 30)
        self.assertEqual(limits["brouter_route_attempts"], 6)

    @patch.dict("os.environ", {}, clear=True)
    def test_defaults_without_env_or_session(self):
        limits = resolve_live_scale_limits(None)
        self.assertEqual(limits["max_starts_per_live_tick"], 30)
        self.assertEqual(limits["brouter_max_calls_per_tick"], 25)
        self.assertEqual(limits["brouter_route_attempts"], 4)
