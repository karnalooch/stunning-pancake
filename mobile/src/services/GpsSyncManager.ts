/**
 * GPS Sync Manager — SPORT Mobile App
 * =====================================
 * Constitution §9.3: GPS Batching + Offline-First
 * Constitution §16.2: Adaptive GPS Sampling
 *
 * Handles:
 * 1. Adaptive GPS sampling rate based on speed & battery level.
 * 2. Local buffering of GPS points (MMKV fast storage).
 * 3. Batch upload to FastAPI Telemetry service every 30s.
 * 4. Exponential backoff retry on network failure.
 */

import { MMKV } from 'react-native-mmkv';
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
const MAX_BUFFER_SIZE = 500;            // Max points held in memory before forced flush
const MAX_RETRIES = 5;

/** Adaptive sampling intervals (ms) by movement type */
const SAMPLING_INTERVALS: Record<string, number> = {
  running: 3_000,    // 3s — high precision needed
  cycling: 5_000,    // 5s — fast movement, less density needed
  walking: 10_000,   // 10s — slow movement, battery savings
  stationary: 60_000, // 1min — conserve battery when stopped
  unknown: 5_000,
};

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
  speedMs: number;
  accuracyM: number;
  timestamp: number;
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
  private _activityId: number | null;
  private _batchTimer: ReturnType<typeof setInterval> | null = null;
  private _currentMotion: string = 'unknown';

  constructor(deviceId: string, userId: number | null = null) {
    this._deviceId = deviceId;
    this._userId = userId;
    this._activityId = null;
  }

  /**
   * Starts background GPS tracking and batch sync.
   *
   * @param activityId - Active SPORT activity ID to tag points with.
   */
  async startTracking(activityId: number): Promise<void> {
    this._activityId = activityId;

    await BackgroundGeolocation.ready({
      // Accuracy
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 5,            // Only record if moved 5m

      // Battery optimisation (Constitution §16.2)
      stopOnTerminate: false,
      startOnBoot: true,
      preventSuspend: true,

      // Notification (required for Android foreground service)
      notification: {
        title: 'SPORT — Tracking aktywny',
        text: 'Twoja trasa jest nagrywana',
        smallIcon: 'drawable/ic_stat_sport',
      },

      // Geofence / Motion detection
      isMoving: true,
      activityType: BackgroundGeolocation.ACTIVITY_TYPE_FITNESS,
      stopTimeout: 5,
    });

    // Adaptive sampling based on detected motion activity
    BackgroundGeolocation.onMotionChange((event: MotionActivityEvent) => {
      this._currentMotion = (event as unknown as { activity: string }).activity ?? 'unknown';
      const interval = SAMPLING_INTERVALS[this._currentMotion] ?? 5_000;
      BackgroundGeolocation.setConfig({ locationUpdateInterval: interval });
      console.log(`[SyncManager] Motion: ${this._currentMotion}, interval: ${interval}ms`);
    });

    // Buffer incoming GPS points
    BackgroundGeolocation.onLocation((location: Location) => {
      appendToBuffer({
        deviceId: this._deviceId,
        userId: this._userId,
        activityId: this._activityId,
        lat: location.coords.latitude,
        lon: location.coords.longitude,
        speedMs: location.coords.speed ?? 0,
        accuracyM: location.coords.accuracy ?? 5,
        timestamp: new Date(location.timestamp).getTime() / 1000,
      });
    });

    await BackgroundGeolocation.start();

    // Start batch upload timer
    this._batchTimer = setInterval(async () => {
      const buffer = loadBuffer();
      if (buffer.length > 0) {
        await uploadBatch([...buffer]);
      }
    }, BATCH_INTERVAL_MS);

    console.log(`[SyncManager] Tracking started activityId=${activityId}`);
  }

  /**
   * Stops tracking and flushes remaining buffer.
   */
  async stopTracking(): Promise<void> {
    if (this._batchTimer) {
      clearInterval(this._batchTimer);
      this._batchTimer = null;
    }

    // Final flush
    const remaining = loadBuffer();
    if (remaining.length > 0) {
      await uploadBatch(remaining);
    }

    await BackgroundGeolocation.stop();
    this._activityId = null;
    console.log('[SyncManager] Tracking stopped, buffer flushed');
  }

  /** Returns the current buffer size (for UI display). */
  getPendingCount(): number {
    return loadBuffer().length;
  }
}
