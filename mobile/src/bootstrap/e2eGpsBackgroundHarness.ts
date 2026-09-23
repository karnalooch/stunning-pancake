/**
 * DEV-only bootstrap for the physical locked/background GPS durability proof.
 *
 * The harness does NOT inject GPS points and does NOT bypass the production
 * tracking implementation. It only starts the real GpsSyncManager with a
 * deterministic activity id so the Android emulator can drive expo-location
 * with real `adb emu geo fix` updates while the app is backgrounded/locked.
 */
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

export async function runE2eGpsBackgroundHarnessIfEnabled(): Promise<void> {
  if (!__DEV__) return;
  if (!e2eConfig.gpsBackgroundProof) return;

  if (e2eConfig.gpsRecoverySeed || e2eConfig.gpsLostKeyDestructive) {
    throw new Error(
      '[E2E GPS BG] background proof is mutually exclusive with other GPS E2E harnesses',
    );
  }

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
