import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, Alert } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import MapView, { Polyline } from 'react-native-maps';

const LOCATION_TASK_NAME = 'background-location-task';

// Placeholder for Redux/Zustand store or SQLite insertion
let routeCoordinates: any[] = [];

TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }: any) => {
  if (error) {
    console.error("Background Location Error:", error);
    return;
  }
  if (data) {
    const { locations } = data;
    // Append to local memory/SQLite
    const newCoords = locations.map((loc: any) => ({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    }));
    routeCoordinates.push(...newCoords);
    console.log("Recorded points in background:", locations.length);
    // TODO: Send batch to backend (/api/activities/telemetry/live)
  }
});

export default function App() {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<any>(null);

  useEffect(() => {
    (async () => {
      let { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        Alert.alert('Permission to access location was denied');
        return;
      }
      
      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location.coords);
    })();
  }, []);

  const toggleTracking = async () => {
    if (isTracking) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      setIsTracking(false);
      Alert.alert("Tracking Stopped", "Your session has been saved.");
    } else {
      let { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        Alert.alert('Background location permission denied');
        return;
      }
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Highest,
        distanceInterval: 5, // Receive updates every 5 meters
        deferredUpdatesInterval: 2000,
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
          latitude: currentLocation?.latitude || 52.17, // Siedlce fallback
          longitude: currentLocation?.longitude || 22.29,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={true}
        followsUserLocation={isTracking}
      >
        <Polyline 
          coordinates={routeCoordinates} 
          strokeColor="#2563EB" 
          strokeWidth={4} 
        />
      </MapView>

      <View style={styles.hud}>
        <Text style={styles.hudText}>
          Status: {isTracking ? "RECORDING" : "IDLE"}
        </Text>
        <Button 
          title={isTracking ? "STOP & SAVE" : "START ACTIVITY"} 
          color={isTracking ? "#DC2626" : "#10B981"}
          onPress={toggleTracking} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  hud: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 20,
    borderRadius: 12,
  },
  hudText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center'
  }
});
