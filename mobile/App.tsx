import React, { useState, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Updates from 'expo-updates';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { Silkscreen_700Bold } from '@expo-google-fonts/silkscreen';
import { VT323_400Regular } from '@expo-google-fonts/vt323';
import { observer } from '@legendapp/state/react';
import { useUnistyles } from 'react-native-unistyles';

import { SplashScreen } from './src/components/SplashScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { ErrorBoundary } from './src/bootstrap/ErrorBoundary';
import { useAuthSession } from './src/bootstrap/useAuthSession';
import { useRideLifecycle } from './src/bootstrap/useRideLifecycle';
import { AuthScreen } from './src/bootstrap/AuthScreen';
import { NavigationShell } from './src/bootstrap/NavigationShell';
import { SoundService } from './src/services/SoundService';
import { useChromeNight } from './src/hooks/useChromeNight';
import { isVisionFixtures } from './src/bootstrap/visionFixtures';
import type { RideEdgeMessage } from './src/services/apiRetry';

const AppContent = observer(function AppContent() {
  const [fontsLoaded] = useFonts({
    PressStart2P: PressStart2P_400Regular,
    Silkscreen: Silkscreen_700Bold,
    VT323: VT323_400Regular,
  });
  const { isDownloading, isUpdateAvailable } = Updates.useUpdates();
  const { theme } = useUnistyles();

  const [startRideError, setStartRideError] = useState<string | null>(null);
  const [rideEdgeMessage, setRideEdgeMessage] = useState<RideEdgeMessage | null>(null);

  useChromeNight();

  const ride = useRideLifecycle({
    onStartRideError: setStartRideError,
    onStartRideSuccess: () => setStartRideError(null),
    onEdgeMessage: setRideEdgeMessage,
  });
  const { auth, BYPASS_AUTH, handleAuth, handleLogout, handleOnboardingFinish, openSocialLogin, clearAuthBanner } =
    useAuthSession(ride.onUserSessionReady);

  const authUser = auth.user.get();

  React.useEffect(() => {
    if (__DEV__) return;
    if (isUpdateAvailable) {
      void Updates.reloadAsync();
    }
  }, [isUpdateAvailable]);

  React.useEffect(() => {
    void SoundService.init();
    return () => {
      void SoundService.cleanup();
    };
  }, []);

  if (isDownloading || !fontsLoaded) {
    return (
      <SplashScreen
        mode={isDownloading ? 'deploy' : 'boot'}
        message={isDownloading ? 'POBIERANIE AKTUALIZACJI…' : undefined}
        subMessage={isDownloading ? 'EAS Update · bezpieczny deploy OTA' : undefined}
      />
    );
  }

  if (auth.isLoading.get()) {
    return <SplashScreen mode="boot" />;
  }

  const isAuth = auth.isAuthenticated.get() || BYPASS_AUTH;
  const user =
    authUser || (BYPASS_AUTH ? { id: 'test-pilot', username: 'TestPilot_Auto' } : null);
  const colors = theme.colors as Record<string, string>;

  if (!isAuth || !user) {
    const banner = auth.banner.get();
    return (
      <AuthScreen
        auth={auth}
        colors={colors}
        banner={banner}
        onDismissBanner={clearAuthBanner}
        onSubmit={() => void handleAuth()}
        onToggleMode={() =>
          auth.mode.set(auth.mode.get() === 'login' ? 'register' : 'login')
        }
        onSocialLogin={(provider) => void openSocialLogin(provider)}
      />
    );
  }

  // Vision capture builds land directly in the app so the parity harness can
  // screenshot real screens instead of looping on onboarding.
  if (!auth.isOnboarded.get() && !isVisionFixtures()) {
    return <OnboardingScreen user={user} onFinish={handleOnboardingFinish} />;
  }

  return (
    <NavigationShell
      user={user}
      isRecording={ride.isRecording}
      ridePaused={ride.ridePaused}
      setRidePaused={ride.setRidePaused}
      liveSpeed={ride.liveSpeed}
      liveDistanceKm={ride.liveDistanceKm}
      liveElevationGainM={ride.liveElevationGainM}
      liveElapsedS={ride.liveElapsedS}
      liveCoord={ride.liveCoord}
      gpsRecoveryVisible={ride.gpsRecoveryVisible}
      gpsRecoveryBusy={ride.gpsRecoveryBusy}
      rideSummary={ride.rideSummary}
      setRideSummary={ride.setRideSummary}
      startRideError={startRideError}
      clearStartRideError={() => setStartRideError(null)}
      rideEdgeMessage={rideEdgeMessage}
      clearRideEdgeMessage={() => setRideEdgeMessage(null)}
      setRideEdgeMessage={setRideEdgeMessage}
      onGpsRecoveryPress={() => void ride.handleGpsRecoveryPress()}
      onStartRide={ride.handleStartRide}
      onStopRide={ride.handleStopRide}
      onLogout={() => void handleLogout()}
    />
  );
});

export default observer(function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <ThemeProvider>
            <AppContent />
          </ThemeProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
});
