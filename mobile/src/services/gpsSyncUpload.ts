/**
 * GPS telemetry upload — HTTP batch ingest, outbox, Retry-After, single-flight per activity.
 */

import axios from 'axios';
import { firebaseCapture } from './FirebaseService';
import { getTelemetryIngestToken } from './apiClient';
import { postTelemetryBatchViaWs, WS_INGEST_ENABLED } from './gpsWsIngest';
import {
  appendToOutbox,
  createClientBatchId,
  ensureBufferSchema,
  getIngestPauseUntil,
  GpsPoint,
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
import {
  __setGpsStorageForTests,
  getGpsStorage,
  initializeGpsStorage,
} from './gpsEncryptedStorage';
import {
  parseIngestAck,
  type IngestAckResult,
} from './gpsIngestAck';
import { ActivitySerialQueue } from './gpsActivityQueue';

import { TELEMETRY_URL } from './gpsTelemetryUrl';
import { measureAsync } from './performanceBudget';

export { TELEMETRY_URL, parseIngestAck, __setGpsStorageForTests, getGpsStorage };
export type { IngestAckResult };

export const MAX_RETRIES = 5;
export const MAX_UPLOAD_BATCH_POINTS = 500;

let _ingestPauseUntil = 0;
let _lastAckAt: number | null = null;
const _activityUploadQueue = new ActivitySerialQueue();

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
  // Telemetry middleware rejects JWTs whose ``aud`` does not match
  // ``telemetry`` once TELEMETRY_INGEST_AUDIENCE_REQUIRED=1 is set in the
  // deploy env (default OFF). The Django access token is accepted for
  // ``/api/`` paths but rejected at the telemetry service. Fetching the
  // dedicated token here keeps a single code path for both modes.
  let ingestToken: string | undefined;
  if (activityId != null) {
    const issued = await getTelemetryIngestToken(activityId);
    if (!issued) {
      if (__DEV__) {
        console.warn(
          `[GPS] No telemetry token for activity ${activityId}; skipping batch.`,
        );
      }
      return { acked: false, inserted: 0 };
    }
    ingestToken = issued.token;
  }
  if (WS_INGEST_ENABLED) {
    const wsAck = await postTelemetryBatchViaWs(points, maxSeq >= 0 ? maxSeq : null, ingestToken);
    if (wsAck?.acked) return wsAck;
  }
  const res = await measureAsync('gpsIngestLatencyMs', () =>
    axios.post(
      `${TELEMETRY_URL}/api/telemetry/ingest/batch`,
      {
        packets: points,
        client_batch_id: clientBatchId,
        point_count: points.length,
        max_seq: maxSeq >= 0 ? maxSeq : undefined,
        activity_id: activityId,
      },
      {
        timeout: 15_000,
        validateStatus: (s) => s === 202 || s === 201,
        headers: ingestToken ? { Authorization: `Bearer ${ingestToken}` } : undefined,
      },
    ),
  );
  return parseIngestAck(res.data, points.length, clientBatchId);
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
    return _activityUploadQueue.run(activityId, () =>
      uploadPointsWithRetryInner(points, clientBatchId, attempt),
    );
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
    const storage = await initializeGpsStorage();
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
  const storage = await initializeGpsStorage();
  if (!storage) return;
  ensureBufferSchema(storage);
  const buffered = loadBuffer(storage);
  if (buffered.length === 0) return;
  if (isGlobalIngestPaused()) return;

  const points = buffered.slice(0, MAX_UPLOAD_BATCH_POINTS);
  const clientBatchId = createClientBatchId();
  const activityId = points[0]?.activity_id ?? null;
  const maxSeq = points.reduce(
    (m, p) => (p.seq != null ? Math.max(m, p.seq) : m),
    -1,
  );

  appendToOutbox(storage, {
    client_batch_id: clientBatchId,
    points: [...points],
    created_at: Date.now(),
    attempts: 0,
    state: 'syncing',
    activity_id: activityId,
    point_count: points.length,
    max_seq: maxSeq >= 0 ? maxSeq : undefined,
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
