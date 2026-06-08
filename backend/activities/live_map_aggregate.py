"""
Live Map spatial aggregate — H3 cells with rectangular hexbin fallback.
"""

from __future__ import annotations

import hashlib
import json
import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

_AGG_CACHE_PREFIX = "{livemap}:agg:"
_DEFAULT_CELL_DEG = 0.008

try:
    import h3 as _h3

    _HAS_H3 = True
except ImportError:
    _h3 = None
    _HAS_H3 = False


@dataclass(frozen=True)
class AggregateRequest:
    bbox_tuple: tuple[float, float, float, float]
    mode: str
    resolution: float
    tenant_id: str | None
    department_id: int | None
    department_ids: frozenset[int] | None


def _parse_bbox(query_params) -> tuple[float, float, float, float] | None:
    raw = query_params.get("bbox", "")
    if not raw:
        return None
    try:
        parts = [float(x) for x in str(raw).split(",")]
        if len(parts) == 4:
            return tuple(parts)
    except (ValueError, TypeError):
        pass
    return None


def parse_aggregate_query_params(query_params, *, user=None) -> AggregateRequest | None:
    from activities.live_map_api import parse_live_map_query_params

    base = parse_live_map_query_params(query_params, user=user)
    bbox = _parse_bbox(query_params)
    if bbox is None:
        return None

    mode = (query_params.get("mode") or "h3").strip().lower()
    if mode not in ("h3", "hexbin"):
        mode = "h3" if _HAS_H3 else "hexbin"

    res_raw = query_params.get("resolution") or query_params.get("res") or "8"
    try:
        resolution = float(res_raw)
    except (TypeError, ValueError):
        resolution = 8.0

    return AggregateRequest(
        bbox_tuple=bbox,
        mode=mode,
        resolution=resolution,
        tenant_id=base.tenant_id,
        department_id=base.department_id,
        department_ids=base.department_ids,
    )


def _cache_key(req: AggregateRequest) -> str:
    west, south, east, north = req.bbox_tuple
    dept = req.department_id or ""
    dept_ids = ",".join(str(i) for i in sorted(req.department_ids or []))
    raw = f"{west:.4f},{south:.4f},{east:.4f},{north:.4f}|{req.mode}|{req.resolution}|{req.tenant_id}|{dept}|{dept_ids}"
    digest = hashlib.sha256(raw.encode()).hexdigest()[:24]
    return f"{_AGG_CACHE_PREFIX}{digest}"


def _get_cached(key: str) -> dict | None:
    try:
        from core.redis_cluster import get_redis

        raw = get_redis().get(key)
        if raw:
            return json.loads(raw.decode() if isinstance(raw, bytes) else raw)
    except Exception:
        pass
    return None


def _set_cached(key: str, payload: dict, ttl: int = 10) -> None:
    try:
        from core.redis_cluster import get_redis

        get_redis().setex(key, ttl, json.dumps(payload))
    except Exception:
        pass


def _in_bbox(lat: float, lng: float, west: float, south: float, east: float, north: float) -> bool:
    return west <= lng <= east and south <= lat <= north


def _filter_positions(req: AggregateRequest, positions: list[dict]) -> list[dict]:
    from activities.live_map_api import _pos_scope_fields
    from activities.live_map_rbac import position_matches_scope

    west, south, east, north = req.bbox_tuple
    out: list[dict] = []
    for pos in positions:
        if not isinstance(pos, dict):
            continue
        try:
            lat = float(pos.get("latitude", pos.get("lat", 0)))
            lng = float(pos.get("longitude", pos.get("lng", 0)))
        except (TypeError, ValueError):
            continue
        if not _in_bbox(lat, lng, west, south, east, north):
            continue
        pos_tenant, pos_dept = _pos_scope_fields(pos)
        if not position_matches_scope(
            req.tenant_id,
            req.department_id,
            pos_tenant,
            pos_dept,
            department_ids=req.department_ids,
        ):
            continue
        out.append({"lat": lat, "lng": lng})
    return out


def _cell_key(lat: float, lon: float, cell_size: float) -> tuple[int, int]:
    return (int(lat / cell_size), int(lon / cell_size))


