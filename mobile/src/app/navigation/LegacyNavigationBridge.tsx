import React from 'react';

import {
  NavigationShell,
  type NavigationShellProps,
} from '../../bootstrap/NavigationShell';
import type {
  RideController,
  RideControllerNotice,
} from '../../features/ride/controller/RideController';

type LegacyNavigationBridgeProps = {
  user: NavigationShellProps['user'];
  ride: RideController;
  startRideError: string | null;
  clearStartRideError: () => void;
  rideEdgeMessage: RideControllerNotice | null;
  clearRideEdgeMessage: () => void;
  setRideEdgeMessage: (message: RideControllerNotice | null) => void;
  onLogout: () => void;
};

export function LegacyNavigationBridge({
  user,
  ride,
  startRideError,
  clearStartRideError,
  rideEdgeMessage,
  clearRideEdgeMessage,
  setRideEdgeMessage,
  onLogout,
}: LegacyNavigationBridgeProps) {
  return (
    <NavigationShell
      user={user}
      isRecording={ride.isRecording}
      ridePaused={ride.ridePaused}
      setRidePaused={ride.setRidePaused}
      liveSpeed={ride.liveSpeed}
      liveDistanceKm={ride.liveDistanceKm}
      liveElevationGainM={ride.liveElevationGainM}
      liveElapsedS={ride.liveElapsedS}
      liveCoord={ride.liveCoord}
      gpsRecoveryVisible={ride.gpsRecoveryVisible}
      gpsRecoveryBusy={ride.gpsRecoveryBusy}
      rideFinishState={ride.rideFinishState}
      setRideFinishState={ride.setRideFinishState}
      startRideError={startRideError}
      clearStartRideError={clearStartRideError}
      rideEdgeMessage={rideEdgeMessage}
      clearRideEdgeMessage={clearRideEdgeMessage}
      setRideEdgeMessage={setRideEdgeMessage}
      onGpsRecoveryPress={() => void ride.handleGpsRecoveryPress()}
      onStartRide={ride.handleStartRide}
      onStopRide={ride.handleStopRide}
      onLogout={onLogout}
    />
  );
}
