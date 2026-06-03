"""
Route path parsing and merge helpers for mobile sync_path PATCH.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from django.contrib.gis.geos import LineString


def _normalize_coord_pair(pair: Any) -> tuple[float, float] | None:
    if not isinstance(pair, (list, tuple)) or len(pair) < 2:
        return None
    try:
        a, b = float(pair[0]), float(pair[1])
    except (TypeError, ValueError):
        return None
    # Heuristic: |lon| <= 180, |lat| <= 90 — GeoJSON is [lon, lat]
    if abs(a) <= 180 and abs(b) <= 90:
        return (a, b)
    if abs(b) <= 180 and abs(a) <= 90:
        return (b, a)
    return (a, b)


def coords_from_payload(path_data: Any) -> list[tuple[float, float]]:
    """Accept GeoJSON LineString/Feature or list of coordinate pairs."""
    coords_raw: Any = None
    if isinstance(path_data, dict):
        if path_data.get("type") == "Feature":
            path_data = path_data.get("geometry") or {}
        if path_data.get("type") == "LineString":
            coords_raw = path_data.get("coordinates")
        elif "coordinates" in path_data:
            coords_raw = path_data["coordinates"]
    elif isinstance(path_data, list):
        coords_raw = path_data

    if not coords_raw:
        raise ValueError("no coordinates in route_path")

    out: list[tuple[float, float]] = []
    for item in coords_raw:
        pair = _normalize_coord_pair(item)
        if pair:
            out.append(pair)
    if len(out) < 2:
        raise ValueError("route_path needs at least 2 points")
    return out


def linestring_from_payload(path_data: Any) -> LineString:
    return LineString(coords_from_payload(path_data), srid=4326)


def merge_linestrings(existing: LineString | None, incoming: LineString) -> LineString:
    if not existing or not existing.coords:
        return incoming
    merged = list(existing.coords)
    inc = list(incoming.coords)
    if merged and inc:
        last = merged[-1]
        first = inc[0]
        if abs(last[0] - first[0]) < 1e-6 and abs(last[1] - first[1]) < 1e-6:
            inc = inc[1:]
    merged.extend(inc)
    if len(merged) < 2:
        return existing
    return LineString(merged, srid=4326)


def path_hash_for_coords(coords: list[tuple[float, float]]) -> str:
    payload = json.dumps(coords, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()[:32]
