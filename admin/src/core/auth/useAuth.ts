import { create } from 'zustand';
import { API_PATHS } from '@4velo/api-client';
import { apiClient } from '../../api/client';
import { clearStoredSession } from './tokens';
import { isE2eMode } from './e2eEnv';

export type Role = 'GLOBAL_OWNER' | 'TENANT_ADMIN' | 'TENANT_MODERATOR' | 'ATHLETE' | 'SPONSOR';

/** Legacy role-to-permissions map used as fallback when RBAC returns empty. */
const LEGACY_ROLE_PERMS: Record<string, string[]> = {
  GLOBAL_OWNER: ['*'],
  TENANT_ADMIN: ['activities.view', 'activities.create', 'activities.edit', 'activities.delete', 'activities.approve', 'users.view', 'users.create', 'users.edit'],
  // Backend admin user registry endpoints are restricted to GLOBAL_OWNER + TENANT_ADMIN.
  TENANT_MODERATOR: ['activities.view', 'activities.approve'],
  SPONSOR: ['activities.view', 'poi.view', 'poi.create', 'poi.edit', 'vouchers.create', 'vouchers.view'],
  ATHLETE: ['activities.view', 'activities.create', 'poi.view', 'vouchers.view'],
};

interface User {
  id: number;
  username: string;
  role: Role;
  tenantId: string | null;
  tenantName?: string | null;
  tenantFlags: {
    has_heatmap_analytics: boolean;
  } | null;
  isImpersonated: boolean;
}

export function profileToAuthUser(d: Record<string, unknown>): User {
  const role = d.role as Role;
  const tenantFlags = d.tenant_flags as { has_heatmap_analytics?: boolean } | undefined;
  return {
    id: d.id as number,
    username: d.username as string,
    role,
    tenantId: (d.tenant_id as string) || null,
    tenantName: (d.tenant_name as string) || null,
    tenantFlags: role === 'GLOBAL_OWNER'
      ? { has_heatmap_analytics: true }
      : tenantFlags
        ? { has_heatmap_analytics: !!tenantFlags.has_heatmap_analytics }
        : null,
    isImpersonated: false,
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  refreshToken: string | null;
  permissions: string[];
  login: (token: string, refresh: string, user: User) => Promise<void>;
  logout: () => void;
  impersonate: (token: string, user: User) => void;
  setPermissions: (permissions: string[]) => void;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasRole: (roleSlug: string) => boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  token: null,
  refreshToken: null,
  permissions: [],
  login: async (token, refresh, user) => {
    // Fetch user permissions from RBAC endpoint
    let permissions: string[] = [];
    try {
      const { data } = await apiClient.get('/users/rbac/user-roles/my_roles/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Extract permissions from role assignments
      permissions = data.flatMap((ur: any) =>
        ur.role.permissions?.map((rp: any) => rp.permission.codename) || []
      );
    } catch {
      // Fallback: derive permissions from legacy role
      permissions = LEGACY_ROLE_PERMS[user.role] || [];
    }

    // If RBAC returned empty permissions (user has no UserRole assignment),
    // fall back to legacy role-based permissions
    if (permissions.length === 0) {
      permissions = LEGACY_ROLE_PERMS[user.role] || [];
    }

    set({
      isAuthenticated: true,
      user,
      token,
      refreshToken: refresh,
      permissions,
    });
    localStorage.setItem('access_token', token);
    localStorage.setItem('refresh_token', refresh);
  },
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('impersonation_token');
    sessionStorage.clear();
    set({
      isAuthenticated: false,
      user: null,
      token: null,
      refreshToken: null,
      permissions: [],
    });
  },
  impersonate: (token, user) => set({
    isAuthenticated: true,
    user: { ...user, isImpersonated: true },
    token,
  }),
  setPermissions: (permissions) => set({ permissions }),
  hasPermission: (permission) => {
    const { permissions, user } = get();
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
  },
  hasAnyPermission: (perms) => {
    const { permissions } = get();
    if (permissions.includes('*')) return true;
    return perms.some(p => permissions.includes(p));
  },
  hasRole: (roleSlug) => {
    const { user } = get();
    const roleMap: Record<string, string> = {
      global_owner: 'GLOBAL_OWNER',
      tenant_admin: 'TENANT_ADMIN',
      tenant_moderator: 'TENANT_MODERATOR',
      sponsor: 'SPONSOR',
      athlete: 'ATHLETE',
    };
    return user?.role === roleMap[roleSlug];
  },
}));

function isLoginRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  return hash.includes('/login') || hash.includes('/auth/callback');
}

const storedToken = localStorage.getItem('access_token');
const storedRefresh = localStorage.getItem('refresh_token');
/** E2E dev server: E2EAuthBootstrap owns session; skip profile fetch to /api (no backend). */
if (storedToken && storedRefresh && !isLoginRoute() && !isE2eMode()) {
  useAuth.setState({ token: storedToken, refreshToken: storedRefresh });
  apiClient.get(API_PATHS.usersProfile)
    .then(res => {
      const d = res.data?.data || res.data;
      useAuth.getState().login(storedToken, storedRefresh, profileToAuthUser(d));
    })
    .catch(() => {
      clearStoredSession();
      useAuth.setState({ token: null, refreshToken: null });
    });
}
