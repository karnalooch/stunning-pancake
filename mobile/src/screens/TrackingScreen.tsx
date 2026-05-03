import React, { useEffect, useRef, useCallback, useState } from 'react';
import { StyleSheet, Alert, Dimensions, Pressable } from 'react-native';
import * as Location from 'expo-location';
import { Map, Camera, UserLocation, Layer, ShapeSource, CircleLayer } from '@maplibre/maplibre-react-native';
import { YStack, Text as TamaText, useTheme } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { MMKV } from 'react-native-mmkv';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { POIService, POI } from '../services/api';
import { GpsSyncManager } from '../services/GpsSyncManager';
import { triggerEngine } from '../services/TriggerEngine';
import { avatarTrainer } from '../services/AvatarTrainerService';
import { HD2DButton } from '../components/HD2DButton';
import { AthleteSprite } from '../components/AthleteSprite';
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
  try {
    storage = new MMKV();
    return storage;
  } catch (e) {
    storage = {
      getString: (key: string) => null,
      set: (key: string, value: any) => {},
      delete: (key: string) => {},
    };
    return storage;
  }
};

export const TrackingScreen = observer(({ user }: { user: any }) => {
  const theme = useTheme();
  const [hudVisible, setHudVisible] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const state = useObservable({
    isTracking: false,
    currentLocation: { latitude: 52.17, longitude: 22.29 } as any,
    pois: [] as POI[],
    stats: {
      distanceM: 0,
      paceSecPerKm: 0,
      speedMs: 0,
      batteryPct: 1.0,
      heartRate: 75,
    },
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
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      if (syncManager.current) {
        syncManager.current.stopTracking().catch(() => {});
      }
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
      } catch (e) {
        console.warn('[TrackingScreen] Location init failed:', e);
      }
      try {
        const poiData = await POIService.getPOIs();
        if (Array.isArray(poiData)) state.pois.set(poiData);
      } catch (e) {
        console.warn('[TrackingScreen] POI fetch failed:', e);
      }
    })();

    if (syncManager.current) {
      syncManager.current.setUpdateCallback((newStats) => {
        const heartRate = 70 + Math.floor(Math.random() * 20);
        state.stats.set({
          distanceM: newStats.distanceM,
          paceSecPerKm: newStats.paceSecPerKm,
          speedMs: newStats.speedMs,
          batteryPct: newStats.batteryPct,
          heartRate,
        });
        avatarTrainer.update({
          distanceM: newStats.distanceM,
          speedMs: newStats.speedMs,
          paceSecPerKm: newStats.paceSecPerKm,
          heartRate,
          batteryPct: newStats.batteryPct,
          elevationGainM: newStats.elevationGainM || 0,
          gpsAccuracyM: 5,
          elapsedSec: elapsedSec,
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
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
      setHudVisible(true);
    } else {
      try {
        const { status } = await Location.requestBackgroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Background location permission is required for tracking.');
          return;
        }
        await syncManager.current.startTracking(Math.floor(Date.now() / 1000));
        state.isTracking.set(true);
        avatarTrainer.startSession();
        setElapsedSec(0);
        elapsedIntervalRef.current = setInterval(() => {
          setElapsedSec((prev) => prev + 1);
        }, 1000);
        resetHudTimer();
      } catch (e: any) {
        Alert.alert('Tracking error', e?.message || 'Failed to start tracking.');
      }
    }
  };

  const formatPace = (secPerKm: number) => {
    if (secPerKm === 0) return '--:--';
    const mins = Math.floor(secPerKm / 60);
    const secs = Math.floor(secPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const poiFeatures = {
    type: 'FeatureCollection',
    features: state.pois.get().map((poi: POI) => ({
      type: 'Feature',
      properties: { id: poi.id, name: poi.name, category: poi.category },
      geometry: { type: 'Point', coordinates: [poi.longitude, poi.latitude] },
    })),
  };

  const isTracking = state.isTracking.get();
  const stats = state.stats.get();
  const distanceKm = (stats.distanceM || 0) / 1000;
  const mapVignetteOpacity = useSharedValue(0.8);

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Map — 90%+ of screen */}
      <YStack
        flex={1}
        borderWidth={2}
        borderColor="#000000"
        position="relative"
        overflow="hidden"
      >
        {/* Metal Slug inner gold border */}
        <YStack
          position="absolute"
          top={2}
          left={2}
          right={2}
          bottom={2}
          borderWidth={1}
          borderColor="#D4A373"
          zIndex={1}
          pointerEvents="none"
        />

        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={
            (theme.name as any) === 'solar'
              ? 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
              : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
          }
          logo={false}
          attribution={false}
        >
          <Camera
            zoom={15}
            center={[
              state.currentLocation.longitude.get(),
              state.currentLocation.latitude.get(),
            ]}
          />
          <UserLocation animated={true}>
            <Layer
              id="user-location-pixel"
              type="circle"
              style={{
                circleRadius: 8,
                circleColor: theme.accent.get(),
                circleStrokeWidth: 2,
                circleStrokeColor: '#000000',
              }}
            />
          </UserLocation>
          {state.pois.get().length > 0 && (
            <ShapeSource id="pois-source" shape={poiFeatures as any}>
              <CircleLayer
                id="pois-circle"
                style={{
                  circleRadius: 6,
                  circleColor: theme.primary.get(),
                  circleStrokeWidth: 2,
                  circleStrokeColor: '#000000',
                  circleOpacity: 0.9,
                }}
              />
            </ShapeSource>
          )}
        </Map>

        {/* Octopath Vignette Overlay */}
        <YStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          pointerEvents="none"
          zIndex={2}
          backgroundColor="transparent"
        >
          <YStack
            position="absolute"
            top={0}
            left={0}
            width={width}
            height={60}
            style={{
              background: 'linear-gradient(to bottom, rgba(45,36,24,0.9), rgba(45,36,24,0))',
            }}
          />
          <YStack
            position="absolute"
            bottom={0}
            left={0}
            width={width}
            height={60}
            style={{
              background: 'linear-gradient(to top, rgba(45,36,24,0.9), rgba(45,36,24,0))',
            }}
          />
          <YStack
            position="absolute"
            left={0}
            top={0}
            width={40}
            height={height}
            style={{
              background: 'linear-gradient(to right, rgba(45,36,24,0.5), rgba(45,36,24,0))',
            }}
          />
          <YStack
            position="absolute"
            right={0}
            top={0}
            width={40}
            height={height}
            style={{
              background: 'linear-gradient(to left, rgba(45,36,24,0.5), rgba(45,36,24,0))',
            }}
          />
        </YStack>

        {/* Idle: Athlete sprite + device info */}
        {!isTracking && (
          <YStack position="absolute" top={10} left={12} zIndex={3}>
            <YStack
              backgroundColor="rgba(0,0,0,0.7)"
              padding="$2"
              borderWidth={1}
              borderColor="#D4A373"
              alignItems="center"
            >
              <AthleteSprite type="runner" state="idle" size={40} />
              <TamaText fontFamily="$pixel" fontSize={6} color="#D4A373" marginTop="$1">
                PILOT_ACTIVE
              </TamaText>
            </YStack>
          </YStack>
        )}

        {/* Right corner: battery */}
        <YStack position="absolute" top={10} right={12} zIndex={3}>
          <YStack
            backgroundColor="rgba(0,0,0,0.7)"
            paddingHorizontal="$2"
            paddingVertical="$1"
            borderWidth={1}
            borderColor="#D4A373"
          >
            <TamaText fontFamily="$pixel" fontSize={7} color="#D4A373">
              BATT: {Math.round(stats.batteryPct * 100)}%
            </TamaText>
            <TamaText fontFamily="$pixel" fontSize={7} color="#7BA05B">
              SYS: {isTracking ? 'STREAMING' : 'IDLE'}
            </TamaText>
          </YStack>
        </YStack>
      </YStack>

      {/* Game HUD (auto-hide) */}
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

      {/* Start/Abort Mission Button */}
      <YStack paddingHorizontal="$4" paddingVertical="$3">
        <HD2DButton
          onPress={toggleTracking}
          theme={isTracking ? 'red' : 'green'}
          label={isTracking ? 'ABORT & SYNC' : 'START MISSION'}
          height={56}
        />
      </YStack>

      <TamaText
        textAlign="center"
        fontSize={8}
        color="$color"
        opacity={0.3}
        paddingBottom="$2"
        fontFamily="$pixel"
      >
        HD-2D GAMING ENGINE v5.0 · METAL SLUG EDITION
      </TamaText>

      <PopUpDialog
        visible={dialogState.visible.get()}
        message={dialogState.message.get()}
        title={dialogState.title.get()}
        sprite={
          dialogState.character.get() === 'ghost' ? ASSETS.sprites.ghost : ASSETS.sprites.runner
        }
      />
    </YStack>
  );
});
