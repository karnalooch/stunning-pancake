# T85 — TENANT_ADMIN pilot-path validation

**Status:** repo-side hardening ACTIVE in PR #303; runtime role smoke still required  
**Starting main:** `000dc264359e1d6cf92937c12d06a8ff2c8dde4f`  
**Issue:** #302

## Pilot contract

For the pilot, TENANT_ADMIN is a tenant-scoped operator. It may manage ordinary users and moderation inside its own tenant, but it is not a platform owner and it must not gain platform-owner or peer-admin authority through alternate endpoints.

The legacy user-management and newer RBAC assignment paths must agree on the same hierarchy.

### Assignable roles

TENANT_ADMIN may assign only:

- `ATHLETE`
- `TENANT_MODERATOR`
- `SPONSOR`

It may not assign, promote to, update to, or revoke/delete assignments for:

- `TENANT_ADMIN`
- `GLOBAL_OWNER`

GLOBAL_OWNER retains platform-wide role assignment and privileged-role management.

### User deletion

The declared RBAC matrix has `users.delete` only for GLOBAL_OWNER.

TENANT_ADMIN may use permitted `users.edit` operations inside its tenant (including allowed role changes and account status changes) but may not delete accounts.

## Findings closed by PR #303

### 1. Legacy update privilege escalation

`UserCreateView`, `InvitationTokenView` and `UserBulkChangeRoleView` already restricted TENANT_ADMIN to the lower-role set, but `UserUpdateView` blocked only `GLOBAL_OWNER`.

A same-tenant user could therefore be promoted to `TENANT_ADMIN` through PATCH even though every other assignment path rejected that promotion.

The update path now enforces `TENANT_ADMIN_ASSIGNABLE_ROLES` when — and only when — the request attempts to change `role`. Unrelated profile edits to an existing privileged same-tenant account do not silently become a role reassignment.

### 2. User delete permission mismatch

The documented/legacy RBAC matrix says TENANT_ADMIN does not have `users.delete`, while `UserDeleteView` explicitly allowed both GLOBAL_OWNER and TENANT_ADMIN.

Deletion is now GLOBAL_OWNER-only in the backend and the delete action is not surfaced to TENANT_ADMIN in the user registry.

### 3. RBAC revoke/delete hierarchy bypass

The newer `UserRoleViewSet` already constrained create/update to own-tenant lower roles, but generic destroy and the custom `revoke` action did not apply the role hierarchy.

TENANT_ADMIN could therefore remove a privileged `tenant_admin` assignment even though it could not create it.

Destroy/revoke now reject role assignments outside `athlete / tenant_moderator / sponsor` for TENANT_ADMIN. GLOBAL_OWNER remains unrestricted.

### 4. Admin UI exposed server-rejected controls

The Users UI offered TENANT_ADMIN choices that the backend rejected:

- TENANT_ADMIN in create;
- TENANT_ADMIN in invite;
- TENANT_ADMIN/GLOBAL_OWNER in bulk role change;
- privileged roles in edit;
- bulk tenant reassignment controls.

The UI now consumes one frontend role policy for assignment surfaces while retaining a separate role filter, so existing privileged users can still be found without making their roles assignable.

### 5. Tenant registry UI state could follow a crafted URL filter

The backend already forced own-tenant scope, but the Users screen gave a URL `tenant_id` precedence over the signed-in TENANT_ADMIN's tenant when building local query state.

TENANT_ADMIN's authenticated tenant now wins over URL filters, keeping UI/query state aligned with server authority.

## Existing tenant-isolation evidence retained

The audit found no need to redesign already-safe paths:

- user registry queryset forces TENANT_ADMIN to its own tenant;
- bulk target validation rejects cross-tenant user IDs;
- activity admin/read paths are server tenant-scoped;
- moderation queue/history and approve/reject/assign have tenant-isolation tests;
- club reads/membership/challenge operations have tenant-isolation tests;
- Moderation Inbox draft events are own-tenant for TENANT_ADMIN; cross-tenant events exposed by the general event list are only public lifecycle states and are removed by the DRAFT filter, while event mutation checks tenant ownership;
- `rbac/user-roles` create/update already forced the actor tenant and rejected privileged role assignment.

## Regression evidence added

Backend:

- TENANT_ADMIN cannot create/invite/update a user to TENANT_ADMIN;
- allowed update to TENANT_MODERATOR still works;
- unrelated edit of an existing same-tenant TENANT_ADMIN still works when role is not changed;
- TENANT_ADMIN cannot delete own-tenant or foreign-tenant accounts;
- RBAC privileged assignment delete/revoke is rejected;
- RBAC revoke of an assignable lower role still works.

Admin:

- `rolePolicy.ts` defines the TENANT_ADMIN assignment/delete policy;
- Vitest locks the policy;
- `tenantAdminPilotContract.test.ts` locks policy consumption across create/edit/invite/bulk, tenant reassignment, delete visibility and URL tenant scope.

## Runtime completion boundary

PR/CI evidence is necessary but is not the final T85 end-to-end proof.

Before T85 is marked DONE, run the existing role smoke against the intended pilot admin environment with real TENANT_ADMIN credentials:

```bash
ADMIN_URL=<pilot-admin-url> \
ADMIN_USER_TENANT_ADMIN=<tenant-admin> \
ADMIN_PASS_TENANT_ADMIN=<secret> \
pnpm --filter admin smoke:p0
```

Required runtime observations:

- TENANT_ADMIN reaches its allowed Users / Activities / Moderation paths;
- GLOBAL_OWNER-only routes remain denied;
- user registry visibly reflects the correct tenant;
- forbidden delete/privileged-role controls are absent;
- permitted lower-role management and tenant moderation complete without avoidable 403s.

Until that real-environment smoke is recorded, T85 should be reported as **PARTIAL after merge**, not DONE.
