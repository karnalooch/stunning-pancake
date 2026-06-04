# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../operations/SIMULATOR.md) |
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

## Rule no. 1: batch first, then live

1. Run **batch** (player generation) and **wait for the end** (`complete` phase, lock released).
2. Optional: `POST /api/activities/admin/simulator-reset/` - clears Redis flags.
3. Only then **live simulation**.

**Why:** The live pool is built once from the players in the DB. A live start during a batch gives, for example, 48 riders instead of thousands. API and Celery block live when `batch_blocks_live_simulation()` is true (lock, `running`, phase ≠ idle/complete).

### UI (Simulator)

`SimulatorPage` uses `waitForBatchComplete()` - waits until the batch **really starts**, then until it **finishes** (fixes old bug: first poll with `running=false` before Celera starts).

**Step 2 - two sliders (0-100, default 50):**

| Slider | Mapping (SSOT: `sim_profile.py` / `simProfileMap.ts`) |
|-------|-------------------------------------|
| **Pool Activity** | `active_ratio = clamp(0.08 + 0.42×I/100, 0.08–0.50)`; `cheat_ratio = clamp(0.12×I/100, 0–0.25)` |
| **System load** | starts 25→50→**100**→**150** (0/50/75/100); BRouter `round(starts×0.83)`; attempts 4 if L&lt;75 else 5; tick 12→8→6 s |

With live active on step 2, the UI shows a **Backpressure** alert when `routing_backpressure_active=true`.

### API

- `POST /api/activities/admin/live-simulate/` → **409** if batch in progress.
- `GET /api/activities/admin/live-simulate/` → `batch_blocks_live`, `ride_warming`, `ride_routing`, `async_routing_enabled`, `routing_queue_depth`, `routing_backpressure_active`, `dispatches_throttled`, optional `sim_intensity`, `sim_load`, `effective_sim_profile`.
- `POST /api/activities/admin/live-simulate/` - body legacy: `active_ratio`, `cheat_ratio`, `tick_seconds`, `scale_overrides`, `pool_pct`. **Or** `intensity` + `load` (0-100, both required): profile **overrides** explicit fields (precedence: profile sliders).
- `GET /api/activities/admin/stats/` (GLOBAL_OWNER) → `sim_kpi` - a separate section of **Live Simulator** on the Dashboard (not to be confused with KPI athlete).

### FSM driving (Pack 1)

| Condition | Meaning |
|------|-----------|
| `PENDING_ROUTE` | Stub in Redis, waiting for `route_live_ride_task` (`routing` queue) |
| `ROUTING` | The worker calculates the route BRouter |
| `ROUTED` | Polyline ready; telemetry after `start_time` → `ACTIVE` |
| `ACTIVE` | On the map; tick publishes GPS |
| `FAILED_UNROUTABLE` | Removed from hash; counter `routing_unroutable_total` |

Disabling async: `SCALE_SIM_ASYNC_ROUTING=0` - old model (BRouter in `live_tick`).

**Routing worker:** [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) § `celery-worker-routing`. Roadmap: [P1_ROADMAP.md](../../admin/P1_ROADMAP.md).

---

## Recommended 10k test order

1. Railway: `SCALE_POSTGRES_DISK_BUDGET_GB=5` on **backend** and **celery-worker-simulation**.
2. Batch: `total_users=10000`, `skip_activities=true`, `clear=true` (if clean database).
3. Log: `Done: N users` - check N ≈ expected (10 cities × ~999 players + moderators).
4. Stop / reset if necessary, then live: `pool_pct=1.0`, e.g. `intensity=50`, `load=50` (or `active_ratio` / `tick_seconds` manually).
5. BRouter: `BROUTER_URL=http://brouter.railway.internal:17777/brouter`, `SCALE_SIM_STRICT_ROAD_ROUTES=1`.

---

