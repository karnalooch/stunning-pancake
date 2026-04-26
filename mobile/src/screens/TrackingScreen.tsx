import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, Callout } from 'react-native-maps';
import { Shield, Zap, Coffee, ShoppingBag, Bike } from 'lucide-react-native';
import { YStack, XStack, Text as TamaText, Button as TamaButton, H1, Paragraph, View as TamaView } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';

import { POIService } from '../services/api';
import { GpsSyncManager } from '../services/GpsSyncManager';
import { Theme } from '../theme/Theme';

const GEOFENCE_TASK_NAME = 'poi-geofence-task';

const ShieldIcon = Shield as any;
const ZapIcon = Zap as any;
const CoffeeIcon = Coffee as any;
const ShoppingBagIcon = ShoppingBag as any;
const BikeIcon = Bike as any;

export const TrackingScreen = observer(() => {
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

  const syncManager = useRef<GpsSyncManager>(new GpsSyncManager("DEVICE-GM-2026", 1));

  useEffect(() => {
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

    syncManager.current.setUpdateCallback((newStats) => {
      state.stats.set(newStats);
    });
  }, []);

  const toggleTracking = async () => {
    if (state.isTracking.get()) {
      await syncManager.current.stopTracking();
      state.isTracking.set(false);
      Alert.alert("Activity Saved", "Telemetry pushed to city nodes.");
    } else {
      let { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Background location permission denied');
        return;
      }
      await syncManager.current.startTracking(Math.floor(Math.random() * 1000));
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
      <MapView 
        style={styles.map}
        initialRegion={{
          latitude: state.currentLocation.latitude.get(),
          longitude: state.currentLocation.longitude.get(),
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation={true}
        followsUserLocation={state.isTracking.get()}
      >
        {state.pois.get().map((poi: any) => (
          <Marker 
            key={poi.id}
            coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
          >
             <TamaView 
               width={36} 
               height={36} 
               borderRadius={18} 
               backgroundColor="#00D1FF" 
               borderWidth={3} 
               borderColor="white" 
               alignItems="center" 
               justifyContent="center"
             >
               {poi.category === 'COFFEE' ? <CoffeeIcon size={16} color="white" /> : 
                poi.category === 'SHOP' ? <ShoppingBagIcon size={16} color="white" /> :
                <BikeIcon size={16} color="white" />}
             </TamaView>
             <Callout tooltip>
               <YStack backgroundColor="#111" padding="$3" borderRadius="$4" width={200} borderWidth={1} borderColor="#333">
                 <TamaText color="white" fontWeight="800" fontSize={14}>{poi.name}</TamaText>
                 <TamaText color="$gray10" fontSize={11} marginTop="$1">{poi.description || 'Sponsor Reward Point'}</TamaText>
               </YStack>
             </Callout>
          </Marker>
        ))}
      </MapView>

      <YStack 
        position="absolute" 
        bottom={30} 
        left={20} 
        right={20} 
        padding="$6" 
        borderRadius="$6" 
        backgroundColor="rgba(10,10,10,0.85)" 
        borderWidth={1} 
        borderColor="rgba(255,255,255,0.1)"
        gap="$4"
      >
        <XStack justifyContent="space-between" alignItems="center">
           <TamaText fontSize={11} fontWeight="900" letterSpacing={2} color="white">
             {state.isTracking.get() ? "CYAN-PRECISION TRACKING" : "READY TO START"}
           </TamaText>
           <XStack gap="$2">
              <ZapIcon size={18} color="#00D1FF" />
              <ShieldIcon size={18} color="#00D1FF" />
           </XStack>
        </XStack>

        <XStack justifyContent="space-between" alignItems="flex-end">
          <YStack>
            <TamaText color="$gray10" fontSize={10} fontWeight="700">DISTANCE</TamaText>
            <H1 fontWeight="900" color="white">{(state.stats.distanceM.get() / 1000).toFixed(2)}<TamaText fontSize={14} color="$gray10">km</TamaText></H1>
          </YStack>
          <YStack>
            <TamaText color="$gray10" fontSize={10} fontWeight="700">PACE</TamaText>
            <H1 fontWeight="900" color="white">{formatPace(state.stats.paceSecPerKm.get())}</H1>
          </YStack>
          <YStack alignItems="flex-end">
            <TamaText color="$gray10" fontSize={10} fontWeight="700">SYNC</TamaText>
            <TamaText fontSize={24} fontWeight="900" color="white">{state.stats.pendingPoints.get()} pts</TamaText>
          </YStack>
        </XStack>

        <TamaButton 
          size="$5"
          borderRadius="$4"
          backgroundColor={state.isTracking.get() ? "#DC2626" : "#00D1FF"}
          onPress={toggleTracking} 
        >
          <TamaText fontWeight="900" fontSize={14} letterSpacing={1.5} color="white">
            {state.isTracking.get() ? "STOP & SYNC" : "START SESSION"}
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
