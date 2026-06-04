# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../operations/OPERATIONS_INDEX.md) |
| **canonical_path** | docs/en/operations/OPERATIONS_INDEX.md |
---

**Status:** ✅ Active  
**Last update:** 2026-06-03  
**Goal:** One table: which document, who maintains it, how often to verify.  
**Standard:** [DOCUMENTATION_STANDARDS.md](../DOCUMENTATION_STANDARDS.md)

---

## Document matrix

| Document | Purpose (abbreviation) | Owner's role | Update cadence |
|----------|-------------|------------------|------------------------|
| [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md) | Gate prod Railway: repo, env, Celery logs | Platform Operator | After each change of workers / before load test |
| [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) | SSOT: OOM, `solo`, routing queue, `SCALE_*` | Platform Operator | After a SIGKILL incident or caps change |
| [../RAILWAY_CELERY_SIMULATION.md](../RAILWAY_CELERY_SIMULATION.md) | `celery-worker-simulation` service | Platform Operator | With the new `railway.json` simulation |
| [RAILWAY_KUBERNETES.md](./RAILWAY_KUBERNETES.md) | Railway vs K8s decision, mapping | Tech Lead / DevOps | Quarterly or before migration |
| [KUBERNETES.md](./KUBERNETES.md) | `kubectl`, manifests, HPA | DevOps | When changing `infrastructure/k8s/` |
| [SIMULATOR.md](./SIMULATOR.md) | Batch → live, wizard, FSM | Platform Operator + Admin Owner | After changing the simulator API |
| [LIVE_MAP.md](./LIVE_MAP.md) · [EN](./LIVE_MAP.md) | Live Map: SSE, LOD, ingest ADR 011 | Admin Owner + Platform Operator | After changing `telemetry/live` or admin Live Map |
| [BROUTER.md](./BROUTER.md) | BRouter, island, `pass=0` | Platform Operator | After changing presets / volume |
| [OSRM.md](./OSRM.md) | OSRM sim routing, volume, `SCALE_SIM_ROUTING_BACKEND` | Platform Operator | After deploying the `osrm` |
| [MOBILE.md](./MOBILE.md) | Build EAS, env, GPS recovery | Mobile Lead | Before release app store |
| [PRE_RELEASE_VERIFICATION.md](./PRE_RELEASE_VERIFICATION.md) | Unified CI gate + checklist | Release Manager | Each release tag |
| [../DISK_GUARD.md](../DISK_GUARD.md) | Postgres disk budget | Platform Operator | Before the 300k test |
| [../SCALE_TEST_300K.md](../SCALE_TEST_300K.md) | 300k test | Platform Operator | Scheduled test (rare) |
| [../EVENT_BURST_50K.md](../EVENT_BURST_50K.md) | Event day | Platform Operator | Before the event |
| [../TROUBLESHOOTING.md](../TROUBLESHOOTING.md) | Symptoms of cross-cutting | On-call | After a new incident |
| [../SIMULATOR_ARCHITECTURE.md](../../SIMULATOR_ARCHITECTURE.md) | Implementation spec | Backend Lead | Rare (spec) |

---

## Tools (repo)

| Artifact | Purpose | Role | Term |
|----------|-----|------|----------|
| [`scripts/railway-verify-production.ps1`](../../../scripts/railway-verify-production.ps1) | Verification routing + simulation (CLI + optional GraphQL build config) | Platform Operator | After deploying Celera workers |
| [`.env.railway.local.example`](../../../.env.railway.local.example) | Local template (no Git secrets) | Developer | For onboarding Railway CLI |

**Required env (names only):** `RAILWAY_API_TOKEN` (Windows User env); **don't** use legacy `RAILWAY_TOKEN`.

---

## Incident fast track (live sim)

| Step | Role | Action |
|------|------|--------|
| 1 | Platform Operator | `.\scripts\railway-verify-production.ps1` |
| 2 | Platform Operator | Logs: [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md) § After deploy |
| 3 | Platform Operator | OOM / stuck: [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) |
| 4 | AdminOwner | Reset locks / low `active_ratio` — [SIMULATOR.md](./SIMULATOR.md) |
| 5 | Release Manager | If UI regression: [../admin/P0_SMOKE_CHECKLIST.md](../../admin/P0_SMOKE_CHECKLIST.md) |

---

## Related (admin / compliance)

| Index | When |
|--------|--------|
| [../admin/ADMIN_INDEX.md](../../admin/ADMIN_INDEX.md) | Document matrix admin |
| [../compliance/COMPLIANCE_INDEX.md](../compliance/COMPLIANCE_INDEX.md) | Gate legal / RCP |
| [../admin/P1_ROADMAP.md](../../admin/P1_ROADMAP.md) | Panel priorities + Package 1b |
| [../admin/P0_SMOKE_CHECKLIST.md](../../admin/P0_SMOKE_CHECKLIST.md) | After deploy admin (**P0 DONE**) |
| [../compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md](../../compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md) | Public release |

---

## Rollback (general)| Layer | Action (role: Platform Operator) |
|---------|-------------------|
| Railway deploy | Dashboard → previous site deployment |
| Env caps | Lower `SCALE_MAX_STARTS_PER_LIVE_TICK` / `SCALE_SIM_BROUTER_*` - SSOT: RAILWAY_CELERY_MEMORY |
| Feature | `SCALE_SIM_ASYNC_ROUTING=0` only as temporary bypass (sync routing in tick) |
| Code | Revert commit to `main` + redeploy |

Details per-service: [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md).
