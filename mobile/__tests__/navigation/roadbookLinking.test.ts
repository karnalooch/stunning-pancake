import { getPathFromState, getStateFromPath } from '@react-navigation/native';
import { mobileLinking } from '../../src/navigation/linking';
jest.mock('expo-linking', () => ({ createURL: () => 'fourvelo://' }));

describe('Roadbook public URL migration', () => {
  test.each([
    ['ride', 'MainTabs', 'Today'], ['explore', 'MainTabs', 'Discover'],
    ['compete', 'MainTabs', 'Club'], ['profile', 'MainTabs', 'You'],
    ['ride/start', 'StartRide', undefined], ['ride/live', 'Tracking', undefined],
    ['settings', 'Settings', undefined], ['profile/training-log', 'TrainingLog', undefined],
    ['profile/activity/42', 'ActivityDetail', undefined], ['ride/gps-diagnostics', 'GpsDiagnostics', undefined],
  ])('%s resolves to %s and round-trips', (path, root, tab) => {
    const state = getStateFromPath(path!, mobileLinking.config);
    expect(state).toBeDefined();
    const active = state!.routes[state!.routes.length - 1]!;
    expect(active.name).toBe(root);
    if (tab) expect(active.state?.routes[active.state.routes.length - 1]?.name).toBe(tab);
    expect(getPathFromState(state!, mobileLinking.config)).toBe(`/${path}`);
  });
  test('live and preparation have a root home back target, never a hidden fifth tab', () => {
    for (const path of ['ride/start', 'ride/live']) {
      const state = getStateFromPath(path, mobileLinking.config)!;
      expect(state.routes.map((route) => route.name)).toEqual(['MainTabs', path === 'ride/start' ? 'StartRide' : 'Tracking']);
    }
  });
});
