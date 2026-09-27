import { describe, expect, it } from 'vitest';

import {
  TENANT_ADMIN_ASSIGNABLE_ROLES,
  canActorAssignRole,
  canActorDeleteUsers,
  canActorReassignTenant,
  canTenantAdminAssignRole,
} from '../modules/users/rolePolicy';

describe('tenant admin user-role policy', () => {
  it('matches the backend assignable role contract exactly', () => {
    expect(TENANT_ADMIN_ASSIGNABLE_ROLES).toEqual([
      'ATHLETE',
      'TENANT_MODERATOR',
      'SPONSOR',
    ]);
  });

  it('rejects TENANT_ADMIN and GLOBAL_OWNER promotion paths', () => {
    expect(canTenantAdminAssignRole('TENANT_ADMIN')).toBe(false);
    expect(canTenantAdminAssignRole('GLOBAL_OWNER')).toBe(false);
    expect(canActorAssignRole('TENANT_ADMIN', 'TENANT_ADMIN')).toBe(false);
    expect(canActorAssignRole('TENANT_ADMIN', 'GLOBAL_OWNER')).toBe(false);
  });

  it('allows the three tenant-admin assignment roles', () => {
    for (const role of TENANT_ADMIN_ASSIGNABLE_ROLES) {
      expect(canActorAssignRole('TENANT_ADMIN', role)).toBe(true);
    }
  });

  it('keeps tenant reassignment global-owner only', () => {
    expect(canActorReassignTenant('TENANT_ADMIN')).toBe(false);
    expect(canActorReassignTenant('GLOBAL_OWNER')).toBe(true);
  });

  it('keeps global-owner role assignment unrestricted by tenant policy', () => {
    expect(canActorAssignRole('GLOBAL_OWNER', 'TENANT_ADMIN')).toBe(true);
    expect(canActorAssignRole('GLOBAL_OWNER', 'GLOBAL_OWNER')).toBe(true);
  });

  it('matches the RBAC users.delete contract', () => {
    expect(canActorDeleteUsers('TENANT_ADMIN')).toBe(false);
    expect(canActorDeleteUsers('GLOBAL_OWNER')).toBe(true);
  });
});
