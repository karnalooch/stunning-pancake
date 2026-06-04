# OSRM — simulator routing operations

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/OSRM.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-04 |
| **canonical_path** | docs/en/operations/OSRM.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Platform Operator, Backend |

**Licenses:** [OSRM engine (BSD-2-Clause)](https://github.com/Project-OSRM/osrm-backend/blob/master/LICENSE); data [OpenStreetMap ODbL](https://www.openstreetmap.org/copyright) — in-product attribution required.

**Scope:** **live simulator only** (`SCALE_SIM_ROUTING_BACKEND=osrm`). **User anti-cheat** → still `BRouterService` / `BROUTER_URL`.

---

## Enable

| Env | Value |
|-----|-------|
| `SCALE_SIM_ROUTING_BACKEND` | `osrm` \| `brouter` \| `auto` \| `template` |
| `OSRM_URL` | `http://osrm:5000` (Compose) / `http://osrm.railway.internal:5000` |
| `OSRM_TIMEOUT` | `15` |
| `OSRM_RETRIES` | `2` |
| `OSRM_PROFILE` | optional (default foot/bicycle per activity type) |

Railway SSOT: `celery-worker-simulation/railway.json`, `celery-worker-routing/railway.json` — `osrm` + `OSRM_URL`.

---

## Deploy on Railway

```powershell
# Requires: RAILWAY_API_TOKEN, OSRM code on GitHub main
.\scripts\railway-setup-osrm.ps1
.\scripts\railway-configure-service-build.ps1   # if logs show Expo/Metro
.\scripts\railway-verify-production.ps1
```

1. **osrm** service — Dockerfile `infrastructure/osrm/Dockerfile`, context repo root (**push `main` before redeploy**).
2. Volume **≥ 8 GB** on `/data` (Polish extract ~10–40 min on first start).
3. After `osrm-routed` is ready: `OSRM_URL` on workers (script sets it automatically).
4. BRouter **stays** for user route validation (do not disable on backend).

---

## Live simulator lifecycle (numReplicas 0↔1)

**No redeploy:** backend `POST /live-simulate/` sets OSRM **1** replica; `DELETE` (stop) sets **0**. Code: `backend/activities/railway_osrm_lifecycle.py` (GraphQL `serviceInstanceUpdate`).

| Env (Railway **backend** service) | Description |
|-----------------------------------|-------------|
| `RAILWAY_API_TOKEN` | Railway → Account → Tokens |
| `RAILWAY_OSRM_LIFECYCLE` | `0` disables; default on when token set (non-SQLite) |
| `RAILWAY_OSRM_SERVICE_ID` | Optional UUID; else lookup by name `osrm` |
| `SCALE_SIM_ROUTING_BACKEND` | Scale-up only for `osrm` or `auto`; scale-down when lifecycle enabled |

**Cold start:** after scale-up, graph load from volume takes **minutes** — use `auto` until `:5000` health is OK.

**Manual:** `.\scripts\railway-osrm-scale.ps1 -Replicas 0|1`

**Volume:** disk cost remains at 0 replicas; process RAM — no.

---

## `auto` and `template`

| Backend | Behavior |
|---------|----------|
| `auto` | OSRM when health OK, otherwise BRouter |
| `template` | Redis only `sim:route_tpl:*` + mesh — zero HTTP routing |

---

## Troubleshooting

| Symptom | Action |
|-------|--------|
| Logs only `Mounting volume…`, no `[osrm]` | Healthcheck on `:5000` before `osrm-routed` — in `railway.json`: `healthcheckPath: null` |
| `PBF error: blob contains no data` | Corrupt PBF on volume — entrypoint deletes file smaller than `OSRM_PBF_MIN_BYTES` and re-downloads |
| `volume needs >= 8 GiB` / `df` ~4.6G | Enlarge **osrm-volume** in Railway UI to **≥ 10 GB** |
| `Failed to connect to download.geofabrik.de` | Entrypoint tries mirror HEAnet/OSM.fr; or upload PBF manually to volume |
| `Connection refused` on `OSRM_URL` | `osrm` container still building the graph — check `osrm-extract` logs |
| `NoRoute` / `NoSegment` | Point outside extract (wrong region) — check `OSRM_PBF_URL` |
| Sim still calls BRouter | Dashboard overwrites env — redeploy with `railway.json` or `railway-sync-sim-env` |
| `osrm_lifecycle: failed` in API | Missing backend token or wrong service id — check backend Variables |
| OSRM off after stop, no routes | Expected until scale-up; use `auto` or wait for cold start |

**Related:** [SIMULATOR.md](./SIMULATOR.md) · [BROUTER.md](./BROUTER.md) · [infrastructure/osrm/README.md](../../../infrastructure/osrm/README.md)
