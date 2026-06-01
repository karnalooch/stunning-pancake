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