def _hexbin_features(req: AggregateRequest, positions: list[dict]) -> dict[str, Any]:
    west, south, east, north = req.bbox_tuple
    cell_deg = req.resolution if req.resolution < 1 else _DEFAULT_CELL_DEG
    cell_deg = max(0.0005, min(cell_deg, 0.05))
    grid: dict[tuple[int, int], int] = defaultdict(int)
    for p in positions:
        grid[_cell_key(p["lat"], p["lng"], cell_deg)] += 1

    if not grid:
        return {"type": "FeatureCollection", "features": [], "meta": {"mode": "hexbin", "cells": 0}}

    max_count = max(grid.values())
    features = []
    half = cell_deg / 2
    for (row, col), count in grid.items():
        lat_c = row * cell_deg + half
        lon_c = col * cell_deg + half
        weight = round(count / max_count, 4)
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [lon_c - half, lat_c - half],
                            [lon_c + half, lat_c - half],
                            [lon_c + half, lat_c + half],
                            [lon_c - half, lat_c + half],
                            [lon_c - half, lat_c - half],
                        ]
                    ],
                },
                "properties": {"count": count, "weight": weight},
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
        "meta": {
            "mode": "hexbin",
            "cells": len(features),
            "max_count": max_count,
            "cell_deg": cell_deg,
        },
    }


def _h3_features(req: AggregateRequest, positions: list[dict]) -> dict[str, Any]:
    if not _HAS_H3:
        return _hexbin_features(req, positions)

    res = int(max(6, min(9, round(req.resolution))))
    grid: dict[str, int] = defaultdict(int)
    for p in positions:
        try:
            cell = _h3.geo_to_h3(p["lat"], p["lng"], res)
            grid[cell] += 1
        except Exception:
            continue

    if not grid:
        return {
            "type": "FeatureCollection",
            "features": [],
            "meta": {"mode": "h3", "cells": 0, "resolution": res},
        }

    max_count = max(grid.values())
    features = []
    for cell, count in grid.items():
        try:
            boundary = _h3.h3_to_geo_boundary(cell, geo_json=True)
        except Exception:
            continue
        ring = [[lng, lat] for lat, lng in boundary]
        if ring and ring[0] != ring[-1]:
            ring.append(ring[0])
        weight = round(count / max_count, 4)
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [ring]},
                "properties": {"count": count, "weight": weight, "h3": cell},
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
        "meta": {"mode": "h3", "cells": len(features), "max_count": max_count, "resolution": res},
    }


def build_aggregate_degraded_fallback() -> dict[str, Any]:
    """Fast empty payload when sim-lab proxy is unreachable (prod first-paint path)."""
    return {
        "type": "FeatureCollection",
        "features": [],
        "meta": {
            "degraded": True,
            "sim_lab_proxy_fallback": True,
            "enabled": True,
            "h3_available": _HAS_H3,
            "cells": 0,
            "hint": "sim_lab_unreachable",
        },
    }


def build_aggregate_payload(req: AggregateRequest) -> dict[str, Any]:
    from core.models import FeatureFlag

    if not FeatureFlag.is_enabled("live_map_h3_aggregate"):
        return {
            "type": "FeatureCollection",
            "features": [],
            "meta": {"enabled": False, "h3_available": _HAS_H3},
        }

    cache_key = _cache_key(req)
    cached = _get_cached(cache_key)
    if cached is not None:
        cached.setdefault("meta", {})["cached"] = True
        return cached

    from activities.services import TelemetryService

    raw = TelemetryService.scan_all_live_positions(limit=5000)
    positions = _filter_positions(req, raw)

    mode = req.mode
    if mode == "h3" and not _HAS_H3:
        mode = "hexbin"

    if mode == "h3":
        body = _h3_features(req, positions)
    else:
        body = _hexbin_features(req, positions)

    body["meta"] = {
        **(body.get("meta") or {}),
        "enabled": True,
        "h3_available": _HAS_H3,
        "positions_scanned": len(raw),
        "positions_in_bbox": len(positions),
        "cached": False,
    }
    _set_cached(cache_key, body, ttl=12)
    return body
