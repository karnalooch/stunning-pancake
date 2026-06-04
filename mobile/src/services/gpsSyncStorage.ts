/**
 * GPS sync persistence — pure helpers + MMKV keys (testable without native MMKV).
 */

export const GPS_BUFFER_SCHEMA_VERSION = 2;

export const GPS_STORAGE_KEYS = {
  BUFFER: 'gps_buffer',
  BUFFER_OVERFLOW: 'gps_buffer_overflow',
  OUTBOX: 'gps_outbox',
  BUFFER_SCHEMA: 'gps_buffer_schema',
  FILTER_STATE: 'gps_filter_state',
  INGEST_PAUSE_UNTIL: 'gps_ingest_pause_until',
  TRACKING_STATE: 'tracking_state',
  CURRENT_STATS: 'current_stats',
  RECOVERY_PENDING: 'tracking_recovery_pending',
  PENDING_SESSION: 'pending_session',
  PENDING_METRICS: 'gps_pending_metrics',
} as const;

export type OutboxState = 'pending' | 'syncing' | 'acked';

export const MAX_BUFFER_SIZE = 2000;
export const OVERFLOW_CHUNK_SIZE = 500;
export const MAX_OUTBOX_ENTRIES = 50;

export interface GpsPoint {
  device_id: string;
  user_id: number | null;
  activity_id: number | null;
  lat: number;
  lon: number;
  altitude_m: number;
  speed_ms: number;
  accuracy_m: number;
  timestamp: number;
  seq?: number;
  idempotency_key?: string;
  segment_break?: boolean;
}

export interface OutboxEntry {
  client_batch_id: string;
  points: GpsPoint[];
  created_at: number;
  attempts: number;
  state: OutboxState;
  activity_id?: number | null;
  point_count?: number;
  max_seq?: number;
}

export interface PendingSessionPayload {
  type: string;
  start_time: string;
  event_id?: number;
  created_at: number;
  attempts: number;
}

export interface TrackingState {
  isTracking: boolean;
  activityId: number | null;
  deviceId: string;
  userId: number | null;
  lastCoord: [number, number] | null;
  lastAltitude: number | null;
  resolution?: string;
}

export interface TrackingStats {
  distanceM: number;
  paceSecPerKm: number;
  elevationGainM: number;
  speedMs: number;
  batteryPct: number;
  pendingPoints: number;
  /** Wall-clock ride seconds when tracking (honest UX, ADR 011). */
  rideWallClockS?: number;
  /** Sum of intervals between accepted GPS samples. */
  gpsActiveTimeS?: number;
  ingestPaused?: boolean;
  lastAckAt?: number | null;
}

export interface GpsStorageAdapter {
  getString(key: string): string | undefined | null;
  set(key: string, value: string): void;
  delete(key: string): void;
}

function parseJson<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function migratePoint(point: GpsPoint, seq: number, activityId: number | null): GpsPoint {
  if (point.seq != null && point.idempotency_key) return point;
  const ts = point.timestamp;
  const nextSeq = point.seq ?? seq;
  return {
    ...point,
    seq: nextSeq,
    idempotency_key:
      point.idempotency_key ??
      `${activityId ?? 'na'}:${ts}:${nextSeq}`,
  };
}

export function ensureBufferSchema(storage: GpsStorageAdapter): void {
  const version = parseInt(
    storage.getString(GPS_STORAGE_KEYS.BUFFER_SCHEMA) ?? '1',
    10,
  );
  if (version >= GPS_BUFFER_SCHEMA_VERSION) return;

  const state = loadTrackingState(storage);
  const activityId = state?.activityId ?? null;
  let seq = 0;
  const buf = loadBuffer(storage).map((p) => migratePoint(p, ++seq, activityId));
  if (buf.length > 0) saveBuffer(storage, buf);

  const outbox = loadOutbox(storage).map((entry) => ({
    ...entry,
    state: entry.state ?? 'pending',
    points: entry.points.map((p) => migratePoint(p, ++seq, entry.activity_id ?? activityId)),
  }));
  if (outbox.length > 0) saveOutbox(storage, outbox);

  storage.set(GPS_STORAGE_KEYS.BUFFER_SCHEMA, String(GPS_BUFFER_SCHEMA_VERSION));
}

