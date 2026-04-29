import React, { useEffect, useRef } from 'react';
import { StyleSheet, Alert, Dimensions } from 'react-native';
import * as Location from 'expo-location';
import { Map, Camera, UserLocation, Layer } from '@maplibre/maplibre-react-native';
import { Shield, Zap, Crosshair, Cpu, Heart } from 'lucide-react-native';
import { YStack, XStack, Text as TamaText, useTheme, ScrollView } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { MMKV } from 'react-native-mmkv';

import { POIService } from '../services/api';
import { GpsSyncManager } from '../services/GpsSyncManager';
import { HD2DButton } from '../components/HD2DButton';
import { PixelStats } from '../components/PixelStats';
import { RetroCard } from '../components/RetroCard';

const { width, height } = Dimensions.get('window');

let storage: any;
const getStorage = () => {
  if (storage) return storage;
  try {
    storage = new MMKV();
    return storage;
  } catch (e) {
    console.error("MMKV initialization failed. Falling back to mock.", e);
    storage = {
      getString: (key: string) => null,
      set: (key: string, value: any) => {},
      delete: (key: string) => {},
    };
    return storage;
  }
};

const ShieldIcon = Shield as any;
const ZapIcon = Zap as any;
const CpuIcon = Cpu as any;
const HeartIcon = Heart as any;

const HudMetric = observer(({ label, value, unit, color = "$accent" }: { label: string, value: any, unit: string, color?: any }) => {
  // Handle observable, function getter, or static value
  let displayValue;
  if (typeof value === 'function') {
    displayValue = value();
  } else if (value && typeof value.get === 'function') {
    displayValue = value.get();
  } else {
    displayValue = value;
  }
  
  return (
    <YStack gap="$1">
      <TamaText fontFamily="$pixel" fontSize={8} color="$color" opacity={0.7} letterSpacing={1}>{label.toUpperCase()}</TamaText>
      <XStack alignItems="baseline" gap="$1">
        <TamaText 
          fontSize={24} 
          fontWeight="900" 
          color={color} 
          fontFamily="$pixel"
        >
          {displayValue}
        </TamaText>
        <TamaText fontSize={10} fontWeight="800" color="$color" opacity={0.6}>{unit}</TamaText>
      </XStack>
    </YStack>
  );
});

