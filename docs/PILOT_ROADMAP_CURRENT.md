# 4VELO — canonical pilot roadmap

**Status:** current execution order for pilot readiness  
**Decision date:** 2026-09-17  
**Scope:** ordering and exit criteria only; implementation still happens in small, single-responsibility PRs.

This document is the canonical stage map for the pilot. It does not delete historical plans or completed evidence. Where stage numbering in `PARTIAL_TAKEOVER_PILOT_PLAN.md` conflicts with the later P3 data-safety decision, this document follows `P3_PILOT_DATA_SAFETY_AUDIT_2026-09-16.md` and the owner decision below.

## Canonical sequence

| Stage | Scope | Exit criterion |
| --- | --- | --- |
| P0 — Scope | Pilot scope, takeover boundary, backlog relationship | No conflicting requirement to complete the whole takeover before pilot |
| P1 — Baseline | Home lab, Android connectivity path, synthetic tenants, current end-to-end path | Reproducible baseline report with the first concrete failure or PASS evidence |
| P2 — Safe write foundation | Telemetry auth, batching, ACK/retry/finalize contract, isolation foundations | No silent loss, duplicate business effect, or cross-user/tenant mix-up in covered scenarios |
| **P3 — Pilot Data Safety** | Durable ACK, route reconciliation, tenant isolation, secrets, backup/restore, GPS-at-rest protection, failure matrix | P3 audit exit criteria satisfied; no unresolved owner-defined P0/P1 blocker |
| **P4 — Mobile UI + UX Polish** | Login/profile/home, ride, summary, history/detail, real-data states, visual consistency and physical Android validation | Core mobile flow is complete, readable, coherent and validated on real data/device |
| **P5 — Panels & Operations** | Club Admin, GLOBAL_OWNER, configuration, migrations, backup/restore operator flow and operational smoke | Required pilot operations work end-to-end with recovery evidence |
| **PPH — Pre-Pilot Hardening & Polish** | Security triage, reproducible dev environment, final UI validation, release-candidate regression | Exact pilot candidate passes every pre-pilot gate below |
| **P6 — Pilot** | Real rides by the small approved tester group | No known pilot blocker; evidence collected for expand/fix/stop decision |

P3 remains the active safety gate until its audit exit criteria are met. P4, P5 and PPH do not weaken or replace P3 evidence requirements.

## P4 — Mobile UI + UX Polish

P4 is not a cosmetic-only redesign. It validates the real pilot flow against real data and real failure states.

Required scope:

- login and account/profile states;
- home screen and first-use comprehension;
- start ride, active ride, stop/finalize and summary;
- history and activity details;
- explicit GPS, permissions, offline, error, pending-sync and recovered-sync states;
- normal readable typography for text/numbers/statistics;
- modern, polished pixel-art language in illustration/background/avatar/badge/detail layers without turning the product into a retro game;
- functional, sharp maps and charts;
- active-ride screen readable in sunlight and operable one-handed;
- loading, empty, partial-data and retry states;
- physical Android validation using the pilot build and real backend/home-lab data.

P4 acceptance requires that the first-use experience looks and behaves like a finished product rather than a developer build. Visual polish may not hide an unsafe state: `pending`, `offline`, failed finalization or incomplete synchronization must never be presented as durable success.

## P5 — Panels & Operations

P5 covers only the operational surfaces required by the pilot:

- Club Admin: members, allowed roles and moderation of the club's activities;
- GLOBAL_OWNER: clubs, administrators, account blocks and existing audit capabilities;
- required configuration and migration procedure;
- backup and restore operator flow using the evidence contract established in P3;
- operational smoke path for the exact pilot environment.

P5 does not authorize a new analytics platform or unrelated admin expansion before pilot.

## PPH — Pre-Pilot Hardening & Polish

PPH is an unnumbered release gate between P5 and P6. It groups final readiness work without inventing another feature phase.

### Security gate

- triage the current GitHub vulnerability and code-scanning inventory instead of treating raw alert count as defect count;
- classify findings by runtime/dev/test, component, severity, duplication, reachability and accepted false positive;
- no unresolved runtime `CRITICAL` or `HIGH` finding in the pilot release candidate unless an explicit owner decision records the exception and evidence;
- preserve required CI and fail closed on missing release evidence.

### DX0 — Reproducible Developer Environment

The pilot must be recoverable from a clean machine without undocumented steps.

Target flow:

```text
fresh clone
  -> doctor/preflight
  -> init
  -> up
  -> smoke
  -> DEV ENV READY
```

DX0 should cover:

- one canonical local startup path;
- verified Compose/home-lab layering;
- CI validation of the same command path developers use;
- preflight checks for required tools, ports and environment;
- local secret generation without manual editing of production-scale env templates;
- pinned/documented toolchain contract;
- one cold-start smoke test covering migrations, backend, telemetry, admin and required workers.

Large Node/pnpm major upgrades are not automatically pilot blockers. Perform them before pilot only if required for security or reproducibility and only in a dedicated PR with complete CI; otherwise schedule them after the pilot to avoid unnecessary release-candidate churn.

### Final UI validation

Before P6, repeat the P4 critical path on the exact pilot candidate:

- real Android device;
- outdoor/readability check for the ride screen;
- one-handed critical controls;
- first-use flow without developer explanation;
- real loading/error/offline/sync states;
- no placeholder data, broken assets, debug labels or visually misleading success states.

A small internal UX dry run with 2–3 people may be used before inviting the formal pilot group. Observed confusion becomes a blocker only when it affects critical task completion, safety/data truthfulness or the owner-defined quality bar.

### Full pre-pilot regression

Run against the exact release candidate SHA:

- P3 Android/home-lab failure matrix;
- core mobile journey;
- tenant isolation negatives;
- admin/GLOBAL_OWNER required operations;
- backup/restore business invariants and measured recovery evidence;
- security inventory gate;
- required CI with no skipped checks masquerading as validation.

## P6 — Pilot

Pilot scope remains intentionally small: Android first, one club, a small voluntary tester group, real rides after all gates above pass.

Pilot goals:

- verify real-world recording and synchronization behavior;
- collect usability and visual feedback after the product already meets the agreed quality bar;
- observe operational recovery and support load;
- decide whether to expand, fix and repeat, or stop and redesign a specific area.

The pilot is not the place to discover known data-safety blockers, untriaged runtime `HIGH/CRITICAL` vulnerabilities, unreproducible startup, or obviously unfinished core UI.

## Current execution rule

Use this order for planning conversations and new tasks:

```text
P3 Data Safety
  -> P4 Mobile UI + UX Polish
  -> P5 Panels & Operations
  -> PPH Security + DX0 + Final UI + Regression
  -> P6 Pilot
```

Historical P0–P2 evidence remains valid where still applicable. Do not mechanically reopen completed work because of numbering cleanup; reopen only a concrete failed contract or missing pilot gate.
