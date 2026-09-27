import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const USERS = path.resolve(TEST_DIR, '../modules/users/Users.tsx');
const readUsers = () => fs.readFileSync(USERS, 'utf8');

describe('T85 tenant-admin pilot UI contract', () => {
  it('uses the central assignment policy on every role-changing surface', () => {
    const source = readUsers();

    expect(source).toContain("from './rolePolicy'");
    expect(source).toContain('data={createRoleOptions}');
    expect(source).toContain('data={inviteRoleOptions}');
    expect(source).toContain('data={editRoleOptions}');
    expect(source).toContain('data={bulkRoleOptions}');
  });

  it('keeps TENANT_ADMIN tenant scope authoritative over URL filters', () => {
    const source = readUsers();

    const tenantScopeCheck = source.indexOf("user?.role === 'TENANT_ADMIN' && user.tenantId");
    const urlTenantFallback = source.indexOf("else if (tid)");
    expect(tenantScopeCheck).toBeGreaterThan(-1);
    expect(urlTenantFallback).toBeGreaterThan(tenantScopeCheck);
  });

  it('does not treat the role filter as an assignment policy', () => {
    const source = readUsers();

    expect(source).toContain('data={tenantRoleOptions}');
    expect(source).toContain("{ value: 'TENANT_ADMIN', label: t.roles.TENANT_ADMIN }");
    expect(source).toContain('TENANT_ADMIN_ASSIGNABLE_ROLES.map');
  });

  it('omits role and tenant mutation fields when the actor cannot change them', () => {
    const source = readUsers();

    expect(source).toContain('if (canActorAssignRole(user?.role, editForm.role))');
    expect(source).toContain('if (canActorReassignTenant(user?.role) && editForm.tenant_id)');
    expect(source).toContain(
      "isGlobalOwner && bulkChangeRoleForm.role !== 'GLOBAL_OWNER' && bulkChangeRoleForm.update_tenant",
    );
  });

  it('locks an existing privileged role instead of sending a forbidden reassignment', () => {
    const source = readUsers();

    expect(source).toContain('selectedRoleIsLockedForTenantAdmin');
    expect(source).toContain('!canTenantAdminAssignRole(selectedUser.role)');
    expect(source).toContain('disabled={selectedRoleIsLockedForTenantAdmin}');
  });

  it('hides bulk tenant reassignment controls from TENANT_ADMIN', () => {
    const source = readUsers();

    expect(source).toContain(
      "{isGlobalOwner && bulkChangeRoleForm.role !== 'GLOBAL_OWNER' && (",
    );
  });

  it('does not surface users.delete to TENANT_ADMIN', () => {
    const source = readUsers();

    expect(source).toContain('const canDeleteUsers = canActorDeleteUsers(user?.role)');
    expect(source).toContain('{canDeleteUsers && (');
  });
});
