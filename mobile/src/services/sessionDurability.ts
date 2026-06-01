/**
 * Durable activity session create — isolated from GpsSyncManager to avoid api circular imports.
 */

import { api } from './apiClient';
import {
  clearPendingSession,
  PendingSessionPayload,
  savePendingSession,
  type GpsStorageAdapter,
} from './gpsSyncStorage';
import { MMKV } from 'react-native-mmkv';

let _storage: MMKV | null = null;

function getStorage(): GpsStorageAdapter | null {
  if (!_storage) {
    try {
      _storage = new MMKV({ id: 'gps-buffer' });
    } catch {
      return null;
    }
  }
  return _storage as GpsStorageAdapter;
}

export async function createSessionWithDurability(
  payload: Omit<PendingSessionPayload, 'created_at' | 'attempts'>,
): Promise<number> {
  const storage = getStorage();
  const body: Record<string, unknown> = {
    type: payload.type,
    start_time: payload.start_time,
  };
  if (payload.event_id != null) body.event_id = payload.event_id;

  try {
    const res = await api.post<{ id: number }>('/api/activities/sessions/', body);
    const id = res.data?.id;
    if (!id) throw new Error('Session create returned no id');
    if (storage) clearPendingSession(storage);
    return id;
  } catch (err) {
    if (storage) {
      savePendingSession(storage, {
        ...payload,
        created_at: Date.now(),
        attempts: 0,
      });
    }
    throw err;
  }
}
