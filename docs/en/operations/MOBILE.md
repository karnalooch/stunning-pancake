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
| Node.js/npm | Per `mobile/package.json` |
| EAS CLI | `npm i -g eas-cli` (store release) |
| Expo account | Access to the EAS project |
| Env | Only **public** `EXPO_PUBLIC_*` prefixes (no repo secrets) |

---

## Environment variables (names only)

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_URL` | Django REST API (prod/staging) |
| `EXPO_PUBLIC_TELEMETRY_URL` | FastAPI telemetry (Railway default) |

Set in EAS Secrets / `eas.json` profiles / local `.env` (gitignored). **Do not** document production URL values in tables — use variable names only.

---

## Build and release (Mobile Lead)

### 1. Development

```bash
cd mobile
npm install
npx expo start
```

### 2. Preview / internal (EAS)

1. Log in: `eas login`
2. Profile from `eas.json` (e.g. preview)
3. `eas build --profile preview --platform android` (or ios)

### 3. Production store

1. Bump version in `app.json` / `app.config.*` (version + buildNumber/versionCode).
2. `eas build --profile production --platform all`
3. `eas submit` per store profile (after QA).
4. **Gate:** [PRE_RELEASE_VERIFICATION.md](./PRE_RELEASE_VERIFICATION.md) + smoke API (`EXPO_PUBLIC_API_URL`).

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
| Install deps (monorepo root) | `npx pnpm@9.15.0 install` |
| Install Maestro CLI (once) | `npm run mobile:install-maestro` (root) or `npm run install:maestro` (`mobile/`) |
| Dev build on device/emulator | `cd mobile && npm run build:dev:android` (EAS development client) |
| Run all flows | `npm run mobile:test:e2e` (root) or `npm run test:e2e` (`mobile/`) |
| Single flow | `npm run test:e2e:auth` (`mobile/`) |

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
| EAS build fail | Credentials / profiles | `eas credentials`, build log |

---

## Rollback release (Release Manager)

1. Store: pause rollout % or rollback in store console.
2. EAS: rebuild previous git tag with `eas build`.
3. API: if breaking change — rollback backend per [DEPLOYMENT.md](../DEPLOYMENT.md).

---

## Related

- [MOBILE_BACKGROUND_TRACKING_MIGRATION.md](./MOBILE_BACKGROUND_TRACKING_MIGRATION.md) — background tracking migration (Android/iOS, KPI, escalation)
- [DATA_RESILIENCE.md](../../DATA_RESILIENCE.md)
- [ADR-005](../../adr/005-telemetry-tracking.md)
- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- [OPERATIONS_INDEX.md](./OPERATIONS_INDEX.md)
- [../admin/P0_SMOKE_CHECKLIST.md](../../admin/P0_SMOKE_CHECKLIST.md) (admin smoke; not run on device)
