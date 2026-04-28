import React, { useEffect } from 'react';
import { StyleSheet, View, Alert, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TamaguiProvider, YStack, Text as TamaText, Input, Button as TamaButton, H1, Paragraph, Spinner } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { MMKV } from 'react-native-mmkv';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import tamaguiConfig from './tamagui.config';

import { Home, History, Gift, User, Trophy } from 'lucide-react-native';
import { Theme } from './src/theme/Theme';
import { AuthService, setAuthToken } from './src/services/api';
import { initFirebase } from './src/services/FirebaseService';

// Screens
import { TrackingScreen } from './src/screens/TrackingScreen';
import { ActivitiesScreen } from './src/screens/ActivitiesScreen';
import { RewardsScreen } from './src/screens/RewardsScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

// Initialize MMKV lazily to avoid JSI issues on module load
let storage: any;
const BYPASS_AUTH = false; // Set to true for automated testing of internal screens
const getStorage = () => {
  if (storage) return storage;
  try {
    storage = new MMKV();
    return storage;
  } catch (e) {
    console.error("MMKV initialization failed. Falling back to mock storage.", e);
    // Mock storage for dev/emergency
    storage = {
      getString: (key: string) => null,
      set: (key: string, value: any) => {},
      delete: (key: string) => {},
      clearAll: () => {},
      getAllKeys: () => [],
      contains: (key: string) => false,
    };
    return storage;
  }
};

const Tab = createBottomTabNavigator();

