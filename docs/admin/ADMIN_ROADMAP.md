# Admin panel — unified roadmap (SSOT)


| | |
|--|--|
| **Status** | Active |
| **Owner role** | Admin / Frontend Lead |
| **Last reviewed** | 2026-06-10 |
| **Audience** | Admin developers, Release Manager, Platform Operator |
| **lang** | en |
| **translation** | [Polski](../pl/admin/ADMIN_ROADMAP.md) |
| **canonical_path** | docs/admin/ADMIN_ROADMAP.md |

---

Single timeline linking all admin planning docs. Detail lives in linked files — do not duplicate full specs here.

**Index:** [ADMIN_INDEX.md](./ADMIN_INDEX.md)

---

## Naming

| Term | Meaning |
|------|---------|
| **Paczka N** | P1 product sequence ([P1_ROADMAP.md](./P1_ROADMAP.md)) |
| **P2 roadmap** | Parallel track: GPX F1–F6 + Auth/MFA ([P2_ROADMAP.md](./P2_ROADMAP.md)) — **not** Paczka 2 Sponsor |
| **UI Audit P0–P3** | Snapshot priorities ([UI_AUDIT_2026-06-02.md](./UI_AUDIT_2026-06-02.md)) |
| **ROADMAP_V3** | Long-term architecture + premium phase 2 ([ROADMAP_V3.md](./ROADMAP_V3.md)) |

---

## Current position (2026-06-11)

```mermaid
flowchart LR
  P0[P0 UI audit] --> P1a[1a Simulator FSM]
  P1a --> P1b[1b core KPI BP]
  P1b --> Gate[Operational gate]
  Gate --> P2S[Paczka 2 Sponsor]
  P2S --> P3[GO tooling]
  P3 --> P4[Tenant Admin]
  P4 --> P5[Moderator]
  P5 --> P6[Auth P2]
```

| Milestone | Status |
|-----------|--------|
| P0 closure (code) | Done — verify prod via [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) |
| Paczka 1a | Done |
| Paczka 1b core | Done |
| Overhaul program (S1–S6 code) | **Done** — [overhaul_plan/README.md](../overhaul_plan/README.md) |
| Operational gate (S0) | **Done** — [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) GO 2026-06-11 |
| Paczka 2–5 prod verify (S1–S4) | **Done** — smoke + API scope 2026-06-11 |
| Paczka 6 / S5–S6 | Next — mobile + P2 Auth/GPX |

---

## Execution sequence

### S0 — Operational gate (now)

| # | Criterion | Owner | Artifact |
|---|-----------|-------|----------|
| 1 | `simulator_light` pytest PASS | Dev | `python run_pytest.py … -m simulator_light` |
| 2 | `railway-verify-production.ps1` PASS | Platform Operator | 22/22 checks |
| 3 | P0 smoke all roles GO | QA | [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) · `admin/scripts/p0-role-smoke.mjs` |
| 4 | `routing_queue_depth` stable below cap | Platform Operator | [SIMULATOR.md](../operations/SIMULATOR.md) |
| 5 | No backpressure log storm >15 min | Platform Operator | `sim.routing.backpressure` logs |

### S1 — Paczka 2 Sponsor

| Deliverable | Detail doc | Vision doc |
|-------------|------------|------------|
| Nav: Dashboard, POI, Vouchers, Analytics | P1 §3 | [SPONSOR_EXPERIENCE_OVERHAUL](../overhaul_plan/SPONSOR_EXPERIENCE_OVERHAUL.md) F0–F2 |
| Empty states + CTA | UI_AUDIT P3 | Sponsor F8 |
| Sponsor-scoped pools API | `backend/rewards/views.py` | Sponsor F0 |
| POI map editor UI | `admin/src/modules/sponsor/SponsorPOIMap.tsx` | Sponsor F2 |

**Gate:** P0 smoke GO for SPONSOR section.

### S2 — Paczka 3 GO tooling

| Deliverable | Detail doc | Vision doc |
|-------------|------------|------------|
| Control-plane health strip | UI_AUDIT §P1 Global Owner | [GLOBAL_OWNER_EXPERIENCE_OVERHAUL](../overhaul_plan/GLOBAL_OWNER_EXPERIENCE_OVERHAUL.md) F1 |
| Tenant row drill-down | P1 §4 Paczka 3 | GO F1 |
| Simulator excluded from prod KPI badge | UI_AUDIT P2 Simulator | GO F2 |