## Environment variables (simulation worker)| Variable | Default | Description |
|---------|-----------|------|
| `BROUTER_URL` | — | Anti-cheat + fallback sim; sim prod: **`SCALE_SIM_ROUTING_BACKEND=osrm`** + `OSRM_URL` — [OSRM.md](./OSRM.md) |
| `SCALE_SIM_ROUTING_BACKEND` | `brouter` | `osrm` \| `brouter` \| `auto` \| `template` - simulator only |
| `OSRM_URL` | — | e.g. `http://osrm.railway.internal:5000` |
| `SCALE_SIM_STRICT_ROAD_ROUTES` | `1` | Without BRouter, rides cannot be started (no network) |
| `SCALE_SIM_SKIP_BROUTER` | `0` | `1` = mesh instead of BRouter (batch/crash) |
| `SCALE_SIM_BROUTER_MAX_LEG_KM` | `4` | Max section A→B for routing |
| `SCALE_SIM_BROUTER_ROUTE_ATTEMPTS` | `12` | Trials of the starting route |
| `SCALE_SIM_BROUTER_START_RADIUS_KM` | `4` | Random takeoff offset around city center |
| `SCALE_SIM_CITY_START_RADIUS_KM` | `4` | Player placement radius |
| `SCALE_POSTGRES_DISK_BUDGET_GB` | `5` (Railway) | Disk Budget - [DISK_GUARD.md](../DISK_GUARD.md) |
| `SCALE_BATCH_PARALLEL_CITIES` | `true` | Parallel cities with large batch |
| `SCALE_MAX_CONCURRENT_RIDERS` | `5000` | Limit of simultaneous rides |
| `SCALE_SIM_MAX_ROUTING_DISPATCH_PER_TICK` | `max_starts_per_live_tick` (~30) | Max new `route_live_ride_task.delay` per `live_tick` (regardless of backpressure) |
| `SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH` | *(blank = disabled)* | When set (e.g. `120` with 2 routing replicas) - **backpressure**: limits dispatches when `LLEN routing` + `ROUTING` FSM ≥ cap |
| `SCALE_SIM_ASYNC_ROUTING` | `1` | `0` = BRouter in `live_tick` (old model); `1` = queue `routing` |
| `SIM_AUTO_LOWER_ACTIVE_RATIO_ON_BP` | `0` | After N ticks from backpressure, lower `active_ratio` in Redis (default **off** - operator sliders take precedence) |
| `SIM_BP_LOWER_AFTER_TICKS` | `12` | Number of consecutive ticks from `routing_backpressure_active` before auto-down |
| `SIM_BP_LOWER_FACTOR` | `0.95` | Auto-reduction multiplier (less aggressive than the previous 0.85) |
| `SIM_BP_MIN_DISPATCH_PER_TICK` | `12` | Min. routing dispatches per tick with backpressure (do not block completely) |
| `SIM_BP_DRAIN_DISPATCH_PER_TICK` | `20` | Dispatchy/tick when depth just above cap |
| `SIM_BP_QUEUE_HEADROOM` | `25` | When depth ≥ cap+headroom → use min dispatch |
| `BROUTER_RETRIES` | `3` | HTTP retries on `RemoteDisconnected` / 5xx (pool `requests.Session`) |

**Backpressure (Package 1b+):** depth = `LLEN routing` + number of trips in the `ROUTING` state (undispatched `PENDING_ROUTE` does not increase the depth). With backpressure, the dispatch cap is **lowered**, not reset - the queue can drain while ramping up. Log: `sim.routing.backpressure` / entry in live log (rate-limit 60 s).

**Railway (faster ramp, Hobby 2×1 GB routing):** set to `celery-worker-simulation` + `Backend`: `SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH=120`, `SCALE_SIM_MAX_ROUTING_DISPATCH_PER_TICK=50`, `SIM_AUTO_LOWER_ACTIVE_RATIO_ON_BP=0`. Live start: `intensity=50`, `load=50` (≈ `active_ratio=0.29`, 50 starts/tick). If depth still pinned >15 min - increase cap to `150` or add a 3rd routing replica (see [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md)).

### Stable prod profile (Hobby, no UX regression)

| Question | Reply |
|---------|-----------|
| Is this a problem with the Hobby plan? | **No** - Hobby gives up to **48 GB / service** and **8 GB / replica**. Previous problems were due to **cap depth=80** in prod (repo already has **120**), **auto-downgrade `active_ratio`** (default **disabled**) and **OOM wipe/routing** (smaller chunks + RAM in `railway.json`), not the plan limit. |
| Cost ~$30/month. | With ~12 GB app + usage-based caps typically **below** this budget; don't set everything to 48 GB "just in case". |
| UX Regression | Avoid: `SIM_AUTO_LOWER_ACTIVE_RATIO_ON_BP=1`, empty `SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH`, load=100 when pinned queue, disabling ramps (`SCALE_SIM_RAMP_TICKS=0`) at startup. |

**SSOT turbo (`railway.json`):** depth **200**, dispatch **150**, starts env **150**, routing **3 replicas**, auto-lower **0**, BP **25/40**, ramp **8 s × 10 ticks**. Admin: preset **Turbo map** (intensity/load 100). After deploy: `.\scripts\railway-verify-production.ps1`.

**Note:** ~100 ACTIVE/tick requires ~100 completed routes/tick (BRouter + 3× routing). If `ride_warming` increases - routing queue; lower the load or add a replica.

