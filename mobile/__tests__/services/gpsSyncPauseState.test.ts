import {
  pauseTrackingState,
  resumeTrackingState,
  rideElapsedSeconds,
  type TrackingState,
} from '../../src/services/gpsSyncStorage';

const activeState = (): TrackingState => ({
  isTracking: true,
  isPaused: false,
  pausedAtMs: null,
  accumulatedPausedMs: 0,
  resumeSegmentBreakPending: false,
  activityId: 42,
  deviceId: 'dev-1',
  userId: 1,
  lastCoord: [21.9883, 52.1676],
  lastAltitude: 155,
  resolution: 'BALANCED',
});

describe('persisted Ride pause lifecycle', () => {
  test('PAUSED survives persistence and freezes elapsed ride time', () => {
    const wallStartMs = 100_000;
    const paused = pauseTrackingState(activeState(), 120_000);
    const restored = JSON.parse(JSON.stringify(paused)) as TrackingState;

    expect(restored).toMatchObject({
      activityId: 42,
      isTracking: false,
      isPaused: true,
      pausedAtMs: 120_000,
      accumulatedPausedMs: 0,
      resumeSegmentBreakPending: true,
    });

    expect(rideElapsedSeconds(restored, wallStartMs, 120_000)).toBe(20);
    expect(rideElapsedSeconds(restored, wallStartMs, 180_000)).toBe(20);
  });

  test('resume excludes paused wall time and fences the first new segment', () => {
    const wallStartMs = 100_000;
    const paused = pauseTrackingState(activeState(), 120_000);
    const resumed = resumeTrackingState(paused, 180_000);

    expect(resumed).toMatchObject({
      activityId: 42,
      isTracking: true,
      isPaused: false,
      pausedAtMs: null,
      accumulatedPausedMs: 60_000,
      resumeSegmentBreakPending: true,
      lastCoord: null,
      lastAltitude: null,
    });

    expect(rideElapsedSeconds(resumed, wallStartMs, 190_000)).toBe(30);
  });

  test('multiple pauses accumulate without changing activity identity', () => {
    const firstPaused = pauseTrackingState(activeState(), 120_000);
    const firstResumed = resumeTrackingState(firstPaused, 150_000);
    const secondPaused = pauseTrackingState(firstResumed, 170_000);
    const secondResumed = resumeTrackingState(secondPaused, 200_000);

    expect(secondResumed.activityId).toBe(42);
    expect(secondResumed.accumulatedPausedMs).toBe(60_000);
    expect(rideElapsedSeconds(secondResumed, 100_000, 210_000)).toBe(50);
  });

  test('stopped state has no live elapsed clock', () => {
    const stopped = { ...activeState(), isTracking: false, activityId: null };
    expect(rideElapsedSeconds(stopped, 100_000, 200_000)).toBeUndefined();
  });
});
