# 4VELO Mobile Runtime Acceptance v1

> **Status:** NORMATIVE acceptance checklist for major mobile UI slices  
> **Decision date:** 2026-09-24  
> **Related:** #149, #156, #157

## 1. Purpose

A mobile UI slice is not accepted because TypeScript compiles or screenshots look correct. Acceptance combines deterministic UI proof with exact-artifact runtime proof.

This document defines the minimum reusable gate. Individual issues may add stricter requirements.

## 2. Evidence identity

Every runtime report must state:

- Git SHA;
- branch/worktree;
- dirty/clean status and any pre-existing drift;
- Node and pnpm versions;
- Expo/React Native versions where relevant;
- Android device/emulator identity and API/ABI;
- package id;
- app version/runtimeVersion when release provenance is in scope;
- exact APK/dev-client artifact;
- Metro/bundle provenance.

No PASS may rely on an unidentified old installed app or old Metro bundle.

## 3. Static/repository gates

For affected mobile UI work:

- frozen install succeeds;
- lint succeeds;
- TypeScript succeeds;
- affected Jest/unit/integration tests succeed;
- Expo dependency/config checks succeed where affected;
- Mobile Visual Contract succeeds;
- security/release checks remain fail-closed;
- Aggregate CI gate succeeds.

A docs-only change may use its repository-defined affected-test path; it must not weaken gates to become green.

## 4. Deterministic UI gate

Major feature slices provide deterministic states that do not require live backend/GPS/native permissions merely to exercise presentation.

Required characteristics:

- same navigation contract as production;
- same controller interface as production;
- deterministic metric/state transitions;
- explicit loading/error/offline/terminal states;
- no production-looking fake data outside the gated fixture mode.

## 5. Emulator interaction gate

For the first Ride slice, the mandatory interaction path is:

```text
Home
-> Start
-> Active
-> Pause
-> Resume
-> Finish
-> Summary
-> Home
```

Evidence includes:

- exact tested SHA;
- screenshots from that runtime;
- interaction log or deterministic marker evidence;
- no hidden manual source/generated-tree edits.

## 6. Visual sign-off gate

Manual visual sign-off is required for major visual slices.

Review checks:

- Frozen UI hierarchy;
- typography and semantic color use;
- safe areas/status bar;
- touch target hierarchy;
- sunlight/readability for Active Ride;
- loading/empty/offline/error truth;
- absence of legacy arcade chrome in migrated routine UI;
- no unapproved generated art presented as production authority.

#147 and #153 remain manual visual-sign-off changes.

## 7. Durability gate

Do not repeat already accepted proofs unless the affected code invalidates them.

Accepted baseline includes physical evidence for:

