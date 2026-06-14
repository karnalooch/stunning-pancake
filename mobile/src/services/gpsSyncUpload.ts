/**
 * GPS telemetry upload — HTTP batch ingest, outbox, Retry-After, single-flight per activity.
 */

import { MMKV } from 'react-native-mmkv';
import axios from 'axios';
import { firebaseCapture } from './FirebaseService';
import { postTelemetryBatchViaWs, WS_INGEST_ENABLED } from './gpsWsIngest';
import {
  appendToOutbox,
  createClientBatchId,
  ensureBufferSchema,
  getIngestPauseUntil,
  GpsPoint,
  GpsStorageAdapter,
  isIngestPaused,
  loadBuffer,
  loadOutbox,
  OutboxEntry,
  pendingPointCount,
  removeOutboxEntry,
  removePointsFromBuffer,
  setIngestPauseUntil,
  updateOutboxEntry,
} from './gpsSyncStorage';

import { TELEMETRY_URL } from './gpsTelemetryUrl';
import { measureAsync } from './performanceBudget';
import { warnMmkvUnavailable } from './mmkvSupport';

export { TELEMETRY_URL };

export const MAX_RETRIES = 5;

let _ingestPauseUntil = 0;
let _lastAckAt: number | null = null;
const _inflightByActivity = new Map<number, Promise<boolean>>();

let _storage: MMKV | null = null;
let _storageOverride: GpsStorageAdapter | null = null;

/** Test-only: inject mock MMKV adapter without native module. */
export function __setGpsStorageForTests(adapter: GpsStorageAdapter | null): void {
  _storageOverride = adapter;
  _storage = null;
}

export function getGpsStorage(): GpsStorageAdapter | null {
  if (_storageOverride) return _storageOverride;
  if (!_storage) {
    try {
      _storage = new MMKV({ id: 'gps-buffer' });
    } catch (e) {
      warnMmkvUnavailable('GpsSyncManager', e);
      _storage = {
        getString: () => null,
        set: () => {},
        delete: () => {},
      } as unknown as MMKV;
    }
  }
  return _storage as GpsStorageAdapter;
}

export interface IngestAckResult {
  acked: boolean;
  inserted: number;
  queued?: boolean;
  deduped?: boolean;
}

export function parseIngestAck(data: unknown, sentCount: number): IngestAckResult {
  if (!data || typeof data !== 'object') {
    return { acked: false, inserted: 0 };
  }
  const body = data as Record<string, unknown>;
  if (body.deduped === true) {
    return { acked: true, inserted: 0, deduped: true };
  }
  if (body.acked === true) {
    const inserted =
      typeof body.inserted === 'number' ? body.inserted : sentCount;
    return {
      acked: true,
      inserted,
      queued: body.queued === true,
    };
  }
  const status = body.status;
  if (status === 'accepted' || status === 'dropped_privacy') {
    const inserted =
      typeof body.inserted === 'number' ? body.inserted : sentCount;
    return { acked: true, inserted, queued: body.queued === true };
  }
  return { acked: false, inserted: 0 };
}

function applyGlobalIngestPause(headers: Record<string, unknown> | undefined): void {
  if (!headers) return;
  const retryAfter = headers['retry-after'] ?? headers['Retry-After'];
  const retrySec =
    typeof retryAfter === 'string'
      ? parseInt(retryAfter, 10)
      : typeof retryAfter === 'number'
        ? retryAfter
        : 0;
  if (!retrySec || !Number.isFinite(retrySec)) return;
  const until = Date.now() + retrySec * 1000;
  _ingestPauseUntil = Math.max(_ingestPauseUntil, until);
  const storage = getGpsStorage();
  if (storage) setIngestPauseUntil(storage, until);
}

export function isGlobalIngestPaused(): boolean {
  if (_ingestPauseUntil > Date.now()) return true;
  const storage = getGpsStorage();
  return storage ? isIngestPaused(storage) : false;
}

export function getLastAckAt(): number | null {
  return _lastAckAt;
}

export function getGpsSyncStatus(): {
  pendingPoints: number;
  ingestPaused: boolean;
  pauseUntil: number;
  lastAckAt: number | null;
} {
  const storage = getGpsStorage();
  return {
    pendingPoints: storage ? pendingPointCount(storage) : 0,
    ingestPaused: isGlobalIngestPaused(),
    pauseUntil: Math.max(_ingestPauseUntil, storage ? getIngestPauseUntil(storage) : 0),
    lastAckAt: _lastAckAt,
  };
}

async function postTelemetryBatch(
  points: GpsPoint[],
  clientBatchId: string,
): Promise<IngestAckResult> {
  if (!TELEMETRY_URL) {
    if (__DEV__) {
      console.warn('[GPS] Missing EXPO_PUBLIC_TELEMETRY_URL, skipping telemetry ingest.');
    }
    return { acked: false, inserted: 0 };
  }
  const activityId = points[0]?.activity_id ?? null;
  const maxSeq = points.reduce(
    (m, p) => (p.seq != null ? Math.max(m, p.seq) : m),
    -1,
  );
  if (WS_INGEST_ENABLED) {
    const wsAck = await postTelemetryBatchViaWs(points, maxSeq >= 0 ? maxSeq : null);
    if (wsAck?.acked) return wsAck;
  }
  const res = await measureAsync('gpsIngestLatencyMs', () =>
    axios.post(
      `${TELEMETRY_URL}/api/telemetry/ingest/batch`,
      {
        packets: points,
        client_batch_id: clientBatchId,
        point_count: points.length,
        max_seq: maxSeq || undefined,
        activity_id: activityId,
      },
      { timeout: 15_000, validateStatus: (s) => s === 202 || s === 201 },
    ),
  );
  return parseIngestAck(res.data, points.length);
}

