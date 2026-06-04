import React, { useEffect, useCallback, useRef, useState } from 'react';
import { View, Alert, Text, Linking } from 'react-native';
import type { NavigationContainerRef } from '@react-navigation/native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { observer, useObservable } from '@legendapp/state/react';
import { MMKV } from 'react-native-mmkv';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';

import { Image } from 'react-native';
import { AuthService, setAuthToken } from './src/services/api';
import { SocialAuthService } from './src/services/socialAuth';
import { BrandingService } from './src/services/BrandingService';
import { initFirebase } from './src/services/FirebaseService';
import {
  getRideGpsManager,
  resumeActiveRideIfNeeded,
  startRideSession,
  stopRideSession,
} from './src/services/rideSessionService';
import {
  isTrackingRecoveryPending,
  recoverGpsDataOnLaunch,
  runManualGpsRecovery,
  startGpsBackgroundSync,
  type TrackingStats,
} from './src/services/GpsSyncManager';
import { RidePausedScreen } from './src/screens/RidePausedScreen';
import { ThemeService } from './src/services/ThemeService';

import { SplashScreen } from './src/components/SplashScreen';
import { ActiveRideHUDScreen } from './src/screens/ActiveRideHUDScreen';
import { RideSummaryScreen } from './src/screens/RideSummaryScreen';
import { CityHubScreen } from './src/screens/CityHubScreen';
import { GlobalLeaderboardScreen } from './src/screens/GlobalLeaderboardScreen';
import { AthleteProfileScreen } from './src/screens/AthleteProfileScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { RideDashboardScreen } from './src/screens/RideDashboardScreen';
import { MarketplaceScreen } from './src/screens/MarketplaceScreen';
import { GameTabBar } from './src/navigation/GameTabBar';
import { PixelText } from './src/components/PixelText';
import { ArcadeButton } from './src/components/ArcadeButton';
import { Column } from './src/components/Column';
import { RetroInput } from './src/components/RetroInput';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { useUnistyles, UnistylesRuntime } from 'react-native-unistyles';

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
      // Safe color extraction — UnistylesRuntime may not be initialized yet
      let colors: Record<string, string> = {};
      try {
        colors = (UnistylesRuntime as any).theme?.colors || {};
      } catch { }
      const fallback = { background: '#f8faf0', error: '#ba1a1a', onBackground: '#191d17' };
      const C = { ...fallback, ...colors };
      return (
        <View style={{ flex: 1, backgroundColor: C.background, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: C.error, fontSize: 24, fontWeight: '900' }}>CRITICAL ERROR</Text>
          <Text style={{ color: C.onBackground, textAlign: 'center', fontSize: 14, paddingHorizontal: 16, marginTop: 8 }}>
            {this.state.error?.toString() || 'Unknown JS Exception'}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── AppContent — rendered INSIDE ThemeProvider so useStyles() is valid ──────
//
// IMPORTANT: `useStyles()` from react-native-unistyles MUST be called inside a
// component that is a descendant of <ThemeProvider>. Previously it was called
// directly inside App() before ThemeProvider was rendered, causing the crash:
//   "no theme has been selected yet"
//
const AppContent = observer(function AppContent() {
  const [fontsLoaded] = useFonts({
    'Press Start 2P': PressStart2P_400Regular,
  });

  const { isDownloading, isUpdateAvailable } = Updates.useUpdates();
  const { theme } = useUnistyles(); // ✅ safe — we are inside ThemeProvider
  const navRef = useRef<NavigationContainerRef<Record<string, object | undefined>>>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [ridePaused, setRidePaused] = useState(false);
  const [liveSpeed, setLiveSpeed] = useState(0);
  const [liveDistanceKm, setLiveDistanceKm] = useState(0);
  const [gpsRecoveryVisible, setGpsRecoveryVisible] = useState(false);
  const [gpsRecoveryBusy, setGpsRecoveryBusy] = useState(false);

  const refreshGpsRecoveryFlag = useCallback(() => {
    setGpsRecoveryVisible(isTrackingRecoveryPending());
  }, []);

  const wireGpsStatsCallback = useCallback((userId: number | null) => {
    const manager = getRideGpsManager(userId);
    manager.setUpdateCallback((stats: TrackingStats) => {
      setLiveSpeed(stats.speedMs ?? 0);
      setLiveDistanceKm((stats.distanceM ?? 0) / 1000);
      if (stats.pendingPoints > 0) {
        setGpsRecoveryVisible(true);
      }
    });
  }, []);

  const onUserSessionReady = useCallback(
    async (userId: number | null) => {
      wireGpsStatsCallback(userId);
      if (await resumeActiveRideIfNeeded(userId)) {
        setIsRecording(true);
      }
    },
    [wireGpsStatsCallback],
  );

  const handleGpsRecoveryPress = useCallback(async () => {
    setGpsRecoveryBusy(true);
    try {
      const ok = await runManualGpsRecovery();
      if (ok) {
        setGpsRecoveryVisible(false);
        Alert.alert('Gotowe', 'Niewysłane punkty GPS zostały wysłane.');
      } else {
        Alert.alert(
          'Nie udało się',
          'Część danych nadal czeka na wysłanie. Sprawdź połączenie i spróbuj ponownie.',
        );
        refreshGpsRecoveryFlag();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Błąd wysyłki GPS';
      Alert.alert('Błąd', msg);
    } finally {
      setGpsRecoveryBusy(false);
    }
  }, [refreshGpsRecoveryFlag]);

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
    recoverGpsDataOnLaunch()
      .then(async (result) => {
        if (result.needsResumeUi || isTrackingRecoveryPending()) {
          setGpsRecoveryVisible(true);
        }
        const resumed = await resumeActiveRideIfNeeded(null);
        if (resumed) {
          setIsRecording(true);
        }
      })
      .catch((e) => console.warn('[GPS] launch recovery failed', e));
    startGpsBackgroundSync();
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
          const userId = user?.id != null ? Number(user.id) : null;
          await onUserSessionReady(userId);
          if (user.tenant_id) {
            BrandingService.fetch(user.tenant_id);
          }
        })
        .catch(() => {
          store.delete('auth_token');
          store.delete('refresh_token');
          setAuthToken(null);
        })
        .finally(() => auth.isLoading.set(false));
    } else {
      auth.isLoading.set(false);
    }
  }, [onUserSessionReady]);

  const completeOAuthLogin = useCallback(async (access: string, refresh: string) => {
    const store = getStorage();
    store.set('auth_token', access);
    store.set('refresh_token', refresh);
    setAuthToken(access);
    const user = await AuthService.getProfile();
    auth.user.set(user);
    auth.isAuthenticated.set(true);
    const userId = user?.id != null ? Number(user.id) : null;
    await onUserSessionReady(userId);
    if (user.tenant_id) {
      BrandingService.fetch(user.tenant_id);
    }
  }, [onUserSessionReady]);

  useEffect(() => {
    const handleOAuthUrl = async (url: string | null) => {
      if (!url) return;
      const tokens = SocialAuthService.parseCallbackUrl(url);
      if (!tokens) return;
      auth.isSubmitting.set(true);
      try {
        await completeOAuthLogin(tokens.access, tokens.refresh);
      } catch (e: any) {
        Alert.alert('OAuth Failed', e?.message || 'Could not complete social login.');
      } finally {
        auth.isSubmitting.set(false);
      }
    };

    Linking.getInitialURL().then(handleOAuthUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleOAuthUrl(url));
    return () => sub.remove();
  }, [completeOAuthLogin]);

  const openSocialLogin = async (provider: 'google' | 'facebook') => {
    const url = provider === 'google'
      ? SocialAuthService.googleLoginUrl()
      : SocialAuthService.facebookLoginUrl();
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unavailable', 'Could not open the login page.');
    }
  };

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
          const userId = user?.id != null ? Number(user.id) : null;
          await onUserSessionReady(userId);
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
          const userId = user?.id != null ? Number(user.id) : null;
          await onUserSessionReady(userId);
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

  const handleStartRide = useCallback(
    async (eventId?: number) => {
      const user = auth.user.get();
      const userId = user?.id != null ? Number(user.id) : null;
      try {
        wireGpsStatsCallback(userId);
        await startRideSession({
          type: eventId != null ? 'event' : 'ride',
          event_id: eventId,
          userId,
        });
        setIsRecording(true);
        setRidePaused(false);
        refreshGpsRecoveryFlag();
        navRef.current?.navigate('Tracking' as never);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Nie udało się rozpocząć jazdy';
        Alert.alert('Start jazdy', msg);
        refreshGpsRecoveryFlag();
      }
    },
    [auth.user, refreshGpsRecoveryFlag, wireGpsStatsCallback],
  );

  const handleStopRide = useCallback(async () => {
    const user = auth.user.get();
    const userId = user?.id != null ? Number(user.id) : null;
    try {
      const { finalized, pendingUpload } = await stopRideSession(userId);
      if (pendingUpload > 0) {
        Alert.alert(
          'Trasa zapisana lokalnie',
          `${pendingUpload} punktów GPS czeka na wysłanie. Dotknij baneru „Wyślij niewysłane punkty GPS”, gdy masz sieć.`,
        );
      } else if (finalized) {
        Alert.alert('Zapisano', 'Trasa została wysłana i sesja zakończona.');
      } else {
        Alert.alert('Zatrzymano', 'Nagrywanie GPS zakończone.');
      }
    } catch (e) {
      console.warn('[GPS] stop ride failed', e);
      Alert.alert('Błąd', 'Nie udało się poprawnie zakończyć jazdy. Sprawdź baner odzyskiwania GPS.');
    } finally {
      setIsRecording(false);
      setRidePaused(false);
      setLiveSpeed(0);
      setLiveDistanceKm(0);
      refreshGpsRecoveryFlag();
      navRef.current?.navigate('Ride' as never);
    }
  }, [auth.user, refreshGpsRecoveryFlag]);

  const handleLogout = () => {
    const store = getStorage();
    store.delete('auth_token');
    setAuthToken(null);
    auth.user.set(null);
    auth.isAuthenticated.set(false);
    auth.email.set('');
    auth.password.set('');
  };

  const renderAuthUI = (C: Record<string, string>) => {
    const mode = auth.mode.get();

    return (
      <Column flex={1} style={{ backgroundColor: C.background, justifyContent: 'center' }} padding={24} gap={24}>
        <Column alignItems="center" style={{ marginBottom: 16 }}>
          <PixelText size="2xl" color={C.primary} style={{ fontSize: 36, color: C.primary }}>4VELO</PixelText>
          <PixelText size="xs" color={C.secondary} style={{ marginTop: 8, color: C.secondary }}>
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

          <PixelText size="xs" color={C.secondary} style={{ textAlign: 'center', marginTop: 8, color: C.secondary }}>
            OR CONTINUE WITH
          </PixelText>

          <ArcadeButton
            variant="secondary"
            onPress={() => openSocialLogin('google')}
            disabled={auth.isSubmitting.get()}
            label="GOOGLE"
            size="sm"
          />

          <ArcadeButton
            variant="secondary"
            onPress={() => openSocialLogin('facebook')}
            disabled={auth.isSubmitting.get()}
            label="FACEBOOK"
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

    if (!isAuth) return renderAuthUI((theme.colors as any) as Record<string, string>);
    if (!isOnboarded) return <OnboardingScreen user={user} onFinish={handleOnboardingFinish} />;

    const gpsRecoveryProps = {
      gpsRecoveryVisible,
      gpsRecoveryBusy,
      onGpsRecoveryPress: handleGpsRecoveryPress,
    };

    return (
      <>
        <NavigationContainer ref={navRef}>
          <Tab.Navigator
            tabBar={(props) => <GameTabBar {...props} />}
            screenOptions={{ headerShown: false }}
          >
            <Tab.Screen name="Ride">
              {() => (
                <RideDashboardScreen
                  user={user}
                  isRecording={isRecording}
                  liveSpeed={liveSpeed * 3.6}
                  liveDistance={liveDistanceKm}
                  onStartRide={() => handleStartRide()}
                  onGoToRide={() => navRef.current?.navigate('Tracking' as never)}
                  {...gpsRecoveryProps}
                />
              )}
            </Tab.Screen>
            <Tab.Screen name="Compete">
              {() => (
                <CityHubScreen
                  user={user}
                  onStartQuest={() => handleStartRide()}
                />
              )}
            </Tab.Screen>
            <Tab.Screen name="Explore">
              {() => <MarketplaceScreen />}
            </Tab.Screen>
            <Tab.Screen name="Profile">
              {() => <AthleteProfileScreen user={user} onLogout={handleLogout} />}
            </Tab.Screen>
            <Tab.Screen name="Tracking" options={{ tabBarButton: () => null }}>
              {() => (
                <ActiveRideHUDScreen
                  user={user}
                  liveSpeed={liveSpeed}
                  liveDistanceKm={liveDistanceKm}
                  onPause={() => setRidePaused(true)}
                  onStop={() => void handleStopRide()}
                  {...gpsRecoveryProps}
                />
              )}
            </Tab.Screen>
          </Tab.Navigator>
        </NavigationContainer>
        {ridePaused && isRecording && (
          <RidePausedScreen
            onResume={() => setRidePaused(false)}
            onStop={() => {
              setRidePaused(false);
              void handleStopRide();
            }}
          />
        )}
      </>
    );
  };

  return (
    <>
      {isDownloading || !fontsLoaded ? (
        <SplashScreen message="DOWNLOADING SECURE UPDATE..." subMessage="CONNECTING TO ANTIGRAVITY EDGE" />
      ) : auth.isLoading.get() ? (
        <SplashScreen />
      ) : (
        renderContent()
      )}
    </>
  );
});

// ─── App — Root component: sets up providers, then renders AppContent ─────────
export default observer(function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider initialTheme={ThemeService.themeMode.get() as 'stitch'}>
          {/* AppContent lives inside ThemeProvider so useStyles() works correctly */}
          <AppContent />
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
});
