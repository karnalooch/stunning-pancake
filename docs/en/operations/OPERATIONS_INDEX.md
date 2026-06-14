# Operations index

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/OPERATIONS_INDEX.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-04 |
| **canonical_path** | docs/en/operations/OPERATIONS_INDEX.md |

---

**Status:** ✅ Active  
**Last update:** 2026-06-03  
**Goal:** One table — which document, who maintains it, how often to verify.  
**Standard:** [DOCUMENTATION_STANDARDS.md](../DOCUMENTATION_STANDARDS.md)

Polish canonical index: [../../pl/operations/OPERATIONS_INDEX.md](../../pl/operations/OPERATIONS_INDEX.md).

---

## Document matrix

| Document | Purpose (abbrev.) | Owner role | Update cadence |
|----------|-------------------|------------|----------------|
| [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md) | Railway prod gate: repo, env, Celery logs | Platform Operator | After worker changes / before load test |
| [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) | SSOT: OOM, `solo`, routing queue, `SCALE_*` | Platform Operator | After SIGKILL or caps change |
| [RAILWAY_CELERY_SIMULATION.md](../../RAILWAY_CELERY_SIMULATION.md) | `celery-worker-simulation` service | Platform Operator | When simulation `railway.json` changes |
| [RAILWAY_KUBERNETES.md](./RAILWAY_KUBERNETES.md) | Railway vs K8s decision, mapping | Tech Lead / DevOps | Quarterly or before migration |
| [KUBERNETES.md](./KUBERNETES.md) | `kubectl`, manifests, HPA | DevOps | When `infrastructure/k8s/` changes |
| [SIMULATOR.md](./SIMULATOR.md) | Batch → live, wizard, FSM | Platform Operator + Admin Owner | After simulator API changes |
| [LIVE_MAP.md](./LIVE_MAP.md) | Live Map: SSE, LOD, ingest ADR 011 | Admin Owner + Platform Operator | After `telemetry/live` or admin Live Map changes |
| [BROUTER.md](./BROUTER.md) | BRouter, island, `pass=0` | Platform Operator | After preset / volume changes |
| [OSRM.md](./OSRM.md) | OSRM sim routing, volume, `SCALE_SIM_ROUTING_BACKEND` | Platform Operator | After `osrm` deploy |
| [MOBILE.md](./MOBILE.md) | EAS build, env, GPS recovery | Mobile Lead | Before app store release |
| [MOBILE_FULL_VISION_VERIFICATION.md](./MOBILE_FULL_VISION_VERIFICATION.md) | Full-vision verification gate and release readiness criteria | Mobile Lead + QA Lead | Every mobile release / large merge |
| [MOBILE_STARTUP_HARDENING_PLAYBOOK.md](./MOBILE_STARTUP_HARDENING_PLAYBOOK.md) | Preventive startup hardening for mobile rebuild | Mobile Lead + Release Manager | Project kickoff and after P0/P1 incident |
| [MOBILE_FIX_FORWARD_PLAYBOOK.md](./MOBILE_FIX_FORWARD_PLAYBOOK.md) | Triage/hotfix/rollback response for mobile regressions | Mobile Lead / On-call | Every mobile incident |
| [MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md](./MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md) | Role-by-role mobile review and required docs updates | Product Manager + Mobile Lead | Every sprint and before release candidate |
| [MOBILE_SPRINT1_REVIEW_PACKET.md](./MOBILE_SPRINT1_REVIEW_PACKET.md) | Ready checklist/template/sign-off packet for Sprint 1 execution | Product Manager + Mobile Lead | Sprint start + midpoint + sprint review |
| [MOBILE_SPRINT1_BOARD_SEED.md](./MOBILE_SPRINT1_BOARD_SEED.md) | Sprint 1 board seed: ready ticket list with AC and priorities | Product Manager + Mobile Lead | Sprint planning and backlog grooming |
| [MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md](./MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md) | Day 1 kickoff checklist: agenda, `P0` assignment, day gate | Product Manager + Mobile Lead | D1 start (09:00) and D1 close (17:00) |
| [MOBILE_SPRINT1_DAY1_KICKOFF_NOTES_TEMPLATE.md](./MOBILE_SPRINT1_DAY1_KICKOFF_NOTES_TEMPLATE.md) | Day 1 kickoff notes template with decisions, ETA, and blockers | Product Manager + Mobile Lead | Filled after kickoff and D1 checkpoints |
| [MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md](./MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md) | Operational execution plan for Sprint 1 days 1-3 | Product Manager + Mobile Lead | First 3 sprint days and daily review |
| [MOBILE_BACKGROUND_TRACKING_MIGRATION.md](./MOBILE_BACKGROUND_TRACKING_MIGRATION.md) | Background tracking migration Android/iOS, KPI, escalation | Mobile Lead | On GPS provider change / before release |
| [PRE_RELEASE_VERIFICATION.md](./PRE_RELEASE_VERIFICATION.md) | Unified CI gate + checklist | Release Manager | Each release tag |
| [DISK_GUARD.md](../../DISK_GUARD.md) | Postgres disk budget | Platform Operator | Before 300k test |
| [SCALE_TEST_300K.md](../../SCALE_TEST_300K.md) | 300k test | Platform Operator | Scheduled test (rare) |
| [PERFORMANCE_TESTING.md](./PERFORMANCE_TESTING.md) | Enterprise load: tiers, k6/Locust, JSON reports, CI | Platform Operator | Before scale test / after ingest changes |
| [TELEMETRY_LOAD_TEST.md](./TELEMETRY_LOAD_TEST.md) | Telemetry ingest 50k scaffold | Platform Operator | Before 50k burst |
| [EVENT_BURST_50K.md](../../EVENT_BURST_50K.md) | Event day | Platform Operator | Before event |
| [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) | Cross-cutting symptoms | On-call | After new incident class |
| [SIMULATOR_ARCHITECTURE.md](../../SIMULATOR_ARCHITECTURE.md) | Implementation spec | Backend Lead | Rare (spec) |

