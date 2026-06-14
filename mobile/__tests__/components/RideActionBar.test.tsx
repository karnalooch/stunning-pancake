import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { RideActionBar } from '../../src/components/ride/RideActionBar';

jest.useFakeTimers();

jest.mock('react-native-unistyles', () => {
  const colors = {
    error: '#d32f2f',
    hudOutline: '#111111',
    tertiaryContainer: '#555555',
    onError: '#ffffff',
    primaryContainer: '#2e7d32',
    onBackground: '#ffffff',
    goldAmber: '#ffc107',
  };
  return {
    StyleSheet: {
      create: (styles: unknown) => (typeof styles === 'function' ? styles({ colors }) : styles),
    },
    useUnistyles: () => ({ theme: { colors } }),
  };
});

jest.mock('../../src/i18n/useI18n', () => ({
  useI18n: () => ({
    t: {
      ride: {
        actions: {
          stopConfirm: 'Hold to stop',
          stop: 'Stop',
          resume: 'Resume',
          pause: 'Pause',
        },
      },
    },
  }),
}));

const mockTrigger = jest.fn();
const mockPlay = jest.fn();

jest.mock('../../src/services/HapticService', () => ({
  HapticService: { trigger: (...args: unknown[]) => mockTrigger(...args) },
}));

jest.mock('../../src/services/SoundService', () => ({
  SoundService: { play: (...args: unknown[]) => mockPlay(...args) },
}));

describe('RideActionBar hold-to-stop', () => {
  beforeEach(() => {
    mockTrigger.mockClear();
    mockPlay.mockClear();
  });

  test('calls onStop when hold duration is reached', () => {
    const onStop = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <RideActionBar isPaused={false} onPause={jest.fn()} onResume={jest.fn()} onStop={onStop} />,
      );
    });

    const stopButton = tree.root.find(
      (node: TestRenderer.ReactTestInstance) =>
        node.props?.accessibilityLabel === 'Hold to stop' &&
        typeof node.props?.onPressIn === 'function' &&
        typeof node.props?.onPressOut === 'function',
    );
    expect(stopButton).toBeTruthy();

    act(() => {
      stopButton.props.onPressIn();
      jest.advanceTimersByTime(901);
    });

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  test('does not call onStop when hold is released early', () => {
    const onStop = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <RideActionBar isPaused={false} onPause={jest.fn()} onResume={jest.fn()} onStop={onStop} />,
      );
    });

    const stopButton = tree.root.find(
      (node: TestRenderer.ReactTestInstance) =>
        node.props?.accessibilityLabel === 'Hold to stop' &&
        typeof node.props?.onPressIn === 'function' &&
        typeof node.props?.onPressOut === 'function',
    );

    act(() => {
      stopButton.props.onPressIn();
      jest.advanceTimersByTime(400);
      stopButton.props.onPressOut();
      jest.advanceTimersByTime(700);
    });

    expect(onStop).not.toHaveBeenCalled();
  });
});
