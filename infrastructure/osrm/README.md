# OSRM (live simulator routing)

| | |
|--|--|
| **Engine license** | [BSD-2-Clause](https://github.com/Project-OSRM/osrm-backend/blob/master/LICENSE) |
| **Map data** | [OpenStreetMap](https://www.openstreetmap.org/copyright) via Geofabrik Poland extract (**ODbL**) — attribute in product UI |

**Scope:** `SCALE_SIM_ROUTING_BACKEND=osrm` on simulation/routing workers only. **User anti-cheat** stays on BRouter (`BRouterService`).

## URLs

| Environment | URL |
|-------------|-----|
| Docker Compose | `http://osrm:5000` |
| Railway (internal) | `http://osrm.railway.internal:5000` |

## First start

1. Downloads `poland-latest.osm.pbf` (~1.8 GB) into volume `/data` if missing.
2. Runs `osrm-extract` → `partition` → `customize` (10–40 min CPU-bound).
3. Starts `osrm-routed --algorithm mld` on port **5000**.

Mount a Railway volume at `/data` so rebuilds skip re-processing.

## Env (container)

| Variable | Default |
|----------|---------|
| `OSRM_DATA_DIR` | `/data` |
| `OSRM_PBF_URL` | Geofabrik Poland |
| `OSRM_BUILD_PROFILE` | `/opt/car.lua` |
| `OSRM_PORT` | `5000` |

## Workers

```env
SCALE_SIM_ROUTING_BACKEND=osrm
OSRM_URL=http://osrm.railway.internal:5000
OSRM_TIMEOUT=15
OSRM_RETRIES=2
```

`auto` = OSRM when health probe succeeds, else BRouter.

## Throughput

OSRM typically handles **much higher** request rates than BRouter Java RouteServer — pair with `celery-worker-routing` replicas; bottleneck moves to CPU/RAM of `osrm` service.

## Railway deploy

1. New service **osrm**, root `/`, config `infrastructure/osrm/railway.json`, volume ≥ 8 GB.
2. Set `OSRM_URL` on `celery-worker-simulation` + `celery-worker-routing`.
3. `SCALE_SIM_ROUTING_BACKEND=osrm` in `celery-worker-simulation/railway.json` (already in repo SSOT).

See [docs/operations/OSRM.md](../../docs/operations/OSRM.md).
