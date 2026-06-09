import axios from 'axios';
import { API_PATHS } from '@4velo/api-client';
import { formatApiError, isAbsentError } from './apiErrors';
import { useAuth } from '../core/auth/useAuth';
import {
  clearStoredSession,
  getStoredAccessToken,
  getStoredRefreshToken,
  isAuthApiPath,
} from '../core/auth/tokens';

/** sim-lab = proxied wipe (sim data). prod-local = prod Postgres (dashboard KPIs). */
export type WipeTarget = 'sim-lab' | 'prod-local';

export type WipeProgressStatus = {
  running?: boolean;
  status?: string;
  phase?: string;
  phase_label?: string;
  message?: string | null;
  progress_pct?: number;
  tables_done?: number;
  tables_total?: number;
  rows_deleted?: number;
  deleted?: Record<string, number>;
  error?: string | null;
  warning?: string | null;
  stuck?: boolean;
  stuck_reason?: string | null;
  started_at?: number | null;
  last_progress_at?: number | null;
  completed_at?: number | null;
  log?: [string, string][];
  sim_lab_proxy?: boolean;
};

function wipeDataPath(target: WipeTarget = 'sim-lab'): string {
  return target === 'prod-local'
    ? '/activities/admin/wipe-data/?local=1'
    : '/activities/admin/wipe-data/';
}

function simulatorResetPath(target: WipeTarget = 'sim-lab'): string {
  return target === 'prod-local'
    ? '/activities/admin/simulator-reset/?local=1'
    : '/activities/admin/simulator-reset/';
}

/** Thrown when wipe is stuck and auto-recovery failed; carries last server status. */
export class WipeStuckError extends Error {
  status: WipeProgressStatus;
  constructor(message: string, status: WipeProgressStatus) {
    super(message);
    this.name = 'WipeStuckError';
    this.status = status;
  }
}

export { formatApiError, isAbsentError };

let baseURL = import.meta.env.VITE_API_URL || '';
if (!baseURL) {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    baseURL = 'http://localhost:8000/api';
  } else {
    baseURL = '/api';
  }
}

// Automatically normalize: if VITE_API_URL is set but doesn't end with /api, append it!
if (baseURL && !baseURL.endsWith('/api') && !baseURL.endsWith('/api/')) {
  baseURL = `${baseURL.replace(/\/$/, '')}/api`;
}
if (baseURL.startsWith('/') && typeof window !== 'undefined') {
  baseURL = `${window.location.protocol}//${window.location.host}${baseURL}`;
}

export type ApiClientRequestConfig = import('axios').InternalAxiosRequestConfig & {
  skipAuth?: boolean;
  /** Suppress global 500 toast (polling / background status). */
  skipGlobalError?: boolean;
};

export const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

// Prefer Zustand token; fall back to localStorage until profile hydration finishes.
apiClient.interceptors.request.use((config) => {
  const url = String(config.url || '');
  // Never send stale Bearer to login/refresh — causes "token not valid for any token type".
  if (isAuthApiPath(url) || (config as ApiClientRequestConfig).skipAuth) {
    delete config.headers.Authorization;
    return config;
  }
  const token = useAuth.getState().token || getStoredAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — auto-logout on 401, global error notifications
let _notifyError: ((title: string, msg: string) => void) | null = null;
export const setGlobalErrorHandler = (handler: (title: string, msg: string) => void) => {
  _notifyError = handler;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const reqUrl = String(error.config?.url || '');
      const state = useAuth.getState();
      const refreshToken = state.refreshToken || getStoredRefreshToken();
      const isProfileBootstrap = reqUrl.includes(API_PATHS.usersProfile);
      const isAuthRequest = isAuthApiPath(reqUrl);

      if (isAuthRequest) {
        return Promise.reject(error);
      }

      if (refreshToken && !error.config._retry) {
        error.config._retry = true;
        try {
          const res = await axios.post(`${baseURL}${API_PATHS.authTokenRefresh}`, {
            refresh: refreshToken,
          });
          const { access } = res.data;
          if (state.user) {
            await state.login(access, refreshToken, state.user);
          } else {
            localStorage.setItem('access_token', access);
            useAuth.setState({ token: access, refreshToken });
          }
          error.config.headers.Authorization = `Bearer ${access}`;
          return apiClient(error.config);
        } catch {
          clearStoredSession();
          if (!isProfileBootstrap) {
            state.logout();
          } else {
            useAuth.setState({ token: null, refreshToken: null });
          }
          return Promise.reject(error);
        }
      }
      clearStoredSession();
      if (!isProfileBootstrap) {
        state.logout();
      } else {
        useAuth.setState({ token: null, refreshToken: null });
      }
      return Promise.reject(error);
    }
    if (error.response?.status === 403) {
      if (_notifyError) _notifyError('Access Denied', 'You do not have permission to perform this action.');
      return Promise.reject(error);
    }
    if (error.response?.status && error.response.status >= 500) {
      const skip = (error.config as ApiClientRequestConfig | undefined)?.skipGlobalError;
      if (!skip && _notifyError) {
        _notifyError('Server Error', `The server encountered an error (${error.response.status}). Please try again.`);
      }
    }
    return Promise.reject(error);
  }
);

