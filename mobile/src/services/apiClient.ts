import axios, { AxiosError } from 'axios';
import { firebaseCapture } from './FirebaseService';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://backend-production-55c7.up.railway.app';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

if (__DEV__) {
  api.interceptors.request.use((req) => {
    console.log(`[API] ${req.method?.toUpperCase()} ${req.url}`);
    return req;
  });
}

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

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export default api;