export const TrackingScreen = observer(({ user }: { user: any }) => {
  const theme = useTheme();
  const state = useObservable({
    isTracking: false,
    currentLocation: { latitude: 52.17, longitude: 22.29 } as any,
    pois: [] as any[],
    stats: {
      distanceM: 0,
      paceSecPerKm: 0,
      elevationGainM: 0,
      speedMs: 0,
      batteryPct: 1.0,
      pendingPoints: 0,
      heartRate: 75
    },
    speedHistory: [0, 0, 0, 0, 0, 0, 0] as number[],
    hrHistory: [72, 75, 74, 78, 80, 79, 75] as number[]
  });

  const syncManager = useRef<GpsSyncManager | null>(null);

  useEffect(() => {
    const store = getStorage();
    let deviceId = store.getString('device_id');
    if (!deviceId) {
      deviceId = `DEV-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      store.set('device_id', deviceId);
    }
    syncManager.current = new GpsSyncManager(deviceId, user?.id || null);

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let location = await Location.getCurrentPositionAsync({});
      state.currentLocation.set(location.coords);
      try {
        const poiData = await POIService.getPOIs();
        state.pois.set(poiData);
      } catch (e) {}
    })();

    if (syncManager.current) {
      syncManager.current.setUpdateCallback((newStats) => {
        state.stats.set({ ...newStats, heartRate: 70 + Math.floor(Math.random() * 20) });
        
        // Update history for PixelStats
        const currentSpeed = newStats.speedMs * 3.6;
        const newSpeedHistory = [...state.speedHistory.get().slice(1), currentSpeed];
        state.speedHistory.set(newSpeedHistory);
        
        const currentHR = state.stats.heartRate.get();
        const newHRHistory = [...state.hrHistory.get().slice(1), currentHR];
        state.hrHistory.set(newHRHistory);
      });
    }
  }, [user]);

  const toggleTracking = async () => {
    if (!syncManager.current) return;
    if (state.isTracking.get()) {
      await syncManager.current.stopTracking();
      state.isTracking.set(false);
      Alert.alert("Session Complete", "Telemetry uploaded to SPORT CORE.");
    } else {
      let { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== 'granted') return;
      await syncManager.current.startTracking(Math.floor(Date.now() / 1000));
      state.isTracking.set(true);
    }
  };

  const formatPace = (secPerKm: number) => {
    if (secPerKm === 0) return "--:--";
    const mins = Math.floor(secPerKm / 60);
    const secs = Math.floor(secPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Pre-calculate pace observable to avoid re-renders of the whole screen
  // Actually, let's just pass the values.

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* MAP CONTAINER with RetroCard Style */}
      <RetroCard 
        margin="$4" 
        marginTop="$12" 
        height={height * 0.4} 
        padding={0} 
        overflow="hidden"
        borderColor="$hd2d.outlineColor"
      >
        <Map 
          style={styles.map}
          mapStyle={theme.name === 'solar' ? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" : "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"}
          logo={false}
          attribution={false}
        >
          <Camera
            zoom={15}
            center={[state.currentLocation.longitude.get(), state.currentLocation.latitude.get()]}
            trackUserLocation={state.isTracking.get() ? "default" : undefined}
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
        </Map>
      </RetroCard>

      {/* SYSTEM HUD OVERLAY */}
      <XStack 
        position="absolute" 
        top={50} 
        left={0} 
        right={0} 
        justifyContent="space-between" 
        paddingHorizontal="$6"
      >
        <YStack backgroundColor="$background" padding="$2" borderWidth={1} borderColor="$hd2d.outlineColor">
           <TamaText fontSize={8} color="$accent" fontFamily="$pixel">DEVICE_ID: {syncManager.current?.['_deviceId'] || 'N/A'}</TamaText>
           <TamaText fontSize={8} color="$accent" fontFamily="$pixel">SYS_STATUS: {state.isTracking.get() ? 'STREAMING' : 'IDLE'}</TamaText>
        </YStack>
        <XStack gap="$2" alignItems="center" backgroundColor="$background" padding="$2" borderWidth={1} borderColor="$hd2d.outlineColor">
           <CpuIcon size={12} color={theme.accent.get()} />
           <TamaText fontSize={8} color="$accent" fontFamily="$pixel">BATT: {Math.round(state.stats.batteryPct.get() * 100)}%</TamaText>
        </XStack>
      </XStack>

      {/* METRICS HUD */}
      <ScrollView flex={1} paddingHorizontal="$4">
        <YStack gap="$4" paddingBottom="$10">
          <XStack justifyContent="space-between">
            <RetroCard flex={1} marginRight="$2" padding="$3">
              <HudMetric 
                label="Speed" 
                value={() => (state.stats.speedMs.get() * 3.6).toFixed(1)} 
                unit="KM/H" 
                color="$primary" 
              />
              <PixelStats data={state.speedHistory} width={width * 0.35} height={60} label="SPD_TRK" />
            </RetroCard>
            
            <RetroCard flex={1} marginLeft="$2" padding="$3">
              <XStack gap="$2" alignItems="center">
                <HeartIcon size={12} color={theme.error.get()} />
                <HudMetric 
                  label="Heart" 
                  value={state.stats.heartRate} 
                  unit="BPM" 
                  color="$error" 
                />
              </XStack>
              <PixelStats data={state.hrHistory} width={width * 0.35} height={60} label="HR_LIVE" />
            </RetroCard>
          </XStack>

          <RetroCard padding="$4">
            <XStack justifyContent="space-between">
              <HudMetric 
                label="Distance" 
                value={() => ((state.stats.distanceM.get() || 0) / 1000).toFixed(2)} 
                unit="KM" 
                color="$secondary" 
              />
              <HudMetric 
                label="Pace" 
                value={() => formatPace(state.stats.paceSecPerKm.get() || 0)} 
                unit="/KM" 
                color="$accent" 
              />
            </XStack>
          </RetroCard>

          <XStack gap="$3" justifyContent="center" alignItems="center" paddingVertical="$2">
            <ZapIcon size={20} color={theme.primary.get()} />
            <TamaText fontFamily="$pixel" fontSize={10} color="$color">PERFORMANCE STABLE</TamaText>
            <ShieldIcon size={20} color={theme.success.get()} />
          </XStack>

          <HD2DButton 
            onPress={toggleTracking}
            theme={state.isTracking.get() ? 'red' : 'green'}
            label={state.isTracking.get() ? "ABORT & SYNC" : "INITIALIZE MISSION"}
            height={60}
          />
        </YStack>
      </ScrollView>

      {/* FOOTER v3.0 */}
      <TamaText textAlign="center" fontSize={8} color="$color" opacity={0.4} paddingVertical="$2" fontFamily="$pixel">
        SOLAR_READY HUD v3.0 // HD-2D ENGINE
      </TamaText>
    </YStack>
  );
});

      {/* FOOTER v3.0 */}
      <TamaText textAlign="center" fontSize={8} color="$color" opacity={0.4} paddingVertical="$2" fontFamily="$pixel">
        SOLAR_READY HUD v3.0 // HD-2D ENGINE
      </TamaText>
    </YStack>
  );
});

const styles = StyleSheet.create({
  map: { width: '100%', height: '100%' }
});