export function loadBuffer(storage: GpsStorageAdapter): GpsPoint[] {
  const main = parseJson<GpsPoint[]>(storage.getString(GPS_STORAGE_KEYS.BUFFER), []);
  const overflow = parseJson<GpsPoint[][]>(
    storage.getString(GPS_STORAGE_KEYS.BUFFER_OVERFLOW),
    [],
  );
  return overflow.flat().concat(main);
}

export function saveBuffer(storage: GpsStorageAdapter, points: GpsPoint[]): void {
  if (points.length <= MAX_BUFFER_SIZE) {
    storage.set(GPS_STORAGE_KEYS.BUFFER, JSON.stringify(points));
    storage.delete(GPS_STORAGE_KEYS.BUFFER_OVERFLOW);
    return;
  }
  const overflowCount = points.length - MAX_BUFFER_SIZE;
  const overflowPoints = points.slice(0, overflowCount);
  const chunks: GpsPoint[][] = [];
  for (let i = 0; i < overflowPoints.length; i += OVERFLOW_CHUNK_SIZE) {
    chunks.push(overflowPoints.slice(i, i + OVERFLOW_CHUNK_SIZE));
  }
  storage.set(GPS_STORAGE_KEYS.BUFFER_OVERFLOW, JSON.stringify(chunks));
  storage.set(
    GPS_STORAGE_KEYS.BUFFER,
    JSON.stringify(points.slice(overflowCount)),
  );
}

export function appendToBuffer(storage: GpsStorageAdapter, point: GpsPoint): void {
  const buf = loadBuffer(storage);
  buf.push(point);
  saveBuffer(storage, buf);
}

export function clearBuffer(storage: GpsStorageAdapter): void {
  storage.delete(GPS_STORAGE_KEYS.BUFFER);
  storage.delete(GPS_STORAGE_KEYS.BUFFER_OVERFLOW);
}

export function removePointsFromBuffer(
  storage: GpsStorageAdapter,
  toRemove: GpsPoint[],
): void {
  if (toRemove.length === 0) return;
  const removeKeys = new Set(
    toRemove.map((p) => `${p.timestamp}:${p.lat}:${p.lon}`),
  );
  const remaining = loadBuffer(storage).filter(
    (p) => !removeKeys.has(`${p.timestamp}:${p.lat}:${p.lon}`),
  );
  if (remaining.length === 0) {
    clearBuffer(storage);
  } else {
    saveBuffer(storage, remaining);
  }
}

export function loadOutbox(storage: GpsStorageAdapter): OutboxEntry[] {
  return parseJson<OutboxEntry[]>(storage.getString(GPS_STORAGE_KEYS.OUTBOX), []);
}

export function saveOutbox(storage: GpsStorageAdapter, entries: OutboxEntry[]): void {
  storage.set(GPS_STORAGE_KEYS.OUTBOX, JSON.stringify(entries.slice(-MAX_OUTBOX_ENTRIES)));
}

export function appendToOutbox(
  storage: GpsStorageAdapter,
  entry: OutboxEntry,
): void {
  const outbox = loadOutbox(storage);
  outbox.push({
    ...entry,
    state: entry.state ?? 'pending',
    point_count: entry.point_count ?? entry.points.length,
  });
  saveOutbox(storage, outbox);
}

export function updateOutboxEntry(
  storage: GpsStorageAdapter,
  clientBatchId: string,
  patch: Partial<OutboxEntry>,
): void {
  saveOutbox(
    storage,
    loadOutbox(storage).map((e) =>
      e.client_batch_id === clientBatchId ? { ...e, ...patch } : e,
    ),
  );
}

