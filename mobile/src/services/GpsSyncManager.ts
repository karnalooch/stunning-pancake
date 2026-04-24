/**
 * GPS Sync Manager — SPORT Mobile App (Milestone 3)
 * ====================================================
 * Constitution §9.3: GPS Batching + Offline-First
 * Constitution §16.2: Adaptive GPS Sampling (Battery-Aware)
 *
 * Handles:
 * 1. Adaptive GPS sampling rate based on speed, motion type & battery level.
 * 2. Local buffering of GPS points (MMKV fast storage).
 * 3. Batch upload to FastAPI Telemetry service every 30s.
 * 4. Exponential backoff retry on network failure.
 * 5. Real-time metrics: distance, pace, elevation gain, battery.
 * 6. Error boundary with onError callback (Sentry-ready).
 */

import { MMKV } from 'react-native-mmkv';
import { getBatteryLevel } from 'react-native-device-info';
import BackgroundGeolocation, {
  type Location,
  type MotionActivityEvent,
} from 'react-native-background-geolocation';
import axios from 'axios';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TELEMETRY_URL = process.env.TELEMETRY_URL ?? 'http://localhost:8001';
const BATCH_INTERVAL_MS = 30_000;       // 30s batch upload
const MAX_BUFFER_SIZE = 500;            // Max points held before forced flush
const MAX_RETRIES = 5;

/** Adaptive sampling intervals (ms) by motion type */
const SAMPLING_INTERVALS: Record<string, number> = {
  running: 3_000,    // 3s — high precision needed
  cycling: 5_000,    // 5s — fast movement, less density
  walking: 10_000,   // 10s — slow movement, battery savings
  stationary: 60_000, // 1min — conserve battery when stopped
  unknown: 5_000,
};

/** Low battery mode: forces high-power off, relaxes accuracy */
const LOW_BATTERY_THRESHOLD = 0.20; // 20%

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const storage = new MMKV({ id: 'gps-buffer' });

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

/** Richer real-time stats emitted to the UI layer. */
export interface TrackingStats {
  distanceM: number;       // Total distance in metres
  paceSecPerKm: number;    // Current pace in seconds/km (0 if stationary)
  elevationGainM: number;  // Total elevation gain in metres
  speedMs: number;         // Current speed in m/s
  batteryPct: number;      // Device battery level 0-1
  pendingPoints: number;   // GPS points waiting to upload
}

function loadBuffer(): GpsPoint[] {
  const raw = storage.getString('gps_buffer');
  return raw ? (JSON.parse(raw) as GpsPoint[]) : [];
}

function saveBuffer(points: GpsPoint[]): void {
  storage.set('gps_buffer', JSON.stringify(points));
}

function appendToBuffer(point: GpsPoint): void {
  const buf = loadBuffer();
  buf.push(point);
  // Prevent unbounded growth
  if (buf.length > MAX_BUFFER_SIZE) buf.splice(0, buf.length - MAX_BUFFER_SIZE);
  saveBuffer(buf);
}

function clearBuffer(): void {
  storage.delete('gps_buffer');
}

// ---------------------------------------------------------------------------
// Batch upload with exponential backoff
// ---------------------------------------------------------------------------

