/**
 * GPS Sync Manager — SPORT Mobile App (v2.1 Gold Master)
 * ====================================================
 * Replaced TransistorSoft with Expo Location + Task Manager.
 * 
 * Fix: Added lazy MMKV initialization to prevent "Runtime not ready" in background tasks.
 */

import { MMKV } from 'react-native-mmkv';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import axios from 'axios';
import { firebaseCapture } from './FirebaseService';

const TELEMETRY_URL = process.env.EXPO_PUBLIC_TELEMETRY_URL ?? 'https://docker-telemetry-production-123c.up.railway.app';
const BATCH_INTERVAL_MS = 30_000;
const MAX_BUFFER_SIZE = 500;
const MAX_RETRIES = 5;
const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';

// Lazy storage initialization
let _storage: MMKV | null = null;
function getStorage() {
  if (!_storage) {
    try {
      _storage = new MMKV({ id: 'gps-buffer' });
    } catch (e) {
      console.error('MMKV init failed in GpsSyncManager. Falling back to mock.', e);
      _storage = {
        getString: (key: string) => null,
        set: (key: string, value: any) => {},
        delete: (key: string) => {},
      } as any;
      return _storage;
    }
  }
  return _storage;
}

interface GpsPoint {
  deviceId: string;
  userId: number | null;
  activityId: number | null;
  lat: number;
  lon: number;
  altitudeM: number;
  speedMs: number;
  accuracyM: number;
  timestamp: number;
}

export interface TrackingStats {
  distanceM: number;
  paceSecPerKm: number;
  elevationGainM: number;
  speedMs: number;
  batteryPct: number;
  pendingPoints: number;
}

function loadBuffer(): GpsPoint[] {
  const storage = getStorage();
  if (!storage) return [];
  const raw = storage.getString('gps_buffer');
  return raw ? (JSON.parse(raw) as GpsPoint[]) : [];
}

function saveBuffer(points: GpsPoint[]): void {
  const storage = getStorage();
  if (storage) {
    storage.set('gps_buffer', JSON.stringify(points));
  }
}

function appendToBuffer(point: GpsPoint): void {
  const buf = loadBuffer();
  buf.push(point);
  if (buf.length > MAX_BUFFER_SIZE) buf.splice(0, buf.length - MAX_BUFFER_SIZE);
  saveBuffer(buf);
}

function clearBuffer(): void {
  const storage = getStorage();
  if (storage) storage.delete('gps_buffer');
}

async function uploadBatch(points: GpsPoint[], attempt = 1): Promise<void> {
  if (points.length === 0) return;
  try {
    await axios.post(
      `${TELEMETRY_URL}/api/telemetry/ingest/batch`,
      { packets: points },
      { timeout: 10_000 },
    );
    clearBuffer();
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const delay = Math.min(2 ** attempt * 1_000, 30_000);
      await new Promise(resolve => setTimeout(resolve, delay));
      await uploadBatch(points, attempt + 1);
    }
  }
}

