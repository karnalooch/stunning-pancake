import { Platform } from 'react-native';

let _initialized = false;
let crashlytics: any = null;

export function initFirebase(): void {
  if (_initialized) return;

  try {
    // Dynamically require to avoid crash if native module is missing
    crashlytics = require('@react-native-firebase/crashlytics').default;
    if (crashlytics && typeof crashlytics === 'function') {
      crashlytics().setAttribute('app_version', '2.1.0');
      crashlytics().setAttribute('platform', Platform.OS);
      _initialized = true;
      console.log(`[Firebase] Crashlytics Initialized successfully`);
    }
  } catch (e) {
    console.log(`[Firebase Mock] Native Firebase module not available.`);
    _initialized = true;
  }
}

export function firebaseCapture(err: unknown, context: string): void {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(`[Firebase Capture] ${context}:`, error);

  if (crashlytics) {
    try {
      crashlytics().setAttribute('context', context);
      crashlytics().recordError(error);
    } catch (e) {
      // Silent fail
    }
  }
}