async function uploadBatch(points: GpsPoint[], attempt = 1): Promise<void> {
  if (points.length === 0) return;

  try {
    await axios.post(
      `${TELEMETRY_URL}/api/telemetry/ingest/batch`,
      { packets: points },
      { timeout: 10_000 },
    );
    clearBuffer();
    console.log(`[SyncManager] Uploaded ${points.length} points`);
  } catch (err) {
    if (attempt >= MAX_RETRIES) {
      console.warn('[SyncManager] Max retries reached, keeping buffer for next cycle');
      return;
    }
    // Exponential backoff: 2^attempt seconds
    const delay = Math.min(2 ** attempt * 1_000, 30_000);
    console.warn(`[SyncManager] Upload failed (attempt ${attempt}), retry in ${delay}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
    await uploadBatch(points, attempt + 1);
  }
}

// ---------------------------------------------------------------------------
// Sync Manager class
// ---------------------------------------------------------------------------

export class GpsSyncManager {
  private _deviceId: string;
  private _userId: number | null;
  private _activityId: number | null = null;
  private _batchTimer: ReturnType<typeof setInterval> | null = null;
  private _batteryTimer: ReturnType<typeof setInterval> | null = null;
  private _currentMotion: string = 'unknown';
  private _totalDistanceM: number = 0;
  private _elevationGainM: number = 0;
  private _lastCoord: [number, number] | null = null;
  private _lastAltitudeM: number | null = null;
  private _lastSpeedMs: number = 0;
  private _batteryPct: number = 1.0;
  private _onUpdate: ((stats: TrackingStats) => void) | null = null;
  private _onError: ((err: Error) => void) | null = null;

  constructor(deviceId: string, userId: number | null = null) {
    this._deviceId = deviceId;
    this._userId = userId;
  }

  /** Registers a callback for real-time stats updates. */
  setUpdateCallback(cb: (stats: TrackingStats) => void): void {
    this._onUpdate = cb;
  }

  /** Registers an error callback (wire to Sentry in production). */
  setErrorCallback(cb: (err: Error) => void): void {
    this._onError = cb;
  }

  private _emitStats(): void {
    if (!this._onUpdate) return;
    this._onUpdate({
      distanceM: this._totalDistanceM,
      paceSecPerKm: this._lastSpeedMs > 0.5 ? 1000 / this._lastSpeedMs : 0,
      elevationGainM: this._elevationGainM,
      speedMs: this._lastSpeedMs,
      batteryPct: this._batteryPct,
      pendingPoints: this.getPendingCount(),
    });
  }

  private _handleError(err: unknown, context: string): void {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`[SyncManager] ${context}:`, error.message);
    if (this._onError) this._onError(error);
    // Future: Sentry.captureException(error, { extra: { context } });
  }

  /**
   * Starts background GPS tracking and batch sync.
   *
   * @param activityId - Active SPORT activity ID to tag points with.
   */
  async startTracking(activityId: number): Promise<void> {
    this._activityId = activityId;

    // Start battery polling every 2 minutes
    this._batteryTimer = setInterval(async () => {
      try {
        this._batteryPct = await getBatteryLevel();
        // In low battery mode: switch to MEDIUM accuracy
        const accuracy = this._batteryPct < LOW_BATTERY_THRESHOLD
          ? BackgroundGeolocation.DESIRED_ACCURACY_MEDIUM
          : BackgroundGeolocation.DESIRED_ACCURACY_HIGH;
        await BackgroundGeolocation.setConfig({ desiredAccuracy: accuracy });
        console.log(`[SyncManager] Battery: ${(this._batteryPct * 100).toFixed(0)}% → accuracy=${accuracy}`);
      } catch (err) { this._handleError(err, 'battery_poll'); }
    }, 120_000);

    await BackgroundGeolocation.ready({
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 5,

      // Battery optimisation (Constitution §16.2)
      stopOnTerminate: false,
      startOnBoot: true,
      preventSuspend: true,

      // Android foreground service notification
      notification: {
        title: 'SPORT — Tracking aktywny',
        text: 'Twoja trasa jest nagrywana',
        smallIcon: 'drawable/ic_stat_sport',
      },

      isMoving: true,
      activityType: BackgroundGeolocation.ACTIVITY_TYPE_FITNESS,
      stopTimeout: 5,
    });

    // Adaptive sampling based on motion type
    BackgroundGeolocation.onMotionChange((event: MotionActivityEvent) => {
      this._currentMotion = (event as unknown as { activity: string }).activity ?? 'unknown';
      const interval = SAMPLING_INTERVALS[this._currentMotion] ?? 5_000;
      BackgroundGeolocation.setConfig({ locationUpdateInterval: interval });
      console.log(`[SyncManager] Motion: ${this._currentMotion}, interval: ${interval}ms`);
    });

    // Error handler (Sentry-ready boundary)
    BackgroundGeolocation.onLocation(
      (location: Location) => {
        try {
          const coord: [number, number] = [location.coords.longitude, location.coords.latitude];
          const altM: number = location.coords.altitude ?? 0;
          const speedMs: number = location.coords.speed ?? 0;

          // Elevation gain
          if (this._lastAltitudeM !== null && altM > this._lastAltitudeM) {
            this._elevationGainM += altM - this._lastAltitudeM;
          }
          this._lastAltitudeM = altM;
          this._lastSpeedMs = speedMs;

          // Distance (Haversine with jitter filter)
          if (this._lastCoord) {
            const d = this.calculateDistance(this._lastCoord, coord);
            if (d > 2) this._totalDistanceM += d;
          }
          this._lastCoord = coord;

          appendToBuffer({
            deviceId: this._deviceId,
            userId: this._userId,
            activityId: this._activityId,
            lat: location.coords.latitude,
            lon: location.coords.longitude,
            altitudeM: altM,
            speedMs,
            accuracyM: location.coords.accuracy ?? 5,
            timestamp: new Date(location.timestamp).getTime() / 1000,
          });

          this._emitStats();
        } catch (err) {
          this._handleError(err, 'onLocation');
        }
      },
      (locationError) => {
        this._handleError(new Error(`GPS error code=${locationError.code}`), 'location_error');
      },
    );

    await BackgroundGeolocation.start();

    // Batch upload timer
    this._batchTimer = setInterval(async () => {
      const buffer = loadBuffer();
      if (buffer.length > 0) {
        try {
          await uploadBatch([...buffer]);
        } catch (err) {
          this._handleError(err, 'batch_upload');
        }
      }
    }, BATCH_INTERVAL_MS);

    console.log(`[SyncManager] Tracking started activityId=${activityId}`);
  }

  async stopTracking(): Promise<void> {
    if (this._batchTimer) {
      clearInterval(this._batchTimer);
      this._batchTimer = null;
    }
    if (this._batteryTimer) {
      clearInterval(this._batteryTimer);
      this._batteryTimer = null;
    }

    // Final flush
    const remaining = loadBuffer();
    if (remaining.length > 0) {
      await uploadBatch(remaining);
    }

    await BackgroundGeolocation.stop();
    this._activityId = null;
    this._lastCoord = null;
    this._lastAltitudeM = null;
    this._totalDistanceM = 0;
    this._elevationGainM = 0;
    this._lastSpeedMs = 0;
    console.log('[SyncManager] Tracking stopped, buffer flushed');
  }

  /** @deprecated Use setUpdateCallback with TrackingStats. */
  setUpdateCallback(cb: (stats: TrackingStats) => void): void {
    this._onUpdate = cb;
  }

  /** Haversine formula for distance between coordinates in metres. */
  private calculateDistance(p1: [number, number], p2: [number, number]): number {
    const R = 6371e3; // Earth radius in metres
    const φ1 = p1[1] * Math.PI / 180;
    const φ2 = p2[1] * Math.PI / 180;
    const Δφ = (p2[1] - p1[1]) * Math.PI / 180;
    const Δλ = (p2[0] - p1[0]) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /** Returns the current buffer size (for UI display). */
  getPendingCount(): number {
    return loadBuffer().length;
  }
}