// Global task definition
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    firebaseCapture(error, 'BACKGROUND_LOCATION_TASK_ERROR');
    return;
  }
  
  const storage = getStorage();
  if (!storage) {
    // If MMKV is not ready yet (JSI issue), we wait 500ms and try once more
    await new Promise(r => setTimeout(r, 500));
    if (!getStorage()) return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const safeStorage = getStorage()!;
    const state = JSON.parse(safeStorage.getString('tracking_state') || '{}');
    
    if (!state.isTracking || !state.activityId) return;

    locations.forEach(loc => {
      const currentStats = JSON.parse(safeStorage.getString('current_stats') || '{"distanceM":0,"elevationGainM":0}');
      
      let distanceIncrement = 0;
      if (state.lastCoord) {
        distanceIncrement = calculateDistance(state.lastCoord, [loc.coords.longitude, loc.coords.latitude]);
      }

      let elevationIncrement = 0;
      if (state.lastAltitude !== null && loc.coords.altitude !== null && loc.coords.altitude > state.lastAltitude) {
        elevationIncrement = loc.coords.altitude - state.lastAltitude;
      }

      const newStats = {
        distanceM: currentStats.distanceM + (distanceIncrement > 2 ? distanceIncrement : 0),
        elevationGainM: currentStats.elevationGainM + elevationIncrement,
        speedMs: loc.coords.speed ?? 0,
        paceSecPerKm: (loc.coords.speed ?? 0) > 0.5 ? 1000 / (loc.coords.speed ?? 0) : 0,
        batteryPct: 1.0,
        pendingPoints: 0
      };

      safeStorage.set('current_stats', JSON.stringify(newStats));
      safeStorage.set('tracking_state', JSON.stringify({
        ...state,
        lastCoord: [loc.coords.longitude, loc.coords.latitude],
        lastAltitude: loc.coords.altitude
      }));

      appendToBuffer({
        deviceId: state.deviceId,
        userId: state.userId,
        activityId: state.activityId,
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
        altitudeM: loc.coords.altitude ?? 0,
        speedMs: loc.coords.speed ?? 0,
        accuracyM: loc.coords.accuracy ?? 5,
        timestamp: loc.timestamp / 1000,
      });
    });
  }
});

function calculateDistance(p1: [number, number], p2: [number, number]): number {
  const R = 6371e3;
  const dLat = (p2[1] - p1[1]) * Math.PI / 180;
  const dLon = (p2[0] - p1[0]) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(p1[1] * Math.PI / 180) * Math.cos(p2[1] * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export class GpsSyncManager {
  private _deviceId: string;
  private _userId: number | null;
  private _batchTimer: any = null;
  private _onUpdate: ((stats: TrackingStats) => void) | null = null;
  private _statsCheckTimer: any = null;

  constructor(deviceId: string, userId: number | null = null) {
    this._deviceId = deviceId;
    this._userId = userId;
  }

  setUpdateCallback(cb: (stats: TrackingStats) => void): void {
    this._onUpdate = cb;
  }

  private _emitStats(): void {
    if (!this._onUpdate) return;
    const storage = getStorage();
    if (!storage) return;

    const currentStats = JSON.parse(storage.getString('current_stats') || '{"distanceM":0,"elevationGainM":0,"speedMs":0,"paceSecPerKm":0}');
    this._onUpdate({
      ...currentStats,
      pendingPoints: loadBuffer().length,
    });
  }

  async startTracking(activityId: number): Promise<void> {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') throw new Error('Foreground location permission not granted');

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') throw new Error('Background location permission not granted');

    const storage = getStorage();
    if (storage) {
      storage.set('tracking_state', JSON.stringify({
        isTracking: true,
        activityId,
        deviceId: this._deviceId,
        userId: this._userId,
        lastCoord: null,
        lastAltitude: null
      }));
      
      storage.set('current_stats', JSON.stringify({
        distanceM: 0,
        elevationGainM: 0,
        speedMs: 0,
        paceSecPerKm: 0
      }));
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 5,
      deferredUpdatesInterval: 5000,
      foregroundService: {
        notificationTitle: 'SPORT — Tracking Active',
        notificationBody: 'Your route is being recorded with Cyan-precision',
        notificationColor: '#00FFFF'
      }
    });

    this._batchTimer = setInterval(() => {
      const buffer = loadBuffer();
      if (buffer.length > 0) uploadBatch([...buffer]);
    }, BATCH_INTERVAL_MS);

    this._statsCheckTimer = setInterval(() => {
      this._emitStats();
    }, 2000);
  }

  async stopTracking(): Promise<void> {
    if (this._batchTimer) clearInterval(this._batchTimer);
    if (this._statsCheckTimer) clearInterval(this._statsCheckTimer);
    
    const remaining = loadBuffer();
    if (remaining.length > 0) await uploadBatch(remaining);

    const storage = getStorage();
    if (storage) {
      const state = JSON.parse(storage.getString('tracking_state') || '{}');
      storage.set('tracking_state', JSON.stringify({ ...state, isTracking: false }));
    }

    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}
