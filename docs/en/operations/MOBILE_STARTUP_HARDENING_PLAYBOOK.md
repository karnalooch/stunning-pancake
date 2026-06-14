# Mobile Startup Hardening Playbook (4VELO)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Mobile Lead / Release Manager |
| **Last reviewed** | 2026-06-14 |
| **Audience** | Mobile engineers, QA, release, on-call |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/MOBILE_STARTUP_HARDENING_PLAYBOOK.md) |
| **canonical_path** | docs/en/operations/MOBILE_STARTUP_HARDENING_PLAYBOOK.md |
| **Related** | [MOBILE.md](./MOBILE.md) · [MOBILE_FULL_VISION_VERIFICATION.md](./MOBILE_FULL_VISION_VERIFICATION.md) · [DATA_RESILIENCE.md](../../pl/DATA_RESILIENCE.md) · [ADR 012](../../adr/012-mobile-performance-budgets.md) · [ADR 014](../../adr/014-mobile-immersive-pixel-art-and-bike-computer.md) |

---

## Purpose

Preventive startup checklist for the full-vision mobile rebuild. This document reduces "late fixes" by enforcing:

- strict merge/release gates,
- explicit ownership boundaries,
- implementation order that avoids architectural conflicts,
- anti-pattern lists that typically create regressions.

---

## 1) Non-negotiable rules

1. **Ride core > skin**: live HUD and tracking always take priority over visual effects.
2. **No client secrets**: use `EXPO_PUBLIC_*` only for public runtime values.
3. **Offline durability first**: no merge may weaken MMKV buffer/outbox/recovery.
4. **Navigation contract is central**: route changes go through `navigation/types.ts` + `navigation/routeContract.ts` + `navigation/linking.ts`.
5. **Token-first UI**: no ad-hoc color/spacing literals outside theme tokens.
6. **PL/EN parity**: every new key must be added to both `strings.pl.ts` and `strings.en.ts`.

---

## 2) Owner matrix (who can block merge)

| Area | Owner | Merge blocker when unmet |
|------|-------|---------------------------|
| Ride lifecycle + GPS durability | Mobile Lead | `ride-lifecycle` or `gps-recovery` smoke failures |
| Navigation contract + deep links | Mobile Lead | route type/linking mismatch |
| API/auth/session | Backend + Mobile Lead | 401 refresh/session restore regressions |
| Performance budgets | Mobile Lead + QA | budget violations without mitigation |
| Accessibility/reduced motion | Mobile Lead + QA | missing fallback or poor HUD legibility |
| i18n PL/EN | Mobile + Product | missing keys or diverging copy |
| Docs parity EN/PL | Documentation maintainer | indexes/runbooks not updated |

---

## 3) Startup phase (D0-D3) — stabilization minimum

## D0 (before first major PR)

- Confirm active SSOT set:
  - `docs/design/DESIGN_SYSTEM_MOBILE.md`
  - `docs/adr/014-mobile-immersive-pixel-art-and-bike-computer.md`
  - `docs/pl/DATA_RESILIENCE.md`
  - `docs/adr/012-mobile-performance-budgets.md`
- Confirm local env values:
  - `EXPO_PUBLIC_API_URL`
  - `EXPO_PUBLIC_TELEMETRY_URL`
  - `EXPO_PUBLIC_ENABLE_FIREBASE` (per environment)
- Confirm `expo start` and preview build boot without cold-start crash.

## D1-D2 (architecture and contracts)

- Freeze route contract (`navigation/types.ts` + deep-link map).
- Define `features/*` module boundaries with README contracts.
- Prefer legacy adapters/wrappers over broad rewrites in one pass.

## D3 (first quality gate)

- Run:
  - unit/integration for navigation contracts and performance budgets,
  - smoke E2E (`auth-login`, `ride-lifecycle`, `gps-recovery-banner`).
- Require PR "done" checklist:
  - i18n parity,
  - offline fallback,
  - edge-state coverage.

---

## 4) Quality gates per PR (mandatory)

Each PR must contain a "Gate evidence" section:

1. **Scope:** exact changes (max 5 bullets).
2. **Risks:** what can break.
3. **Test evidence:** commands + pass/fail.
4. **Edge states:** offline/loading/empty/error behavior.
5. **i18n:** PL/EN parity confirmation.
6. **Docs:** list of updated documentation files.

No evidence means no merge.

---

## 5) Anti-regression checklist (copy/paste to PR)

- [ ] `RootStackParamList` updates include linking config updates.
- [ ] No release hardcoded URL fallback added (`__DEV__` only).
- [ ] Ride HUD still shows GPS + battery + clock.
- [ ] STOP requires confirmation guard (hold/slide).
- [ ] `useMotionPolicy` / degrade still active under low FPS.
- [ ] `RiderPreferencesService` keys remain MMKV-compatible.
- [ ] `ActivityService` + `OfflineCacheService` still provide domain fallback UI.
- [ ] No new strings in only one language.
- [ ] `expo-battery`, map and voice cues keep safe fallback behavior.
- [ ] At least one runbook was updated for operationally relevant changes.

---

## 6) Daily smoke matrix

| Flow | Expected result | Priority |
|------|------------------|----------|
| Auth login/register | user reaches shell without crash | P0 |
| Start ride | navigation to tracking + live metrics | P0 |
| Pause/resume/stop | correct lifecycle + summary handoff | P0 |
| GPS recovery | unsent points upload after reconnect | P0 |
| Explore map | map renders; no navigation-entry crashes | P1 |
| Marketplace | balance/pools load; graceful API-failure UI | P1 |
| Profile/training/activity | offline cache fallback works | P1 |
| Settings sections | section switch + prefs persist | P1 |
| Deep links | `activity`, `explore/map`, `settings` resolve correctly | P1 |

---

## 7) Performance hardening checklist

- HUD:
  - target 60 FPS, minimum budget 55 FPS,
  - automatic motion/particle degrade enabled.
- Telemetry:
  - ingest latency under 2s target,
  - outbox flush under 5s target,
  - retry/backoff + `Retry-After` handling.
- Memory:
  - no large unreviewed asset additions,
  - atlases/textures loaded intentionally.

If metrics exceed budget, PR must include mitigation plan.

---

## 8) Security/privacy hardening checklist

- JWT and refresh tokens stored only via SecureStore + `authTokenStorage`.
- No sensitive values in dev/prod logs.
- Privacy Zones:
  - API contract retained,
  - UI must not imply success when backend returns errors.
- On auth failures:
  - session state clears deterministically,
  - user gets a safe return path to login.

---

## 9) Start-release gate (before preview/prod)

- [ ] `pnpm --filter 4velo lint` has no errors.
- [ ] Critical unit/integration tests pass.
- [ ] Critical Maestro smoke passes.
- [ ] Manual P0 QA pass (auth/ride/gps/deep-link/settings).
- [ ] EN/PL docs are synchronized.
- [ ] Build version and release notes are complete.
- [ ] Rollback plan is explicitly assigned.

---

## 10) Startup "done" definition

Startup stage is complete only when:

1. Ride core and GPS resilience are stable for at least 3 consecutive test days.
2. Critical deep links remain regression-free.
3. Docs matrix + runbooks are current and indexed.
4. The team consistently uses PR quality evidence sections.
