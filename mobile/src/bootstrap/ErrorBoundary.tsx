import React from 'react';
import { View, Text } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: unknown }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let colors: Record<string, string> = {};
      try {
        colors = (UnistylesRuntime as { theme?: { colors?: Record<string, string> } }).theme
          ?.colors ?? {};
      } catch {
        /* Unistyles may not be ready */
      }
      const fallback = {
        background: '#f8faf0',
        error: '#ba1a1a',
        onBackground: '#191d17',
      };
      const C = { ...fallback, ...colors };
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: C.background,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <Text style={{ color: C.error, fontSize: 24, fontWeight: '900' }}>CRITICAL ERROR</Text>
          <Text
            style={{
              color: C.onBackground,
              textAlign: 'center',
              fontSize: 14,
              paddingHorizontal: 16,
              marginTop: 8,
            }}
          >
            {this.state.error instanceof Error
              ? this.state.error.message
              : String(this.state.error ?? 'Unknown JS Exception')}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}
