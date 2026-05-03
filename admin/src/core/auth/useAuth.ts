import { create } from 'zustand';

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
  login: (token: string, refresh: string, user: User) => void;
  logout: () => void;
  impersonate: (token: string, user: User) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  token: null,
  refreshToken: null,
  login: (token, refresh, user) => set({
    isAuthenticated: true,
    user,
    token,
    refreshToken: refresh,
  }),
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
    });
  },
  impersonate: (token, user) => set({
    isAuthenticated: true,
    user: { ...user, isImpersonated: true },
    token,
  }),
}));
