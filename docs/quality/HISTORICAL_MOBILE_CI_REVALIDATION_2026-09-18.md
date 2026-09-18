# Historical Mobile CI Revalidation — 2026-09-18

## Purpose

During a large part of the takeover, the standard Mobile CI job invoked:

```bash
pnpm --filter mobile lint
pnpm --filter mobile typecheck
pnpm --filter mobile test
```

while `mobile/package.json` declares the package name `4velo`. The filter therefore did not identify the mobile workspace reliably and historical green Mobile jobs from that period are not accepted as evidence that lint, TypeScript and Jest actually ran.

This report scopes and closes that evidence gap without replaying every historical SHA.

## Historical scope

From T00 through the CI repair, ten merged PRs changed `mobile/**` and therefore require retrospective mobile evidence:

| PR | Area | Revalidation coverage |
| --- | --- | --- |
| #85 | pilot-local EAS profile | `pilotLocalConfig.test.ts` + full lint/typecheck/Jest |
| #86 | Android cleartext pilot config | `cleartextTrafficPluginManifest.test.ts`, `pilotLocalConfig.test.ts` + full lint/typecheck/Jest |
| #88 | pilot-local dev-client prerequisites, Firebase gating, scene/i18n additions | `pilotLocalConfig.test.ts`, Firebase config tests, visual/asset contracts, lint/typecheck + full Jest |
| #89 | activity-scoped telemetry auth for API/HTTP/WS ingest | `apiClient.telemetry-token.test.ts` plus PR #119 HTTP/WS propagation regression tests |
| #90 | Firebase platform file gating | `firebasePlatformConfig.test.ts`, `firebasePlatformArtifacts.test.ts`, `pilotLocalConfig.test.ts` |
| #92 | auth/onboarding redesign | auth registration/onboarding model plus current `AuthScreen.test.tsx` and `OnboardingScreen.test.tsx` |
| #94 | GPS queue, ACK, finalization, sync durability | GPS activity queue, ingest ACK, finalization and sync-storage suites |
| #106 | encrypted GPS storage and local export | `gpsEncryptedStorage.test.ts`, `gpsLocalExport.test.ts` plus full lint/typecheck/Jest |
| #109 | mobile PII/secret/GPS redaction and Firebase sink integration | redaction unit suite plus PR #119 direct FirebaseService sink-boundary tests |
| #112 | critical-write/session idempotency durability | `sessionDurability.t74.test.ts` plus full lint/typecheck/Jest |

Closed/unmerged PRs are intentionally excluded because their code is not present in `main`. Non-mobile PRs are also excluded because the historical defect affected the standard Mobile job, not independent backend/telemetry/admin/scripts gates.

## Cumulative full-suite evidence

PR #116 used the corrected directory-based commands and completed the real mobile job successfully.

GitHub Actions evidence:

- workflow run: `35336981479`
- Mobile job: `105574494807`
- `pnpm --dir mobile lint`: executed successfully; 0 lint errors (warnings remained non-blocking)
- `pnpm --dir mobile typecheck`: executed `tsc --noEmit` successfully
- `pnpm --dir mobile test -- --ci --forceExit`: executed the full Jest suite
- Jest result: **37/37 suites passed, 201/201 tests passed**
- the workspace selector integrity guard also passed

The Jest log explicitly states `Ran all test suites.`

PR #117 changed no `mobile/**` files, so the mobile application tree merged by #116 remained the cumulative mobile tree on `main` before the regression tests added by PR #119.

## Gaps discovered during revalidation

The full green suite exposed two historical coverage gaps rather than implementation failures:

1. **#89 telemetry auth propagation** — the helper that obtains the scoped token was tested, but there was no direct regression test proving the token reaches the HTTP Authorization header or the WebSocket handshake URL.
2. **#109 Firebase sink boundary** — the sanitizer itself was well tested, but there was no direct test proving `FirebaseService` passes only sanitized values to Crashlytics/analytics.

PR #119 adds regression tests for both boundaries without changing application behavior.

## Acceptance

Historical mobile CI is considered revalidated when PR #119 passes the corrected Mobile gate, including its new regression tests. The historical green status of the old `pnpm --filter mobile` jobs must not be cited as evidence; this report plus the corrected full-suite run and PR #119 are the replacement evidence.

A separate physical-device/home-lab matrix remains required where the takeover plan explicitly asks for runtime Android evidence; this revalidation does not substitute for T76 physical-device proof.
