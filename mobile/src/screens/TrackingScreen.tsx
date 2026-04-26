import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Alert, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Polyline, Marker, Callout } from 'react-native-maps';
import { Shield, Zap, Sun, Coffee, ShoppingBag, Bike } from 'lucide-react-native';
import { POIService } from '../services/api';
import { GpsSyncManager, TrackingStats } from '../services/GpsSyncManager';
import { Theme } from '../theme/Theme';

const GEOFENCE_TASK_NAME = 'poi-geofence-task';

export const TrackingScreen = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [pois, setPois] = useState<any[]>([]);
  const [stats, setStats] = useState<TrackingStats>({
    distanceM: 0,
    paceSecPerKm: 0,
    elevationGainM: 0,
    speedMs: 0,
    batteryPct: 1.0,
    pendingPoints: 0
  });

  const syncManager = useRef<GpsSyncManager>(new GpsSyncManager("DEVICE-GM-2026", 1));

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location.coords);

      try {
        const poiData = await POIService.getPOIs();
        setPois(poiData);
        
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
      setStats(newStats);
    });
  }, []);

  const toggleTracking = async () => {
    if (isTracking) {
      await syncManager.current.stopTracking();
      setIsTracking(false);
      Alert.alert("Activity Saved", "Telemetry pushed to city nodes via GpsSyncManager.");
    } else {
      let { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Background location permission denied');
        return;
      }
      await syncManager.current.startTracking(Math.floor(Math.random() * 1000));
      setIsTracking(true);
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
          latitude: currentLocation?.latitude || 52.17,
          longitude: currentLocation?.longitude || 22.29,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation={true}
        followsUserLocation={isTracking}
      >
        {pois.map((poi) => (
          <Marker 
            key={poi.id}
            coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
          >
             <View style={styles.poiMarker}>
               {poi.category === 'COFFEE' ? <Coffee size={16} color="white" /> : 
                poi.category === 'SHOP' ? <ShoppingBag size={16} color="white" /> :
                <Bike size={16} color="white" />}
             </View>
             <Callout tooltip>
               <View style={styles.callout}>
                 <Text style={styles.calloutTitle}>{poi.name}</Text>
                 <Text style={styles.calloutDesc}>{poi.description || 'Sponsor Reward Point'}</Text>
               </View>
             </Callout>
          </Marker>
        ))}
      </MapView>

      <View style={styles.hud}>
        <View style={styles.header}>
           <Text style={styles.status}>
             {isTracking ? "CYAN-PRECISION TRACKING" : "READY TO START"}
           </Text>
           <View style={{ flexDirection: 'row', gap: 10 }}>
              <Zap size={18} color={Theme.colors.primary} />
              <Shield size={18} color={Theme.colors.primary} />
           </View>
        </View>

        <View style={styles.statsRow}>
          <View>
            <Text style={styles.statLabel}>DISTANCE</Text>
            <Text style={styles.statValue}>{(stats.distanceM / 1000).toFixed(2)} km</Text>
          </View>
          <View>
            <Text style={styles.statLabel}>PACE</Text>
            <Text style={styles.statValue}>{formatPace(stats.paceSecPerKm)}</Text>
          </View>
          <View>
            <Text style={styles.statLabel}>SYNC</Text>
            <Text style={[styles.statValue, { fontSize: 18 }]}>{stats.pendingPoints} pts</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.mainButton, { backgroundColor: isTracking ? "#DC2626" : Theme.colors.primary }]}
          onPress={toggleTracking} 
        >
          <Text style={styles.buttonText}>
            {isTracking ? "STOP & SYNC" : "START SESSION"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  hud: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    padding: 24, borderRadius: 24, backgroundColor: 'rgba(10,10,10,0.9)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  status: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: 'white' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  statLabel: { color: '#666', fontSize: 10, fontWeight: '700', marginBottom: 4 },
  statValue: { fontSize: 26, fontWeight: '900', color: 'white' },
  mainButton: { padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#00D1FF', shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
  buttonText: { color: 'white', fontWeight: '900', fontSize: 14, letterSpacing: 1.5 },
  poiMarker: { 
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#00D1FF', 
    borderWidth: 3, borderColor: 'white', alignItems: 'center', justifyContent: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5
  },
  callout: { 
    backgroundColor: '#111', padding: 12, borderRadius: 12, width: 200, 
    borderWidth: 1, borderColor: '#333' 
  },
  calloutTitle: { color: 'white', fontWeight: '800', fontSize: 14 },
  calloutDesc: { color: '#666', fontSize: 11, marginTop: 4 }
});
