# Mobile — build, release, GPS recovery

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-09-29 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/MOBILE.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-09-29 |
| **canonical_path** | docs/en/operations/MOBILE.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Mobile Lead |
| **Last reviewed** | 2026-09-29 |
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

## Canonical Windows Android preflight / new-PC bootstrap

`scripts/android-env.ps1` is the only Android SDK/JDK resolver for local Windows tooling. `scripts/android-preflight.ps1` is the fail-closed verification layer above it. The preflight **does not build or install an APK**.

On a newly prepared Windows machine:

1. Install the repository toolchain: Node.js **24.21.0**, pnpm **12.4.2**, Git, Android Studio with JDK 17/JBR, Android SDK Platform Tools and an emulator image if required.
2. Clone the repository to a reasonably short path and run the toolchain-only check:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/android-preflight.ps1 -ToolchainOnly
```

3. Resolve any reported duplicate SDK/ADB authority before continuing. `ANDROID_SDK_ROOT`, `ANDROID_HOME`, PATH `adb.exe` and any running adb server must all agree on the same SDK.
4. Start exactly one emulator or connect one authorized device. If more than one is online, pass `-DeviceId <serial>`.
5. Install an approved dev/pilot artifact using the normal EAS/CI evidence path. Preflight does not create an APK.
6. For `pilot-local`, configure localhost transport:

```powershell
adb reverse tcp:8000 tcp:8000
adb reverse tcp:8001 tcp:8001
# optional when Metro must be reached through USB:
adb reverse tcp:8081 tcp:8081
```

7. Run the strict device/package/reverse check:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/android-preflight.ps1 -RequirePilotReverse
```

The strict check validates:
- Node/pnpm/JDK versions;
- canonical Android SDK and `adb.exe` path;
- stale/foreign adb processes and duplicate PATH authorities;
- exactly one selected Android target (or explicit `-DeviceId`);
- installed package identity `com.sport.athlete`;
- listeners on adb/Metro/backend/telemetry ports `5037/8081/8000/8001`;
- Metro ownership when port 8081 is already occupied;
- current `adb reverse` state;
- exact Git SHA and tool paths/versions.

Every external command is bounded by `-TimeoutSeconds` (default 15 s). Successful runs write a secret-free provenance JSON under ignored `artifacts/android-preflight/`; the raw adb serial is not recorded, only a short SHA-256-derived device identifier.

### Fast Refresh vs Apply Changes vs full native rebuild

| Change | Use |
|---|---|
| JS/TS screen, state, copy or styling only | **Fast Refresh** / reload from Metro. Do not rebuild native code. |
| Temporary hand-edited generated Android debug code while diagnosing a native problem | Android Studio **Apply Changes** may be used only as a local diagnostic. Generated `mobile/android/**` is not release authority and must not become the proof source. |
| Expo config plugin, `app.config.js`, native dependency, committed native/plugin path, package/runtime boundary or any other native-affecting input | Use a **full clean native rebuild/reinstall** through the approved exact-SHA proof path (Gumball broker / explicit release proof / EAS). |
| Unsure whether a change is native-affecting | Treat it as native-affecting and use the explicit proof path; do not broaden automatic PR/main APK builds. |

Before any runtime acceptance or Maestro session, run the strict preflight again if SDK/JDK/ADB/device/ports changed since the last proof.

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

### 2a. Windows local native diagnostic — not a release artifact

The canonical pilot/preview/production artifacts are the pinned **EAS profiles** above. A raw local Expo prebuild + Gradle compile is diagnostic only.

For Windows diagnosis:

```powershell
# monorepo root
. .\scripts\android-env.ps1
pnpm install --frozen-lockfile
pnpm --dir mobile build:diagnostic:android:windows
```

Policy:

- use a short workspace path when Windows/CMake/Ninja path pressure is observed;
- do not switch the monorepo to hoisted linking as a path-length workaround;
- do not treat a local Gradle APK as preview/production provenance;
- do not use ad-hoc `reactNativeArchitectures` overrides in release-grade instructions;
- an ABI-limited build is allowed only as an explicitly recorded emulator diagnostic;
- package/version/runtimeVersion release authority remains the repository SSOT + EAS profile + native provenance gate.

