import { create } from 'zustand';

// Assuming we have these roles matching backend
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
  login: (token: string, user: User) => void;
  logout: () => void;
  impersonate: (token: string, user: User) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  token: null,
  login: (token, user) => set({ isAuthenticated: true, user, token }),
  logout: () => set({ isAuthenticated: false, user: null, token: null }),
  impersonate: (token, user) => set({ isAuthenticated: true, user: { ...user, isImpersonated: true }, token }),
}));
