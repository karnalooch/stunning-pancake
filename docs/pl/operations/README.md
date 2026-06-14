# Operacje — runbooki produkacyjne


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../../en/operations/README.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-04 |
| **canonical_path** | docs/pl/operations/README.md |

---

**Status:** ✅ Active  
**Ostatnia aktualizacja:** 2026-06-03  
**Cel:** Krótkie przewodniki „co zrobić na Railway / w symulatorze / na mobile”.  
**Macierz (doc · rola · kadencja):** [OPERATIONS_INDEX.md](./OPERATIONS_INDEX.md)  
**Standard sekcji:** [DOCUMENTATION_STANDARDS.md](../../DOCUMENTATION_STANDARDS.md)

---

## Railway (priorytet prod)

| Runbook | Opis |
|---------|------|
| [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md) | Checklist + `scripts/railway-verify-production.ps1` |
| [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) | OOM, routing worker, caps, RAM (SSOT env) |
| [../RAILWAY_CELERY_SIMULATION.md](../../RAILWAY_CELERY_SIMULATION.md) | `celery-worker-simulation` |

---

## Symulator, routing, skala

| Runbook | Opis |
|---------|------|
| [SIMULATOR.md](./SIMULATOR.md) | Batch, live map, FSM, wizard Performance |
| [LIVE_MAP.md](./LIVE_MAP.md) | Live Map SSE, LOD, ingest (PL · [EN](../../en/operations/LIVE_MAP.md)) |
| [BROUTER.md](./BROUTER.md) | BRouter, kafelki Polski, `pass=0` |
| [../DISK_GUARD.md](../../DISK_GUARD.md) | Budżet dysku Postgres |
| [../SCALE_TEST_300K.md](../../SCALE_TEST_300K.md) | Test 300k |
| [../EVENT_BURST_50K.md](../../EVENT_BURST_50K.md) | Burst przy dniu eventu |

---

## Infrastruktura i release

| Runbook | Opis |
|---------|------|
| [RAILWAY_KUBERNETES.md](./RAILWAY_KUBERNETES.md) | Railway **nie** hostuje K8s |
| [KUBERNETES.md](./KUBERNETES.md) | Manifesty k8s |
| [PRE_RELEASE_VERIFICATION.md](./PRE_RELEASE_VERIFICATION.md) | Gate przed release |
| [MOBILE.md](./MOBILE.md) | EAS build, env, GPS recovery |
| [MOBILE_FULL_VISION_VERIFICATION.md](./MOBILE_FULL_VISION_VERIFICATION.md) | Brama testów i release dla mobile full vision |
| [MOBILE_STARTUP_HARDENING_PLAYBOOK.md](./MOBILE_STARTUP_HARDENING_PLAYBOOK.md) | Prewencyjny playbook startu przebudowy mobile |
| [MOBILE_FIX_FORWARD_PLAYBOOK.md](./MOBILE_FIX_FORWARD_PLAYBOOK.md) | Procedura napraw fix-forward i hotfix PR |
| [MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md](./MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md) | Cross-funkcyjny przegląd mobile rola-po-roli |
| [MOBILE_SPRINT1_REVIEW_PACKET.md](./MOBILE_SPRINT1_REVIEW_PACKET.md) | Gotowy pakiet checklist i template'ów na Sprint 1 |
| [MOBILE_SPRINT1_BOARD_SEED.md](./MOBILE_SPRINT1_BOARD_SEED.md) | Gotowa lista ticketów Sprint 1 (priorytety, ownerzy, AC) |
| [MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md](./MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md) | Checklista kickoffu D1 (agenda, SLA blockerów, gate 17:00) |
| [MOBILE_SPRINT1_DAY1_KICKOFF_NOTES_TEMPLATE.md](./MOBILE_SPRINT1_DAY1_KICKOFF_NOTES_TEMPLATE.md) | Gotowy template notatki kickoff D1 (decyzje, ownerzy, ETA, blockery) |
| [MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md](./MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md) | Operacyjny plan D1-D3: kto/co/kiedy na start Sprint 1 |
| [MOBILE_BACKGROUND_TRACKING_MIGRATION.md](./MOBILE_BACKGROUND_TRACKING_MIGRATION.md) | Migracja trackingu tła (native provider, KPI, eskalacja) |
| [../../infrastructure/brouter/README.md](../../../infrastructure/brouter/README.md) | Dockerfile BRouter |

---

## Architektura (spec, nie runbook)

[SIMULATOR_ARCHITECTURE.md](../../SIMULATOR_ARCHITECTURE.md) — szczegóły Redis/Celery; implementacja → SIMULATOR.md.
