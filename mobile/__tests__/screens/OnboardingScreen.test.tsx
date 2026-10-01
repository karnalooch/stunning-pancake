import React from 'react';
import { Pressable } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { stringsEn } from '../../src/i18n/strings.en';
import { OnboardingScreen } from '../../src/screens/OnboardingScreen';

jest.mock('react-native-unistyles', () => {
  const { grandPrixTheme } = jest.requireActual('../../src/theme/grandPrix');
  return { useUnistyles: () => ({ theme: grandPrixTheme }),
    StyleSheet: { create: (factory: unknown) => typeof factory === 'function' ? factory(grandPrixTheme) : factory } };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('expo-location', () => ({ getForegroundPermissionsAsync: jest.fn(), requestForegroundPermissionsAsync: jest.fn(), requestBackgroundPermissionsAsync: jest.fn() }));
jest.mock('../../src/services/api', () => ({
  AuthService: { getPublicTenants: jest.fn(), updateProfile: jest.fn() },
  DepartmentService: { getTree: jest.fn(), selfJoin: jest.fn() }, EventService: { list: jest.fn(), join: jest.fn() },
}));
jest.mock('../../src/i18n/useI18n', () => ({ useI18n: () => ({ locale: 'en', t: require('../../src/i18n/strings.en').stringsEn }) }));
type ApiMocks = {
  AuthService: { getPublicTenants: jest.Mock; updateProfile: jest.Mock };
  DepartmentService: { getTree: jest.Mock; selfJoin: jest.Mock }; EventService: { list: jest.Mock; join: jest.Mock };
};
type LocationMocks = { getForegroundPermissionsAsync: jest.Mock; requestForegroundPermissionsAsync: jest.Mock; requestBackgroundPermissionsAsync: jest.Mock };
const apiMocks = (): ApiMocks => jest.requireMock('../../src/services/api') as ApiMocks;
const locationMocks = (): LocationMocks => jest.requireMock('expo-location') as LocationMocks;
let tree: TestRenderer.ReactTestRenderer | undefined;
const waitForResult = async <T,>(probe: () => T, label: string, maxAttempts = 40): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try { return probe(); } catch (error) { lastError = error; }
    await act(async () => { await Promise.resolve(); });
  }
  throw new Error(`Timed out waiting for ${label}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
};
const waitForEnabledControl = async (testID: string) => waitForResult(() => {
  if (!tree) throw new Error('onboarding renderer is not mounted');
  const controls = tree.root.findAll((node) => node.type === Pressable && node.props.testID === testID);
  if (controls.length !== 1) throw new Error(`expected one pressable ${testID}, found ${controls.length}`);
  const node = controls[0];
  if (!node || node.props.disabled === true) throw new Error(`control ${testID} is not enabled`);
  return node;
}, `enabled control ${testID}`);
const pressControl = async (testID: string) => {
  const node = await waitForEnabledControl(testID);
  await act(async () => { node.props.onPress(); });
};
const flattenRenderedText = (node: unknown): string => {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenRenderedText).join('');
  if (typeof node === 'object' && 'children' in node) return ((node as { children?: unknown[] | null }).children ?? []).map(flattenRenderedText).join('');
  return '';
};
const renderOnboarding = async (onFinish = jest.fn()) => {
  await act(async () => { tree = TestRenderer.create(<OnboardingScreen user={{ username: 'rider' }} onFinish={onFinish} />); });
  await waitForEnabledControl('onboarding-city-next');
  return { onFinish };
};
const skipDepartment = async () => {
  await pressControl('onboarding-city-next');
  await pressControl('onboarding-department-skip');
  await waitForEnabledControl('onboarding-finish-join');
};
beforeEach(() => {
  const api = apiMocks();
  api.AuthService.getPublicTenants.mockReset().mockResolvedValue([{ id: 'waw', name: 'Warszawa' }]);
  api.AuthService.updateProfile.mockReset().mockResolvedValue({});
  api.DepartmentService.getTree.mockReset().mockResolvedValue([{ id: 1, name: 'Team Alpha', children: [] }]);
  api.DepartmentService.selfJoin.mockReset().mockResolvedValue({});
  api.EventService.list.mockReset().mockResolvedValue([]);
  api.EventService.join.mockReset().mockResolvedValue({});
  const location = locationMocks();
  location.getForegroundPermissionsAsync.mockReset().mockResolvedValue({ status: 'granted' });
  location.requestForegroundPermissionsAsync.mockReset().mockResolvedValue({ status: 'granted' });
  location.requestBackgroundPermissionsAsync.mockReset().mockResolvedValue({ status: 'granted' });
});
afterEach(() => { act(() => tree?.unmount()); tree = undefined; });

describe('OnboardingScreen', () => {
  test('renders the real English catalog through shared Roadbook controls', async () => {
    await renderOnboarding();
    const text = flattenRenderedText(tree!.toJSON());
    expect(text).toContain(`${stringsEn.onboarding.stepWord} 1 ${stringsEn.onboarding.ofWord} 3`);
    for (const copy of [stringsEn.onboarding.city.step, stringsEn.onboarding.city.title, stringsEn.onboarding.city.description, stringsEn.onboarding.city.next]) expect(text).toContain(copy);
  });
  test('blocks completion on a failed final profile write and allows explicit retry', async () => {
    const api = apiMocks();
    api.AuthService.updateProfile.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('network'));
    const { onFinish } = await renderOnboarding();
    await skipDepartment();
    await pressControl('onboarding-finish-join');
    await waitForEnabledControl('onboarding-finish-join');
    expect(onFinish).not.toHaveBeenCalled();
    expect(tree!.root.findAll((node) => node.props.testID === 'onboarding-submit-error').length).toBeGreaterThan(0);
    expect(api.AuthService.updateProfile).toHaveBeenCalledTimes(2);
    await pressControl('onboarding-finish-join');
    await waitForResult(() => {
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(onFinish).toHaveBeenCalledWith({ refreshProfile: true });
      return true;
    }, 'retry completion');
    expect(api.AuthService.updateProfile).toHaveBeenCalledTimes(3);
    expect(api.DepartmentService.selfJoin).not.toHaveBeenCalled();
  });
  test('failed city persistence cannot advance or read departments for an unsaved tenant', async () => {
    const api = apiMocks();
    api.AuthService.updateProfile.mockRejectedValueOnce(new Error('forbidden'));
    const { onFinish } = await renderOnboarding();
    await pressControl('onboarding-city-next');
    await waitForEnabledControl('onboarding-city-next');
    expect(api.DepartmentService.getTree).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
    expect(tree!.root.findAll((node) => node.props.testID === 'onboarding-department-skip')).toHaveLength(0);
    await pressControl('onboarding-city-next');
    await waitForEnabledControl('onboarding-department-skip');
    expect(api.DepartmentService.getTree).toHaveBeenCalledTimes(1);
  });
  test('the finish lock covers duplicate presses during a pending GPS permission', async () => {
    let grant!: (permission: { status: string }) => void;
    const permission = new Promise<{ status: string }>((resolve) => { grant = resolve; });
    const location = locationMocks();
    location.getForegroundPermissionsAsync.mockReturnValueOnce(permission);
    const { onFinish } = await renderOnboarding();
    await skipDepartment();
    const finish = await waitForEnabledControl('onboarding-finish-join');
    act(() => { finish.props.onPress(); finish.props.onPress(); });
    expect(location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();
    await act(async () => { grant({ status: 'granted' }); });
    await waitForResult(() => { expect(onFinish).toHaveBeenCalledTimes(1); return true; }, 'single completion');
    expect(apiMocks().AuthService.updateProfile).toHaveBeenCalledTimes(2);
  });
});
