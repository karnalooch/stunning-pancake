import {
  DETERMINISTIC_RIDE_METRICS,
  deterministicRideReducer,
  initialDeterministicRideState,
} from '../../../src/features/ride/controller/deterministicRideState';

describe('deterministicRideReducer', () => {
  test('starts from a fixed deterministic ride snapshot', () => {
    const state = deterministicRideReducer(initialDeterministicRideState, { type: 'start' });

    expect(state).toMatchObject({
      isRecording: true,
      ridePaused: false,
      rideFinishState: null,
      ...DETERMINISTIC_RIDE_METRICS,
    });
  });

  test('pauses and resumes only while recording', () => {
    const idlePause = deterministicRideReducer(initialDeterministicRideState, {
      type: 'set-paused',
      value: true,
    });
    expect(idlePause).toBe(initialDeterministicRideState);

    const active = deterministicRideReducer(initialDeterministicRideState, { type: 'start' });
    const paused = deterministicRideReducer(active, { type: 'set-paused', value: true });
    const resumed = deterministicRideReducer(paused, { type: 'set-paused', value: false });

    expect(paused.ridePaused).toBe(true);
    expect(resumed.ridePaused).toBe(false);
  });

  test('finishes into a stable summary and clears live state', () => {
    const active = deterministicRideReducer(initialDeterministicRideState, { type: 'start' });
    const finished = deterministicRideReducer(active, { type: 'finish' });

    expect(finished.isRecording).toBe(false);
    expect(finished.ridePaused).toBe(false);
    expect(finished.liveSpeed).toBe(0);
    expect(finished.liveDistanceKm).toBe(0);
    expect(finished.rideFinishState).toEqual({
      kind: 'durable-success',
      summary: {
        distanceKm: DETERMINISTIC_RIDE_METRICS.liveDistanceKm,
        elapsedS: DETERMINISTIC_RIDE_METRICS.liveElapsedS,
        elevationGainM: DETERMINISTIC_RIDE_METRICS.liveElevationGainM,
      },
    });
  });

  test.each([
    ['pending-finalization', 'pending-finalization'],
    ['recovery-required', 'recovery-required'],
  ] as const)('can force %s terminal truth', (_label, kind) => {
    const active = deterministicRideReducer(initialDeterministicRideState, { type: 'start' });
    const finished = deterministicRideReducer(active, { type: 'finish', kind });

    expect(finished.rideFinishState?.kind).toBe(kind);
    expect(finished.rideFinishState?.summary?.distanceKm).toBe(
      DETERMINISTIC_RIDE_METRICS.liveDistanceKm,
    );
  });
});
