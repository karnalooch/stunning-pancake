# T86 — GLOBAL_OWNER pilot-path validation

**Status:** PARTIAL — repo-side hardening merged in PR #306 (`d5f5cd5d`); real pilot-environment GLOBAL_OWNER smoke still required before DONE  
**Starting main:** `2815f2f8007e22baf7b47a24624849bb107b2632`  
**Issue:** #305

## Pilot contract

For the pilot, GLOBAL_OWNER is the tenant-neutral platform operator. It keeps platform-wide visibility where the existing product already grants it, but T86 does not create a new analytics platform or Tenant Command Center.

The critical safety invariant is that the currently signed-in GLOBAL_OWNER must not be able to lock themselves out through normal user-management surfaces.

## Findings closed by PR #306

### 1. GLOBAL_OWNER self-lockout

Before T86, the owner could:

- delete their own account;
- deactivate their own account through a single-user update;
- deactivate their own account through bulk status;
- demote their own role through a single-user update;
- demote their own role through bulk role change.

The backend now rejects all five paths before the destructive mutation or async job is accepted.

The admin Users UI also removes/locks the corresponding self-actions:

- current GLOBAL_OWNER cannot be bulk-selected;
- lock/unlock and delete actions are not offered for the current owner;
- role and active-state controls are locked for the current owner;
- handlers retain defense-in-depth guards even if UI state is manipulated.

### 2. GLOBAL_OWNER tenant neutrality

Bulk promotion already cleared tenant membership, but single create/update/invite paths could preserve or accept a tenant while assigning GLOBAL_OWNER.

PR #306 makes supported admin write paths consistent: GLOBAL_OWNER is platform-scoped and tenant-neutral.

During validation, the new regression test exposed an older serializer bug: `UserAdminUpdateSerializer` listed `tenant_id` but did not explicitly map it to the `tenant` relation, so a role update could succeed while the existing tenant relation remained unchanged.

The serializer now uses an explicit `PrimaryKeyRelatedField(source="tenant", ... allow_null=True)`, so tenant reassignment/clearing is actually persisted.

### 3. Existing platform-wide club scope remains intact

T86 did not redesign clubs. Existing backend coverage remains authoritative:

- `backend/clubs/test_p3_tenant_scope.py::test_global_owner_retains_platform_scope` verifies GLOBAL_OWNER can read clubs across tenants.

### 4. Existing audit path remains intact

T86 did not build a new audit product. Existing audit behavior and coverage remain:

- GLOBAL_OWNER can read the existing audit-log list;
- audit rows with deleted/null user FKs remain readable;
- TENANT_ADMIN remains tenant-scoped.

Relevant coverage remains in `backend/users/test_admin.py::TestAuditLogList`.

## Regression evidence added

Backend:

- self-delete is rejected;
- single self-deactivation is rejected;
- single self-demotion is rejected;
- bulk self-deactivation is rejected before queueing;
- bulk self-demotion is rejected before queueing;
- creating GLOBAL_OWNER with a tenant request results in no tenant;
- promoting a tenant user to GLOBAL_OWNER clears the tenant;
- inviting GLOBAL_OWNER with a tenant request results in no tenant.

Admin:

- current GLOBAL_OWNER is excluded from bulk selection;
- self lock/delete controls are absent and handlers fail closed;
- drawer role/status controls cannot demote/deactivate the current owner;
- GLOBAL_OWNER tenant controls are suppressed where applicable;
- the prior T85 TENANT_ADMIN UI contract remains covered.

## CI evidence

Final PR #306 head: `ce97d7dd5c23edb3220aca96aff8b448f485492d`.

Final CI evidence:

- 4VELO CI/CD Pipeline #2271 — SUCCESS;
- Backend affected users-domain tests — SUCCESS;
- Backend coverage gate — SUCCESS;
- Admin Dashboard lint/tests/typecheck/build — SUCCESS;
- CodeQL JavaScript/TypeScript — SUCCESS;
- CodeQL Python — SUCCESS;
- CodeQL SAST — SUCCESS;
- Audit (Routes + Screens + RBAC + Env) — SUCCESS;
- E2E Tests (Playwright) — SUCCESS;
- Security inventory — SUCCESS;
- Aggregate CI gate — SUCCESS;
- Kubernetes Release Gate #1285 — SUCCESS.

The affected-test planner intentionally selected the users domain; the unrelated full legacy fallback was not required for this R2 change.

## Runtime completion boundary

PR/CI evidence is necessary but is not the final T86 end-to-end proof.

Run the commit-bound operator wrapper against the intended pilot admin environment. The canonical combined T85 + T86 run requires both real role-specific accounts and one explicit 40-character candidate SHA:

```bash
ADMIN_URL=<pilot-admin-url> \
ADMIN_USER_TENANT_ADMIN=<tenant-admin> \
ADMIN_PASS_TENANT_ADMIN=<secret> \
ADMIN_MFA_TENANT_ADMIN=<fresh-6-digit-code> \
ADMIN_USER_GLOBAL_OWNER=<global-owner> \
ADMIN_PASS_GLOBAL_OWNER=<secret> \
ADMIN_MFA_GLOBAL_OWNER=<fresh-6-digit-code> \
python scripts/admin_pilot_smoke.py --expected-sha <40-char-pilot-sha>
```

Generate both MFA codes immediately before starting the run. The codes are passed only to the browser login flow and are never included in the JSON evidence.

The wrapper fails closed on a dirty checkout, SHA mismatch, missing credentials, skipped required roles, failed navigation, or target-URL drift and writes secret-free evidence to `backups/home-lab/evidence/t85-t86-admin-smoke-*.json`. Automated PASS is necessary but not sufficient for T86 DONE.

In addition to the automated navigation smoke, record targeted T86 observations on the real pilot environment:

- GLOBAL_OWNER signs in and reaches the existing owner Users and audit surfaces;
- cross-tenant user visibility is correct for at least two pilot tenants;
- existing platform-wide club visibility is correct;
- the current GLOBAL_OWNER cannot be selected for bulk destructive actions and has no self lock/delete controls;
- a disposable test user promoted to GLOBAL_OWNER ends with no tenant membership;
- ordinary management of another user still works without avoidable 403/validation errors.

Until that real-environment evidence is recorded, T86 remains **PARTIAL after merge**, not DONE.
