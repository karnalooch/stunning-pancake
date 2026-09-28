# T92 — exact-SHA full pre-pilot regression

**Status:** IMPLEMENTATION IN PROGRESS — issue #330  
**Prerequisites:** T58 PASS on the same candidate and T91 real-device PASS  
**Scope:** one exact candidate SHA reachable from protected `main`

## Purpose

T92 is the last automated full-regression proof before the release-candidate declaration.
It deliberately ignores the T94 affected-test optimisation. T94 remains the fast pull-request
path; T92 is the expensive, manual, exact-candidate path.

T92 does not deploy anything and does not replace the T91 physical Android verdict.

## Canonical entrypoint

Run the GitHub Actions workflow:

`T92 Exact-SHA Pre-Pilot Regression`

with:

- `candidate_sha` — the full 40-character lowercase SHA of the candidate on protected `main`;
- `reason` — optional human note visible only in the workflow dispatch metadata. It is not written to the machine-readable T92 evidence.

Do not use a branch name, short SHA or unmerged PR head.

## Gate structure

### 1. Exact candidate + T58 preflight

Before heavyweight work begins, T92:

1. checks out the exact `candidate_sha`;
2. rejects malformed/non-40-character SHA input;
3. proves `git rev-parse HEAD == candidate_sha`;
4. proves the candidate is reachable from `origin/main`;
5. runs `python scripts/release/pre_release_check.py --pilot` on that exact checkout.

If T58 is still NO-GO, T92 stops here. This prevents an expensive green regression from
being mistaken for pilot readiness while owner/device/real-environment evidence is missing.

### 2. Exact-SHA Full Release matrix

T92 reuses `.github/workflows/full-release.yml` and passes the candidate SHA explicitly
through the reusable workflow boundary.

The same SHA is propagated to:

- Mobile Native Smoke — release APK + exact-SHA runtime artifact;
- Home Lab — canonical cold-start to `DEV ENV READY`;
- Kubernetes Release Gate — build/test, images, manifest validation and reliability gate;
- Full monorepo quality baseline — backend/telemetry/script/docs/mobile/admin/token checks.

The reusable workflows keep their existing PR/push behaviour when `source_sha` is omitted.

### 3. Deep application regression

In parallel with Full Release, T92 executes non-selective application regression on the same
candidate:

- full Django legacy suite with PostGIS + Redis;
- Admin ESLint + TypeScript + all Vitest unit tests + production bundle;
- Admin Chromium Playwright E2E on a managed preview server.

There is no call to the T94 affected-test planner or affected-test runners in this lane.

## Evidence

The final `T92 Exact-SHA Gate` writes:

`artifacts/t92/t92-exact-sha-<candidate-sha>.json`

and uploads it as:

`t92-exact-sha-<workflow-run-id>`

The JSON is secret-free by construction and records:

- exact candidate SHA;
- repository;
- workflow run ID;
- preflight result;
- deep exact-regression result;
- reusable Full Release result;
- `t94_selective_execution_used=false`;
- `deployment_performed=false`;
- final PASS/FAIL and UTC timestamp.

Only three `success` lane results produce `overall_status=PASS`.

## Failure semantics

T92 is **FAIL** when any required lane fails, is cancelled or is skipped. Missing evidence
does not become PASS. T92 remains **BLOCKED** when its prerequisites are not complete.

A T92 PASS is necessary for T59 release-candidate declaration, but it is not itself T59 and
does not authorize production deployment.
