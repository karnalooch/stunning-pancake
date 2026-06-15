/** Baked at build time — enable only for local/preview E2E APKs, never production store. */
import Constants from 'expo-constants';

function readExtra(): Record<string, string | undefined> {
  const fromExpo = Constants.expoConfig?.extra;
  const fromManifest2 = (
    Constants as { manifest2?: { extra?: Record<string, string | undefined> } }
  ).manifest2?.extra;
  const fromManifest = (
    Constants as { manifest?: { extra?: Record<string, string | undefined> } }
  ).manifest?.extra;
  return { ...fromManifest, ...fromManifest2, ...fromExpo };
}

function readEnv(key: string): string | undefined {
  const extra = readExtra();
  const fromProcess = process.env[key];
  if (fromProcess != null && fromProcess !== '') return fromProcess;
  const fromExtra = extra[key];
  if (fromExtra != null && fromExtra !== '') return fromExtra;
  return undefined;
}

function readEnvFlag(key: string): boolean {
  return readEnv(key) === 'true';
}

export const e2eConfig = {
  autoLogin: readEnvFlag('EXPO_PUBLIC_E2E_AUTO_LOGIN'),
  skipOnboarding: readEnvFlag('EXPO_PUBLIC_E2E_SKIP_ONBOARDING'),
  email: readEnv('EXPO_PUBLIC_E2E_EMAIL') ?? '',
  password: readEnv('EXPO_PUBLIC_E2E_PASSWORD') ?? '',
  gpsRecoverySeed: readEnvFlag('EXPO_PUBLIC_E2E_GPS_RECOVERY'),
};

export function isE2eAutoLoginEnabled(): boolean {
  return e2eConfig.autoLogin && Boolean(e2eConfig.email && e2eConfig.password);
}

/** When E2E auto-login is active, skip onboarding unless explicitly disabled. */
export function shouldSkipOnboardingForE2e(): boolean {
  if (!isE2eAutoLoginEnabled()) return false;
  if (readEnv('EXPO_PUBLIC_E2E_SKIP_ONBOARDING') === 'false') return false;
  return true;
}
