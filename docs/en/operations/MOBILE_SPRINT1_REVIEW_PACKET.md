# Mobile Sprint 1 Review Packet (4VELO)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Product Manager / Mobile Lead |
| **Last reviewed** | 2026-06-14 |
| **Audience** | Product trio, mobile, backend, QA, DevOps, data, design, security |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/MOBILE_SPRINT1_REVIEW_PACKET.md) |
| **canonical_path** | docs/en/operations/MOBILE_SPRINT1_REVIEW_PACKET.md |
| **Related** | [MOBILE_SPRINT1_BOARD_SEED.md](./MOBILE_SPRINT1_BOARD_SEED.md) · [MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md](./MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md) · [MOBILE_SPRINT1_DAY1_KICKOFF_NOTES_TEMPLATE.md](./MOBILE_SPRINT1_DAY1_KICKOFF_NOTES_TEMPLATE.md) · [MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md](./MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md) · [MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md](./MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md) · [MOBILE_FULL_VISION_VERIFICATION.md](./MOBILE_FULL_VISION_VERIFICATION.md) · [MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md](../../design/MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md) |

---

## Purpose

Ready-to-use Sprint 1 package:

- role-based checklists,
- task and finding templates,
- daily status template,
- final sign-off sheet.

This can be copied directly into Notion/Jira/Linear.

---

## Pre-signoff snapshot (2026-06-14)

Status based on current repository state and latest technical validation:

| Area | Status | Evidence / Notes |
|------|--------|------------------|
| Mobile engineering gate | GO | `pnpm exec tsc --noEmit` green; full Jest `19/19` suites and `97/97` tests; `--detectOpenHandles --runInBand` with no open handles report |
| Lint gate | GO (with backlog) | No lint errors; existing warning backlog remains (tech-debt), no new blocking errors |
| QA manual device matrix | NO-GO (pending) | Still required: Android/iOS manual smoke + deep links + offline/reconnect |
| DevOps/Release gate | NO-GO (pending) | Still required: preview build validation, rollback path, telemetry/crash on preview |
| Security/Privacy gate | NO-GO (pending) | Still required: formal token/log hygiene and privacy zones fallback checklist |
| Cross-functional final sign-off | NO-GO (pending) | Requires GO status from all role owners in section 7 |

### Fast closure path (operational)

- Step 1 (QA): run smoke + manual matrix, attach evidence.
- Step 2 (Release/DevOps): validate preview + rollback + telemetry.
- Step 3 (Security/Privacy): complete checklist and decide GO/NO-GO.
- Step 4 (Product trio): confirm Ride/Explore/Profile acceptance criteria.
- Step 5: fill sign-off table and publish final release recommendation.

---

## Execution Snapshot (2026-06-14)

- Mobile compile gate: `pnpm exec tsc --noEmit` ✅.
- Test evidence (targeted regression): 10 suites / 59 tests ✅.
- Code-complete areas: navigation/deep-link contract, HUD hardening, onboarding/detail i18n, edge states, release env policy (`API`/`telemetry`/`social auth`), layout pattern (`Ride/Explore/Profile`).
- Remaining operational work: manual device matrix QA (Android/iOS) and final cross-functional sign-off.

---

## 1) Sprint 1 Scope (recommended)

- Architecture and contracts:
  - navigation (`types`, `routeContract`, `linking`),
  - module boundaries (`features/*`),
  - error/offline/loading contract.
- Ride core:
  - start/pause/resume/stop,
  - summary handoff,
  - GPS recovery path.
- Quality baseline:
  - critical smoke E2E flows,
  - minimum unit/integration for contracts.

---

## 2) Board structure (copy/paste)

## Columns

`Backlog` -> `Ready` -> `In Progress` -> `Review` -> `QA` -> `Done`

## Labels

- Priority: `P0`, `P1`, `P2`
- Type: `feature`, `bug`, `tech-debt`, `docs`, `ops`
- Area: `mobile`, `backend`, `qa`, `design`, `security`, `release`

## Definition of Done (global)

- [ ] Code + tests + docs updated
- [ ] PL/EN parity for new strings/docs
- [ ] Edge states (offline/loading/error/empty) covered
- [ ] No open P0 for the task

---

## 3) Role-by-role Sprint 1 checklists

## Product trio (PM + UX/UI + Tech Lead)

- [ ] Sprint scope confirmed (IN/OUT boundaries).
- [ ] P0/P1 ordering confirmed.
- [ ] Ride/Explore/Profile screen acceptance criteria confirmed.
- [ ] Updated:
  - `docs/design/4VELO_MOBILE_FULL_VISION_IMPLEMENTATION.md`
  - `docs/pl/design/4VELO_MOBILE_FULL_VISION_IMPLEMENTATION.md`
  - `docs/design/MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md`.

## Mobile team

- [ ] Route and deep-link contracts are consistent.
- [ ] Ride lifecycle works end-to-end.
- [ ] Settings sections persist preferences without regressions.
- [ ] PL/EN i18n parity preserved.
- [ ] Updated:
  - `docs/pl/operations/MOBILE_FULL_VISION_VERIFICATION.md`
  - `docs/en/operations/MOBILE_FULL_VISION_VERIFICATION.md`.

