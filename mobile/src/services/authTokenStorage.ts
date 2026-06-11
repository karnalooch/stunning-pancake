/**
 * Secure token storage — Keychain (iOS) / Keystore (Android) via expo-secure-store.
 * Migrates legacy MMKV tokens on first access.
 */

import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';

const ACCESS_KEY = '4velo.auth.access';
const REFRESH_KEY = '4velo.auth.refresh';
const LEGACY_ACCESS = 'auth_token';
const LEGACY_REFRESH = 'refresh_token';

let legacyMmkv: MMKV | null | undefined;
let migrationDone = false;

/** In-memory fallback when SecureStore is unavailable (tests / web). */
const memoryStore = new Map<string, string>();

let memoryFallback = false;

async function ensureAvailability(): Promise<void> {
  if (memoryFallback) return;
  try {
    const available = await SecureStore.isAvailableAsync();
    memoryFallback = !available;
  } catch {
    memoryFallback = true;
  }
}

function getLegacyMmkv(): MMKV | null {
  if (legacyMmkv !== undefined) return legacyMmkv;
  try {
    legacyMmkv = new MMKV();
  } catch {
    legacyMmkv = null;
  }
  return legacyMmkv;
}

async function migrateFromLegacyMmkv(): Promise<void> {
  if (migrationDone) return;
  migrationDone = true;

  const legacy = getLegacyMmkv();
  if (!legacy) return;

  const legacyAccess = legacy.getString(LEGACY_ACCESS);
  if (!legacyAccess) return;

  await ensureAvailability();
  const existing = memoryFallback
    ? memoryStore.get(ACCESS_KEY)
    : await SecureStore.getItemAsync(ACCESS_KEY);

  if (!existing) {
    const legacyRefresh = legacy.getString(LEGACY_REFRESH);
    await setTokens(legacyAccess, legacyRefresh ?? null);
  }

  legacy.delete(LEGACY_ACCESS);
  legacy.delete(LEGACY_REFRESH);
}

async function secureGet(key: string): Promise<string | null> {
  await ensureAvailability();
  if (memoryFallback) return memoryStore.get(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  await ensureAvailability();
  if (memoryFallback) {
    memoryStore.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  await ensureAvailability();
  if (memoryFallback) {
    memoryStore.delete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const authTokenStorage = {
  async getAccessToken(): Promise<string | null> {
    await migrateFromLegacyMmkv();
    return secureGet(ACCESS_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    await migrateFromLegacyMmkv();
    return secureGet(REFRESH_KEY);
  },

  async setTokens(access: string, refresh: string | null): Promise<void> {
    await secureSet(ACCESS_KEY, access);
    if (refresh) {
      await secureSet(REFRESH_KEY, refresh);
    } else {
      await secureDelete(REFRESH_KEY);
    }
  },

  async clearTokens(): Promise<void> {
    await secureDelete(ACCESS_KEY);
    await secureDelete(REFRESH_KEY);
    const legacy = getLegacyMmkv();
    legacy?.delete(LEGACY_ACCESS);
    legacy?.delete(LEGACY_REFRESH);
  },

  /** Test-only: reset in-memory fallback state. */
  __resetForTests(): void {
    memoryStore.clear();
    migrationDone = false;
    memoryFallback = true;
  },
};
