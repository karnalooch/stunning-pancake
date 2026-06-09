# Testy wydajnosci i obciazenia (enterprise standard)


| | |
|--|--|
| **Status** | Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-05 |
| **Audience** | Platform Operator, Backend, Tech Lead |
| **lang** | pl |
| **translation** | [English](../../en/operations/PERFORMANCE_TESTING.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-05 |
| **canonical_path** | docs/pl/operations/PERFORMANCE_TESTING.md |

---

| | |
|--|--|
| **Status** | Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-05 |
| **Audience** | Platform Operator, Backend |

**Powiazane:** [TELEMETRY_LOAD_TEST.md](./TELEMETRY_LOAD_TEST.md) · [VERIFICATION.md](../../quality/VERIFICATION.md) · `scripts/load/README.md`

## Cel

Jednolity standard testow wydajnosci w monorepo: tier'y, narzedzia, SLO, raporty JSON, CI i bramka prod.

**Domyslny cel:** **sim-lab** (`infrastructure/sim-lab/`) — lokalny Docker lub osobny projekt Railway. Produkcja wymaga `ALLOW_PROD_LOAD_TEST=1` + zgody Platform Operator.

## Sim-lab (izolowana symulacja)

```
infrastructure/sim-lab/
  README.md
  .env.sim-lab.example
  docker-compose.sim-lab.yml
  railway/profiles/{smoke,300k-50k}.env
  scripts/preflight-sim-lab.ps1
  scripts/sync-sim-lab-profile.ps1
```

| Kroki | Komenda |
|-------|---------|
| Lokalny stack | `docker compose --env-file .env.sim-lab -f docker-compose.yml -f infrastructure/sim-lab/docker-compose.sim-lab.yml up -d ...` |
| Preflight | `.\infrastructure\sim-lab\scripts\preflight-sim-lab.ps1` |
| Railway profil | `.\infrastructure\sim-lab\scripts\sync-sim-lab-profile.ps1 -Profile 300k-50k` |
| Batch 300k | `$env:SIM_LAB_API_BASE=...; .\scripts\run-300k-wipe-batch.ps1` |
| Ramp | `.\scripts\railway-load-test-ramp.ps1` (domyslnie `SIM_LAB_API_BASE`) |
| Read federation (prod dashboard KPI) | `SIM_LAB_READ_FEDERATION_ENABLED=1` — [docs/todo/sim-lab-read-federation.md](../../todo/sim-lab-read-federation.md) |

## Struktura harnessu

```
scripts/load/
  README.md              # quick start
  thresholds.json        # SSOT SLO (smoke, baseline, stress-50k, soak)
  report_schema.json     # unified report v1
  lib/report.py          # build / validate / merge / evaluate
  lib/packets.py         # wspolny batch body (Locust)
  k6/live-map.js         # odczyt live map
  k6/ingest-batch.js     # POST ingest batch
  locust/locustfile.py   # HttpUser ingest + map
  suites/*.json          # definicje tier'ow
  run-suite.ps1 / .sh    # orchestrator
  reports/               # gitignored
```

Legacy (kompatybilnosc wsteczna): `scripts/load-test-telemetry-ingest.py` (`--json-out`), `scripts/load-test-telemetry-map.k6.js` (wskazuje na `scripts/load/k6/live-map.js`).

## Tier'y i SLO

Wartosci kanoniczne: `scripts/load/thresholds.json`.

| Tier | Ingest pps min | Map p95 max | Error rate max | Typowy czas |
|------|----------------|-------------|----------------|-------------|
| **smoke** | 500 | 3000 ms | 5% | ~10 s ingest |
| **baseline** | 5000 | 1000 ms | 1% | ~30 s |
| **stress-50k** | 45000 | 300 ms | 0.1% | 60 s, throttled 50k |
| **soak** | 10000 | 500 ms | 0.1% | >= 30 min |

FAIL na laptopie przy `stress-50k` nie oznacza automatycznie FAIL prod -- patrz [TELEMETRY_LOAD_TEST.md](./TELEMETRY_LOAD_TEST.md).

## Narzedzia

| Narzedzie | Sciezka | Kiedy |
|-----------|---------|-------|
| **Orchestrator** | `run-suite.ps1` / `run-suite.sh` | Tier smoke/baseline/stress z raportem JSON |
| **Python httpx** | `load-test-telemetry-ingest.py` | Ingest + map p95, `--json-out` |
| **k6** | `scripts/load/k6/*.js` | Rozproszone odczyty / ingest, progi z env |
| **Locust** | `scripts/load/locust/locustfile.py` | Swarm, staging/cluster |
| **Railway ramp** | `scripts/railway-load-test-ramp.ps1` | Tylko okno operatora na prod |

### Smoke (lokalnie)

```powershell
docker compose up -d db redis backend telemetry
.\scripts\load\run-suite.ps1 -Suite smoke
```

```bash
./scripts/load/run-suite.sh smoke
```

### Baseline z mapa (JWT)

```powershell
.\scripts\load\run-suite.ps1 -Suite baseline -Jwt $env:JWT
```

### k6

```bash
k6 run -e JWT="$JWT" -e MAP_P95_MAX=300 scripts/load/k6/live-map.js
k6 run scripts/load/k6/ingest-batch.js
```

## Observability (checklist)

Podczas kazdego tier'a >= baseline zbierz:

| Sygnal | Gdzie |
|--------|-------|
| Kolejka ingest | `GET /api/telemetry/ingest/queue/stats` |
| Celery / symulator | Flower (compose), logi `celery-worker-simulation` |
| Redis shardy | `TELEMETRY_SHARD_COUNT`, latency per shard |
| Datadog | Dashboards APM ingest + live map (prod obserwacyjnie) |
| Prometheus | Profil compose z exporterami (jesli wlaczony) |
| Guard engaged | `GLOBAL_PROTECTION_MODE`, badge Live Map |

## Bramka produkcji

1. **Zakaz** pelnego `stress-50k` / soak na prod bez zgody operatora.
2. Prod: health, p95 z Datadog, obserwacja kolejki -- nie syntetyczny storm bez okna.
3. Railway ramp: `scripts/railway-load-test-ramp.ps1` tylko z `ADMIN_PASS` w sekrecie CI lub lokalnie.

## CI

| Workflow | Zakres |
|----------|--------|
| `ci.yml` job `scripts-python` | `pytest scripts/test_load_report.py` |
| `performance-smoke.yml` | Ruff `scripts/load` + pytest; opcjonalny live smoke (`workflow_dispatch`, `run_live_smoke=true`) |
| Cron | Miesiecznie (1. dzien, 06:00 UTC) -- tylko unit harness |

Live smoke w CI wymaga Docker na runnerze; przy braku serwisow krok jest pomijany (`continue-on-error`).

## Format raportu

Schema: `scripts/load/report_schema.json` v1.

```json
{
  "schema_version": "1",
  "suite": "smoke",
  "tier": "smoke",
  "metrics": { "ingest": { "positions_per_second": 1200, "latency_ms": { "p95": 45 } } },
  "threshold_evaluation": { "tier": "smoke", "pass": true, "checks": [] }
}
```

Raporty trafiaja do `scripts/load/reports/` (gitignored). Nie commituj JWT.

## Kiedy uruchamiac

- Po zmianach ingest / live map / sharding
- Przed eventem 50k (tier stress-50k na klastrze lub zatwierdzonym oknie)
- Miesieczny smoke w CI (unit) + kwartalny live smoke lokalnie