### Bottlenecks (order)| # | Gardło | Objaw | Mitigacja (repo + Railway) |
|---|--------|-------|----------------------------|
| 1 | **Stare env w Dashboard** | log `cap=80`, starts≤30 | `.\scripts\railway-sync-sim-env.ps1` → depth **200**, dispatch **150** |
| 2 | **BRouter + routing throughput** | 150 queued, 1–4 ACTIVE/tick | **2× brouter** 4 GB; 4× routing @ 2 GB; `INSTANT_ACTIVE_ON_ROUTE=1`; `SCALE_SIM_ROUTE_TEMPLATE_CACHE=1` |
| 3 | **Backlog starved** | warming rośnie | dispatch **backlog first**; `SIM_SLO_AUTO_THROTTLE=1` (cap starts przy warming ≥ 280) |
| 4 | **Target puli** (`active_ratio×users`) | ~6 startów przy pełnej mapie | `active_on_map` budget + wyższa Aktywność |
| 5 | **Pipeline Redis** | OOM / wolny status | `MAX_PIPELINE_ABSOLUTE=2000`; 1× HGETALL/tick; FSM snapshot na status/map |
| 6 | **Mapa live (Backend)** | wolny GET | Backend 2 GB / 2 CPU; `SCALE_TELEMETRY_LIVE_CACHE_TTL=3` |

Sync env: `.\scripts\railway-sync-sim-env.ps1` (wymaga `RAILWAY_API_TOKEN`).

**Szybko + bezpiecznie (`SCALE_SIM_START_BUDGET_MODE=active_on_map`, domyślnie):** nowe starty liczone od **wolnych slotów na mapie** (`target_on_map − ACTIVE`), nie od całego warming. Twardy limit: `max_pipeline_rides` (~2.5× target). UI pokazuje **Wolne sloty mapy** i **startów/tick**. Przy ~999 userów i 245 ACTIVE oczekuj **~40–150 startów/tick** (nie ~6).

**Operacja po deploy:** Stop live → start **Aktywność 50 / Obciążenie 50** (nie stary `active_ratio` z calm restart). Oczekiwane: `ride_warming` spada, backpressure okazjonalne (nie ciągłe `skipped 50`), mapa nabiera ACTIVE w rampie.

Pełna lista: `backend/activities/scale_config.py`, [SCALE_TEST_300K.md](../SCALE_TEST_300K.md).

### Testy lokalne (pamięć)

Po dużym live sim Redis może trzymać ogromny hash `live_rides` — **GET status ładuje `hgetall`**, co przy pytest może skończyć się OOM.```bash
cd backend
python run_pytest.py activities/test_simulator_backpressure.py activities/test_simulator_status_views.py activities/test_simulator_routing.py -m simulator_light -v --tb=short
```Unit tests mock broker and `get_live_rides`; status views have `autouse` patch to empty hash. Don't run a full `pytest` backend if you load GDAL/PostGIS unnecessarily.

**Structured logs (Pack 1b - Datadog / Railway):** look for the keys `sim.routing.backpressure` and `sim.routing.unroutable` in the `celery-worker-simulation` / `celery-worker-routing` worker logs. Field details: [DATADOG_SIMULATOR.md](./DATADOG_SIMULATOR.md).

---

## Live Map (admin) - zoom levels

Modules: `liveMapZoom.ts` (tiers + LOD API), `liveMapLayers.ts` (GPU tiers), `liveMapInterp.ts` (smooth traffic), `liveMapSprite.ts` (icon atlas), `liveMapHealth.ts` / `LiveMapStatusBar.tsx` (sync enterprise). Badge on the map = current mode. Runbook: [LIVE_MAP.md](./LIVE_MAP.md).

| Zoom | Mode | Render |
|------|------|--------|
| &lt; 7 | Country | GL Hubs + `detail=summary` (no points in JSON) |
| 7–8.5 | Region | Hubs + clusters |
| 8.5–9.5 | Agglomeration | Hubs (fade to ~10.8) + clusters |
| 9.5–10.5 | City | MapLibre clusters (click = zoom) |
| 10.5–11.5 | District | Tighter clusters |
| 11.5–12.2 | Estate | Clusters + GL dots |
| 12.2–12.8 | Closeup | Crossfade dots → GPU icons |
| 12.8–13.35 | Streets (icons) | **Symbol layer GPU** (`iconMaxZoom` = `labelMinZoom`) |
| 13.35–14.5 | Streets (labels) | GPU icon + text (`text-optional`) |
| ≥ 14.5 | Detail | More labels (collision) |
| Click | Popup | The One and Only HOME - Athlete Card |

