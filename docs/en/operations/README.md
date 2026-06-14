# Operations runbooks (English)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/README.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-04 |
| **canonical_path** | docs/en/operations/README.md |

---

**Status:** ✅ Active  
**Last update:** 2026-06-03  
**Purpose:** Short guides for Railway, simulator, and mobile.  
**Matrix (doc · role · cadence):** [OPERATIONS_INDEX.md](./OPERATIONS_INDEX.md)  
**Section standard:** [DOCUMENTATION_STANDARDS.md](../DOCUMENTATION_STANDARDS.md)

Polish canonical runbooks: [../../pl/operations/](../../pl/operations/). Legacy URLs under `docs/operations/` are phase-2 redirect stubs.

---

## Railway (production priority)

| Runbook | Description |
|---------|-------------|
| [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md) | Checklist + `scripts/railway-verify-production.ps1` |
| [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) | OOM, routing worker, caps, RAM (SSOT env) |
| [RAILWAY_CELERY_SIMULATION.md](../../RAILWAY_CELERY_SIMULATION.md) | `celery-worker-simulation` |

---

## Simulator, routing, scale

| Runbook | Description |
|---------|-------------|
| [SIMULATOR.md](./SIMULATOR.md) | Batch, live map, FSM, wizard Performance |
| [LIVE_MAP.md](./LIVE_MAP.md) | Live Map SSE, LOD, ingest (ADR 011) |
| [BROUTER.md](./BROUTER.md) | BRouter, Polish tiles, `pass=0` |
| [DISK_GUARD.md](../../DISK_GUARD.md) | Postgres disk budget |
| [SCALE_TEST_300K.md](../../SCALE_TEST_300K.md) | 300k test |
| [EVENT_BURST_50K.md](../../EVENT_BURST_50K.md) | Event-day burst |

---

## Infrastructure and release

| Runbook | Description |
|---------|-------------|
| [RAILWAY_KUBERNETES.md](./RAILWAY_KUBERNETES.md) | Railway does **not** host Kubernetes |
| [KUBERNETES.md](./KUBERNETES.md) | k8s manifests |
| [PRE_RELEASE_VERIFICATION.md](./PRE_RELEASE_VERIFICATION.md) | Pre-release gate |
| [MOBILE.md](./MOBILE.md) | EAS build, env, GPS recovery |
| [MOBILE_FULL_VISION_VERIFICATION.md](./MOBILE_FULL_VISION_VERIFICATION.md) | Full-vision mobile verification gate |
| [MOBILE_STARTUP_HARDENING_PLAYBOOK.md](./MOBILE_STARTUP_HARDENING_PLAYBOOK.md) | Preventive startup hardening playbook |
| [MOBILE_FIX_FORWARD_PLAYBOOK.md](./MOBILE_FIX_FORWARD_PLAYBOOK.md) | Fix-forward and hotfix response playbook |
| [MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md](./MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md) | Role-by-role cross-functional mobile review |
| [MOBILE_SPRINT1_REVIEW_PACKET.md](./MOBILE_SPRINT1_REVIEW_PACKET.md) | Ready Sprint 1 checklist and template packet |
| [MOBILE_SPRINT1_BOARD_SEED.md](./MOBILE_SPRINT1_BOARD_SEED.md) | Ready Sprint 1 ticket seed (priority, owner, AC) |
| [MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md](./MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md) | Day 1 kickoff checklist (agenda, blocker SLA, 17:00 gate) |
| [MOBILE_SPRINT1_DAY1_KICKOFF_NOTES_TEMPLATE.md](./MOBILE_SPRINT1_DAY1_KICKOFF_NOTES_TEMPLATE.md) | Ready Day 1 kickoff notes template (decisions, owners, ETA, blockers) |
| [MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md](./MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md) | Operational D1-D3 plan: who/what/when for Sprint 1 start |
| [MOBILE_BACKGROUND_TRACKING_MIGRATION.md](./MOBILE_BACKGROUND_TRACKING_MIGRATION.md) | Background tracking migration (native provider, KPI, escalation) |
| [infrastructure/brouter/README.md](../../../infrastructure/brouter/README.md) | BRouter Dockerfile |

---

## Architecture (spec, not runbook)

[SIMULATOR_ARCHITECTURE.md](../../SIMULATOR_ARCHITECTURE.md) — Redis/Celery details; implementation → [SIMULATOR.md](./SIMULATOR.md).
