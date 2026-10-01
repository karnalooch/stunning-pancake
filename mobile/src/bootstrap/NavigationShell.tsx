import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Share, View } from 'react-native';
import { NavigationContainer, type NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { UserProfile } from '@4velo/api-client';
import { ProductTabBar } from '../navigation/ProductTabBar';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { mobileLinking } from '../navigation/linking';
import { RideDashboardScreen } from '../screens/RideDashboardScreen';
import { StartRideScreen } from '../screens/StartRideScreen';
import { CityHubScreen } from '../screens/CityHubScreen';
import { AthleteProfileScreen } from '../screens/AthleteProfileScreen';
import { ActiveRideHUDScreen } from '../screens/ActiveRideHUDScreen';
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
import { VisionGalleryScreen } from '../screens/VisionGalleryScreen';
import { StackScreenHeader } from '../components/navigation/StackScreenHeader';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import { buildSummaryShare } from '../components/roadbook/summaryPresentation';
import { isVisionFixtures, setVisionHomePreviewState, setVisionRideFinishKind,
  VISION_HOME_PREVIEW_STATES, VISION_RIDE_FINISH_KINDS } from './visionFixtures';
import { useI18n } from '../i18n/useI18n';
import { useFrameBudgetMonitor } from '../hooks/useFrameBudgetMonitor';
import { useMotionDegradeMonitor } from '../hooks/useMotionDegrade';
import type { ActivitySportType } from '../services/api';
import type { RideEdgeMessage } from '../services/apiRetry';
import { trackEngagement } from '../services/EngagementAnalytics';
import { createRideStartCommand } from './rideStartCommand';
import type { RideFinishState } from '../features/ride/model/RideFinishState';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

export type NavigationShellProps = {
  user: (UserProfile & { username?: string; tenant_id?: string | null }) | Record<string, unknown>;
  isRecording: boolean;
  ridePaused: boolean;
  onPauseRide: () => Promise<boolean>;
  onResumeRide: () => Promise<boolean>;
  liveSpeed: number;
  liveDistanceKm: number;
  liveElevationGainM: number;
  liveElapsedS: number;
  liveCoord: [number, number] | null;
  gpsRecoveryVisible: boolean;
  gpsRecoveryBusy: boolean;
  rideFinishState: RideFinishState | null;
  setRideFinishState: (v: RideFinishState | null) => void;
  startRideError: string | null;
  clearStartRideError: () => void;
  rideEdgeMessage: RideEdgeMessage | null;
  clearRideEdgeMessage: () => void;
  setRideEdgeMessage: (msg: RideEdgeMessage | null) => void;
  onGpsRecoveryPress: () => void;
  onStartRide: (activityType?: ActivitySportType, eventId?: number) => Promise<boolean>;
  onStopRide: () => Promise<{ navigated: boolean; target?: 'Today' } | void>;
  onLogout: () => void;
};
type MainTabsProps = {
  data: NavigationShellProps;
  navRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
};
function MainTabs({ data: p, navRef }: MainTabsProps) {
  const user = p.user as { username?: string; tenant_id?: string | null; tenant_name?: string | null };
  return <Tab.Navigator initialRouteName="Today" tabBar={(props) => <ProductTabBar {...props} />}
    screenOptions={{ headerShown: false }}>
    <Tab.Screen name="Today">{() => <RideDashboardScreen
      user={{ username: user.username ?? 'RIDER', tenant_id: user.tenant_id ?? undefined, tenant_name: user.tenant_name ?? undefined }}
      isRecording={p.isRecording} liveSpeed={p.liveSpeed * 3.6} liveDistance={p.liveDistanceKm}
      onOpenStartRide={() => navRef.current?.navigate('StartRide')}
      onGoToRide={() => navRef.current?.navigate('Tracking')}
      onOpenSettings={() => navRef.current?.navigate('Settings')}
      onOpenActivity={(activityId) => navRef.current?.navigate('ActivityDetail', { activityId })}
      rideEdgeMessage={p.rideEdgeMessage} onDismissRideEdgeMessage={p.clearRideEdgeMessage} />}</Tab.Screen>
    <Tab.Screen name="Discover">{() => <ExploreMapScreen
      onOpenMarketplace={() => navRef.current?.navigate('Marketplace')} />}</Tab.Screen>
    <Tab.Screen name="Club">{() => <CityHubScreen user={{ username: user.username ?? 'RIDER' }}
      onOpenStartRide={() => navRef.current?.navigate('StartRide')}
      onOpenLeaderboard={() => navRef.current?.navigate('GlobalLeaderboard')}
      onOpenClubs={() => navRef.current?.navigate('Clubs')}
      onOpenSegments={() => navRef.current?.navigate('Segments')} />}</Tab.Screen>
    <Tab.Screen name="You">{() => <AthleteProfileScreen user={{ username: user.username }}
      onLogout={p.onLogout} onTraining={() => navRef.current?.navigate('TrainingLog')}
      onSettings={() => navRef.current?.navigate('Settings')}
      onTrends={() => navRef.current?.navigate('PerformanceTrends')} />}</Tab.Screen>
  </Tab.Navigator>;
}

/** The ride controller lives above navigation. A map/tab/theme switch does not own its lifecycle. */
export function NavigationShell(props: NavigationShellProps) {
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const { t: mt, locale } = useI18n();
  const { isRecording, ridePaused, onStartRide, onStopRide, rideFinishState, setRideFinishState } = props;
  useFrameBudgetMonitor(isRecording && !ridePaused);
  useMotionDegradeMonitor(isRecording && !ridePaused);

  const startInputs = useRef({ onStartRide });
  useLayoutEffect(() => { startInputs.current = { onStartRide }; }, [onStartRide]);
  const startCommand = useRef<ReturnType<typeof createRideStartCommand> | null>(null);
  const handleStartRide = useCallback((sport: ActivitySportType = 'BIKE', eventId?: number) => {
    if (startCommand.current === null) {
      startCommand.current = createRideStartCommand(
        (nextSport, nextEventId) => startInputs.current.onStartRide(nextSport, nextEventId),
        () => navRef.current?.navigate('Tracking'),
      );
    }
    return startCommand.current(sport, eventId);
  }, []);
  const showFinish = useCallback(() => {
    if (rideFinishState && navRef.current?.isReady()) navRef.current.navigate('RideSummary', rideFinishState);
  }, [rideFinishState]);
  useEffect(showFinish, [showFinish]);
  const goHome = () => navRef.current?.navigate('MainTabs', { screen: 'Today' });
  const handleStopRide = async () => {
    const result = await onStopRide();
    if (result?.navigated) navRef.current?.navigate('MainTabs', { screen: result.target ?? 'Today' });
  };
  const handleShareSummary = async (state: RideFinishState) => {
    const payload = buildSummaryShare(state, locale);
    if (!payload) return;
    try {
      const result = await Share.share(payload);
      if (result.action === Share.sharedAction) trackEngagement('ride_summary_share', { source: 'displayed-summary' });
    } catch {
      props.setRideEdgeMessage({ title: mt.errors.shareFailed, message: mt.errors.shareFailed, variant: 'error' });
    }
  };
  const preparation = <StartRideScreen isRecording={isRecording} onStartRide={handleStartRide}
    onGoToRide={() => navRef.current?.navigate('Tracking')}
    onOpenGpsWizard={() => navRef.current?.navigate('GpsDiagnostics')}
    gpsRecoveryVisible={props.gpsRecoveryVisible} gpsRecoveryBusy={props.gpsRecoveryBusy}
    onGpsRecoveryPress={props.onGpsRecoveryPress} startRideError={props.startRideError}
    onDismissStartRideError={props.clearStartRideError} rideEdgeMessage={props.rideEdgeMessage}
    onDismissRideEdgeMessage={props.clearRideEdgeMessage} />;
  return <NavigationContainer ref={navRef} linking={mobileLinking} onReady={showFinish}>
    <Stack.Navigator initialRouteName="MainTabs" screenOptions={{ headerShown: false, animation: 'none' }}>
      <Stack.Screen name="MainTabs">{() => <MainTabs data={props} navRef={navRef} />}</Stack.Screen>
      <Stack.Screen name="StartRide">{({ navigation }) => <View style={{ flex: 1 }}>
        <StackScreenHeader title={mt.dashboard.startRide} onBack={() => navigation.canGoBack() ? navigation.goBack() : goHome()} />
        {preparation}</View>}</Stack.Screen>
      <Stack.Screen name="Tracking" options={{ gestureEnabled: false }}>{() => isRecording ? <ActiveRideHUDScreen
        user={props.user} isPaused={ridePaused} liveSpeed={props.liveSpeed} liveDistanceKm={props.liveDistanceKm}
        liveElevationGainM={props.liveElevationGainM} liveElapsedS={props.liveElapsedS} liveCoord={props.liveCoord}
        onPause={props.onPauseRide} onResume={props.onResumeRide} onStop={handleStopRide} onOpenHub={goHome}
        gpsRecoveryVisible={props.gpsRecoveryVisible} gpsRecoveryBusy={props.gpsRecoveryBusy}
        onGpsRecoveryPress={props.onGpsRecoveryPress} /> : <View style={{ flex: 1 }}>
          <StackScreenHeader title={mt.dashboard.startRide} onBack={goHome} />{preparation}</View>}</Stack.Screen>
      <Stack.Screen name="Settings">{({ navigation }) => <View style={{ flex: 1 }}>
        <StackScreenHeader title={mt.settings.title} onBack={() => navigation.goBack()} /><SettingsScreen embedded />
      </View>}</Stack.Screen>
      <Stack.Screen name="TrainingLog">{({ navigation }) => <TrainingLogScreen onBack={() => navigation.goBack()}
        onOpenActivity={(id) => navigation.navigate('ActivityDetail', { activityId: id })} />}</Stack.Screen>
      <Stack.Screen name="GpsDiagnostics">{({ navigation }) => <GpsDiagnosticsScreen onClose={() => navigation.goBack()} />}</Stack.Screen>
      <Stack.Screen name="Clubs">{({ navigation }) => <View style={{ flex: 1 }}>
        <StackScreenHeader title={mt.clubs.title} onBack={() => navigation.goBack()} /><ClubsDirectoryScreen />
      </View>}</Stack.Screen>
      <Stack.Screen name="Segments">{({ navigation }) => <View style={{ flex: 1 }}>
        <StackScreenHeader title={mt.segments.title} onBack={() => navigation.goBack()} /><SegmentsScreen />
      </View>}</Stack.Screen>
      <Stack.Screen name="ExploreMap">{({ navigation }) => <View style={{ flex: 1 }}>
        <StackScreenHeader title={mt.explore.map} onBack={() => navigation.goBack()} /><ExploreMapScreen />
      </View>}</Stack.Screen>
      <Stack.Screen name="Marketplace">{({ navigation }) => <View style={{ flex: 1 }}>
        <StackScreenHeader title={mt.marketplace.title} onBack={() => navigation.goBack()} /><MarketplaceScreen />
      </View>}</Stack.Screen>
      <Stack.Screen name="ActivityDetail">{({ navigation, route }) => <ActivityDetailScreen
        activityId={route.params.activityId} onBack={() => navigation.goBack()} />}</Stack.Screen>
      <Stack.Screen name="PerformanceTrends">{({ navigation }) => <View style={{ flex: 1 }}>
        <StackScreenHeader title={mt.settings.trends} onBack={() => navigation.goBack()} /><PerformanceTrendsScreen />
      </View>}</Stack.Screen>
      <Stack.Screen name="GlobalLeaderboard">{({ navigation }) => <View style={{ flex: 1 }}>
        <StackScreenHeader title={mt.settings.globalLb} onBack={() => navigation.goBack()} /><GlobalLeaderboardScreen />
      </View>}</Stack.Screen>
      <Stack.Screen name="RideSummary" options={{ gestureEnabled: false }}>{({ route }) => <View style={{ flex: 1 }}>
        <RideSummaryScreen finishState={route.params} onShare={() => void handleShareSummary(route.params)}
          onBackToHub={() => { setRideFinishState(null); goHome(); }} />
        {props.rideEdgeMessage ? <EdgeStateBanner title={props.rideEdgeMessage.title} message={props.rideEdgeMessage.message}
          variant={props.rideEdgeMessage.variant} onDismiss={props.clearRideEdgeMessage} /> : null}
      </View>}</Stack.Screen>
      {(isVisionFixtures() || __DEV__) && <Stack.Screen name="VisionGallery">{({ navigation }) => <View style={{ flex: 1 }}>
        <StackScreenHeader title="Vision Gallery" onBack={() => navigation.goBack()} />
        <VisionGalleryScreen entries={[
          { label: 'Today', onPress: () => { setVisionHomePreviewState('default'); goHome(); } },
          ...(isVisionFixtures() ? VISION_HOME_PREVIEW_STATES.map((state) => ({ label: `Home — ${state}`,
            onPress: () => { setVisionHomePreviewState(state); goHome(); } })) : []),
          { label: 'Club', onPress: () => navigation.navigate('MainTabs', { screen: 'Club' }) },
          { label: 'Discover', onPress: () => navigation.navigate('MainTabs', { screen: 'Discover' }) },
          { label: 'Start Ride', onPress: () => navigation.navigate('StartRide') },
          { label: 'You', onPress: () => navigation.navigate('MainTabs', { screen: 'You' }) },
          { label: 'Trends', onPress: () => navigation.navigate('PerformanceTrends') },
          { label: 'Leaderboard', onPress: () => navigation.navigate('GlobalLeaderboard') },
          { label: 'Training Log', onPress: () => navigation.navigate('TrainingLog') },
          { label: 'Marketplace', onPress: () => navigation.navigate('Marketplace') },
          { label: 'Segments', onPress: () => navigation.navigate('Segments') },
          { label: 'Clubs', onPress: () => navigation.navigate('Clubs') },
          { label: 'Explore Map', onPress: () => navigation.navigate('ExploreMap') },
          { label: 'GPS Diagnostics', onPress: () => navigation.navigate('GpsDiagnostics') },
          { label: 'Settings', onPress: () => navigation.navigate('Settings') },
          ...(isVisionFixtures() ? VISION_RIDE_FINISH_KINDS.flatMap((kind) => {
            const summary = { distanceKm: 12.4, elapsedS: 2730, elevationGainM: 145 };
            const finishState: RideFinishState = kind === 'durable-success' ? { kind, summary }
              : kind === 'pending-finalization' ? { kind, summary, pendingUpload: 1 }
                : { kind, summary, reason: 'Vision recovery-required finish' };
            return [
              { label: `Ride flow finish — ${kind}`, onPress: () => { setVisionRideFinishKind(kind); goHome(); } },
              { label: `Summary — ${kind}`, onPress: () => navigation.navigate('RideSummary', finishState) },
            ];
          }) : []),
        ]} />
      </View>}</Stack.Screen>}
    </Stack.Navigator>
  </NavigationContainer>;
}
