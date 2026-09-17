# T72 — delete, export and retention contract

Status: implementation contract for takeover tranche T72 / DS-018, DS-019 and DS-020.

## Retention classes

- Raw privacy-filtered telemetry in `gps_points`: **30 days** from point time.
- Durable ingest receipts: **30 days** from `acked_at`; after that they are no longer needed to prove a ride that has already passed durable finalization.
- `Activity.route_path`: retained with the activity as the derived canonical route. It is not raw telemetry and is deleted with the owning activity/account.
- User export archives: application access expires at the existing export TTL (24 hours by default); the daily retention task removes the materialized object and tracking row after expiry.
- `AuditLog`: not shortened by T72. It remains governed by the append-only T70 security contract.
- Backups: T72 does not pretend active-database deletion instantly rewrites historical backup media. Backup retention, encryption and disposal are a T75/P3-G operational contract. A restore must re-apply the active retention/deletion policy before restored data can become a live system.

## Account deletion

Deleting a Django `User` must also remove personal data that Django foreign-key cascades cannot see:

1. materialized RODO export objects are removed first;
2. raw `gps_points` rows for the user are deleted;
3. `telemetry_ingest_receipts` rows for the user are deleted;
4. the normal Django user cascade then deletes owned application rows such as activities and export-job records.

Storage deletion is fail-closed for account deletion: if an external export object cannot be removed, the user-row deletion aborts rather than claiming complete deletion while a private archive remains materialized.

The hook is registered on `pre_delete(User)`, so admin/API/programmatic user deletion follows the same lifecycle rather than relying only on one REST view.

## User export

The RODO ZIP contains:

- `profile.json`;
- `manifest.json` describing source/retention semantics;
- `raw_gps.json` containing privacy-filtered `gps_points` still inside the 30-day retention window;
- one metadata JSON file for every activity (no 200-activity truncation);
- GPX for each activity that has a canonical `Activity.route_path`.

`Activity.route_path` is the canonical derived ride route established by T63 durable reconciliation/finalization. Raw retained telemetry is exported separately so the archive does not silently confuse raw retained GPS with the derived canonical route.

## Enforcement

`users.tasks.enforce_data_retention` runs daily through Celery Beat on the default queue. It removes expired export objects/rows and raw GPS/receipt rows older than 30 days. Failed export-object deletion keeps its DB tracking row so a later run can retry instead of orphaning a private archive.

Operators can also run:

```bash
python manage.py enforce_data_retention
```

for explicit/manual enforcement and recovery.

## Boundaries

T72 does not change T70 audit immutability, define backup-media encryption/retention (T75), or prove physical Android/home-lab failure behavior (T76). Cache review found no durable account/GPS cache that extends the retention boundary; ephemeral authentication/reset and UI caches retain their existing short TTLs and are not canonical personal-data stores.
