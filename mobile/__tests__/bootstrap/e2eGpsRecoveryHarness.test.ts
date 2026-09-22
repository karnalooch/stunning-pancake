/* eslint-env jest */

const mockMmkvStores = new Map<string, Map<string, string>>();
const mockMmkvConfigs: Array<{ id?: string; encryptionKey?: string }> = [];

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn().mockImplementation((config: { id?: string; encryptionKey?: string } = {}) => {
    mockMmkvConfigs.push(config);
    const id = config.id ?? 'mmkv.default';
    let data = mockMmkvStores.get(id);
    if (!data) {
      data = new Map<string, string>();
      mockMmkvStores.set(id, data);
    }
    return {
      getString: jest.fn((key: string) => data!.get(key)),
      set: jest.fn((key: string, value: string) => {
        data!.set(key, value);
      }),
      remove: jest.fn((key: string) => data!.delete(key)),
      clearAll: jest.fn(() => data!.clear()),
      getAllKeys: jest.fn(() => [...data!.keys()]),
      contains: jest.fn((key: string) => data!.has(key)),
    };
  }),
}));

jest.mock('expo-secure-store', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  AFTER_FIRST_UNLOCK: 1,
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn().mockResolvedValue(
    Uint8Array.from({ length: 32 }, (_, index) => index + 1),
  ),
}));

import * as SecureStore from 'expo-secure-store';
import {
  __resetEncryptedGpsStorageForTests,
} from '../../src/services/gpsEncryptedStorage';
import {
  E2E_GPS_RECOVERY_CANARY_KEY,
  E2E_GPS_RECOVERY_CANARY_VALUE,
  runE2eGpsRecoveryHarnessIfEnabled,
} from '../../src/bootstrap/e2eGpsRecoveryHarness';
import { e2eConfig } from '../../src/bootstrap/e2eConfig';

const secureStore = SecureStore as jest.Mocked<typeof SecureStore>;

function encryptedStore(): Map<string, string> {
  let value = mockMmkvStores.get('gps-buffer-encrypted-v1');
  if (!value) {
    value = new Map<string, string>();
    mockMmkvStores.set('gps-buffer-encrypted-v1', value);
  }
  return value;
}

function setFlag(value: boolean): void {
  if (value) {
    process.env.EXPO_PUBLIC_E2E_GPS_RECOVERY = 'true';
  } else {
    delete process.env.EXPO_PUBLIC_E2E_GPS_RECOVERY;
  }
}

describe('e2eGpsRecoveryHarness', () => {
  let logSpy: jest.SpyInstance;
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMmkvStores.clear();
    mockMmkvConfigs.length = 0;
    __resetEncryptedGpsStorageForTests();
    secureStore.isAvailableAsync.mockResolvedValue(true);
    secureStore.getItemAsync.mockResolvedValue(null);
    secureStore.setItemAsync.mockImplementation(async () => undefined);
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
    delete process.env.EXPO_PUBLIC_E2E_GPS_RECOVERY;
  });

  test('is disabled by default and writes nothing to the encrypted store', async () => {
    setFlag(false);
    expect(e2eConfig.gpsRecoverySeed).toBe(false);

    await runE2eGpsRecoveryHarnessIfEnabled();

    expect(encryptedStore().has(E2E_GPS_RECOVERY_CANARY_KEY)).toBe(false);
    expect(logSpy).not.toHaveBeenCalled();
  });

  test('seeds the canary key on empty storage and logs SEEDED', async () => {
    setFlag(true);
    expect(e2eConfig.gpsRecoverySeed).toBe(true);
    expect(encryptedStore().has(E2E_GPS_RECOVERY_CANARY_KEY)).toBe(false);

    await runE2eGpsRecoveryHarnessIfEnabled();

    expect(encryptedStore().get(E2E_GPS_RECOVERY_CANARY_KEY)).toBe(
      E2E_GPS_RECOVERY_CANARY_VALUE,
    );
    expect(logSpy).toHaveBeenCalledWith('[E2E GPS RECOVERY] SEEDED');
  });

  test('recovers the canary key on subsequent launches and logs RECOVERED without overwriting', async () => {
    setFlag(true);
    encryptedStore().set(E2E_GPS_RECOVERY_CANARY_KEY, E2E_GPS_RECOVERY_CANARY_VALUE);

    await runE2eGpsRecoveryHarnessIfEnabled();

    expect(encryptedStore().get(E2E_GPS_RECOVERY_CANARY_KEY)).toBe(
      E2E_GPS_RECOVERY_CANARY_VALUE,
    );
    expect(logSpy).toHaveBeenCalledWith('[E2E GPS RECOVERY] RECOVERED');
  });

  test('throws on canary value mismatch and does not overwrite', async () => {
    setFlag(true);
    encryptedStore().set(E2E_GPS_RECOVERY_CANARY_KEY, 'corrupted');

    await expect(runE2eGpsRecoveryHarnessIfEnabled()).rejects.toThrow(/mismatch/);
    expect(encryptedStore().get(E2E_GPS_RECOVERY_CANARY_KEY)).toBe('corrupted');
  });

  test('throws when initializeGpsStorage returns null', async () => {
    setFlag(true);
    secureStore.isAvailableAsync.mockResolvedValue(false);

    await expect(runE2eGpsRecoveryHarnessIfEnabled()).rejects.toThrow(
      /initializeGpsStorage/,
    );
    expect(encryptedStore().has(E2E_GPS_RECOVERY_CANARY_KEY)).toBe(false);
  });

  test('is a no-op when __DEV__ is false even if the flag is enabled', async () => {
    setFlag(true);
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    await runE2eGpsRecoveryHarnessIfEnabled();

    expect(encryptedStore().has(E2E_GPS_RECOVERY_CANARY_KEY)).toBe(false);
    expect(logSpy).not.toHaveBeenCalled();
  });
});