### S3 — Paczka 4 Tenant Admin

| Deliverable | Detail doc | Vision doc |
|-------------|------------|------------|
| Scoped dashboard (`tenant_id`) | UI_AUDIT §P1 Tenant Admin | [TENANT_ADMIN_EXPERIENCE_OVERHAUL](../overhaul_plan/TENANT_ADMIN_EXPERIENCE_OVERHAUL.md) Faza B |
| Departments moderator assign | UI_AUDIT P2 Departments | Tenant Faza E |
| Unified Ops Inbox | P1 §4 | Tenant Faza C |

### S4 — Paczka 5 Moderator

| Deliverable | Detail doc | Vision doc |
|-------------|------------|------------|
| Unified inbox route | P1 §4 Paczka 5 | [MODERATOR_PANEL_OVERHAUL](../overhaul_plan/MODERATOR_PANEL_OVERHAUL.md) P0 |
| Anti-Cheat depth | ROADMAP_V3 §6 | Moderator P0 §3 |
| GPX attachment in cases | P2 §2 overlap F1 | Moderator ActivityDetail |

### S5 — P2 Auth + GPX F2–F5

| Track | Detail doc |
|-------|------------|
| MFA / 2FA for GLOBAL_OWNER | [P2_ROADMAP.md](./P2_ROADMAP.md) §4 |
| GPX archive, anti-cheat, RODO ZIP | [P2_ROADMAP.md](./P2_ROADMAP.md) §2 (F1 done) |

**Status (2026-06-11):** GO — API checks passed for MFA status and GPX export; RODO export queue accepted (`202`, async job pending observed).

### S6 — Mobile athlete panel

| Deliverable | Detail doc | Vision doc |
|-------------|------------|------------|
| Ride loop (nav, MapLibre HUD, summary) | `mobile/App.tsx`, screen-architecture plan | [USER_PANEL_VISION](../overhaul_plan/USER_PANEL_VISION.md) P0 |
| Training log + moderation status | `mobile/src/services/ActivityService` | User P0 §4–5 |
| Profile, marketplace, i18n | mobile screens | User P1 |

**Gate:** Mobile Jest green + manual ride smoke. Depends on S4 BE for `rejection_reason`.
**Status (2026-06-11):** GO — mobile Jest green (`9/9` suites, `77/77` tests).

### Later — ROADMAP_V3 premium §7

AI Coach studio · Voucher 3D customizer · ESG portal — [ROADMAP_V3.md](./ROADMAP_V3.md) §7.

---

## UI audit → paczka map

| UI Audit | Maps to |
|----------|---------|
| P0 KPI, Wipe, RBAC, Users, Impersonation, Sponsor nav | Done (code) |
| P1 Role IA, Sponsor portal, Moderator, tenant scope | Paczki 2–5 |
| P2 Feature Flags, Export, Settings, Anti-Cheat depth | After Paczka 3–4 |
| P3 Mobile nav, i18n, empty states, breadcrumbs | Continuous |

---

## Release path

1. [PRE_RELEASE_VERIFICATION.md](../operations/PRE_RELEASE_VERIFICATION.md)
2. [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) → **GO**
3. [RAILWAY_PRODUCTION_CHECKLIST.md](../operations/RAILWAY_PRODUCTION_CHECKLIST.md) (if sim on prod)
4. Next paczka per table above
5. [RELEASE_LEGAL_COMPLIANCE_PACKAGE.md](../compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md) (public release)

---

## Related SSOT (outside admin/)

| Topic | Document |
|-------|----------|
| RBAC | [RBAC.md](../RBAC.md) |
| Simulator ops | [operations/SIMULATOR.md](../operations/SIMULATOR.md) |
| Live Map | [operations/LIVE_MAP.md](../operations/LIVE_MAP.md) |
| Reliability | [reports/RELIABILITY_AUDIT_PLAYBOOK.md](../reports/RELIABILITY_AUDIT_PLAYBOOK.md) |
| Department sponsors | [DEPARTMENT_ARCHITECTURE.md](../DEPARTMENT_ARCHITECTURE.md) |
| Experience visions (per role) | [overhaul_plan/README.md](../overhaul_plan/README.md) |
