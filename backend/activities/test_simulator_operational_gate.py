"""Unit tests for P1 simulator operational gate evaluation."""

import pytest

from activities.simulator_operational_gate import GateSample, evaluate_gate

pytestmark = pytest.mark.simulator_light


def _sample(
    i: int,
    *,
    running: bool = True,
    warming: int,
    depth: int,
    max_depth: int = 200,
    bp: bool = False,
) -> GateSample:
    return GateSample(
        at=f"t{i}",
        running=running,
        ride_warming=warming,
        routing_queue_depth=depth,
        max_routing_queue_depth=max_depth,
        routing_backpressure_active=bp,
    )


class TestEvaluateGate:
    def test_idle_sim_is_go(self):
        out = evaluate_gate([_sample(0, running=False, warming=0, depth=0)])
        assert out["verdict"] == "go"
        assert out["reason"] == "simulator_idle"

    def test_healthy_running_queue(self):
        samples = [_sample(i, warming=90 - i, depth=50 + i % 5, bp=False) for i in range(10)]
        out = evaluate_gate(samples)
        assert out["verdict"] == "go"

    def test_depth_above_cap_no_improvement_is_no_go(self):
        samples = [_sample(i, warming=100 + i, depth=120, max_depth=80, bp=True) for i in range(8)]
        out = evaluate_gate(samples)
        assert out["verdict"] == "no-go"

    def test_draining_queue_can_warn_or_go(self):
        samples = [
            _sample(i, warming=90 - min(i, 6), depth=120 - i * 5, max_depth=80, bp=i < 4)
            for i in range(10)
        ]
        out = evaluate_gate(samples)
        assert out["verdict"] in ("go", "warn")

    def test_from_api_payload(self):
        s = GateSample.from_api_payload(
            {
                "running": True,
                "ride_warming": 12,
                "routing_queue_depth": 40,
                "max_routing_queue_depth": 200,
                "routing_backpressure_active": False,
            },
            at="now",
        )
        assert s.ride_warming == 12
        assert s.max_routing_queue_depth == 200