## Backend/API team

- [ ] Auth refresh and session restore are stable.
- [ ] Retry/backoff policy is aligned with runbooks.
- [ ] GPS sync_path/finalize edge cases reviewed.
- [ ] Updated:
  - `docs/pl/DATA_RESILIENCE.md`
  - `docs/API.md` or `docs/pl/API.md` (if contract changed)
  - traceability matrix (FR/NFR status).

## QA

- [ ] Smoke: auth, ride lifecycle, GPS recovery, immersive.
- [ ] Manual matrix: deep links + offline/reconnect + settings.
- [ ] P0/P1 regression list created with owners.
- [ ] Verification gate updated.

## DevOps/Release

- [ ] Build profiles and env are ready for preview.
- [ ] Release/rollback checklist is current.
- [ ] Telemetry and crash reporting verified.
- [ ] Updated `MOBILE.md` (PL/EN) if process changed.

## Data/Analytics

- [ ] Critical Ride/Auth/Share events exist and are coherent.
- [ ] Performance budget metrics are reported.
- [ ] Traceability NFR observability updated.

## Design production

- [ ] Icon/chrome/card/HUD consistency confirmed.
- [ ] No new placeholders/emoji.
- [ ] Integer scaling and asset sharpness validated.
- [ ] Grand Prix audit (EN/PL) updated if drift found.

## Security/Privacy/Compliance

- [ ] Token handling and error logging without sensitive exposure.
- [ ] Privacy zones flow has safe fallback behavior.
- [ ] No sensitive config/runtime leakage.
- [ ] Relevant governance/compliance sections updated.

---

## 4) Task template (Jira/Linear/Notion)

## Title
`[Role][Priority] Short goal`

## Context
- Why:
- Scope:

## Acceptance Criteria
- [ ] AC-1
- [ ] AC-2
- [ ] AC-3

## Evidence
- Tests:
- Screens/recordings:
- Docs updated:

## Risk
- What can break:
- Mitigation:

## Owner / ETA
- Owner:
- ETA:

---

## 5) Findings template (cross-functional review)

`Issue:`  
`Impact:`  
`Recommendation:`  
`Priority:` P0/P1/P2  
`Owner:`  
`Linked task:`  
`Docs to update:`

---

## 6) Daily status template (15-min standup)

## Yesterday
- Done:

## Today
- Plan:

## Blockers
- Blocker:
- Owner needed:

## Risk update
- New P0/P1:

---

## 7) Sprint 1 final sign-off sheet

| Role | Status (GO/NO-GO) | Open P0 | Open P1 | Owner sign-off |
|------|-------------------|---------|---------|----------------|
| Product trio |  |  |  |  |
| Mobile |  |  |  |  |
| Backend/API |  |  |  |  |
| QA |  |  |  |  |
| DevOps/Release |  |  |  |  |
| Data/Analytics |  |  |  |  |
| Design production |  |  |  |  |
| Security/Privacy |  |  |  |  |

### Draft prefill + simulated owner decision (2026-06-14)

| Role | Status (GO/NO-GO) | Open P0 | Open P1 | Owner sign-off |
|------|-------------------|---------|---------|----------------|
| Product trio | NO-GO (pending owner sign-off) | 1 (formal AC/IN-OUT confirmation missing) | 0 |  |
| Mobile | GO | 0 | tech-debt backlog |  |
| Backend/API | NO-GO (pending owner sign-off) | 1 (formal API contract confirmation missing) | 0 |  |
| QA | NO-GO (manual matrix pending) | 1 (Android/iOS smoke + deep-link + offline matrix) | 0 |  |
| DevOps/Release | NO-GO (release gate pending) | 1 (preview + rollback + telemetry) | 0 |  |
| Data/Analytics | NO-GO (observability evidence pending) | 1 (critical event/perf evidence missing) | 0 |  |
| Design production | NO-GO (visual sign-off pending) | 1 (final drift-free check on current build missing) | 0 |  |
| Security/Privacy | NO-GO (checklist pending) | 1 (token/log/privacy checklist incomplete) | 0 |  |

Note: this is a simulation based on repository evidence and technical gates. Final release sign-off still requires explicit owner entries.

### 5 steps to full GO (operational runbook)

1. **QA gate:** close the Android+iOS manual matrix for smoke/deep-link/offline and attach evidence.
2. **Release gate:** validate preview build, rollback path, and telemetry/crash collection on preview.
3. **Security gate:** complete the token/log/privacy checklist and record Security/Privacy owner decision.
4. **Product gate:** confirm acceptance criteria and IN/OUT scope for Ride/Explore/Profile in sign-off sheet.
5. **Final gate:** collect all role signatures and publish final `GO`/`NO-GO` release recommendation.

## Release recommendation

- `GO` only if:
  - no open P0,
  - each owner reports `GO`,
  - verification gate is green.

- `NO-GO` if:
  - any unresolved P0 exists without mitigation.
