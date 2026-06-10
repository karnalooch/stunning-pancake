import { useMemo } from 'react';
import { useAuth } from '../core/auth/useAuth';

export interface TenantScopeInfo {
  tenantId: string | null;
  tenantName: string | null;
  isTenantScoped: boolean;
  isTenantAdmin: boolean;
  isTenantModerator: boolean;
}

/** Resolve tenant context for TENANT_ADMIN / TENANT_MODERATOR UI scoping. */
export function useTenantScope(stats?: {
  scoped_tenant_id?: string | null;
  per_tenant?: Array<{ tenant_id: string; tenant_name: string }>;
} | null): TenantScopeInfo {
  const { user } = useAuth();

  return useMemo(() => {
    const role = user?.role;
    const isTenantAdmin = role === 'TENANT_ADMIN';
    const isTenantModerator = role === 'TENANT_MODERATOR';
    const isTenantScoped = isTenantAdmin || isTenantModerator;
    const tenantId = user?.tenantId ?? stats?.scoped_tenant_id ?? null;

    let tenantName: string | null = null;
    if (tenantId && Array.isArray(stats?.per_tenant)) {
      const row = stats.per_tenant.find((t) => String(t.tenant_id) === String(tenantId));
      tenantName = row?.tenant_name ?? null;
    }

    return {
      tenantId: tenantId ? String(tenantId) : null,
      tenantName,
      isTenantScoped,
      isTenantAdmin,
      isTenantModerator,
    };
  }, [user?.role, user?.tenantId, stats?.scoped_tenant_id, stats?.per_tenant]);
}
