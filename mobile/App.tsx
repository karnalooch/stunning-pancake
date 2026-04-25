import React, { useState } from 'react';
import { StyleSheet, Text, View, Button, Alert, TextInput, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

import { Home, History, Gift, User, Trophy } from 'lucide-react-native';

// Screens
import { TrackingScreen } from './src/screens/TrackingScreen';
import { ActivitiesScreen } from './src/screens/ActivitiesScreen';
import { RewardsScreen } from './src/screens/RewardsScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

const GEOFENCE_TASK_NAME = 'poi-geofence-task';

TaskManager.defineTask(GEOFENCE_TASK_NAME, ({ data: { eventType, region }, error }: any) => {
  if (error) return;
  if (eventType === Location.GeofencingEventType.Enter) {
    Notifications.scheduleNotificationAsync({
      content: {
        title: "🎁 Reward Nearby!",
        body: `You just entered the ${region.identifier} zone. Stop by to claim your reward!`,
        data: { poi: region.identifier },
      },
      trigger: null,
    });
  }
});

const Tab = createBottomTabNavigator();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  if (!isAuthenticated) {
    return (
      <View style={styles.authContainer}>
        <Text style={styles.logo}>SPORT<Text style={{ color: '#2563EB' }}>.</Text></Text>
        <Text style={styles.authTitle}>{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</Text>
        <TextInput placeholder="Email" placeholderTextColor="#666" style={styles.input} />
        <TextInput placeholder="Password" placeholderTextColor="#666" secureTextEntry style={styles.input} />
        <TouchableOpacity style={styles.button} onPress={() => setIsAuthenticated(true)}>
          <Text style={styles.buttonText}>{authMode === 'login' ? 'SIGN IN' : 'REGISTER'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
          <Text style={styles.toggleText}>
            {authMode === 'login' ? "New here? Join the movement" : "Already a member? Login"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: { 
            backgroundColor: '#0a0a0a', 
            borderTopWidth: 0,
            height: 90,
            paddingBottom: 30
          },
          tabBarActiveTintColor: '#2563EB',
          tabBarInactiveTintColor: '#444',
          tabBarIcon: ({ color, size }) => {
            if (route.name === 'Home') return <Home size={size} color={color} />;
            if (route.name === 'History') return <History size={size} color={color} />;
            if (route.name === 'Ranking') return <Trophy size={size} color={color} />;
            if (route.name === 'Rewards') return <Gift size={size} color={color} />;
            if (route.name === 'Profile') return <User size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={TrackingScreen} />
        <Tab.Screen name="History" component={ActivitiesScreen} />
        <Tab.Screen name="Ranking" component={LeaderboardScreen} />
        <Tab.Screen name="Rewards" component={RewardsScreen} />
        <Tab.Screen name="Profile">
          {() => <ProfileScreen onLogout={() => setIsAuthenticated(false)} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  authContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', padding: 40 },
  logo: { color: 'white', fontSize: 42, fontWeight: '900', textAlign: 'center', marginBottom: 40 },
  authTitle: { color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 20 },
  input: { backgroundColor: '#111', padding: 16, borderRadius: 12, color: 'white', marginBottom: 16, borderWidth: 1, borderColor: '#222' },
  button: { backgroundColor: '#2563EB', padding: 18, borderRadius: 12, marginTop: 10 },
  buttonText: { color: 'white', fontWeight: '900', textAlign: 'center' },
  toggleText: { color: '#666', textAlign: 'center', marginTop: 24, fontSize: 13 }
});
