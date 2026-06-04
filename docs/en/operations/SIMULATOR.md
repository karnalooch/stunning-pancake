# Runbook — simulator (batch + live map)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Platform Operator, Admin Owner |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/SIMULATOR.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-04 |
| **canonical_path** | docs/en/operations/SIMULATOR.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Platform Operator, Admin Owner |
| **Spec** | [SIMULATOR_ARCHITECTURE.md](../../SIMULATOR_ARCHITECTURE.md) |

**Code:** `backend/activities/simulator_*.py`, `admin/src/modules/analytics/SimulatorPage.tsx`, `LiveMap.tsx`

---

## Rule 1: batch first, then live

1. Run **batch** (generate athletes) and **wait until complete** (`complete` phase, lock released).
2. Optional: `POST /api/activities/admin/simulator-reset/` — clears Redis flags.
3. Then start **live simulation**.

**Why:** The live pool is built once from DB athletes. Starting live during batch yields e.g. 48 riders instead of thousands. API and Celery block live when `batch_blocks_live_simulation()` is true.

### UI (Simulator)

`SimulatorPage` uses `waitForBatchComplete()` — waits until batch **actually started**, then until **finished** (fixes first poll with `running=false` before Celery starts).

**Step 2 — two sliders (0–100, default 50):**

| Slider | Mapping (SSOT: `sim_profile.py` / `simProfileMap.ts`) |
|--------|--------------------------------------------------------|
| **Pool activity** | `active_ratio = clamp(0.08 + 0.42×I/100, 0.08–0.50)`; `cheat_ratio = clamp(0.12×I/100, 0–0.25)` |
| **System load** | starts 25→50→**100**→**150**; BRouter `round(starts×0.83)`; attempts 4 if L&lt;75 else 5; tick 12→8→6 s |

When live is active, Step 2 shows **Backpressure** if `routing_backpressure_active=true`.

### API

- `POST /api/activities/admin/live-simulate/` → **409** if batch in progress.
- `GET …/live-simulate/` → `batch_blocks_live`, `ride_warming`, `ride_routing`, `async_routing_enabled`, `routing_queue_depth`, `routing_backpressure_active`, `dispatches_throttled`, optional `sim_intensity`, `sim_load`.
- Body: legacy `active_ratio`, `cheat_ratio`, … **or** `intensity` + `load` (0–100, both required) — profile **overrides** explicit fields.
- `GET …/stats/` (GLOBAL_OWNER) → `sim_kpi` on Dashboard.

### Ride FSM (Package 1)

| State | Meaning |
|-------|---------|
| `PENDING_ROUTE` | Redis stub; waits for `route_live_ride_task` (`routing` queue) |
| `ROUTING` | Worker computes BRouter route |
| `ROUTED` | Polyline ready; telemetry after `start_time` → `ACTIVE` |
| `ACTIVE` | On map; tick publishes GPS |
| `FAILED_UNROUTABLE` | Removed from hash; `routing_unroutable_total` |

Disable async: `SCALE_SIM_ASYNC_ROUTING=0` — legacy BRouter in `live_tick`. **Routing worker:** [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md).

---

## Recommended 10k test sequence

1. Railway: `SCALE_POSTGRES_DISK_BUDGET_GB=5` on **backend** and **celery-worker-simulation**.
2. Batch: `total_users=10000`, `skip_activities=true`, `clear=true` if clean DB.
3. Log: `Done: N users` — N ≈ expected (10 cities × ~999 + moderators).
4. Stop/reset if needed, then live: `pool_pct=1.0`, e.g. `intensity=50`, `load=50`.
5. BRouter: `BROUTER_URL=http://brouter.railway.internal:17777/brouter`, `SCALE_SIM_STRICT_ROAD_ROUTES=1`.

---

## Environment variables (simulation worker)

