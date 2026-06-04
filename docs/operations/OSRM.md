# Runbook — OSRM (symulator live)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Platform Operator, Backend |

**Licencje:** silnik [BSD-2-Clause](https://github.com/Project-OSRM/osrm-backend/blob/master/LICENSE); dane [OpenStreetMap ODbL](https://www.openstreetmap.org/copyright) — atrybucja w produkcie.

**Zakres:** tylko **live simulator** (`SCALE_SIM_ROUTING_BACKEND=osrm`). **Anti-cheat użytkowników** → nadal `BRouterService` / `BROUTER_URL`.

---

## Włączenie

| Env | Wartość |
|-----|---------|
| `SCALE_SIM_ROUTING_BACKEND` | `osrm` \| `brouter` \| `auto` \| `template` |
| `OSRM_URL` | `http://osrm:5000` (Compose) / `http://osrm.railway.internal:5000` |
| `OSRM_TIMEOUT` | `15` |
| `OSRM_RETRIES` | `2` |
| `OSRM_PROFILE` | opcjonalnie (domyślnie foot/bicycle per typ aktywności) |

SSOT Railway: `celery-worker-simulation/railway.json`, `celery-worker-routing/railway.json` — `osrm` + `OSRM_URL`.

---

## Deploy Railway

```powershell
# Wymaga: RAILWAY_API_TOKEN, kod OSRM na GitHub main
.\scripts\railway-setup-osrm.ps1
.\scripts\railway-configure-service-build.ps1   # jeśli logi pokazują Expo/Metro
.\scripts\railway-verify-production.ps1
```

1. Serwis **osrm** — Dockerfile `infrastructure/osrm/Dockerfile`, context repo root (**push `main` przed redeploy**).
2. Volume **≥ 8 GB** na `/data` (extract Polski ~10–40 min przy pierwszym starcie).
3. Po `osrm-routed` ready: `OSRM_URL` na workerach (skrypt ustawia automatycznie).
4. BRouter **zostaje** dla walidacji tras użytkowników (nie wyłączać na backendzie).

---

## `auto` i `template`

| Backend | Zachowanie |
|---------|------------|
| `auto` | OSRM gdy health OK, inaczej BRouter |
| `template` | Tylko Redis `sim:route_tpl:*` + siatka — zero HTTP routingu |

---

## Troubleshooting

| Objaw | Działanie |
|-------|-----------|
| Logi tylko `Mounting volume…`, brak `[osrm]` | Healthcheck na `:5000` przed `osrm-routed` — w `railway.json`: `healthcheckPath: null` |
| `PBF error: blob contains no data` | Uszkodzony PBF na volume — entrypoint usuwa plik mniejszy niż `OSRM_PBF_MIN_BYTES` i pobiera ponownie |
| `Connection refused` na `OSRM_URL` | Kontener `osrm` jeszcze buduje graf — logi `osrm-extract` |
| `NoRoute` / `NoSegment` | Punkt poza extractem (np. zły region) — sprawdź `OSRM_PBF_URL` |
| Sim nadal woła BRouter | Dashboard nadpisuje env — redeploy z `railway.json` lub `railway-sync-sim-env` |

**Powiązane:** [SIMULATOR.md](./SIMULATOR.md) · [BROUTER.md](./BROUTER.md) · [infrastructure/osrm/README.md](../../infrastructure/osrm/README.md)
