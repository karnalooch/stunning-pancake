/* eslint-env jest */

const mockInitializeGpsStorage = jest.fn();
const mockCreateAppMmkv = jest.fn();
const mockSecureStoreGetItemAsync = jest.fn();
const mockSecureStoreDeleteItemAsync = jest.fn();

const mockGpsConstants = {
  keyAlias: '4velo.gps.mmkv.encryption-key-v1',
  bootstrapStorageId: 'gps-storage-bootstrap',
  provisionedMarker: 'encryption-key-provisioned-v1',
};

jest.mock('../../src/services/gpsEncryptedStorage', () => ({
  initializeGpsStorage: (...args: unknown[]) => mockInitializeGpsStorage(...args),
  __GPS_ENCRYPTED_STORAGE_TEST_CONSTANTS: mockGpsConstants,
}));

jest.mock('../../src/services/mmkvStorage', () => ({
  createAppMmkv: (...args: unknown[]) => mockCreateAppMmkv(...args),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockSecureStoreGetItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => mockSecureStoreDeleteItemAsync(...args),
}));

jest.mock('../../src/bootstrap/e2eConfig', () => ({
  e2eConfig: {
    gpsRecoverySeed: false,
    gpsLostKeyDestructive: false,
  },
}));

import {
  E2E_GPS_LOST_KEY_CANARY_KEY,
  E2E_GPS_LOST_KEY_CANARY_VALUE,
  E2E_GPS_LOST_KEY_PHASE_ARMED,
  E2E_GPS_LOST_KEY_PHASE_KEY,
  runE2eGpsLostKeyHarnessIfEnabled,
} from '../../src/bootstrap/e2eGpsLostKeyHarness';
import { e2eConfig } from '../../src/bootstrap/e2eConfig';

const mutableE2eConfig = e2eConfig as {
  gpsRecoverySeed: boolean;
  gpsLostKeyDestructive: boolean;
};

const bootstrapValues = new Map<string, string>();
const encryptedValues = new Map<string, string>();

const bootstrapStorage = {
  getString: jest.fn((key: string) => bootstrapValues.get(key)),
  set: jest.fn((key: string, value: string) => {
    bootstrapValues.set(key, value);
  }),
};

const encryptedStorage = {
  getString: jest.fn((key: string) => encryptedValues.get(key)),
  set: jest.fn((key: string, value: string) => {
    encryptedValues.set(key, value);
  }),
};

