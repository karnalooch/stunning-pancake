"""
P1 operational gate — evaluate live simulator queue / warming stability (criteria 4 & 6).

Pure functions only; CLI lives in scripts/simulator_operational_gate.py.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Literal

GateVerdict = Literal["go", "warn", "no-go"]


@dataclass
class GateSample:
    at: str
    running: bool
    ride_warming: int = 0
    routing_queue_depth: int = 0
    max_routing_queue_depth: int | None = None
    routing_backpressure_active: bool = False
    dispatches_throttled: bool = False
    ride_active: int = 0
    currently_riding: int = 0

    @classmethod
    def from_api_payload(cls, payload: dict[str, Any], *, at: str | None = None) -> GateSample:
        ts = at or payload.get("at") or ""
        max_depth = payload.get("max_routing_queue_depth")
        if max_depth is not None:
            try:
                max_depth = int(max_depth)
            except (TypeError, ValueError):
                max_depth = None
        return cls(
            at=ts,
            running=bool(payload.get("running")),
            ride_warming=int(payload.get("ride_warming") or 0),
            routing_queue_depth=int(payload.get("routing_queue_depth") or 0),
            max_routing_queue_depth=max_depth,
            routing_backpressure_active=bool(payload.get("routing_backpressure_active")),
            dispatches_throttled=bool(payload.get("dispatches_throttled")),
            ride_active=int(payload.get("ride_active") or payload.get("ride_on_map") or 0),
            currently_riding=int(payload.get("currently_riding") or 0),
        )


def _tail_fraction(samples: list[GateSample], fraction: float = 0.25) -> list[GateSample]:
    if not samples:
        return []
    n = max(1, int(len(samples) * fraction))
    return samples[-n:]


def _depth_trending_down(samples: list[GateSample]) -> bool:
    tail = _tail_fraction(samples, 0.25)
    if len(tail) < 2:
        return False
    depths = [s.routing_queue_depth for s in tail]
    return depths[-1] < depths[0]


def _check_depth(samples: list[GateSample]) -> tuple[bool, str]:
    last = samples[-1]
    max_depth = last.max_routing_queue_depth
    depth = last.routing_queue_depth
    if max_depth is None or max_depth <= 0:
        return True, "depth_cap_disabled"
    if depth <= max_depth:
        return True, f"depth_{depth}_lte_cap_{max_depth}"
    if _depth_trending_down(samples) and depth <= int(max_depth * 1.1):
        return True, f"depth_{depth}_draining_toward_cap_{max_depth}"
    return False, f"depth_{depth}_above_cap_{max_depth}"


def _check_warming(samples: list[GateSample]) -> tuple[bool, str]:
    first = samples[0].ride_warming
    last = samples[-1].ride_warming
    if last <= first:
        return True, f"warming_{first}_to_{last}"
    if first > 0 and last <= int(first * 1.05):
        return True, f"warming_stable_{first}_to_{last}"
    tail = _tail_fraction(samples, 0.25)
    if len(tail) >= 2 and tail[-1].ride_warming <= tail[0].ride_warming:
        return True, f"warming_tail_decreasing"
    return False, f"warming_growing_{first}_to_{last}"


def _check_backpressure(samples: list[GateSample], max_sustained_ratio: float = 0.8) -> tuple[bool, str]:
    if not samples:
        return True, "no_samples"
    active = sum(1 for s in samples if s.routing_backpressure_active)
    ratio = active / len(samples)
    if ratio <= max_sustained_ratio:
        return True, f"backpressure_ratio_{ratio:.2f}"
    return False, f"backpressure_sustained_{ratio:.2f}"


def evaluate_gate(samples: list[GateSample]) -> dict[str, Any]:
    """
    Returns verdict + per-criterion checks for P1 operational gate (criteria 4 & 6).
    """
    if not samples:
        return {
            "verdict": "no-go",
            "reason": "no_samples",
            "checks": {},
            "sample_count": 0,
        }

    running = [s for s in samples if s.running]
    if not running:
        return {
            "verdict": "go",
            "reason": "simulator_idle",
            "checks": {"idle": True},
            "sample_count": len(samples),
            "note": "Live sim not running — queue drain criteria N/A.",
        }

    depth_ok, depth_detail = _check_depth(running)
    warming_ok, warming_detail = _check_warming(running)
    bp_ok, bp_detail = _check_backpressure(running)

    checks = {
        "routing_depth": {"ok": depth_ok, "detail": depth_detail},
        "ride_warming": {"ok": warming_ok, "detail": warming_detail},
        "backpressure": {"ok": bp_ok, "detail": bp_detail},
    }
    passed = sum(1 for c in checks.values() if c["ok"])

    if passed == 3:
        verdict: GateVerdict = "go"
        reason = "all_criteria_met"
    elif passed >= 2:
        verdict = "warn"
        reason = "partial_criteria_met"
    else:
        verdict = "no-go"
        reason = "queue_or_warming_unstable"

    return {
        "verdict": verdict,
        "reason": reason,
        "checks": checks,
        "sample_count": len(samples),
        "running_sample_count": len(running),
        "last_sample": asdict(running[-1]),
    }
