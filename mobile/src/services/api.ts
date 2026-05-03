import axios, { AxiosError } from 'axios';
import { firebaseCapture } from './FirebaseService';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://backend-production-55c7.up.railway.app';

// ─── Typed API client ──────────────────────────────────────────
export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// Request logger (dev only — strips in production builds)
if (__DEV__) {
  api.interceptors.request.use((req) => {
    console.log(`[API] ${req.method?.toUpperCase()} ${req.url}`);
    return req;
  });
}

// Response normalizer — unwraps { ok: true, data: {...} } from backend
api.interceptors.response.use(
  (res) => {
    const body = res.data;
    if (body && typeof body === 'object' && 'ok' in body && 'data' in body) {
      return { ...res, data: body.data };
    }
    return res;
  },
  (error: AxiosError<{ error?: string; detail?: string }>) => {
    const msg =
      error.response?.data?.error ||
      error.response?.data?.detail ||
      error.message ||
      'Network error';
    console.warn(`[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${msg}`);
    firebaseCapture(error, 'API_ERROR');
    return Promise.reject(new Error(msg));
  },
);

// ─── Auth token ────────────────────────────────────────────────
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// ─── Typed services ────────────────────────────────────────────

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  role: string;
  tenant_id: string | null;
  tenant_name: string;
  avatar: string | null;
  bio: string;
}

export interface ActivityItem {
  id: number;
  type: string;
  start_time: string;
  end_time: string | null;
  distance: number;
  duration: string | null;
  is_verified: boolean;
  verification_score: number;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  points: number;
  is_me: boolean;
}

export interface RewardPool {
  id: number;
  title: string;
  description: string;
  points_required: number;
  sponsor_name: string;
  available: number;
}

export const ActivityService = {
  getHistory: () => api.get<ActivityItem[]>('/api/activities/sessions/').then((r) => r.data),
  getLeaderboard: (cityId: string) =>
    api.get<LeaderboardEntry[]>(`/api/activities/leaderboard/${cityId}/`).then((r) => r.data),
};

export const AuthService = {
  login: (username: string, password: string) =>
    api.post<{ access: string; refresh: string }>('/api/auth/token/', { username, password }).then((r) => r.data),
  register: (data: { username: string; email: string; password: string; tenant_id?: string }) =>
    api.post('/api/users/register/', data).then((r) => r.data),
  getProfile: () => api.get<UserProfile>('/api/users/profile/').then((r) => r.data),
};

export const PrivacyService = {
  getZones: () => api.get('/api/activities/privacy-zones/').then((r) => r.data),
  createZone: (zone: { label: string; center: [number, number]; radius: number }) =>
    api.post('/api/activities/privacy-zones/', zone).then((r) => r.data),
  deleteZone: (id: string) => api.delete(`/api/activities/privacy-zones/${id}/`),
};

export const RewardsService = {
  getBalance: () => api.get<{ points: number }>('/api/rewards/balance/').then((r) => r.data),
  getPools: () => api.get<RewardPool[]>('/api/rewards/pools/').then((r) => r.data),
  redeemVoucher: (poolId: number) =>
    api.post(`/api/rewards/redeem/${poolId}/`).then((r) => r.data),
};

export const POIService = {
  getPOIs: () => api.get('/api/activities/pois/').then((r) => r.data),
};

export default api;
