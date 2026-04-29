import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Alert, Linking, Image, Dimensions } from 'react-native';
import * as Location from 'expo-location';
import { Map, Camera, UserLocation, Layer, ViewAnnotation, Callout } from '@maplibre/maplibre-react-native';
import { Shield, Zap, Coffee, ShoppingBag, Bike, Crosshair, Cpu } from 'lucide-react-native';
import { YStack, XStack, Text as TamaText, Button as TamaButton, H1, Paragraph, View as TamaView } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { MMKV } from 'react-native-mmkv';
import { Svg, Rect, Path } from 'react-native-svg';

import { POIService } from '../services/api';
import { GpsSyncManager } from '../services/GpsSyncManager';
import { BrandingService } from '../services/BrandingService';
import { Theme } from '../theme/Theme';

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

const GEOFENCE_TASK_NAME = 'poi-geofence-task';

const ShieldIcon = Shield as any;
const ZapIcon = Zap as any;
const CoffeeIcon = Coffee as any;
const ShoppingBagIcon = ShoppingBag as any;
const BikeIcon = Bike as any;
const CrosshairIcon = Crosshair as any;
const CpuIcon = Cpu as any;

const HudMetric = ({ label, value, unit, color = "#00F0FF" }: any) => (
  <YStack gap="$1">
    <TamaText fontSize={10} fontWeight="900" color="$gray10" letterSpacing={1}>{label.toUpperCase()}</TamaText>
    <XStack alignItems="baseline" gap="$1">
      <TamaText 
        fontSize={28} 
        fontWeight="900" 
        color={color} 
        ff="monospace"
        style={{ textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 }}
      >
        {value}
      </TamaText>
      <TamaText fontSize={12} fontWeight="800" color="$gray10">{unit}</TamaText>
    </XStack>
  </YStack>
);

export const TrackingScreen = observer(({ user }: { user: any }) => {
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
      pendingPoints: 0
    }
  });

  const isTracking = state.isTracking.get();
  const currentLocation = state.currentLocation.get();
  const pois = state.pois.get() || [];
  const stats = state.stats.get();

  const syncManager = useRef<GpsSyncManager | null>(null);
  const branding = BrandingService.getCurrentBranding();

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
        state.stats.set(newStats);
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

  return (
    <View style={styles.container}>
      <Map 
        style={styles.map}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        logo={false}
        attribution={false}
      >
        <Camera
          zoom={15}
          center={[currentLocation?.longitude || 22.29, currentLocation?.latitude || 52.17]}
          trackUserLocation={isTracking ? "default" : undefined}
        />
        <UserLocation animated={true}>
          <Layer
            id="user-location-pixel"
            type="circle"
            style={{
              circleRadius: 10,
              circleColor: '#00F0FF',
              circleStrokeWidth: 2,
              circleStrokeColor: '#000000',
            }}
          />
        </UserLocation>
      </Map>

      {/* Cyberpunk HUD Grid Overlay (Subtle) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={width} height={height} opacity={0.1}>
          {Array.from({ length: 15 }).map((_, i) => (
            <Rect key={`h-${i}`} x="0" y={(height / 15) * i} width={width} height="0.5" fill="#00F0FF" />
          ))}
        </Svg>
      </View>

      {/* TOP HUD: System Status */}
      <XStack 
        position="absolute" 
        top={50} 
        left={0} 
        right={0} 
        justifyContent="space-between" 
        paddingHorizontal="$4"
      >
        <YStack backgroundColor="#050505" padding="$2" borderWidth={1} borderColor="$cyan">
           <TamaText fontSize={8} fontWeight="900" color="$cyan" ff="monospace">DEVICE_ID: {syncManager.current?.['_deviceId'] || 'N/A'}</TamaText>
           <TamaText fontSize={8} fontWeight="900" color="$cyan" ff="monospace">SYS_STATUS: {isTracking ? 'STREAMING' : 'IDLE'}</TamaText>
        </YStack>
        <XStack gap="$2" alignItems="center" backgroundColor="#050505" padding="$2" borderWidth={1} borderColor="$cyan">
           <CpuIcon size={12} color="#00F0FF" />
           <TamaText fontSize={8} fontWeight="900" color="$cyan" ff="monospace">BATT: {Math.round(stats.batteryPct * 100)}%</TamaText>
        </XStack>
      </XStack>

      {/* LEFT HUD: Crosshair Info */}
      <YStack position="absolute" top={height/2 - 50} left={20} gap="$2">
        <CrosshairIcon size={24} color="#00F0FF" />
        <View width={1} height={40} backgroundColor="#00F0FF" marginLeft={12} opacity={0.5} />
      </YStack>

      {/* MAIN HUD BOTTOM PANEL */}
      <YStack 
        position="absolute" 
        bottom={20} 
        left={20} 
        right={20} 
        backgroundColor="rgba(5, 5, 5, 0.9)" 
        borderWidth={2} 
        borderColor="$cyan"
        padding="$4"
        gap="$4"
      >
        {/* Decorative corner brackets */}
        <View position="absolute" top={-2} left={-2} width={10} height={10} borderTopWidth={3} borderLeftWidth={3} borderColor="$cyan" />
        <View position="absolute" top={-2} right={-2} width={10} height={10} borderTopWidth={3} borderRightWidth={3} borderColor="$cyan" />
        <View position="absolute" bottom={-2} left={-2} width={10} height={10} borderBottomWidth={3} borderLeftWidth={3} borderColor="$cyan" />
        <View position="absolute" bottom={-2} right={-2} width={10} height={10} borderBottomWidth={3} borderRightWidth={3} borderColor="$cyan" />

        <XStack justifyContent="space-between" alignItems="center">
          <H1 fontSize={14} fontWeight="900" color="white" letterSpacing={2}>
            {isTracking ? "ACTIVE MISSION" : "READY PILOT"}
          </H1>
          <XStack gap="$3">
            <ZapIcon size={18} color="#FFF200" />
            <ShieldIcon size={18} color="#00FF41" />
          </XStack>
        </XStack>

        <XStack justifyContent="space-between" paddingVertical="$2">
          <HudMetric label="Distance" value={((stats?.distanceM || 0) / 1000).toFixed(2)} unit="KM" />
          <HudMetric label="Pace" value={formatPace(stats?.paceSecPerKm || 0)} unit="/KM" color="#FFF200" />
          <HudMetric label="Speed" value={(stats?.speedMs * 3.6).toFixed(1)} unit="KMH" />
        </XStack>

        <TamaButton 
          size="$6"
          borderRadius={0}
          backgroundColor={isTracking ? "#FF0000" : "#00F0FF"}
          onPress={toggleTracking}
          pressStyle={{ opacity: 0.8, scale: 0.98 }}
          borderWidth={2}
          borderColor="#000"
        >
          <TamaText fontWeight="900" fontSize={18} letterSpacing={4} color="black">
            {isTracking ? "ABORT & SYNC" : "ENGAGE"}
          </TamaText>
        </TamaButton>

        <TamaText textAlign="center" fontSize={8} fontWeight="900" color="$gray8" letterSpacing={1}>
          ANTIGRAVITY DATASTREAM v2.4 // {new Date().toLocaleTimeString()}
        </TamaText>
      </YStack>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  map: { width: '100%', height: '100%' }
});
