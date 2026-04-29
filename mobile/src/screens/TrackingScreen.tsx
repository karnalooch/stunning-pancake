import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Alert, Linking, Image } from 'react-native';
import * as Location from 'expo-location';
import { Map, Camera, UserLocation, Layer, ViewAnnotation, Callout } from '@maplibre/maplibre-react-native';
import { Shield, Zap, Coffee, ShoppingBag, Bike } from 'lucide-react-native';
import { YStack, XStack, Text as TamaText, Button as TamaButton, H1, Paragraph, View as TamaView } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { MMKV } from 'react-native-mmkv';

import { POIService } from '../services/api';
import { GpsSyncManager } from '../services/GpsSyncManager';
import { BrandingService } from '../services/BrandingService';
import { Theme } from '../theme/Theme';
import { SkiaMetrics } from '../components/SkiaMetrics';

let storage: any;
const getStorage = () => {
  if (storage) return storage;
  try {
    storage = new MMKV();
    return storage;
  } catch (e) {
    console.error("MMKV initialization failed in TrackingScreen. Falling back to mock.", e);
    storage = {
      getString: (key: string) => null,
      set: (key: string, value: any) => {},
      delete: (key: string) => {},
    };
    return storage;
  }
};

// Initialize MapLibre (No token needed)
// MapLibreGL.setAccessToken(null);

const GEOFENCE_TASK_NAME = 'poi-geofence-task';

const ShieldIcon = Shield as any;
const ZapIcon = Zap as any;
const CoffeeIcon = Coffee as any;
const ShoppingBagIcon = ShoppingBag as any;
const BikeIcon = Bike as any;

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
    // Generate or retrieve persistent Device ID
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
        
        const regions = poiData.map((poi: any) => ({
          identifier: poi.name,
          latitude: poi.latitude,
          longitude: poi.longitude,
          radius: 100,
          notifyOnEnter: true,
        }));
        
        if (regions.length > 0) {
          await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
        }
      } catch (e) {
        console.error("POI/Geofence setup failed", e);
      }
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
      Alert.alert("Ride Complete", "Your track has been synced with Grupetto HQ.");
    } else {
      let { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Background Permission Required',
          'To track your ride in the background, please set Location permission to "Allow all the time" in system settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }
      // Start tracking with a new session ID
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
      {(!Map) ? (
        <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
          <TamaText color="$gray10" fontSize={12} letterSpacing={2} fontWeight="900">HYPERSCALE MAP ENGINE OFFLINE</TamaText>
        </YStack>
      ) : (
        <Map 
          style={styles.map}
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          logo={false}
          attribution={false}
        >
          <Camera
            zoom={14}
            center={[currentLocation?.longitude || 22.29, currentLocation?.latitude || 52.17]}
            trackUserLocation={isTracking ? "default" : undefined}
          />
          <UserLocation 
            animated={true}
          >
            <Layer
              id="user-location-circle"
              type="circle"
              style={{
                circleRadius: 8,
                circleColor: '#00D1FF',
                circleStrokeWidth: 3,
                circleStrokeColor: 'rgba(0, 209, 255, 0.3)',
              }}
            />
          </UserLocation>

          {pois.map((poi: any) => (
            <ViewAnnotation 
              key={poi.id}
              id={poi.id.toString()}
              lngLat={[poi.longitude, poi.latitude]}
            >
               <TamaView 
                 width={36} 
                 height={36} 
                 borderRadius={18} 
                 backgroundColor={Theme.colors.primary} 
                 borderWidth={3} 
                 borderColor="white" 
                 alignItems="center" 
                 justifyContent="center"
               >
                 {poi.category === 'COFFEE' ? <CoffeeIcon size={16} color="white" /> : 
                  poi.category === 'SHOP' ? <ShoppingBagIcon size={16} color="white" /> :
                  <BikeIcon size={16} color="white" />}
               </TamaView>
               <Callout title={poi.name} />
            </ViewAnnotation>
          ))}
        </Map>
      )}

      {/* Grupetto Badge Overlay */}
      <XStack 
        position="absolute" 
        top={60} 
        left={20} 
        paddingVertical="$2" 
        paddingHorizontal="$4" 
        borderRadius="$0" 
        backgroundColor="rgba(5, 5, 5, 0.6)" 
        borderWidth={2} 
        borderColor="$primary"
        alignItems="center"
        gap="$2"
      >
        {branding?.logo_url ? (
          <Image source={{ uri: branding.logo_url }} style={{ width: 16, height: 16 }} resizeMode="contain" />
        ) : (
          <BikeIcon size={14} color={Theme.colors.primary} />
        )}
        <TamaText fontSize={12} fontWeight="900" color="$primary" letterSpacing={2}>
          {branding?.name?.toUpperCase() || 'GRUPETTO SIEDLCE'}
        </TamaText>
      </XStack>

      <YStack 
        position="absolute" 
        bottom={30} 
        left={20} 
        right={20} 
        padding="$6" 
        borderRadius="$0" 
        backgroundColor="$background" 
        borderWidth={2} 
        borderColor="$primary"
        gap="$4"
      >
        <XStack justifyContent="space-between" alignItems="center">
           <TamaText fontSize={11} fontWeight="900" letterSpacing={2} color="$primary">
             {isTracking ? "CYAN-PRECISION ACTIVE" : `READY, ${user?.username?.toUpperCase() || 'RIDER'}`}
           </TamaText>
           <XStack gap="$2">
              <ZapIcon size={18} color={Theme.colors.primary} />
              <ShieldIcon size={18} color={Theme.colors.primary} />
           </XStack>
        </XStack>

        <SkiaMetrics 
          distanceKm={((stats?.distanceM || 0) / 1000).toFixed(2)} 
          pace={formatPace(stats?.paceSecPerKm || 0)} 
          buffer={stats?.pendingPoints || 0} 
        />

        <TamaButton 
          size="$6"
          borderRadius="$0"
          backgroundColor={isTracking ? "$red10" : "$primary"}
          onPress={toggleTracking} 
          pressStyle={{ opacity: 0.9, scale: 0.98 }}
        >
          <TamaText fontWeight="900" fontSize={16} letterSpacing={2} color={isTracking ? "white" : "black"}>
            {isTracking ? "STOP & FINISH" : "START SESSION"}
          </TamaText>
        </TamaButton>
      </YStack>
    </View>
  );
});


const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' }
});
