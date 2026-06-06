# Weryfikacja jakości pod produkcją (Faza 5)


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../pl/quality/VERIFICATION.md) |
| **canonical_path** | docs/quality/VERIFICATION.md |

---

Dowód, że kod **działa** pod obciążeniem — uzupełnia lint i testy jednostkowe.

---

## Backend + Redis + Postgres

| Scenariusz | Runbook |
|------------|---------|
| Global load guard | `backend/core/test_load_guard.py`, [EVENT_BURST_50K.md](../EVENT_BURST_50K.md) |
| Simulator scale | [SIMULATOR.md](../operations/SIMULATOR.md), `scripts/railway-verify-production.ps1` |
| Live map read shed | [TELEMETRY_LOAD_TEST.md](../operations/TELEMETRY_LOAD_TEST.md) § ADR 011 P2 |

---

## Performance / load (enterprise)

| Scenariusz | Runbook |
|------------|---------|
| Tier smoke/baseline/stress | [PERFORMANCE_TESTING.md](../operations/PERFORMANCE_TESTING.md), `scripts/load/run-suite.ps1` |
| JSON reports + SLO | `scripts/load/thresholds.json`, `scripts/load/report_schema.json` |
| CI harness | `.github/workflows/performance-smoke.yml` |

---

## Telemetry ingest (ADR 011)

| Scenariusz | Komenda / oczekiwanie |
|------------|----------------------|
| Load ingest | `python scripts/load-test-telemetry-ingest.py` (`--json-out` dla raportu) |
| Queue depth | `GET /api/telemetry/ingest/queue/stats` |
| Guard engaged | `GLOBAL_PROTECTION_MODE=on` (staging only) |
| Redis down | Fail-open guard; queue off → 503 + Retry-After |

---

## Mobile GPS

| Scenariusz | Kroki |
|------------|-------|
| Offline buffer | Start ride → tryb samolotowy → punkty w MMKV |
| Kill during sync | Zabij apkę w `syncing` → recovery banner → manual retry |
| Stop z pending | Stop jazdy z pending → alert + baner (nie fałszywe „zakończono”) |

---

## Admin

| Scenariusz | Runbook |
|------------|---------|
| P0 smoke | [P0_SMOKE_CHECKLIST.md](../admin/P0_SMOKE_CHECKLIST.md) |
| Live Map | Badge „Ingest load” przy engaged ingest |
| E2E | CI Playwright; lokalnie `npx playwright test` |

---

## Infrastruktura

| Scenariusz | Runbook |
|------------|---------|
| Railway prod | [RAILWAY_PRODUCTION_CHECKLIST.md](../operations/RAILWAY_PRODUCTION_CHECKLIST.md) |
| OSRM / BRouter | [OSRM.md](../operations/OSRM.md), [BROUTER.md](../operations/BROUTER.md) |
| CVE | GitHub Security / Trivy (CI) |

---

## Kiedy uruchamiać pełną Fazę 5

- Przed eventem 50k
- Po każdej większej zmianie ingest / GPS / symulatora
- Po deployu nowej wersji mobile (OTA)
