import { API_PATHS } from '@4velo/api-client';

/** Read JWT tokens from localStorage (sync) — used before Zustand hydration completes. */
export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refresh_token');
}

export function hasStoredSession(): boolean {
  return Boolean(getStoredAccessToken() && getStoredRefreshToken());
}

/** Remove persisted JWTs (call before password login or when tokens are invalid). */
export function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('impersonation_token');
}

export function isAuthApiPath(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes(API_PATHS.authToken) || url.includes(API_PATHS.authTokenRefresh);
}
