import {
  classifyRideFinishState,
  isDurableRideSuccess,
  type RideSummaryPayload,
} from '../../../src/features/ride/model/RideFinishState';

const summary: RideSummaryPayload = {
  distanceKm: 42.3,
  elapsedS: 3600,
  elevationGainM: 510,
};

describe('RideFinishState truth classification', () => {
  test('durable success requires finalized with an empty pending queue', () => {
    const state = classifyRideFinishState(summary, {
      finalized: true,
      pendingUpload: 0,
    });

    expect(state).toEqual({ kind: 'durable-success', summary });
    expect(isDurableRideSuccess(state)).toBe(true);
  });

  test.each([
    { finalized: false, pendingUpload: 0 },
    { finalized: true, pendingUpload: 2 },
    { finalized: false, pendingUpload: 2 },
  ])('pending finalization never classifies as durable success: %p', (result) => {
    const state = classifyRideFinishState(summary, result);

    expect(state?.kind).toBe('pending-finalization');
    expect(isDurableRideSuccess(state)).toBe(false);
  });

  test('finalization error requires recovery and never becomes success', () => {
    const state = classifyRideFinishState(
      summary,
      null,
      'network finalization failed',
    );

    expect(state).toEqual({
      kind: 'recovery-required',
      summary,
      reason: 'network finalization failed',
    });
    expect(isDurableRideSuccess(state)).toBe(false);
  });

  test('zero-distance stop has no Summary terminal state', () => {
    expect(
      classifyRideFinishState(null, { finalized: true, pendingUpload: 0 }),
    ).toBeNull();
  });
});
