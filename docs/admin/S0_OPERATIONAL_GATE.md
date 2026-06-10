# S0 — Operational Gate (entry criteria)

| | |
|--|--|
| **Status** | Active — local gate script: `scripts/run-s0-gate-local.ps1` |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-10 |
| **canonical_path** | docs/admin/S0_OPERATIONAL_GATE.md |

Blocker before Sponsor / GO / Tenant / Moderator / Mobile overhaul delivery ([ADMIN_ROADMAP](./ADMIN_ROADMAP.md) S0).

## Checklist

| # | Criterion | Command / artifact | Owner |
|---|-----------|-------------------|-------|
| 1 | `simulator_light` pytest PASS | `cd backend && python run_pytest.py -m simulator_light` | Dev |
| 2 | Railway production verify | `pwsh scripts/railway-verify-production.ps1` (22/22) | Platform Operator |
| 3 | P0 smoke all roles GO | [P0_SMOKE_CHECKLIST](./P0_SMOKE_CHECKLIST.md) · `node admin/scripts/p0-role-smoke.mjs` | QA |
| 4 | `routing_queue_depth` stable | [SIMULATOR.md](../operations/SIMULATOR.md) | Platform Operator |
| 5 | No backpressure storm >15 min | Celery logs `sim.routing.backpressure` | Platform Operator |

## Local pre-flight (dev)

```powershell
pnpm audit:platform:quick
cd backend && python manage.py test activities.tests.test_moderation_scope rewards.tests.test_sponsor_scope -v 2
cd admin && pnpm exec tsc --noEmit
```

## Sign-off

Record GO/NO-GO in [P0_SMOKE_CHECKLIST](./P0_SMOKE_CHECKLIST.md) before starting overhaul paczki S1+.
