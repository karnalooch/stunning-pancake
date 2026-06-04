/**
 * GPS outbox / buffer persistence unit tests
 * Run: npm test -- __tests__/services/gpsSyncStorage.test.ts
 */

import {
  appendToOutbox,
  appendToBuffer,
  createClientBatchId,
  GPS_STORAGE_KEYS,
  GpsStorageAdapter,
  loadBuffer,
  isRecoveryPending,
  loadOutbox,
  mergeRouteCoordinates,
  MAX_BUFFER_SIZE,
  pendingPointCount,
  removeOutboxEntry,
  saveBuffer,
  setRecoveryPending,
} from '../../src/services/gpsSyncStorage';

function mockStorage(): GpsStorageAdapter & { _data: Record<string, string> } {
  const _data: Record<string, string> = {};
  return {
    _data,
    getString(key: string) {
      return _data[key] ?? null;
    },
    set(key: string, value: string) {
      _data[key] = value;
    },
    delete(key: string) {
      delete _data[key];
    },
  };
}

const samplePoint = (ts: number) => ({
  device_id: 'dev-1',
  user_id: 1,
  activity_id: 42,
  lat: 52.1 + ts * 0.0001,
  lon: 21.0,
  altitude_m: 100,
  speed_ms: 3,
  accuracy_m: 5,
  timestamp: ts,
});

describe('gpsSyncStorage', () => {
  test('appendToOutbox persists and removeOutboxEntry clears entry', () => {
    const storage = mockStorage();
    appendToOutbox(storage, {
      client_batch_id: 'batch-a',
      points: [samplePoint(1)],
      created_at: Date.now(),
      attempts: 1,
    });
    expect(loadOutbox(storage)).toHaveLength(1);
    removeOutboxEntry(storage, 'batch-a');
    expect(loadOutbox(storage)).toHaveLength(0);
  });

  test('buffer spills to overflow when exceeding MAX_BUFFER_SIZE', () => {
    const storage = mockStorage();
    const points = Array.from({ length: MAX_BUFFER_SIZE + 100 }, (_, i) =>
      samplePoint(i),
    );
    saveBuffer(storage, points);
    expect(storage.getString(GPS_STORAGE_KEYS.BUFFER_OVERFLOW)).toBeTruthy();
    expect(loadBuffer(storage)).toHaveLength(MAX_BUFFER_SIZE + 100);
  });

  test('mergeRouteCoordinates dedupes shared endpoint', () => {
    const existing: [number, number][] = [
      [21, 52],
      [21.01, 52.01],
    ];
    const incoming: [number, number][] = [
      [21.01, 52.01],
      [21.02, 52.02],
    ];
    const merged = mergeRouteCoordinates(existing, incoming);
    expect(merged).toHaveLength(3);
    expect(merged[0]).toEqual([21, 52]);
    expect(merged[2]).toEqual([21.02, 52.02]);
  });

  test('createClientBatchId returns uuid-like string', () => {
    const id = createClientBatchId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  test('appendToBuffer round-trips through loadBuffer', () => {
    const storage = mockStorage();
    appendToBuffer(storage, samplePoint(100));
    appendToBuffer(storage, samplePoint(101));
    expect(loadBuffer(storage)).toHaveLength(2);
  });

  test('pendingPointCount includes buffer and outbox points', () => {
    const storage = mockStorage();
    appendToBuffer(storage, samplePoint(1));
    appendToOutbox(storage, {
      client_batch_id: 'batch-pending',
      points: [samplePoint(2), samplePoint(3)],
      created_at: Date.now(),
      attempts: 0,
      state: 'syncing',
      activity_id: 42,
    });
    expect(pendingPointCount(storage)).toBe(3);
  });

  test('recovery pending flag round-trips', () => {
    const storage = mockStorage();
    expect(isRecoveryPending(storage)).toBe(false);
    setRecoveryPending(storage, true);
    expect(isRecoveryPending(storage)).toBe(true);
    expect(storage.getString(GPS_STORAGE_KEYS.RECOVERY_PENDING)).toBe('true');
    setRecoveryPending(storage, false);
    expect(isRecoveryPending(storage)).toBe(false);
  });
});
