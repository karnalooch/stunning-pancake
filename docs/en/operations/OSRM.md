# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/OSRM.md) |
| **translation_status** | machine-translated |
| **canonical_path** | docs/en/operations/OSRM.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Platform Operator, Backend |

**Licenses:** [BSD-2-Clause] engine(https://github.com/Project-OSRM/osrm-backend/blob/master/LICENSE); data [OpenStreetMap ODbL](https://www.openstreetmap.org/copyright) - in-product attribution.

**Scope:** **live simulator only** (`SCALE_SIM_ROUTING_BACKEND=osrm`). **Anti-cheat users** → still `BRouterService` / `BROUTER_URL`.

---

## Enable

| Env | Value |
|-----|---------|
| `SCALE_SIM_ROUTING_BACKEND` | `osrm` \| `brouter` \| `auto` \| `template` |
| `OSRM_URL` | `http://osrm:5000` (Compose) / `http://osrm.railway.internal:5000` |
| `OSRM_TIMEOUT` | `15` |
| `OSRM_RETRIES` | `2` |
| `OSRM_PROFILE` | optional (default foot/bicycle per activity type) |

SSOT Railway: `celery-worker-simulation/railway.json`, `celery-worker-routing/railway.json` - `osrm` + `OSRM_URL`.

---

## Deploy Railway```powershell
# Wymaga: RAILWAY_API_TOKEN, kod OSRM na GitHub main
.\scripts\railway-setup-osrm.ps1
.\scripts\railway-configure-service-build.ps1   # jeśli logi pokazują Expo/Metro
.\scripts\railway-verify-production.ps1
```1. **osrm** service - Dockerfile `infrastructure/osrm/Dockerfile`, context repo root (**push `main` before redeploy**).
2. Volume **≥ 8 GB** on `/data` (extract Polish ~10–40 min at first start).
3. After `osrm-routed` ready: `OSRM_URL` on workers (the script sets it automatically).
4. BRouter **remains** for validation of user routes (do not disable it on the backend).

---

## `auto` and `template`

| Backend | Behavior |
|---------|------------|
| `auto` | OSRM when health OK, otherwise BRouter |
| `template` | Redis only `sim:route_tpl:*` + mesh - zero HTTP routing |

---

## Troubleshooting

| Symptom | Action |
|-------|-----------|
| Logs only `Mounting volume…`, no `[osrm]` | Healthcheck on `:5000` before `osrm-routed` - in `railway.json`: `healthcheckPath: null` |
| `PBF error: blob contains no data` | Corrupt PBF on volume - entrypoint deletes file smaller than `OSRM_PBF_MIN_BYTES` and downloads again |
| `volume needs >= 8 GiB` / `df` ~4.6G | Enlarge **osrm-volume** in Railway UI to **≥ 10 GB** |
| `Failed to connect to download.geofabrik.de` | Entrypoint tries mirror HEAnet/OSM.fr; or upload PBF manually to volume |
| `Connection refused` on `OSRM_URL` | The `osrm` container still builds the graph - `osrm-extract` logs |
| `NoRoute` / `NoSegment` | Point outside extract (e.g. wrong region) - check `OSRM_PBF_URL` |
| Sim still calls BRouter | Dashboard overwrites env - redeploy with `railway.json` or `railway-sync-sim-env` |

**Related:** [SIMULATOR.md](./SIMULATOR.md) · [BROUTER.md](./BROUTER.md) · [infrastructure/osrm/README.md](../../../infrastructure/osrm/README.md)