// ─── API Services ──────────────────────────────────────────────

export const AdminApi = {
  getUsers: async (params?: Record<string, string | number | boolean | undefined>) => {
    const { data } = await apiClient.get('/users/all/', { params });
    if (Array.isArray(data)) {
      return { results: data, next_cursor: null as string | null, has_more: false };
    }
    return {
      results: data?.results ?? [],
      next_cursor: data?.next_cursor ?? null,
      has_more: Boolean(data?.has_more),
      page_size: typeof data?.page_size === 'number' ? data.page_size : undefined,
    };
  },
  getUserDetail: async (userId: number) => {
    const { data } = await apiClient.get(`/users/${userId}/detail/`);
    // DRF standard: data is the user object (no {ok,data} wrapper).
    return (data && (data.data || data)) as any;
  },
  bulkSetStatus: async (payload: { user_ids: number[]; is_active: boolean }) => {
    const { data } = await apiClient.post('/users/bulk/set-status/', payload);
    return data;
  },
  bulkChangeRole: async (payload: { user_ids: number[]; role: string; update_tenant?: boolean; tenant_id?: string | null }) => {
    const { data } = await apiClient.post('/users/bulk/change-role/', payload);
    return data;
  },
  getBulkJobStatus: async (jobId: string) => {
    const { data } = await apiClient.get(`/users/bulk/jobs/${jobId}/`);
    return data;
  },
  getTenants: async () => {
    const { data } = await apiClient.get('/users/tenants/all/');
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.results)) return data.results;
    return [];
  },
  getAuditLogs: async (limit?: number) => {
    const params = limit ? { limit } : {};
    const { data } = await apiClient.get('/users/audit-log/', { params });
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.results)) return data.results;
    return [];
  },
  impersonateUser: async (targetUserId: number) => {
    const { data } = await apiClient.post(`/users/impersonate/${targetUserId}/`);
    return data;
  },
  createUser: async (userData: { username: string; email: string; password: string; role?: string; tenant_id?: string }) => {
    const { data } = await apiClient.post('/users/create/', userData);
    return data;
  },
  deleteUser: async (userId: number) => {
    const { data } = await apiClient.delete(`/users/${userId}/delete/`);
    return data;
  },
  updateUser: async (userId: number, userData: any) => {
    const { data } = await apiClient.patch(`/users/${userId}/update/`, userData);
    return data;
  },
  sendInvitation: async (invitationData: { email: string; name: string; role?: string; tenant_id?: string }) => {
    const { data } = await apiClient.post('/users/invitation/', invitationData);
    return data;
  },
};

