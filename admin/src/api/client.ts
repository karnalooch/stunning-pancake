import axios from 'axios';

// The base URL should ideally come from env vars, pointing to our Django backend
let baseURL = import.meta.env.VITE_API_URL || 'https://docker-backend-production-123c.up.railway.app/api';
if (!baseURL.startsWith('http://') && !baseURL.startsWith('https://')) {
  baseURL = `https://${baseURL}`;
}

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject JWT token if it exists in localStorage or Zustand
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API Services
export const AdminApi = {
  getUsers: async () => {
    const { data } = await apiClient.get('/users/all/');
    return data;
  },
  getTenants: async () => {
    const { data } = await apiClient.get('/users/tenants/all/');
    return data;
  }
};

export const TelemetryApi = {
  getAnomalies: async () => {
    const { data } = await apiClient.get('/activities/telemetry/anomalies/');
    return data;
  },
  getLivePositions: async () => {
    const { data } = await apiClient.get('/activities/telemetry/live/');
    return data;
  }
};
