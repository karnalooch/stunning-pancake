import { registerRootComponent } from 'expo';
import { NativeModules, Platform } from 'react-native';

// ─── Unistyles bootstrap: configure BEFORE any StyleSheet.create() ───
// Must run at module level, not in useEffect, because all screen
// StyleSheet.create(theme => ...) calls execute during import resolution.
import { StyleSheet } from 'react-native-unistyles';
import { stitchTheme } from './src/theme/stitch';

StyleSheet.configure({
    settings: { initialTheme: 'stitch' },
    themes: { stitch: stitchTheme } as any,
});

console.log('Available NativeModules:', Object.keys(NativeModules).filter(k => k.includes('Map') || k.includes('MMKV')));

import App from './App';
registerRootComponent(App);