| Variable | Default | Description |
|----------|---------|-------------|
| `SCALE_SIM_ASYNC_ROUTING` | `1` | `0` = BRouter in `live_tick`; `1` = `routing` queue |
| `SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH` | *(empty = off)* | Backpressure when `LLEN routing` + `ROUTING` FSM ≥ cap |
| `SCALE_SIM_MAX_ROUTING_DISPATCH_PER_TICK` | tied to starts | Max `route_live_ride_task.delay` per `live_tick` |
| `SIM_AUTO_LOWER_ACTIVE_RATIO_ON_BP` | `0` | Auto-lower `active_ratio` on backpressure (**off** by default) |
| `SCALE_MAX_CONCURRENT_RIDERS` | `5000` | Concurrent rides cap |
| `BROUTER_URL` | — | Prod sim often **`SCALE_SIM_ROUTING_BACKEND=osrm`** — [OSRM.md](./OSRM.md) |

**Backpressure:** depth = `LLEN routing` + rides in `ROUTING`. Dispatch is **reduced**, not zeroed. Logs: `sim.routing.backpressure` (rate-limit 60 s).

**Railway sync:** `.\scripts\railway-sync-sim-env.ps1` (requires `RAILWAY_API_TOKEN`).

Full list: `backend/activities/scale_config.py`, [SCALE_TEST_300K.md](../../SCALE_TEST_300K.md).

---

## Live Map (admin) — zoom tiers

Modules: `liveMapZoom.ts`, `liveMapLayers.ts`, `liveMapInterp.ts`. Runbook: [LIVE_MAP.md](./LIVE_MAP.md).

| Zoom | Mode | Render |
|------|------|--------|
| &lt; 7 | country | GL hubs + `detail=summary` |
| 7–12 | region → neighborhood | Hubs + **clusters only** (no individual riders) |
| ≥ 12 | handoff+ | **Individual GL dots** (`dotFadeInStart=12`), then GPU icons |
| ≥ 13.35 | labels | Icon + GPU text |

**API LOD:** `summary` if z &lt; 5, `standard` if z &lt; 12, **`full` at z ≥ 12**.

```bash
cd admin
npx playwright test e2e/live-map-zoom.spec.ts --project=live-map-zoom
```

---

## Common logs

| Log | Meaning |
|-----|---------|
| `only N athletes available (wanted M)` | Live started too early or few ATHLETE rows |
| `BRouter routing failed … pass=0` | Off-road start — retry from city center; [BROUTER.md](./BROUTER.md) |
| `Batch simulation is still in progress` | Live blocked — expected |
| `Routing backpressure: skipped N dispatches` | Queue / FSM ≥ `SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH` |

---

## Wipe — stuck detection and recovery

Chunked `DELETE /api/activities/admin/wipe-data/` stores progress in Redis. API sets `stuck=true` on stale `queued`/`running` or no `last_progress_at` (see env `WIPE_STALE_*`).

Admin: on `stuck`, auto `recoverStuckWipe` once per session — `simulator-reset/` then `wipe-data/` with `force=true`.

**Worker OOM during wipe:** reset locks, redeploy `celery-worker` (4 GB SSOT), lower `SCALE_WIPE_USER_CHUNK_SIZE`. See [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md).

---

## Admin endpoints (summary)

| Method | Path |
|--------|------|
| POST/GET/DELETE | `/api/activities/admin/simulate/` — batch |
| POST/GET/DELETE | `/api/activities/admin/live-simulate/` — live |
| POST | `/api/activities/admin/simulator-reset/` |

Details: [SIMULATOR_ARCHITECTURE.md](../../SIMULATOR_ARCHITECTURE.md) §5.

---

## Related

- [LIVE_MAP.md](./LIVE_MAP.md)
- [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md)
- [DATADOG_SIMULATOR.md](./DATADOG_SIMULATOR.md)
- [../../admin/P1_ROADMAP.md](../../admin/P1_ROADMAP.md)