async function uploadPointsWithRetryInner(
  points: GpsPoint[],
  clientBatchId: string,
  attempt = 1,
): Promise<IngestAckResult> {
  if (points.length === 0) return { acked: true, inserted: 0 };
  try {
    const ack = await postTelemetryBatch(points, clientBatchId);
    if (ack.acked) {
      _lastAckAt = Date.now();
      return ack;
    }
    return { acked: false, inserted: 0 };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const headers = err.response?.headers as Record<string, unknown> | undefined;
      if (status === 429 || status === 503) {
        applyGlobalIngestPause(headers);
        return { acked: false, inserted: 0 };
      }
    }
    if (attempt < MAX_RETRIES) {
      const jitter = Math.random() * 500;
      const delay = Math.min(2 ** attempt * 1_000, 30_000) + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return uploadPointsWithRetryInner(points, clientBatchId, attempt + 1);
    }
    firebaseCapture(err, 'GPS_UPLOAD_FAILED');
    return { acked: false, inserted: 0 };
  }
}

export async function uploadPointsWithRetry(
  points: GpsPoint[],
  clientBatchId: string,
  attempt = 1,
): Promise<IngestAckResult> {
  if (points.length === 0) return { acked: true, inserted: 0 };
  if (isGlobalIngestPaused()) {
    return { acked: false, inserted: 0 };
  }

  const activityId = points[0]?.activity_id;
  if (activityId != null) {
    const inflight = _inflightByActivity.get(activityId);
    if (inflight) {
      const ok = await inflight;
      return ok
        ? { acked: true, inserted: points.length }
        : { acked: false, inserted: 0 };
    }
    const promise = uploadPointsWithRetryInner(points, clientBatchId, attempt);
    _inflightByActivity.set(activityId, promise.then((r) => r.acked));
    try {
      return await promise;
    } finally {
      _inflightByActivity.delete(activityId);
    }
  }
  return uploadPointsWithRetryInner(points, clientBatchId, attempt);
}

async function flushOutboxEntry(entry: OutboxEntry): Promise<boolean> {
  const storage = getGpsStorage();
  if (!storage) return false;
  if (entry.state === 'acked') {
    removeOutboxEntry(storage, entry.client_batch_id);
    return true;
  }
  if (isGlobalIngestPaused()) return false;

  updateOutboxEntry(storage, entry.client_batch_id, { state: 'syncing' });
  const ack = await uploadPointsWithRetry(entry.points, entry.client_batch_id);
  if (ack.acked) {
    updateOutboxEntry(storage, entry.client_batch_id, { state: 'acked' });
    removeOutboxEntry(storage, entry.client_batch_id);
    return true;
  }
  updateOutboxEntry(storage, entry.client_batch_id, {
    state: 'pending',
    attempts: entry.attempts + 1,
  });
  return false;
}

export async function processGpsOutbox(): Promise<void> {
  await measureAsync('outboxFlushMs', async () => {
    const storage = getGpsStorage();
    if (!storage) return;
    ensureBufferSchema(storage);
    const pending = loadOutbox(storage).filter(
      (e) => e.state === 'pending' || e.state === 'syncing',
    );
    for (const entry of pending) {
      await flushOutboxEntry(entry);
    }
  });
}

export async function uploadBufferSnapshot(): Promise<void> {
  const storage = getGpsStorage();
  if (!storage) return;
  ensureBufferSchema(storage);
  const points = loadBuffer(storage);
  if (points.length === 0) return;
  if (isGlobalIngestPaused()) return;

  const clientBatchId = createClientBatchId();
  const activityId = points[0]?.activity_id ?? null;
  const maxSeq = points.reduce(
    (m, p) => (p.seq != null ? Math.max(m, p.seq) : m),
    0,
  );

  appendToOutbox(storage, {
    client_batch_id: clientBatchId,
    points: [...points],
    created_at: Date.now(),
    attempts: 0,
    state: 'syncing',
    activity_id: activityId,
    point_count: points.length,
    max_seq: maxSeq || undefined,
  });
  removePointsFromBuffer(storage, points);

  const ack = await uploadPointsWithRetry([...points], clientBatchId);
  if (ack.acked) {
    removeOutboxEntry(storage, clientBatchId);
    return;
  }

  updateOutboxEntry(storage, clientBatchId, {
    state: 'pending',
    attempts: 1,
  });
  if (__DEV__) {
    console.warn(
      `[GPS] batch retained in outbox (${points.length} pts), pending=${pendingPointCount(storage)}`,
    );
  }
}

export async function flushGpsUploadQueues(): Promise<void> {
  await processGpsOutbox();
  await uploadBufferSnapshot();
}
