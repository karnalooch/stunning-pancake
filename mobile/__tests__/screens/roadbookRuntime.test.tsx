import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import * as Haptics from 'expo-haptics';
import { ActiveRideHUDScreen } from '../../src/screens/ActiveRideHUDScreen';
import { RideSummaryScreen } from '../../src/screens/RideSummaryScreen';
import type { RideFinishState } from '../../src/features/ride/model/RideFinishState';
import { buildSummaryShare, metricNumber, elapsedLabel } from '../../src/components/roadbook/summaryPresentation';
import { buildRouteGeometry, isMapCoordinate } from '../../src/map/routeGeometry';
import { parsePreferenceNumber } from '../../src/components/roadbook/preferencesInput';

jest.mock('react-native', () => ({ View: 'View', Text: 'Text', ScrollView: 'ScrollView', Pressable: 'Pressable' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-unistyles', () => ({ StyleSheet: { create: (factory: unknown) => typeof factory === 'function'
  ? factory({ colors: require('../../src/theme/grandPrix').grandPrixTheme.colors }) : factory } }));
jest.mock('../../src/components/product', () => ({ PrimaryButton: 'PrimaryButton', Metric: 'Metric' }));
jest.mock('../../src/components/RideMapView', () => ({ RideMapView: 'RideMapView' }));
jest.mock('../../src/components/GpsRecoveryBanner', () => ({ GpsRecoveryBanner: 'GpsRecoveryBanner' }));
jest.mock('../../src/components/ride/RideActionBar', () => ({ RideActionBar: 'RideActionBar' }));
jest.mock('../../src/components/ride/RideStatusBar', () => ({ RideStatusBar: 'RideStatusBar' }));
jest.mock('../../src/components/ride/RideNavigationHint', () => ({ RideNavigationHint: 'RideNavigationHint' }));
jest.mock('../../src/hooks/useBatteryPct', () => ({ useBatteryPct: () => 80 }));
jest.mock('../../src/services/VoiceCueService', () => ({ VoiceCueService: { setLanguage: jest.fn(), setEnabled: jest.fn(), speak: jest.fn() } }));
jest.mock('../../src/services/RiderPreferencesService', () => ({ RiderPreferencesService: { isVoiceCuesEnabled: () => false } }));
jest.mock('../../src/bootstrap/visionFixtures', () => ({ isVisionFixtures: () => false }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(async () => {}), NotificationFeedbackType: { Success: 'success' } }));
jest.mock('../../src/i18n/useI18n', () => ({ useI18n: () => ({ locale: 'pl', t: { gps: { recovery: 'GPS' }, ride: { paused: { title: 'Pauza' } } } }) }));

let tree: TestRenderer.ReactTestRenderer | undefined;
beforeEach(() => jest.clearAllMocks());
afterEach(() => { act(() => tree?.unmount()); tree = undefined; });
const host = (id: string) => tree!.root.find((node) => typeof node.type === 'string' && node.props.testID === id);
const hosts = (id: string) => tree!.root.findAll((node) => typeof node.type === 'string' && node.props.testID === id);
const summary = { distanceKm: 12.5, elapsedS: 3600, elevationGainM: 123 };