**LOD API:** `detail=summary|standard|full` (auto from zoom) - `summary` &lt; 7.5, `standard` &lt; 12, then `full`.

**Crossfade (paint):** `LIVE_MAP_LOD` in `liveMapZoom.ts` - wider bands than mode boundaries; audit: `node admin/scripts/audit-live-map-lod.mjs`.

**E2E screenshots (Playwright):**```bash
cd admin
npx playwright test e2e/live-map-zoom.spec.ts --project=live-map-zoom
# pierwsze uruchomienie / zmiana stylu mapy:
npx playwright test e2e/live-map-zoom.spec.ts --project=live-map-zoom --update-snapshots
```Requires `VITE_E2E=1` (set by `webServer` in `playwright.config.ts`). Snapshots: `admin/e2e/live-map-zoom-snapshots/` (10 PNGs, one per LOD mode).

- No hundreds of HTML markers - performance like Mapbox/Uber.
- Position interpolation between polls (~320 ms).
- Clusters for zoom **14**; one `setData` per tick.

Old admin with HTML markers: deploy + Ctrl+F5.

---

## Typical logs

| Log | Meaning |
|-----|-----------|
| `only N athletes available (wanted M)` | Live started too early or too little ATHLETE in DB |
| `BRouter routing failed … pass=0` | Start off the road network - retry from the city center; see [BROUTER.md](./BROUTER.md) |
| `Road-only mode: skipped N starts` | `STRICT_ROAD_ROUTES=1` and no route |
| `Batch simulation is still in progress` | Live blocked - correct protection |
| `Routing backpressure: skipped N dispatches` | Queue routing / FSM warming ≥ `SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH` |
| `Auto-lowered active_ratio …` | `SIM_AUTO_LOWER_ACTIVE_RATIO_ON_BP` — log `sim.profile.auto_lower` (rate-limit 60 s) |

---

## Data Wipe - Stuck detection and auto-recovery

Chunked `DELETE /api/activities/admin/wipe-data/` saves progress in Redis (`last_progress_at` on each `set_wipe_state`). The API sets `stuck=true` when:

| Condition | Default threshold (env) |
|---------|---------------------|
| `queued` / `starting` phase | `WIPE_STALE_QUEUED_SEC` (120 sec) |
| Missing `last_progress_at` | `WIPE_STALE_RUNNING_SEC` (900 sec from `started_at`) |
| No progress touch | `WIPE_STALE_NO_PROGRESS_SEC` (180 sec); phase `users` additionally `min(…, WIPE_STALE_USERS_SEC=300)` |

Admin (`SimulatorApi.wipeData`): on `stuck` calls `recoverStuckWipe` once per session - `POST simulator-reset/` (clears lock), then `DELETE wipe-data/` with `force=true`. UI shows alert on progress bar.

Manually: reset the simulator in the panel, then repeat the wipe with a confirmation phrase.

### Worker OOM during wipe (Railway)

| Symptom | Reason |
|-------|-----------|
| Modal stuck in `users` phase (~60%), little `rows_deleted`, spinner | `celery-worker` got **SIGKILL (OOM)** ​​during `wipe_data_task` - Redis still shows `running` |
| Railway: `celery-worker` deploy failed, Out of Memory | Large chunks + Django `delete()` collector on User CASCADE (prefork × concurrency) |

**Immediately (operator):**

1. Wait until `celery-worker` is **Active** again (redeploy from `main` or manual restart).
2. Admin → **Reset simulator locks** (`POST simulator-reset/`) - clears the lock wipe/sim.
3. Retry **Wipe** with a confirmation phrase (UI may auto-recover with `stuck=true`).
4. Optional on the `celery-worker` website: `SCALE_WIPE_USER_CHUNK_SIZE=100`, `CELERY_WORKER_CONCURRENCY=2`.

SSOT repo: `celery-worker/railway.json` (**2 GB** RAM, smaller chunks), `wipe_tasks.py` uses `_raw_delete` in the users phase. See [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md).

---

## admin endpoints (shortcut)

| Method | Path |
|--------|---------|
| POST | `/api/activities/admin/simulate/` — start batch |
| GET | `/api/activities/admin/simulate/` - batch status |
| DELETE | `/api/activities/admin/simulate/` — stop batch |
| POST | `/api/activities/admin/live-simulate/` — start live |
| GET | `/api/activities/admin/live-simulate/` - live status |
| DELETE | `/api/activities/admin/live-simulate/` — stop live |
| POST | `/api/activities/admin/simulator-reset/` - reset flags |

Details: [SIMULATOR_ARCHITECTURE.md](../../SIMULATOR_ARCHITECTURE.md) §5.
