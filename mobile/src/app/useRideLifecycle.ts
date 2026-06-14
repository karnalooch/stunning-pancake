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



export type RideSummaryPayload = {

  distanceKm: number;

  elapsedS: number;

  elevationGainM: number;

};



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

  const [rideSummary, setRideSummary] = useState<RideSummaryPayload | null>(null);



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

    recoverGpsDataOnLaunch()

      .then(async (result) => {

        if (result.needsResumeUi || isTrackingRecoveryPending()) {

          setGpsRecoveryVisible(true);

        }

        const resumed = await resumeActiveRideIfNeeded(null);

        if (resumed) setIsRecording(true);

      })

      .catch((e) => console.warn('[GPS] launch recovery failed', e));

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

    try {

      const { finalized, pendingUpload } = await stopRideSession(userId);

      if (pendingUpload > 0) {

        pushEdge({

          title: t.rideMessages.stopPending,

          message: t.rideMessages.stopPendingBody,

          variant: 'offline',

        });

      } else if (finalized) {

        pushEdge({

          title: t.rideMessages.stopSaved,

          message: t.rideMessages.stopSavedBody,

          variant: 'success',

        });

      } else {

        pushEdge({

          title: t.rideMessages.stopDone,

          message: t.rideMessages.stopDoneBody,

          variant: 'success',

        });

      }

    } catch (e) {

      console.warn('[GPS] stop ride failed', e);

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

      if (distanceKm > 0) {

        recordRideComplete(distanceKm, elapsedS / 60);

        syncRideQuestProgress(distanceKm, elapsedS / 60);

        setRideSummary({ distanceKm, elapsedS, elevationGainM });

        return { navigated: false };

      }

      return { navigated: true, target: 'Ride' as const };

    }

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

    rideSummary,

    setRideSummary,

    onUserSessionReady,

    handleGpsRecoveryPress,

    handleStartRide,

    handleStopRide,

    clearEdgeMessage: () => pushEdge(null),

  };

}