describe('Roadbook rendered session and summary behavior', () => {
  test('map/instrument toggling never invokes recording transitions and keeps current values', () => {
    const onPause = jest.fn(); const onResume = jest.fn(); const onStop = jest.fn();
    act(() => { tree = TestRenderer.create(<ActiveRideHUDScreen liveSpeed={10} liveDistanceKm={12.5} liveElapsedS={3600}
      onPause={onPause} onResume={onResume} onStop={onStop} />); });
    expect(host('ride-live-speed').props.children).toBe('36.0');
    for (let i = 0; i < 3; i++) {
      act(() => host('ride-view-instrument').props.onPress());
      expect(hosts('active-ride-map')).toHaveLength(0);
      act(() => host('ride-view-map').props.onPress());
      expect(hosts('active-ride-map')).toHaveLength(1);
    }
    expect(onPause).not.toHaveBeenCalled(); expect(onResume).not.toHaveBeenCalled(); expect(onStop).not.toHaveBeenCalled();
    expect(host('ride-live-time').props.children).toBe('1:00:00');
    expect(host('ride-view-map').props.accessibilityState.selected).toBe(true);
  });
  test('pause overlay follows authoritative props, retaining the same resume callback', () => {
    const onResume = jest.fn();
    act(() => { tree = TestRenderer.create(<ActiveRideHUDScreen isPaused onResume={onResume} />); });
    expect(hosts('ride-paused-screen')).toHaveLength(1);
    const bar = tree!.root.find((node) => node.type === ('RideActionBar' as unknown) && node.props.isPaused);
    act(() => bar.props.onResume());
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(hosts('ride-paused-screen')).toHaveLength(1);
    act(() => tree!.update(<ActiveRideHUDScreen isPaused={false} onResume={onResume} />));
    expect(hosts('ride-paused-screen')).toHaveLength(0);
  });
  test.each(['pending-finalization', 'recovery-required'] as const)('%s never exposes sharing or success feedback', (kind) => {
    const state: RideFinishState = kind === 'pending-finalization' ? { kind, summary, pendingUpload: 2 }
      : { kind, summary, reason: 'write-failed' };
    const onShare = jest.fn(); const onBackToHub = jest.fn();
    act(() => { tree = TestRenderer.create(<RideSummaryScreen finishState={state} onShare={onShare} onBackToHub={onBackToHub} />); });
    expect(hosts('ride-summary-share')).toHaveLength(0);
    expect(buildSummaryShare(state, 'pl')).toBeNull();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(hosts(`ride-summary-${kind}`)).toHaveLength(1);
    act(() => host('ride-summary-back-home').props.onPress());
    expect(onBackToHub).toHaveBeenCalledTimes(1); expect(onShare).not.toHaveBeenCalled();
  });
  test('durable result shares exactly its own payload, independent of history', () => {
    const state: RideFinishState = { kind: 'durable-success', summary };
    const onShare = jest.fn();
    act(() => { tree = TestRenderer.create(<RideSummaryScreen finishState={state} onShare={onShare} />); });
    act(() => host('ride-summary-share').props.onPress());
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    expect(buildSummaryShare(state, 'pl')?.message).toContain('12.5 km');
    expect(buildSummaryShare(state, 'pl')?.message).toContain('1:00:00');
    expect(buildSummaryShare(state, 'en')?.message).toContain('Elevation gain: 123 m');
  });
  test('pending to durable transition enables feedback once; ordinary rerenders do not repeat it', () => {
    const onShare = jest.fn();
    act(() => { tree = TestRenderer.create(<RideSummaryScreen finishState={{ kind: 'pending-finalization', summary, pendingUpload: 1 }} onShare={onShare} />); });
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    act(() => tree!.update(<RideSummaryScreen finishState={{ kind: 'durable-success', summary }} onShare={onShare} />));
    expect(hosts('ride-summary-share')).toHaveLength(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    act(() => tree!.update(<RideSummaryScreen finishState={{ kind: 'durable-success', summary: { ...summary } }} onShare={onShare} />));
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });
  test('recovery with no summary renders unknown rather than zero', () => {
    act(() => { tree = TestRenderer.create(<RideSummaryScreen finishState={{ kind: 'recovery-required', reason: 'relaunch' }} />); });
    expect(hosts('ride-summary-unknown-metrics')).toHaveLength(1);
    expect(host('ride-summary-time').props.value).toBe('—');
    expect(metricNumber(undefined)).toBe('—'); expect(metricNumber(NaN)).toBe('—');
    expect(elapsedLabel(Infinity)).toBe('—'); expect(metricNumber(0)).toBe('0.0');
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
});

describe('Geographic position and route truth', () => {
  test.each([[181, 0], [0, 91], [NaN, 20], [20, Infinity], null, [20]])('rejects invalid coordinate %p', (value) => { expect(isMapCoordinate(value)).toBe(false); });
  test('accepts zero and valid boundary positions', () => {
    expect(isMapCoordinate([0, 0])).toBe(true); expect(isMapCoordinate([-180, 90])).toBe(true);
  });
  test('does not draw a singleton or bridge a missing interval', () => {
    expect(buildRouteGeometry([[21, 52]])).toBeNull();
    expect(buildRouteGeometry([[21, 52], [22, 52], null, [24, 52], [25, 52]]))
      .toEqual({ type: 'MultiLineString', coordinates: [[[21, 52], [22, 52]], [[24, 52], [25, 52]]] });
  });
});
describe('Editable rider preferences', () => {
  test.each(['', ' ', '1e2', 'abc', '-60', '60kg', '201'])('rejects invalid weight %s without coercion', (text) => { expect(parsePreferenceNumber(text, 30, 200)).toBeNull(); });
  test('accepts decimal commas for weight and requires integer maximum heart rate', () => {
    expect(parsePreferenceNumber(' 72,5 ', 30, 200)).toBe(72.5);
    expect(parsePreferenceNumber('180.5', 100, 230, true)).toBeNull();
    expect(parsePreferenceNumber('180', 100, 230, true)).toBe(180);
  });
});
