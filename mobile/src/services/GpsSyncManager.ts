/**
 * GPS Sync Manager — SPORT Mobile App (v2.2 Data Resilience)
 * Expo Location + Task Manager with MMKV buffer; upload logic in gpsSyncUpload.ts.
 */

import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { API_PATHS_FULL, mobileActivityPaths } from '@4velo/api-client';
import { api } from './apiClient';
import { firebaseCapture } from './FirebaseService';
import {
  acceptGpsPoint,
  createGpsFilterState,
  type GpsFilterState,
} from './gpsQualityFilter';
import {
  appendToBuffer,
  buildGpsPoint,
  buildRouteCoordinates,
  clearPendingFinalization,
  clearPendingSession,
  clearPointSeq,
  ensureBufferSchema,
  GPS_STORAGE_KEYS,
  GpsPoint,
  isRecoveryPending,
  loadBuffer,
  loadOutbox,
  loadPendingFinalization,
  loadPendingSession,
  loadTrackingState,
  mergeRouteCoordinates,
  nextPointSeq,
  pendingPointCount,
  savePendingFinalization,
  savePendingSession,
  setRecoveryPending,
  TrackingState,
  type TrackingStats,
} from './gpsSyncStorage';
import { initializeGpsStorage } from './gpsEncryptedStorage';
import { saveLocalRideSnapshot } from './gpsLocalExport';
import { finalizeActivityWithRetry } from './gpsFinalization';
import {
  flushGpsUploadQueues,
  getGpsStorage,
  getLastAckAt,
  isGlobalIngestPaused,
  MAX_RETRIES,
  processGpsOutbox,
  uploadBufferSnapshot,
} from './gpsSyncUpload';
import {
  isGpsBackgroundProofEnabled,
  logGpsBackgroundProof,
} from './gpsBackgroundProofLogging';

const BATCH_INTERVAL_MS = 30_000;
const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';

const _filterStateByActivity = new Map<number, GpsFilterState>();

