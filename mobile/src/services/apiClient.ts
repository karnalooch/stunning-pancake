import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import {
  API_PATHS_FULL,
  type TokenRefreshResponse,
} from '@4velo/api-client';
import { authTokenStorage } from './authTokenStorage';
import { AuthAppError, NetworkAppError, telemetryContext, toAppError } from './appError';
import { firebaseCapture } from './FirebaseService';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://backend-production-55c7.up.railway.app';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setOnSessionExpired(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url.includes(API_PATHS_FULL.authToken) ||
    url.includes(API_PATHS_FULL.authTokenRefresh) ||
    url.includes(API_PATHS_FULL.usersRegister)
  );
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = await authTokenStorage.getRefreshToken();
  if (!refresh) {
    await authTokenStorage.clearTokens();
    setAuthToken(null);
    onSessionExpired?.();
    return null;
  }

  try {
    const res = await axios.post<TokenRefreshResponse>(
      `${BASE_URL}${API_PATHS_FULL.authTokenRefresh}`,
      { refresh },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15_000 },
    );
    const access = res.data?.access;
    if (!access) throw new AuthAppError('Token refresh returned no access token');
    await authTokenStorage.setTokens(access, refresh);
    setAuthToken(access);
    return access;
  } catch (err) {
    await authTokenStorage.clearTokens();
    setAuthToken(null);
    onSessionExpired?.();
    firebaseCapture(err, 'AUTH_REFRESH_FAILED');
    return null;
  }
}

function unwrapEnvelope<T>(res: { data: T }) {
  const body = res.data;
  if (body && typeof body === 'object' && 'ok' in body && 'data' in body) {
    return { ...res, data: (body as { data: T }).data };
  }
  return res;
}

if (__DEV__) {
  api.interceptors.request.use((req) => {
    console.log(`[API] ${req.method?.toUpperCase()} ${req.url}`);
    return req;
  });
}

api.interceptors.response.use(
  (res) => unwrapEnvelope(res),
  async (error: AxiosError<{ error?: string; detail?: string }>) => {
    const original = error.config as RetryableConfig | undefined;

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isAuthEndpoint(original.url)
    ) {
      original._retry = true;
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        const retryRes = await api.request(original);
        return unwrapEnvelope(retryRes);
      }
    }

    const msg =
      error.response?.data?.error ||
      error.response?.data?.detail ||
      error.message ||
      'Network error';
    const appErr =
      error.response?.status === 401
        ? new AuthAppError(msg, telemetryContext(toAppError(error, msg)))
        : new NetworkAppError(msg, telemetryContext(toAppError(error, msg)));

    if (__DEV__) {
      console.warn(
        `[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${msg}`,
      );
    }
    firebaseCapture(appErr, 'API_ERROR');
    return Promise.reject(appErr);
  },
);

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export default api;
