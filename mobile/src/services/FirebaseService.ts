import { Platform } from 'react-native';

import { redactError, redactString, redactValue } from '../security/redaction';

let _firebase: any = null;
let _crashlytics: any = null;

export function initFirebase(): void {
  try {
    if (process.env.EXPO_PUBLIC_ENABLE_FIREBASE !== 'true') {
      if (__DEV__) {
        console.log('[Firebase] Disabled by EXPO_PUBLIC_ENABLE_FIREBASE');
      }
      return;
    }

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
        console.warn('[Firebase] Crashlytics not available:', redactError(e));
      }
    }).catch((err: unknown) => {
      console.warn('[Firebase] Init failed — falling back to console:', redactError(err));
    });
  } catch (e) {
    console.log('[Firebase] Not installed — using console fallback:', redactError(e));
  }
}

export function firebaseCapture(err: unknown, context: string): void {
  const safeContext = redactString(context);
  const safeError = redactError(err);

  if (_crashlytics) {
    // Never pass the original exception/message to Crashlytics. Error messages can
    // contain request URLs, bearer tokens or precise GPS context.
    _crashlytics().log(`[${safeContext}] ${safeError.message}`);
    _crashlytics().recordError(safeError);
  } else if (__DEV__) {
    // console.warn avoids LogBox red overlay for non-fatal background failures.
    console.warn(`[Telemetry Dev] ${safeContext}:`, safeError.message);
  }
}

export function setAnalyticsEvent(name: string, params?: Record<string, any>): void {
  const safeName = redactString(name);
  const safeParams = redactValue(params || {}) as Record<string, any>;

  try {
    if (_firebase) {
      const analytics = _firebase().analytics?.();
      if (analytics) {
        analytics.logEvent(safeName, safeParams);
      }
    }
  } catch (e) {
    // Keep analytics failures non-fatal, but do not leak the exception into logs.
    if (__DEV__) console.warn('[Analytics] logEvent failed:', redactError(e).message);
  }
  console.log(`[Analytics] ${safeName}:`, safeParams);
}
