"""
Live simulator ride finite-state machine (Redis ride hash fields).

States:
  PENDING_ROUTE → ROUTING → ROUTED → ACTIVE
                    └→ FAILED_UNROUTABLE (removed after accounting)
"""
from __future__ import annotations

from typing import Any

PENDING_ROUTE = 'PENDING_ROUTE'
ROUTING = 'ROUTING'
ROUTED = 'ROUTED'
ACTIVE = 'ACTIVE'
FAILED_UNROUTABLE = 'FAILED_UNROUTABLE'

ALL_STATES = frozenset({
    PENDING_ROUTE, ROUTING, ROUTED, ACTIVE, FAILED_UNROUTABLE,
})

# Legacy rides without ride_state are treated as ACTIVE.
_DEFAULT_STATE = ACTIVE


def normalize_ride_state(ride: dict[str, Any] | None) -> str:
    if not ride:
        return _DEFAULT_STATE
    raw = (ride.get('ride_state') or '').strip().upper()
    if raw in ALL_STATES:
        return raw
    if ride.get('waypoints'):
        return ACTIVE
    return _DEFAULT_STATE


def ride_counts_by_state(rides: dict[int, dict]) -> dict[str, int]:
    counts = dict.fromkeys(ALL_STATES, 0)
    for ride in rides.values():
        state = normalize_ride_state(ride)
        counts[state] = counts.get(state, 0) + 1
    return counts


def fsm_summary(rides: dict[int, dict]) -> dict[str, int]:
    """Aggregates for admin live status API."""
    counts = ride_counts_by_state(rides)
    warming = counts[PENDING_ROUTE] + counts[ROUTING]
    return {
        'ride_pending_route': counts[PENDING_ROUTE],
        'ride_routing': counts[ROUTING],
        'ride_routed': counts[ROUTED],
        'ride_active': counts[ACTIVE],
        'ride_failed_unroutable': counts[FAILED_UNROUTABLE],
        'ride_warming': warming,
        'ride_on_map': counts[ACTIVE],
    }


def can_dispatch_routing(ride: dict[str, Any]) -> bool:
    return normalize_ride_state(ride) == PENDING_ROUTE


def can_promote_to_active(ride: dict[str, Any], now) -> bool:
    if normalize_ride_state(ride) != ROUTED:
        return False
    start_time = ride.get('start_time')
    if isinstance(start_time, str):
        from django.utils import timezone
        start_time = timezone.datetime.fromisoformat(start_time)
    return bool(start_time and now >= start_time)


def telemetry_eligible(ride: dict[str, Any]) -> bool:
    return normalize_ride_state(ride) == ACTIVE
