import axios from 'axios';
import { useAuth } from '../core/auth/useAuth';
import {
  clearStoredSession,
  getStoredAccessToken,
  getStoredRefreshToken,
  isAuthApiPath,
} from '../core/auth/tokens';

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

export const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

// Prefer Zustand token; fall back to localStorage until profile hydration finishes.
apiClient.interceptors.request.use((config) => {
  const url = String(config.url || '');
  // Never send stale Bearer to login/refresh — causes "token not valid for any token type".
  if (isAuthApiPath(url) || (config as { skipAuth?: boolean }).skipAuth) {
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
      const isProfileBootstrap = reqUrl.includes('/users/profile/');
      const isAuthRequest = isAuthApiPath(reqUrl);

      if (isAuthRequest) {
        return Promise.reject(error);
      }

      if (refreshToken && !error.config._retry) {
        error.config._retry = true;
        try {
          const res = await axios.post(`${baseURL}/auth/token/refresh/`, {
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
      if (_notifyError) _notifyError('Server Error', `The server encountered an error (${error.response.status}). Please try again.`);
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
    options?: { signal?: AbortSignal },
  ) => {
    const { data } = await apiClient.get('/activities/telemetry/live/', {
      params,
      signal: options?.signal,
    });
    if (Array.isArray(data)) return { positions: data, meta: {} };
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

export const SimulatorApi = {
  getScalePreflight: async (params: {
    target_users: number;
    active_ratio?: number;
    skip_activities?: boolean;
  }) => {
    const { data } = await apiClient.get('/activities/admin/scale-preflight/', { params });
    return data;
  },

  // Batch Simulation
  getBatchStatus: async () => {
    const { data } = await apiClient.get('/activities/admin/simulate/');
    return data;
  },
  startBatch: async (params: {
    scale?: number;
    days?: number;
    clear?: boolean;
    skip_activities?: boolean;
    total_users?: number;
  }) => {
    const { data } = await apiClient.post('/activities/admin/simulate/', params);
    return data;
  },
  abortBatch: async () => {
    const { data } = await apiClient.delete('/activities/admin/simulate/');
    return data;
  },

  // Live Simulation
  getLiveStatus: async () => {
    const { data } = await apiClient.get('/activities/admin/live-simulate/');
    return data;
  },
  startLive: async (params: {
    pool_pct: number;
    active_ratio: number;
    cheat_ratio: number;
    tick_seconds: number;
  }) => {
    const { data } = await apiClient.post('/activities/admin/live-simulate/', params);
    return data;
  },
  abortLive: async () => {
    const { data } = await apiClient.delete('/activities/admin/live-simulate/');
    return data;
  },

  resetSimulator: async () => {
    const { data } = await apiClient.post('/activities/admin/simulator-reset/');
    return data;
  },

  // Worker Status
  getWorkerStatus: async () => {
    const { data } = await apiClient.get('/activities/admin/worker-status/');
    return data;
  },

  getWipeStatus: async () => {
    const { data } = await apiClient.get('/activities/admin/wipe-data/');
    return data;
  },

  // Wipe Data (async chunked — poll until complete)
  wipeData: async (
    onProgress?: (s: { progress_pct?: number; phase?: string; status?: string; error?: string; stuck?: boolean }) => void,
    opts?: { confirmPhrase?: string; mfaConfirmed?: boolean },
  ) => {
    const confirm_phrase = opts?.confirmPhrase ?? '';
    const mfa_confirmed = Boolean(opts?.mfaConfirmed);

    const startWipe = async (force = false) => {
      await apiClient.delete('/activities/admin/wipe-data/', {
        data: { confirm: true, force, confirm_phrase, mfa_confirmed },
      });
    };
    try {
      await startWipe(false);
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { stuck?: boolean; hint?: string } } };
      if (ax.response?.status === 409) {
        const status = await SimulatorApi.getWipeStatus();
        if (status.stuck) {
          await startWipe(true);
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const finished = (s: { status?: string; phase?: string; running?: boolean; error?: string; warning?: string }) => {
      const label = s.status || s.phase;
      if (label === 'complete') return { done: true, ok: true, warning: s.warning };
      if (label === 'error' || (s.error && label !== 'complete')) return { done: true, ok: false };
      if (!s.running && label !== 'queued' && label !== 'starting') return { done: false, ok: false };
      return { done: false, ok: false };
    };
    for (let i = 0; i < 30; i++) {
      const status = await SimulatorApi.getWipeStatus();
      onProgress?.(status);
      if (status.running || status.status === 'queued' || status.status === 'running') break;
      await sleep(1000);
    }
    let retriedStuck = false;
    for (let i = 0; i < 600; i++) {
      await sleep(2000);
      const status = await SimulatorApi.getWipeStatus();
      onProgress?.(status);
      if (status.stuck && !retriedStuck) {
        retriedStuck = true;
        await startWipe(true);
        continue;
      }
      const end = finished(status);
      if (end.done) {
        if (!end.ok) throw new Error(status.error || 'Wipe failed');
        return { ...status, warning: end.warning || status.warning };
      }
    }
    throw new Error('Wipe timed out');
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