export function nextPointSeq(storage: GpsStorageAdapter, activityId: number): number {
  let maxSeq = 0;
  for (const p of loadBuffer(storage)) {
    if (p.activity_id === activityId && p.seq != null) maxSeq = Math.max(maxSeq, p.seq);
  }
  for (const e of loadOutbox(storage)) {
    if (e.activity_id === activityId) {
      if (e.max_seq != null) maxSeq = Math.max(maxSeq, e.max_seq);
      for (const p of e.points) {
        if (p.seq != null) maxSeq = Math.max(maxSeq, p.seq);
      }
    }
  }
  return maxSeq + 1;
}

export function buildGpsPoint(
  base: Omit<GpsPoint, 'seq' | 'idempotency_key'>,
  seq: number,
): GpsPoint {
  return {
    ...base,
    seq,
    idempotency_key: `${base.activity_id ?? 'na'}:${base.timestamp}:${seq}`,
  };
}

export function getIngestPauseUntil(storage: GpsStorageAdapter): number {
  const raw = storage.getString(GPS_STORAGE_KEYS.INGEST_PAUSE_UNTIL);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

export function setIngestPauseUntil(storage: GpsStorageAdapter, untilMs: number): void {
  if (untilMs <= Date.now()) {
    storage.delete(GPS_STORAGE_KEYS.INGEST_PAUSE_UNTIL);
  } else {
    storage.set(GPS_STORAGE_KEYS.INGEST_PAUSE_UNTIL, String(untilMs));
  }
}

export function isIngestPaused(storage: GpsStorageAdapter): boolean {
  return getIngestPauseUntil(storage) > Date.now();
}

export function removeOutboxEntry(
  storage: GpsStorageAdapter,
  clientBatchId: string,
): void {
  saveOutbox(
    storage,
    loadOutbox(storage).filter((e) => e.client_batch_id !== clientBatchId),
  );
}

export function pendingPointCount(storage: GpsStorageAdapter): number {
  return loadBuffer(storage).length + loadOutbox(storage).reduce((n, e) => n + e.points.length, 0);
}

export function loadTrackingState(storage: GpsStorageAdapter): TrackingState | null {
  const raw = storage.getString(GPS_STORAGE_KEYS.TRACKING_STATE);
  if (!raw) return null;
  return parseJson<TrackingState | null>(raw, null);
}

export function buildRouteCoordinates(points: GpsPoint[]): [number, number][] {
  return points.map((p) => [p.lon, p.lat]);
}

export function mergeRouteCoordinates(
  existing: [number, number][] | null | undefined,
  incoming: [number, number][],
): [number, number][] {
  if (!existing?.length) return incoming;
  if (!incoming.length) return existing;
  const merged = [...existing];
  const last = merged[merged.length - 1];
  const firstNew = incoming[0];
  const sameStart =
    last &&
    firstNew &&
    Math.abs(last[0] - firstNew[0]) < 1e-6 &&
    Math.abs(last[1] - firstNew[1]) < 1e-6;
  merged.push(...(sameStart ? incoming.slice(1) : incoming));
  return merged;
}

export function createClientBatchId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function loadPendingSession(storage: GpsStorageAdapter): PendingSessionPayload | null {
  return parseJson<PendingSessionPayload | null>(
    storage.getString(GPS_STORAGE_KEYS.PENDING_SESSION),
    null,
  );
}

export function savePendingSession(
  storage: GpsStorageAdapter,
  payload: PendingSessionPayload,
): void {
  storage.set(GPS_STORAGE_KEYS.PENDING_SESSION, JSON.stringify(payload));
}

export function clearPendingSession(storage: GpsStorageAdapter): void {
  storage.delete(GPS_STORAGE_KEYS.PENDING_SESSION);
}

export function isRecoveryPending(storage: GpsStorageAdapter): boolean {
  return storage.getString(GPS_STORAGE_KEYS.RECOVERY_PENDING) === 'true';
}

export function setRecoveryPending(storage: GpsStorageAdapter, pending: boolean): void {
  if (pending) {
    storage.set(GPS_STORAGE_KEYS.RECOVERY_PENDING, 'true');
  } else {
    storage.delete(GPS_STORAGE_KEYS.RECOVERY_PENDING);
  }
}
