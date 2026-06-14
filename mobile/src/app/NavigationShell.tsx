import React, { useEffect, useRef } from 'react';
import { Share, View } from 'react-native';
import type { NavigationContainerRef } from '@react-navigation/native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { UserProfile } from '@4velo/api-client';
import { GameTabBar } from '../navigation/GameTabBar';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { RideDashboardScreen } from '../screens/RideDashboardScreen';
import { CityHubScreen } from '../screens/CityHubScreen';
import { ExploreHubScreen } from '../screens/ExploreHubScreen';
import { AthleteProfileScreen } from '../screens/AthleteProfileScreen';
import { ActiveRideHUDScreen } from '../screens/ActiveRideHUDScreen';
import { RidePausedScreen } from '../screens/RidePausedScreen';
import { RideSummaryScreen } from '../screens/RideSummaryScreen';
import { TrainingLogScreen } from '../screens/TrainingLogScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { GpsDiagnosticsScreen } from '../screens/GpsDiagnosticsScreen';
import { ClubsDirectoryScreen } from '../screens/ClubsDirectoryScreen';
import { SegmentsScreen } from '../screens/SegmentsScreen';
import { ExploreMapScreen } from '../screens/ExploreMapScreen';
import { ActivityDetailScreen } from '../screens/ActivityDetailScreen';
import { PerformanceTrendsScreen } from '../screens/PerformanceTrendsScreen';
import { GlobalLeaderboardScreen } from '../screens/GlobalLeaderboardScreen';
import { MarketplaceScreen } from '../screens/MarketplaceScreen';
import { StackScreenHeader } from '../components/navigation/StackScreenHeader';
import { useMobileI18n } from '../i18n/useI18n';
import { useFrameBudgetMonitor } from '../hooks/useFrameBudgetMonitor';
import { useMotionDegradeMonitor } from '../hooks/useMotionDegrade';
import type { ActivitySportType } from '../services/api';
import { ActivityService } from '../services/api';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { trackEngagement } from '../services/EngagementAnalytics';
import type { RideEdgeMessage } from '../services/apiRetry';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import { mobileLinking } from '../navigation/linking';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

export type NavigationShellProps = {
  user: (UserProfile & { username?: string; tenant_id?: string | null }) | Record<string, unknown>;
  isRecording: boolean;
  ridePaused: boolean;
  setRidePaused: (v: boolean) => void;
  liveSpeed: number;
  liveDistanceKm: number;
  liveElevationGainM: number;
  liveElapsedS: number;
  liveCoord: [number, number] | null;
  gpsRecoveryVisible: boolean;
  gpsRecoveryBusy: boolean;
  rideSummary: { distanceKm: number; elapsedS: number; elevationGainM: number } | null;
  setRideSummary: (v: { distanceKm: number; elapsedS: number; elevationGainM: number } | null) => void;
  startRideError: string | null;
  clearStartRideError: () => void;
  rideEdgeMessage: RideEdgeMessage | null;
  clearRideEdgeMessage: () => void;
  setRideEdgeMessage: (msg: RideEdgeMessage | null) => void;
  onGpsRecoveryPress: () => void;
  onStartRide: (activityType?: ActivitySportType, eventId?: number) => Promise<boolean>;
  onStopRide: () => Promise<{ navigated: boolean; target?: 'Ride' } | void>;
  onLogout: () => void;
};

type MainTabsProps = Omit<
  NavigationShellProps,
  'rideSummary' | 'setRideSummary' | 'setRideEdgeMessage'
> & {
  navRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
};

type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

