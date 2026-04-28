/**
 * Firebase Initialization — SPORT Mobile App (v2.1 Gold Master)
 * ========================================================
 * Replaced Sentry with Firebase Crashlytics.
 * [MOCK MODE] Temporarily disabled to prevent crashes without google-services.json.
 */

import { Platform } from 'react-native';

let _initialized = false;

export function initFirebase(): void {
  if (_initialized) return;
  console.log(`[Firebase Mock] Native Firebase disabled in JS to match app.config.js`);
  _initialized = true;
}

export function firebaseCapture(err: unknown, context: string): void {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(`[Firebase Capture Mock] ${context}:`, error);
}
