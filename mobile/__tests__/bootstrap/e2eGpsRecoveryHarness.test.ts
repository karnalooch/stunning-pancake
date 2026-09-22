/* eslint-env jest */

const mockInitializeGpsStorage = jest.fn();

jest.mock('../../src/services/gpsEncryptedStorage', () => ({
  initializeGpsStorage: (...args: unknown[]) =>
    mockInitializeGpsStorage(...args),
}));

jest.mock('../../src/bootstrap/e2eConfig', () => ({
  e2eConfig: {
    gpsRecoverySeed: false,
  },
}));

import {
  E2E_GPS_RECOVERY_CANARY_KEY,
  E2E_GPS_RECOVERY_CANARY_VALUE,
  runE2eGpsRecoveryHarnessIfEnabled,
} from '../../src/bootstrap/e2eGpsRecoveryHarness';
import { e2eConfig } from '../../src/bootstrap/e2eConfig';

const mutableE2eConfig = e2eConfig as { gpsRecoverySeed: boolean };

const values = new Map<string, string>();

const storage = {
  getString: jest.fn((key: string) => values.get(key)),
  set: jest.fn((key: string, value: string) => {
    values.set(key, value);
  }),
  delete: jest.fn((key: string) => {
    values.delete(key);
  }),
  clearAll: jest.fn(() => {
    values.clear();
  }),
  getAllKeys: jest.fn(() => [...values.keys()]),
  contains: jest.fn((key: string) => values.has(key)),
};

describe('e2eGpsRecoveryHarness', () => {
  let logSpy: jest.SpyInstance;
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
    values.clear();

    mutableE2eConfig.gpsRecoverySeed = false;

    mockInitializeGpsStorage.mockResolvedValue(storage);

    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    logSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  test('is disabled by default and writes nothing to the encrypted store', async () => {
    mutableE2eConfig.gpsRecoverySeed = false;

    await runE2eGpsRecoveryHarnessIfEnabled();

    expect(mockInitializeGpsStorage).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  test('seeds the canary key on empty storage and logs SEEDED', async () => {
    mutableE2eConfig.gpsRecoverySeed = true;

    await runE2eGpsRecoveryHarnessIfEnabled();

    expect(mockInitializeGpsStorage).toHaveBeenCalledTimes(1);

    expect(values.get(E2E_GPS_RECOVERY_CANARY_KEY)).toBe(
      E2E_GPS_RECOVERY_CANARY_VALUE,
    );

    expect(storage.set).toHaveBeenCalledWith(
      E2E_GPS_RECOVERY_CANARY_KEY,
      E2E_GPS_RECOVERY_CANARY_VALUE,
    );

    expect(logSpy).toHaveBeenCalledWith('[E2E GPS RECOVERY] SEEDED');
  });

  test('recovers the canary key on subsequent launches and logs RECOVERED without overwriting', async () => {
    values.set(
      E2E_GPS_RECOVERY_CANARY_KEY,
      E2E_GPS_RECOVERY_CANARY_VALUE,
    );

    mutableE2eConfig.gpsRecoverySeed = true;

    await runE2eGpsRecoveryHarnessIfEnabled();

    expect(storage.set).not.toHaveBeenCalled();

    expect(logSpy).toHaveBeenCalledWith('[E2E GPS RECOVERY] RECOVERED');
  });

  test('throws on canary value mismatch and does not overwrite', async () => {
    values.set(E2E_GPS_RECOVERY_CANARY_KEY, 'corrupted');

    mutableE2eConfig.gpsRecoverySeed = true;

    await expect(
      runE2eGpsRecoveryHarnessIfEnabled(),
    ).rejects.toThrow(/mismatch/);

    expect(values.get(E2E_GPS_RECOVERY_CANARY_KEY)).toBe('corrupted');

    expect(storage.set).not.toHaveBeenCalled();
  });

  test('throws when initializeGpsStorage returns null', async () => {
    mutableE2eConfig.gpsRecoverySeed = true;
    mockInitializeGpsStorage.mockResolvedValue(null);

    await expect(
      runE2eGpsRecoveryHarnessIfEnabled(),
    ).rejects.toThrow(/initializeGpsStorage/);
  });

  test('is a no-op when __DEV__ is false even if the flag is enabled', async () => {
    mutableE2eConfig.gpsRecoverySeed = true;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    await runE2eGpsRecoveryHarnessIfEnabled();

    expect(mockInitializeGpsStorage).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });
});
