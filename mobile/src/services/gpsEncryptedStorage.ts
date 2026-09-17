/**
 * Encrypted durable GPS storage (DS-014).
 *
 * The MMKV encryption key is generated with native cryptographic randomness and
 * protected by Expo SecureStore / Android Keystore / iOS Keychain. Critical GPS
 * data never falls back to plaintext or in-memory storage.
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';

import { GPS_STORAGE_KEYS, type GpsStorageAdapter } from './gpsSyncStorage';
import { warnMmkvUnavailable } from './mmkvSupport';

const GPS_ENCRYPTION_KEY_ALIAS = '4velo.gps.mmkv.encryption-key-v1';
const GPS_ENCRYPTED_STORAGE_ID = 'gps-buffer-encrypted-v1';
const GPS_LEGACY_STORAGE_ID = 'gps-buffer';
const GPS_BOOTSTRAP_STORAGE_ID = 'gps-storage-bootstrap';
const GPS_KEY_PROVISIONED_MARKER = 'encryption-key-provisioned-v1';
const RIDE_WALL_START_KEY = 'ride_wall_start_ms';

const MIGRATED_KEYS = [
  ...Object.values(GPS_STORAGE_KEYS),
  RIDE_WALL_START_KEY,
] as const;

let storage: MMKV | null = null;
let storageOverride: GpsStorageAdapter | null = null;
let initialization: Promise<GpsStorageAdapter | null> | null = null;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function generateEncryptionKey(): Promise<string> {
  return bytesToHex(await Crypto.getRandomBytesAsync(32));
}

function migrateLegacyGpsStorage(target: MMKV): void {
  const legacy = new MMKV({ id: GPS_LEGACY_STORAGE_ID });
  const values = new Map<string, string>();

  for (const key of MIGRATED_KEYS) {
    const legacyValue = legacy.getString(key);
    if (legacyValue == null) continue;
    const encryptedValue = target.getString(key);
    if (encryptedValue != null && encryptedValue !== legacyValue) {
      throw new Error(`Encrypted GPS migration conflict for ${key}`);
    }
    values.set(key, legacyValue);
  }

  for (const [key, value] of values) {
    if (target.getString(key) == null) target.set(key, value);
  }

  // Verify every copied value before deleting the only legacy copy. A crash or
  // write failure therefore leaves the plaintext store recoverable instead of
  // silently losing unacknowledged GPS data.
  for (const [key, value] of values) {
    if (target.getString(key) !== value) {
      throw new Error(`Encrypted GPS migration verification failed for ${key}`);
    }
  }

  for (const key of values.keys()) legacy.delete(key);
}

async function initializeEncryptedGpsStorage(): Promise<GpsStorageAdapter | null> {
  try {
    if (!(await SecureStore.isAvailableAsync())) {
      throw new Error('SecureStore is unavailable for GPS encryption');
    }

    const bootstrap = new MMKV({ id: GPS_BOOTSTRAP_STORAGE_ID });
    const wasProvisioned = bootstrap.getString(GPS_KEY_PROVISIONED_MARKER) === '1';
    let encryptionKey = await SecureStore.getItemAsync(GPS_ENCRYPTION_KEY_ALIAS);

    if (!encryptionKey) {
      // If provisioning previously completed, generating a replacement key
      // would make existing encrypted GPS data unreadable. Fail closed and keep
      // the encrypted file untouched for explicit recovery instead.
      if (wasProvisioned) {
        throw new Error('GPS encryption key is missing after prior provisioning');
      }

      encryptionKey = await generateEncryptionKey();
      await SecureStore.setItemAsync(GPS_ENCRYPTION_KEY_ALIAS, encryptionKey, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
      const persisted = await SecureStore.getItemAsync(GPS_ENCRYPTION_KEY_ALIAS);
      if (persisted !== encryptionKey) {
        throw new Error('GPS encryption key persistence verification failed');
      }
    }

    const encrypted = new MMKV({
      id: GPS_ENCRYPTED_STORAGE_ID,
      encryptionKey,
    });
    migrateLegacyGpsStorage(encrypted);
    bootstrap.set(GPS_KEY_PROVISIONED_MARKER, '1');
    storage = encrypted;
    return encrypted as GpsStorageAdapter;
  } catch (error) {
    warnMmkvUnavailable('EncryptedGpsStorage', error);
    return null;
  }
}

/**
 * Initialize or reopen encrypted GPS storage. Safe to call concurrently from
 * foreground code and the Expo TaskManager background location task.
 */
export async function initializeGpsStorage(): Promise<GpsStorageAdapter | null> {
  if (storageOverride) return storageOverride;
  if (storage) return storage as GpsStorageAdapter;
  if (!initialization) {
    initialization = initializeEncryptedGpsStorage().finally(() => {
      initialization = null;
    });
  }
  return initialization;
}

/** Synchronous access is intentionally available only after async bootstrap. */
export function getGpsStorage(): GpsStorageAdapter | null {
  return storageOverride ?? (storage as GpsStorageAdapter | null);
}

/** Test-only: inject a durable adapter and reset native initialization state. */
export function __setGpsStorageForTests(adapter: GpsStorageAdapter | null): void {
  storageOverride = adapter;
  storage = null;
  initialization = null;
}

/** Test-only: reset native state so initialization behavior can be re-exercised. */
export function __resetEncryptedGpsStorageForTests(): void {
  storageOverride = null;
  storage = null;
  initialization = null;
}

export const __GPS_ENCRYPTED_STORAGE_TEST_CONSTANTS = {
  keyAlias: GPS_ENCRYPTION_KEY_ALIAS,
  encryptedStorageId: GPS_ENCRYPTED_STORAGE_ID,
  legacyStorageId: GPS_LEGACY_STORAGE_ID,
  bootstrapStorageId: GPS_BOOTSTRAP_STORAGE_ID,
  provisionedMarker: GPS_KEY_PROVISIONED_MARKER,
} as const;
