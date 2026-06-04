/**
 * GPS Sync Manager — SPORT Mobile App (v2.2 Data Resilience)
 * Expo Location + Task Manager with MMKV buffer, outbox, and launch recovery.
 */

import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { MMKV } from 'react-native-mmkv';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import axios from 'axios';
import { firebaseCapture } from './FirebaseService';
import { api } from './apiClient';
import {
  acceptGpsPoint,
  createGpsFilterState,
  type GpsFilterState,
} from './gpsQualityFilter';
import {
  appendToBuffer,
  appendToOutbox,
  buildGpsPoint,
  buildRouteCoordinates,
  clearBuffer,
  clearPendingSession,
  createClientBatchId,
  ensureBufferSchema,
  getIngestPauseUntil,
  GPS_STORAGE_KEYS,
  GpsPoint,
  GpsStorageAdapter,
  isIngestPaused,
  loadBuffer,
  loadOutbox,
  isRecoveryPending,
  loadPendingSession,
  loadTrackingState,
  mergeRouteCoordinates,
  nextPointSeq,
  OutboxEntry,
  pendingPointCount,
  PendingSessionPayload,
  removeOutboxEntry,
  removePointsFromBuffer,
  savePendingSession,
  setIngestPauseUntil,
  setRecoveryPending,
  TrackingState,
  updateOutboxEntry,
  type TrackingStats,
} from './gpsSyncStorage';

const TELEMETRY_URL =
  process.env.EXPO_PUBLIC_TELEMETRY_URL ??
  'https://docker-telemetry-production-123c.up.railway.app';
const BATCH_INTERVAL_MS = 30_000;
const MAX_RETRIES = 5;
const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';

let _ingestPauseUntil = 0;
let _lastAckAt: number | null = null;
const _inflightByActivity = new Map<number, Promise<boolean>>();
const _filterStateByActivity = new Map<number, GpsFilterState>();

function loadFilterState(storage: GpsStorageAdapter, activityId: number): GpsFilterState {
  let state = _filterStateByActivity.get(activityId);
  if (state) return state;
  const raw = storage.getString(GPS_STORAGE_KEYS.FILTER_STATE);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, GpsFilterState>;
      if (parsed[String(activityId)]) {
        state = parsed[String(activityId)];
        _filterStateByActivity.set(activityId, state!);
        return state!;
      }
    } catch {
      /* ignore */
    }
  }
  state = createGpsFilterState();
  _filterStateByActivity.set(activityId, state);
  return state;
}

function persistFilterStates(storage: GpsStorageAdapter): void {
  const payload: Record<string, GpsFilterState> = {};
  _filterStateByActivity.forEach((v, k) => {
    payload[String(k)] = v;
  });
  storage.set(GPS_STORAGE_KEYS.FILTER_STATE, JSON.stringify(payload));
}

export interface IngestAckResult {
  acked: boolean;
  inserted: number;
  queued?: boolean;
  deduped?: boolean;
}

function parseIngestAck(data: unknown, sentCount: number): IngestAckResult {
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
  const storage = getStorage();
  if (storage) setIngestPauseUntil(storage, until);
}

function isGlobalIngestPaused(): boolean {
  if (_ingestPauseUntil > Date.now()) return true;
  const storage = getStorage();
  return storage ? isIngestPaused(storage) : false;
}

export function getGpsSyncStatus(): {
  pendingPoints: number;
  ingestPaused: boolean;
  pauseUntil: number;
  lastAckAt: number | null;
} {
  const storage = getStorage();
  return {
    pendingPoints: storage ? pendingPointCount(storage) : 0,
    ingestPaused: isGlobalIngestPaused(),
    pauseUntil: Math.max(_ingestPauseUntil, storage ? getIngestPauseUntil(storage) : 0),
    lastAckAt: _lastAckAt,
  };
}

export enum PollingResolution {
  HYPERSCALE = 'HYPERSCALE',
  BALANCED = 'BALANCED',
  POWER_SAVE = 'POWER_SAVE',
}

const RESOLUTION_CONFIG = {
  [PollingResolution.HYPERSCALE]: {
    distanceInterval: 2,
    deferredUpdatesInterval: 1000,
    accuracy: Location.Accuracy.BestForNavigation,
  },
  [PollingResolution.BALANCED]: {
    distanceInterval: 10,
    deferredUpdatesInterval: 5000,
    accuracy: Location.Accuracy.High,
  },
  [PollingResolution.POWER_SAVE]: {
    distanceInterval: 30,
    deferredUpdatesInterval: 15000,
    accuracy: Location.Accuracy.Balanced,
  },
};

