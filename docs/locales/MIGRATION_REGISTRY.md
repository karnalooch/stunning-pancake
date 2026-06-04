# Documentation i18n migration registry

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Authors updating docs |

**Legend:** `paired` · `en-only` · `pl-only` · `pending` · `translation-debt` · `snapshot` · `n/a`

---

## Operations (`docs/operations/`)

| Document | Status | PL path | EN path | Notes |
|----------|--------|---------|---------|-------|
| LIVE_MAP.md | **paired** | [operations/LIVE_MAP.md](../operations/LIVE_MAP.md) | [en/operations/LIVE_MAP.md](../en/operations/LIVE_MAP.md) | Pilot |
| SIMULATOR.md | pending | operations/SIMULATOR.md | en/operations/SIMULATOR.md | High priority |
| BROUTER.md | pending | operations/BROUTER.md | en/operations/BROUTER.md | |
| TELEMETRY_LOAD_TEST.md | pending | operations/TELEMETRY_LOAD_TEST.md | en/operations/TELEMETRY_LOAD_TEST.md | |
| TELEMETRY_INGEST_QUEUE.md | pending | operations/TELEMETRY_INGEST_QUEUE.md | en/operations/TELEMETRY_INGEST_QUEUE.md | |
| TELEMETRY_SHARDING.md | pending | operations/TELEMETRY_SHARDING.md | en/operations/TELEMETRY_SHARDING.md | |
| RAILWAY_PRODUCTION_CHECKLIST.md | pending | operations/… | en/operations/… | |
| RAILWAY_CELERY_MEMORY.md | pending | operations/… | en/operations/… | SSOT — translate carefully |
| RAILWAY_KUBERNETES.md | pending | operations/… | en/operations/… | |
| KUBERNETES.md | pending | operations/… | en/operations/… | |
| MOBILE.md | pending | operations/… | en/operations/… | |
| PRE_RELEASE_VERIFICATION.md | pending | operations/… | en/operations/… | |
| OSRM.md | pending | operations/… | en/operations/… | |
| DATADOG_SIMULATOR.md | pending | operations/… | en/operations/… | |
| HANDOFF_AUTOMATION.md | pending | operations/… | en/operations/… | |
| README.md | pending | operations/README.md | en/operations/README.md | Index |
| OPERATIONS_INDEX.md | pending | operations/OPERATIONS_INDEX.md | en/operations/OPERATIONS_INDEX.md | Matrix |

---

## Root guides (`docs/`)

| Document | Status | PL | EN | Notes |
|----------|--------|----|----|-------|
| README.md | pending | README.md (PL index) | en/README.md | Main hub |
| GETTING_STARTED.md | pending | pl/… or legacy | en/… | |
| INSTALLATION.md | pending | | | |
| DEVELOPMENT.md | pending | | | |
| CONFIGURATION.md | pending | | | Link SSOT only in translation |
| DEPLOYMENT.md | pending | | | |
| TROUBLESHOOTING.md | pending | | | |
| ARCHITECTURE.md | en-only | optional pl/ARCHITECTURE.md | ARCHITECTURE.md | Spec canonical EN |
| API.md | en-only | optional pl/API.md | API.md | |
| SIMULATOR_ARCHITECTURE.md | en-only | optional summary | SIMULATOR_ARCHITECTURE.md | |

---

## ADR (`docs/adr/`)

| Rule | Status |
|------|--------|
| All `docs/adr/*.md` | **en-only** | Full PL duplicate not required; optional `docs/pl/adr/<NNN>-summary.md` |

---

## Admin (`docs/admin/`)

| Document | Status | Notes |
|----------|--------|-------|
| P0_SMOKE_CHECKLIST.md | en-only | PL mirror `docs/pl/admin/` when needed |
| P1_ROADMAP.md, P2_ROADMAP.md | mixed | EN technical + PL product fragments — split per section in phase 3 |
| README.md, ADMIN_INDEX.md | pending | |

---

## Compliance, product, quality

| Area | Default |
|------|---------|
| `compliance/RELEASE_*`, `MAP_BASEMAP_*` | en-only |
| `compliance/RCP.md` | pl-only → en summary later |
| `product/FAQ.md` | pl-only → en later |
| `quality/*` | en-only (dev process) |
| `reports/*_YYYY-MM-DD.md` | snapshot — n/a |
| `archive/*` | n/a |

---

## Runbooks (`docs/runbooks/`)

| Document | Status |
|----------|--------|
| celery-backlog.md | pending |
| db_recovery.md | pending |

---

## How to mark progress

1. Add EN file under `docs/en/...` (mirror path).
2. Add metadata `lang` + `translation` to both files.
3. Change Status in this table from `pending` → `paired`.
4. Run CI scripts.