- encrypted GPS payload recovery (#256);
- lost encryption-key fail-closed (#258);
- locked/background GPS durability and process relaunch continuity (#259).

A UI change that does not alter those contracts references the accepted evidence instead of rebuilding the proof harness.

Changes to storage, GPS lifecycle, encryption, background producer behavior or finalization semantics require targeted revalidation.

## 8. Terminal truth gate

For Ride completion:

- durable success renders success;
- pending finalization never renders full success;
- recovery/failure never renders full success;
- deterministic tests cover all terminal states;
- production result is derived from the existing durable services.

## 9. Native/release provenance gate

#156 owns canonical build provenance.

Release-grade acceptance requires a clean supported process that derives:

- package identity;
- version;
- runtimeVersion;
- channel/environment;
- native artifact provenance;

from repository sources of truth without proof-only generated-tree edits.

Until #156 closes, UI development may continue, but release sign-off remains open.

## 10. Canonical exact-SHA evidence command

For major mobile visual/runtime slices, prefer the already-validated release APK
published by the successful **Mobile Native Smoke** run for the exact local SHA:

```powershell
pwsh -NoProfile -File scripts/mobile-runtime-acceptance.ps1 -UseCiArtifact
```

This mode requires an authenticated GitHub CLI (`gh auth status`). It locates a
successful Native Smoke run whose `headSha` equals the clean local `HEAD`,
downloads `mobile-runtime-<run-id>`, verifies the manifest source SHA, workflow
run id and APK SHA-256, then skips dependency installation/native generation/
Gradle compilation. Only install + deterministic runtime interaction +
screenshots are performed locally.

The previous full local rebuild remains an explicit fallback:

```powershell
pwsh -NoProfile -File scripts/mobile-runtime-acceptance.ps1
```

When more than one Android device is online, select the intended target explicitly:

```powershell
pwsh -NoProfile -File scripts/mobile-runtime-acceptance.ps1 -DeviceId <adb-serial>
```

The command fails closed unless the worktree is clean. In `-UseCiArtifact`
mode it consumes the exact successful CI release artifact and verifies its
manifest/hash before installation. In fallback mode it performs clean native
generation, validates repository/native provenance and builds the release APK
locally. Both paths record artifact/package identity, run the deterministic
emulator interaction audit and verify the mandatory Ride screenshot sequence.

Evidence is written under the ignored local directory
`artifacts/mobile-runtime-acceptance/<sha>-<timestamp>/` and contains:

- `provenance.json` with Git/toolchain/device/artifact identity;
- `emulator-audit.md`;
- exact-runtime screenshots;
- `acceptance-summary.md` with the manual visual review checklist;\n- `physical-signoff.md` with the T84 real-device review sheet bound to the same exact SHA/artifact/device evidence.

`AUTOMATION_PASS` means the technical/runtime evidence is complete. It does
**not** replace the manual visual sign-off required by major visual slices.

## 10.1 T84 physical Android sign-off

T84 uses the exact artifact proven by this harness, but the final acceptance is deliberately human and physical.

The evidence bundle records the current device display characteristics (size, density, font scale and brightness mode/value) and generates `physical-signoff.md`.

The reviewer must exercise the exact identified artifact on a real Android device and record:

- first-use comprehension without coaching;
- outdoor/sunlight readability of Active Ride;
- one-handed reach and clarity of pause/resume/stop;
- touch target usability and text clipping at the tested font scale;
- map/metric readability;
- truthful offline/GPS/sync/error presentation;
- pending/failure vs durable-success distinction on Ride Summary;
- absence of routine legacy arcade/RPG chrome on migrated production screens.

The result is one of **PASS / FAIL / BLOCKED**. A screenshot-only review or emulator-only result cannot close T84.

## 10.2 T91 exact-RC real-device sign-off

T91 (#323) is the final mobile UI/runtime validation on one exact pilot release candidate.

Reuse the same canonical harness and evidence identity as T84:

```powershell
pwsh -NoProfile -File scripts/mobile-runtime-acceptance.ps1 -UseCiArtifact
```

T91 requires a real Android device and an explicit reviewer PASS against the exact candidate SHA/APK/device. The reviewer must cover the critical Home → Ride → Summary → Home journey plus truthful degraded GPS/offline and pending/failure finalization or sync states.

A prior T84 PASS may be referenced only when it was captured on the same exact SHA, APK hash and device, and its recorded scenarios satisfy the T91 checks. Otherwise repeat the missing checks. `AUTOMATION_PASS` or emulator screenshots alone cannot close T91.

The detailed procedure and verdict boundary are defined in `docs/quality/T91_EXACT_RC_VALIDATION.md`.

## 10.3 Lightweight Maestro visual proof

For a visual-composition review on an **already installed exact-SHA runtime**, use:

```powershell
pwsh -NoProfile -File scripts/mobile-visual-proof.ps1
```

This path is intentionally lighter than full runtime acceptance:

- requires a clean checkout and records the exact Git HEAD;
- runs only `mobile/.maestro/flows/visual-proof-ride.yaml`;
- captures mandatory Today → Start → Active → Pause → Summary states;
- uses stable automation IDs rather than localized text selectors;
- writes Maestro artifacts under an explicit `--test-output-dir`;
- copies the five canonical PNGs into a stable evidence directory;
- computes SHA-256 and byte size for every screenshot;
- writes a machine-readable `manifest.json` bound to source SHA;
- **does not** run dependency installation, Expo prebuild, Gradle, EAS, or APK compilation.

Evidence is local/ignored by default:

```text
artifacts/mobile-visual-proof/<sha>-<timestamp>/
  manifest.json
  screenshots/
    01_today.png
    02_start.png
    03_active.png
    04_paused.png
    05_summary.png
  maestro/
    ...
```

This proof is for fast visual review and PR evidence. It does not replace T84/T91 physical-device sign-off or the full release/runtime provenance gate when those are required.

## 11. Failure classification

Runtime results use only:

- **PASS** — required evidence exists and acceptance is met;
- **FAIL** — tested behavior is wrong;
- **BLOCKED** — acceptance could not be executed because of an external/environmental blocker.

A BLOCKED result must state what was proven before the block and the smallest next action.

## 12. Merge rule

A major visual slice merges only when its issue-specific required gates are green and manual visual sign-off is recorded.

Non-visual architecture/docs work may merge after normal repository review/CI if it does not change runtime behavior.
