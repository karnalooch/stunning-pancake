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
  clearBuffer,
  clearPendingSession,
  ensureBufferSchema,
  GPS_STORAGE_KEYS,
  GpsPoint,
  isRecoveryPending,
  loadBuffer,
  loadOutbox,
  loadPendingSession,
  loadTrackingState,
  mergeRouteCoordinates,
  nextPointSeq,
  pendingPointCount,
  savePendingSession,
  setRecoveryPending,
  TrackingState,
  type TrackingStats,
} from './gpsSyncStorage';
import { saveLocalRideSnapshot } from './gpsLocalExport';
import {
  flushGpsUploadQueues,
  getGpsStorage,
  getLastAckAt,
  isGlobalIngestPaused,
  MAX_RETRIES,
  processGpsOutbox,
  uploadBufferSnapshot,
} from './gpsSyncUpload';

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

async function finalizeActivity(
  activityId: number,
  distanceM: number,
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await api.post(mobileActivityPaths.sessionFinalize(activityId), {
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
  const storage = getGpsStorage();
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
  const storage = getGpsStorage();
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
  const storage = getGpsStorage();
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
  const storage = getGpsStorage();
  if (storage) setRecoveryPending(storage, false);
}

export async function runManualGpsRecovery(): Promise<boolean> {
  await retryPendingSessionCreate();
  await processGpsOutbox();
  await uploadBufferSnapshot();

  const storage = getGpsStorage();
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

  const storage = getGpsStorage();
  if (!storage) {
    await new Promise((r) => setTimeout(r, 500));
    if (!getGpsStorage()) return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const safeStorage = getGpsStorage()!;
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

    const storage = getGpsStorage();
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
    const storage = getGpsStorage();
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

    const storage = getGpsStorage();
    const state = storage ? loadTrackingState(storage) : null;
    const activityId = state?.activityId ?? null;

    await processGpsOutbox();
    await uploadBufferSnapshot();

    const pendingUpload = storage ? pendingPointCount(storage) : 0;
    const allPoints = storage ? loadBuffer(storage) : [];

    if (activityId && allPoints.length >= 2) {
      await saveLocalRideSnapshot(activityId, allPoints);
    }

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
