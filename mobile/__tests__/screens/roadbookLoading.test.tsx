import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AthleteProfileScreen } from '../../src/screens/AthleteProfileScreen';
import { CityHubScreen } from '../../src/screens/CityHubScreen';
import { ExploreMapScreen } from '../../src/screens/ExploreMapScreen';
import { OnboardingScreen } from '../../src/screens/OnboardingScreen';
import { SettingsScreen } from '../../src/screens/SettingsScreen';
import { stringsPl } from '../../src/i18n/strings.pl';

// Render the real screen logic; native widgets and I/O are the test boundaries.
jest.mock('react-native', () => ({ View: 'View', Text: 'Text', TextInput: 'TextInput',
  ScrollView: 'ScrollView', Pressable: 'Pressable', Modal: 'Modal', Switch: 'Switch',
  Alert: { alert: jest.fn() }, Linking: { openURL: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-unistyles', () => ({
  StyleSheet: { create: (factory: unknown) => typeof factory === 'function'
    ? factory({ colors: require('../../src/theme/grandPrix').grandPrixTheme.colors }) : factory },
  useUnistyles: () => ({ theme: { colors: require('../../src/theme/grandPrix').grandPrixTheme.colors } }),
}));
jest.mock('@maplibre/maplibre-react-native', () => ({ Map: 'Map', Camera: 'Camera', GeoJSONSource: 'GeoJSONSource', Layer: 'Layer' }));
jest.mock('../../src/map/mapStyle', () => ({ resolveRideMapStyle: () => ({ version: 8, sources: {}, layers: [] }) }));
jest.mock('../../src/components/product', () => ({ PrimaryButton: 'PrimaryButton', Metric: 'Metric' }));
jest.mock('../../src/components/roadbook/Surface', () => ({
  RoadbookPage: 'RoadbookPage', RoadbookSection: 'RoadbookSection', RoadbookRow: 'RoadbookRow', roadbookStyles: {},
  RoadbookNotice: ({ action, ...props }: { action?: React.ReactNode; [key: string]: unknown }) =>
    require('react').createElement('RoadbookNotice', props, action),
}));
jest.mock('../../src/components/ui/SkeletonBlock', () => ({ SkeletonBlock: 'SkeletonBlock' }));
jest.mock('../../src/components/appearance/AppearanceSettingsPanel', () => ({ AppearanceSettingsPanel: 'AppearanceSettingsPanel' }));
jest.mock('../../src/bootstrap/visionFixtures', () => ({ isVisionFixtures: () => false,
  getVisionProfileFixture: () => null, getVisionCityHubFixture: () => null }));
jest.mock('../../src/hooks/useGameProgress', () => ({ useGameProgress: () => ({ level: 1, xpBar: { current: 0, max: 100 } }) }));
jest.mock('../../src/hooks/useRiderStats', () => ({ useRiderStats: () => ({ rides: 0, distanceKm: 0, verified: 0,
  streakDays: 0, loading: false, offline: false, error: false, refresh: jest.fn() }) }));
jest.mock('../../src/hooks/useImmersiveTheme', () => ({ useImmersiveTheme: () => ({ enabled: false, toggle: jest.fn() }) }));
jest.mock('../../src/i18n/useI18n', () => ({ useI18n: () => ({ locale: 'pl',
  t: require('../../src/i18n/strings.pl').stringsPl, toggleLocale: jest.fn() }) }));
jest.mock('expo-location', () => ({ getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(), requestBackgroundPermissionsAsync: jest.fn() }));
jest.mock('../../src/services/RiderPreferencesService', () => ({ RiderPreferencesService: {
  getWeightKg: () => 75, getMaxHr: () => 190, isHapticsEnabled: () => true, isVoiceCuesEnabled: () => false,
  setWeightKg: jest.fn(), setMaxHr: jest.fn(), setHapticsEnabled: jest.fn(), setVoiceCuesEnabled: jest.fn(),
} }));
jest.mock('../../src/services/api', () => ({
  AuthService: { getProfile: jest.fn(), getPublicTenants: jest.fn(), updateProfile: jest.fn() },
  ActivityService: { getCityHubSummary: jest.fn() }, POIService: { getPOIs: jest.fn() },
  DepartmentService: { getTree: jest.fn(), selfJoin: jest.fn() }, EventService: { list: jest.fn(), join: jest.fn() },
  WearableService: { getStatus: jest.fn(), getStravaAuthUrl: jest.fn(), getGarminAuthUrl: jest.fn(), sync: jest.fn() },
  PrivacyService: { getZones: jest.fn() },
}));
jest.mock('../../src/services/OfflineCacheService', () => ({ OfflineCacheService: { getCityHub: jest.fn(), setCityHub: jest.fn() } }));
jest.mock('../../src/services/apiRetry', () => ({
  ...jest.requireActual('../../src/services/apiRetry'),
  // Retry timing belongs to apiRetry tests; keep the real transport/auth classifier.
  withRetry: (read: () => Promise<unknown>) => read(),
}));

type ApiMocks = {
  AuthService: { getProfile: jest.Mock; getPublicTenants: jest.Mock; updateProfile: jest.Mock };
  ActivityService: { getCityHubSummary: jest.Mock }; POIService: { getPOIs: jest.Mock };
  WearableService: { getStatus: jest.Mock; sync: jest.Mock }; PrivacyService: { getZones: jest.Mock };
};
const api = jest.requireMock('../../src/services/api') as ApiMocks;
const cache = (jest.requireMock('../../src/services/OfflineCacheService') as {
  OfflineCacheService: { getCityHub: jest.Mock; setCityHub: jest.Mock };
}).OfflineCacheService;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const citySummary = (name: string) => ({ active_event: null,
  city_of_week: { tenant_id: 'city', name, score_km: 12 }, city_wars: null,
  leaderboard: [], my_rank: null, quests: [] });
const poi = (id: number, name: string) => ({ id, name, longitude: 21, latitude: 52, category: 'PLACE' });
let tree: TestRenderer.ReactTestRenderer | undefined;
const hosts = (id: string) => tree!.root.findAll((node) => typeof node.type === 'string' && node.props.testID === id);
const host = (id: string) => tree!.root.find((node) => typeof node.type === 'string' && node.props.testID === id);
const text = () => tree!.root.findAll((node) => node.type === ('Text' as unknown)).map((node) => node.props.children).flat().join(' ');
async function mount(element: React.ReactElement) { await act(async () => { tree = TestRenderer.create(element); }); }
beforeEach(() => { jest.resetAllMocks(); cache.getCityHub.mockReturnValue(null); });
afterEach(() => { act(() => tree?.unmount()); tree = undefined; });

describe('Roadbook asynchronous loading and response ownership', () => {
  test('profile starts loading and publishes the real API completion', async () => {
    const result = deferred<unknown>();
    api.AuthService.getProfile.mockReturnValue(result.promise);
    await mount(<AthleteProfileScreen />);
    expect(api.AuthService.getProfile).toHaveBeenCalledTimes(1);
    expect(text()).toContain(stringsPl.profile.profileLoading);
    expect(hosts('profile-load-error')).toHaveLength(0);
    await act(async () => { result.resolve({ username: 'Rider', email: 'rider@example.test' }); });
    expect(text()).toContain('rider@example.test');
    expect(text()).not.toContain(stringsPl.profile.profileLoading);
  });

  test('profile retry owns loading until its latest response, ignoring an older failure', async () => {
    api.AuthService.getProfile.mockRejectedValueOnce(new Error('first failure'));
    await mount(<AthleteProfileScreen />);
    const retry = host('profile-retry').props.onPress;
    const older = deferred<unknown>(); const latest = deferred<unknown>();
    api.AuthService.getProfile.mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
    act(() => { retry(); retry(); });
    await act(async () => { older.reject(new Error('stale failure')); });
    expect(hosts('profile-load-error')).toHaveLength(0);
    expect(text()).toContain(stringsPl.profile.profileLoading);
    await act(async () => { latest.resolve({ username: 'Latest', email: 'latest@example.test' }); });
    expect(text()).toContain('latest@example.test');
    expect(text()).not.toContain(stringsPl.profile.profileLoading);
  });

  test('Discover keeps initial loading distinct from empty and validates response coordinates', async () => {
    const result = deferred<unknown>();
    api.POIService.getPOIs.mockReturnValue(result.promise);
    await mount(<ExploreMapScreen />);
    expect(hosts('explore-poi-loading')).toHaveLength(1);
    expect(hosts('explore-poi-empty')).toHaveLength(0);
    await act(async () => { result.resolve({ results: [poi(1, 'Valid'), poi(1, 'Duplicate'), { ...poi(2, 'Invalid'), latitude: 91 }] }); });
    expect(hosts('explore-poi-loading')).toHaveLength(0);
    expect(hosts('explore-poi-error')).toHaveLength(0);
    expect(hosts('explore-poi-1')).toHaveLength(1);
    expect(hosts('explore-poi-2')).toHaveLength(0);
  });

  test('Discover retry recovers and an older success cannot overwrite the newest places', async () => {
    api.POIService.getPOIs.mockRejectedValueOnce(new Error('offline'));
    await mount(<ExploreMapScreen />);
    const retry = host('explore-poi-retry').props.onPress;
    const older = deferred<unknown>(); const latest = deferred<unknown>();
    api.POIService.getPOIs.mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
    act(() => { retry(); retry(); });
    await act(async () => { latest.resolve([poi(2, 'New')]); });
    await act(async () => { older.resolve([poi(1, 'Old')]); });
    expect(hosts('explore-poi-2')).toHaveLength(1);
    expect(hosts('explore-poi-1')).toHaveLength(0);
    expect(hosts('explore-poi-error')).toHaveLength(0);
    expect(hosts('explore-poi-loading')).toHaveLength(0);
  });

  test('onboarding retry restores tenant choices without writing membership during loading', async () => {
    api.AuthService.getPublicTenants.mockRejectedValueOnce(new Error('unavailable'));
    await mount(<OnboardingScreen user={null} onFinish={jest.fn()} />);
    expect(host('onboarding-city-next').props.disabled).toBe(true);
    const retry = tree!.root.find((node) => node.type === ('PrimaryButton' as unknown) && node.props.label === stringsPl.common.retry);
    const result = deferred<unknown>();
    api.AuthService.getPublicTenants.mockReturnValueOnce(result.promise);
    act(() => retry.props.onPress());
    expect(host('onboarding-city-next').props.disabled).toBe(true);
    await act(async () => { result.resolve([{ id: 'city', name: 'Test city' }]); });
    expect(host('onboarding-city-next').props.disabled).toBe(false);
    expect(api.AuthService.updateProfile).not.toHaveBeenCalled();
  });

  test('settings waits for both reads and independently recovers wearable and privacy failures', async () => {
    const wearables = deferred<unknown>(); const privacy = deferred<unknown>();
    api.WearableService.getStatus.mockReturnValueOnce(wearables.promise);
    api.PrivacyService.getZones.mockReturnValueOnce(privacy.promise);
    await mount(<SettingsScreen />);
    expect(host('settings-refresh-status').props.disabled).toBe(true);
    await act(async () => { wearables.reject(new Error('wearable unavailable')); });
    expect(host('settings-refresh-status').props.disabled).toBe(true);
    await act(async () => { privacy.resolve([]); });
    expect(hosts('settings-wearable-error')).toHaveLength(1);
    expect(hosts('settings-privacy-error')).toHaveLength(0);
    expect(host('settings-strava-status').props.detail).not.toBe(stringsPl.settings.notConnected);
    expect(host('settings-refresh-status').props.disabled).toBe(false);
    api.WearableService.getStatus.mockResolvedValueOnce({ strava: { connected: false }, garmin: { connected: true } });
    api.PrivacyService.getZones.mockRejectedValueOnce(new Error('privacy unavailable'));
    await act(async () => { host('settings-refresh-status').props.onPress(); });
    expect(hosts('settings-wearable-error')).toHaveLength(0);
    expect(hosts('settings-privacy-error')).toHaveLength(1);
    expect(host('settings-strava-status').props.detail).toBe(stringsPl.settings.notConnected);
    expect(host('settings-garmin-status').props.detail).toBe(stringsPl.settings.connected);
  });

  test.each([401, 403])('Club never presents cached data as an offline fallback after HTTP %s', async (status) => {
    cache.getCityHub.mockReturnValue(citySummary('Cached'));
    api.ActivityService.getCityHubSummary.mockRejectedValue({ isAxiosError: true, response: { status } });
    await mount(<CityHubScreen />);
    expect(hosts('club-load-error')).toHaveLength(1);
    expect(hosts('club-cached-state')).toHaveLength(0);
    expect(hosts('club-city-of-week')).toHaveLength(0);
    expect(cache.setCityHub).not.toHaveBeenCalled();
  });

  test('Club retains an explicit cached-offline state for a transport failure and clears it after retry', async () => {
    cache.getCityHub.mockReturnValue(citySummary('Cached'));
    api.ActivityService.getCityHubSummary.mockRejectedValueOnce({ isAxiosError: true });
    await mount(<CityHubScreen />);
    expect(host('club-cached-state').props.title).toBe(stringsPl.compete.cachedOfflineTitle);
    expect(hosts('club-city-of-week')).toHaveLength(1);
    const live = citySummary('Fresh');
    api.ActivityService.getCityHubSummary.mockResolvedValueOnce(live);
    await act(async () => { host('club-retry').props.onPress(); });
    expect(hosts('club-load-error')).toHaveLength(0);
    expect(hosts('club-cached-state')).toHaveLength(0);
    expect(cache.setCityHub).toHaveBeenCalledTimes(1);
    expect(cache.setCityHub).toHaveBeenCalledWith(live);
  });

  test('an unmounted Club request cannot update persistent cache', async () => {
    const result = deferred<unknown>();
    api.ActivityService.getCityHubSummary.mockReturnValue(result.promise);
    await mount(<CityHubScreen />);
    act(() => { tree!.unmount(); tree = undefined; });
    await act(async () => { result.resolve(citySummary('Stale')); });
    expect(cache.setCityHub).not.toHaveBeenCalled();
  });
});
