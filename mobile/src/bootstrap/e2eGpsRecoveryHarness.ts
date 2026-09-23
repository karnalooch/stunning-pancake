/**
 * E2E harness for the existing `EXPO_PUBLIC_E2E_GPS_RECOVERY` flag.
 *
 * Physical proof flow on the real encrypted MMKV (`gps-buffer-encrypted-v1`):
 *
 *   SEEDED   -> `adb shell am force-stop`   -> new process   -> RECOVERED
 *
 * Guarded by `__DEV__` + `e2eConfig.gpsRecoverySeed` so production builds
 * (`EAS_BUILD_PROFILE=production`) keep failing closed — the production guard
 * in `app.config.js` already rejects `EXPO_PUBLIC_E2E_GPS_RECOVERY=true`.
 */
import { e2eConfig } from './e2eConfig';
import { initializeGpsStorage } from '../services/gpsEncryptedStorage';

export const E2E_GPS_RECOVERY_CANARY_KEY = '__e2e_encrypted_gps_recovery_canary_v1';
export const E2E_GPS_RECOVERY_CANARY_VALUE = '4velo-encrypted-gps-recovery-v1';

/**
 * Run the encrypted-GPS recovery harness when:
 *   - this is a development build (`__DEV__ === true`)
 *   - the E2E flag is enabled via `EXPO_PUBLIC_E2E_GPS_RECOVERY=true`
 *
 * Otherwise this is a no-op.
 *
 * Never call this from production paths. Even with the runtime guards the
 * E2E flag is rejected by the `app.config.js` production guard, so production
 * bundles never reach this function with the flag enabled.
 */
export async function runE2eGpsRecoveryHarnessIfEnabled(): Promise<void> {
  if (!__DEV__) return;
  if (!e2eConfig.gpsRecoverySeed) return;

  if (e2eConfig.gpsLostKeyDestructive || e2eConfig.gpsBackgroundProof) {
    throw new Error(
      '[E2E GPS RECOVERY] recovery proof is mutually exclusive with other GPS E2E harnesses',
    );
  }

  const storage = await initializeGpsStorage();
  if (storage == null) {
    throw new Error(
      '[E2E GPS RECOVERY] initializeGpsStorage() returned null; encrypted GPS MMKV unavailable',
    );
  }

  const existing = storage.getString(E2E_GPS_RECOVERY_CANARY_KEY);

  if (existing == null) {
    storage.set(E2E_GPS_RECOVERY_CANARY_KEY, E2E_GPS_RECOVERY_CANARY_VALUE);
    const readback = storage.getString(E2E_GPS_RECOVERY_CANARY_KEY);
    if (readback !== E2E_GPS_RECOVERY_CANARY_VALUE) {
      throw new Error(
        `[E2E GPS RECOVERY] SEEDED write did not round-trip (got ${readback ?? 'null'})`,
      );
    }
    // eslint-disable-next-line no-console
    console.log('[E2E GPS RECOVERY] SEEDED');
    return;
  }

  if (existing === E2E_GPS_RECOVERY_CANARY_VALUE) {
    // eslint-disable-next-line no-console
    console.log('[E2E GPS RECOVERY] RECOVERED');
    return;
  }

  throw new Error(
    '[E2E GPS RECOVERY] canary value mismatch; existing storage does not match harness value',
  );
}