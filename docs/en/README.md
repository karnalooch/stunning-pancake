# 4VELO documentation (English index)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **lang** | en |
| **translation** | [Indeks główny (PL)](../README.md) |

---

## Localization

Paired documents live under `docs/en/` (this tree) and Polish under `docs/pl/` or legacy paths. Policy: [locales/STANDARD.en.md](../locales/STANDARD.en.md). Progress: [locales/MIGRATION_REGISTRY.md](../locales/MIGRATION_REGISTRY.md).

---

## Operations (English mirrors)

Hub: [operations/README.md](./operations/README.md) · Matrix: [operations/OPERATIONS_INDEX.md](./operations/OPERATIONS_INDEX.md)

| Document | Description |
|----------|-------------|
| [operations/LIVE_MAP.md](./operations/LIVE_MAP.md) | Live Map SSE, LOD, ingest (ADR 011) |
| [operations/SIMULATOR.md](./operations/SIMULATOR.md) | Batch → live sim, FSM, admin map |
| [operations/BROUTER.md](./operations/BROUTER.md) | BRouter tiles, routing, `pass=0` |
| [operations/TELEMETRY_SHARDING.md](./operations/TELEMETRY_SHARDING.md) | Telemetry Redis sharding |
| [operations/TELEMETRY_INGEST_QUEUE.md](./operations/TELEMETRY_INGEST_QUEUE.md) | Ingest queue + drain |
| [operations/TELEMETRY_LOAD_TEST.md](./operations/TELEMETRY_LOAD_TEST.md) | Load-test scaffold |
| [operations/RAILWAY_PRODUCTION_CHECKLIST.md](./operations/RAILWAY_PRODUCTION_CHECKLIST.md) | Prod checklist + verify script |
| [operations/RAILWAY_CELERY_MEMORY.md](./operations/RAILWAY_CELERY_MEMORY.md) | OOM, `SCALE_*` caps (SSOT) |
| [operations/RAILWAY_KUBERNETES.md](./operations/RAILWAY_KUBERNETES.md) | Railway vs Kubernetes |
| [operations/KUBERNETES.md](./operations/KUBERNETES.md) | `infrastructure/k8s/` manifests |
| [operations/MOBILE.md](./operations/MOBILE.md) | EAS build/release, GPS recovery |
| [operations/PRE_RELEASE_VERIFICATION.md](./operations/PRE_RELEASE_VERIFICATION.md) | Pre-release gate |
| [operations/OSRM.md](./operations/OSRM.md) | OSRM service |
| [operations/DATADOG_SIMULATOR.md](./operations/DATADOG_SIMULATOR.md) | Datadog + simulator metrics |
| [operations/HANDOFF_AUTOMATION.md](./operations/HANDOFF_AUTOMATION.md) | Handoff automation |

Polish canonical (legacy path): [operations/LIVE_MAP.md](../operations/LIVE_MAP.md) and siblings under `docs/operations/`.

---

## English-canonical (no full PL duplicate)

| Path | Topic |
|------|--------|
| [../adr/](../adr/) | Architecture decision records |
| [../API.md](../API.md) | REST API |
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | System architecture |
| [../SIMULATOR_ARCHITECTURE.md](../SIMULATOR_ARCHITECTURE.md) | Simulator spec |

PL summaries: [pl/adr/](../pl/adr/) · [pl/API.md](../pl/API.md) · [pl/ARCHITECTURE.md](../pl/ARCHITECTURE.md).

---

## Full tree

The master index (Polish-first, all links): [../README.md](../README.md).
