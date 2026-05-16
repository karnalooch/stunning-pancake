import axios from 'axios';
import { useAuth } from '../core/auth/useAuth';

let baseURL = import.meta.env.VITE_API_URL || '/api';
if (!baseURL.startsWith('http://') && !baseURL.startsWith('https://')) {
  baseURL = `https://${baseURL}`;
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
