# T70 — Audit log append-only / integrity contract

Status: implementation contract for takeover tranche T70.

## Goal

The runtime audit trail is an append-only security record. Normal application code, REST surfaces and Django admin may create/read audit rows, but they may not rewrite or delete existing rows.

This tranche does **not** claim that a PostgreSQL superuser or a host/root operator cannot tamper with the database. Runtime-role/database hardening belongs to T73. Retention/deletion policy across production data and backups belongs to T72.

## Runtime mutation contract

Allowed by default:

- create a new `AuditLog` row;
- read/list/filter audit rows.

Denied by default:

- model-instance update via `save()`;
- model-instance `delete()`;
- queryset `update()`;
- queryset `delete()`;
- queryset/manager `bulk_update()`;
- add/change/delete actions through Django admin.

The public REST audit surface is list-only (`AuditLogListView`).

## Narrow maintenance exception

The P3 backup/restore drill needs deterministic synthetic audit rows. `AuditLogManager` therefore exposes only two explicit helpers scoped to actions beginning with `P3_RECOVERY_`:

- purge the previous synthetic recovery fixture;
- set the synthetic fixture timestamp to the deterministic drill anchor.

The helper refuses timestamp mutation for a normal audit row. It is not a general-purpose audit mutation escape hatch.

The existing owner-approved destructive simulator wipe remains an explicit low-level maintenance exception because it uses Django's private `_raw_delete` path while resetting the entire simulator dataset. Its long-term retention semantics are decided in T72; it is not exposed through normal audit CRUD.

## Critical-action coverage already present

The current runtime records security/administrative actions through two layers:

1. `ImpersonationAuditMiddleware` logs authenticated `GLOBAL_OWNER` / `TENANT_ADMIN` POST/PUT/PATCH/DELETE requests and impersonated mutations.
2. Dedicated domain audit events exist for operations that need richer semantics, including user create/delete/invite, impersonation start, moderation actions, destructive wipe queueing and live-map security events.

Existing tests cover the main user-admin critical paths. T70 adds explicit integrity tests proving that created audit rows cannot be rewritten/deleted through normal ORM/admin surfaces.

## Exit criteria

T70 repo-side acceptance requires:

- append-only ORM contract covered by tests;
- Django admin has no add/change/delete/bulk-delete surface;
- P3 recovery fixture still has a narrowly scoped deterministic maintenance path;
- existing audit-producing critical paths remain green in backend CI;
- no claim that DB-superuser tamper protection or legal retention policy is solved here (T73/T72 respectively).
