# Mobile Cross-Functional Review Playbook (4VELO)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Mobile Lead / Product Manager |
| **Last reviewed** | 2026-06-14 |
| **Audience** | Product trio, engineering, QA, DevOps, design, security |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md) |
| **canonical_path** | docs/en/operations/MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md |
| **Related** | [MOBILE_STARTUP_HARDENING_PLAYBOOK.md](./MOBILE_STARTUP_HARDENING_PLAYBOOK.md) · [MOBILE_FIX_FORWARD_PLAYBOOK.md](./MOBILE_FIX_FORWARD_PLAYBOOK.md) · [MOBILE_FULL_VISION_VERIFICATION.md](./MOBILE_FULL_VISION_VERIFICATION.md) · [MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md](../../design/MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md) |

---

## Purpose

Each role reviews the mobile layer through its own accountability lens and updates assigned documentation. Outcome: fewer startup corrections, faster PR review, and fewer release regressions.

---

## 1) Shared workflow (for every role)

1. Review assigned mobile scope.
2. Report findings in format: `Issue / Impact / Recommendation / Owner`.
3. Tag severity: `P0` (blocking), `P1` (high), `P2` (quality).
4. Update assigned documentation.
5. Record review date and owner in team changelog/release notes.

---

## 2) Review scope by role

## Product trio (PM + UX/UI + Tech Lead)

- **Reviews:** user-flow alignment with full vision, P0/P1 priorities, scope-time tradeoffs.
- **Mobile surface:** `mobile/src/screens/*`, `mobile/src/app/NavigationShell.tsx`, `mobile/src/navigation/*`.
- **Updates:** 
  - `docs/design/4VELO_MOBILE_FULL_VISION_IMPLEMENTATION.md`
  - `docs/pl/design/4VELO_MOBILE_FULL_VISION_IMPLEMENTATION.md`
  - `docs/design/MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md` (requirements status).

## Mobile team (RN / iOS / Android)

- **Reviews:** module architecture, navigation, ride lifecycle, edge states, i18n parity.
- **Mobile surface:** `mobile/src/app/*`, `mobile/src/features/*`, `mobile/src/screens/*`, `mobile/src/components/*`, `mobile/src/i18n/*`.
- **Updates:**
  - `docs/pl/operations/MOBILE_FULL_VISION_VERIFICATION.md`
  - `docs/en/operations/MOBILE_FULL_VISION_VERIFICATION.md`
  - `docs/pl/operations/MOBILE_STARTUP_HARDENING_PLAYBOOK.md` (when quality gates change).

## Backend/API team

- **Reviews:** API contracts, auth refresh, retry, sync_path/finalize, error handling.
- **Mobile surface:** `mobile/src/services/api.ts`, `apiClient.ts`, `apiRetry.ts`, `rideSessionService.ts`, `GpsSyncManager.ts`.
- **Updates:**
  - `docs/pl/DATA_RESILIENCE.md`
  - `docs/pl/API.md` / `docs/API.md` (for contract/endpoint changes)
  - `docs/design/MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md` (FR/NFR mapping).

## QA (manual + automation)

- **Reviews:** critical smoke flows, GPS edge cases, offline/reconnect, deep links, cross-device sanity.
- **Mobile surface:** `mobile/.maestro/flows/*`, auth/ride/gps/settings/map/profile paths.
- **Updates:**
  - `docs/pl/operations/MOBILE_FULL_VISION_VERIFICATION.md`
  - `docs/en/operations/MOBILE_FULL_VISION_VERIFICATION.md`
  - `docs/pl/operations/MOBILE_FIX_FORWARD_PLAYBOOK.md` (new regression/incident classes).

## DevOps / Release

- **Reviews:** env readiness, build profiles, release pipeline, rollback, observability.
- **Mobile surface:** `mobile/app.config.js`, `mobile/eas.json`, release scripts, telemetry toggles.
- **Updates:**
  - `docs/pl/operations/MOBILE.md`
  - `docs/en/operations/MOBILE.md`
  - `docs/pl/operations/MOBILE_STARTUP_HARDENING_PLAYBOOK.md`.

