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

## 10. Failure classification

Runtime results use only:

- **PASS** — required evidence exists and acceptance is met;
- **FAIL** — tested behavior is wrong;
- **BLOCKED** — acceptance could not be executed because of an external/environmental blocker.

A BLOCKED result must state what was proven before the block and the smallest next action.

## 11. Merge rule

A major visual slice merges only when its issue-specific required gates are green and manual visual sign-off is recorded.

Non-visual architecture/docs work may merge after normal repository review/CI if it does not change runtime behavior.
