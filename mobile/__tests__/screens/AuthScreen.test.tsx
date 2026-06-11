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

import { AuthScreen } from '../../src/app/AuthScreen';

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
    expect(json).toContain('MISSION LOGIN');
    expect(json).toContain('AUTHORIZE');
  });
});
