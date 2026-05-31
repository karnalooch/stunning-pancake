import axios from 'axios';
import { useAuth } from '../core/auth/useAuth';

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

// Interceptor reads token from Zustand store (not localStorage)
apiClient.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
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
      const state = useAuth.getState();
      if (state.refreshToken && !error.config._retry) {
        error.config._retry = true;
        try {
          const res = await axios.post(`${baseURL}/auth/token/refresh/`, {
            refresh: state.refreshToken,
          });
          const { access } = res.data;
          state.login(access, state.refreshToken!, state.user!);
          error.config.headers.Authorization = `Bearer ${access}`;
          return apiClient(error.config);
        } catch {
          state.logout();
          return Promise.reject(error);
        }
      }
      state.logout();
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
  getUsers: async () => {
    const { data } = await apiClient.get('/users/all/');
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.results)) return data.results;
    return [];
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
  getLivePositions: async () => {
    const { data } = await apiClient.get('/activities/telemetry/live/');
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

  // Worker Status
  getWorkerStatus: async () => {
    const { data } = await apiClient.get('/activities/admin/worker-status/');
    return data;
  },

  // Wipe Data
  wipeData: async () => {
    const { data } = await apiClient.delete('/activities/admin/wipe-data/', { data: { confirm: true } });
    return data;
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
