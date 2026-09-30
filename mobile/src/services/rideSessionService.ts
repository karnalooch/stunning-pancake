/**
 * Ride session lifecycle — durable session create + GpsSyncManager tracking.
 */

import { createAppMmkv, type AppMmkvStorage } from './mmkvStorage';
import { ActivityService, type ActivitySportType } from './api';
import {
  GpsSyncManager,
  PollingResolution,
  restoreRideTrackingAfterRelaunch,
} from './GpsSyncManager';

const DEVICE_ID_KEY = 'gps_device_id';

let _gpsManager: GpsSyncManager | null = null;

function appStorage(): AppMmkvStorage | null {
  try {
    return createAppMmkv();
  } catch {
    return null;
  }
}

export function getOrCreateDeviceId(): string {
  const store = appStorage();
  const existing = store?.getString(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = `4velo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  store?.set(DEVICE_ID_KEY, id);
  return id;
}

export function getRideGpsManager(userId: number | null): GpsSyncManager {
  if (!_gpsManager) {
    _gpsManager = new GpsSyncManager(getOrCreateDeviceId(), userId);
  } else if (userId != null) {
    _gpsManager.setUserId(userId);
  }
  return _gpsManager;
}

export async function startRideSession(options: {
  type?: ActivitySportType;
  event_id?: number;
  userId: number | null;
}): Promise<number> {
  const activityId = await ActivityService.createSession({
    type: options.type ?? 'BIKE',
    start_time: new Date().toISOString(),
    event_id: options.event_id,
  });
  const manager = getRideGpsManager(options.userId);
  await manager.startTracking(activityId, PollingResolution.BALANCED);
  return activityId;
}

export async function pauseRideSession(userId: number | null): Promise<boolean> {
  return getRideGpsManager(userId).pauseTracking();
}

export async function resumeRideSession(userId: number | null): Promise<boolean> {
  return getRideGpsManager(userId).resumeTracking();
}

export async function stopRideSession(
  userId: number | null,
): Promise<{ finalized: boolean; pendingUpload: number }> {
  const manager = getRideGpsManager(userId);
  return manager.stopTracking();
}

/** After app relaunch — restore ACTIVE or PAUSED truth without changing activity identity. */
export async function restoreRideSessionIfNeeded(
  userId: number | null,
): Promise<'active' | 'paused' | null> {
  const manager = getRideGpsManager(userId);
  const restored = await restoreRideTrackingAfterRelaunch();
  if (restored) manager.startStatsUpdates();
  return restored;
}

export { createSessionWithDurability } from './sessionDurability';
