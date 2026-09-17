# 4VELO — Takeover Data Safety & Disaster Recovery Extension

**Status:** Required takeover hardening package  
**Scope:** Pilot and production data safety, backup, restore, disaster recovery, auditability, secrets, observability  
**Applies to:** P3 remediation gate, T57, release/rollback readiness and production operations

## 1. Purpose

This document extends the takeover plan with an explicit Data Safety / Disaster Recovery package. The goal is not merely to have backups, but to prove that 4VELO can survive operator error, data corruption, infrastructure loss, secret compromise and partial service failure without silent business-data loss or cross-tenant corruption.

The package is additive to the current P3 Pilot Data Safety Audit. Existing P3 blockers and acceptance criteria remain authoritative. This document defines the additional operational and recovery controls required to close the takeover safely.

## 2. Core recovery principle

A backup is not considered valid evidence until it has been restored into an isolated target and critical business invariants have been verified.

A successful restore must prove, at minimum:

- users and tenants are present and correctly related;
- roles, departments and memberships are intact;
- activities and PostGIS route geometry are intact;
- GPS points are complete, correctly ordered and still belong to the correct user/activity/tenant;
- audit records are present and consistent;
- critical derived state can be rebuilt or verified;
- foreign-key and ownership invariants still hold;
- the restored application can complete critical read/write paths.

## 3. Backup architecture

### 3.1 PostgreSQL / PostGIS / TimescaleDB

Required target architecture:

1. Daily logical backup using `pg_dump --format=custom` as an independent recovery layer.
2. Physical base backup plus continuous WAL archiving so Point-In-Time Recovery (PITR) can be performed.
3. Backup storage in encrypted S3-compatible object storage or an equivalent provider.
4. A second off-site copy stored separately from the primary production account/provider where practical.
5. At least one immutable/WORM copy using Object Lock or an equivalent retention mechanism.
6. Explicit retention rules for full backups, WAL and restore-test artifacts.
7. Backup tooling must fail closed and expose backup freshness and integrity to monitoring.

For distributed Citus deployments, backup/restore must be designed and tested for the complete coordinator/worker topology. A single-node PostgreSQL backup must not be treated as proof of recoverability for the distributed cluster.

### 3.2 Media and exported files

User media, GPX/export artifacts and other non-database state required for a complete restore must have:

- versioning where supported;
- encrypted storage;
- documented retention;
- off-site or cross-account replication where justified;
- restore procedures tested independently of the database.

### 3.3 Redis

Redis must not be the sole durable copy of any data whose loss would represent user/business-data loss.

Cache, sessions and rebuildable leaderboards may remain disposable. Durable telemetry acknowledgement may only rely on Redis after persistence, replay, restart, trimming and dead-letter behaviour have been proven. Until then, pilot acknowledgement remains DB-backed.

## 4. Backup integrity manifest

Before an integrity test backup, the environment must generate a deterministic manifest of critical business state. Example fields:

```text
users_count
tenants_count
memberships_count
activities_count
gps_points_count
audit_events_count
activity_route_sha256
gps_activity_sha256
critical_rows_sha256
```

After restore, the same manifest must be recomputed and compared.

A restore is PASS only if critical counts, ownership relations, route/GPS hashes and defined invariants match expected values. Merely starting PostgreSQL or finding `django_migrations` is insufficient.

## 5. RPO / RTO

T57 must become an evidence-producing recovery exercise rather than a dump-only task.

Initial takeover target remains compatible with the current cleanup plan:

- RPO <= 24 h;
- RTO <= 4 h.

For the pilot and production design, measure the actual values and improve them where practical. Preferred engineering targets for critical production data are:

- PostgreSQL RPO <= 5 minutes once continuous WAL/PITR is operational;
- critical API RTO <= 1 hour after the recovery procedure is mature.

These preferred values are design goals, not assumed capabilities. Actual measured RPO/RTO must be recorded as evidence.

RPO evidence must state the newest recoverable point. RTO evidence must measure elapsed time from declared recovery start until the critical application path is functional and integrity checks pass.

## 6. T57 / P3-G expanded acceptance criteria

The backup/restore slice is complete only when all of the following are demonstrated on isolated synthetic data:

1. Seed at least two tenants.
2. Seed users and roles for both tenants.
3. Seed departments/memberships or equivalent pilot-critical relationships.
4. Seed activities with PostGIS route geometry.
5. Seed representative GPS points.
6. Seed audit records and pilot-critical derived state.
7. Record pre-backup counts, hashes and ownership invariants.
8. Create a production-equivalent backup artifact.
9. Restore into a fresh disposable target.
10. Recompute and compare the integrity manifest.
11. Verify tenant isolation after restore with negative cross-tenant tests.
12. Verify a critical login/read/write application path.
13. Record actual RPO and RTO.
14. Prove restore does not depend on undocumented operator knowledge or untracked local files.
15. Store the recovery report without secret material.

## 7. Immutable and off-site recovery

A production-ready deployment should follow a 3-2-1-1-0-style recovery strategy:

- 3 copies of critical data;
- 2 independent storage forms/locations;
- 1 off-site copy;
- 1 immutable or otherwise protected copy;
- 0 undetected restore/integrity errors in the latest validation.

Backup credentials must not share an unnecessarily broad trust boundary with production credentials. Where possible, production may write backup data without having permission to delete immutable historical backups.

## 8. Audit-log hardening

The current takeover must treat audit evidence as security-critical data.