export const TelemetryApi = {
  getAnomalies: async () => {
    const { data } = await apiClient.get('/activities/telemetry/anomalies/');
    return data;
  },
  getLivePositions: async (
    params?: Record<string, string | number>,
    options?: { signal?: AbortSignal; silent?: boolean; etag?: string },
  ) => {
    const headers: Record<string, string> = {};
    if (options?.etag) headers['If-None-Match'] = options.etag;
    const response = await apiClient.get('/activities/telemetry/live/', {
      params,
      signal: options?.signal,
      skipGlobalError: options?.silent,
      headers,
      validateStatus: (status) => status === 200 || status === 304,
    } as ApiClientRequestConfig);
    if (response.status === 304) {
      return { notModified: true as const, etag: options?.etag ?? response.headers.etag };
    }
    const data = response.data;
    const etag = typeof response.headers.etag === 'string' ? response.headers.etag : undefined;
    if (Array.isArray(data)) return { positions: data, meta: {}, etag };
    return { ...data, etag };
  },
  getLiveReplay: async (
    params: Record<string, string | number>,
    options?: { compare?: boolean; signal?: AbortSignal },
  ) => {
    const path = options?.compare
      ? '/activities/telemetry/live/replay/compare/'
      : '/activities/telemetry/live/replay/';
    const { data } = await apiClient.get(path, {
      params,
      signal: options?.signal,
      skipGlobalError: true,
    } as ApiClientRequestConfig);
    return data;
  },
  postLiveMapAudit: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post('/activities/telemetry/live/audit/', payload, {
      skipGlobalError: true,
    } as ApiClientRequestConfig);
    return data;
  },
  listLiveMapWebhooks: async () => {
    const { data } = await apiClient.get('/activities/telemetry/live/webhooks/');
    return data;
  },
  createLiveMapWebhook: async (body: Record<string, unknown>) => {
    const { data } = await apiClient.post('/activities/telemetry/live/webhooks/', body);
    return data;
  },
  testLiveMapWebhook: async (id: number) => {
    const { data } = await apiClient.post(`/activities/telemetry/live/webhooks/${id}/test/`);
    return data;
  },
  getLiveAggregate: async (params: Record<string, string | number>) => {
    const { data } = await apiClient.get('/activities/telemetry/live/aggregate/', {
      params,
      skipGlobalError: true,
    } as ApiClientRequestConfig);
    return data;
  },
  getConfig: async () => {
    const { data } = await apiClient.get('/activities/telemetry/config/');
    return data;
  },
  updateConfig: async (config: Record<string, unknown>) => {
    const { data } = await apiClient.post('/activities/telemetry/config/', config);
    return data;
  },
  approveActivity: async (activityId: number) => {
    const { data } = await apiClient.post(`/activities/admin/approve/${activityId}/`);
    return data;
  },
  rejectActivity: async (activityId: number) => {
    const { data } = await apiClient.post(`/activities/admin/reject/${activityId}/`);
    return data;
  },
};

export const RewardsApi = {
  getPools: async () => {
    const { data } = await apiClient.get('/rewards/pools/');
    return data;
  },
  getBalance: async () => {
    const { data } = await apiClient.get('/rewards/balance/');
    return data;
  },
  getSponsorStats: async () => {
    const { data } = await apiClient.get('/rewards/sponsor-stats/');
    return data;
  },
};

export const BrandingApi = {
  getBranding: async (tenantId: string) => {
    const { data } = await apiClient.get(`/users/branding/${tenantId}/`);
    return data;
  },
};

/** Per-session live sim tuning (admin wizard); server clamps to safe maxima. */
export type ScaleOverrides = {
  max_starts_per_live_tick: number;
  brouter_max_calls_per_tick: number;
  brouter_route_attempts: number;
};

export type SimLabHealth = {
  reachable: boolean;
  latency_ms?: number | null;
  status_code?: number | null;
  error?: string | null;
  mode?: string;
};

export type DataSource = 'production' | 'sim-lab';

export type SimTargetInfo = {
  mode: 'local' | 'sim-lab-proxy';
  sim_lab_label?: string | null;
  sim_lab_base_url?: string | null;
  prod_heavy_sim_guard?: boolean;
  sim_lab_health?: SimLabHealth | null;
  read_federation_enabled?: boolean;
  dashboard_data_source?: DataSource;
};

export type DashboardStatsPayload = {
  data_source?: DataSource;
  synthetic?: boolean;
  sim_lab_proxy?: boolean;
  sim_lab_label?: string | null;
  federation_fallback?: boolean;
  total_users?: number;
  total_activities?: number;
  [key: string]: unknown;
};

