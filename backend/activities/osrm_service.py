"""
OSRM HTTP client for live simulator routing (BSD-2-Clause engine; OSM ODbL data).

Anti-cheat / user track validation stays on BRouterService — this is sim-only throughput.
"""

from __future__ import annotations

import os
import threading
import time
from typing import Any

import requests
from requests.adapters import HTTPAdapter

# OSRM /route/v1/{profile}/{lon},{lat};{lon},{lat}
# OSRM graph is built with one Lua profile (default car.lua in entrypoint).
# API profile name must match that build — use OSRM_PROFILE to override.
PROFILE_MAP = {
    "RUN": "car",
    "WALK": "car",
    "BIKE": "car",
    "WHEELCHAIR": "car",
}


class OsrmService:
    _http_session: requests.Session | None = None
    _base_url_cache: str | None = None
    _health_ok_until: float = 0.0
    _health_lock = threading.Lock()

    @classmethod
    def base_url(cls) -> str:
        if cls._base_url_cache is None:
            raw = (os.getenv("OSRM_URL") or "http://osrm:5000").strip().rstrip("/")
            cls._base_url_cache = raw or "http://osrm:5000"
        return cls._base_url_cache

    @classmethod
    def profile_for_activity(cls, activity_type: str) -> str:
        override = (os.getenv("OSRM_PROFILE") or "").strip()
        if override:
            return override
        return PROFILE_MAP.get((activity_type or "").upper(), "foot")

    @classmethod
    def _timeout_seconds(cls) -> float:
        try:
            return float(os.getenv("OSRM_TIMEOUT", "15"))
        except (TypeError, ValueError):
            return 15.0

    @classmethod
    def _retry_count(cls) -> int:
        try:
            return max(1, int(os.getenv("OSRM_RETRIES", "2")))
        except (TypeError, ValueError):
            return 2

    @classmethod
    def _http(cls) -> requests.Session:
        if cls._http_session is None:
            session = requests.Session()
            pool = max(8, int(os.getenv("OSRM_HTTP_POOL_SIZE", "32") or 32))
            adapter = HTTPAdapter(pool_connections=pool, pool_maxsize=pool)
            session.mount("http://", adapter)
            session.mount("https://", adapter)
            cls._http_session = session
        return cls._http_session

    @classmethod
    def health_check(cls, *, force: bool = False) -> bool:
        """Cached GET /health or lightweight route probe."""
        now = time.time()
        if not force:
            with cls._health_lock:
                if now < cls._health_ok_until:
                    return True
        ok = False
        try:
            r = cls._http().get(f"{cls.base_url()}/health", timeout=3.0)
            ok = r.status_code == 200
        except requests.exceptions.RequestException:
            pass
        if not ok:
            try:
                probe = cls._http().get(
                    f"{cls.base_url()}/route/v1/car/21.01,52.23;21.02,52.23",
                    params={"overview": "false", "steps": "false"},
                    timeout=5.0,
                )
                if probe.status_code == 200:
                    ok = (probe.json() or {}).get("code") == "Ok"
            except (requests.exceptions.RequestException, ValueError, TypeError):
                ok = False
        if ok:
            with cls._health_lock:
                cls._health_ok_until = now + 30.0
        return ok

    @classmethod
    def extract_coordinates(cls, data: dict) -> list[tuple[float, float]]:
        routes = data.get("routes") or []
        if not routes:
            return []
        geom = routes[0].get("geometry") or {}
        if geom.get("type") != "LineString":
            return []
        out: list[tuple[float, float]] = []
        for c in geom.get("coordinates") or []:
            if c and len(c) >= 2:
                out.append((float(c[1]), float(c[0])))
        return out

    @classmethod
    def route_coordinates(
        cls,
        activity_type: str,
        coordinates: list[list[float]],
        *,
        profile: str | None = None,
    ) -> dict[str, Any]:
        """
        coordinates: [[lon, lat], [lon, lat], ...]
        Returns dict with success, coordinates (lat, lon), error.
        """
        profile = profile or cls.profile_for_activity(activity_type)
        if len(coordinates) < 2:
            return {"success": False, "error": "need at least two coordinates"}

        coord_str = ";".join(f"{float(c[0])},{float(c[1])}" for c in coordinates)
        path = f"/route/v1/{profile}/{coord_str}"
        params = {
            "overview": "full",
            "geometries": "geojson",
            "steps": "false",
            "annotations": "false",
        }
        url = f"{cls.base_url()}{path}"
        last_exc = None
        retries = cls._retry_count()
        for attempt in range(retries):
            try:
                response = cls._http().get(url, params=params, timeout=cls._timeout_seconds())
                if response.status_code == 200:
                    try:
                        data = response.json()
                    except ValueError:
                        return {
                            "success": False,
                            "error": f"non-JSON: {response.text[:200]}",
                        }
                    if data.get("code") != "Ok":
                        return {
                            "success": False,
                            "error": data.get("message") or data.get("code") or "NoRoute",
                        }
                    points = cls.extract_coordinates(data)
                    if len(points) < 2:
                        return {"success": False, "error": "empty route geometry"}
                    return {
                        "success": True,
                        "coordinates": points,
                        "distance_m": (data.get("routes") or [{}])[0].get("distance"),
                    }
                err = (response.text or "").strip()[:300]
                if response.status_code >= 500 and attempt + 1 < retries:
                    time.sleep(0.1 * (attempt + 1))
                    continue
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {err}",
                    "status_code": response.status_code,
                }
            except requests.exceptions.RequestException as e:
                last_exc = e
                if attempt + 1 < retries:
                    time.sleep(0.1 * (attempt + 1))
                    continue
        return {"success": False, "error": str(last_exc or "unknown error")}