function loadFilterState(storage: ReturnType<typeof getGpsStorage>, activityId: number): GpsFilterState {
  if (!storage) return createGpsFilterState();
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

function persistFilterStates(storage: NonNullable<ReturnType<typeof getGpsStorage>>): void {
  const payload: Record<string, GpsFilterState> = {};
  _filterStateByActivity.forEach((v, k) => {
    payload[String(k)] = v;
  });
  storage.set(GPS_STORAGE_KEYS.FILTER_STATE, JSON.stringify(payload));
}

export { getGpsSyncStatus } from './gpsSyncUpload';
export type { IngestAckResult } from './gpsSyncUpload';

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

export interface RecoveryResult {
  needsResumeUi: boolean;
  pendingBuffer: number;
  outboxCount: number;
  pendingSession: boolean;
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
      await api.patch(mobileActivityPaths.sessionSyncPath(activityId), {
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

async function finalizeActivity(activityId: number, distanceM: number): Promise<boolean> {
  return finalizeActivityWithRetry(activityId, distanceM, MAX_RETRIES, {
    postFinalize: (id, body) => api.post(mobileActivityPaths.sessionFinalize(id), body),
    capture: firebaseCapture,
  });
}

export async function retryPendingSessionCreate(): Promise<number | null> {
  const storage = await initializeGpsStorage();
  if (!storage) return null;
  const pending = loadPendingSession(storage);
  if (!pending) return null;

  try {
    const body: Record<string, unknown> = {
      type: pending.type,
      start_time: pending.start_time,
    };
    if (pending.event_id != null) body.event_id = pending.event_id;
    const res = await api.post<{ id: number }>(API_PATHS_FULL.activitiesSessions, body);
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
        storage.delete(GPS_STORAGE_KEYS.BUFFER);
        storage.delete(GPS_STORAGE_KEYS.BUFFER_OVERFLOW);
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

export async function retryPendingFinalization(): Promise<boolean> {
  const storage = await initializeGpsStorage();
  if (!storage) return false;
  const pending = loadPendingFinalization(storage);
  if (!pending) return true;

  if (pendingPointCount(storage) > 0) {
    setRecoveryPending(storage, true);
    return false;
  }

  const finalized = await finalizeActivity(pending.activity_id, pending.distance_m);
  if (!finalized) {
    savePendingFinalization(storage, {
      ...pending,
      attempts: pending.attempts + 1,
    });
    setRecoveryPending(storage, true);
    return false;
  }

  clearPendingFinalization(storage);
  clearPointSeq(storage, pending.activity_id);
  _filterStateByActivity.delete(pending.activity_id);
  const state = loadTrackingState(storage);
  if (state && !state.isTracking && state.activityId === pending.activity_id) {
    storage.set(
      GPS_STORAGE_KEYS.TRACKING_STATE,
      JSON.stringify({ ...state, activityId: null }),
    );
  }
  return true;
}

export async function recoverGpsDataOnLaunch(): Promise<RecoveryResult> {
  const storage = await initializeGpsStorage();
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
  await retryPendingFinalization();

  const buffer = loadBuffer(storage);
  const outbox = loadOutbox(storage);
  const state = loadTrackingState(storage);
  const pendingSession = loadPendingSession(storage) != null;
  const pendingFinalization = loadPendingFinalization(storage) != null;

  const needsResumeUi =
    pendingSession ||
    pendingFinalization ||
    Boolean(state?.activityId && (state.isTracking || buffer.length > 0 || outbox.length > 0));

  setRecoveryPending(storage, needsResumeUi);

  if (__DEV__ && (pendingPointCount(storage) > 0 || pendingFinalization)) {
    console.log(
      `[GPS] recovery: buffer=${buffer.length} outbox=${outbox.length} finalize=${pendingFinalization} resume=${needsResumeUi}`,
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
  const storage = getGpsStorage();
  return storage ? isRecoveryPending(storage) : false;
}

export function isRideTrackingActive(): boolean {
  const storage = getGpsStorage();
  if (!storage) return false;
  const state = loadTrackingState(storage);
  return Boolean(state?.isTracking && state.activityId);
}

/** Restart Expo location task after app kill if MMKV still marks an active ride. */
export async function resumeTrackingAfterRelaunch(): Promise<boolean> {
  const storage = await initializeGpsStorage();
  if (!storage) return false;
  const state = loadTrackingState(storage);
  if (!state?.isTracking || !state.activityId) return false;

  let started = false;
  try {
    started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch {
    started = false;
  }

  let restarted = false;
  if (!started) {
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
    restarted = true;
  }

  startGpsBackgroundSync();

  if (isGpsBackgroundProofEnabled()) {
    let taskActive = false;
    try {
      taskActive = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch {
      taskActive = false;
    }
    logGpsBackgroundProof('RESUMED', {
      activityId: state.activityId,
      taskActive,
      restarted,
    });
  }

  return true;
}

export function clearTrackingRecoveryPending(): void {
  const storage = getGpsStorage();
  if (storage) setRecoveryPending(storage, false);
}

export async function runManualGpsRecovery(): Promise<boolean> {
  if (!(await initializeGpsStorage())) return false;
  await retryPendingSessionCreate();
  await processGpsOutbox();
  await uploadBufferSnapshot();
  await retryPendingFinalization();

  const storage = getGpsStorage();
  if (!storage) return false;

  const stillPending =
    loadPendingSession(storage) != null ||
    loadPendingFinalization(storage) != null ||
    loadBuffer(storage).length > 0 ||
    loadOutbox(storage).length > 0;

  if (!stillPending) {
    clearTrackingRecoveryPending();
    return true;
  }
  return false;
}

export { createSessionWithDurability } from './sessionDurability';
export { processGpsOutbox, uploadBufferSnapshot } from './gpsSyncUpload';

let _syncInterval: ReturnType<typeof setInterval> | null = null;
let _netInfoUnsubscribe: (() => void) | null = null;
let _appStateSubscription: { remove: () => void } | null = null;

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

  const storage = await initializeGpsStorage();
  if (!storage) {
    firebaseCapture(new Error('Durable encrypted GPS storage unavailable'), 'GPS_STORAGE_UNAVAILABLE');
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    let state = loadTrackingState(storage);

    if (!state?.isTracking) return;
    const activityId = state.activityId;
    if (activityId == null) return;

    ensureBufferSchema(storage);

    for (const loc of locations) {
      const currentStats = JSON.parse(
        storage.getString(GPS_STORAGE_KEYS.CURRENT_STATS) ||
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

      const filterState = loadFilterState(storage, activityId);
      const prevAcceptedTs = filterState.lastAccepted?.timestamp ?? 0;
      const seq = nextPointSeq(storage, activityId);
      const candidate = buildGpsPoint(
        {
          device_id: state.deviceId,
          user_id: state.userId,
          activity_id: activityId,
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
        persistFilterStates(storage);
        continue;
      }
      persistFilterStates(storage);

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

      appendToBuffer(storage, {
        ...candidate,
        segment_break: filterState.segmentBreak || undefined,
      });

      state = {
        ...state,
        lastCoord: [loc.coords.longitude, loc.coords.latitude],
        lastAltitude: loc.coords.altitude,
      };
      storage.set(GPS_STORAGE_KEYS.CURRENT_STATS, JSON.stringify(newStats));
      storage.set(GPS_STORAGE_KEYS.TRACKING_STATE, JSON.stringify(state));

      logGpsBackgroundProof('POINT_ACCEPTED', {
        activityId,
        seq,
        pendingPoints: pendingPointCount(storage),
      });
    }
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
    const storage = getGpsStorage();
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
      lastAckAt: getLastAckAt(),
      rideWallClockS,
      gpsActiveTimeS: currentStats.gpsActiveTimeS,
      lastCoord: tracking?.lastCoord ?? null,
      headingDeg: null,
    });
  }

  private async _closeUnstartedActivity(
    storage: NonNullable<ReturnType<typeof getGpsStorage>>,
    activityId: number,
  ): Promise<void> {
    storage.set(
      GPS_STORAGE_KEYS.TRACKING_STATE,
      JSON.stringify({
        isTracking: false,
        activityId,
        deviceId: this._deviceId,
        userId: this._userId,
        lastCoord: null,
        lastAltitude: null,
      } satisfies TrackingState),
    );
    savePendingFinalization(storage, {
      activity_id: activityId,
      distance_m: 0,
      attempts: 0,
    });
    setRecoveryPending(storage, true);
    await retryPendingFinalization();
  }

  async startTracking(
    activityId: number,
    resolution: PollingResolution = PollingResolution.BALANCED,
  ): Promise<void> {
    const storage = await initializeGpsStorage();
    if (!storage) {
      throw new Error('Durable encrypted GPS storage unavailable');
    }

    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      await this._closeUnstartedActivity(storage, activityId);
      throw new Error('Foreground location permission not granted');
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      await this._closeUnstartedActivity(storage, activityId);
      throw new Error('Background location permission not granted');
    }

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
    clearPendingFinalization(storage);
    setRecoveryPending(storage, false);
    storage.set('ride_wall_start_ms', String(Date.now()));

    const config = RESOLUTION_CONFIG[resolution];
    try {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        ...config,
        foregroundService: {
          notificationTitle: '4VELO — Tracking Active',
          notificationBody: `Your route is being recorded (${resolution.toLowerCase()})`,
          notificationColor: '#00FFFF',
        },
      });
    } catch (error) {
      await this._closeUnstartedActivity(storage, activityId);
      throw error;
    }

    if (isGpsBackgroundProofEnabled()) {
      let taskActive = false;
      try {
        taskActive = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      } catch {
        taskActive = false;
      }
      logGpsBackgroundProof('STARTED', {
        activityId,
        taskActive,
        resolution,
      });
    }

    startGpsBackgroundSync();
    this._statsCheckTimer = setInterval(() => this._emitStats(), 2000);
  }

  async setResolution(resolution: PollingResolution): Promise<void> {
    const storage = await initializeGpsStorage();
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
    if (this._statsCheckTimer) {
      clearInterval(this._statsCheckTimer);
      this._statsCheckTimer = null;
    }

    const storage = await initializeGpsStorage();
    if (!storage) {
      throw new Error('Durable encrypted GPS storage unavailable while stopping ride');
    }

    const state = loadTrackingState(storage);
    const activityId = state?.activityId ?? null;
    const stoppedState: TrackingState = {
      ...(state ?? {
        deviceId: this._deviceId,
        userId: this._userId,
        lastCoord: null,
        lastAltitude: null,
      }),
      isTracking: false,
      activityId,
    };

    // Quiesce the producer before taking the final buffer snapshot. The state
    // flag is persisted first so an already-running TaskManager callback sees
    // the ride as stopped even if stopping the native location service awaits.
    storage.set(GPS_STORAGE_KEYS.TRACKING_STATE, JSON.stringify(stoppedState));
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch (error) {
      firebaseCapture(error, 'GPS_LOCATION_STOP_FAILED');
    }

    const stopBufferSnapshot = loadBuffer(storage);
    if (activityId && stopBufferSnapshot.length >= 2) {
      await saveLocalRideSnapshot(activityId, stopBufferSnapshot);
    }
    if (activityId && stopBufferSnapshot.length > 0) {
      await syncRoutePath(activityId, stopBufferSnapshot);
    }

    await processGpsOutbox();
    await uploadBufferSnapshot();

    const pendingUpload = pendingPointCount(storage);
    const stats = JSON.parse(
      storage.getString(GPS_STORAGE_KEYS.CURRENT_STATS) || '{"distanceM":0}',
    ) as { distanceM?: number };

    let finalized = false;
    if (activityId) {
      savePendingFinalization(storage, {
        activity_id: activityId,
        distance_m: stats.distanceM ?? 0,
        attempts: 0,
      });

      if (pendingUpload === 0) {
        finalized = await retryPendingFinalization();
      } else {
        setRecoveryPending(storage, true);
      }
    }

    const finalizationPending = loadPendingFinalization(storage) != null;
    const latestState = loadTrackingState(storage) ?? stoppedState;
    storage.set(
      GPS_STORAGE_KEYS.TRACKING_STATE,
      JSON.stringify({
        ...latestState,
        isTracking: false,
        activityId: pendingUpload > 0 || finalizationPending ? activityId : null,
      }),
    );

    setRecoveryPending(storage, pendingUpload > 0 || finalizationPending);
    return { finalized, pendingUpload };
  }
}
