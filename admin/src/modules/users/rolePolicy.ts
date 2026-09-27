import type { Role } from '../../core/auth/useAuth';

export const TENANT_ADMIN_ASSIGNABLE_ROLES = [
  'ATHLETE',
  'TENANT_MODERATOR',
  'SPONSOR',
] as const satisfies readonly Role[];

export type TenantAdminAssignableRole = (typeof TENANT_ADMIN_ASSIGNABLE_ROLES)[number];

export function canTenantAdminAssignRole(role: string | null | undefined): role is TenantAdminAssignableRole {
  return TENANT_ADMIN_ASSIGNABLE_ROLES.includes(role as TenantAdminAssignableRole);
}

export function canActorAssignRole(
  actorRole: Role | null | undefined,
  targetRole: string | null | undefined,
): boolean {
  if (actorRole === 'GLOBAL_OWNER') return true;
  if (actorRole === 'TENANT_ADMIN') return canTenantAdminAssignRole(targetRole);
  return false;
}

export function canActorReassignTenant(actorRole: Role | null | undefined): boolean {
  return actorRole === 'GLOBAL_OWNER';
}
