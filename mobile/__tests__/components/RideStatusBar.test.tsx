import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { RideStatusBar } from '../../src/components/ride/RideStatusBar';

jest.mock('react-native-unistyles', () => {
  const mockColors = {
    hudPanel: '#101010',
    hudOutline: '#f5f5f5',
    gpForestGreen: '#2E7D32',
    goldAmber: '#F5A623',
  };
  return {
    StyleSheet: {
      create: (styles: unknown) => styles,
    },
    useUnistyles: () => ({ theme: { colors: mockColors } }),
  };
});

jest.mock('../../src/i18n/useI18n', () => ({
  useI18n: () => ({
    t: {
      ride: {
        status: {
          gpsLocked: 'GPS OK',
          gpsSearching: 'GPS...',
          battery: 'BAT',
        },
      },
    },
  }),
}));

describe('RideStatusBar', () => {
  function flattenText(value: unknown): string {
    if (Array.isArray(value)) return value.map(flattenText).join('');
    if (value == null) return '';
    return String(value);
  }

  function collectText(tree: TestRenderer.ReactTestRenderer): string[] {
    return tree.root
      .findAllByType(Text)
      .map((node: TestRenderer.ReactTestInstance) => flattenText(node.props.children));
  }

  test('renders fallback battery label when value is unknown', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<RideStatusBar gpsLocked batteryPct={null} />);
    });

    const textNodes = collectText(tree);
    expect(textNodes).toContain('GPS OK');
    expect(textNodes).toContain('BAT —');

    act(() => {
      tree.unmount();
    });
  });

  test('clamps battery percentage to valid range', () => {
    let highTree!: TestRenderer.ReactTestRenderer;
    let lowTree!: TestRenderer.ReactTestRenderer;

    act(() => {
      highTree = TestRenderer.create(<RideStatusBar gpsLocked={false} batteryPct={145.8} />);
      lowTree = TestRenderer.create(<RideStatusBar gpsLocked={false} batteryPct={-6.2} />);
    });

    expect(collectText(highTree)).toContain('BAT 100%');
    expect(collectText(lowTree)).toContain('BAT 0%');

    act(() => {
      highTree.unmount();
      lowTree.unmount();
    });
  });
});
