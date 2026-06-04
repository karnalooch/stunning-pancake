# Indeks operacji — macierz runbooków


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../../en/operations/OPERATIONS_INDEX.md) |
| **canonical_path** | docs/pl/operations/OPERATIONS_INDEX.md |

---

**Status:** ✅ Active  
**Ostatnia aktualizacja:** 2026-06-03  
**Cel:** Jedna tabela: który dokument, kto go utrzymuje, jak często weryfikować.  
**Standard:** [DOCUMENTATION_STANDARDS.md](../../DOCUMENTATION_STANDARDS.md)

---

## Macierz dokumentów

| Dokument | Cel (skrót) | Rola właściciela | Kadencja aktualizacji |
|----------|-------------|------------------|------------------------|
| [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md) | Gate prod Railway: repo, env, logi Celery | Platform Operator | Po każdej zmianie workerów / przed load testem |
| [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) | SSOT: OOM, `solo`, routing queue, `SCALE_*` | Platform Operator | Po incydencie SIGKILL lub zmianie caps |
| [../RAILWAY_CELERY_SIMULATION.md](../../RAILWAY_CELERY_SIMULATION.md) | Serwis `celery-worker-simulation` | Platform Operator | Przy nowym `railway.json` simulation |
| [RAILWAY_KUBERNETES.md](./RAILWAY_KUBERNETES.md) | Decyzja Railway vs K8s, mapowanie | Tech Lead / DevOps | Kwartalnie lub przed migracją |
| [KUBERNETES.md](./KUBERNETES.md) | `kubectl`, manifesty, HPA | DevOps | Przy zmianie `infrastructure/k8s/` |
| [SIMULATOR.md](./SIMULATOR.md) | Batch → live, wizard, FSM | Platform Operator + Admin Owner | Po zmianie API symulatora |
| [LIVE_MAP.md](./LIVE_MAP.md) · [EN](.././LIVE_MAP.md) | Live Map: SSE, LOD, ingest ADR 011 | Admin Owner + Platform Operator | Po zmianie `telemetry/live` lub admin Live Map |
| [BROUTER.md](./BROUTER.md) | BRouter, island, `pass=0` | Platform Operator | Po zmianie presetów / volume |
| [OSRM.md](./OSRM.md) | OSRM sim routing, volume, `SCALE_SIM_ROUTING_BACKEND` | Platform Operator | Po deploy serwisu `osrm` |
| [MOBILE.md](./MOBILE.md) | Build EAS, env, GPS recovery | Mobile Lead | Przed release app store |
| [PRE_RELEASE_VERIFICATION.md](./PRE_RELEASE_VERIFICATION.md) | Jednolite gate CI + checklist | Release Manager | Każdy release tag |
| [../DISK_GUARD.md](../../DISK_GUARD.md) | Postgres disk budget | Platform Operator | Przed testem 300k |
| [../SCALE_TEST_300K.md](../../SCALE_TEST_300K.md) | Test 300k | Platform Operator | Planowany test (rzadko) |
| [../EVENT_BURST_50K.md](../../EVENT_BURST_50K.md) | Dzień eventu | Platform Operator | Przed eventem |
| [../TROUBLESHOOTING.md](../../TROUBLESHOOTING.md) | Objawy cross-cutting | On-call | Po nowym incydencie |
| [../SIMULATOR_ARCHITECTURE.md](../../SIMULATOR_ARCHITECTURE.md) | Spec implementacji | Backend Lead | Rzadko (spec) |

---

## Narzędzia (repo)

| Artefakt | Cel | Rola | Kadencja |
|----------|-----|------|----------|
| [`scripts/railway-verify-production.ps1`](../../../scripts/railway-verify-production.ps1) | Weryfikacja routing + simulation (CLI + opcjonalnie GraphQL build config) | Platform Operator | Po deploy workerów Celery |
| [`.env.railway.local.example`](../../../.env.railway.local.example) | Szablon lokalny (bez sekretów w Git) | Deweloper | Przy onboardingu Railway CLI |

**Wymagane env (nazwy tylko):** `RAILWAY_API_TOKEN` (Windows User env); **nie** używać legacy `RAILWAY_TOKEN`.

---

## Szybka ścieżka incydentu (live sim)

| Krok | Rola | Akcja |
|------|------|--------|
| 1 | Platform Operator | `.\scripts\railway-verify-production.ps1` |
| 2 | Platform Operator | Logi: [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md) § Po deploy |
| 3 | Platform Operator | OOM / stuck: [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) |
| 4 | Admin Owner | Reset locks / niski `active_ratio` — [SIMULATOR.md](./SIMULATOR.md) |
| 5 | Release Manager | Jeśli regresja UI: [../admin/P0_SMOKE_CHECKLIST.md](../../admin/P0_SMOKE_CHECKLIST.md) |

---

## Powiązane (admin / compliance)

| Indeks | Kiedy |
|--------|--------|
| [../admin/ADMIN_INDEX.md](../../admin/ADMIN_INDEX.md) | Macierz dokumentów admin |
| [../compliance/COMPLIANCE_INDEX.md](../../compliance/COMPLIANCE_INDEX.md) | Gate legal / RCP |
| [../admin/P1_ROADMAP.md](../../admin/P1_ROADMAP.md) | Priorytety panelu + Paczka 1b |
| [../admin/P0_SMOKE_CHECKLIST.md](../../admin/P0_SMOKE_CHECKLIST.md) | Po deploy admin (**P0 DONE**) |
| [../compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md](../../compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md) | Release publiczny |

---

## Rollback (ogólny)

| Warstwa | Akcja (rola: Platform Operator) |
|---------|----------------------------------|
| Railway deploy | Dashboard → poprzedni deployment serwisu |
| Env caps | Obniż `SCALE_MAX_STARTS_PER_LIVE_TICK` / `SCALE_SIM_BROUTER_*` — SSOT: RAILWAY_CELERY_MEMORY |
| Feature | `SCALE_SIM_ASYNC_ROUTING=0` tylko jako tymczasowy bypass (sync routing w tick) |
| Kod | Revert commit na `main` + redeploy |

Szczegóły per-serwis: [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md).
