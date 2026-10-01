import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { StartRideScreen, type StartRideScreenProps } from '../../src/screens/StartRideScreen';
import { ACTIVITY_SPORT_OPTIONS } from '../../src/types/activitySport';

jest.mock('react-native', () => ({ View: 'View', Text: 'Text', ScrollView: 'ScrollView' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-unistyles', () => ({
  StyleSheet: { create: (factory: (theme: unknown) => unknown) => factory({
    colors: require('../../src/theme/grandPrix').grandPrixTheme.colors,
  }) },
}));
jest.mock('../../src/components/product', () => ({ PrimaryButton: 'PrimaryButton', SportChip: 'SportChip' }));
jest.mock('../../src/components/DevEnvironmentBanner', () => ({ DevEnvironmentBanner: 'DevEnvironmentBanner' }));
jest.mock('../../src/components/GpsRecoveryBanner', () => ({ GpsRecoveryBanner: 'GpsRecoveryBanner' }));
jest.mock('../../src/components/ui/EdgeStateBanner', () => ({ EdgeStateBanner: 'EdgeStateBanner' }));
jest.mock('../../src/i18n/useI18n', () => ({ useI18n: () => ({ locale: 'pl', t: {
  errors: { startRide: 'Nie udało się rozpocząć jazdy.' },
  dashboard: { gpsWizard: 'Diagnostyka GPS', goToRide: 'Wróć do jazdy', startingRide: 'Uruchamianie', startRide: 'Rozpocznij jazdę' },
} }) }));

let tree: TestRenderer.ReactTestRenderer | undefined;
function mount(overrides: Partial<StartRideScreenProps> = {}) {
  const props: StartRideScreenProps = {
    isRecording: false, onStartRide: jest.fn(async () => {}),
    onGoToRide: jest.fn(), onOpenGpsWizard: jest.fn(), ...overrides,
  };
  act(() => { tree = TestRenderer.create(<StartRideScreen {...props} />); });
  return { tree: tree!, props };
}
afterEach(() => { act(() => { tree?.unmount(); }); tree = undefined; });

describe('Roadbook start screen behavior', () => {
  test('blocks repeated presses synchronously and remains busy until start resolves', async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((done) => { resolve = done; });
    const start = jest.fn(() => pending);
    const { tree } = mount({ onStartRide: start });
    const press = tree.root.findByProps({ testID: 'start-ride-primary' }).props.onPress;
    act(() => { press(); press(); });
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith('BIKE');
    expect(tree.root.findByProps({ testID: 'start-ride-primary' }).props.disabled).toBe(true);
    await act(async () => { resolve(); await pending; });
    expect(tree.root.findByProps({ testID: 'start-ride-primary' }).props.disabled).toBe(false);
  });

  test('reports rejection and allows retry without an unhandled promise', async () => {
    const start = jest.fn<Promise<void>, [Parameters<StartRideScreenProps['onStartRide']>[0]]>()
      .mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    const { tree } = mount({ onStartRide: start });
    await act(async () => { tree.root.findByProps({ testID: 'start-ride-primary' }).props.onPress(); });
    expect(tree.root.findAll((node) => node.props.message === 'Nie udało się rozpocząć jazdy.')).toHaveLength(1);
    expect(tree.root.findByProps({ testID: 'start-ride-primary' }).props.disabled).toBe(false);
    await act(async () => { tree.root.findByProps({ testID: 'start-ride-primary' }).props.onPress(); });
    expect(start).toHaveBeenCalledTimes(2);
  });

  test('an active session offers return, never a second start', () => {
    const { tree, props } = mount({ isRecording: true });
    expect(tree.root.findAllByProps({ testID: 'start-ride-primary' })).toHaveLength(0);
    act(() => { tree.root.findByProps({ testID: 'start-ride-go-live' }).props.onPress(); });
    expect(props.onGoToRide).toHaveBeenCalledTimes(1);
    expect(props.onStartRide).not.toHaveBeenCalled();
  });

  test('passes the selected sport and preserves GPS diagnostics entry', async () => {
    const { tree, props } = mount();
    const alternative = ACTIVITY_SPORT_OPTIONS.find((option) => option.type !== 'BIKE');
    expect(alternative).toBeDefined();
    act(() => { tree.root.findByProps({ testID: `start-ride-sport-${alternative!.type.toLowerCase()}` }).props.onPress(); });
    await act(async () => { tree.root.findByProps({ testID: 'start-ride-primary' }).props.onPress(); });
    expect(props.onStartRide).toHaveBeenCalledWith(alternative!.type);
    act(() => { tree.root.findByProps({ testID: 'start-ride-gps-diagnostics' }).props.onPress(); });
    expect(props.onOpenGpsWizard).toHaveBeenCalledTimes(1);
  });
});
