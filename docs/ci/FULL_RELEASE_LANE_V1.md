# Full / Release Validation lane

Status: **ACTIVE**

## Purpose

Routine pull requests use the lane-based change classifier and should pay only
for the checks their diff can affect. Heavyweight whole-system evidence lives
in one explicit Full / Release Validation workflow instead of being charged to
every PR.

The canonical workflow is `.github/workflows/full-release.yml`.

## Triggers

The lane runs:

- manually through `workflow_dispatch`;
- nightly on schedule;
- for release tags matching `v*.*.*`.

The ordinary `4VELO CI/CD Pipeline` no longer owns a nightly schedule. Pushes
to `main` still retain broad/full regression during staged rollout.

## Heavyweight evidence

The lane is fail-closed and requires all four proofs:

1. **Full monorepo regression** — canonical repository quality baseline on
   PostgreSQL/PostGIS + Redis with Python and pnpm dependencies installed.
2. **Full Android native smoke** — reusable Mobile Native Smoke, including
   clean Expo prebuild and `assembleDebug`.
3. **Home Lab configuration proof** — reusable home-lab control/crypto tests and
   layered Compose validation.
4. **Kubernetes + release proof** — reusable K8s manifest/build/release gate.

A final job named **Full Release Gate** succeeds only when every proof above
succeeds.

## Security boundaries

- The orchestrator has `contents: read` only.
- It does not inherit or request deployment secrets.
- It always calls the Kubernetes release workflow with `deploy_target: none`.
- The Kubernetes validation workflow itself does not need registry write access
  because its Docker builds use `push: false`.
- Production deployment and post-deploy Live Map smoke remain separate,
  explicit operational actions.

## Ownership of periodic checks

Periodic Android drift validation is owned by this nightly Full / Release lane.
The standalone Mobile Native Smoke remains:

- path-aware on pull requests;
- native-affecting on pushes to `main`;
- manually runnable;
- reusable by Full / Release Validation.

This prevents duplicate scheduled Gradle builds.

## Relationship to PR CI

`Aggregate CI gate` remains the authoritative merge gate for normal pull
requests. `Full Release Gate` is release/nightly evidence and must not become
an excuse to weaken change-classified PR coverage.

CI-core, unknown runtime, or ambiguous configuration changes still fail closed
to broad/full PR coverage.
