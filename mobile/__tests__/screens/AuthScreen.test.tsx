import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { observable } from '@legendapp/state';

jest.mock('../../src/components/Column', () => {
  const { View } = require('react-native');
  return {
    Column: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});
jest.mock('../../src/components/PixelText', () => {
  const { Text } = require('react-native');
  return {
    PixelText: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});
jest.mock('../../src/components/ArcadeButton', () => {
  const { Text } = require('react-native');
  return {
    ArcadeButton: ({ label }: { label: string }) => <Text>{label}</Text>,
  };
});
jest.mock('../../src/components/RetroInput', () => {
  const { Text } = require('react-native');
  return {
    RetroInput: ({ placeholder }: { placeholder: string }) => <Text>{placeholder}</Text>,
  };
});
jest.mock('react-native-unistyles', () => ({
  StyleSheet: {
    create: (styles: unknown) =>
      typeof styles === 'function'
        ? styles({
            colors: {
              background: '#fff',
              primary: '#0a0',
              secondary: '#666',
              onBackground: '#111',
              primaryContainer: '#ddd',
              onPrimaryContainer: '#111',
              error: '#b00',
              onError: '#fff',
            },
          })
        : styles,
  },
  useUnistyles: () => ({
    theme: {
      colors: {
        background: '#fff',
        primary: '#0a0',
        secondary: '#666',
        onBackground: '#111',
        primaryContainer: '#ddd',
        onPrimaryContainer: '#111',
        error: '#b00',
        onError: '#fff',
      },
    },
  }),
}));
jest.mock('../../src/components/scene/SceneBackground', () => {
  const { View } = require('react-native');
  return { SceneBackground: () => <View /> };
});
jest.mock('../../src/components/sprites/CyclistSprite', () => {
  const { View } = require('react-native');
  return { CyclistSprite: () => <View /> };
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
    Easing: {
      linear: jest.fn(),
      inOut: jest.fn(),
      ease: jest.fn(),
    },
  };
});

import { AuthScreen } from '../../src/bootstrap/AuthScreen';

describe('AuthScreen', () => {
  test('renders login affordances', () => {
    const auth = observable({
      mode: 'login' as const,
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      isSubmitting: false,
    });

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <AuthScreen
          auth={auth}
          colors={{ background: '#fff', primary: '#0a0', secondary: '#666' }}
          onSubmit={jest.fn()}
          onToggleMode={jest.fn()}
          onSocialLogin={jest.fn()}
        />,
      );
    });

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('4VELO');
    expect(json).toContain('ZALOGUJ SIĘ');
    expect(json).toContain('ZALOGUJ');
  });
});
