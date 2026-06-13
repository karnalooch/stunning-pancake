import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
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

export function useRideLifecycle() {
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
  const [rideSummary, setRideSummary] = useState<{ distanceKm: number } | null>(null);

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
        Alert.alert('Gotowe', 'Niewysłane punkty GPS zostały wysłane.');
      } else {
        Alert.alert(
          'Nie udało się',
          'Część danych nadal czeka na wysłanie. Sprawdź połączenie i spróbuj ponownie.',
        );
        refreshGpsRecoveryFlag();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Błąd wysyłki GPS';
      Alert.alert('Błąd', msg);
    } finally {
      setGpsRecoveryBusy(false);
    }
  }, [refreshGpsRecoveryFlag]);

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
        return true;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Nie udało się rozpocząć jazdy';
        Alert.alert('Start jazdy', msg);
        refreshGpsRecoveryFlag();
        return false;
      }
    },
    [refreshGpsRecoveryFlag, wireGpsStatsCallback],
  );

  const handleStopRide = useCallback(async () => {
    const userId = userIdRef.current;
    const distanceKm = liveDistanceKm;
    try {
      const { finalized, pendingUpload } = await stopRideSession(userId);
      if (pendingUpload > 0) {
        Alert.alert(
          'Trasa zapisana lokalnie',
          `${pendingUpload} punktów GPS czeka na wysłanie. Dotknij baneru „Wyślij niewysłane punkty GPS”, gdy masz sieć.`,
        );
      } else if (finalized) {
        Alert.alert('Zapisano', 'Trasa została wysłana i sesja zakończona.');
      } else {
        Alert.alert('Zatrzymano', 'Nagrywanie GPS zakończone.');
      }
    } catch (e) {
      console.warn('[GPS] stop ride failed', e);
      Alert.alert('Błąd', 'Nie udało się poprawnie zakończyć jazdy. Sprawdź baner odzyskiwania GPS.');
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
        setRideSummary({ distanceKm });
        return { navigated: false };
      }
      return { navigated: true, target: 'Ride' as const };
    }
  }, [liveDistanceKm, refreshGpsRecoveryFlag]);

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
  };
}
