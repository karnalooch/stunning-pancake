/**
 * Durable activity session create — isolated from GpsSyncManager to avoid api circular imports.
 */

import { API_PATHS_FULL } from '@4velo/api-client';
import { api } from './apiClient';
import {
  clearPendingSession,
  PendingSessionPayload,
  savePendingSession,
} from './gpsSyncStorage';
import { initializeGpsStorage } from './gpsEncryptedStorage';

export async function createSessionWithDurability(
  payload: Omit<PendingSessionPayload, 'created_at' | 'attempts'>,
): Promise<number> {
  const storage = await initializeGpsStorage();
  if (!storage) {
    throw new Error('Durable encrypted GPS storage unavailable');
  }

  const pending: PendingSessionPayload = {
    ...payload,
    created_at: Date.now(),
    attempts: 0,
  };
  // Persist intent before the request. If the server commits but the app dies
  // before receiving the response, launch recovery retries the same start_time;
  // the backend uses that stable value as the idempotency identity.
  savePendingSession(storage, pending);

  const body: Record<string, unknown> = {
    type: payload.type,
    start_time: payload.start_time,
  };
  if (payload.event_id != null) body.event_id = payload.event_id;

  try {
    const res = await api.post<{ id: number }>(API_PATHS_FULL.activitiesSessions, body);
    const id = res.data?.id;
    if (!id) throw new Error('Session create returned no id');
    clearPendingSession(storage);
    return id;
  } catch (err) {
    // Keep the pre-request intent for launch/manual recovery.
    throw err;
  }
}
