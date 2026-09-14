# Pre-release verification

| | |
|--|--|
| **Status** | Active |
| **Owner role** | Release owner |
| **Last reviewed** | 2026-09-10 |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/PRE_RELEASE_VERIFICATION.md) |
| **canonical_path** | docs/en/operations/PRE_RELEASE_VERIFICATION.md |

This is the release decision record for the current home-lab-first phase. Railway and
Kubernetes are deployment options, not evidence that the application is ready.

## Candidate identity

Record the candidate commit SHA, image tags, database migration range, operator, test
date and backup filename. Never release from an uncommitted working tree or mutable
image tag.

## Required gates

1. Run `python scripts/release/pre_release_check.py` from the repository root.
2. Require all blocking checks on the exact candidate SHA to pass. A skipped,
   cancelled or non-blocking security inventory is not a passing check.
3. In the home lab, run `python scripts/home_lab.py up`, then
   `python scripts/home_lab.py check`.
4. Exercise: login, create a tenant user, store an activity, ingest GPS with a valid
   JWT, observe a Celery task, and confirm the result in admin.
5. Run `python scripts/home_lab.py backup` and verify the produced file with
   `python scripts/home_lab.py verify-restore <file>`.
6. Review pending migrations with `python manage.py showmigrations --plan` and
   `python manage.py makemigrations --check --dry-run`. Apply them only to the lab
   before production.
7. Record a GO/NO-GO decision. Missing restore evidence, red E2E, unknown signing
   keys, or unreviewed destructive migrations mean NO-GO.

## Rollback contract

Before deployment, record the previous immutable image tags and database backup.
Application rollback means redeploying those tags. Database rollback means restoring
the verified backup into a separate database first, validating it, then switching the
application during a maintenance window. Do not reverse a destructive migration
without a migration-specific, tested reverse operation.

After rollback, run backend and telemetry health checks, login, read one known
activity, enqueue one harmless Celery task, and confirm admin visibility. Record the
time, operator and result.

## Moving the same candidate to Railway later

Promote the already tested immutable images. Configure Railway secrets externally,
rotate any key previously committed to Git, attach persistent Postgres/Redis, run the
same migration plan and smoke path, and verify provider backup/restore separately.
Do not seed demo data. Railway readiness remains blocked until its signing key,
backup policy, health checks and rollback permissions are verified in that account.
