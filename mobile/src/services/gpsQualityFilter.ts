/**
 * GPS pre-append quality filters (ADR 011 mobile-side guarantees).
 */

import type { GpsPoint } from './gpsSyncStorage';

export interface GpsFilterProfile {
  maxAccuracyM: number;
  maxSpeedKmh: number;
  maxJumpM: number;
  minTimeDeltaS: number;
  gapBreakS: number;
  stationaryRadiusM: number;
  stationaryMinDeltaS: number;
  clockSkewS: number;
}

export const DEFAULT_GPS_FILTER_PROFILE: GpsFilterProfile = {
  maxAccuracyM: 80,
  maxSpeedKmh: 120,
  maxJumpM: 400,
  minTimeDeltaS: 0.05,
  gapBreakS: 90,
  stationaryRadiusM: 8,
  stationaryMinDeltaS: 15,
  clockSkewS: 2,
};

export interface GpsFilterState {
  lastAccepted: GpsPoint | null;
  lastAcceptedTime: number;
  segmentBreak: boolean;
  droppedCount: number;
}

export function createGpsFilterState(): GpsFilterState {
  return {
    lastAccepted: null,
    lastAcceptedTime: 0,
    segmentBreak: false,
    droppedCount: 0,
  };
}

function haversineM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type GpsFilterRejectReason =
  | 'accuracy'
  | 'monotonic_time'
  | 'max_speed'
  | 'jump'
  | 'stationary_dup';

export interface GpsFilterResult {
  accept: boolean;
  reason?: GpsFilterRejectReason;
  segmentBreak?: boolean;
}

export function evaluateGpsPoint(
  point: GpsPoint,
  state: GpsFilterState,
  profile: GpsFilterProfile = DEFAULT_GPS_FILTER_PROFILE,
): GpsFilterResult {
  const prev = state.lastAccepted;
  if (point.accuracy_m > profile.maxAccuracyM) {
    state.droppedCount += 1;
    return { accept: false, reason: 'accuracy' };
  }

  if (!prev) {
    return { accept: true, segmentBreak: false };
  }

  const dt = point.timestamp - prev.timestamp;
  if (point.timestamp <= prev.timestamp - profile.clockSkewS) {
    state.droppedCount += 1;
    return { accept: false, reason: 'monotonic_time' };
  }
  if (dt < profile.minTimeDeltaS) {
    state.droppedCount += 1;
    return { accept: false, reason: 'monotonic_time' };
  }

  const distM = haversineM(prev.lat, prev.lon, point.lat, point.lon);
  if (dt > profile.gapBreakS) {
    state.segmentBreak = true;
  }

  if (dt >= profile.minTimeDeltaS) {
    const speedKmh = (distM / dt) * 3.6;
    if (speedKmh > profile.maxSpeedKmh) {
      state.droppedCount += 1;
      return { accept: false, reason: 'max_speed' };
    }
    if (
      distM > profile.maxJumpM &&
      (point.accuracy_m > profile.maxAccuracyM * 0.5 ||
        speedKmh > profile.maxSpeedKmh * 0.8)
    ) {
      state.droppedCount += 1;
      return { accept: false, reason: 'jump' };
    }
  }

  const speedMs = point.speed_ms ?? 0;
  if (
    Math.abs(speedMs) < 0.5 &&
    distM < profile.stationaryRadiusM &&
    dt < profile.stationaryMinDeltaS
  ) {
    state.droppedCount += 1;
    return { accept: false, reason: 'stationary_dup' };
  }

  return { accept: true, segmentBreak: state.segmentBreak };
}

export function acceptGpsPoint(
  point: GpsPoint,
  state: GpsFilterState,
  profile?: GpsFilterProfile,
): boolean {
  const result = evaluateGpsPoint(point, state, profile);
  if (!result.accept) return false;
  state.lastAccepted = point;
  state.lastAcceptedTime = point.timestamp;
  state.segmentBreak = result.segmentBreak ?? false;
  return true;
}
