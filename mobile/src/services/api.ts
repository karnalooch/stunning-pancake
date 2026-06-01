import { api, setAuthToken } from './apiClient';
import { createSessionWithDurability } from './sessionDurability';

export { api, setAuthToken };

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
  user_id?: string | number;
  score_km?: number;
}

export interface RewardPool {
  id: number;
  title: string;
  description: string;
  points_required: number;
  sponsor_name: string;
  available: number;
}

export interface POI {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  description: string;
}

export const ActivityService = {
  createSession: (body: { type: string; start_time: string; event_id?: number }) =>
    createSessionWithDurability(body),
  syncPath: (activityId: number, route_path: [number, number][], path_hash?: string) =>
    api
      .patch(`/api/activities/sessions/${activityId}/sync_path/`, {
        route_path,
        path_hash,
      })
      .then((r) => r.data),
  finalizeSession: (activityId: number, body: { end_time?: string; distance?: number }) =>
    api
      .post(`/api/activities/sessions/${activityId}/finalize/`, body)
      .then((r) => r.data),
  getHistory: () => api.get<ActivityItem[]>('/api/activities/sessions/').then((r) => r.data),
  getLeaderboard: (cityId: string) =>
    api.get<any>(`/api/activities/leaderboard/${cityId}/`).then((r) => {
      const data = r.data;
      if (Array.isArray(data)) return data as LeaderboardEntry[];
      if (data && Array.isArray(data.leaderboard)) return data.leaderboard as LeaderboardEntry[];
      return [];
    }),
  getMyRank: (cityId: string) =>
    api.get<any>(`/api/activities/leaderboard/${cityId}/me/`).then((r) => r.data),
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

export const WearableService = {
  getStravaAuthUrl: () => api.get<{ auth_url: string }>('/api/activities/wearables/strava/auth/').then((r) => r.data),
  getGarminAuthUrl: () => api.get<{ auth_url: string }>('/api/activities/wearables/garmin/auth/').then((r) => r.data),
  getStatus: () =>
    api.get<{ strava: { connected: boolean; last_sync?: string }; garmin: { connected: boolean; last_sync?: string } }>(
      '/api/activities/wearables/sync/',
    ).then((r) => r.data),
  sync: () => api.post('/api/activities/wearables/sync/').then((r) => r.data),
};

export default api;
