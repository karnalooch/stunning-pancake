import { useCallback, useEffect, useRef, useState } from 'react';

import {

  getRideGpsManager,

  resumeActiveRideIfNeeded,

  startRideSession,

  stopRideSession,

} from '../services/rideSessionService';

import type { ActivitySportType } from '../services/api';

import {

  isTrackingRecoveryPending,

  recoverGpsDataOnLaunch,

  runManualGpsRecovery,

  startGpsBackgroundSync,

  type TrackingStats,

} from '../services/GpsSyncManager';

import { recordRideComplete } from '../game/progression';

import { syncRideQuestProgress } from '../game/quests';

import type { RideEdgeMessage } from '../services/apiRetry';

import { useI18n } from '../i18n/useI18n';
import {
  classifyRideFinishState,
  isDurableRideSuccess,
  type RideFinishState,
  type RideSummaryPayload,
} from '../features/ride/model/RideFinishState';
import { runE2eGpsRecoveryHarnessIfEnabled } from './e2eGpsRecoveryHarness';
import { e2eConfig } from './e2eConfig';



export type RideLifecycleOptions = {

  onStartRideError?: (message: string | null) => void;

  onStartRideSuccess?: () => void;

  onEdgeMessage?: (message: RideEdgeMessage | null) => void;

};



