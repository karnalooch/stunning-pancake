/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { stringsEn } from '../../src/i18n/strings.en';
import { OnboardingScreen } from '../../src/screens/OnboardingScreen';

jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({
    theme: {
      colors: {
        background: '#000',
        primary: '#f0f',
        secondary: '#999',
        onBackground: '#fff',
        onPrimary: '#fff',
        parchment: '#222',
        primaryContainer: '#333',
        surfaceContainerLowest: '#111',
        outlineVariant: '#555',
        goldAmber: '#c90',
        selection: '#444',
        selectionBorder: '#c90',
        onSelection: '#fff',
        hudBackground: '#000',
        hudText: '#fff',
        hudSurface: '#222',
        gpGoldLight: '#fd9',
      },
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const AnimatedView = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  return {
    __esModule: true,
    default: { View: AnimatedView },
    useSharedValue: (v: number) => ({ value: v }),
    useAnimatedStyle: (updater: () => object) => updater(),
    withTiming: (v: number) => v,
    FadeIn: {},
    FadeOut: {},
    SlideInRight: {},
  };
});

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
}));

jest.mock('../../src/hooks/useImmersiveTheme', () => ({
  useImmersiveTheme: () => ({ enabled: false }),
}));

jest.mock('../../src/components/scene/SceneBackground', () => {
  const { View } = require('react-native');
  return { SceneBackground: () => <View /> };
});

jest.mock('../../src/components/sprites/CyclistSprite', () => {
  const { View } = require('react-native');
  return { CyclistSprite: () => <View /> };
});

jest.mock('../../src/components/ui/CrestIcon', () => {
  const { View } = require('react-native');
  return { CrestIcon: () => <View /> };
});

jest.mock('../../src/components/ui/DepartmentIcon', () => {
  const { View } = require('react-native');
  return { DepartmentIcon: () => <View /> };
});

jest.mock('../../src/services/api', () => ({
  AuthService: {
    getPublicTenants: jest.fn(),
    updateProfile: jest.fn(),
  },
  DepartmentService: {
    getTree: jest.fn(),
    selfJoin: jest.fn(),
  },
  EventService: {
    list: jest.fn(),
    join: jest.fn(),
  },
}));

jest.mock('../../src/i18n/useI18n', () => {
  const { stringsEn: realStringsEn } = jest.requireActual('../../src/i18n/strings.en') as {
    stringsEn: typeof import('../../src/i18n/strings.en').stringsEn;
  };
  return {
    useI18n: () => ({
      locale: 'en',
      t: realStringsEn,
      setLocale: jest.fn(),
      toggleLocale: jest.fn(),
    }),
  };
});

type ApiMocks = {
  AuthService: {
    getPublicTenants: jest.Mock;
    updateProfile: jest.Mock;
  };
  DepartmentService: {
    getTree: jest.Mock;
    selfJoin: jest.Mock;
  };
  EventService: {
    list: jest.Mock;
    join: jest.Mock;
  };
};

type LocationMocks = {
  getForegroundPermissionsAsync: jest.Mock;
  requestForegroundPermissionsAsync: jest.Mock;
  requestBackgroundPermissionsAsync: jest.Mock;
};

const apiMocks = (): ApiMocks => jest.requireMock('../../src/services/api') as ApiMocks;
const locationMocks = (): LocationMocks => jest.requireMock('expo-location') as LocationMocks;

let tree: TestRenderer.ReactTestRenderer | undefined;

const waitForResult = async <T,>(
  probe: () => T,
  label: string,
  maxAttempts = 40,
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return probe();
    } catch (error) {
      lastError = error;
    }
    await act(async () => {
      await Promise.resolve();
    });
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Timed out waiting for ${label}: ${detail}`);
};

const waitForEnabledControl = async (testID: string) =>
  waitForResult(() => {
    if (!tree) throw new Error('onboarding renderer is not mounted');
    const node = tree.root.findByProps({ testID });
    if (typeof node.props.onPress !== 'function') {
      throw new Error(`control "${testID}" has no onPress handler`);
    }
    if (node.props.disabled === true) {
      throw new Error(`control "${testID}" is still disabled`);
    }
    return node;
  }, `enabled control ${testID}`);

const pressControl = async (testID: string) => {
  const node = await waitForEnabledControl(testID);
  await act(async () => {
    node.props.onPress();
  });
};

const renderOnboarding = async (onFinish = jest.fn()) => {
  await act(async () => {
    tree = TestRenderer.create(
      <OnboardingScreen user={{ username: 'rider' }} onFinish={onFinish} />,
    );
  });
  await waitForEnabledControl('onboarding-city-next');
  return { tree, onFinish };
};

beforeEach(() => {
  const api = apiMocks();
  api.AuthService.getPublicTenants
    .mockReset()
    .mockResolvedValue([{ id: 'waw', name: 'Warszawa' }]);
  api.AuthService.updateProfile.mockReset().mockResolvedValue({});
  api.DepartmentService.getTree
    .mockReset()
    .mockResolvedValue([{ id: 1, name: 'Team Alpha', children: [] }]);
  api.DepartmentService.selfJoin.mockReset().mockResolvedValue({});
  api.EventService.list.mockReset().mockResolvedValue([]);
  api.EventService.join.mockReset().mockResolvedValue({});

  const location = locationMocks();
  location.getForegroundPermissionsAsync
    .mockReset()
    .mockResolvedValue({ status: 'granted' });
  location.requestForegroundPermissionsAsync
    .mockReset()
    .mockResolvedValue({ status: 'granted' });
  location.requestBackgroundPermissionsAsync
    .mockReset()
    .mockResolvedValue({ status: 'granted' });
});

afterEach(() => {
  if (tree) {
    act(() => {
      tree?.unmount();
    });
    tree = undefined;
  }
});

describe('OnboardingScreen', () => {
  test('renders copy from the real English catalog', async () => {
    const rendered = await renderOnboarding();
    const json = JSON.stringify(rendered.tree.toJSON());

    expect(json).toContain(
      `${stringsEn.onboarding.stepWord} 1 ${stringsEn.onboarding.ofWord} 3`,
    );
    expect(json).toContain(stringsEn.onboarding.city.step);
    expect(json).toContain(stringsEn.onboarding.city.title);
    expect(json).toContain(stringsEn.onboarding.city.description);
    expect(json).toContain(stringsEn.onboarding.city.next);
  });

  test('calls onFinish even when the final profile update fails', async () => {
    const api = apiMocks();
    api.AuthService.updateProfile
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('network'));

    const onFinish = jest.fn();
    await renderOnboarding(onFinish);

    await pressControl('onboarding-city-next');
    await waitForEnabledControl('onboarding-department-skip');

    await pressControl('onboarding-department-skip');
    await waitForEnabledControl('onboarding-finish-join');

    await pressControl('onboarding-finish-join');
    await waitForResult(() => {
      expect(onFinish).toHaveBeenCalledWith({ refreshProfile: true });
      return true;
    }, 'onboarding completion callback');

    expect(api.AuthService.updateProfile).toHaveBeenCalledTimes(2);
  });
});