---

## Tools (repo)

| Artifact | Purpose | Role | Cadence |
|----------|---------|------|---------|
| [infrastructure/sim-lab/README.md](../../../infrastructure/sim-lab/README.md) | Isolated sim-lab: Docker / Railway load test | Platform Operator | Before 300k ramp (not prod) |
| [`scripts/load/run-suite.ps1`](../../../scripts/load/run-suite.ps1) | Suite smoke/baseline/stress-50k (local Docker) | Platform Operator | After ingest / live-map changes |
| [`scripts/railway-verify-production.ps1`](../../../scripts/railway-verify-production.ps1) | Verify routing + simulation (CLI + optional GraphQL build config) | Platform Operator | After Celery worker deploy |
| [`.env.railway.local.example`](../../../.env.railway.local.example) | Local template (no Git secrets) | Developer | Onboarding Railway CLI |

**Required env (names only):** `RAILWAY_API_TOKEN` (Windows user env); **do not** use legacy `RAILWAY_TOKEN`.

---

## Incident fast track (live sim)

| Step | Role | Action |
|------|------|--------|
| 1 | Platform Operator | `.\scripts\railway-verify-production.ps1` |
| 2 | Platform Operator | Logs: [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md) § After deploy |
| 3 | Platform Operator | OOM / stuck: [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) |
| 4 | Admin Owner | Reset locks / lower `active_ratio` — [SIMULATOR.md](./SIMULATOR.md) |
| 5 | Release Manager | UI regression: [../admin/P0_SMOKE_CHECKLIST.md](../../admin/P0_SMOKE_CHECKLIST.md) |

---

## Related (admin / compliance)

| Index | When |
|-------|------|
| [../admin/ADMIN_INDEX.md](../../admin/ADMIN_INDEX.md) | Admin doc matrix |
| [../compliance/COMPLIANCE_INDEX.md](../compliance/COMPLIANCE_INDEX.md) | Legal / RCP gate |
| [../admin/P1_ROADMAP.md](../../admin/P1_ROADMAP.md) | Panel priorities + package 1b |
| [../admin/P0_SMOKE_CHECKLIST.md](../../admin/P0_SMOKE_CHECKLIST.md) | After admin deploy (**P0 DONE**) |
| [../compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md](../../compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md) | Public release |

---

## Rollback (general)

| Layer | Action (role: Platform Operator) |
|-------|-----------------------------------|
| Railway deploy | Dashboard → previous deployment |
| Env caps | Lower `SCALE_MAX_STARTS_PER_LIVE_TICK` / `SCALE_SIM_BROUTER_*` — SSOT: RAILWAY_CELERY_MEMORY |
| Feature | `SCALE_SIM_ASYNC_ROUTING=0` only as temporary bypass (sync routing in tick) |
| Code | Revert commit on `main` + redeploy |

Per-service details: [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md).
