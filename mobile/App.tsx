import React, { useEffect, useCallback } from 'react';
import { View, Alert, Text, Linking } from 'react-native';
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
import { recoverGpsDataOnLaunch, startGpsBackgroundSync } from './src/services/GpsSyncManager';
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
    recoverGpsDataOnLaunch().catch((e) =>
      console.warn('[GPS] launch recovery failed', e),
    );
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
  }, []);

  const completeOAuthLogin = useCallback(async (access: string, refresh: string) => {
    const store = getStorage();
    store.set('auth_token', access);
    store.set('refresh_token', refresh);
    setAuthToken(access);
    const user = await AuthService.getProfile();
    auth.user.set(user);
    auth.isAuthenticated.set(true);
    if (user.tenant_id) {
      BrandingService.fetch(user.tenant_id);
    }
  }, []);

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
