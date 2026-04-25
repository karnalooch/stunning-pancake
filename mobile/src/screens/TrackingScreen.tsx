import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, Alert, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Polyline, Marker, Callout } from 'react-native-maps';
import { Shield, Zap, Sun, Coffee, ShoppingBag, Bike } from 'lucide-react-native';
import { POIService } from '../services/api';
import * as Notifications from 'expo-notifications';

const GEOFENCE_TASK_NAME = 'poi-geofence-task';
const LOCATION_TASK_NAME = 'background-location-task';

let routeCoordinates: any[] = [];

export const TrackingScreen = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [pois, setPois] = useState<any[]>([]);


  const theme = {
    bg: isHighContrast ? '#000000' : 'rgba(10,10,10,0.85)',
    accent: isHighContrast ? '#00FF00' : '#2563EB',
    text: isHighContrast ? '#FFFFFF' : 'white',
    border: isHighContrast ? '#FFFFFF' : 'transparent',
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location.coords);

      try {
        const poiData = await POIService.getPOIs();
        setPois(poiData);
        
        // Register Geofences for POIs
        const regions = poiData.map((poi: any) => ({
          identifier: poi.name,
          latitude: poi.latitude,
          longitude: poi.longitude,
          radius: 100, // 100m geofence
          notifyOnEnter: true,
        }));
        
        if (regions.length > 0) {
          await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
        }
      } catch (e) {
        console.error("POI/Geofence setup failed", e);
      }
    })();
  }, []);



  const toggleTracking = async () => {
    if (isTracking) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      setIsTracking(false);
      Alert.alert("Activity Saved", "Telemetry pushed to city nodes.");
    } else {
      let { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Background location permission denied');
        return;
      }
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Highest,
        distanceInterval: 5,
        foregroundService: {
          notificationTitle: "SPORT",
          notificationBody: "Tracking your activity...",
        },
      });
      setIsTracking(true);
    }
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
        <Polyline coordinates={routeCoordinates} strokeColor={theme.accent} strokeWidth={isHighContrast ? 8 : 5} />
        
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


      <View style={[styles.hud, { backgroundColor: theme.bg, borderColor: theme.border, borderWidth: isHighContrast ? 2 : 0 }]}>
        <View style={styles.header}>
           <Text style={[styles.status, { color: theme.text }]}>
             {isTracking ? "RECORDING" : "READY TO START"}
           </Text>
           <TouchableOpacity onPress={() => setIsHighContrast(!isHighContrast)}>
             <Sun size={24} color={theme.accent} />
           </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View>
            <Text style={styles.statLabel}>DISTANCE</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>5.24 km</Text>
          </View>
          <View>
            <Text style={styles.statLabel}>TIME</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>24:12</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.mainButton, { backgroundColor: isTracking ? "#DC2626" : "#2563EB" }]}
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
    padding: 24, borderRadius: 20,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  status: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', gap: 40, marginBottom: 24 },
  statLabel: { color: '#666', fontSize: 10, fontWeight: '700', marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: '900' },
  mainButton: { padding: 18, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  poiMarker: { 
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#2563EB', 
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
