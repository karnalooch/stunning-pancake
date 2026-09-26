import {
  isDurableRideSuccess,
  type RideFinishState,
} from '../model/RideFinishState';

export type RideCompletionEffects = {
  recordRideComplete: (distanceKm: number, durationMinutes: number) => unknown;
  syncRideQuestProgress: (distanceKm: number, durationMinutes: number) => unknown;
};

export function applyDurableRideCompletionEffects(
  finishState: RideFinishState | null,
  effects: RideCompletionEffects,
): boolean {
  if (!isDurableRideSuccess(finishState)) return false;

  const { distanceKm, elapsedS } = finishState.summary;
  const durationMinutes = elapsedS / 60;

  effects.recordRideComplete(distanceKm, durationMinutes);
  effects.syncRideQuestProgress(distanceKm, durationMinutes);
  return true;
}
