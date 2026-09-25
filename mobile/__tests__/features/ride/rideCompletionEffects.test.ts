import { applyDurableRideCompletionEffects } from '../../../src/features/ride/controller/applyRideCompletionEffects';
import type { RideFinishState } from '../../../src/features/ride/model/RideFinishState';

const summary = { distanceKm: 42, elapsedS: 3600, elevationGainM: 500 };

describe('applyDurableRideCompletionEffects', () => {
  const makeEffects = () => ({
    recordRideComplete: jest.fn(),
    syncRideQuestProgress: jest.fn(),
  });

  test('durable success awards completion effects exactly once', () => {
    const effects = makeEffects();
    const state: RideFinishState = { kind: 'durable-success', summary };

    expect(applyDurableRideCompletionEffects(state, effects)).toBe(true);
    expect(effects.recordRideComplete).toHaveBeenCalledTimes(1);
    expect(effects.recordRideComplete).toHaveBeenCalledWith(42, 60);
    expect(effects.syncRideQuestProgress).toHaveBeenCalledTimes(1);
    expect(effects.syncRideQuestProgress).toHaveBeenCalledWith(42, 60);
  });

  test.each([
    { kind: 'pending-finalization', summary, pendingUpload: 2 } as const,
    { kind: 'recovery-required', summary, reason: 'stop failed' } as const,
  ])('$kind never awards completion effects', (state) => {
    const effects = makeEffects();

    expect(applyDurableRideCompletionEffects(state, effects)).toBe(false);
    expect(effects.recordRideComplete).not.toHaveBeenCalled();
    expect(effects.syncRideQuestProgress).not.toHaveBeenCalled();
  });

  test('missing terminal state awards nothing', () => {
    const effects = makeEffects();

    expect(applyDurableRideCompletionEffects(null, effects)).toBe(false);
    expect(effects.recordRideComplete).not.toHaveBeenCalled();
    expect(effects.syncRideQuestProgress).not.toHaveBeenCalled();
  });
});