let _storage: MMKV | null = null;

function getStorage(): GpsStorageAdapter | null {
  if (!_storage) {
    try {
      _storage = new MMKV({ id: 'gps-buffer' });
    } catch (e) {
      console.error('MMKV init failed in GpsSyncManager. Falling back to mock.', e);
      _storage = {
        getString: () => null,
        set: () => {},
        delete: () => {},
      } as unknown as MMKV;
    }
  }
  return _storage as GpsStorageAdapter;
}

export interface RecoveryResult {
  needsResumeUi: boolean;
  pendingBuffer: number;
  outboxCount: number;
  pendingSession: boolean;
}

async function postTelemetryBatch(
  points: GpsPoint[],
  clientBatchId: string,
): Promise<IngestAckResult> {
  const activityId = points[0]?.activity_id ?? null;
  const maxSeq = points.reduce(
    (m, p) => (p.seq != null ? Math.max(m, p.seq) : m),
    0,
  );
  const res = await axios.post(
    `${TELEMETRY_URL}/api/telemetry/ingest/batch`,
    {
      packets: points,
      client_batch_id: clientBatchId,
      point_count: points.length,
      max_seq: maxSeq || undefined,
      activity_id: activityId,
    },
    { timeout: 15_000, validateStatus: (s) => s === 202 || s === 201 },
  );
  return parseIngestAck(res.data, points.length);
}