The historical `build:local:preview:android` script is a compatibility alias to the diagnostic command and must not be interpreted as an EAS preview build. New documentation and automation must use `build:diagnostic:android:windows`.

### 3. Production store

1. The product version has one source of truth: repository-root `version.json`.
2. Change it with `pnpm version:set -- <MAJOR.MINOR.PATCH> --prerelease <id>` (for example `dev` or `rc.1`), or omit `--prerelease` for a stable release.
3. Verify the contract with `pnpm version:check`. `mobile/app.config.js` reads only numeric `MAJOR.MINOR.PATCH` from the SSOT as the user-visible application version.
4. Run the platform-specific pinned scripts `pnpm --dir mobile build:prod:android` / `pnpm --dir mobile build:prod:ios`. EAS owns native build identifiers (`android.versionCode` / `ios.buildNumber`) and auto-increments them for production builds.
5. Submit with the pinned CLI after QA, for example `pnpm --dir mobile dlx eas-cli@24.7.0 submit --platform android --profile production`.
6. A stable Git tag must be exactly `vMAJOR.MINOR.PATCH`, must match `version.json`, and is rejected while `prerelease` is non-empty.
7. **Gate:** [PRE_RELEASE_VERIFICATION.md](./PRE_RELEASE_VERIFICATION.md) + smoke API (`EXPO_PUBLIC_API_URL`).

Do not manually edit `versionCode`, `buildNumber`, `mobile/package.json`, `admin/package.json`, or the Expo version in `app.config.js`. The versioning contract owns those values; root `app.json` is no longer an Expo configuration source.

### Native runtime / appVersion boundary

Expo uses `runtimeVersion.policy = appVersion`. CI therefore fails closed when a change can alter the native runtime without moving the numeric `version.json.version` boundary.

A numeric appVersion bump is required when a PR changes:

- a direct native-sensitive mobile dependency such as Expo modules, React Native modules, Firebase native modules, MapLibre or Skia;
- `mobile/app.config.js`;
- committed `mobile/plugins/**`, `mobile/android/**` or `mobile/ios/**` paths.

Pure JS/UI changes do not require a runtime bump merely because they change application code. Changing only `version.json.prerelease` also does not move the Expo runtime boundary; the numeric `version` must change.

The blocking implementation is `scripts/validate_mobile_runtime_boundary.py` in the Mobile CI lane. It runs on pull requests and pushes, where a trusted base SHA exists; scheduled CI still exercises the unit contract without inventing a comparison base.

### Cost-aware Android native smoke

`.github/workflows/mobile-native-smoke.yml` keeps cheap routing for mobile/workspace changes, but **neither a routine PR nor an ordinary push/merge to `main` compiles an APK automatically**. A native-affecting diff may show that proof is needed, while the expensive `expo prebuild --clean` + Gradle work is deferred to an explicit exact-SHA proof.

When a PR really needs a native artifact, the preferred path is the Gumball Proof Broker:

```text
/gumball proof android-native-release
```

The `proof:android-native-release` label is equivalent. The broker resolves the current PR head, rejects duplicate queued/running work, and dispatches `mobile-native-smoke.yml` for that exact SHA with `release=true`. Direct `workflow_dispatch` remains an operator fallback. Full / Release Validation explicitly requests the same heavyweight proof for nightly/release/tag/reusable runs.

Pure JS/UI changes under `mobile/src/**`, mobile tests, docs/design, and other non-native changes remain covered by the normal quality lanes without Gradle. Ambiguous dependency/toolchain changes remain fail-closed in classification and may require an explicit proof; **they do not justify an automatic APK build on a PR or `main`**.

Do not force proof with an empty commit or by broadening a trigger. If an exact-SHA artifact has already been built and verified, reuse it instead of rebuilding the same SHA.

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
