/**
 * Ride session lifecycle — durable session create + GpsSyncManager tracking.
 */

import { MMKV } from 'react-native-mmkv';
import { ActivityService } from './api';
import {
  GpsSyncManager,
  isRideTrackingActive,
  PollingResolution,
  resumeTrackingAfterRelaunch,
} from './GpsSyncManager';

const DEVICE_ID_KEY = 'gps_device_id';

let _gpsManager: GpsSyncManager | null = null;

function appStorage(): MMKV | null {
  try {
    return new MMKV();
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
  type?: string;
  event_id?: number;
  userId: number | null;
}): Promise<number> {
  const activityId = await ActivityService.createSession({
    type: options.type ?? 'ride',
    start_time: new Date().toISOString(),
    event_id: options.event_id,
  });
  const manager = getRideGpsManager(options.userId);
  await manager.startTracking(activityId, PollingResolution.BALANCED);
  return activityId;
}

export async function stopRideSession(userId: number | null): Promise<void> {
  const manager = getRideGpsManager(userId);
  await manager.stopTracking();
}

/** After app relaunch — restore UI + background GPS if a ride was in progress. */
export async function resumeActiveRideIfNeeded(
  userId: number | null,
): Promise<boolean> {
  if (!isRideTrackingActive()) return false;
  getRideGpsManager(userId);
  await resumeTrackingAfterRelaunch();
  return true;
}

export { createSessionWithDurability } from './sessionDurability';
