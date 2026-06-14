# Mobile Full Vision — Verification Gate

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Mobile Lead / QA Lead |
| **Last reviewed** | 2026-06-14 |
| **Audience** | Mobile engineers, QA, release |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/MOBILE_FULL_VISION_VERIFICATION.md) |
| **canonical_path** | docs/en/operations/MOBILE_FULL_VISION_VERIFICATION.md |

---

## Scope

Checklist for 4VELO mobile full rebuild/full vision before merge/release.

## 1) Unit / integration

- `navigation`: route contracts (`MainTabs`, stack overlays, deep-link parsing).
- `services/performanceBudget`: min/max budget rules and violation event emission.
- `services/gpsSync*`: retry, outbox, and reconnect recovery.
- `app/useRideLifecycle`: start/stop/recovery edge states.
- `services/apiClient`: auth refresh and session-expired handling.

## 2) Smoke E2E (Maestro)

- `auth-login.yaml`: login and shell entry.
- `ride-lifecycle.yaml`: start -> pause -> stop -> summary.
- `gps-recovery-banner.yaml`: resend unsent GPS points.
- `immersive-theme-smoke.yaml`: UI consistency after theme toggle.

## 3) Manual QA (P0)

- Deep links:
  - `fourvelo://profile/activity/<id>`
  - `fourvelo://explore/map`
  - `fourvelo://explore/marketplace`
  - `fourvelo://settings`
- Ride HUD:
  - GPS + clock + battery status visible,
  - stop-confirm hold interaction,
  - voice cue on GPS recovery/paused state.
- Settings:
  - section switching (`General`, `Sensors`, `Privacy`, `Garage`),
  - Strava/Garmin connect and manual sync trigger.

## 4) Release hardening

- `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_TELEMETRY_URL` set for target environment.
- No P0 regressions in auth, ride lifecycle, and telemetry durability.
- Crash/perf telemetry enabled for release build.
- EN/PL docs updated after scope closure.