export function useRideLifecycle(options: RideLifecycleOptions = {}) {

  const { t } = useI18n();

  const userIdRef = useRef<number | null>(null);

  const [isRecording, setIsRecording] = useState(false);

  const [ridePaused, setRidePaused] = useState(false);

  const [liveSpeed, setLiveSpeed] = useState(0);

  const [liveDistanceKm, setLiveDistanceKm] = useState(0);

  const [liveElevationGainM, setLiveElevationGainM] = useState(0);

  const [liveElapsedS, setLiveElapsedS] = useState(0);

  const [liveCoord, setLiveCoord] = useState<[number, number] | null>(null);

  const [gpsRecoveryVisible, setGpsRecoveryVisible] = useState(false);

  const [gpsRecoveryBusy, setGpsRecoveryBusy] = useState(false);

  const [rideFinishState, setRideFinishState] = useState<RideFinishState | null>(null);



  const pushEdge = useCallback(

    (msg: RideEdgeMessage | null) => {

      options.onEdgeMessage?.(msg);

    },

    [options.onEdgeMessage],

  );



  const refreshGpsRecoveryFlag = useCallback(() => {

    setGpsRecoveryVisible(isTrackingRecoveryPending());

  }, []);



  const wireGpsStatsCallback = useCallback((uid: number | null) => {

    const manager = getRideGpsManager(uid);

    manager.setUpdateCallback((stats: TrackingStats) => {

      setLiveSpeed(stats.speedMs ?? 0);

      setLiveDistanceKm((stats.distanceM ?? 0) / 1000);

      setLiveElevationGainM(stats.elevationGainM ?? 0);

      setLiveElapsedS(stats.rideWallClockS ?? stats.gpsActiveTimeS ?? 0);

      setLiveCoord(stats.lastCoord ?? null);

      if (stats.pendingPoints > 0) {

        setGpsRecoveryVisible(true);

      }

    });

  }, []);



  const onUserSessionReady = useCallback(

    async (uid: number | null) => {

      userIdRef.current = uid;

      wireGpsStatsCallback(uid);

      if (await resumeActiveRideIfNeeded(uid)) {

        setIsRecording(true);

      }

    },

    [wireGpsStatsCallback],

  );



  useEffect(() => {

    // The destructive lost-key proof owns GPS storage exclusively. Running
    // normal launch recovery/background sync in parallel would invalidate the
    // physical acceptance test and could race key deletion.
    if (e2eConfig.gpsLostKeyDestructive) return;

    void (async () => {

      try {

        await runE2eGpsRecoveryHarnessIfEnabled();

      } catch (e) {

        console.warn('[E2E GPS RECOVERY] FAILED', e);

      }

      try {

        const result = await recoverGpsDataOnLaunch();

        if (result.needsResumeUi || isTrackingRecoveryPending()) {

          setGpsRecoveryVisible(true);

        }

        const resumed = await resumeActiveRideIfNeeded(null);

        if (resumed) setIsRecording(true);

      } catch (e) {

        console.warn('[GPS] launch recovery failed', e);

      }

    })();

    startGpsBackgroundSync();

  }, []);



  const handleGpsRecoveryPress = useCallback(async () => {

    setGpsRecoveryBusy(true);

    try {

      const ok = await runManualGpsRecovery();

      if (ok) {

        setGpsRecoveryVisible(false);

        pushEdge({

          title: t.rideMessages.gpsRecovered,

          message: t.rideMessages.gpsRecovered,

          variant: 'success',

        });

      } else {

        pushEdge({

          title: t.rideMessages.gpsRecoverFail,

          message: t.rideMessages.gpsRecoverFail,

          variant: 'warning',

        });

        refreshGpsRecoveryFlag();

      }

    } catch (e: unknown) {

      const msg = e instanceof Error ? e.message : t.rideMessages.gpsRecoverError;

      pushEdge({ title: t.rideMessages.gpsRecoverError, message: msg, variant: 'error' });

    } finally {

      setGpsRecoveryBusy(false);

    }

  }, [pushEdge, refreshGpsRecoveryFlag, t]);



  const handleStartRide = useCallback(

    async (activityType: ActivitySportType = 'BIKE', eventId?: number) => {

      const userId = userIdRef.current;

      try {

        wireGpsStatsCallback(userId);

        await startRideSession({

          type: activityType,

          event_id: eventId,

          userId,

        });

        setIsRecording(true);

        setRidePaused(false);

        refreshGpsRecoveryFlag();

        options.onStartRideSuccess?.();

        return true;

      } catch (e: unknown) {

        const msg = e instanceof Error ? e.message : t.errors.startRide;

        options.onStartRideError?.(msg);

        refreshGpsRecoveryFlag();

        return false;

      }

    },

    [refreshGpsRecoveryFlag, wireGpsStatsCallback, options, t],

  );



  const handleStopRide = useCallback(async () => {
    const userId = userIdRef.current;
    const distanceKm = liveDistanceKm;
    const elapsedS = liveElapsedS;
    const elevationGainM = liveElevationGainM;
    const summary: RideSummaryPayload | null =
      distanceKm > 0 ? { distanceKm, elapsedS, elevationGainM } : null;

    let stopResult: { finalized: boolean; pendingUpload: number } | null = null;
    let errorReason: string | undefined;

    try {
      stopResult = await stopRideSession(userId);

      if (stopResult.pendingUpload > 0 || !stopResult.finalized) {
        pushEdge({
          title: t.rideMessages.stopPending,
          message: t.rideMessages.stopPendingBody,
          variant: 'offline',
        });
      } else {
        pushEdge({
          title: t.rideMessages.stopSaved,
          message: t.rideMessages.stopSavedBody,
          variant: 'success',
        });
      }
    } catch (e) {
      console.warn('[GPS] stop ride failed', e);
      errorReason = e instanceof Error ? e.message : t.rideMessages.stopErrorBody;
      pushEdge({
        title: t.rideMessages.stopError,
        message: t.rideMessages.stopErrorBody,
        variant: 'error',
      });
    } finally {
      setIsRecording(false);
      setRidePaused(false);
      setLiveSpeed(0);
      setLiveDistanceKm(0);
      setLiveElevationGainM(0);
      setLiveElapsedS(0);
      setLiveCoord(null);
      refreshGpsRecoveryFlag();
    }

    const finishState = classifyRideFinishState(summary, stopResult, errorReason);

    if (isDurableRideSuccess(finishState)) {
      recordRideComplete(distanceKm, elapsedS / 60);
      syncRideQuestProgress(distanceKm, elapsedS / 60);
    }

    setRideFinishState(finishState);

    if (finishState) {
      return { navigated: false };
    }

    return { navigated: true, target: 'Ride' as const };
  }, [
    liveDistanceKm,
    liveElapsedS,
    liveElevationGainM,
    pushEdge,
    refreshGpsRecoveryFlag,
    t,
  ]);

  return {

    isRecording,

    ridePaused,

    setRidePaused,

    liveSpeed,

    liveDistanceKm,

    liveElevationGainM,

    liveElapsedS,

    liveCoord,

    gpsRecoveryVisible,

    gpsRecoveryBusy,
    rideFinishState,
    setRideFinishState,
onUserSessionReady,

    handleGpsRecoveryPress,

    handleStartRide,

    handleStopRide,

    clearEdgeMessage: () => pushEdge(null),

  };
}
