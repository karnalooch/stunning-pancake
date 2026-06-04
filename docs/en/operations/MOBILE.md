# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../operations/MOBILE.md) |
| **canonical_path** | docs/en/operations/MOBILE.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Mobile Lead |
| **Last reviewed** | 2026-06-03 |
| **Target** | Build and release a React Native/Expo application and handle GPS/telemetry failures in the field. |
| **Audience** | Mobile Lead, Platform Operator (env), QA |
| **GPS layer architecture** | [DATA_RESILIENCE.md](../../DATA_RESILIENCE.md) |
| **Code** | `mobile/src/services/GpsSyncManager.ts`, `gpsSyncStorage.ts`, `App.tsx` |

---

## Prerequisites

| Requirement | Notes |
|-----------|--------|
| Node.js/npm | According to `mobile/package.json` |
| EAS CLI | `npm i -g eas-cli` (release store) |
| Expo Account | Access to the EAS project |
| Env | Only **public** `EXPO_PUBLIC_*` prefixes (no repo secrets) |

---

## Environment variables (names)

| Variable | Purpose |
|---------|-----|
| `EXPO_PUBLIC_API_URL` | Django REST API (prod/staging) |
| `EXPO_PUBLIC_TELEMETRY_URL` | FastAPI telemetry (Railway default) |

Set in EAS Secrets / `eas.json` profiles / local `.env` (gitignored). **Don't** document prod URL values ​​in tables - use variable names.

---

## Build and release (Mobile Lead)

### 1. Development```bash
cd mobile
npm install
npx expo start
```### 2. Preview / internal (EAS)

1. Log in: `eas login`
2. Profile with `eas.json` (e.g. preview)
3. `eas build --profile preview --platform android` (or ios)

### 3. Production store

1. Upgrade the version in `app.json` / `app.config.*` (version + buildNumber/versionCode).
2. `eas build --profile production --platform all`
3. `eas submit` according to the store profile (after passing QA).
4. **Gate:** [PRE_RELEASE_VERIFICATION.md](./PRE_RELEASE_VERIFICATION.md) + smoke API (`EXPO_PUBLIC_API_URL`).

### Verification after build

| Check | Expected |
|-------|------------|
| App start | No crash on splash |
| Login/API | `EXPO_PUBLIC_API_URL` corresponds to |
| Telemetry | Points go to `EXPO_PUBLIC_TELEMETRY_URL` |
| Recovery | See § Test recovery |

---

## Client behavior (GPS/network)

| Mechanism | Description |
|-----------|------|
| **MMKV buffer** | GPS point buffer (up to 2000); overflow → `gps_buffer_overflow` |
| **Outbox** | Telemetry batches after failed upload; retry every 30 s |
| **pending_session** | Django session POST on network loss at start of ride |
| **NetInfo** | Po online: `flushGpsUploadQueues()` |
| **AppState** | Unplugs NetInfo in the background; with `active` — flush + subscription |
| **Launch recovery** | `recoverGpsDataOnLaunch()` - HUD banner |

MMKV diagram and keys: [DATA_RESILIENCE.md](../../DATA_RESILIENCE.md).

---

## Files (implementation)

| File | Role |
|------|------|
| `GpsSyncManager.ts` | Task in the background, upload, recovery, NetInfo |
| `gpsSyncStorage.ts` | MMKV keys, buffer, outbox |
| `rideSessionService.ts` | Django Activity Session |
| `App.tsx` | `recoverGpsDataOnLaunch()` on startup |

---

## Test recovery (QA / Mobile Lead)

1. Enable `[GPS]` logs in Metro - recovery logs buffer/outbox size.
2. Airplane mode → turn off → outbox should empty.
3. Kill the app while driving → restart → recovery banner / resume route.

---

## Troubleshooting

| Symptom | Reason | Action |
|-------|-----------|--------|
| No GPS upload | Bad `EXPO_PUBLIC_TELEMETRY_URL` / CORS | Check the URL in EAS env; [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) |
| The session does not start | API down/auth | `EXPO_PUBLIC_API_URL`, token |
| Recovery banner constantly | Large outbox | Dev: clear MMKV as a test; prod: wait for flush + network |
| `gps_buffer_overflow` | >2000 points in buffer | Network + flush; consider a shorter offline ride |
| Build EAS fail | Credentials/profiles | `eas credentials`, build log |

---

## Rollback release (Release Manager)

1. Store: Pause rollout % or rollback in store console.
2. EAS: rebuild previous git tag with `eas build`.
3. API: if breaking change - rollback backend by [DEPLOYMENT.md](../DEPLOYMENT.md).

---

## Related

- [DATA_RESILIENCE.md](../../DATA_RESILIENCE.md)
- [ADR-005](../../adr/005-telemetry-tracking.md)
- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- [OPERATIONS_INDEX.md](./OPERATIONS_INDEX.md)
- [../admin/P0_SMOKE_CHECKLIST.md](../../admin/P0_SMOKE_CHECKLIST.md) (does not apply to mobile devices directly)
