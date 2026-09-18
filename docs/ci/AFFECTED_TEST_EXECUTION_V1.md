# T94 — Affected Test / Risk-Tiered Selective Execution

**Status:** implementation contract  
**Goal:** shorten pull-request feedback without reducing regression confidence.

## Policy

PRs use the smallest test set that can be justified from deterministic changed-file classification.

Pushes to protected branches and scheduled runs remain broad/full.

The fail-safe invariant is absolute:

> **If the planner cannot prove that a narrower test set is safe, it selects FULL, never SKIP.**

## Risk tiers

| Tier | Typical change | PR execution |
| --- | --- | --- |
| R0 | documentation/non-runtime | docs/governance only |
| R1 | isolated mobile leaf/component | related Jest tests + mandatory suites |
| R2 | bounded feature/domain | domain tests |
| R3 | shared mobile/theme/package surface | full affected application |
| R4 | auth/security/tenant/telemetry/GPS/migration/high-risk | mandatory safety suites or full component |
| R5 | CI core/shared infrastructure/unknown impact | repo-wide FULL fallback |

## Mobile

Low-risk source changes use Jest `--findRelatedTests`.

Changed test files run directly.

Protected areas add mandatory suites even when Jest's graph is narrower:

- GPS durability;
- ride safety;
- auth/session;
- asset identity;
- i18n catalog.

Navigation, state, theme, design-contract, bootstrap, API-client and mobile build/config changes run the full mobile Jest suite.

ESLint, TypeScript and visual-contract checks stay broad; T94 optimises test execution, not static correctness.

## Backend

Backend selection is explicit and domain-based rather than speculative Python import analysis.

Known bounded suites include:

- activity durability;
- tenant isolation;
- GPX data;
- simulator-light;
- live map;
- data lifecycle;
- users;
- clubs;
- rewards;
- events;
- wearables.

Core/shared infrastructure, migrations, models and broad activity service/view/serializer surfaces fail safe to FULL backend critical coverage.

The existing PostGIS RLS test remains a dedicated real-PostgreSQL command whenever the planner requires `rls`.

## Other components

Telemetry remains full-component because it is pilot-critical.

Admin remains full-component for now; its test suite is small enough that a finer-grained selector is not yet justified.

Shared JS/package changes run full mobile + admin coverage.

## Main/nightly

Selective PR execution never replaces broad regression:

- push to main/develop/master → broad/full;
- scheduled/nightly → broad/full;
- T92 exact-SHA pre-pilot regression → full regardless of T94.

## Auditability

Every CI run prints a Markdown plan with:

- changed-file count;
- risk tier;
- component mode;
- mandatory suites;
- reasons for narrowing or FULL fallback.

The planner and both runners have unit tests. Unknown planner modes/suite IDs fail safe to full commands.
