# Operacje — runbooki produkacyjne

**Status:** ✅ Active  
**Ostatnia aktualizacja:** 2026-06-03  
**Cel:** Krótkie przewodniki „co zrobić na Railway / w symulatorze / na mobile”.  
**Macierz (doc · rola · kadencja):** [OPERATIONS_INDEX.md](./OPERATIONS_INDEX.md)  
**Standard sekcji:** [DOCUMENTATION_STANDARDS.md](../DOCUMENTATION_STANDARDS.md)

---

## Railway (priorytet prod)

| Runbook | Opis |
|---------|------|
| [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md) | Checklist + `scripts/railway-verify-production.ps1` |
| [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) | OOM, routing worker, caps, RAM (SSOT env) |
| [../RAILWAY_CELERY_SIMULATION.md](../RAILWAY_CELERY_SIMULATION.md) | `celery-worker-simulation` |

---

## Symulator, routing, skala

| Runbook | Opis |
|---------|------|
| [SIMULATOR.md](./SIMULATOR.md) | Batch, live map, FSM, wizard Performance |
| [LIVE_MAP.md](./LIVE_MAP.md) | Live Map SSE, LOD, ingest (PL · [EN](../en/operations/LIVE_MAP.md)) |
| [BROUTER.md](./BROUTER.md) | BRouter, kafelki Polski, `pass=0` |
| [../DISK_GUARD.md](../DISK_GUARD.md) | Budżet dysku Postgres |
| [../SCALE_TEST_300K.md](../SCALE_TEST_300K.md) | Test 300k |
| [../EVENT_BURST_50K.md](../EVENT_BURST_50K.md) | Burst przy dniu eventu |

---

## Infrastruktura i release

| Runbook | Opis |
|---------|------|
| [RAILWAY_KUBERNETES.md](./RAILWAY_KUBERNETES.md) | Railway **nie** hostuje K8s |
| [KUBERNETES.md](./KUBERNETES.md) | Manifesty k8s |
| [PRE_RELEASE_VERIFICATION.md](./PRE_RELEASE_VERIFICATION.md) | Gate przed release |
| [MOBILE.md](./MOBILE.md) | EAS build, env, GPS recovery |
| [../../infrastructure/brouter/README.md](../../infrastructure/brouter/README.md) | Dockerfile BRouter |

---

## Architektura (spec, nie runbook)

[SIMULATOR_ARCHITECTURE.md](../SIMULATOR_ARCHITECTURE.md) — szczegóły Redis/Celery; implementacja → SIMULATOR.md.
