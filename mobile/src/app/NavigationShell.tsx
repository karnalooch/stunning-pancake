import React, { useRef } from 'react';
import { View } from 'react-native';
import type { NavigationContainerRef } from '@react-navigation/native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { UserProfile } from '@4velo/api-client';
import { GameTabBar } from '../navigation/GameTabBar';
import { RideDashboardScreen } from '../screens/RideDashboardScreen';
import { CityHubScreen } from '../screens/CityHubScreen';
import { ExploreHubScreen } from '../screens/ExploreHubScreen';
import { AthleteProfileScreen } from '../screens/AthleteProfileScreen';
import { ActiveRideHUDScreen } from '../screens/ActiveRideHUDScreen';
import { RidePausedScreen } from '../screens/RidePausedScreen';
import { RideSummaryScreen } from '../screens/RideSummaryScreen';
import { TrainingLogScreen } from '../screens/TrainingLogScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ClubsDirectoryScreen } from '../screens/ClubsDirectoryScreen';
import { SegmentsScreen } from '../screens/SegmentsScreen';
import { ArcadeButton } from '../components/ArcadeButton';
import { useMobileI18n } from '../i18n/useI18n';
import { useFrameBudgetMonitor } from '../hooks/useFrameBudgetMonitor';
import type { ActivitySportType } from '../services/api';

const Tab = createBottomTabNavigator();

export type NavigationShellProps = {
  user: UserProfile | Record<string, unknown>;
  isRecording: boolean;
  ridePaused: boolean;
  setRidePaused: (v: boolean) => void;
  liveSpeed: number;
  liveDistanceKm: number;
  gpsRecoveryVisible: boolean;
  gpsRecoveryBusy: boolean;
  rideSummary: { distanceKm: number } | null;
  setRideSummary: (v: { distanceKm: number } | null) => void;
  showTrainingLog: boolean;
  setShowTrainingLog: (v: boolean) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  showClubs: boolean;
  setShowClubs: (v: boolean) => void;
  showSegments: boolean;
  setShowSegments: (v: boolean) => void;
  onGpsRecoveryPress: () => void;
  onStartRide: (activityType?: ActivitySportType, eventId?: number) => Promise<boolean>;
  onStopRide: () => Promise<{ navigated: boolean; target?: 'Ride' } | void>;
  onLogout: () => void;
};

export function NavigationShell({
  user,
  isRecording,
  ridePaused,
  setRidePaused,
  liveSpeed,
  liveDistanceKm,
  gpsRecoveryVisible,
  gpsRecoveryBusy,
  rideSummary,
  setRideSummary,
  showTrainingLog,
  setShowTrainingLog,
  showSettings,
  setShowSettings,
  showClubs,
  setShowClubs,
  showSegments,
  setShowSegments,
  onGpsRecoveryPress,
  onStartRide,
  onStopRide,
  onLogout,
}: NavigationShellProps) {
  const navRef = useRef<NavigationContainerRef<Record<string, object | undefined>>>(null);
  const { t: mt } = useMobileI18n();
  useFrameBudgetMonitor(isRecording && !ridePaused);

  const gpsRecoveryProps = {
    gpsRecoveryVisible,
    gpsRecoveryBusy,
    onGpsRecoveryPress,
  };

  const handleStartRide = async (
    activityType: ActivitySportType = 'BIKE',
    eventId?: number,
  ) => {
    const ok = await onStartRide(activityType, eventId);
    if (ok) navRef.current?.navigate('Tracking' as never);
  };

  const handleStopRide = async () => {
    const result = await onStopRide();
    if (result && 'navigated' in result && result.navigated) {
      navRef.current?.navigate((result.target ?? 'Ride') as never);
    }
  };

  return (
    <>
      <NavigationContainer ref={navRef}>
        <Tab.Navigator tabBar={(props) => <GameTabBar {...props} />} screenOptions={{ headerShown: false }}>
          <Tab.Screen name="Ride">
            {() => (
              <RideDashboardScreen
                user={user}
                isRecording={isRecording}
                liveSpeed={liveSpeed * 3.6}
                liveDistance={liveDistanceKm}
                onStartRide={(sport) => void handleStartRide(sport)}
                onGoToRide={() => navRef.current?.navigate('Tracking' as never)}
                {...gpsRecoveryProps}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="Compete">
            {() => (
              <CityHubScreen
                user={user}
                onStartQuest={() => void handleStartRide()}
                onOpenClubs={() => setShowClubs(true)}
                onOpenSegments={() => setShowSegments(true)}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="Explore">{() => <ExploreHubScreen />}</Tab.Screen>
          <Tab.Screen name="Profile">
            {() => (
              <AthleteProfileScreen
                user={user}
                onLogout={onLogout}
                onTraining={() => setShowTrainingLog(true)}
                onSettings={() => setShowSettings(true)}
              />
            )}
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

      {rideSummary && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
          <RideSummaryScreen
            distance={rideSummary.distanceKm}
            time="—"
            onBackToHub={() => {
              setRideSummary(null);
              navRef.current?.navigate('Ride' as never);
            }}
          />
        </View>
      )}

      {showTrainingLog && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
          <TrainingLogScreen onBack={() => setShowTrainingLog(false)} />
        </View>
      )}

      {showSettings && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
          <SettingsScreen />
          <View style={{ position: 'absolute', top: 48, right: 16 }}>
            <ArcadeButton label={mt.common.close} onPress={() => setShowSettings(false)} fullWidth={false} />
          </View>
        </View>
      )}

      {showClubs && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
          <ClubsDirectoryScreen />
          <View style={{ position: 'absolute', top: 48, right: 16 }}>
            <ArcadeButton label={mt.common.close} onPress={() => setShowClubs(false)} fullWidth={false} />
          </View>
        </View>
      )}

      {showSegments && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
          <SegmentsScreen />
          <View style={{ position: 'absolute', top: 48, right: 16 }}>
            <ArcadeButton label={mt.common.close} onPress={() => setShowSegments(false)} fullWidth={false} />
          </View>
        </View>
      )}
    </>
  );
}
