/**
 * GPS recovery after stop with pending upload (Q-P0-2).
 */

import {
  appendToBuffer,
  appendToOutbox,
  GPS_STORAGE_KEYS,
  GpsStorageAdapter,
  isRecoveryPending,
  loadTrackingState,
  pendingPointCount,
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
  lat: 52.1,
  lon: 21.0,
  altitude_m: 100,
  speed_ms: 3,
  accuracy_m: 5,
  timestamp: ts,
});

/** Mirrors GpsSyncManager.stopTracking tail when upload could not drain. */
function applyStopWithPendingUpload(storage: GpsStorageAdapter): number {
  const state = loadTrackingState(storage);
  const activityId = state?.activityId ?? null;
  const pendingUpload = pendingPointCount(storage);

  if (activityId && pendingUpload > 0) {
    setRecoveryPending(storage, true);
  }

  storage.set(
    GPS_STORAGE_KEYS.TRACKING_STATE,
    JSON.stringify({
      ...(state ?? {
        deviceId: 'dev-1',
        userId: 1,
        lastCoord: null,
        lastAltitude: null,
      }),
      isTracking: false,
      activityId: pendingUpload > 0 ? activityId : null,
    }),
  );

  return pendingUpload;
}

describe('gpsSyncRecovery', () => {
  test('stop with pending outbox sets recovery and keeps activity id', () => {
    const storage = mockStorage();
    storage.set(
      GPS_STORAGE_KEYS.TRACKING_STATE,
      JSON.stringify({
        isTracking: true,
        activityId: 42,
        deviceId: 'dev-1',
        userId: 1,
        lastCoord: null,
        lastAltitude: null,
      }),
    );
    appendToOutbox(storage, {
      client_batch_id: 'batch-stop',
      points: [samplePoint(1), samplePoint(2)],
      created_at: Date.now(),
      attempts: 1,
      state: 'pending',
      activity_id: 42,
    });

    const pendingUpload = applyStopWithPendingUpload(storage);

    expect(pendingUpload).toBe(2);
    expect(isRecoveryPending(storage)).toBe(true);
    expect(loadTrackingState(storage)?.activityId).toBe(42);
    expect(loadTrackingState(storage)?.isTracking).toBe(false);
  });

  test('buffer points count toward pending upload after failed snapshot', () => {
    const storage = mockStorage();
    appendToBuffer(storage, samplePoint(10));
    appendToBuffer(storage, samplePoint(11));
    expect(pendingPointCount(storage)).toBe(2);
  });
});