async function uploadPointsWithRetry(
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

async function flushOutboxEntry(entry: OutboxEntry): Promise<boolean> {
  const storage = getStorage();
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
  const storage = getStorage();
  if (!storage) return;
  ensureBufferSchema(storage);
  const pending = loadOutbox(storage).filter(
    (e) => e.state === 'pending' || e.state === 'syncing',
  );
  for (const entry of pending) {
    await flushOutboxEntry(entry);
  }
}

async function uploadBufferSnapshot(): Promise<void> {
  const storage = getStorage();
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

function routePathHash(coords: [number, number][]): string {
  const payload = JSON.stringify(coords);
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = (hash << 5) - hash + payload.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash)}`;
}

async function syncRoutePath(
  activityId: number,
  points: GpsPoint[],
  existingRoute?: [number, number][] | null,
): Promise<void> {
  const incoming = buildRouteCoordinates(points);
  const merged = mergeRouteCoordinates(existingRoute, incoming);
  if (merged.length < 2) return;

  const pathHash = routePathHash(merged);
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await api.patch(`/api/activities/sessions/${activityId}/sync_path/`, {
        route_path: merged,
        path_hash: pathHash,
      });
      return;
    } catch (err) {
      if (attempt >= MAX_RETRIES) {
        firebaseCapture(err, 'GPS_SYNC_PATH_FAILED');
        return;
      }
      await new Promise((r) => setTimeout(r, Math.min(2 ** attempt * 1_000, 30_000)));
    }
  }
}

async function finalizeActivity(
  activityId: number,
  distanceM: number,
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await api.post(`/api/activities/sessions/${activityId}/finalize/`, {
        end_time: new Date().toISOString(),
        distance: distanceM,
      });
      return;
    } catch (err) {
      if (attempt >= MAX_RETRIES) {
        firebaseCapture(err, 'GPS_FINALIZE_FAILED');
        return;
      }
      await new Promise((r) => setTimeout(r, Math.min(2 ** attempt * 1_000, 30_000)));
    }
  }
}

export async function retryPendingSessionCreate(): Promise<number | null> {
  const storage = getStorage();
  if (!storage) return null;
  const pending = loadPendingSession(storage);
  if (!pending) return null;

  try {
    const body: Record<string, unknown> = {
      type: pending.type,
      start_time: pending.start_time,
    };
    if (pending.event_id != null) body.event_id = pending.event_id;
    const res = await api.post<{ id: number }>('/api/activities/sessions/', body);
    const activityId = res.data?.id;
    if (activityId) {
      clearPendingSession(storage);
      const state = loadTrackingState(storage);
      if (state) {
        storage.set(
          GPS_STORAGE_KEYS.TRACKING_STATE,
          JSON.stringify({ ...state, activityId }),
        );
      }
      const buf = loadBuffer(storage);
      if (buf.length > 0) {
        const updated = buf.map((p) => ({ ...p, activity_id: activityId }));
        clearBuffer(storage);
        updated.forEach((p) => appendToBuffer(storage, p));
      }
      return activityId;
    }
  } catch (err) {
    savePendingSession(storage, {
      ...pending,
      attempts: pending.attempts + 1,
    });
    firebaseCapture(err, 'PENDING_SESSION_RETRY_FAILED');
  }
  return null;
}

export async function recoverGpsDataOnLaunch(): Promise<RecoveryResult> {
  const storage = getStorage();
  const empty: RecoveryResult = {
    needsResumeUi: false,
    pendingBuffer: 0,
    outboxCount: 0,
    pendingSession: false,
  };
  if (!storage) return empty;

  ensureBufferSchema(storage);
  await retryPendingSessionCreate();
  await processGpsOutbox();
  await uploadBufferSnapshot();

  const buffer = loadBuffer(storage);
  const outbox = loadOutbox(storage);
  const state = loadTrackingState(storage);
  const pendingSession = loadPendingSession(storage) != null;

  const needsResumeUi =
    pendingSession ||
  Boolean(state?.activityId && (state.isTracking || buffer.length > 0 || outbox.length > 0));

  setRecoveryPending(storage, needsResumeUi);

  if (__DEV__ && pendingPointCount(storage) > 0) {
    console.log(
      `[GPS] recovery: buffer=${buffer.length} outbox=${outbox.length} resume=${needsResumeUi}`,
    );
  }

  return {
    needsResumeUi,
    pendingBuffer: buffer.length,
    outboxCount: outbox.length,
    pendingSession,
  };
}

export function isTrackingRecoveryPending(): boolean {
  const storage = getStorage();
  return storage ? isRecoveryPending(storage) : false;
}

export function isRideTrackingActive(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  const state = loadTrackingState(storage);
  return Boolean(state?.isTracking && state.activityId);
}

/** Restart Expo location task after app kill if MMKV still marks an active ride. */
export async function resumeTrackingAfterRelaunch(): Promise<boolean> {
  const storage = getStorage();
  if (!storage) return false;
  const state = loadTrackingState(storage);
  if (!state?.isTracking || !state.activityId) return false;

  let started = false;
  try {
    started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch {
    started = false;
  }
  if (started) {
    startGpsBackgroundSync();
    return true;
  }

  const resolution =
    (state.resolution as PollingResolution) ?? PollingResolution.BALANCED;
  const config = RESOLUTION_CONFIG[resolution];
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    ...config,
    foregroundService: {
      notificationTitle: '4VELO — Tracking Active',
      notificationBody: `Your route is being recorded (${resolution.toLowerCase()})`,
      notificationColor: '#00FFFF',
    },
  });
  startGpsBackgroundSync();
  return true;
}

export function clearTrackingRecoveryPending(): void {
  const storage = getStorage();
  if (storage) setRecoveryPending(storage, false);
}

export async function runManualGpsRecovery(): Promise<boolean> {
  await retryPendingSessionCreate();
  await processGpsOutbox();
  await uploadBufferSnapshot();

  const storage = getStorage();
  if (!storage) return true;

  const stillPending =
    loadPendingSession(storage) != null ||
    loadBuffer(storage).length > 0 ||
    loadOutbox(storage).length > 0;

  if (!stillPending) {
    clearTrackingRecoveryPending();
    return true;
  }
  return false;
}

export { createSessionWithDurability } from './sessionDurability';

let _syncInterval: ReturnType<typeof setInterval> | null = null;
let _netInfoUnsubscribe: (() => void) | null = null;
let _appStateSubscription: { remove: () => void } | null = null;

async function flushGpsUploadQueues(): Promise<void> {
  await processGpsOutbox();
  await uploadBufferSnapshot();
}

function subscribeNetInfoReconnect(): void {
  if (_netInfoUnsubscribe) return;
  _netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void flushGpsUploadQueues();
    }
  });
}

function unsubscribeNetInfoReconnect(): void {
  _netInfoUnsubscribe?.();
  _netInfoUnsubscribe = null;
}

function ensureAppStateNetInfoLifecycle(): void {
  if (_appStateSubscription) return;
  _appStateSubscription = AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'background' || next === 'inactive') {
      unsubscribeNetInfoReconnect();
    } else if (next === 'active') {
      subscribeNetInfoReconnect();
      void flushGpsUploadQueues();
    }
  });
}

export function startGpsBackgroundSync(): void {
  if (!_syncInterval) {
    _syncInterval = setInterval(() => {
      void flushGpsUploadQueues();
    }, BATCH_INTERVAL_MS);
  }
  subscribeNetInfoReconnect();
  ensureAppStateNetInfoLifecycle();
}

export function stopGpsBackgroundSync(): void {
  if (_syncInterval) {
    clearInterval(_syncInterval);
    _syncInterval = null;
  }
  unsubscribeNetInfoReconnect();
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    firebaseCapture(error, 'BACKGROUND_LOCATION_TASK_ERROR');
    return;
  }

  const storage = getStorage();
  if (!storage) {
    await new Promise((r) => setTimeout(r, 500));
    if (!getStorage()) return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const safeStorage = getStorage()!;
    const state = loadTrackingState(safeStorage);

    if (!state?.isTracking || !state.activityId) return;

    ensureBufferSchema(safeStorage);

    locations.forEach((loc) => {
      const currentStats = JSON.parse(
        safeStorage.getString(GPS_STORAGE_KEYS.CURRENT_STATS) ||
          '{"distanceM":0,"elevationGainM":0,"gpsActiveTimeS":0}',
      );

      let distanceIncrement = 0;
      if (state.lastCoord) {
        distanceIncrement = calculateDistance(state.lastCoord, [
          loc.coords.longitude,
          loc.coords.latitude,
        ]);
      }

      let elevationIncrement = 0;
      if (
        state.lastAltitude !== null &&
        loc.coords.altitude !== null &&
        loc.coords.altitude > state.lastAltitude
      ) {
        elevationIncrement = loc.coords.altitude - state.lastAltitude;
      }

      const filterState = loadFilterState(safeStorage, state.activityId);
      const prevAcceptedTs = filterState.lastAccepted?.timestamp ?? 0;
      const seq = nextPointSeq(safeStorage, state.activityId);
      const candidate = buildGpsPoint(
        {
          device_id: state.deviceId,
          user_id: state.userId,
          activity_id: state.activityId,
          lat: loc.coords.latitude,
          lon: loc.coords.longitude,
          altitude_m: loc.coords.altitude ?? 0,
          speed_ms: loc.coords.speed ?? 0,
          accuracy_m: loc.coords.accuracy ?? 5,
          timestamp: loc.timestamp / 1000,
        },
        seq,
      );
      if (!acceptGpsPoint(candidate, filterState)) {
        persistFilterStates(safeStorage);
        return;
      }
      persistFilterStates(safeStorage);

      const gpsActiveTimeS =
        (currentStats.gpsActiveTimeS ?? 0) +
        (prevAcceptedTs > 0
          ? Math.max(0, candidate.timestamp - prevAcceptedTs)
          : 0);

      const newStats = {
        distanceM: currentStats.distanceM + (distanceIncrement > 2 ? distanceIncrement : 0),
        elevationGainM: currentStats.elevationGainM + elevationIncrement,
        speedMs: loc.coords.speed ?? 0,
        paceSecPerKm:
          (loc.coords.speed ?? 0) > 0.5 ? 1000 / (loc.coords.speed ?? 0) : 0,
        batteryPct: 1.0,
        pendingPoints: 0,
        gpsActiveTimeS,
      };

      appendToBuffer(safeStorage, {
        ...candidate,
        segment_break: filterState.segmentBreak || undefined,
      });

      safeStorage.set(GPS_STORAGE_KEYS.CURRENT_STATS, JSON.stringify(newStats));
      safeStorage.set(
        GPS_STORAGE_KEYS.TRACKING_STATE,
        JSON.stringify({
          ...state,
          lastCoord: [loc.coords.longitude, loc.coords.latitude],
          lastAltitude: loc.coords.altitude,
        } satisfies TrackingState),
      );
    });
  }
});

function calculateDistance(p1: [number, number], p2: [number, number]): number {
  const R = 6371e3;
  const dLat = ((p2[1] - p1[1]) * Math.PI) / 180;
  const dLon = ((p2[0] - p1[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1[1] * Math.PI) / 180) *
      Math.cos((p2[1] * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type { GpsPoint, TrackingStats } from './gpsSyncStorage';

export class GpsSyncManager {
  private _deviceId: string;
  private _userId: number | null;
  private _batchTimer: ReturnType<typeof setInterval> | null = null;
  private _statsCheckTimer: ReturnType<typeof setInterval> | null = null;
  private _onUpdate: ((stats: TrackingStats) => void) | null = null;

  constructor(deviceId: string, userId: number | null = null) {
    this._deviceId = deviceId;
    this._userId = userId;
  }

  setUserId(userId: number | null): void {
    this._userId = userId;
  }

  setUpdateCallback(cb: (stats: TrackingStats) => void): void {
    this._onUpdate = cb;
  }

  private _emitStats(): void {
    if (!this._onUpdate) return;
    const storage = getStorage();
    if (!storage) return;

    const currentStats = JSON.parse(
      storage.getString(GPS_STORAGE_KEYS.CURRENT_STATS) ||
        '{"distanceM":0,"elevationGainM":0,"speedMs":0,"paceSecPerKm":0}',
    );
    const tracking = loadTrackingState(storage);
    const wallStart = storage.getString('ride_wall_start_ms');
    const rideWallClockS =
      wallStart && tracking?.isTracking
        ? Math.max(0, Math.floor((Date.now() - parseInt(wallStart, 10)) / 1000))
        : undefined;

    this._onUpdate({
      ...currentStats,
      pendingPoints: pendingPointCount(storage),
      ingestPaused: isGlobalIngestPaused(),
      lastAckAt: _lastAckAt,
      rideWallClockS,
      gpsActiveTimeS: currentStats.gpsActiveTimeS,
    });
  }

  async startTracking(
    activityId: number,
    resolution: PollingResolution = PollingResolution.BALANCED,
  ): Promise<void> {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      throw new Error('Foreground location permission not granted');
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      throw new Error('Background location permission not granted');
    }

    const storage = getStorage();
    if (storage) {
      storage.set(
        GPS_STORAGE_KEYS.TRACKING_STATE,
        JSON.stringify({
          isTracking: true,
          activityId,
          deviceId: this._deviceId,
          userId: this._userId,
          lastCoord: null,
          lastAltitude: null,
          resolution,
        } satisfies TrackingState),
      );

      storage.set(
        GPS_STORAGE_KEYS.CURRENT_STATS,
        JSON.stringify({
          distanceM: 0,
          elevationGainM: 0,
          speedMs: 0,
          paceSecPerKm: 0,
        }),
      );
      setRecoveryPending(storage, false);
      storage.set('ride_wall_start_ms', String(Date.now()));
    }

    const config = RESOLUTION_CONFIG[resolution];
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      ...config,
      foregroundService: {
        notificationTitle: '4VELO — Tracking Active',
        notificationBody: `Your route is being recorded (${resolution.toLowerCase()})`,
        notificationColor: '#00FFFF',
      },
    });

    startGpsBackgroundSync();
    this._statsCheckTimer = setInterval(() => this._emitStats(), 2000);
  }

  async setResolution(resolution: PollingResolution): Promise<void> {
    const storage = getStorage();
    if (!storage) return;
    const state = loadTrackingState(storage);
    if (!state?.isTracking) return;

    storage.set(
      GPS_STORAGE_KEYS.TRACKING_STATE,
      JSON.stringify({ ...state, resolution }),
    );

    const config = RESOLUTION_CONFIG[resolution];
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      ...config,
      foregroundService: {
        notificationTitle: '4VELO — Tracking Active',
        notificationBody: `Your route is being recorded (${resolution.toLowerCase()})`,
        notificationColor: '#00FFFF',
      },
    });
  }

  async stopTracking(): Promise<{ finalized: boolean; pendingUpload: number }> {
    stopGpsBackgroundSync();
    if (this._statsCheckTimer) clearInterval(this._statsCheckTimer);

    const storage = getStorage();
    const state = storage ? loadTrackingState(storage) : null;
    const activityId = state?.activityId ?? null;

    await processGpsOutbox();
    await uploadBufferSnapshot();

    const pendingUpload = storage ? pendingPointCount(storage) : 0;
    const allPoints = storage ? loadBuffer(storage) : [];
    const stats = storage
      ? JSON.parse(
          storage.getString(GPS_STORAGE_KEYS.CURRENT_STATS) ||
            '{"distanceM":0}',
        )
      : { distanceM: 0 };

    if (activityId && allPoints.length > 0) {
      await syncRoutePath(activityId, allPoints);
    }

    let finalized = false;
    if (activityId && pendingUpload === 0) {
      await finalizeActivity(activityId, stats.distanceM ?? 0);
      finalized = true;
    } else if (activityId && pendingUpload > 0 && storage) {
      setRecoveryPending(storage, true);
    }

    if (storage) {
      if (pendingUpload === 0) {
        clearBuffer(storage);
      }
      storage.set(
        GPS_STORAGE_KEYS.TRACKING_STATE,
        JSON.stringify({
          ...(state ?? {
            deviceId: this._deviceId,
            userId: this._userId,
            lastCoord: null,
            lastAltitude: null,
          }),
          isTracking: false,
          activityId: pendingUpload > 0 ? activityId : null,
        }),
      );
      if (pendingUpload === 0) {
        setRecoveryPending(storage, false);
      }
    }

    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    return { finalized, pendingUpload };
  }
}
