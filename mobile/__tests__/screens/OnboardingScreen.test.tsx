/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { OnboardingScreen } from '../../src/screens/OnboardingScreen';

jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({
    theme: {
      colors: {
        background: '#000',
        primary: '#f0f',
        onBackground: '#fff',
        parchment: '#222',
        primaryContainer: '#333',
      },
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
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
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));

jest.mock('../../src/hooks/useImmersiveTheme', () => ({
  useImmersiveTheme: () => ({ enabled: false }),
}));

jest.mock('../../src/components/Column', () => {
  const { View } = require('react-native');
  return { Column: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('../../src/components/Row', () => {
  const { View } = require('react-native');
  return { Row: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('../../src/components/PixelText', () => {
  const { Text } = require('react-native');
  return { PixelText: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> };
});
jest.mock('../../src/components/ScrollContainer', () => {
  const { View } = require('react-native');
  return { ScrollContainer: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('../../src/components/ui/GameCard', () => {
  const { View } = require('react-native');
  return { GameCard: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('../../src/components/ArcadeButton', () => {
  const { Text } = require('react-native');
  return {
    ArcadeButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Text onPress={onPress}>{label}</Text>
    ),
  };
});
jest.mock('../../src/components/scene/SceneBackground', () => {
  const { View } = require('react-native');
  return { SceneBackground: () => <View /> };
});
jest.mock('../../src/components/sprites/CyclistSprite', () => {
  const { View } = require('react-native');
  return { CyclistSprite: () => <View /> };
});
jest.mock('../../src/components/narration/SpeechBubble', () => {
  const { View } = require('react-native');
  return { SpeechBubble: () => <View /> };
});

jest.mock('../../src/services/api', () => ({
  AuthService: {
    getPublicTenants: jest.fn().mockResolvedValue([{ id: 'waw', name: 'Warszawa' }]),
    updateProfile: jest.fn().mockResolvedValue({}),
  },
  DepartmentService: {
    getTree: jest.fn().mockResolvedValue([{ id: 1, name: 'Team Alpha', children: [] }]),
    selfJoin: jest.fn().mockResolvedValue({}),
  },
  EventService: {
    list: jest.fn().mockResolvedValue([]),
    join: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../../src/i18n/useI18n', () => ({
  useI18n: () => ({
    t: {
      onboarding: {
        characterInit: 'CHARACTER_INIT',
        stagePrefix: 'STG_CITY',
        osVersion: '4VELO_OS v1.0',
        stepWord: 'Step',
        ofWord: 'of',
        city: {
          bubble: 'Choose your city!',
          title: 'Select city',
          step: 'Choose city',
          description: 'Choose the city tenant you will compete in.',
          next: 'NEXT',
        },
        department: {
          bubble: 'Join your squad!',
          title: 'Select department',
          step: 'Choose team',
          description: 'Pick your department/team to join ranking cohorts.',
          next: 'NEXT',
        },
        finish: {
          bubble: 'Ready to race?',
          title: 'Ready to join',
          step: 'Ready!',
          description: 'Confirm city and department, then enable GPS and enter competition.',
          user: 'User',
          city: 'City',
          department: 'Department',
          joining: 'JOINING…',
          joinCompetition: 'JOIN COMPETITION',
          gpsPermissionTitle: 'Permission required',
          gpsPermissionBody: '4VELO requires GPS to track your performance.',
        },
      },
    },
  }),
}));

describe('OnboardingScreen', () => {
  test('renders localized step copy and labels', async () => {
    const onFinish = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(<OnboardingScreen user={{ username: 'rider' }} onFinish={onFinish} />);
      await Promise.resolve();
    });

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Step 1 of 3');
    expect(json).toContain('Choose city');
    expect(json).toContain('Select city');
    expect(json).toContain('Choose the city tenant you will compete in.');
    expect(json).toContain('NEXT');
  });

  test('calls onFinish even when profile update fails on final step', async () => {
    const { AuthService } = jest.requireMock('../../src/services/api') as {
      AuthService: { updateProfile: jest.Mock };
    };
    AuthService.updateProfile.mockRejectedValueOnce(new Error('network'));

    const onFinish = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(<OnboardingScreen user={{ username: 'rider' }} onFinish={onFinish} />);
      await Promise.resolve();
    });

    const press = (label: string) => {
      const node = tree.root.findAll(
        (n: TestRenderer.ReactTestInstance) =>
          typeof n.props?.children === 'string' && n.props.children === label,
      )[0];
      act(() => {
        node.props.onPress();
      });
    };

    await act(async () => {
      press('NEXT');
      await Promise.resolve();
    });
    await act(async () => {
      press('NEXT');
      await Promise.resolve();
    });
    await act(async () => {
      press('JOIN COMPETITION');
      await Promise.resolve();
    });

    expect(onFinish).toHaveBeenCalledWith({ refreshProfile: true });
  });
});
