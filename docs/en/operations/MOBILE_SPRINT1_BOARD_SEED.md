# Mobile Sprint 1 Board Seed (4VELO)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Product Manager / Mobile Lead |
| **Last reviewed** | 2026-06-14 |
| **Audience** | Product trio, engineering, QA, release |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/MOBILE_SPRINT1_BOARD_SEED.md) |
| **canonical_path** | docs/en/operations/MOBILE_SPRINT1_BOARD_SEED.md |
| **Related** | [MOBILE_SPRINT1_REVIEW_PACKET.md](./MOBILE_SPRINT1_REVIEW_PACKET.md) · [MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md](./MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md) · [MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md](./MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md) · [MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md](./MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md) · [MOBILE_FULL_VISION_VERIFICATION.md](./MOBILE_FULL_VISION_VERIFICATION.md) |

---

## How to use

- Each row = ready task.
- Initial status: `Backlog`.
- Priorities: `P0` blocks release, `P1` high, `P2` quality.
- If task changes user-facing behavior, docs update is part of AC.

## CSV import

- CSV (EN): [MOBILE_SPRINT1_BOARD_SEED_IMPORT.csv](./MOBILE_SPRINT1_BOARD_SEED_IMPORT.csv)
- CSV (PL): [MOBILE_SPRINT1_BOARD_SEED_IMPORT.csv](../../pl/operations/MOBILE_SPRINT1_BOARD_SEED_IMPORT.csv)
- Jira (EN): [MOBILE_SPRINT1_BOARD_SEED_IMPORT_JIRA.csv](./MOBILE_SPRINT1_BOARD_SEED_IMPORT_JIRA.csv)
- Jira (PL): [MOBILE_SPRINT1_BOARD_SEED_IMPORT_JIRA.csv](../../pl/operations/MOBILE_SPRINT1_BOARD_SEED_IMPORT_JIRA.csv)
- Linear (EN): [MOBILE_SPRINT1_BOARD_SEED_IMPORT_LINEAR.csv](./MOBILE_SPRINT1_BOARD_SEED_IMPORT_LINEAR.csv)
- Linear (PL): [MOBILE_SPRINT1_BOARD_SEED_IMPORT_LINEAR.csv](../../pl/operations/MOBILE_SPRINT1_BOARD_SEED_IMPORT_LINEAR.csv)

---

## Implementation snapshot (2026-06-14)

- Mobile (code): closed `S1-MOB-01`, `S1-MOB-02`, `S1-MOB-04`, `S1-MOB-05`, `S1-MOB-06`, `S1-MOB-07`, `S1-MOB-08`, `S1-MOB-09`, `S1-MOB-10`.
- `S1-MOB-03`: HUD status bar hardening is complete in code with tests; Android/iOS manual QA still required per AC.
- `S1-REL-01`: env safety policy is enforced in client paths (`API`, `telemetry`, `social auth`) with `__DEV__`-only fallback.
- Evidence: lint and targeted tests are green (route contract, RideActionBar hold-to-stop, RideStatusBar, Onboarding, socialAuth env policy).

---

## Product trio (PM + UX/UI + Tech Lead)

| ID | Priority | Title | Owner | Acceptance Criteria |
|----|----------|-------|-------|---------------------|
| S1-PT-01 | P0 | Approve Sprint 1 scope (IN/OUT) | PM | Scope published; exclusions approved |
| S1-PT-02 | P0 | Confirm ride-core acceptance criteria | Tech Lead | AC for RideDashboard/HUD/Summary added to board |
| S1-PT-03 | P1 | Lock P0/P1 ordering across domains | PM | Ordering approved by mobile+backend+QA |
| S1-PT-04 | P1 | Update implementation spec after kickoff | UX Lead | `4VELO_MOBILE_FULL_VISION_IMPLEMENTATION` updated |

## Mobile team

| ID | Priority | Title | Owner | Acceptance Criteria |
|----|----------|-------|-------|---------------------|
| S1-MOB-01 | P0 | Fix lint blocker import in `StreakBadge` | Mobile Dev | `expo lint` has no import/no-unresolved error |
| S1-MOB-02 | P0 | Align `RideSummary` contract and deep-link path | Mobile Dev | `types` + `routeContract` + `linking` consistent |
| S1-MOB-03 | P0 | Finalize HUD status bar (GPS/battery/clock) on device | Mobile Dev | Android/iOS manual pass; no null crash |
| S1-MOB-04 | P0 | Add stop-confirm hold guard with regression test | Mobile Dev | Stop confirmation works; test/manual pass |
| S1-MOB-05 | P1 | Reduce hook dependency warnings in critical files | Mobile Dev | No new warnings in touched critical files |
| S1-MOB-06 | P1 | Refactor `ActivityDetail` to i18n and remove emoji placeholders | Mobile Dev | Labels via i18n; no placeholder text/emoji |
| S1-MOB-07 | P1 | Improve onboarding types and i18n copy | Mobile Dev | Reduced `any`; PL/EN copy through i18n |
| S1-MOB-08 | P1 | Add edge states (offline/error/empty) in detail/trends | Mobile Dev | Clear consistent fallbacks |
| S1-MOB-09 | P2 | Consolidate legacy UI wrappers | Mobile Dev | Legacy components delegate to `components/ui` |
| S1-MOB-10 | P2 | Standardize spacing/layout templates on top 3 screens | Mobile Dev | Ride/Explore/Profile follow same layout pattern |

