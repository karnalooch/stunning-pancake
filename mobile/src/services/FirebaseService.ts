import { Platform } from 'react-native';

let _firebase: any = null;
let _crashlytics: any = null;

export function initFirebase(): void {
  try {
    // Attempt to initialize Firebase only on native platforms
    if (Platform.OS === 'web') {
      console.log('[Firebase] Skipped on web — using console fallback');
      return;
    }

    const rnfb = require('@react-native-firebase/app');
    rnfb.default().then(() => {
      console.log('[Firebase] Initialized successfully');
      _firebase = rnfb.default;

      try {
        const crashlytics = require('@react-native-firebase/crashlytics');
        _crashlytics = crashlytics.default;
        console.log('[Firebase] Crashlytics ready');
      } catch (e) {
        console.warn('[Firebase] Crashlytics not available:', e);
      }
    }).catch((err: any) => {
      console.warn('[Firebase] Init failed — falling back to console:', err?.message);
    });
  } catch (e) {
    console.log('[Firebase] Not installed — using console fallback');
  }
}

export function firebaseCapture(err: unknown, context: string): void {
  const message = err instanceof Error ? err.message : String(err);

  if (_crashlytics) {
    // Record to Firebase Crashlytics with context as breadcrumb
    _crashlytics().log(`[${context}] ${message}`);
    _crashlytics().recordError(err instanceof Error ? err : new Error(message));
  } else {
    // Development fallback — structured console logging
    console.error(`[Firebase Dev] ${context}:`, message);
  }
}

export function setAnalyticsEvent(name: string, params?: Record<string, any>): void {
  try {
    if (_firebase) {
      const analytics = _firebase().analytics?.();
      if (analytics) {
        analytics.logEvent(name, params);
      }
    }
  } catch (e) {
    // Ignore analytics errors in dev
  }
  console.log(`[Analytics] ${name}:`, params || {});
}
