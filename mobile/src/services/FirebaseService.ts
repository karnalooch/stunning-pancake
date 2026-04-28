import { Platform } from 'react-native';

let _initialized = false;
let crashlytics: any = null;

export function initFirebase(): void {
  if (_initialized) return;

  if (process.env.EXPO_PUBLIC_ENABLE_FIREBASE === 'true') {
    try {
      // Dynamically require to avoid crash if native module is missing
      crashlytics = require('@react-native-firebase/crashlytics').default;
      crashlytics().setAttribute('app_version', '2.1.0');
      crashlytics().setAttribute('platform', Platform.OS);
      _initialized = true;
      console.log(`[Firebase] Crashlytics Initialized via Feature Flag`);
    } catch (e) {
      console.warn('[Firebase] Failed to initialize native Crashlytics module', e);
    }
  } else {
    console.log(`[Firebase Mock] Disabled via Feature Flag`);
    _initialized = true;
  }
}

export function firebaseCapture(err: unknown, context: string): void {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(`[Firebase Capture] ${context}:`, error);

  if (process.env.EXPO_PUBLIC_ENABLE_FIREBASE === 'true' && crashlytics) {
    try {
      crashlytics().setAttribute('context', context);
      crashlytics().recordError(error);
    } catch (e) {
      // Silent fail
    }
  }
}
