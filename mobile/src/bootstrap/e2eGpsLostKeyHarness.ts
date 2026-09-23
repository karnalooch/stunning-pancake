/**
 * Destructive DEV-only E2E harness for the encrypted GPS lost-key path.
 *
 * This harness intentionally deletes the SecureStore key protecting the real
 * encrypted GPS MMKV. It MUST run only against disposable app data.
 *
 * Physical proof:
 *
 *   KEY_DELETED -> adb force-stop -> new process -> FAIL_CLOSED
 *
 * Cleanup after the proof:
 *
 *   adb shell pm clear com.sport.athlete
 *
 * Production builds reject EXPO_PUBLIC_E2E_GPS_LOST_KEY and this function also
 * requires __DEV__. The runtime flag additionally requires the explicit value
 * DELETE_GPS_ENCRYPTION_KEY.
 */
import * as SecureStore from 'expo-secure-store';

import { e2eConfig } from './e2eConfig';
import {
  __GPS_ENCRYPTED_STORAGE_TEST_CONSTANTS as gpsConstants,
  initializeGpsStorage,
} from '../services/gpsEncryptedStorage';
import { createAppMmkv } from '../services/mmkvStorage';

export const E2E_GPS_LOST_KEY_PHASE_KEY = '__e2e_gps_lost_key_phase_v1';
export const E2E_GPS_LOST_KEY_PHASE_ARMED = 'armed';
export const E2E_GPS_LOST_KEY_CANARY_KEY = '__e2e_gps_lost_key_canary_v1';
export const E2E_GPS_LOST_KEY_CANARY_VALUE = '4velo-gps-lost-key-v1';

/**
 * Run the destructive lost-key proof only when explicitly armed.
 *
 * First process:
 * - opens the real encrypted GPS store;
 * - proves the provisioning marker and key exist;
 * - writes/reads a dedicated encrypted canary;
 * - persists an unencrypted E2E phase marker;
 * - deletes only the GPS SecureStore key;
 * - logs KEY_DELETED.
 *
 * Second process:
 * - requires the same provisioned marker and missing SecureStore key;
 * - requires initializeGpsStorage() to fail closed with null;
 * - proves no replacement key appeared;
 * - logs FAIL_CLOSED.
 */
export async function runE2eGpsLostKeyHarnessIfEnabled(): Promise<void> {
  if (!__DEV__) return;
  if (!e2eConfig.gpsLostKeyDestructive) return;

  if (e2eConfig.gpsRecoverySeed || e2eConfig.gpsBackgroundProof) {
    throw new Error(
      '[E2E GPS LOST KEY] destructive lost-key and other GPS harnesses are mutually exclusive',
    );
  }

  const bootstrap = createAppMmkv({ id: gpsConstants.bootstrapStorageId });
  const phase = bootstrap.getString(E2E_GPS_LOST_KEY_PHASE_KEY);

  if (phase == null) {
    const encrypted = await initializeGpsStorage();
    if (encrypted == null) {
      throw new Error(
        '[E2E GPS LOST KEY] cannot arm proof because encrypted GPS storage is unavailable',
      );
    }

    if (bootstrap.getString(gpsConstants.provisionedMarker) !== '1') {
      throw new Error(
        '[E2E GPS LOST KEY] provisioning marker missing after encrypted storage initialization',
      );
    }

    const keyBeforeDeletion = await SecureStore.getItemAsync(gpsConstants.keyAlias);
    if (!keyBeforeDeletion) {
      throw new Error(
        '[E2E GPS LOST KEY] encryption key missing before destructive proof was armed',
      );
    }

    const existingCanary = encrypted.getString(E2E_GPS_LOST_KEY_CANARY_KEY);
    if (existingCanary == null) {
      encrypted.set(E2E_GPS_LOST_KEY_CANARY_KEY, E2E_GPS_LOST_KEY_CANARY_VALUE);
      const readback = encrypted.getString(E2E_GPS_LOST_KEY_CANARY_KEY);
      if (readback !== E2E_GPS_LOST_KEY_CANARY_VALUE) {
        throw new Error(
          '[E2E GPS LOST KEY] encrypted canary write did not round-trip before key deletion',
        );
      }
    } else if (existingCanary !== E2E_GPS_LOST_KEY_CANARY_VALUE) {
      throw new Error('[E2E GPS LOST KEY] encrypted canary mismatch before key deletion');
    }

    bootstrap.set(E2E_GPS_LOST_KEY_PHASE_KEY, E2E_GPS_LOST_KEY_PHASE_ARMED);
    if (bootstrap.getString(E2E_GPS_LOST_KEY_PHASE_KEY) !== E2E_GPS_LOST_KEY_PHASE_ARMED) {
      throw new Error('[E2E GPS LOST KEY] destructive phase marker did not persist');
    }

    await SecureStore.deleteItemAsync(gpsConstants.keyAlias);
    const keyAfterDeletion = await SecureStore.getItemAsync(gpsConstants.keyAlias);
    if (keyAfterDeletion != null) {
      throw new Error('[E2E GPS LOST KEY] SecureStore key still exists after deletion');
    }

    // eslint-disable-next-line no-console
    console.log('[E2E GPS LOST KEY] KEY_DELETED');
    return;
  }

  if (phase !== E2E_GPS_LOST_KEY_PHASE_ARMED) {
    throw new Error(`[E2E GPS LOST KEY] unexpected destructive phase marker: ${phase}`);
  }

  if (bootstrap.getString(gpsConstants.provisionedMarker) !== '1') {
    throw new Error(
      '[E2E GPS LOST KEY] provisioning marker disappeared before fail-closed verification',
    );
  }

  const keyBeforeInitialization = await SecureStore.getItemAsync(gpsConstants.keyAlias);
  if (keyBeforeInitialization != null) {
    throw new Error(
      '[E2E GPS LOST KEY] replacement encryption key exists before fail-closed initialization',
    );
  }

  const reopened = await initializeGpsStorage();
  if (reopened != null) {
    throw new Error(
      '[E2E GPS LOST KEY] encrypted GPS storage reopened even though the provisioned key is missing',
    );
  }

  const keyAfterInitialization = await SecureStore.getItemAsync(gpsConstants.keyAlias);
  if (keyAfterInitialization != null) {
    throw new Error(
      '[E2E GPS LOST KEY] initializeGpsStorage() silently generated a replacement key',
    );
  }

  // eslint-disable-next-line no-console
  console.log('[E2E GPS LOST KEY] FAIL_CLOSED');
}
