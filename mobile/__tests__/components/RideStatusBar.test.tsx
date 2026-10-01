import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { RideStatusBar } from '../../src/components/ride/RideStatusBar';
import { getAppCopy } from '../../src/components/roadbook/appCopy';
import { stringsPl } from '../../src/i18n/strings.pl';

jest.mock('react-native-unistyles', () => {
  const { grandPrixTheme } = jest.requireActual('../../src/theme/grandPrix');
  return { StyleSheet: { create: (factory: unknown) => typeof factory === 'function' ? factory(grandPrixTheme) : factory },
    useUnistyles: () => ({ theme: grandPrixTheme }) };
});
jest.mock('../../src/i18n/useI18n', () => ({ useI18n: () => ({ locale: 'pl', t: require('../../src/i18n/strings.pl').stringsPl }) }));
const copy = getAppCopy('pl');
let tree: TestRenderer.ReactTestRenderer | undefined;
const flattenText = (value: unknown): string => Array.isArray(value) ? value.map(flattenText).join('') : value == null ? '' : String(value);
const text = () => tree!.root.findAllByType(Text).map((node) => flattenText(node.props.children));
afterEach(() => { act(() => tree?.unmount()); tree = undefined; jest.useRealTimers(); });

describe('RideStatusBar', () => {
  test('unknown battery is not zero and location does not claim recorder readiness', () => {
    act(() => { tree = TestRenderer.create(<RideStatusBar gpsLocked batteryPct={null} />); });
    expect(text()).toContain(copy.location);
    expect(text()).toContain(`${stringsPl.ride.status.battery} —`);
    expect(tree!.root.findAllByType(Text).some((node) => node.props.accessibilityHint === copy.locationNote)).toBe(true);
  });
  test('missing location remains explicit and battery bounds are clamped', () => {
    act(() => { tree = TestRenderer.create(<RideStatusBar gpsLocked={false} batteryPct={145.8} />); });
    expect(text()).toContain(copy.locationUnknown);
    expect(text()).toContain(`${stringsPl.ride.status.battery} 100%`);
    act(() => { tree!.update(<RideStatusBar gpsLocked={false} batteryPct={-6.2} />); });
    expect(text()).toContain(`${stringsPl.ride.status.battery} 0%`);
  });
  test.each([NaN, Infinity])('non-finite battery %s is unknown', (battery) => {
    act(() => { tree = TestRenderer.create(<RideStatusBar gpsLocked={false} batteryPct={battery} clockText="10:24" />); });
    expect(text()).toContain(`${stringsPl.ride.status.battery} —`);
  });
  test('fixture clock never starts a timer and live clock cleanup survives switching to a fixture', () => {
    jest.useFakeTimers();
    act(() => { tree = TestRenderer.create(<RideStatusBar gpsLocked clockText="10:24" />); });
    expect(jest.getTimerCount()).toBe(0);
    act(() => jest.advanceTimersByTime(120_000));
    expect(text()).toContain('10:24');
    act(() => { tree!.update(<RideStatusBar gpsLocked />); });
    expect(jest.getTimerCount()).toBe(1);
    act(() => { tree!.update(<RideStatusBar gpsLocked clockText="11:11" />); });
    expect(jest.getTimerCount()).toBe(0);
    expect(text()).toContain('11:11');
  });
});
