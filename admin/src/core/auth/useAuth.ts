import { create } from 'zustand';
import { apiClient } from '../../api/client';

export type Role = 'GLOBAL_OWNER' | 'TENANT_ADMIN' | 'TENANT_MODERATOR' | 'ATHLETE' | 'SPONSOR';

interface User {
  id: number;
  username: string;
  role: Role;
  tenantId: string | null;
  tenantFlags: {
    has_heatmap_analytics: boolean;
  } | null;
  isImpersonated: boolean;
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
      const rolePerms: Record<string, string[]> = {
        GLOBAL_OWNER: ['*'],
        TENANT_ADMIN: ['activities.view', 'activities.create', 'activities.edit', 'activities.delete', 'activities.approve', 'users.view', 'users.create', 'users.edit'],
        TENANT_MODERATOR: ['activities.view', 'activities.approve', 'users.view'],
        SPONSOR: ['activities.view', 'poi.view', 'poi.create', 'poi.edit', 'vouchers.create', 'vouchers.view'],
        ATHLETE: ['activities.view', 'activities.create', 'users.view', 'poi.view', 'vouchers.view'],
      };
      permissions = rolePerms[user.role] || [];
    }

    set({
      isAuthenticated: true,
      user,
      token,
      refreshToken: refresh,
      permissions,
    });
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
