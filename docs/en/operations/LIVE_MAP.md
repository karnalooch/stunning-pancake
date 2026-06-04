# Live Map — operations and enterprise standard

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator / Admin Owner |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Operators, on-call, frontend maintainers |
| **lang** | en |
| **translation** | [Polski](../../operations/LIVE_MAP.md) |
| **canonical_path** | docs/en/operations/LIVE_MAP.md |

**Code:** `admin/src/modules/analytics/LiveMap.tsx`, `liveMap*` modules, API `GET /api/activities/telemetry/live/`

---

## Quality goals

| Area | Implementation |
|------|----------------|
| **LOD / zoom** | `liveMapZoom.ts`, `liveMapLayers.ts`, audit `admin/scripts/audit-live-map-lod.mjs` |
| **Smooth motion** | `liveMapInterp.ts` — blend + extrapolation between polls |
| **Viewport** | `liveMapViewport.ts` — cache bust `refresh`, no stale markers after zoom |
| **Sync health** | `liveMapHealth.ts`, `LiveMapStatusBar.tsx` — Live / Stale / Degraded / Error / Paused |
| **Polling SLO** | `liveMapPoll.ts` — API hint `poll_after_ms`, jitter, backoff on errors |
| **Ingest protection** | ADR 011 — `live_map_read_policy()`, badge + degraded mode |

---

## Transport

| Mode | Endpoint | Cadence |
|------|----------|---------|
| **Country view (z ≥ 5)** | City hubs with counts + clusters (`detail=standard`, limit ~800) | — |
| **SSE (default, z ≥ 5)** | `GET /api/activities/telemetry/live/stream/` | 200–500 ms (`stream_interval_ms` in meta) |
| **HTTP poll (fallback)** | `GET /api/activities/telemetry/live/` | ≥ 950 ms at zoom ≥ 12; slower when SSE active (~15 s) |
| **WS (optional)** | FastAPI `/ws/telemetry/live` | `position_update` from ingest — `VITE_LIVE_MAP_WS=1` |

On-map motion: **ring buffer 3 points / device** + **polyline** interpolation (`liveMapRing.ts`, `liveMapPolyline.ts`).

---

## API `telemetry/live`

| Parameter | Description |
|-----------|-------------|
| `bbox` | `west,south,east,north` (+22% padding client-side) |
| `zoom` | MapLibre zoom (rounded) |
| `detail` | `summary` \| `standard` \| `full` |
| `limit` | Position cap (0 for summary) |
| `refresh` | Non-empty → skips Redis response cache |

### Meta (enterprise)

| Field | Meaning |
|-------|---------|
| `poll_after_ms` | Suggested HTTP poll interval (ms); ≥12: ~950 ms |
| `stream_interval_ms` | SSE cadence (ms); ≥12: ~350 ms |
| `read_mode` | `normal` \| `ingest_protected` \| `viewport_capped` \| `cached` |
| `server_time` | Response Unix timestamp |
| `live_detail_ceiling` | Under ingest: max `detail` |
| `ingest_engaged` | ADR 011 — throttling active |
| `capped` | GEORADIUS returned more than viewport limit |
| `city_counts` | City hubs (summary / region) |

---

## UI states (`data-sync-status`)

- **connecting** — map or first fetch
- **live** — sync < 12 s, no degradation
- **degraded** — ingest, viewport cap, or cache
- **stale** — no successful fetch > 12 s
- **error** — network/API errors (with Refresh)
- **paused** — 401/403 or no session
- **offline** — tab in background

---

## Runbook

### Empty map after zooming to a city

1. Check sync badge (bottom-right).
2. Zoom out and in — `zoomend` forces fetch with `refresh`.
3. DevTools → `positions` and `meta.capped`.

### “Ingest load” / degraded

- Expected during ingest burst (ADR 011).
- Env names only: `LIVE_MAP_INGEST_CAP_RATIO`, `LIVE_MAP_INGEST_POLL_RATIO`, `LIVE_MAP_INGEST_CACHE_TTL` — see [CONFIGURATION.md](../../CONFIGURATION.md).

### Session paused

- Re-login to admin panel; map resumes poll when `isAuthenticated`.

### Gray map (tiles)

- “Map unavailable” → **Retry load** or OpenFreeMap CDN.

---

## Tests

```bash
cd admin
npx vitest run src/__tests__/liveMapHealth.test.ts src/__tests__/liveMapPoll.test.ts src/__tests__/liveMapViewport.test.ts src/__tests__/liveMapZoom.test.ts
npx playwright test e2e/live-map-zoom.spec.ts --project=live-map-zoom
```

---

## Related

- [SIMULATOR.md](../../operations/SIMULATOR.md) (PL) — zoom tiers, E2E screenshots
- [TELEMETRY_LOAD_TEST.md](../../operations/TELEMETRY_LOAD_TEST.md) — p95 live read
- [ADR 011](../../adr/011-telemetry-ingest-durability-under-load.md) — read shedding
