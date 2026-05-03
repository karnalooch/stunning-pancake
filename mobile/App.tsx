import React, { useEffect } from 'react';
import { StyleSheet, View, Alert, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TamaguiProvider, YStack, Text as TamaText, Input, Button as TamaButton, H1, Paragraph, Spinner } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { MMKV } from 'react-native-mmkv';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import tamaguiConfig from './tamagui.config';

import { Image } from 'react-native';
import { AuthService, setAuthToken } from './src/services/api';
import { BrandingService } from './src/services/BrandingService';
import { initFirebase } from './src/services/FirebaseService';
import { ThemeService } from './src/services/ThemeService';

import { SplashScreen } from './src/components/SplashScreen';
import { TrackingScreen } from './src/screens/TrackingScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ActivitiesScreen } from './src/screens/ActivitiesScreen';
import { RewardsScreen } from './src/screens/RewardsScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { GameTabBar } from './src/navigation/GameTabBar';
import { PixelText } from './src/components/arcade/PixelText';
import { ArcadeButton } from './src/components/arcade/ArcadeButton';

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

// Octopath HD-2D colors (match tamagui.config.ts)
const OCTOPATH = {
  card: '#3D3020',
  primary: '#D4A373',
  textMuted: '#8B7355',
  background: '#2D2418',
};

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
        <View style={{ flex: 1, backgroundColor: OCTOPATH.background, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: OCTOPATH.primary, fontSize: 24, fontWeight: '900' }}>CRITICAL ERROR</Text>
          <Text style={{ color: OCTOPATH.textMuted, textAlign: 'center', fontSize: 14, paddingHorizontal: 16, marginTop: 8 }}>
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
      <YStack flex={1} backgroundColor="#0B1D33" justifyContent="center" padding="$6" gap="$6">
        <YStack alignItems="center" marginBottom="$4">
          <PixelText size={36} color="#D4A373" shadow>SPORT</PixelText>
          <PixelText size={10} color="#7BA05B" style={{ marginTop: 8 }}>
            {mode === 'login' ? 'MISSION LOGIN' : 'NEW PILOT REGISTRATION'}
          </PixelText>
        </YStack>

        <YStack gap="$4">
          {mode === 'register' && (
            <Input
              placeholder="PILOT_NAME"
              value={auth.username.get()}
              onChangeText={(v) => auth.username.set(v)}
              backgroundColor="#2B303A"
              borderColor="#D4A373"
              borderWidth={2}
              color="#F5E6CC"
              fontFamily="$pixel"
              fontSize={12}
              borderRadius={0}
              paddingVertical="$3"
            />
          )}

          <Input
            placeholder="EMAIL / OPERATOR ID"
            value={auth.email.get()}
            onChangeText={(v) => auth.email.set(v)}
            autoCapitalize="none"
            backgroundColor="#2B303A"
            borderColor="#D4A373"
            borderWidth={2}
            color="#F5E6CC"
            fontFamily="$pixel"
            fontSize={12}
            borderRadius={0}
            paddingVertical="$3"
          />

          <Input
            placeholder="ACCESS TOKEN"
            value={auth.password.get()}
            onChangeText={(v) => auth.password.set(v)}
            secureTextEntry
            backgroundColor="#2B303A"
            borderColor="#D4A373"
            borderWidth={2}
            color="#F5E6CC"
            fontFamily="$pixel"
            fontSize={12}
            borderRadius={0}
            paddingVertical="$3"
          />

          {mode === 'register' && (
            <Input
              placeholder="CONFIRM ACCESS TOKEN"
              value={auth.confirmPassword.get()}
              onChangeText={(v) => auth.confirmPassword.set(v)}
              secureTextEntry
              backgroundColor="#2B303A"
              borderColor="#D4A373"
              borderWidth={2}
              color="#F5E6CC"
              fontFamily="$pixel"
              fontSize={12}
              borderRadius={0}
              paddingVertical="$3"
            />
          )}
        </YStack>

        <YStack gap="$4" marginTop="$4">
          <ArcadeButton
            variant="gold"
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
        </YStack>
      </YStack>
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

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <TamaguiProvider config={tamaguiConfig} defaultTheme={ThemeService.themeMode.get()}>
          {isDownloading || !fontsLoaded ? (
            <SplashScreen message="DOWNLOADING SECURE UPDATE..." subMessage="CONNECTING TO ANTIGRAVITY EDGE" />
          ) : auth.isLoading.get() ? (
            <SplashScreen />
          ) : (
            renderContent()
          )}
        </TamaguiProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
});