const HomeIcon = Home as any;
const HistoryIcon = History as any;
const GiftIcon = Gift as any;
const UserIcon = User as any;
const TrophyIcon = Trophy as any;

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0B0E14', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: '#DC2626', fontSize: 24, fontWeight: '900', letterSpacing: 1 }}>CRITICAL ERROR</Text>
          </View>
          <Text style={{ color: '#9CA3AF', textAlign: 'center', fontSize: 14, paddingHorizontal: 16 }}>
            {this.state.error?.toString() || "Unknown JS Exception"}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default observer(function App() {
  const auth = useObservable({
    isAuthenticated: false,
    isLoading: true,
    isSubmitting: false,
    mode: 'login' as 'login' | 'register',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    user: null as any
  });

  const isLoading = auth.isLoading.get();

  useEffect(() => {
    initFirebase();
    const store = getStorage();
    const token = store.getString('auth_token');
    if (token) {
      setAuthToken(token);
      AuthService.getProfile()
        .then(user => {
          auth.user.set(user);
          auth.isAuthenticated.set(true);
        })
        .catch(() => {
          store.delete('auth_token');
          setAuthToken(null);
        })
        .finally(() => auth.isLoading.set(false));
    } else {
      auth.isLoading.set(false);
    }
  }, []);

  const handleAuth = async () => {
    // Validation
    if (!auth.email.get() || !auth.password.get()) {
      Alert.alert("Missing Info", "Please fill in all required fields.");
      return;
    }

    if (auth.mode.get() === 'register') {
      if (!auth.username.get()) {
        Alert.alert("Missing Info", "Choose a pilot name (username).");
        return;
      }
      if (auth.password.get() !== auth.confirmPassword.get()) {
        Alert.alert("Mismatch", "Passwords do not match.");
        return;
      }
    }

    auth.isSubmitting.set(true);
    try {
      let data;
      if (auth.mode.get() === 'login') {
        data = await AuthService.login({ 
          username: auth.email.get(), 
          password: auth.password.get() 
        });
      } else {
        data = await AuthService.register({
          email: auth.email.get(),
          username: auth.username.get(),
          password: auth.password.get(),
          tenant_id: 'siedlce-city' // Default for Grupetto Siedlce testers
        });
      }

      if (data.access || data.token) {
        const token = data.access || data.token;
        const store = getStorage();
        store.set('auth_token', token);
        setAuthToken(token);
        const user = await AuthService.getProfile();
        auth.user.set(user);
        auth.isAuthenticated.set(true);
        
        if (auth.mode.get() === 'register') {
          Alert.alert("Welcome!", "Your account is ready. Welcome to Grupetto Siedlce.");
        }
      }
    } catch (e: any) {
      const errorMsg = e.response?.data?.detail || e.response?.data?.username?.[0] || e.response?.data?.email?.[0] || "Auth service temporarily unavailable.";
      Alert.alert("Operation Failed", errorMsg);
    } finally {
      auth.isSubmitting.set(false);
    }
  };

  const renderContent = () => {
    const isAuth = auth.isAuthenticated.get() || BYPASS_AUTH;
    const user = auth.user.get() || (BYPASS_AUTH ? { id: 'test-pilot', username: 'TestPilot_Auto' } : null);
    const mode = auth.mode.get();
    const username = auth.username.get();
    const email = auth.email.get();
    const password = auth.password.get();
    const confirmPassword = auth.confirmPassword.get();
    const isSubmitting = auth.isSubmitting.get();

    if (!isAuth) {
      return (
        <YStack flex={1} backgroundColor="#0B0E14" justifyContent="center" padding="$6" gap="$4">
          <YStack alignItems="center" marginBottom="$6">
            <H1 fontSize={42} fontWeight="900" color="$white" letterSpacing={-2}>
              SPORT<TamaText color="$blue10">.</TamaText>
            </H1>
            <TamaText color="$gray10" fontSize={10} fontWeight="800" letterSpacing={4}>HYPERSCALE PERFORMANCE</TamaText>
          </YStack>
          
          <YStack gap="$2" marginBottom="$4">
            <H1 fontSize={24} color="$white" fontWeight="900">
              {mode === 'login' ? 'Grupetto Siedlce' : 'New Pilot'}
            </H1>
            <Paragraph color="$gray10" fontSize={14}>
              {mode === 'login' 
                ? 'Authorized access only. Gear up.' 
                : 'Enter your credentials to join the group.'}
            </Paragraph>
          </YStack>

          <YStack gap="$3">
            {mode === 'register' && (
              <Input 
                size="$5"
                placeholder="Username (Pilot Name)" 
                backgroundColor="$gray1" 
                borderWidth={1} 
                borderColor="$gray4"
                value={username}
                onChangeText={(t) => auth.username.set(t)}
                autoCapitalize="none"
              />
            )}
            <Input 
              size="$5"
              placeholder="Email or Username" 
              backgroundColor="$gray1" 
              borderWidth={1} 
              borderColor="$gray4"
              value={email}
              onChangeText={(t) => auth.email.set(t)}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Input 
              size="$5"
              placeholder="Password" 
              secureTextEntry 
              backgroundColor="$gray1" 
              borderWidth={1} 
              borderColor="$gray4"
              value={password}
              onChangeText={(t) => auth.password.set(t)}
            />
            {mode === 'register' && (
              <Input 
                size="$5"
                placeholder="Confirm Password" 
                secureTextEntry 
                backgroundColor="$gray1" 
                borderWidth={1} 
                borderColor="$gray4"
                value={confirmPassword}
                onChangeText={(t) => auth.confirmPassword.set(t)}
              />
            )}
          </YStack>

          <TamaButton 
            marginTop="$4"
            size="$5"
            backgroundColor="$blue10"
            onPress={handleAuth}
            disabled={isSubmitting}
            pressStyle={{ opacity: 0.8, scale: 0.98 }}
          >
            {isSubmitting ? <Spinner color="white" /> : (
              <TamaText fontWeight="900" color="white" letterSpacing={1.5}>
                {mode === 'login' ? 'AUTHORIZE' : 'INITIALIZE ACCOUNT'}
              </TamaText>
            )}
          </TamaButton>

          <TamaButton 
            chromeless
            onPress={() => {
              auth.mode.set(mode === 'login' ? 'register' : 'login');
              // Clear sensitive fields when switching modes
              auth.password.set('');
              auth.confirmPassword.set('');
            }}
          >
            <TamaText color="$gray10" textAlign="center" fontSize={13}>
              {mode === 'login' ? "New athlete? Register here" : "Already registered? Sign in"}
            </TamaText>
          </TamaButton>
        </YStack>
      );
    }

    return (
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarStyle: { 
              backgroundColor: Theme.colors.card, 
              borderTopWidth: 0,
              height: 90,
              paddingBottom: 30
            },
            tabBarActiveTintColor: Theme.colors.primary,
            tabBarInactiveTintColor: Theme.colors.textMuted,
            tabBarIcon: ({ color, size }) => {
              if (route.name === 'Home') return <HomeIcon size={size} color={color} />;
              if (route.name === 'History') return <HistoryIcon size={size} color={color} />;
              if (route.name === 'Ranking') return <TrophyIcon size={size} color={color} />;
              if (route.name === 'Rewards') return <GiftIcon size={size} color={color} />;
              if (route.name === 'Profile') return <UserIcon size={size} color={color} />;
            },
          })}
        >
          <Tab.Screen name="Home">
            {() => <TrackingScreen user={user} />}
          </Tab.Screen>
          <Tab.Screen name="History" component={ActivitiesScreen} />
          <Tab.Screen name="Ranking" component={LeaderboardScreen} />
          <Tab.Screen name="Rewards" component={RewardsScreen} />
          <Tab.Screen name="Profile">
            {() => <ProfileScreen user={user} onLogout={handleLogout} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    );
  };

  const handleLogout = () => {
    const store = getStorage();
    store.delete('auth_token');
    setAuthToken(null);
    auth.user.set(null);
    auth.isAuthenticated.set(false);
    auth.email.set('');
    auth.password.set('');
  };

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
          {isLoading ? (
            <YStack flex={1} backgroundColor="#0B0E14" justifyContent="center" alignItems="center">
              <Spinner size="large" color="$blue10" />
              <TamaText marginTop="$4" color="$gray10" letterSpacing={2} fontSize={10} fontWeight="900">BOOTING SPORT CORE...</TamaText>
            </YStack>
          ) : renderContent()}
        </TamaguiProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
});


