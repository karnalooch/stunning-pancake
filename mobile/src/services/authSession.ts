/**
 * Session persistence — secure token storage + API auth header wiring.
 */

import type { TokenPair, UserProfile } from '@4velo/api-client';
import { AuthService, setAuthToken } from './api';
import { authTokenStorage } from './authTokenStorage';

export async function persistSession(tokens: TokenPair): Promise<void> {
  await authTokenStorage.setTokens(tokens.access, tokens.refresh ?? null);
  setAuthToken(tokens.access);
}

export async function clearSession(): Promise<void> {
  await authTokenStorage.clearTokens();
  setAuthToken(null);
}

export async function restoreSessionFromStorage(): Promise<string | null> {
  const access = await authTokenStorage.getAccessToken();
  if (!access) return null;
  setAuthToken(access);
  return access;
}

export async function loginAndLoadProfile(
  email: string,
  password: string,
): Promise<UserProfile> {
  const data = await AuthService.login(email, password);
  if (!data.access) throw new Error('Login returned no access token');
  await persistSession(data);
  return AuthService.getProfile();
}

export async function registerAndLogin(
  payload: Parameters<typeof AuthService.register>[0],
  email: string,
  password: string,
): Promise<UserProfile> {
  await AuthService.register(payload);
  return loginAndLoadProfile(email, password);
}

export async function loadProfileAfterOAuth(
  access: string,
  refresh: string,
): Promise<UserProfile> {
  await authTokenStorage.setTokens(access, refresh);
  setAuthToken(access);
  return AuthService.getProfile();
}
