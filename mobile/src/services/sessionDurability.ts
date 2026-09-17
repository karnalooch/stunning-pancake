/**
 * Durable activity session create — isolated from GpsSyncManager to avoid api circular imports.
 */

import { API_PATHS_FULL } from '@4velo/api-client';
import { api } from './apiClient';
import {
  clearPendingSession,
  loadPendingSession,
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

  const existingPending = loadPendingSession(storage);
  let pending: PendingSessionPayload;
  if (existingPending) {
    const sameIntent =
      existingPending.type === payload.type &&
      (existingPending.event_id ?? null) === (payload.event_id ?? null);
    if (!sameIntent) {
      throw new Error('Pending session recovery required before starting a different ride');
    }
    // Never overwrite the original request identity after an ambiguous failure.
    // The original start_time may already have committed on the server.
    pending = existingPending;
  } else {
    pending = {
      ...payload,
      created_at: Date.now(),
      attempts: 0,
    };
    // Persist intent before the request. If the server commits but the app dies
    // before receiving the response, launch recovery retries this same start_time;
    // the backend maps it to the same database request identity.
    savePendingSession(storage, pending);
  }

  const body: Record<string, unknown> = {
    type: pending.type,
    start_time: pending.start_time,
  };
  if (pending.event_id != null) body.event_id = pending.event_id;

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