function MainTabs({
  user,
  isRecording,
  ridePaused,
  setRidePaused,
  liveSpeed,
  liveDistanceKm,
  liveElevationGainM,
  liveElapsedS,
  liveCoord,
  gpsRecoveryVisible,
  gpsRecoveryBusy,
  onGpsRecoveryPress,
  onStartRide,
  onStopRide,
  onLogout,
  navRef,
  startRideError,
  clearStartRideError,
  rideEdgeMessage,
  clearRideEdgeMessage,
}: MainTabsProps) {
  const shellUser = user as { username?: string; tenant_id?: string | null } | null;

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
    if (ok) navRef.current?.navigate('MainTabs', { screen: 'Tracking' });
  };

  const handleStopRide = async () => {
    const result = await onStopRide();
    if (result && 'navigated' in result && result.navigated) {
      navRef.current?.navigate('MainTabs', { screen: result.target ?? 'Ride' });
    }
  };

  return (
    <Tab.Navigator tabBar={(props) => <GameTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Ride">
        {() => (
          <RideDashboardScreen
            user={
              shellUser
                ? { username: shellUser.username ?? 'RIDER', tenant_id: shellUser.tenant_id ?? undefined }
                : null
            }
            isRecording={isRecording}
            liveSpeed={liveSpeed * 3.6}
            liveDistance={liveDistanceKm}
            onStartRide={(sport) => void handleStartRide(sport)}
            onGoToRide={() => navRef.current?.navigate('MainTabs', { screen: 'Tracking' })}
            onOpenGpsWizard={() => navRef.current?.navigate('GpsDiagnostics')}
            onOpenSettings={() => navRef.current?.navigate('Settings')}
            startRideError={startRideError}
            onDismissStartRideError={clearStartRideError}
            rideEdgeMessage={rideEdgeMessage}
            onDismissRideEdgeMessage={clearRideEdgeMessage}
            {...gpsRecoveryProps}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Compete">
        {() => (
          <CityHubScreen
            user={shellUser ? { username: shellUser.username ?? 'RIDER' } : null}
            onStartQuest={() => void handleStartRide()}
            onOpenClubs={() => navRef.current?.navigate('Clubs')}
            onOpenSegments={() => navRef.current?.navigate('Segments')}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Explore">
        {() => (
          <ExploreHubScreen
            onOpenMap={() => navRef.current?.navigate('ExploreMap')}
            onOpenMarketplace={() => navRef.current?.navigate('Marketplace')}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Profile">
        {() => (
          <AthleteProfileScreen
            user={shellUser ? { username: shellUser.username } : undefined}
            onLogout={onLogout}
            onTraining={() => navRef.current?.navigate('TrainingLog')}
            onSettings={() => navRef.current?.navigate('Settings')}
            onTrends={() => navRef.current?.navigate('PerformanceTrends')}
            onLeaderboard={() => navRef.current?.navigate('GlobalLeaderboard')}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Tracking" options={{ tabBarButton: () => null }}>
        {() => (
          <ActiveRideHUDScreen
            user={shellUser ?? undefined}
            isPaused={ridePaused}
            liveSpeed={liveSpeed}
            liveDistanceKm={liveDistanceKm}
            liveElevationGainM={liveElevationGainM}
            liveElapsedS={liveElapsedS}
            liveCoord={liveCoord}
            onPause={() => {
              setRidePaused(true);
              navRef.current?.navigate('RidePaused');
            }}
            onResume={() => setRidePaused(false)}
            onStop={() => void handleStopRide()}
            {...gpsRecoveryProps}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export function NavigationShell(props: NavigationShellProps) {
  const {
    user,
    isRecording,
    ridePaused,
    setRidePaused,
    liveSpeed,
    liveDistanceKm,
    liveElevationGainM,
    liveElapsedS,
    liveCoord,
    gpsRecoveryVisible,
    gpsRecoveryBusy,
    rideSummary,
    setRideSummary,
    startRideError,
    clearStartRideError,
    rideEdgeMessage,
    clearRideEdgeMessage,
    setRideEdgeMessage,
    onGpsRecoveryPress,
    onStartRide,
    onStopRide,
    onLogout,
  } = props;

  const shellUser = user as { username?: string; tenant_id?: string | null } | null;
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const shareCardRef = useRef<View>(null);
  const { t: mt } = useMobileI18n();
  useFrameBudgetMonitor(isRecording && !ridePaused);
  useMotionDegradeMonitor(isRecording && !ridePaused);

  useEffect(() => {
    if (!rideSummary) return;
    navRef.current?.navigate('RideSummary', rideSummary);
  }, [rideSummary]);

  const handleShareSummary = async () => {
    try {
      const history = await ActivityService.getHistory();
      const latest = history[0];
      if (!latest?.id) {
        setRideEdgeMessage({
          title: mt.errors.shareNoActivity,
          message: mt.errors.shareNoActivity,
          variant: 'warning',
        });
        return;
      }
      const shareData = await ActivityService.getShareData(latest.id);
      const message = [
        `Ride: ${shareData.type}`,
        `Distance: ${shareData.distance_km} km`,
        `Avg speed: ${shareData.avg_speed} km/h`,
        `Date: ${shareData.date}`,
      ].join('\n');
      const targetView = shareCardRef.current;
      if (targetView) {
        const uri = await captureRef(targetView, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        if (await Sharing.isAvailableAsync()) {
          trackEngagement('ride_summary_share', { activity_id: latest.id });
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Share ride result',
          });
          return;
        }
      }
      await Share.share({ title: '4VELO Ride', message });
      trackEngagement('ride_summary_share', { activity_id: latest.id, fallback: true });
    } catch {
      setRideEdgeMessage({
        title: mt.errors.shareFailed,
        message: mt.errors.shareFailed,
        variant: 'error',
      });
    }
  };

  return (
    <>
      <NavigationContainer ref={navRef} linking={mobileLinking}>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="MainTabs">
            {() => (
              <MainTabs
                user={user}
                isRecording={isRecording}
                ridePaused={ridePaused}
                setRidePaused={setRidePaused}
                liveSpeed={liveSpeed}
                liveDistanceKm={liveDistanceKm}
                liveElevationGainM={liveElevationGainM}
                liveElapsedS={liveElapsedS}
                liveCoord={liveCoord}
                gpsRecoveryVisible={gpsRecoveryVisible}
                gpsRecoveryBusy={gpsRecoveryBusy}
                onGpsRecoveryPress={onGpsRecoveryPress}
                onStartRide={onStartRide}
                onStopRide={onStopRide}
                onLogout={onLogout}
                navRef={navRef}
                startRideError={startRideError}
                clearStartRideError={clearStartRideError}
                rideEdgeMessage={rideEdgeMessage}
                clearRideEdgeMessage={clearRideEdgeMessage}
              />
            )}
          </Stack.Screen>
          <Stack.Screen
            name="Settings"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          >
            {({ navigation }: RootScreenProps<'Settings'>) => (
              <View style={{ flex: 1 }}>
                <StackScreenHeader title={mt.settings.title} onBack={() => navigation.goBack()} />
                <SettingsScreen embedded />
              </View>
            )}
          </Stack.Screen>
          <Stack.Screen name="TrainingLog">
            {({ navigation }: RootScreenProps<'TrainingLog'>) => (
              <View style={{ flex: 1 }}>
                <TrainingLogScreen
                  onBack={() => navigation.goBack()}
                  onOpenActivity={(id) => navigation.navigate('ActivityDetail', { activityId: id })}
                />
              </View>
            )}
          </Stack.Screen>
          <Stack.Screen
            name="GpsDiagnostics"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          >
            {({ navigation }: RootScreenProps<'GpsDiagnostics'>) => (
              <GpsDiagnosticsScreen onClose={() => navigation.goBack()} />
            )}
          </Stack.Screen>
          <Stack.Screen name="Clubs">
            {({ navigation }: RootScreenProps<'Clubs'>) => (
              <View style={{ flex: 1 }}>
                <StackScreenHeader title={mt.clubs.title} onBack={() => navigation.goBack()} />
                <ClubsDirectoryScreen />
              </View>
            )}
          </Stack.Screen>
          <Stack.Screen name="Segments">
            {({ navigation }: RootScreenProps<'Segments'>) => (
              <View style={{ flex: 1 }}>
                <StackScreenHeader title={mt.segments.title} onBack={() => navigation.goBack()} />
                <SegmentsScreen />
              </View>
            )}
          </Stack.Screen>
          <Stack.Screen name="ExploreMap">
            {({ navigation }: RootScreenProps<'ExploreMap'>) => (
              <View style={{ flex: 1 }}>
                <StackScreenHeader title={mt.explore.map} onBack={() => navigation.goBack()} />
                <ExploreMapScreen />
              </View>
            )}
          </Stack.Screen>
          <Stack.Screen name="Marketplace">
            {({ navigation }: RootScreenProps<'Marketplace'>) => (
              <View style={{ flex: 1 }}>
                <StackScreenHeader title={mt.marketplace.title} onBack={() => navigation.goBack()} />
                <MarketplaceScreen />
              </View>
            )}
          </Stack.Screen>
          <Stack.Screen name="ActivityDetail">
            {({ navigation, route }: RootScreenProps<'ActivityDetail'>) => (
              <View style={{ flex: 1 }}>
                <ActivityDetailScreen
                  activityId={route.params.activityId}
                  onBack={() => navigation.goBack()}
                />
              </View>
            )}
          </Stack.Screen>
          <Stack.Screen name="PerformanceTrends">
            {({ navigation }: RootScreenProps<'PerformanceTrends'>) => (
              <View style={{ flex: 1 }}>
                <StackScreenHeader title={mt.settings.trends} onBack={() => navigation.goBack()} />
                <PerformanceTrendsScreen />
              </View>
            )}
          </Stack.Screen>
          <Stack.Screen name="GlobalLeaderboard">
            {({ navigation }: RootScreenProps<'GlobalLeaderboard'>) => (
              <View style={{ flex: 1 }}>
                <StackScreenHeader title={mt.settings.globalLb} onBack={() => navigation.goBack()} />
                <GlobalLeaderboardScreen />
              </View>
            )}
          </Stack.Screen>
          <Stack.Screen
            name="RidePaused"
            options={{ presentation: 'transparentModal', animation: 'fade' }}
          >
            {({ navigation }: RootScreenProps<'RidePaused'>) => (
              <RidePausedScreen
                onResume={() => {
                  setRidePaused(false);
                  navigation.goBack();
                }}
                onStop={() => {
                  navigation.goBack();
                  setRidePaused(false);
                  void (async () => {
                    const result = await onStopRide();
                    if (result && 'navigated' in result && result.navigated) {
                      navRef.current?.navigate('MainTabs', { screen: result.target ?? 'Ride' });
                    }
                  })();
                }}
              />
            )}
          </Stack.Screen>
          <Stack.Screen
            name="RideSummary"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          >
            {({ navigation, route }: RootScreenProps<'RideSummary'>) => (
              <View ref={shareCardRef} style={{ flex: 1 }}>
                <RideSummaryScreen
                  distance={route.params.distanceKm}
                  elapsedSeconds={route.params.elapsedS}
                  elevation={route.params.elevationGainM}
                  username={shellUser?.username ?? 'RIDER'}
                  onShare={() => void handleShareSummary()}
                  onBackToHub={() => {
                    setRideSummary(null);
                    navigation.navigate('MainTabs', { screen: 'Ride' });
                  }}
                />
                {rideEdgeMessage ? (
                  <View style={{ position: 'absolute', top: 56, left: 0, right: 0, zIndex: 20 }}>
                    <EdgeStateBanner
                      title={rideEdgeMessage.title}
                      message={rideEdgeMessage.message}
                      variant={rideEdgeMessage.variant}
                      onDismiss={clearRideEdgeMessage}
                    />
                  </View>
                ) : null}
              </View>
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