## Backend/API team

| ID | Priority | Title | Owner | Acceptance Criteria |
|----|----------|-------|-------|---------------------|
| S1-BE-01 | P0 | Validate auth refresh contract and 401 behavior | Backend Dev | Contract documented; mobile flow passes |
| S1-BE-02 | P0 | Validate `sync_path/finalize` offline edge cases | Backend Dev | kill/relaunch scenario documented and approved |
| S1-BE-03 | P1 | Review retry policy and status codes (429/503) | Backend Dev | mobile retry/backoff guidance aligned |
| S1-BE-04 | P1 | Align payload expectations for leaderboard/trends | Backend Dev | No ambiguous fields in UI integrations |
| S1-BE-05 | P2 | Update API docs for wearable auth status flow | Backend Dev | API docs match real flow |

## QA (manual + automation)

| ID | Priority | Title | Owner | Acceptance Criteria |
|----|----------|-------|-------|---------------------|
| S1-QA-01 | P0 | Smoke auth + ride lifecycle + GPS recovery | QA Lead | 3 critical flows pass with report |
| S1-QA-02 | P0 | Manual deep-link matrix (Android+iOS) | QA Engineer | all critical deep links verified |
| S1-QA-03 | P1 | Add smoke coverage for settings sections | QA Engineer | section switch and persistence pass |
| S1-QA-04 | P1 | Add smoke coverage explore map -> marketplace | QA Engineer | navigation and network fallback pass |
| S1-QA-05 | P1 | Regression pass for `ActivityDetail` refactor | QA Engineer | no crash/placeholder regressions |
| S1-QA-06 | P2 | Expand device matrix notes | QA Lead | minimum 2 Android + 1 iOS documented |

## DevOps / Release

| ID | Priority | Title | Owner | Acceptance Criteria |
|----|----------|-------|-------|---------------------|
| S1-REL-01 | P0 | Enforce env policy: no production fallback in release | Release Eng | no prod fallback risk for release builds |
| S1-REL-02 | P0 | Validate preview build and rollback path | Release Eng | preview build ready; rollback documented |
| S1-REL-03 | P1 | Verify telemetry/crash ingestion in preview | DevOps | crash/perf events visible |
| S1-REL-04 | P1 | Align release checklist EN/PL | Release Eng | `MOBILE.md` EN/PL synchronized |

## Data / Analytics

| ID | Priority | Title | Owner | Acceptance Criteria |
|----|----------|-------|-------|---------------------|
| S1-DATA-01 | P1 | Audit Ride/Auth/Share event coverage | Data Analyst | missing events documented and assigned |
| S1-DATA-02 | P1 | Validate performance budget telemetry visibility | Data Analyst | violation events mapped and queryable |
| S1-DATA-03 | P2 | Propose retention event improvements | Data Analyst | prioritized event backlog for Sprint 2 |

## Design production

| ID | Priority | Title | Owner | Acceptance Criteria |
|----|----------|-------|-------|---------------------|
| S1-DES-01 | P0 | Audit PressStart2P/VT323 usage on critical screens | UI Designer | no font-family mismatch on Ride/Summary |
| S1-DES-02 | P1 | Remove emoji/placeholders from detail/profile | UI Designer | consistent chrome icon language |
| S1-DES-03 | P1 | Normalize card styling (padding/border/shadow) | UI Designer | approved pattern on 3 key screens |
| S1-DES-04 | P2 | Update Grand Prix audit EN/PL after sprint changes | Technical Artist | drift/status updated |

## Security / Privacy / Compliance

| ID | Priority | Title | Owner | Acceptance Criteria |
|----|----------|-------|-------|---------------------|
| S1-SEC-01 | P0 | Audit token storage and error logging hygiene | Security Eng | no sensitive logging exposure |
| S1-SEC-02 | P1 | Audit privacy-zones UX fallback behavior | Security Eng | UI does not imply false success |
| S1-SEC-03 | P1 | Review env configuration for secret hygiene | Security Eng | no client secret leakage risk |

---

## 4) Ticket template (copy/paste)

## Title
`[S1][AREA][P0/P1/P2] Task name`

## Context
- Problem:
- Goal:

## Acceptance Criteria
- [ ] AC-1
- [ ] AC-2
- [ ] AC-3

## Evidence
- Tests:
- Screens/recordings:
- Docs updated:

## Risk
- Potential impact:
- Mitigation:

## Owner / ETA
- Owner:
- ETA:

---

## 5) Sprint exit criteria

- [ ] All P0 tickets closed or formally mitigated.
- [ ] `MOBILE_FULL_VISION_VERIFICATION` is green.
- [ ] Cross-functional sign-off sheet completed in `MOBILE_SPRINT1_REVIEW_PACKET`.
- [ ] EN/PL documentation synchronized for Sprint 1 changes.
