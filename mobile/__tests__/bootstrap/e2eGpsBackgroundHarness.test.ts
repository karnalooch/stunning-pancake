/* eslint-env jest */

const mockInitializeGpsStorage = jest.fn();
const mockLoadTrackingState = jest.fn();
const mockStartTracking = jest.fn();
const mockResumeTrackingAfterRelaunch = jest.fn();

jest.mock('../../src/services/gpsEncryptedStorage', () => ({
  initializeGpsStorage: (...args: unknown[]) => mockInitializeGpsStorage(...args),
}));

jest.mock('../../src/services/gpsSyncStorage', () => ({
  loadTrackingState: (...args: unknown[]) => mockLoadTrackingState(...args),
}));

jest.mock('../../src/services/GpsSyncManager', () => ({
  GpsSyncManager: jest.fn().mockImplementation(() => ({
    startTracking: mockStartTracking,
  })),
  PollingResolution: { BALANCED: 'BALANCED' },
  resumeTrackingAfterRelaunch: (...args: unknown[]) =>
    mockResumeTrackingAfterRelaunch(...args),
}));

jest.mock('../../src/bootstrap/e2eConfig', () => ({
  e2eConfig: {
    gpsBackgroundProof: false,
    gpsRecoverySeed: false,
    gpsLostKeyDestructive: false,
  },
}));

import {
  E2E_GPS_BACKGROUND_ACTIVITY_ID,
  E2E_GPS_BACKGROUND_DEVICE_ID,
  runE2eGpsBackgroundHarnessIfEnabled,
} from '../../src/bootstrap/e2eGpsBackgroundHarness';
import { e2eConfig } from '../../src/bootstrap/e2eConfig';
import { GpsSyncManager } from '../../src/services/GpsSyncManager';

const mutableConfig = e2eConfig as {
  gpsBackgroundProof: boolean;
  gpsRecoverySeed: boolean;
  gpsLostKeyDestructive: boolean;
};

describe('e2eGpsBackgroundHarness', () => {
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  const storage = {};

  beforeEach(() => {
    jest.clearAllMocks();
    mutableConfig.gpsBackgroundProof = false;
    mutableConfig.gpsRecoverySeed = false;
    mutableConfig.gpsLostKeyDestructive = false;
    mockInitializeGpsStorage.mockResolvedValue(storage);
    mockLoadTrackingState.mockReturnValue(null);
    mockStartTracking.mockResolvedValue(undefined);
    mockResumeTrackingAfterRelaunch.mockResolvedValue(true);
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  });

  afterAll(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  test('is disabled by default', async () => {
    await runE2eGpsBackgroundHarnessIfEnabled();
    expect(mockInitializeGpsStorage).not.toHaveBeenCalled();
  });

  test('starts the real GPS manager with deterministic proof identity', async () => {
    mutableConfig.gpsBackgroundProof = true;

    await runE2eGpsBackgroundHarnessIfEnabled();

    expect(GpsSyncManager).toHaveBeenCalledWith(E2E_GPS_BACKGROUND_DEVICE_ID, null);
    expect(mockStartTracking).toHaveBeenCalledWith(
      E2E_GPS_BACKGROUND_ACTIVITY_ID,
      'BALANCED',
    );
  });

  test('resumes the same proof activity after relaunch', async () => {
    mutableConfig.gpsBackgroundProof = true;
    mockLoadTrackingState.mockReturnValue({
      isTracking: true,
      activityId: E2E_GPS_BACKGROUND_ACTIVITY_ID,
    });

    await runE2eGpsBackgroundHarnessIfEnabled();

    expect(mockStartTracking).not.toHaveBeenCalled();
    expect(mockResumeTrackingAfterRelaunch).toHaveBeenCalledTimes(1);
  });

  test('refuses to overwrite another active ride', async () => {
    mutableConfig.gpsBackgroundProof = true;
    mockLoadTrackingState.mockReturnValue({
      isTracking: true,
      activityId: 42,
    });

    await expect(runE2eGpsBackgroundHarnessIfEnabled()).rejects.toThrow(
      /refusing to replace active activityId=42/,
    );
    expect(mockStartTracking).not.toHaveBeenCalled();
  });

  test('is mutually exclusive with destructive/recovery GPS harnesses', async () => {
    mutableConfig.gpsBackgroundProof = true;
    mutableConfig.gpsLostKeyDestructive = true;

    await expect(runE2eGpsBackgroundHarnessIfEnabled()).rejects.toThrow(
      /mutually exclusive/,
    );
    expect(mockInitializeGpsStorage).not.toHaveBeenCalled();
  });

  test('is a no-op outside development', async () => {
    mutableConfig.gpsBackgroundProof = true;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    await runE2eGpsBackgroundHarnessIfEnabled();

    expect(mockInitializeGpsStorage).not.toHaveBeenCalled();
  });
});
