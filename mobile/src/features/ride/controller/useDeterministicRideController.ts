import { useCallback, useReducer } from 'react';

import type { ActivitySportType } from '../../../types/activitySport';
import type { RideController, RideControllerOptions, RideFinishState } from './RideController';
import {
  deterministicRideReducer,
  initialDeterministicRideState,
} from './deterministicRideState';

export function useDeterministicRideController(
  options: RideControllerOptions = {},
): RideController {
  const [state, dispatch] = useReducer(
    deterministicRideReducer,
    initialDeterministicRideState,
  );

  const setRidePaused = useCallback((value: boolean) => {
    dispatch({ type: 'set-paused', value });
  }, []);

  const setRideFinishState = useCallback((value: RideFinishState | null) => {
    dispatch({ type: 'set-finish-state', value });
  }, []);

  const onUserSessionReady = useCallback(async (_userId: number | null) => {
    // Deterministic mode deliberately owns no auth/GPS/storage side effects.
  }, []);

  const handleGpsRecoveryPress = useCallback(async () => {
    // Recovery does not exist in deterministic vision/smoke mode.
  }, []);

  const handleStartRide = useCallback(
    async (_activityType: ActivitySportType = 'BIKE', _eventId?: number) => {
      dispatch({ type: 'start' });
      options.onStartRideError?.(null);
      options.onStartRideSuccess?.();
      return true;
    },
    [options.onStartRideError, options.onStartRideSuccess],
  );

  const handleStopRide = useCallback(async () => {
    const hasSummary = state.liveDistanceKm > 0;
    dispatch({ type: 'finish', kind: options.deterministicFinishKind });
    return hasSummary
      ? { navigated: false }
      : { navigated: true, target: 'Ride' as const };
  }, [options.deterministicFinishKind, state.liveDistanceKm]);

  const clearEdgeMessage = useCallback(() => {
    options.onEdgeMessage?.(null);
  }, [options.onEdgeMessage]);

  return {
    ...state,
    gpsRecoveryVisible: false,
    gpsRecoveryBusy: false,
    setRidePaused,
    setRideFinishState,
    onUserSessionReady,
    handleGpsRecoveryPress,
    handleStartRide,
    handleStopRide,
    clearEdgeMessage,
  };
}
