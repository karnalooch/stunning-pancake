/* eslint-env jest */

const mockMmkvStores = new Map<string, Map<string, string>>();
const mockMmkvConfigs: Array<{ id?: string; encryptionKey?: string }> = [];
const mockMmkvSetFailures = new Set<string>();

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation((config: { id?: string; encryptionKey?: string } = {}) => {
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
        if (mockMmkvSetFailures.has(`${id}:${key}`)) return;
        data!.set(key, value);
      }),
      delete: jest.fn((key: string) => data!.delete(key)),
    };
  }),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
}));

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { GPS_STORAGE_KEYS } from '../../src/services/gpsSyncStorage';
import {
  __GPS_ENCRYPTED_STORAGE_TEST_CONSTANTS as constants,
  __resetEncryptedGpsStorageForTests,
  getGpsStorage,
  initializeGpsStorage,
} from '../../src/services/gpsEncryptedStorage';

const secureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const crypto = Crypto as jest.Mocked<typeof Crypto>;

function store(id: string): Map<string, string> {
  let value = mockMmkvStores.get(id);
  if (!value) {
    value = new Map<string, string>();
    mockMmkvStores.set(id, value);
  }
  return value;
}

describe('encrypted GPS MMKV', () => {
  let secureValue: string | null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMmkvStores.clear();
    mockMmkvConfigs.length = 0;
    mockMmkvSetFailures.clear();
    __resetEncryptedGpsStorageForTests();
    secureValue = null;

    secureStore.isAvailableAsync.mockResolvedValue(true);
    secureStore.getItemAsync.mockImplementation(async () => secureValue);
    secureStore.setItemAsync.mockImplementation(async (_key, value) => {
      secureValue = value;
    });
    crypto.getRandomBytesAsync.mockResolvedValue(
      Uint8Array.from({ length: 32 }, (_, index) => index + 1),
    );
  });

  test('generates a 256-bit key, persists it in SecureStore and opens only encrypted GPS MMKV', async () => {
    const storage = await initializeGpsStorage();

    expect(storage).not.toBeNull();
    expect(crypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
    expect(secureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      constants.keyAlias,
      expect.stringMatching(/^[0-9a-f]{64}$/),
      { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK },
    );
    expect(mockMmkvConfigs).toContainEqual({
      id: constants.encryptedStorageId,
      encryptionKey: secureValue,
    });
    expect(getGpsStorage()).toBe(storage);
    expect(store(constants.bootstrapStorageId).get(constants.provisionedMarker)).toBe('1');
  });

  test('reopens the encrypted store with the same protected key without regenerating it', async () => {
    secureValue = 'ab'.repeat(32);

    await initializeGpsStorage();
    __resetEncryptedGpsStorageForTests();
    await initializeGpsStorage();

    expect(crypto.getRandomBytesAsync).not.toHaveBeenCalled();
    const encryptedConfigs = mockMmkvConfigs.filter(
      (config) => config.id === constants.encryptedStorageId,
    );
    expect(encryptedConfigs).toHaveLength(2);
    expect(encryptedConfigs.every((config) => config.encryptionKey === secureValue)).toBe(true);
    expect(store(constants.bootstrapStorageId).get(constants.provisionedMarker)).toBe('1');
  });

  test('migrates pending GPS and outbox values before deleting plaintext legacy copies', async () => {
    const legacy = store(constants.legacyStorageId);
    const buffer = JSON.stringify([{ activity_id: 42, seq: 7, lat: 52.1, lon: 22.2 }]);
    const outbox = JSON.stringify([{ client_batch_id: 'pending-1', state: 'pending' }]);
    const finalization = JSON.stringify({ activity_id: 42, distance_m: 1234, attempts: 1 });
    legacy.set(GPS_STORAGE_KEYS.BUFFER, buffer);
    legacy.set(GPS_STORAGE_KEYS.OUTBOX, outbox);
    legacy.set(GPS_STORAGE_KEYS.PENDING_FINALIZATION, finalization);
    legacy.set('ride_wall_start_ms', '123456');

    const storage = await initializeGpsStorage();
    const encrypted = store(constants.encryptedStorageId);

    expect(storage).not.toBeNull();
    expect(encrypted.get(GPS_STORAGE_KEYS.BUFFER)).toBe(buffer);
    expect(encrypted.get(GPS_STORAGE_KEYS.OUTBOX)).toBe(outbox);
    expect(encrypted.get(GPS_STORAGE_KEYS.PENDING_FINALIZATION)).toBe(finalization);
    expect(encrypted.get('ride_wall_start_ms')).toBe('123456');
    expect(legacy.has(GPS_STORAGE_KEYS.BUFFER)).toBe(false);
    expect(legacy.has(GPS_STORAGE_KEYS.OUTBOX)).toBe(false);
    expect(legacy.has(GPS_STORAGE_KEYS.PENDING_FINALIZATION)).toBe(false);
    expect(legacy.has('ride_wall_start_ms')).toBe(false);
  });

  test('keeps the legacy recovery copy when an encrypted write cannot be verified', async () => {
    secureValue = 'ef'.repeat(32);
    const legacy = store(constants.legacyStorageId);
    const buffer = JSON.stringify([{ activity_id: 77, seq: 3, lat: 52.2, lon: 22.3 }]);
    legacy.set(GPS_STORAGE_KEYS.BUFFER, buffer);
    mockMmkvSetFailures.add(`${constants.encryptedStorageId}:${GPS_STORAGE_KEYS.BUFFER}`);

    const storage = await initializeGpsStorage();

    expect(storage).toBeNull();
    expect(getGpsStorage()).toBeNull();
    expect(legacy.get(GPS_STORAGE_KEYS.BUFFER)).toBe(buffer);
    expect(store(constants.encryptedStorageId).has(GPS_STORAGE_KEYS.BUFFER)).toBe(false);
    expect(store(constants.bootstrapStorageId).get(constants.provisionedMarker)).toBe('1');
  });

  test('fails closed and keeps plaintext recovery copy when migration conflicts', async () => {
    secureValue = 'cd'.repeat(32);
    store(constants.legacyStorageId).set(GPS_STORAGE_KEYS.OUTBOX, 'legacy-pending');
    store(constants.encryptedStorageId).set(GPS_STORAGE_KEYS.OUTBOX, 'different-value');

    const storage = await initializeGpsStorage();

    expect(storage).toBeNull();
    expect(getGpsStorage()).toBeNull();
    expect(store(constants.legacyStorageId).get(GPS_STORAGE_KEYS.OUTBOX)).toBe('legacy-pending');
    expect(store(constants.encryptedStorageId).get(GPS_STORAGE_KEYS.OUTBOX)).toBe('different-value');
  });

  test('does not silently replace a lost key after encrypted storage was provisioned', async () => {
    store(constants.bootstrapStorageId).set(constants.provisionedMarker, '1');

    const storage = await initializeGpsStorage();

    expect(storage).toBeNull();
    expect(crypto.getRandomBytesAsync).not.toHaveBeenCalled();
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
    expect(
      mockMmkvConfigs.some((config) => config.id === constants.encryptedStorageId),
    ).toBe(false);
  });

  test('SecureStore write failure fails closed before encrypted MMKV is opened', async () => {
    secureStore.setItemAsync.mockRejectedValueOnce(new Error('keystore write failed'));

    const storage = await initializeGpsStorage();

    expect(storage).toBeNull();
    expect(getGpsStorage()).toBeNull();
    expect(store(constants.bootstrapStorageId).has(constants.provisionedMarker)).toBe(false);
    expect(
      mockMmkvConfigs.some((config) => config.id === constants.encryptedStorageId),
    ).toBe(false);
  });

  test('SecureStore failure never falls back to plaintext GPS MMKV', async () => {
    secureStore.isAvailableAsync.mockResolvedValue(false);

    const storage = await initializeGpsStorage();

    expect(storage).toBeNull();
    expect(getGpsStorage()).toBeNull();
    expect(
      mockMmkvConfigs.some(
        (config) =>
          config.id === constants.encryptedStorageId || config.id === constants.legacyStorageId,
      ),
    ).toBe(false);
  });
});
