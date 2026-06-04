# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../runbooks/db_recovery.md) |
| **canonical_path** | docs/en/runbooks/db_recovery.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator / DBA |
| **Last reviewed** | 2026-06-03 |
| **Audience** | On-call, DevOps |
| **Target** | Restoring platform consistency after a critical DB cluster failure (Citus/Postgres). |

---

## Prerequisites

| Requirement | Notes |
|-----------|--------|
| Access to backups | S3 / object storage - **without** pasting keys in docs |
| `aws` /storage tool | Bucket list in line with company policy |
| Producer permissions | Railway / hosting - on-call roles only |
| Communication | Incident channel (not in repo) |

**Related:** [DISK_GUARD.md](../DISK_GUARD.md) · [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) · [operations/OPERATIONS_INDEX.md](../operations/OPERATIONS_INDEX.md)

---

## Procedure

### 1. Ingestion isolation (role: Platform Operator)

Stop accepting new telemetry to avoid inconsistencies.```bash
# Przykład: LB zwraca 503 dla /api/telemetry
nginx -s reload
```### 2. Verification of the last backup (role: Platform Operator)```bash
aws s3 ls s3://sport-backups/citus-main/
```Confirm the timestamp of the last snapshot before restore.

### 3. Restore coordinator (role: DBA)

Launch a new Citus coordinator instance from the last snapshot (hosting-specific procedure).

### 4. Re-attacking workers (role: DBA)

If the workers' data has survived, connect it to a new coordinator; otherwise restore scattered.

### 5. Integrity validation (role: Platform Operator)```bash
python manage.py check_db_integrity --env production
```### 6. Traffic restoration (role: Platform Operator)

Canary rollout: telemetry first, user API second.

---

## Verification

- [ ] `check_db_integrity` without fatal errors
- [ ] Sample login + read `users` / `participations`
- [ ] Monitoring: no 5xx spike after enabling traffic

---

##Rollback

If restore is broken: **don't** enable full traffic; go back to the previous snapshot or freeze the platform (503) until the second restore.

---

## Troubleshooting

| Symptom | Reason | Action |
|-------|-----------|--------|
| Users vs participations inconsistency | Partial restore | Revalidate; restore from earlier snapshot |
| Telemetry "doubles" the failure period | Ingestia turned on too early | Re-isolation of ingestia |
| No backup in S3 | Retention/job error | Hosting escalation; DR according to SLA |

---

## Emergency contact

- On-call: company channel (do not commit numbers in the repo)
- Hosting: Railway / AWS Priority Support - according to the agreement
