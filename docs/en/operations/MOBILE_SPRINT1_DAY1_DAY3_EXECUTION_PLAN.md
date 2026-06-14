# Mobile Sprint 1 — D1-D3 execution plan (4VELO)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Product Manager / Mobile Lead |
| **Last reviewed** | 2026-06-14 |
| **Audience** | Product trio, mobile, backend, QA, release |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md) |
| **canonical_path** | docs/en/operations/MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md |
| **Related** | [MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md](./MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md) · [MOBILE_SPRINT1_BOARD_SEED.md](./MOBILE_SPRINT1_BOARD_SEED.md) · [MOBILE_SPRINT1_REVIEW_PACKET.md](./MOBILE_SPRINT1_REVIEW_PACKET.md) · [MOBILE_FULL_VISION_VERIFICATION.md](./MOBILE_FULL_VISION_VERIFICATION.md) |

---

## Purpose

Operational execution plan for Sprint 1 days 1-3: who does what, in what order, with explicit dependencies and end-of-day outputs.

---

## Execution assumptions

- Sprint starts with `P0` tickets first (no parallel `P2` start).
- WIP limit:
  - Mobile: max 3 tickets in parallel,
  - Backend: max 2,
  - QA: 1 smoke lane + 1 regression lane.
- Every `P0` ticket must have owner + ETA assigned on D1.
- Daily 15-min standup follows `MOBILE_SPRINT1_REVIEW_PACKET`.

---

## Day 1 (critical stabilization)

## Day priority

Close release-blocking risks first: contracts, ride lifecycle, auth/offline, and smoke QA readiness.

## Mandatory tickets (must-finish / must-start)

| Area | Tickets | Owner |
|------|---------|-------|
| Product trio | `S1-PT-01`, `S1-PT-02` | PM, Tech Lead |
| Mobile | `S1-MOB-01`, `S1-MOB-02`, `S1-MOB-03`, start `S1-MOB-04` | Mobile Dev |
| Backend | `S1-BE-01`, start `S1-BE-02` | Backend Dev |
| QA | Prepare smoke scope for `S1-QA-01` and matrix for `S1-QA-02` | QA Lead, QA Engineer |
| Release | Start `S1-REL-01` | Release Eng |
| Security | Start `S1-SEC-01` | Security Eng |

## End of day D1 — expected output

- No open mobile lint blocker (`S1-MOB-01` done).
- `RideSummary` + deep-link contract confirmed (`S1-MOB-02` done or blocked with owner).
- Sprint scope and ride-core AC approved (`S1-PT-01`, `S1-PT-02` done).
- Explicit `P0` blocker list with mitigation and ETA.

---

## Day 2 (integration and smoke)

## Day priority

Run the end-to-end flow (auth -> ride lifecycle -> recovery -> summary) and close release/env risks.

## Mandatory tickets (must-finish / must-start)

| Area | Tickets | Owner |
|------|---------|-------|
| Mobile | close `S1-MOB-04`, start `S1-MOB-05`, `S1-MOB-08` | Mobile Dev |
| Backend | close `S1-BE-02`, `S1-BE-03` | Backend Dev |
| QA | `S1-QA-01`, `S1-QA-02`, start `S1-QA-03` | QA Lead, QA Engineer |
| Release | `S1-REL-01`, `S1-REL-02`, start `S1-REL-03` | Release Eng, DevOps |
| Design | `S1-DES-01`, start `S1-DES-02` | UI Designer |
| Security | close `S1-SEC-01`, start `S1-SEC-02` | Security Eng |

## End of day D2 — expected output

- Smoke auth + ride lifecycle + GPS recovery completed on at least one Android and one iOS device.
- No critical backend-mobile mismatch for `401` and `sync_path/finalize`.
- Release path (`preview` + rollback) verified.
- `P1` cut list ready for D3 without introducing new open `P0`.

---

## Day 3 (hard sprint-ready closure)

## Day priority

Close quality gate and prepare GO/NO-GO decision based on evidence.

## Mandatory tickets (must-finish)

| Area | Tickets | Owner |
|------|---------|-------|
| Mobile | `S1-MOB-05`, `S1-MOB-06`, `S1-MOB-07` (or documented split to Sprint 2) | Mobile Dev |
| QA | `S1-QA-03`, `S1-QA-04`, `S1-QA-05` | QA Engineer |
| Release/Data | `S1-REL-03`, `S1-REL-04`, `S1-DATA-01`, `S1-DATA-02` | DevOps, Release Eng, Data Analyst |
| Design/Security | `S1-DES-02`, `S1-SEC-02`, `S1-SEC-03` | UI Designer, Security Eng |
| Product trio | `S1-PT-03`, `S1-PT-04` | PM, UX Lead |

## End of day D3 — expected output

- Sign-off sheet in `MOBILE_SPRINT1_REVIEW_PACKET` is filled.
- `MOBILE_FULL_VISION_VERIFICATION` is green, or deviations are explicitly documented.
- Zero open `P0` without approved mitigation.
- Release recommendation decided: `GO` or `NO-GO` with rationale.

---

## Critical dependencies (cross-team)

| Dependency | Blocked tickets | Unblock owner |
|------------|-----------------|---------------|
| Backend `401` / refresh contract | `S1-MOB-04`, `S1-QA-01` | Backend Dev |
| `sync_path/finalize` edge case | `S1-QA-01`, `S1-REL-02` | Backend Dev |
| Preview env policy | `S1-QA-04`, `S1-REL-03` | Release Eng |
| Smoke matrix device availability | `S1-QA-01`, `S1-QA-02` | QA Lead |
| Token/logging hygiene findings | release recommendation | Security Eng |

---

## Daily operating rhythm

- 09:00 standup: `P0` status, blockers, unblock owner.
- 13:00 checkpoint: only `P0/P1` status changes, no architecture debate.
- 17:00 wrap-up: evidence links, risk list update, next-day decisions.

---

## Success criteria after D3

- At least 80% of `P0/P1` seed tickets are `Done`.
- 100% of `P0` tickets are `Done` or formally mitigation-approved.
- All user-facing changes have synchronized EN/PL documentation updates.