export const SimulatorApi = {
  getSimTarget: async (): Promise<SimTargetInfo> => {
    const { data } = await apiClient.get('/activities/admin/sim-target/');
    return data;
  },

  getScalePreflight: async (params: {
    target_users: number;
    active_ratio?: number;
    skip_activities?: boolean;
  }) => {
    const { data } = await apiClient.get('/activities/admin/scale-preflight/', { params });
    return data;
  },

  // Batch Simulation
  getBatchStatus: async (options?: { silent?: boolean }) => {
    const { data } = await apiClient.get('/activities/admin/simulate/', {
      skipGlobalError: options?.silent,
    } as ApiClientRequestConfig);
    return data;
  },
  startBatch: async (params: {
    scale?: number;
    days?: number;
    clear?: boolean;
    skip_activities?: boolean;
    total_users?: number;
    scale_overrides?: ScaleOverrides;
  }) => {
    const { data } = await apiClient.post('/activities/admin/simulate/', params);
    return data;
  },
  abortBatch: async () => {
    const { data } = await apiClient.delete('/activities/admin/simulate/');
    return data;
  },

  // Live Simulation
  getLiveStatus: async (options?: { silent?: boolean; light?: boolean }) => {
    const params = options?.light ? { light: 1 } : undefined;
    const { data } = await apiClient.get('/activities/admin/live-simulate/', {
      params,
      skipGlobalError: options?.silent,
    } as ApiClientRequestConfig);
    return data;
  },
  startLive: async (params: {
    pool_pct: number;
    active_ratio: number;
    cheat_ratio: number;
    tick_seconds: number;
    intensity?: number;
    load?: number;
    scale_overrides?: ScaleOverrides;
  }) => {
    const { data } = await apiClient.post('/activities/admin/live-simulate/', params);
    return data;
  },
  abortLive: async () => {
    const { data } = await apiClient.delete('/activities/admin/live-simulate/');
    return data;
  },

  resetSimulator: async (target: WipeTarget = 'sim-lab') => {
    const { data } = await apiClient.post(simulatorResetPath(target));
    return data;
  },

  // Worker Status
  getWorkerStatus: async () => {
    const { data } = await apiClient.get('/activities/admin/worker-status/');
    return data;
  },

  getWipeStatus: async (target: WipeTarget = 'sim-lab'): Promise<WipeProgressStatus> => {
    const { data } = await apiClient.get(wipeDataPath(target));
    return data;
  },

  isWipeActive(status: WipeProgressStatus | null | undefined): boolean {
    if (!status) return false;
    if (status.running) return true;
    const label = (status.status || status.phase || 'idle').toLowerCase();
    return label === 'queued' || label === 'running';
  },

  /** True while wipe is in-flight and not flagged stuck (controls spinners / disabled UI). */
  isWipeBlocked(status: WipeProgressStatus | null | undefined): boolean {
    if (!status || status.stuck) return false;
    return SimulatorApi.isWipeActive(status);
  },

  /** Clear wipe locks only — does not restart wipe or reset simulator. */
  forceUnstickWipe: async (target: WipeTarget = 'sim-lab'): Promise<WipeProgressStatus> => {
    const { data } = await apiClient.post(wipeDataPath(target), { action: 'unstick' });
    return data;
  },

  /** Clear sim lock/state then force-restart a stuck wipe. */
  recoverStuckWipe: async (
    opts?: { confirmPhrase?: string; mfaConfirmed?: boolean; target?: WipeTarget },
  ): Promise<WipeProgressStatus> => {
    const target = opts?.target ?? 'sim-lab';
    const confirm_phrase = opts?.confirmPhrase ?? '';
    const mfa_confirmed = Boolean(opts?.mfaConfirmed);
    await SimulatorApi.resetSimulator(target);
    const body: Record<string, unknown> = {
      confirm: true,
      force: true,
      confirm_phrase,
      mfa_confirmed,
    };
    if (target === 'prod-local') {
      body.force_local = true;
    }
    const { data } = await apiClient.delete(wipeDataPath(target), { data: body });
    return data;
  },

  // Wipe Data (async chunked — poll until complete)
  wipeData: async (
    onProgress?: (s: WipeProgressStatus) => void,
    opts?: { confirmPhrase?: string; mfaConfirmed?: boolean; target?: WipeTarget },
  ): Promise<WipeProgressStatus> => {
    const target = opts?.target ?? 'sim-lab';
    const confirm_phrase = opts?.confirmPhrase ?? '';
    const mfa_confirmed = Boolean(opts?.mfaConfirmed);

    const startWipe = async (force = false): Promise<WipeProgressStatus> => {
      const body: Record<string, unknown> = {
        confirm: true,
        force,
        confirm_phrase,
        mfa_confirmed,
      };
      if (target === 'prod-local') {
        body.force_local = true;
      }
      const { data } = await apiClient.delete(wipeDataPath(target), { data: body });
      return data;
    };

    const wipeFinished = (s: WipeProgressStatus) => {
      const label = (s.status || s.phase || 'idle').toLowerCase();
      if (label === 'complete') {
        return { done: true, ok: true, warning: s.warning };
      }
      if (label === 'error' || (!isAbsentError(s.error) && label !== 'complete')) {
        return { done: true, ok: false };
      }
      return { done: false, ok: false };
    };

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    try {
      const kickoff = await startWipe(false);
      onProgress?.(kickoff);
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: WipeProgressStatus } };
      if (ax.response?.status === 202 && ax.response.data) {
        onProgress?.(ax.response.data);
      } else if (ax.response?.status === 409) {
        const status = await SimulatorApi.getWipeStatus(target);
        if (status.stuck) {
          const restarted = await SimulatorApi.recoverStuckWipe({ ...opts, target });
          onProgress?.(restarted);
        } else if (SimulatorApi.isWipeActive(status)) {
          onProgress?.(status);
        } else {
          throw new Error(formatApiError(err, 'Wipe conflicted with another operation.'));
        }
      } else {
        throw new Error(formatApiError(err, 'Failed to start wipe'));
      }
    }

    for (let i = 0; i < 30; i++) {
      const status = await SimulatorApi.getWipeStatus(target);
      onProgress?.(status);
      if (SimulatorApi.isWipeActive(status)) break;
      await sleep(1000);
    }

    const maxStuckRetries = 3;
    let stuckRetries = 0;
    // 60 min @ 2s — large user deletes on Railway can exceed 20 min
    const maxPolls = 1800;

    for (let i = 0; i < maxPolls; i++) {
      await sleep(2000);
      const status = await SimulatorApi.getWipeStatus(target);
      onProgress?.(status);

      if (status.stuck) {
        if (stuckRetries < maxStuckRetries) {
          stuckRetries += 1;
          try {
            const restarted = await SimulatorApi.recoverStuckWipe({ ...opts, target });
            onProgress?.(restarted);
            continue;
          } catch (recoverErr: unknown) {
            if (stuckRetries >= maxStuckRetries) {
              throw new WipeStuckError(
                formatApiError(recoverErr, 'Wipe stuck — auto-recovery failed.'),
                status,
              );
            }
            continue;
          }
        }
        throw new WipeStuckError(
          'Wipe stuck with no progress. Use Reset and retry or force-unstick from the panel.',
          status,
        );
      }

      const end = wipeFinished(status);
      if (end.done) {
        if (!end.ok) {
          throw new Error(
            isAbsentError(status.error) ? 'Wipe failed' : String(status.error),
          );
        }
        return { ...status, warning: end.warning || status.warning };
      }
    }
    const last = await SimulatorApi.getWipeStatus(target);
    onProgress?.(last);
    throw new WipeStuckError(
      'Wipe timed out after 60 minutes',
      last,
    );
  },
};

export const EventsApi = {
  getEvents: async () => {
    const { data } = await apiClient.get('/events/');
    return Array.isArray(data) ? data : (data?.results || []);
  },
  createEvent: async (eventData: any) => {
    const { data } = await apiClient.post('/events/', eventData);
    return data;
  },
  updateEvent: async (eventId: number, eventData: any) => {
    const { data } = await apiClient.patch(`/events/${eventId}/`, eventData);
    return data;
  },
  deleteEvent: async (eventId: number) => {
    const { data } = await apiClient.delete(`/events/${eventId}/`);
    return data;
  }
};

export const POIsApi = {
  getPOIs: async () => {
    const { data } = await apiClient.get('/activities/pois/');
    return Array.isArray(data) ? data : (data?.results || []);
  },
  createPOI: async (poiData: any) => {
    const { data } = await apiClient.post('/activities/pois/', poiData);
    return data;
  },
  updatePOI: async (poiId: number, poiData: any) => {
    const { data } = await apiClient.patch(`/activities/pois/${poiId}/`, poiData);
    return data;
  },
  deletePOI: async (poiId: number) => {
    const { data } = await apiClient.delete(`/activities/pois/${poiId}/`);
    return data;
  }
};
