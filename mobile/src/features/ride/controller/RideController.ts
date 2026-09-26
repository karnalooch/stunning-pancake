import type { ActivitySportType } from '../../../types/activitySport';
import type { RideFinishState } from '../model/RideFinishState';

export type { RideFinishState, RideSummaryPayload } from '../model/RideFinishState';

export type RideControllerNotice = {
  title: string;
  message: string;
  variant?: 'error' | 'warning' | 'offline' | 'success';
};

export type RideStopResult = {
  navigated: boolean;
  target?: 'Ride';
};

export type RideControllerOptions = {
  onStartRideError?: (message: string | null) => void;
  onStartRideSuccess?: () => void;
  onEdgeMessage?: (message: RideControllerNotice | null) => void;
  deterministicFinishKind?: RideFinishState['kind'];
};

export interface RideController {
  isRecording: boolean;
  ridePaused: boolean;
  setRidePaused: (value: boolean) => void;
  liveSpeed: number;
  liveDistanceKm: number;
  liveElevationGainM: number;
  liveElapsedS: number;
  liveCoord: [number, number] | null;
  gpsRecoveryVisible: boolean;
  gpsRecoveryBusy: boolean;
  rideFinishState: RideFinishState | null;
  setRideFinishState: (value: RideFinishState | null) => void;
  onUserSessionReady: (userId: number | null) => Promise<void>;
  handleGpsRecoveryPress: () => Promise<void>;
  handleStartRide: (activityType?: ActivitySportType, eventId?: number) => Promise<boolean>;
  handleStopRide: () => Promise<RideStopResult | void>;
  clearEdgeMessage: () => void;
}
