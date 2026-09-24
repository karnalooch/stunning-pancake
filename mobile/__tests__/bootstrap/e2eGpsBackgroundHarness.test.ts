/* eslint-env jest */

const mockInitializeGpsStorage = jest.fn();
const mockLoadTrackingState = jest.fn();
const mockStartTracking = jest.fn();
const mockResumeTrackingAfterRelaunch = jest.fn();
const mockGetCurrentAppState = jest.fn();
const mockRemoveAppStateListener = jest.fn();
const mockAddAppStateListener = jest.fn();
let mockAppStateChangeListener: ((state: string) => void) | undefined;
let mockNativeAppState = 'active';

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (...args: unknown[]) => mockAddAppStateListener(...args),
  },
  NativeModules: {
    AppState: {
      getCurrentAppState: (...args: unknown[]) => mockGetCurrentAppState(...args),
    },
  },
}));

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
    mockNativeAppState = 'active';
    mockAppStateChangeListener = undefined;
    mockAddAppStateListener.mockImplementation(
      (_event: string, listener: (state: string) => void) => {
        mockAppStateChangeListener = listener;
        return { remove: mockRemoveAppStateListener };
      },
    );
    mockGetCurrentAppState.mockImplementation((success: (state: object) => void) => {
      success({ app_state: mockNativeAppState });
    });
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  test('is disabled by default', async () => {
    await runE2eGpsBackgroundHarnessIfEnabled();
    expect(mockInitializeGpsStorage).not.toHaveBeenCalled();
  });

  test('starts immediately when the app is already active', async () => {
    mutableConfig.gpsBackgroundProof = true;

    await runE2eGpsBackgroundHarnessIfEnabled();

    expect(mockGetCurrentAppState).toHaveBeenCalledTimes(1);
    expect(mockRemoveAppStateListener).toHaveBeenCalledTimes(1);
    expect(GpsSyncManager).toHaveBeenCalledWith(E2E_GPS_BACKGROUND_DEVICE_ID, null);
    expect(mockStartTracking).toHaveBeenCalledWith(
      E2E_GPS_BACKGROUND_ACTIVITY_ID,
      'BALANCED',
    );
  });

  test('waits through a delayed dev-client handoff before starting GPS', async () => {
    mutableConfig.gpsBackgroundProof = true;
    mockNativeAppState = 'background';

    const harnessPromise = runE2eGpsBackgroundHarnessIfEnabled();
    await Promise.resolve();

    expect(mockStartTracking).not.toHaveBeenCalled();
    mockAppStateChangeListener?.('active');
    await harnessPromise;

    expect(mockStartTracking).toHaveBeenCalledWith(
      E2E_GPS_BACKGROUND_ACTIVITY_ID,
      'BALANCED',
    );
  });

  test('fails closed when the app never becomes active before the timeout', async () => {
    mutableConfig.gpsBackgroundProof = true;
    mockNativeAppState = 'background';

    const harnessPromise = runE2eGpsBackgroundHarnessIfEnabled();
    const rejection = expect(harnessPromise).rejects.toThrow(
      /app did not become active within 15000ms/,
    );

    await jest.advanceTimersByTimeAsync(15_000);
    await rejection;

    expect(mockInitializeGpsStorage).not.toHaveBeenCalled();
    expect(mockStartTracking).not.toHaveBeenCalled();
  });

  test('removes the AppState listener after the wait settles', async () => {
    mutableConfig.gpsBackgroundProof = true;
    mockNativeAppState = 'background';

    const harnessPromise = runE2eGpsBackgroundHarnessIfEnabled();
    await Promise.resolve();
    mockAppStateChangeListener?.('active');
    await harnessPromise;

    expect(mockRemoveAppStateListener).toHaveBeenCalledTimes(1);
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
