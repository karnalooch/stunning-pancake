import type {
  RideFinishState,
  RideSummaryPayload,
} from './RideController';

export type DeterministicRideState = {
  isRecording: boolean;
  ridePaused: boolean;
  liveSpeed: number;
  liveDistanceKm: number;
  liveElevationGainM: number;
  liveElapsedS: number;
  liveCoord: [number, number] | null;
  rideFinishState: RideFinishState | null;
};

export type DeterministicRideAction =
  | { type: 'start' }
  | { type: 'set-paused'; value: boolean }
  | { type: 'finish'; kind?: RideFinishState['kind'] }
  | { type: 'set-finish-state'; value: RideFinishState | null };

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
  rideFinishState: null,
};

function summaryFrom(state: DeterministicRideState): RideSummaryPayload | null {
  if (state.liveDistanceKm <= 0) return null;
  return {
    distanceKm: state.liveDistanceKm,
    elapsedS: state.liveElapsedS,
    elevationGainM: state.liveElevationGainM,
  };
}

function finishState(
  state: DeterministicRideState,
  kind: RideFinishState['kind'],
): RideFinishState | null {
  const summary = summaryFrom(state);
  if (!summary) return null;

  if (kind === 'durable-success') {
    return { kind, summary };
  }
  if (kind === 'pending-finalization') {
    return { kind, summary, pendingUpload: 1 };
  }
  return {
    kind: 'recovery-required',
    summary,
    reason: 'Deterministic recovery-required finish',
  };
}

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
        rideFinishState: null,
      };
    case 'set-paused':
      if (!state.isRecording) return state;
      return { ...state, ridePaused: action.value };
    case 'finish':
      return {
        ...initialDeterministicRideState,
        rideFinishState: finishState(state, action.kind ?? 'durable-success'),
      };
    case 'set-finish-state':
      return { ...state, rideFinishState: action.value };
    default:
      return state;
  }
}
