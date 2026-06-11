import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { observer } from '@legendapp/state/react';
import { useUnistyles } from 'react-native-unistyles';

import { SplashScreen } from './src/components/SplashScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ThemeService } from './src/services/ThemeService';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { ErrorBoundary } from './src/app/ErrorBoundary';
import { useAuthSession } from './src/app/useAuthSession';
import { useRideLifecycle } from './src/app/useRideLifecycle';
import { AuthScreen } from './src/app/AuthScreen';
import { NavigationShell } from './src/app/NavigationShell';

const AppContent = observer(function AppContent() {
  const [fontsLoaded] = useFonts({ 'Press Start 2P': PressStart2P_400Regular });
  const { isDownloading, isUpdateAvailable } = Updates.useUpdates();
  const { theme } = useUnistyles();

  const [showTrainingLog, setShowTrainingLog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showClubs, setShowClubs] = useState(false);
  const [showSegments, setShowSegments] = useState(false);

  const ride = useRideLifecycle();
  const { auth, BYPASS_AUTH, handleAuth, handleLogout, handleOnboardingFinish, openSocialLogin } =
    useAuthSession(ride.onUserSessionReady);

  const authUser = auth.user.get();

  React.useEffect(() => {
    if (isUpdateAvailable) {
      void Updates.reloadAsync();
    }
  }, [isUpdateAvailable]);

  if (isDownloading || !fontsLoaded) {
    return (
      <SplashScreen message="DOWNLOADING SECURE UPDATE..." subMessage="CONNECTING TO ANTIGRAVITY EDGE" />
    );
  }

  if (auth.isLoading.get()) {
    return <SplashScreen />;
  }

  const isAuth = auth.isAuthenticated.get() || BYPASS_AUTH;
  const user =
    authUser || (BYPASS_AUTH ? { id: 'test-pilot', username: 'TestPilot_Auto' } : null);
  const colors = theme.colors as Record<string, string>;

  if (!isAuth || !user) {
    return (
      <AuthScreen
        auth={auth}
        colors={colors}
        onSubmit={() => void handleAuth()}
        onToggleMode={() =>
          auth.mode.set(auth.mode.get() === 'login' ? 'register' : 'login')
        }
        onSocialLogin={(provider) => void openSocialLogin(provider)}
      />
    );
  }

  if (!auth.isOnboarded.get()) {
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
      gpsRecoveryVisible={ride.gpsRecoveryVisible}
      gpsRecoveryBusy={ride.gpsRecoveryBusy}
      rideSummary={ride.rideSummary}
      setRideSummary={ride.setRideSummary}
      showTrainingLog={showTrainingLog}
      setShowTrainingLog={setShowTrainingLog}
      showSettings={showSettings}
      setShowSettings={setShowSettings}
      showClubs={showClubs}
      setShowClubs={setShowClubs}
      showSegments={showSegments}
      setShowSegments={setShowSegments}
      onGpsRecoveryPress={() => void ride.handleGpsRecoveryPress()}
      onStartRide={ride.handleStartRide}
      onStopRide={ride.handleStopRide}
      onLogout={() => void handleLogout()}
    />
  );
});

export default observer(function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider initialTheme={ThemeService.themeMode.get() as 'stitch'}>
          <AppContent />
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
});
