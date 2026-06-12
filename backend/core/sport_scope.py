"""
Product scope: cycling, running, nordic walking only (Tier 0).
"""

from __future__ import annotations

ALLOWED_ACTIVITY_TYPES: tuple[str, ...] = ("RUN", "BIKE", "WALK")

# Legacy mobile / API aliases → canonical type
ACTIVITY_TYPE_ALIASES: dict[str, str] = {
    "ride": "BIKE",
    "cycling": "BIKE",
    "bike": "BIKE",
    "run": "RUN",
    "running": "RUN",
    "walk": "WALK",
    "nordic_walking": "WALK",
    "nordic-walking": "WALK",
    "nw": "WALK",
    "event": "BIKE",
}


def normalize_activity_type(raw: str | None, *, default: str = "BIKE") -> str:
    """Map client alias to canonical RUN/BIKE/WALK."""
    if not raw:
        return default
    key = str(raw).strip()
    upper = key.upper()
    if upper in ALLOWED_ACTIVITY_TYPES:
        return upper
    return ACTIVITY_TYPE_ALIASES.get(key.lower(), default)


def is_allowed_activity_type(activity_type: str | None) -> bool:
    return activity_type in ALLOWED_ACTIVITY_TYPES


def activity_matches_sport_filter(activity_type: str, sport_filter: str) -> bool:
    """Return True if activity type counts toward event with given sport_filter."""
    if not is_allowed_activity_type(activity_type):
        return False
    if sport_filter in ("ALL", "RUN_BIKE_WALK"):
        return True
    if sport_filter == "RUN":
        return activity_type == "RUN"
    if sport_filter == "BIKE":
        return activity_type == "BIKE"
    if sport_filter == "WALK":
        return activity_type == "WALK"
    if sport_filter == "RUN_BIKE":
        return activity_type in ("RUN", "BIKE")
    return True
