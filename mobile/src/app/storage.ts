/**
 * Non-sensitive MMKV storage (onboarding flags, preferences).
 * Auth tokens live in authTokenStorage (SecureStore).
 */

import { MMKV } from 'react-native-mmkv';

let storage: MMKV | null | undefined;

const fallbackStorage = {
  getString: (_key: string) => undefined as string | undefined,
  set: (_key: string, _value: string) => {},
  delete: (_key: string) => {},
  clearAll: () => {},
  getAllKeys: () => [] as string[],
  contains: (_key: string) => false,
};

export type AppStorage = MMKV | typeof fallbackStorage;

export function getAppStorage(): AppStorage {
  if (storage !== undefined) return storage ?? fallbackStorage;
  try {
    storage = new MMKV();
    return storage;
  } catch (e) {
    console.error('[Storage] MMKV init failed', e);
    storage = null;
    return fallbackStorage;
  }
}

export const ONBOARDING_KEY = 'onboarding_complete';
const ONBOARDING_KEY_PREFIX = 'onboarding_complete_';

export function onboardingKeyForUser(userId: string | number): string {
  return `${ONBOARDING_KEY_PREFIX}${userId}`;
}

/** Per-user onboarding flag (legacy device-global key migrated once). */
export function isOnboardingCompleteForUser(userId: string | number | null | undefined): boolean {
  if (userId == null) return false;
  const store = getAppStorage();
  const userKey = onboardingKeyForUser(userId);
  if (store.getString(userKey) === 'true') return true;
  if (store.getString(ONBOARDING_KEY) === 'true') {
    store.set(userKey, 'true');
    return true;
  }
  return false;
}

export function setOnboardingCompleteForUser(userId: string | number): void {
  getAppStorage().set(onboardingKeyForUser(userId), 'true');
}