describe('e2eGpsLostKeyHarness', () => {
  let secureKey: string | null;
  let logSpy: jest.SpyInstance;
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
    bootstrapValues.clear();
    encryptedValues.clear();

    mutableE2eConfig.gpsRecoverySeed = false;
    mutableE2eConfig.gpsLostKeyDestructive = false;

    secureKey = 'ab'.repeat(32);
    bootstrapValues.set(mockGpsConstants.provisionedMarker, '1');

    mockCreateAppMmkv.mockReturnValue(bootstrapStorage);
    mockInitializeGpsStorage.mockResolvedValue(encryptedStorage);
    mockSecureStoreGetItemAsync.mockImplementation(async () => secureKey);
    mockSecureStoreDeleteItemAsync.mockImplementation(async () => {
      secureKey = null;
    });

    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  test('is disabled by default', async () => {
    await runE2eGpsLostKeyHarnessIfEnabled();

    expect(mockCreateAppMmkv).not.toHaveBeenCalled();
    expect(mockInitializeGpsStorage).not.toHaveBeenCalled();
    expect(mockSecureStoreDeleteItemAsync).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  test('refuses to run together with the non-destructive recovery harness', async () => {
    mutableE2eConfig.gpsLostKeyDestructive = true;
    mutableE2eConfig.gpsRecoverySeed = true;

    await expect(runE2eGpsLostKeyHarnessIfEnabled()).rejects.toThrow(/mutually exclusive/);

    expect(mockCreateAppMmkv).not.toHaveBeenCalled();
    expect(mockSecureStoreDeleteItemAsync).not.toHaveBeenCalled();
  });

  test('arms the destructive proof, writes an encrypted canary and deletes only the GPS key', async () => {
    mutableE2eConfig.gpsLostKeyDestructive = true;

    await runE2eGpsLostKeyHarnessIfEnabled();

    expect(mockCreateAppMmkv).toHaveBeenCalledWith({
      id: mockGpsConstants.bootstrapStorageId,
    });
    expect(mockInitializeGpsStorage).toHaveBeenCalledTimes(1);

    expect(encryptedValues.get(E2E_GPS_LOST_KEY_CANARY_KEY)).toBe(
      E2E_GPS_LOST_KEY_CANARY_VALUE,
    );
    expect(bootstrapValues.get(E2E_GPS_LOST_KEY_PHASE_KEY)).toBe(
      E2E_GPS_LOST_KEY_PHASE_ARMED,
    );

    expect(mockSecureStoreDeleteItemAsync).toHaveBeenCalledWith(mockGpsConstants.keyAlias);
    expect(secureKey).toBeNull();
    expect(logSpy).toHaveBeenCalledWith('[E2E GPS LOST KEY] KEY_DELETED');
  });

  test('second process proves fail-closed and does not regenerate the missing key', async () => {
    mutableE2eConfig.gpsLostKeyDestructive = true;
    bootstrapValues.set(E2E_GPS_LOST_KEY_PHASE_KEY, E2E_GPS_LOST_KEY_PHASE_ARMED);
    secureKey = null;
    mockInitializeGpsStorage.mockResolvedValue(null);

    await runE2eGpsLostKeyHarnessIfEnabled();

    expect(mockInitializeGpsStorage).toHaveBeenCalledTimes(1);
    expect(mockSecureStoreDeleteItemAsync).not.toHaveBeenCalled();
    expect(secureKey).toBeNull();
    expect(logSpy).toHaveBeenCalledWith('[E2E GPS LOST KEY] FAIL_CLOSED');
  });

  test('fails if a replacement key exists before second-process initialization', async () => {
    mutableE2eConfig.gpsLostKeyDestructive = true;
    bootstrapValues.set(E2E_GPS_LOST_KEY_PHASE_KEY, E2E_GPS_LOST_KEY_PHASE_ARMED);

    await expect(runE2eGpsLostKeyHarnessIfEnabled()).rejects.toThrow(
      /replacement encryption key exists/,
    );

    expect(mockInitializeGpsStorage).not.toHaveBeenCalled();
  });

  test('fails if encrypted storage reopens despite the missing provisioned key', async () => {
    mutableE2eConfig.gpsLostKeyDestructive = true;
    bootstrapValues.set(E2E_GPS_LOST_KEY_PHASE_KEY, E2E_GPS_LOST_KEY_PHASE_ARMED);
    secureKey = null;
    mockInitializeGpsStorage.mockResolvedValue(encryptedStorage);

    await expect(runE2eGpsLostKeyHarnessIfEnabled()).rejects.toThrow(
      /reopened even though/,
    );

    expect(logSpy).not.toHaveBeenCalledWith('[E2E GPS LOST KEY] FAIL_CLOSED');
  });

  test('fails if initializeGpsStorage silently regenerates a replacement key', async () => {
    mutableE2eConfig.gpsLostKeyDestructive = true;
    bootstrapValues.set(E2E_GPS_LOST_KEY_PHASE_KEY, E2E_GPS_LOST_KEY_PHASE_ARMED);
    secureKey = null;
    mockInitializeGpsStorage.mockImplementation(async () => {
      secureKey = 'cd'.repeat(32);
      return null;
    });

    await expect(runE2eGpsLostKeyHarnessIfEnabled()).rejects.toThrow(
      /silently generated a replacement key/,
    );

    expect(logSpy).not.toHaveBeenCalledWith('[E2E GPS LOST KEY] FAIL_CLOSED');
  });

  test('is a no-op outside development even when explicitly armed', async () => {
    mutableE2eConfig.gpsLostKeyDestructive = true;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    await runE2eGpsLostKeyHarnessIfEnabled();

    expect(mockCreateAppMmkv).not.toHaveBeenCalled();
    expect(mockInitializeGpsStorage).not.toHaveBeenCalled();
    expect(mockSecureStoreDeleteItemAsync).not.toHaveBeenCalled();
  });
});
