import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { observer } from '@legendapp/state/react';

import { AppRoot } from './src/app/AppRoot';
import { ErrorBoundary } from './src/bootstrap/ErrorBoundary';
import { ThemeProvider } from './src/theme/ThemeProvider';

export default observer(function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <ThemeProvider>
            <AppRoot />
          </ThemeProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
});
