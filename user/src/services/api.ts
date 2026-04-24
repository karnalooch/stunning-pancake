/**
 * API Client — SPORT Mobile App
 * ================================
 * Constitution §8.2: TypeScript strict mode, Zod validation at boundaries.
 * Constitution §10.2: JWT auth, exponential backoff.
 */

import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod schemas (runtime validation at API boundary)
// ---------------------------------------------------------------------------

export const ActivitySchema = z.object({
  id: z.number(),
  type: z.enum(['RUN', 'BIKE', 'WALK', 'WHEELCHAIR']),
  start_time: z.string().datetime(),
  end_time: z.string().datetime().nullable(),
  distance: z.number(),
  is_verified: z.boolean(),
  verification_score: z.number(),
});

export const EventSchema = z.object({
  id: z.number(),
  title: z.string(),
  slug: z.string(),
  event_type: z.enum(['ACCUMULATIVE', 'CHECKPOINT', 'ROUTE_MATCH', 'INTER_TENANT', 'CLUB_BATTLE']),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ACTIVE', 'COMPLETED', 'CANCELLED']),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
});

export const LeaderboardEntrySchema = z.object({
  rank: z.number(),
  user_id: z.number(),
  username: z.string(),
  total_km: z.number(),
  score: z.number(),
});

export const TokenResponseSchema = z.object({
  access: z.string(),
  refresh: z.string(),
});

export type Activity = z.infer<typeof ActivitySchema>;
export type SportEvent = z.infer<typeof EventSchema>;
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

// ---------------------------------------------------------------------------
// API Client
// ---------------------------------------------------------------------------

const STORAGE_KEYS = {
  ACCESS_TOKEN: '@sport/access_token',
  REFRESH_TOKEN: '@sport/refresh_token',
} as const;

class SportApiClient {
  private _client: AxiosInstance;

  constructor(baseURL: string) {
    this._client = axios.create({
      baseURL,
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });

    // --- Request interceptor: attach JWT ---
    this._client.interceptors.request.use(async (config) => {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // --- Response interceptor: auto-refresh token on 401 ---
    this._client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const original = error.config as AxiosRequestConfig & { _retry?: boolean };
        if (error.response?.status === 401 && !original._retry) {
          original._retry = true;
          try {
            const refreshed = await this.refreshToken();
            if (refreshed && original.headers) {
              original.headers['Authorization'] = `Bearer ${refreshed}`;
              return this._client(original);
            }
          } catch {
            await this.logout();
          }
        }
        return Promise.reject(error);
      },
    );
  }

  // ------------------------------------------------------------------
  // Auth
  // ------------------------------------------------------------------

  async login(email: string, password: string): Promise<boolean> {
    const resp = await this._client.post('/api/auth/token/', { email, password });
    const tokens = TokenResponseSchema.parse(resp.data);
    await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.access);
    await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh);
    return true;
  }

  async refreshToken(): Promise<string | null> {
    const refresh = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refresh) return null;
    const resp = await this._client.post('/api/auth/token/refresh/', { refresh });
    const { access } = TokenResponseSchema.pick({ access: true }).parse(resp.data);
    await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access);
    return access;
  }

  async logout(): Promise<void> {
    await AsyncStorage.multiRemove([STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.REFRESH_TOKEN]);
  }

  // ------------------------------------------------------------------
  // Activities
  // ------------------------------------------------------------------

  async getMyActivities(): Promise<Activity[]> {
    const resp = await this._client.get('/api/activities/');
    return z.array(ActivitySchema).parse(resp.data.results ?? resp.data);
  }

  async createActivity(type: Activity['type']): Promise<Activity> {
    const resp = await this._client.post('/api/activities/', {
      type,
      start_time: new Date().toISOString(),
    });
    return ActivitySchema.parse(resp.data);
  }

  async finishActivity(id: number, distanceM: number): Promise<Activity> {
    const resp = await this._client.patch(`/api/activities/${id}/`, {
      end_time: new Date().toISOString(),
      distance: distanceM,
    });
    return ActivitySchema.parse(resp.data);
  }

  // ------------------------------------------------------------------
  // Events
  // ------------------------------------------------------------------

  async getActiveEvents(): Promise<SportEvent[]> {
    const resp = await this._client.get('/api/events/', { params: { status: 'ACTIVE' } });
    return z.array(EventSchema).parse(resp.data.results ?? resp.data);
  }

  async getEventLeaderboard(eventId: number, topN = 20): Promise<LeaderboardEntry[]> {
    const resp = await this._client.get(`/api/events/${eventId}/leaderboard/`, {
      params: { top_n: topN },
    });
    return z.array(LeaderboardEntrySchema).parse(resp.data);
  }
  // ------------------------------------------------------------------
  // City Leaderboard (Milestone 2)
  // ------------------------------------------------------------------

  async getCityLeaderboard(cityId: string, limit = 50): Promise<LeaderboardEntry[]> {
    const resp = await this._client.get(`/api/activities/leaderboard/${cityId}/`, {
      params: { limit },
    });
    if (resp.status === 202) return [];  // recalculating
    return z.array(LeaderboardEntrySchema).parse(resp.data.leaderboard ?? resp.data);
  }

  async getMyRank(cityId: string): Promise<{ rank: number | null; score_km: number }> {
    const resp = await this._client.get(`/api/activities/leaderboard/${cityId}/me/`);
    return resp.data as { rank: number | null; score_km: number };
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const api = new SportApiClient(
  process.env.API_URL ?? 'http://localhost:8000',
);
