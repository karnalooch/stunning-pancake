"""T06 contract: raw FastAPI telemetry reads must not bypass Django auth/RBAC."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_raw_read_surface_is_not_registered():
    from routes import router

    paths = {route.path for route in router.routes}

    assert "/api/telemetry/live" not in paths
    assert "/api/telemetry/history/{device_id}" not in paths
    assert "/ws/telemetry/live" not in paths

    # Keep the intended FastAPI surface intact: health + authenticated/scoped ingest.
    assert "/api/telemetry/health" in paths
    assert "/api/telemetry/ingest" in paths
    assert "/api/telemetry/ingest/batch" in paths
    assert "/ws/telemetry/ingest" in paths


def test_browser_direct_read_lane_stays_retired():
    live_map_path = ROOT / "admin/src/modules/analytics/live-map/LiveMap.tsx"
    ws_client_path = ROOT / "admin/src/modules/analytics/live-map/engine/liveMapWs.ts"
    live_map = live_map_path.read_text(encoding="utf-8")
    env_example = (ROOT / ".env.example").read_text(encoding="utf-8")

    assert "connectLiveMapWs" not in live_map
    assert not ws_client_path.exists()
    assert "VITE_LIVE_MAP_WS" not in env_example
    assert "VITE_TELEMETRY_WS_URL" not in env_example
