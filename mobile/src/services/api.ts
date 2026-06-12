import {
  API_PATHS_FULL,
  mobileActivityPaths,
  type UserProfile,
  type TokenPair,
  type RegisterPayload,
} from '@4velo/api-client';
import { api, setAuthToken } from './apiClient';
import { createSessionWithDurability } from './sessionDurability';

export { api, setAuthToken };
export type { UserProfile };

// ─── Typed services ────────────────────────────────────────────

export interface ActivityItem {
  id: number;
  type: string;
  start_time: string;
  end_time: string | null;
  distance: number;
  duration: string | null;
  is_verified: boolean;
  verification_score: number;
  rejection_reason?: string;
  rejection_notes?: string;
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

export type ActivitySportType = 'RUN' | 'BIKE' | 'WALK';

export const ActivityService = {
  createSession: (body: { type: ActivitySportType | string; start_time: string; event_id?: number }) =>
    createSessionWithDurability(body),
  syncPath: (activityId: number, route_path: [number, number][], path_hash?: string) =>
    api
      .patch(mobileActivityPaths.sessionSyncPath(activityId), {
        route_path,
        path_hash,
      })
      .then((r) => r.data),
  finalizeSession: (activityId: number, body: { end_time?: string; distance?: number }) =>
    api
      .post(mobileActivityPaths.sessionFinalize(activityId), body)
      .then((r) => r.data),
  getHistory: () => api.get<ActivityItem[]>(API_PATHS_FULL.activitiesSessions).then((r) => r.data),
  getLeaderboard: (cityId: string) =>
    api.get<any>(mobileActivityPaths.leaderboard(cityId)).then((r) => {
      const data = r.data;
      if (Array.isArray(data)) return data as LeaderboardEntry[];
      if (data && Array.isArray(data.leaderboard)) return data.leaderboard as LeaderboardEntry[];
      return [];
    }),
  getMyRank: (cityId: string) =>
    api.get<any>(mobileActivityPaths.leaderboardMe(cityId)).then((r) => r.data),
};

export interface PlatformNoticeDto {
  id: number;
  severity: 'info' | 'warning' | 'critical';
  title_pl: string;
  title_en: string;
  body_pl: string;
  body_en: string;
  dismissible: boolean;
  starts_at: string;
  ends_at: string | null;
}

export const NoticeService = {
  getActive: (tenantId?: string) =>
    api
      .get<{ notices: PlatformNoticeDto[] }>('/core/notices/active/', {
        params: tenantId ? { tenant_id: tenantId } : undefined,
      })
      .then((r) => r.data.notices ?? []),
};

export const AuthService = {
  login: (username: string, password: string) =>
    api.post<TokenPair>(API_PATHS_FULL.authToken, { username, password }).then((r) => r.data),
  register: (data: RegisterPayload) =>
    api.post(API_PATHS_FULL.usersRegister, data).then((r) => r.data),
  getProfile: () => api.get<UserProfile>(API_PATHS_FULL.usersProfile).then((r) => r.data),
};

export const PrivacyService = {
  getZones: () => api.get(API_PATHS_FULL.activitiesPrivacyZones).then((r) => r.data),
  createZone: (zone: { label: string; center: [number, number]; radius: number }) =>
    api.post(API_PATHS_FULL.activitiesPrivacyZones, zone).then((r) => r.data),
  deleteZone: (id: string) => api.delete(mobileActivityPaths.privacyZone(id)),
};

export const RewardsService = {
  getBalance: () => api.get<{ points: number }>(API_PATHS_FULL.rewardsBalance).then((r) => r.data),
  getPools: () => api.get<RewardPool[]>(API_PATHS_FULL.rewardsPools).then((r) => r.data),
  redeemVoucher: (poolId: number) =>
    api.post(mobileActivityPaths.rewardsRedeem(poolId)).then((r) => r.data),
};

export const POIService = {
  getPOIs: () => api.get(API_PATHS_FULL.activitiesPois).then((r) => r.data),
};

export const WearableService = {
  getStravaAuthUrl: () =>
    api.get<{ auth_url: string }>(API_PATHS_FULL.wearablesStravaAuth).then((r) => r.data),
  getGarminAuthUrl: () =>
    api.get<{ auth_url: string }>(API_PATHS_FULL.wearablesGarminAuth).then((r) => r.data),
  getStatus: () =>
    api
      .get<{
        strava: { connected: boolean; last_sync?: string };
        garmin: { connected: boolean; last_sync?: string };
      }>(API_PATHS_FULL.wearablesSync)
      .then((r) => r.data),
  sync: () => api.post(API_PATHS_FULL.wearablesSync).then((r) => r.data),
};

export default api;
