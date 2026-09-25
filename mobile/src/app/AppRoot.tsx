import React, { useEffect, useState } from 'react';
import * as Updates from 'expo-updates';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { Silkscreen_700Bold } from '@expo-google-fonts/silkscreen';
import { VT323_400Regular } from '@expo-google-fonts/vt323';
import { observer } from '@legendapp/state/react';
import { useUnistyles } from 'react-native-unistyles';

import { SplashScreen } from '../components/SplashScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { useAuthSession } from '../bootstrap/useAuthSession';
import { AuthScreen } from '../bootstrap/AuthScreen';
import { SoundService } from '../services/SoundService';
import { useChromeNight } from '../hooks/useChromeNight';
import {
  getVisionRideFinishKind,
  isVisionFixtures,
} from '../bootstrap/visionFixtures';
import type {
  RideController,
  RideControllerNotice,
  RideControllerOptions,
} from '../features/ride/controller/RideController';
import { useProductionRideController } from '../features/ride/controller/useProductionRideController';
import { useDeterministicRideController } from '../features/ride/controller/useDeterministicRideController';
import { LegacyNavigationBridge } from './navigation/LegacyNavigationBridge';

type RidePresentationState = {
  startRideError: string | null;
  setStartRideError: React.Dispatch<React.SetStateAction<string | null>>;
  rideEdgeMessage: RideControllerNotice | null;
  setRideEdgeMessage: React.Dispatch<React.SetStateAction<RideControllerNotice | null>>;
};

function useRidePresentationState(): RidePresentationState {
  const [startRideError, setStartRideError] = useState<string | null>(null);
  const [rideEdgeMessage, setRideEdgeMessage] = useState<RideControllerNotice | null>(null);
  return {
    startRideError,
    setStartRideError,
    rideEdgeMessage,
    setRideEdgeMessage,
  };
}

function controllerOptions(state: RidePresentationState): RideControllerOptions {
  return {
    onStartRideError: state.setStartRideError,
    onStartRideSuccess: () => state.setStartRideError(null),
    onEdgeMessage: state.setRideEdgeMessage,
  };
}

function ProductionRideRoot() {
  const presentation = useRidePresentationState();
  const ride = useProductionRideController(controllerOptions(presentation));
  return <AppContent ride={ride} presentation={presentation} />;
}

function DeterministicRideRoot() {
  const presentation = useRidePresentationState();
  const ride = useDeterministicRideController({
    ...controllerOptions(presentation),
    deterministicFinishKind: getVisionRideFinishKind(true),
  });
  return <AppContent ride={ride} presentation={presentation} />;
}

type AppContentProps = {
  ride: RideController;
  presentation: RidePresentationState;
};

const AppContent = observer(function AppContent({
  ride,
  presentation,
}: AppContentProps) {
  const [fontsLoaded] = useFonts({
    PressStart2P: PressStart2P_400Regular,
    Silkscreen: Silkscreen_700Bold,
    VT323: VT323_400Regular,
  });
  const { isDownloading, isUpdatePending } = Updates.useUpdates();
  const { theme } = useUnistyles();

  useChromeNight();

  const {
    auth,
    BYPASS_AUTH,
    handleAuth,
    handleLogout,
    handleOnboardingFinish,
    openSocialLogin,
    clearAuthBanner,
  } = useAuthSession(ride.onUserSessionReady);

  const authUser = auth.user.get();

  useEffect(() => {
    if (__DEV__) return;
    if (isUpdatePending) {
      void Updates.reloadAsync();
    }
  }, [isUpdatePending]);

  useEffect(() => {
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
        onModeChange={(mode) => {
          clearAuthBanner();
          auth.mode.set(mode);
        }}
        onSocialLogin={(provider) => void openSocialLogin(provider)}
      />
    );
  }

  if (!auth.isOnboarded.get() && !isVisionFixtures()) {
    return <OnboardingScreen user={user} onFinish={handleOnboardingFinish} />;
  }

  return (
    <LegacyNavigationBridge
      user={user}
      ride={ride}
      startRideError={presentation.startRideError}
      clearStartRideError={() => presentation.setStartRideError(null)}
      rideEdgeMessage={presentation.rideEdgeMessage}
      clearRideEdgeMessage={() => presentation.setRideEdgeMessage(null)}
      setRideEdgeMessage={presentation.setRideEdgeMessage}
      onLogout={() => void handleLogout()}
    />
  );
});

export const AppRoot = observer(function AppRoot() {
  return isVisionFixtures() ? <DeterministicRideRoot /> : <ProductionRideRoot />;
});
