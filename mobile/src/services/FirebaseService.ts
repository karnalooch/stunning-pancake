/**
 * Firebase Initialization — SPORT Mobile App (v2.1 Gold Master)
 * ========================================================
 * Replaced Sentry with Firebase Crashlytics.
 */

import crashlytics from '@react-native-firebase/crashlytics';
import { Platform } from 'react-native';

let _initialized = false;

export function initFirebase(): void {
  if (_initialized) return;

  // Crashlytics is auto-initialized by the native module if configured correctly.
  // We can set global attributes here.
  try {
    crashlytics().setAttribute('app_version', '2.1.0');
    crashlytics().setAttribute('platform', Platform.OS);
    _initialized = true;
    console.log(`[Firebase] Crashlytics Initialized (v2.1)`);
  } catch (e) {
    console.warn('[Firebase] Crashlytics initialization failed (likely non-native env)', e);
  }
}

export function firebaseCapture(err: unknown, context: string): void {
  const error = err instanceof Error ? err : new Error(String(err));
  
  console.error(`[Firebase Capture] ${context}:`, error);

  try {
    crashlytics().setAttribute('context', context);
    crashlytics().recordError(error);
  } catch (e) {
    // Silent fail if crashlytics not available
  }
}
