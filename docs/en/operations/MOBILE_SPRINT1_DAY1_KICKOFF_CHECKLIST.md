# Mobile Sprint 1 — Day 1 kickoff checklist (4VELO)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Product Manager / Mobile Lead |
| **Last reviewed** | 2026-06-14 |
| **Audience** | Product trio, mobile, backend, QA, release |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md) |
| **canonical_path** | docs/en/operations/MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md |
| **Related** | [MOBILE_SPRINT1_DAY1_KICKOFF_NOTES_TEMPLATE.md](./MOBILE_SPRINT1_DAY1_KICKOFF_NOTES_TEMPLATE.md) · [MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md](./MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md) · [MOBILE_SPRINT1_BOARD_SEED.md](./MOBILE_SPRINT1_BOARD_SEED.md) · [MOBILE_SPRINT1_REVIEW_PACKET.md](./MOBILE_SPRINT1_REVIEW_PACKET.md) |

---

## Purpose

One-page operational checklist for D1 startup: kickoff meeting, `P0` assignment, risk control, and end-of-day closure.

---

## 1) Kickoff meeting (09:00, 35 min)

## Agenda

- 5 min: confirm sprint `IN/OUT` scope (`S1-PT-01`).
- 10 min: confirm ride-core acceptance criteria (`S1-PT-02`).
- 10 min: assign owner + ETA for every `P0`.
- 5 min: blocker list and unblock owner.
- 5 min: confirm 13:00 and 17:00 checkpoints.

## Mandatory output after kickoff

- [ ] Every `P0` ticket has owner and ETA.
- [ ] No ambiguity in `Done` criteria for `S1-MOB-02`, `S1-MOB-04`, `S1-BE-01`, `S1-QA-01`.
- [ ] One decision owner for end-of-day `GO/NO-GO` (PM or Mobile Lead).

---

## 2) Day 1 assignment (P0 lane)

| Role | Day 1 tickets | Target status by 17:00 |
|------|---------------|--------------------------|
| Product trio | `S1-PT-01`, `S1-PT-02` | Done |
| Mobile | `S1-MOB-01`, `S1-MOB-02`, `S1-MOB-03`, start `S1-MOB-04` | 3x Done + 1x In Progress |
| Backend | `S1-BE-01`, start `S1-BE-02` | 1x Done + 1x In Progress |
| QA | prep for `S1-QA-01`, `S1-QA-02` | Ready |
| Release | start `S1-REL-01` | In Progress |
| Security | start `S1-SEC-01` | In Progress |

---

## 3) 13:00 checkpoint (15 min)

- [ ] Mobile reports `RideSummary`/deep-link contract status (`S1-MOB-02`).
- [ ] Backend reports auth refresh status (`S1-BE-01`).
- [ ] QA confirms smoke scope + device matrix readiness.
- [ ] Release confirms no env-policy blocker.
- [ ] Any `P0` in `Blocked` has unblock owner and ETA.

---

## 4) End-of-day gate (17:00)

## Minimum closure criteria for D1

- [ ] `S1-MOB-01` and `S1-MOB-02` are not open as `Blocked`.
- [ ] `S1-PT-01` and `S1-PT-02` are `Done`.
- [ ] `P0 blocker list` exists with mitigation + ETA.
- [ ] D2 plan is confirmed (who closes which `P0/P1`).

## Day decision

- `GREEN`: all criteria met -> proceed with planned D2.
- `YELLOW`: 1-2 criteria unmet -> D2 runs `P0` only; cut `P1`.
- `RED`: critical blocker without owner -> immediate PM + Tech Lead escalation.

---

## 5) Blocker protocol (SLA)

- 0-30 min: ticket owner tries local unblock.
- 30-60 min: escalate to dependency owner (backend/release/security).
- >60 min: PM + Tech Lead decide on re-scope or mitigation.

Log every blocker in this format:

`Ticket:`  
`Blocker:`  
`Unblock owner:`  
`Unblock ETA:`  
`Plan B:`

---

## 6) Artifacts required after D1

- Updated board status (at minimum all `P0`).
- Filled daily status template from `MOBILE_SPRINT1_REVIEW_PACKET`.
- One decision note: scope, risks, D2 plan.
