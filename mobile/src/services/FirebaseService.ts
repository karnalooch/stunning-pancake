import { Platform } from 'react-native';

export function initFirebase(): void {
  console.log(`[Firebase] Fully disabled dynamically to bypass native boot crash.`);
}

export function firebaseCapture(err: unknown, context: string): void {
  console.error(`[Firebase Mock] ${context}:`, err);
}
