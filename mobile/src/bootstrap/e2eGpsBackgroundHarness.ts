/**
 * DEV-only bootstrap for the physical locked/background GPS durability proof.
 *
 * The harness does NOT inject GPS points and does NOT bypass the production
 * tracking implementation. It only starts the real GpsSyncManager with a
 * deterministic activity id so the Android emulator can drive expo-location
 * with real `adb emu geo fix` updates while the app is backgrounded/locked.
 */
import { AppState, NativeModules, type AppStateStatus } from 'react-native';

import { e2eConfig } from './e2eConfig';
import {
  GpsSyncManager,
  PollingResolution,
  resumeTrackingAfterRelaunch,
} from '../services/GpsSyncManager';
import { initializeGpsStorage } from '../services/gpsEncryptedStorage';
import { loadTrackingState } from '../services/gpsSyncStorage';

export const E2E_GPS_BACKGROUND_ACTIVITY_ID = 980000001;
export const E2E_GPS_BACKGROUND_DEVICE_ID = 'e2e-gps-background-proof';
const E2E_GPS_BACKGROUND_APP_STATE_TIMEOUT_MS = 15_000;
const E2E_GPS_BACKGROUND_APP_STATE_RECHECK_MS = 250;

type NativeAppStateModule = {
  getCurrentAppState: (
    success: (state: { app_state: string }) => void,
    failure: (error: unknown) => void,
  ) => void;
};

async function readNativeAppState(): Promise<string> {
  const appStateModule = NativeModules.AppState as NativeAppStateModule | undefined;
  if (!appStateModule?.getCurrentAppState) {
    throw new Error('[E2E GPS BG] native AppState module unavailable');
  }

  return new Promise<string>((resolve, reject) => {
    appStateModule.getCurrentAppState(
      (state) => resolve(state.app_state),
      (error) => reject(error),
    );
  });
}

async function waitForAppActive(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let checkingNativeState = false;
    let recheckTimer: ReturnType<typeof setInterval> | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    let subscription: ReturnType<typeof AppState.addEventListener> | undefined;

    const cleanup = () => {
      if (recheckTimer) clearInterval(recheckTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      subscription?.remove();
    };

    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };

    const checkNativeState = async () => {
      if (settled || checkingNativeState) return;
      checkingNativeState = true;
      try {
        if ((await readNativeAppState()) === 'active') {
          finish();
        }
      } catch (error) {
        finish(error);
      } finally {
        checkingNativeState = false;
      }
    };

    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') finish();
      else void checkNativeState();
    };

    subscription = AppState.addEventListener('change', handleAppStateChange);
    recheckTimer = setInterval(
      () => void checkNativeState(),
      E2E_GPS_BACKGROUND_APP_STATE_RECHECK_MS,
    );
    timeoutTimer = setTimeout(
      () =>
        finish(
          new Error(
            `[E2E GPS BG] app did not become active within ${E2E_GPS_BACKGROUND_APP_STATE_TIMEOUT_MS}ms`,
          ),
        ),
      E2E_GPS_BACKGROUND_APP_STATE_TIMEOUT_MS,
    );

    void checkNativeState();
  });
}

export async function runE2eGpsBackgroundHarnessIfEnabled(): Promise<void> {
  if (!__DEV__) return;
  if (!e2eConfig.gpsBackgroundProof) return;

  if (e2eConfig.gpsRecoverySeed || e2eConfig.gpsLostKeyDestructive) {
    throw new Error(
      '[E2E GPS BG] background proof is mutually exclusive with other GPS E2E harnesses',
    );
  }

  // Android rejects foreground-service startup while the Expo dev-client is
  // still handing off from its launcher activity. Query native AppState so the
  // gate remains reliable even if this proof APK's React frame scheduler or UI
  // fails to commit.
  await waitForAppActive();

  const storage = await initializeGpsStorage();
  if (!storage) {
    throw new Error('[E2E GPS BG] durable encrypted GPS storage unavailable');
  }

  const state = loadTrackingState(storage);

  if (state?.isTracking) {
    if (state.activityId !== E2E_GPS_BACKGROUND_ACTIVITY_ID) {
      throw new Error(
        `[E2E GPS BG] refusing to replace active activityId=${state.activityId ?? 'null'}`,
      );
    }

    const resumed = await resumeTrackingAfterRelaunch();
    if (!resumed) {
      throw new Error('[E2E GPS BG] active proof ride could not resume after relaunch');
    }
    return;
  }

  if (state?.activityId != null && state.activityId !== E2E_GPS_BACKGROUND_ACTIVITY_ID) {
    throw new Error(
      `[E2E GPS BG] refusing to overwrite persisted activityId=${state.activityId}`,
    );
  }

  const manager = new GpsSyncManager(E2E_GPS_BACKGROUND_DEVICE_ID, null);
  await manager.startTracking(
    E2E_GPS_BACKGROUND_ACTIVITY_ID,
    PollingResolution.BALANCED,
  );
}
