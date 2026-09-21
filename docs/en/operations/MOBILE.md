# Mobile — build, release, GPS recovery

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/MOBILE.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-04 |
| **canonical_path** | docs/en/operations/MOBILE.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Mobile Lead |
| **Last reviewed** | 2026-06-03 |
| **Target** | Build and release the React Native/Expo app; handle GPS/telemetry failures in the field. |
| **Audience** | Mobile Lead, Platform Operator (env), QA |
| **GPS architecture** | [DATA_RESILIENCE.md](../../DATA_RESILIENCE.md) |
| **Code** | `mobile/src/services/GpsSyncManager.ts`, `gpsSyncStorage.ts`, `App.tsx` |

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js / pnpm | Node.js 24.21.0 LTS + pnpm 12.4.2 (root monorepo toolchain) |
| EAS CLI | Use the repository-pinned `eas-cli@24.7.0` through `pnpm --dir mobile ...` scripts; no global install required. |
| Expo account | Access to the EAS project |
| Env | Only **public** `EXPO_PUBLIC_*` prefixes (no repo secrets) |

---

## Environment variables (names only)

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_URL` | Django REST API (prod/staging) |
| `EXPO_PUBLIC_TELEMETRY_URL` | FastAPI telemetry (Railway default) |

Remote profiles read these from their selected EAS Environment (`development` / `preview` / `production`); local development may use a gitignored `.env`. `pilot-local` is the only profile that intentionally pins localhost endpoints in `eas.json`. **Do not** document production URL values in tables — use variable names only.

---

## Build and release (Mobile Lead)

### 1. Development

```bash
# from the monorepo root
pnpm install --frozen-lockfile
pnpm --dir mobile start
```

### 2. Preview / internal (EAS)

1. Log in with the pinned CLI: `pnpm --dir mobile dlx eas-cli@24.7.0 login`
2. Profile from `eas.json` (e.g. preview)
3. `pnpm --dir mobile build:preview:android` (or `pnpm --dir mobile build:preview:ios`)

### 3. Production store

1. The product version has one source of truth: repository-root `version.json`.
2. Change it with `pnpm version:set -- <MAJOR.MINOR.PATCH> --prerelease <id>` (for example `dev` or `rc.1`), or omit `--prerelease` for a stable release.
3. Verify the contract with `pnpm version:check`. `mobile/app.config.js` reads only numeric `MAJOR.MINOR.PATCH` from the SSOT as the user-visible application version.
4. Run the platform-specific pinned scripts `pnpm --dir mobile build:prod:android` / `pnpm --dir mobile build:prod:ios`. EAS owns native build identifiers (`android.versionCode` / `ios.buildNumber`) and auto-increments them for production builds.
5. Submit with the pinned CLI after QA, for example `pnpm --dir mobile dlx eas-cli@24.7.0 submit --platform android --profile production`.
6. A stable Git tag must be exactly `vMAJOR.MINOR.PATCH`, must match `version.json`, and is rejected while `prerelease` is non-empty.
7. **Gate:** [PRE_RELEASE_VERIFICATION.md](./PRE_RELEASE_VERIFICATION.md) + smoke API (`EXPO_PUBLIC_API_URL`).

Do not manually edit `versionCode`, `buildNumber`, `mobile/package.json`, `admin/package.json`, or the Expo version in `app.config.js`. The versioning contract owns those values; root `app.json` is no longer an Expo configuration source.

### Verification after build

| Check | Expected |
|-------|----------|
| App start | No crash on splash |
| Login/API | `EXPO_PUBLIC_API_URL` reachable |
| Telemetry | Points reach `EXPO_PUBLIC_TELEMETRY_URL` |
| Recovery | See § Test recovery |

---

## Client behavior (GPS/network)

| Mechanism | Description |
|-----------|-------------|
| **MMKV buffer** | GPS point buffer (up to 2000); overflow → `gps_buffer_overflow` |
| **Outbox** | Telemetry batches after failed upload; retry every 30 s |
| **pending_session** | Django session POST on network loss at ride start |
| **NetInfo** | On online: `flushGpsUploadQueues()` |
| **AppState** | Unsubscribes NetInfo in background; on `active` — flush + subscription |
| **Launch recovery** | `recoverGpsDataOnLaunch()` — HUD banner |

MMKV diagram and keys: [DATA_RESILIENCE.md](../../DATA_RESILIENCE.md).

---

## Files (implementation)

| File | Role |
|------|------|
| `GpsSyncManager.ts` | Background task, upload, recovery, NetInfo |
| `gpsSyncStorage.ts` | MMKV keys, buffer, outbox |
| `rideSessionService.ts` | Django activity session |
| `App.tsx` | App shell; delegates to `src/app/useRideLifecycle.ts` |

---

## E2E (Maestro)

| Step | Command |
|------|---------|
| Install deps (monorepo root) | `pnpm install --frozen-lockfile` |
| Install Maestro CLI (once) | `pnpm mobile:install-maestro` (root) or `pnpm --dir mobile install:maestro` |
| Dev build on device/emulator | `pnpm --dir mobile build:dev:android` (EAS development client) |
| Run all flows | `pnpm mobile:test:e2e` (root) or `pnpm --dir mobile test:e2e` |
| Single flow | `pnpm --dir mobile test:e2e:auth` |

Flows live in `mobile/.maestro/flows/`. Requires **Java 17+**, **adb** (Android SDK platform-tools), and an online emulator/device with `com.sport.athlete` installed.

For `ride-lifecycle.yaml`, set env vars `E2E_EMAIL` and `E2E_PASSWORD` before running Maestro.

---

## Test recovery (QA / Mobile Lead)

1. Enable `[GPS]` logs in Metro — recovery logs buffer/outbox size.
2. Airplane mode → off → outbox should drain.
3. Kill app while riding → restart → recovery banner / resume route.

---

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| No GPS upload | Bad `EXPO_PUBLIC_TELEMETRY_URL` / CORS | Check EAS env; [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) |
| Session does not start | API down / auth | `EXPO_PUBLIC_API_URL`, token |
| Recovery banner persists | Large outbox | Dev: clear MMKV; prod: wait for flush + network |
| `gps_buffer_overflow` | >2000 points in buffer | Restore network + flush; shorten offline ride |
| EAS build fail | Credentials / profiles | `pnpm --dir mobile dlx eas-cli@24.7.0 credentials`, build log |

---

## Rollback release (Release Manager)

1. Store: pause rollout % or rollback in store console.
2. EAS: rebuild previous git tag with the pinned `pnpm --dir mobile build:prod:*` scripts.
3. API: if breaking change — rollback backend per [DEPLOYMENT.md](../DEPLOYMENT.md).

---

## Related

- [MOBILE_BACKGROUND_TRACKING_MIGRATION.md](./MOBILE_BACKGROUND_TRACKING_MIGRATION.md) — background tracking migration (Android/iOS, KPI, escalation)
- [DATA_RESILIENCE.md](../../DATA_RESILIENCE.md)
- [ADR-005](../../adr/005-telemetry-tracking.md)
- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- [OPERATIONS_INDEX.md](./OPERATIONS_INDEX.md)
- [../admin/P0_SMOKE_CHECKLIST.md](../../admin/P0_SMOKE_CHECKLIST.md) (admin smoke; not run on device)
