# T84 — Physical Android Frozen UI validation

**Status:** BLOCKED until real-device execution  
**Issue:** #300  
**Applies to:** exact pilot Android build after T83 Frozen UI repo completion

## Purpose

T84 is the physical usability sign-off for the Frozen UI v1.2 mobile implementation. It is not a code-style check and it is not satisfied by CI screenshots.

The repository-side implementation is already complete. This runbook defines the shortest repeatable path from an exact identified artifact to a human PASS / FAIL / BLOCKED verdict.

## Preconditions

- clean local checkout at the exact candidate SHA;
- one authorized Android device connected through ADB;
- GitHub CLI authenticated when using the preferred CI artifact path;
- no unrelated local source changes;
- the intended pilot package id is `com.sport.athlete`.

## Preferred command

Use the exact CI release artifact for the local SHA:

```powershell
pwsh -NoProfile -File scripts/mobile-runtime-acceptance.ps1 -UseCiArtifact
```

When more than one Android device is online:

```powershell
pwsh -NoProfile -File scripts/mobile-runtime-acceptance.ps1 -UseCiArtifact -DeviceId <adb-serial>
```

If no successful exact-SHA CI runtime artifact exists, the explicit local-build fallback remains:

```powershell
pwsh -NoProfile -File scripts/mobile-runtime-acceptance.ps1
```

## Generated evidence

The harness writes:

```text
artifacts/mobile-runtime-acceptance/<sha>-<timestamp>/
  provenance.json
  emulator-audit.md
  acceptance-summary.md
  physical-signoff.md
  screenshots/
```

`provenance.json` binds the evidence to:

- Git SHA;
- branch;
- APK SHA-256;
- package/version identity;
- hashed device serial;
- device manufacturer/model/API/ABI;
- display size/density;
- font scale;
- brightness mode/value.

## Physical sequence

Use the exact installed artifact from the evidence bundle.

1. Start from the fresh first-use state produced by the harness.
2. Complete onboarding without explaining the UI to the reviewer.
3. Verify Home hierarchy and Start Ride discoverability.
4. Start a ride and move through the real Active Ride surface.
5. Test Active Ride outdoors, preferably including strong ambient light/direct sunlight where safe.
6. Use pause/resume/stop one-handed with the normal riding hand position.
7. Confirm STOP protection cannot be triggered casually.
8. Check map, metrics, GPS state and degraded/offline messaging.
9. Exercise a pending/failure completion state and compare it with durable success.
10. Re-run priority screens with enlarged Android font scale when practical.
11. Record observations and verdict in the generated `physical-signoff.md`.

Do not perform any riding interaction while operating a vehicle in motion. A walking/static outdoor check is sufficient for UI reach/readability evidence where cycling interaction would be unsafe.

## Mandatory PASS criteria

A PASS requires all of the following:

- first-use comprehension without coaching;
- Start Ride is obvious;
- Active Ride primary metrics remain glance-readable outdoors;
- primary controls are reachable and understandable one-handed;
- touch targets remain usable;
- enlarged text does not materially clip or hide critical controls;
- map/metric hierarchy remains legible;
- GPS/offline/sync/error states are truthful and visually distinct;
- Ride Summary pending/failure never impersonates durable success;
- no migrated production screen visibly regresses to routine arcade/RPG chrome.

## Verdict rules

### PASS

All mandatory checks pass on the exact artifact and the reviewer signs `physical-signoff.md`.

### FAIL

A product/UI defect is observed. Open the smallest focused follow-up issue with:

- exact SHA/artifact;
- device context;
- reproduction path;
- screenshot/photo when useful;
- expected vs actual behavior.

T84 remains BLOCKED/ACTIVE until the fix is merged and the affected physical check is repeated.

### BLOCKED

The physical test cannot be completed because of an external limitation such as:

- no Android device;
- no usable artifact;
- ADB authorization unavailable;
- environment cannot reproduce required outdoor/network state.

Record the smallest next action in `physical-signoff.md`. Do not convert BLOCKED into PASS.

## Completion boundary

T84 may be marked DONE only when the exact candidate artifact has:

1. `AUTOMATION_PASS`; and
2. a completed `physical-signoff.md` with **PASS**.

This physical acceptance does not automatically close T76 chaos/restart evidence or later T91 exact-RC validation unless the captured scenario explicitly satisfies those separate contracts.
