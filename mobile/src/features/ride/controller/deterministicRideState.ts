import type { RideSummaryPayload } from './RideController';

export type DeterministicRideState = {
  isRecording: boolean;
  ridePaused: boolean;
  liveSpeed: number;
  liveDistanceKm: number;
  liveElevationGainM: number;
  liveElapsedS: number;
  liveCoord: [number, number] | null;
  rideSummary: RideSummaryPayload | null;
};

export type DeterministicRideAction =
  | { type: 'start' }
  | { type: 'set-paused'; value: boolean }
  | { type: 'finish' }
  | { type: 'set-summary'; value: RideSummaryPayload | null };

export const DETERMINISTIC_RIDE_METRICS = {
  liveSpeed: 8.33,
  liveDistanceKm: 12.4,
  liveElevationGainM: 145,
  liveElapsedS: 2730,
  liveCoord: [21.9883, 52.1676] as [number, number],
} as const;

export const initialDeterministicRideState: DeterministicRideState = {
  isRecording: false,
  ridePaused: false,
  liveSpeed: 0,
  liveDistanceKm: 0,
  liveElevationGainM: 0,
  liveElapsedS: 0,
  liveCoord: null,
  rideSummary: null,
};

export function deterministicRideReducer(
  state: DeterministicRideState,
  action: DeterministicRideAction,
): DeterministicRideState {
  switch (action.type) {
    case 'start':
      return {
        ...state,
        ...DETERMINISTIC_RIDE_METRICS,
        isRecording: true,
        ridePaused: false,
        rideSummary: null,
      };
    case 'set-paused':
      if (!state.isRecording) return state;
      return { ...state, ridePaused: action.value };
    case 'finish': {
      const summary =
        state.liveDistanceKm > 0
          ? {
              distanceKm: state.liveDistanceKm,
              elapsedS: state.liveElapsedS,
              elevationGainM: state.liveElevationGainM,
            }
          : null;
      return {
        ...initialDeterministicRideState,
        rideSummary: summary,
      };
    }
    case 'set-summary':
      return { ...state, rideSummary: action.value };
    default:
      return state;
  }
}
