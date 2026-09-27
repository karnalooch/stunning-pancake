# 4VELO change classifier and CI lanes

Status: **ACTIVE / staged rollout**

## Goal

Pull requests should run the smallest trustworthy CI surface for the files they
actually change. Classification is fail-closed: unknown runtime/configuration
surfaces still expand to broad/full coverage.

The canonical classifier lives in `scripts/plan_affected_tests.py`. GitHub
Actions consumes its outputs; path filters remain only as component discovery
and compatibility helpers.

## Pull-request lanes

| Change class | Required CI surface |
| --- | --- |
| Docs / repository policy only | Affected Test Plan, documentation/governance checks when applicable, Dependency Review, Aggregate CI |
| Python backend / telemetry / scripts | relevant Python component tests + CodeQL Python |
| JavaScript / TypeScript | relevant Admin/Mobile/Packages tests + CodeQL JavaScript/TypeScript |
| Mobile UI code | Mobile runtime lane + Visual Contract + CodeQL JavaScript/TypeScript |
| Mobile asset-only | asset governance / visual authority + asset contract test; no full Mobile runtime lane, Metro bundle, or Android Gradle build |
| Mobile native-affecting | Mobile runtime lane + cost-aware Mobile Native Smoke; full Android compile remains fail-closed |
| Code + assets | union of the runtime and visual/asset lanes |
| CI core / unknown runtime / infrastructure | broad/full fallback |

## Mobile native-affecting inputs

The classifier treats the following as native-affecting:

- Expo/EAS/app configuration;
- `mobile/package.json`;
- committed `mobile/android/**`, `mobile/ios/**`, and `mobile/plugins/**`;
- Google Services platform files;
- build-time icon/splash/adaptive-icon inputs;
- workspace/package-manager manifests and product versioning;
- native provenance scripts and the Native Smoke workflow;
- the canonical pnpm setup action.

These changes keep the full `expo prebuild --clean` + `gradlew assembleDebug`
gate. Ordinary JS/UI, test, and approved raster asset changes do not.

## CodeQL routing

Python and JavaScript/TypeScript analysis are separate execution lanes.
A stable `CodeQL SAST` gate validates the expected language-specific jobs so
Aggregate CI and branch protection retain one deterministic contract.

Examples:

- Django-only PR -> CodeQL Python, not CodeQL JS/TS.
- Admin-only PR -> CodeQL JS/TS, not CodeQL Python.
- mixed backend + mobile PR -> both language lanes.
- docs-only / asset-only PR -> no runtime CodeQL lane unless another changed
  path requires it.

## Visual and asset routing

`visual` is intentionally narrower than `mobile/**`. It covers visual UI
surfaces, tokens, governed assets, and design/visual authority contracts.

An asset-only PR uses the lightweight branch inside `Mobile Visual Contract`:
asset governance, visual authority, and the asset-governance Jest contract.
It skips the full Mobile TypeScript/theme foundation work. It also does not
enter the regular Mobile runtime job.

## Full / release validation

During the initial rollout, push-to-`main` and scheduled CI retain the existing
broad/full regression as a safety net. After the classifier has accumulated
clean evidence, the target architecture is to move expensive full validation
into an explicit `full/release` lane triggered by:

- manual dispatch;
- nightly schedule;
- release/tag preparation.

That lane is the 4VELO equivalent of a game project's full asset/map/cook
validation: full backend/telemetry/admin/mobile regression, E2E, native build,
security scans and release/home-lab evidence. It should not be charged to every
routine pull request.

## Fail-closed rules

- CI-core changes run broad/full coverage.
- Unknown runtime/config paths run broad/full coverage.
- Mixed changes take the union of all matching lanes.
- Skipped expected language/native lanes fail their stable aggregate gate.
- Branch protection and `Aggregate CI gate` remain authoritative.