## Data / Analytics

- **Reviews:** event quality, missing product events, performance and retention funnel instrumentation.
- **Mobile surface:** `mobile/src/services/EngagementAnalytics.ts`, `FirebaseService.ts`, `performanceBudget.ts`.
- **Updates:**
  - `docs/design/MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md` (NFR observability)
  - perf/analytics sections in `MOBILE_FULL_VISION_VERIFICATION.md`.

## Design production (graphic / illustrator / technical artist)

- **Reviews:** icon/asset consistency, integer scaling, card/HUD style parity, placeholder/emoji cleanup.
- **Mobile surface:** `mobile/src/assets/*`, `mobile/src/components/ui/*`, `mobile/src/theme/*`, `mobile/src/components/ride/*`.
- **Updates:**
  - `docs/design/MOBILE_ASSET_NANO_BANANA_PROMPTS.md`
  - `docs/design/GRAND_PRIX_UI_CONSISTENCY_AUDIT.md`
  - `docs/pl/design/GRAND_PRIX_UI_CONSISTENCY_AUDIT.md`.

## Security / Privacy / Compliance

- **Reviews:** token handling, privacy zones, secret exposure, data/logging safety.
- **Mobile surface:** `mobile/src/services/authTokenStorage.ts`, `apiClient.ts`, `SettingsScreen.tsx`, privacy API flows.
- **Updates:**
  - `docs/pl/CONSTITUTION.md` (if policy changes)
  - `docs/pl/operations/MOBILE_FIX_FORWARD_PLAYBOOK.md` (security incident response)
  - relevant compliance docs.

---

## 3) GO/NO-GO role criteria (quick gate)

| Role | GO if | NO-GO if | Minimum evidence |
|------|-------|----------|------------------|
| Product trio | IN/OUT and Ride/Explore/Profile AC are confirmed | Scope is unclear or AC conflict is unresolved | Updated spec + sign-off row entry |
| Mobile | `tsc` green, critical tests green, no new P0 | P0 crash/regression in ride/auth/sync | `tsc` + test results + PR reference |
| Backend/API | API contracts and retry/auth refresh are confirmed | Contract mismatch blocks mobile behavior | Contract note + API/DATA doc update |
| QA | Smoke and manual matrix pass for required scope | Critical scenario fails or required coverage is missing | Smoke report + device/deep-link/offline matrix |
| DevOps/Release | Preview build, rollback path, telemetry/crash checks are confirmed | Rollback path missing or release build unstable | Build logs + release checklist |
| Data/Analytics | Critical events and perf signals are observable | P0 events missing or NFR observability is broken | Event queries/screenshots + matrix update |
| Design production | No chrome/HUD drift and no placeholders in P0 flows | Visible drift or placeholder remains in key flow | Grand Prix audit update + screenshots |
| Security/Privacy | Token/log/privacy checklist is complete | Data exposure risk or privacy fallback failure remains | Security checklist + owner decision |

**Global rule:** any single `NO-GO` blocks release until mitigation and re-review.

---

## 4) Cadence and definition of done

## Cadence

- Cross-functional review: at least once per sprint.
- Extended review: before each release candidate.
- Incident review: after every P0/P1.

## Done when:

- Every role closes its checklist and records findings.
- P0 items are resolved or have formal mitigation plan.
- Traceability matrix and runbooks contain current dates and owners.
- Verification gate (`MOBILE_FULL_VISION_VERIFICATION`) is green.

---

## 5) Suggested review entry format (PR/release notes)

`[Role] [Date] [Scope] [Findings P0/P1/P2] [Docs updated] [Owner]`

Example:

`[QA] 2026-06-14 [ride lifecycle + gps recovery] [P1: flaky deep link on Android 14] [updated MOBILE_FULL_VISION_VERIFICATION] [owner: qa-lead]`
