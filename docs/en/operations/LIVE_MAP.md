# Live Map — operations and enterprise standard

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator / Admin Owner |
| **Last reviewed** | 2026-06-05 |
| **Audience** | Operators, on-call, frontend maintainers |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/LIVE_MAP.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-04 |
| **canonical_path** | docs/en/operations/LIVE_MAP.md |

**Code:** `admin/src/modules/analytics/LiveMap.tsx`, `liveMap*` modules, API `GET /api/activities/telemetry/live/`

## Quality goals

| Area | Implementation |
|------|----------------|
| **LOD / zoom** | `liveMapZoom.ts`, `liveMapLayers.ts`, audit `admin/scripts/audit-live-map-lod.mjs` |
| **Smooth motion** | `liveMapInterp.ts` — blend + extrapolation between polls |
| **Viewport** | `liveMapViewport.ts` — `refresh` cache bust, no stale markers after zoom |
| **Sync health** | `liveMapHealth.ts`, `LiveMapStatusBar.tsx` — Live / Stale / Degraded / Error / Paused |
| **Polling SLO** | `liveMapPoll.ts` — `poll_after_ms` hint from API, jitter, backoff on errors |
| **Ingest protection** | ADR 011 — `live_map_read_policy()`, badge + degraded mode |

## Transport

| Mode | Endpoint | Cadence |
|------|----------|---------|
| **Country view (z ≥ 5)** | City hubs + counts + clusters (`detail=standard`, limit ~800) | — |
| **SSE (default, z ≥ 5)** | `GET /api/activities/telemetry/live/stream/` | 200–500 ms (`stream_interval_ms` in meta) |
| **HTTP poll (fallback)** | `GET /api/activities/telemetry/live/` | ≥ 950 ms at zoom ≥ 12; slower when SSE active (~15 s) |
| **WS (optional)** | FastAPI `/ws/telemetry/live` | `position_update` from ingest — `VITE_LIVE_MAP_WS=1` |

On-map motion: **3-point ring buffer / device** + polyline interpolation (`liveMapRing.ts`, `liveMapPolyline.ts`).

## Zoom LOD (render vs API)

| Zoom | Mode | Render |
|------|------|--------|
| &lt; 7 | country | GL city hubs + `detail=summary` (no points in JSON) |
| 7–12 | region → neighborhood | Hubs fade out; MapLibre **clusters** only |
| 12–12.2 | handoff | Cluster → **individual riders** crossfade begins |
| ≥ 12 (`LIVE_MAP_LOD.dotFadeInStart`) | street+ | **Unclustered GL dots** (`shouldRenderIndividualRiders`) then GPU symbol icons from ~12.2 |
| ≥ 13.35 | labels | Icon + optional GPU text |

**API detail** (`apiDetailForZoom`): `summary` if z &lt; 5, `standard` if z &lt; 12, **`full` at z ≥ 12** (individual positions). Clusters and city hubs cover z &lt; 12; per-rider dots/icons only from **z ≥ 12**.

## `telemetry/live` API

| Parameter | Description |
|-----------|-------------|
| `bbox` | `west,south,east,north` (+22% padding client-side) |
| `zoom` | MapLibre zoom (rounded) |
| `detail` | `summary` \| `standard` \| `full` |
| `limit` | Position cap (0 for summary) |
| `refresh` | Non-empty → bypass Redis response cache |
| `tenant_id` / `tenant` | Tenant filter (GLOBAL_OWNER); forced for TENANT_ADMIN |
| `department_id` / `department` | Department filter (within tenant scope) |

### Meta (enterprise)

| Field | Meaning |
|-------|---------|
| `poll_after_ms` | Suggested HTTP poll interval (ms); ≥12: ~950 ms |
| `stream_interval_ms` | SSE cadence (ms); ≥12: ~350 ms |
| `read_mode` | `normal` \| `ingest_protected` \| `viewport_capped` \| `cached` |
| `server_time` | Response Unix timestamp |
| `live_detail_ceiling` | Max `detail` under ingest protection |
| `ingest_engaged` | ADR 011 — throttling active |
| `capped` | GEORADIUS returned more than viewport limit |
| `city_counts` | City hubs (summary / region) |
| `filters_applied` | Active tenant/dept/activity/city filters |
| `viewport_filtered_out` | Positions dropped by tenant/dept RBAC |
| `render_mode` | `points` \| `clusters` \| `aggregate` (scale LOD) |
| `aggregate_url` | H3/hexbin URL when `render_mode=aggregate` |
| `timescale_available` | Warm path (server replay) available |

### Replay (warm path)

| Endpoint | Parameters |
|----------|------------|
| `GET /api/activities/telemetry/live/replay/` | `from`, `to` (ISO), `step` (5s/30s/60s), `bbox`, tenant/dept filters |
| `GET /api/activities/telemetry/live/replay/compare/` | same + `compare_offset=24h` (default) |

Writer: Celery Beat every **10 s** → `activities.tasks.snapshot_live_positions_to_timescale` (flag `live_map_timescale_writer`).

## Enterprise Phase 2 (B2B)

Full industry patterns (hot/warm/cold, RBAC, H3, webhooks, audit) — **[ADR 012](../../adr/012-live-map-enterprise-phase2.md)**.

| Phase | Status | Description |
|-------|--------|-------------|
| F1 Multi-tenant | ✅ | `live_map_rbac.py`, `tenantId`/`departmentId` denormalization |
| F2 Timescale replay | ✅ | `telemetry.live_position_events` hypertable, Celery writer 10s, `/replay/` |
| F3 Audit + webhooks | 🔲 | `LIVE_MAP_VIEW`, `LiveMapAlertWebhook` |
| F4 White-label | 🔲 | `Tenant.map_theme`, dynamic cluster colors |
| F5 H3 aggregate | 🔲 | Aggregate endpoint + auto LOD |

## UI states (`data-sync-status`)

- **connecting** — map or first fetch
- **live** — sync &lt; 12 s, no degradation
- **degraded** — ingest, viewport cap, or cache
- **stale** — no successful fetch &gt; 12 s
- **error** — network/API errors (Refresh button)
- **paused** — 401/403 or no session
- **offline** — tab in background

## Runbook

### Empty map after zooming to a city

1. Check sync badge (bottom-right).
2. Zoom out and in — `zoomend` forces fetch with `refresh`.
3. DevTools → `positions` and `meta.capped`.

### “Ingest load” / degraded

- Expected during ingest burst (ADR 011).
- Env: `LIVE_MAP_INGEST_CAP_RATIO`, `LIVE_MAP_INGEST_POLL_RATIO`, `LIVE_MAP_INGEST_CACHE_TTL`.

### Session paused

- Re-login to admin; map resumes polling when `isAuthenticated`.

### Gray map (tiles)

- “Map unavailable” → **Retry load** or OpenFreeMap CDN.

## Tests

```bash
cd admin
npx vitest run src/__tests__/liveMapHealth.test.ts src/__tests__/liveMapPoll.test.ts src/__tests__/liveMapViewport.test.ts src/__tests__/liveMapZoom.test.ts
npx playwright test e2e/live-map-zoom.spec.ts --project=live-map-zoom
```

## Related

- [SIMULATOR.md](./SIMULATOR.md) — zoom tiers, E2E screenshots
- [TELEMETRY_LOAD_TEST.md](./TELEMETRY_LOAD_TEST.md) — live read p95
- [ADR 011](../../adr/011-telemetry-ingest-durability-under-load.md) — read shedding
- [ADR 012](../../adr/012-live-map-enterprise-phase2.md) — enterprise Phase 2 (Timescale, RBAC, H3, webhooks)
