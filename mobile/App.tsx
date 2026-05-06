import React, { useEffect } from 'react';
import { StyleSheet, View, Alert, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { observer, useObservable } from '@legendapp/state/react';
import { MMKV } from 'react-native-mmkv';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';

import { Image } from 'react-native';
import { AuthService, setAuthToken } from './src/services/api';
import { BrandingService } from './src/services/BrandingService';
import { initFirebase } from './src/services/FirebaseService';
import { ThemeService } from './src/services/ThemeService';

import { SplashScreen } from './src/components/SplashScreen';
import { TrackingScreen } from './src/screens/TrackingScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { RideDashboardScreen } from './src/screens/RideDashboardScreen';
import { ActiveRideHUDScreen } from './src/screens/ActiveRideHUDScreen';
import { RideSummaryScreen } from './src/screens/RideSummaryScreen';
import { CityHubScreen } from './src/screens/CityHubScreen';
import { GlobalLeaderboardScreen } from './src/screens/GlobalLeaderboardScreen';
import { AthleteProfileScreen } from './src/screens/AthleteProfileScreen';
import { MarketplaceScreen } from './src/screens/MarketplaceScreen';
import { GameTabBar } from './src/navigation/GameTabBar';
import { PixelText } from './src/components/PixelText';
import { ArcadeButton } from './src/components/ArcadeButton';
import { Column } from './src/components/Column';
import { RetroInput } from './src/components/RetroInput';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { colors as tokens } from '@tokens/generated/restyle-colors';

let storage: any;
const BYPASS_AUTH = false;
const getStorage = () => {
  if (storage) return storage;
  try {
    storage = new MMKV();
    return storage;
  } catch (e) {
    console.error('MMKV init failed', e);
    storage = {
      getString: (key: string) => null,
      set: (key: string, value: any) => { },
      delete: (key: string) => { },
      clearAll: () => { },
      getAllKeys: () => [],
      contains: (key: string) => false,
    };
    return storage;
  }
};

const Tab = createBottomTabNavigator();

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
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
        <View style={{ flex: 1, backgroundColor: tokens.octopath.background, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: tokens.semantic.primary, fontSize: 24, fontWeight: '900' }}>CRITICAL ERROR</Text>
          <Text style={{ color: tokens.octopath.textMuted, textAlign: 'center', fontSize: 14, paddingHorizontal: 16, marginTop: 8 }}>
            {this.state.error?.toString() || 'Unknown JS Exception'}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default observer(function App() {
  const [fontsLoaded] = useFonts({
    'Press Start 2P': PressStart2P_400Regular,
  });

  const { isDownloading, isUpdateAvailable } = Updates.useUpdates();

  const auth = useObservable({
    isAuthenticated: false,
    isOnboarded: false,
    isLoading: true,
    isSubmitting: false,
    mode: 'login' as 'login' | 'register',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    user: null as any,
  });

  useEffect(() => {
    if (isUpdateAvailable) {
      Updates.reloadAsync();
    }
  }, [isUpdateAvailable]);

  useEffect(() => {
    initFirebase();
    const store = getStorage();
    const token = store.getString('auth_token');
    const hasOnboarded = store.getString('onboarding_complete') === 'true';
    auth.isOnboarded.set(hasOnboarded);

    if (token) {
      setAuthToken(token);
      AuthService.getProfile()
        .then(async (user) => {
          auth.user.set(user);
          auth.isAuthenticated.set(true);
          if (user.tenant_id) {
            BrandingService.fetch(user.tenant_id);
          }
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

  const handleOnboardingFinish = (data: any) => {
    const store = getStorage();
    store.set('onboarding_complete', 'true');
    auth.isOnboarded.set(true);
  };

  const handleAuth = async () => {
    if (!auth.email.get() || !auth.password.get()) {
      Alert.alert('Missing Info', 'Please fill in all required fields.');
      return;
    }
    if (auth.mode.get() === 'register') {
      if (!auth.username.get()) {
        Alert.alert('Missing Info', 'Choose a pilot name (username).');
        return;
      }
      if (auth.password.get() !== auth.confirmPassword.get()) {
        Alert.alert('Mismatch', 'Passwords do not match.');
        return;
      }
    }

    auth.isSubmitting.set(true);
    try {
      if (auth.mode.get() === 'login') {
        const data = await AuthService.login(auth.email.get(), auth.password.get());
        if (data.access) {
          const store = getStorage();
          store.set('auth_token', data.access);
          setAuthToken(data.access);
          const user = await AuthService.getProfile();
          auth.user.set(user);
          auth.isAuthenticated.set(true);
          if (user.tenant_id) {
            BrandingService.fetch(user.tenant_id);
          }
        }
      } else {
        await AuthService.register({
          email: auth.email.get(),
          username: auth.username.get(),
          password: auth.password.get(),
          tenant_id: 'siedlce-city',
        });
        // Auto-login after register
        const data = await AuthService.login(auth.email.get(), auth.password.get());
        if (data.access) {
          const store = getStorage();
          store.set('auth_token', data.access);
          setAuthToken(data.access);
          const user = await AuthService.getProfile();
          auth.user.set(user);
          auth.isAuthenticated.set(true);
          if (user.tenant_id) {
            BrandingService.fetch(user.tenant_id);
          }
        }
        Alert.alert('Welcome!', 'Your account is ready. Welcome to Grupetto Siedlce.');
      }
    } catch (e: any) {
      Alert.alert('Operation Failed', e?.message || 'Auth service unavailable.');
    } finally {
      auth.isSubmitting.set(false);
    }
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

  const renderAuthUI = () => {
    const mode = auth.mode.get();

    return (
      <Column flex={1} style={{ backgroundColor: tokens.octopath.background, justifyContent: 'center' }} padding={24} gap={24}>
        <Column alignItems="center" style={{ marginBottom: 16 }}>
          <PixelText size="2xl" color="primary" shadow style={{ fontSize: 36 }}>SPORT</PixelText>
          <PixelText size="xs" color="success" style={{ marginTop: 8 }}>
            {mode === 'login' ? 'MISSION LOGIN' : 'NEW PILOT REGISTRATION'}
          </PixelText>
        </Column>

        <Column gap={16}>
          {mode === 'register' && (
            <RetroInput
              placeholder="PILOT_NAME"
              value={auth.username.get()}
              onChangeText={(v: string) => auth.username.set(v)}
            />
          )}

          <RetroInput
            placeholder="EMAIL / OPERATOR ID"
            value={auth.email.get()}
            onChangeText={(v: string) => auth.email.set(v)}
            autoCapitalize="none"
          />

          <RetroInput
            placeholder="ACCESS TOKEN"
            value={auth.password.get()}
            onChangeText={(v: string) => auth.password.set(v)}
            secureTextEntry
          />

          {mode === 'register' && (
            <RetroInput
              placeholder="CONFIRM ACCESS TOKEN"
              value={auth.confirmPassword.get()}
              onChangeText={(v: string) => auth.confirmPassword.set(v)}
              secureTextEntry
            />
          )}
        </Column>

        <Column gap={16} style={{ marginTop: 16 }}>
          <ArcadeButton
            variant="primary"
            onPress={handleAuth}
            disabled={auth.isSubmitting.get()}
            label={auth.isSubmitting.get() ? 'CONNECTING...' : (mode === 'login' ? 'AUTHORIZE' : 'REGISTER PILOT')}
          />

          <ArcadeButton
            variant="ghost"
            onPress={() => auth.mode.set(mode === 'login' ? 'register' : 'login')}
            label={mode === 'login' ? 'NEW PILOT? REGISTER' : 'EXISTING PILOT? LOGIN'}
            size="sm"
          />
        </Column>
      </Column>
    );
  };

  const renderContent = () => {
    const isAuth = auth.isAuthenticated.get() || BYPASS_AUTH;
    const user = auth.user.get() || (BYPASS_AUTH ? { id: 'test-pilot', username: 'TestPilot_Auto' } : null);
    const isOnboarded = auth.isOnboarded.get();
    const isSolar = ThemeService.themeMode.get() === 'solar';

    if (!isAuth) return renderAuthUI();
    if (!isOnboarded) return <OnboardingScreen user={user} onFinish={handleOnboardingFinish} />;

    return (
      <NavigationContainer>
        <Tab.Navigator
          tabBar={(props) => <GameTabBar {...props} />}
          screenOptions={{ headerShown: false }}
        >
          <Tab.Screen name="Ride">
            {() => <RideDashboardScreen user={user} />}
          </Tab.Screen>
          <Tab.Screen name="Compete">
            {() => <CityHubScreen user={user} />}
          </Tab.Screen>
          <Tab.Screen name="Explore">
            {() => <MarketplaceScreen />}
          </Tab.Screen>
          <Tab.Screen name="Profile">
            {() => <AthleteProfileScreen user={user} onLogout={handleLogout} />}
          </Tab.Screen>
          {/* Keep legacy screen for tracking */}
          <Tab.Screen name="Tracking" options={{ tabBarStyle: { display: 'none' } }}>
            {() => <ActiveRideHUDScreen user={user} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    );
  };

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider initialTheme={ThemeService.themeMode.get() as 'octopath' | 'solar'}>
          {isDownloading || !fontsLoaded ? (
            <SplashScreen message="DOWNLOADING SECURE UPDATE..." subMessage="CONNECTING TO ANTIGRAVITY EDGE" />
          ) : auth.isLoading.get() ? (
            <SplashScreen />
          ) : (
            renderContent()
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
});
