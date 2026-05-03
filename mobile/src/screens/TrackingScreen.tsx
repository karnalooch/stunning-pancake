import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StyleSheet, Alert, Dimensions } from 'react-native';
import * as Location from 'expo-location';
import { Map, Camera, UserLocation } from '@maplibre/maplibre-react-native';
import { YStack, Text as TamaText, useTheme } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { MMKV } from 'react-native-mmkv';

import { GpsSyncManager } from '../services/GpsSyncManager';
import { triggerEngine } from '../services/TriggerEngine';
import { avatarTrainer } from '../services/AvatarTrainerService';
import { GameCard } from '../components/arcade/GameCard';
import { PixelText } from '../components/arcade/PixelText';
import { ArcadeButton } from '../components/arcade/ArcadeButton';
import { PopUpDialog } from '../components/PopUpDialog';
import { GameHUD } from '../components/GameHUD';

const { width, height } = Dimensions.get('window');

const ASSETS = {
  sprites: {
    runner: require('../../assets/generated/runner_sprite.png'),
    ghost: require('../../assets/generated/ghost_sprite.png'),
  },
};

let storage: any;
const getStorage = () => {
  if (storage) return storage;
  try { storage = new MMKV(); return storage; } catch (e) {
    storage = { getString: (k: string) => null, set: (k: string, v: any) => {}, delete: (k: string) => {} };
    return storage;
  }
};

export const TrackingScreen = observer(({ user }: { user: any }) => {
  const theme = useTheme();
  const [hudVisible, setHudVisible] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const state = useObservable({
    isTracking: false,
    currentLocation: { latitude: 52.17, longitude: 22.29 } as any,
    stats: { distanceM: 0, paceSecPerKm: 0, speedMs: 0, batteryPct: 1.0, heartRate: 75 },
  });

  const dialogState = triggerEngine.state.currentDialog;
  const syncManager = useRef<GpsSyncManager | null>(null);

  const resetHudTimer = useCallback(() => {
    setHudVisible(true);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    if (!state.isTracking.get()) return;
    hudTimerRef.current = setTimeout(() => setHudVisible(false), 3000);
  }, []);

  useEffect(() => {
    return () => {
      triggerEngine.destroy();
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
      if (syncManager.current) syncManager.current.stopTracking().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (syncManager.current) return;
    const store = getStorage();
    let deviceId = store.getString('device_id');
    if (!deviceId) {
      deviceId = `DEV-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      store.set('device_id', deviceId);
    }
    syncManager.current = new GpsSyncManager(deviceId, user?.id || null);
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const location = await Location.getCurrentPositionAsync({});
        state.currentLocation.set(location.coords);
      } catch (e) {}
    })();
    if (syncManager.current) {
      syncManager.current.setUpdateCallback((newStats) => {
        const heartRate = 70 + Math.floor(Math.random() * 20);
        state.stats.set({ ...newStats, heartRate });
        avatarTrainer.update({
          distanceM: newStats.distanceM, speedMs: newStats.speedMs,
          paceSecPerKm: newStats.paceSecPerKm, heartRate,
          batteryPct: newStats.batteryPct, elevationGainM: 0, gpsAccuracyM: 5, elapsedSec: 0,
        });
      });
    }
  }, []);

  const toggleTracking = async () => {
    if (!syncManager.current) return;
    if (state.isTracking.get()) {
      await syncManager.current.stopTracking();
      state.isTracking.set(false);
      avatarTrainer.endSession();
      setElapsedSec(0);
    } else {
      try {
        const { status } = await Location.requestBackgroundPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission required', 'Background GPS needed.'); return; }
        await syncManager.current.startTracking(Math.floor(Date.now() / 1000));
        state.isTracking.set(true);
        avatarTrainer.startSession();
        setElapsedSec(0);
        resetHudTimer();
      } catch (e: any) { Alert.alert('Error', e?.message || 'Failed.'); }
    }
  };

  const formatPace = (secPerKm: number) => {
    if (secPerKm === 0) return '--:--';
    const mins = Math.floor(secPerKm / 60);
    const secs = Math.floor(secPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isTracking = state.isTracking.get();
  const stats = state.stats.get();
  const distanceKm = (stats.distanceM || 0) / 1000;

  return (
    <YStack flex={1} backgroundColor="#000">
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={
          (theme.name as any) === 'solar'
            ? 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
            : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
        }
        logoEnabled={false}
        attributionEnabled={false}
      >
        <Camera
          zoom={15}
          center={[state.currentLocation.longitude.get(), state.currentLocation.latitude.get()]}
        />
        <UserLocation />
      </Map>

      {isTracking && (
        <GameHUD
          visible={hudVisible}
          onTap={resetHudTimer}
          distanceKm={distanceKm}
          paceFormatted={formatPace(stats.paceSecPerKm)}
          speedKmh={stats.speedMs * 3.6}
          heartRate={stats.heartRate}
          isTracking={isTracking}
          elapsedSec={elapsedSec}
        />
      )}

      <YStack
        position="absolute"
        bottom={20}
        left={20}
        right={20}
      >
        <ArcadeButton
          onPress={toggleTracking}
          variant={isTracking ? 'red' : 'green'}
          label={isTracking ? 'ABORT & SYNC' : 'START MISSION'}
          size="lg"
        />
      </YStack>

      <PopUpDialog
        visible={dialogState.visible.get()}
        message={dialogState.message.get()}
        title={dialogState.title.get()}
        sprite={dialogState.character.get() === 'ghost' ? ASSETS.sprites.ghost : ASSETS.sprites.runner}
      />
    </YStack>
  );
});