Required direction:

- application path is INSERT-only for audit records;
- runtime DB role must not have ordinary UPDATE/DELETE permission over audit history;
- destructive audit mutation should be blocked by database permissions/policy and covered by tests;
- critical admin, membership, impersonation, account and destructive mutations must emit audit events;
- retention must be explicit;
- optional tamper-evidence may use a hash chain such as `hash_n = SHA256(hash_n-1 + canonical_event_n)`;
- production-grade deployments should consider an external immutable copy of security audit events.

## 9. Secret and identity recovery

Takeover recovery must include more than data files.

Maintain an inventory and tested recovery procedure for:

- application signing keys;
- JWT/telemetry signing material;
- database credentials;
- OAuth provider credentials;
- object-storage credentials;
- DNS/domain access;
- TLS/certificate configuration;
- container registry access;
- Railway/cloud provider access;
- GitHub repository/CI access.

Previously exposed keys must be proven never active or rotated/revoked. Recovery documentation must record identifiers and timestamps, never secret values.

## 10. Database and worker hardening

Before pilot completion:

- separate runtime, migration and administrative DB responsibilities where practical;
- runtime roles must not have `SUPERUSER` or `BYPASSRLS`;
- Celery and management commands must explicitly establish and clear tenant context for every pilot-critical path;
- tests must prove that worker reuse cannot leak tenant context between jobs;
- migrations must run in a controlled pre-deployment phase rather than racing across scaled application containers.

## 11. Device data protection

Critical GPS data retained locally on mobile must be encrypted at rest using a key protected through Android Keystore / Expo SecureStore or an equivalent mechanism compatible with background operation.

Device tests must cover:

- locked screen;
- background recording;
- process kill/relaunch;
- offline recording and reconnect;
- logout and key/data cleanup;
- pending unsent GPS remaining recoverable until durable server ACK.

## 12. Logging and redaction

All logging sinks must share a central redaction contract.

No production logs, Sentry events or diagnostics may expose:

- access/refresh/JWT/OAuth tokens;
- authorization headers;
- signing keys or secrets;
- raw private GPS coordinates where not explicitly required;
- sensitive PII beyond the defined operational need.

Add canary tests that inject fake secrets/tokens/GPS values and assert that they cannot appear unredacted in captured logs or error reports.

## 13. Delete/export/retention contract

Define a single lifecycle policy for:

- raw GPS points;
- derived route geometry;
- account/profile data;
- audit logs;
- exports;
- caches;
- media;
- backups.

Account deletion must document which data is immediately deleted, anonymized, retained for a legitimate purpose, or allowed to expire from immutable backups according to retention policy.

User export must use the canonical reconciled source of truth and must not silently omit telemetry that exists only in durable GPS storage.

## 14. Monitoring and recovery observability

Production monitoring must include data-safety signals, not only CPU and HTTP failures.

At minimum expose/alert on:

- `last_successful_backup_age`;
- `last_wal_archived_age`;
- `last_restore_test_age`;
- `last_restore_test_success`;
- measured `restore_rpo_seconds`;
- measured `restore_rto_seconds`;
- backup integrity/size anomalies;
- `route_reconciliation_failures`;
- `gps_pending_oldest_age`;
- durable ACK failures;
- tenant-scope violation signals;
- audit-integrity failures.

A job reporting success while producing an empty/corrupt/unrestorable backup is an operational failure and must be detectable.

## 15. Disaster Day / recovery drill

The takeover must introduce a recurring recovery exercise using an isolated environment.

Assume production has been lost and rebuild the service from documented assets only:

1. infrastructure/environment;
2. database;
3. media/object storage;
4. required secrets from the approved secret store;
5. application images/build artifacts;
6. workers/background jobs;
7. monitoring;
8. DNS/TLS only when included in the exercise scope.

The drill must reveal and eliminate hidden dependencies such as credentials stored on one operator laptop, missing environment variables, unrecoverable container images, undocumented DNS ownership or restore procedures that require tribal knowledge.

Each drill records:

- scope;
- start/end timestamps;
- measured RPO/RTO;
- failed/missing steps;
- integrity results;
- corrective actions.

## 16. Release-gate integration

P3/T57 security and recovery checks must feed the release gate.

Release readiness fails closed when any required evidence is stale or missing, including:

- backup freshness outside policy;
- failed latest restore test;
- unresolved P0 data-safety blocker;
- unresolved runtime HIGH/CRITICAL dependency finding without explicit policy disposition;
- missing secret-rotation evidence where required;
- missing tenant-isolation evidence for the pilot path;
- missing Android durability evidence for pilot-critical GPS flows.

## 17. Takeover completion condition

The takeover must not describe 4VELO as recovery-ready solely because backups exist.

Recovery readiness requires evidence that:

1. critical data is backed up automatically;
2. at least one protected copy survives loss or compromise of the primary production environment;
3. the application can be restored to an isolated clean target;
4. business-data integrity and tenant ownership survive the restore;
5. actual RPO/RTO are measured;
6. secrets, infrastructure access and deployable artifacts are recoverable;
7. the process is documented and repeatable by someone other than the original operator;
8. recovery is exercised periodically.

This document is part of the takeover acceptance criteria and should be referenced by `TAKEOVER_CLEANUP_PLAN.md`, `PARTIAL_TAKEOVER_PILOT_PLAN.md`, the P3 data-safety audit and the release/rollback runbooks.
