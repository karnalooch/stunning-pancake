# 4VELO takeover baseline — 2026-09-08

## Executive status

The repository is a substantial multi-service product, not a clean release candidate. The immediate takeover goal is to make its startup safe, restore trustworthy quality gates and reduce the gap between documentation and verified behavior.

## Verified in this pass

| Check | Result | Notes |
|---|---|---|
| Documentation links | Pass | 305 active Markdown files checked; archives intentionally excluded |
| Documentation language registry | Pass | 53 pairs and 28 English-only entries |
| Critical OpenAPI documentation | Pass with warning | Nine critical paths documented; telemetry proxy wiring still needs Swagger verification |
| Admin ESLint | Pass with debt | 0 errors, 108 warnings |
| Admin TypeScript | Pass | `tsc --noEmit` |
| Admin unit tests | Partial | 38 suites and 136 tests passed; two suites could not resolve Mantine after the dependency download was interrupted |
| Docker entrypoint syntax | Pass | `sh -n backend/docker-entrypoint.sh` |
| Changed Python syntax | Pass | `compileall` on changed Python modules |
| Full Docker stack | Not run | Docker is unavailable in the audit environment |
| Backend/telemetry test suites | Not run | Python service dependencies and PostGIS/Redis were unavailable |
| Mobile checks | Not run | The workspace dependency installation did not finish |

## Changes made

- Production startup no longer seeds demo data by default.
- Existing owner passwords are no longer reset by `seed_data.py`.
- Built-in weak owner passwords were removed and rejected during initial creation.
- Duplicate `create_admin` management command was removed.
- Admin lint no longer enables React Compiler-only rules before adopting React Compiler.
- Real redundant boolean logic in Live Map health parsing was simplified.
- Broken active documentation links, repository URLs, Node requirements and API drift were corrected.
- A new-owner entry point was added at `docs/PROJECT_TAKEOVER.md`.

## Next gate

Run a clean `pnpm install --frozen-lockfile` with Node 20 and the full CI workflow. Then start an isolated Compose environment and verify the critical journey: authentication, activity creation/sync, telemetry ingest and admin moderation. Do not promote the current branch to production before those checks and a secrets/account ownership inventory.
