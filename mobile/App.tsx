import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, Alert, TextInput, TouchableOpacity } from 'react-native';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [isHighContrast, setIsHighContrast] = useState(false);


  const theme = {
    bg: isHighContrast ? '#000000' : 'rgba(0,0,0,0.8)',
    accent: isHighContrast ? '#00FF00' : '#2563EB',
    text: isHighContrast ? '#FFFFFF' : 'white',
    border: isHighContrast ? '#FFFFFF' : 'transparent',
  };


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

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: '#0a0a0a', justifyContent: 'center', padding: 40 }]}>
        <Text style={{ color: 'white', fontSize: 32, fontWeight: '900', marginBottom: 40, textAlign: 'center' }}>
          SPORT<Text style={{ color: '#2563EB' }}>.</Text>
        </Text>
        
        <Text style={{ color: 'white', fontSize: 18, marginBottom: 20, fontWeight: '600' }}>
          {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
        </Text>

        <TextInput 
          placeholder="Email Address" 
          placeholderTextColor="#666"
          style={styles.input} 
        />
        <TextInput 
          placeholder="Password" 
          placeholderTextColor="#666"
          secureTextEntry 
          style={styles.input} 
        />
        
        {authMode === 'register' && (
           <TextInput 
             placeholder="Full Name" 
             placeholderTextColor="#666"
             style={styles.input} 
           />
        )}

        <TouchableOpacity 
          style={styles.authButton} 
          onPress={() => setIsAuthenticated(true)}
        >
          <Text style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>
            {authMode === 'login' ? 'SIGN IN' : 'REGISTER'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
          style={{ mt: 20 }}
        >
          <Text style={{ color: '#2563EB', textAlign: 'center', marginTop: 20 }}>
            {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Login"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

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
          strokeColor={theme.accent} 
          strokeWidth={isHighContrast ? 8 : 4} 
        />
      </MapView>

      <View style={[styles.hud, { backgroundColor: theme.bg, borderColor: theme.border, borderWidth: isHighContrast ? 2 : 0 }]}>
        <Group horizontal style={{ justifyContent: 'space-between', width: '100%' }}>
           <Text style={[styles.hudText, { color: theme.text }]}>
             {isTracking ? "RECORDING" : "IDLE"}
           </Text>
           <Button 
             title={isHighContrast ? "STANDARD" : "OUTDOOR"} 
             color="#555" 
             onPress={() => setIsHighContrast(!isHighContrast)} 
           />
        </Group>
        <Button 
          title={isTracking ? "STOP & SAVE" : "START ACTIVITY"} 
          color={isTracking ? "#DC2626" : "#10B981"}
          onPress={toggleTracking} 
        />
      </View>
    </View>
  );
}

const Group = ({ children, horizontal, style }: any) => (
  <View style={[{ flexDirection: horizontal ? 'row' : 'column' }, style]}>{children}</View>
);

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
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 15,
    color: 'white',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333'
  },
  authButton: {
    backgroundColor: '#2563EB',
    padding: 18,
    borderRadius: 8,
    marginTop: 10
  }
});
