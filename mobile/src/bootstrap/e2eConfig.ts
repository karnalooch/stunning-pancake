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

type E2eEnvKey =
  | 'EXPO_PUBLIC_E2E_AUTO_LOGIN'
  | 'EXPO_PUBLIC_E2E_SKIP_ONBOARDING'
  | 'EXPO_PUBLIC_E2E_GPS_RECOVERY';

function readProcessEnv(key: E2eEnvKey): string | undefined {
  switch (key) {
    case 'EXPO_PUBLIC_E2E_AUTO_LOGIN':
      return process.env.EXPO_PUBLIC_E2E_AUTO_LOGIN;
    case 'EXPO_PUBLIC_E2E_SKIP_ONBOARDING':
      return process.env.EXPO_PUBLIC_E2E_SKIP_ONBOARDING;
    case 'EXPO_PUBLIC_E2E_GPS_RECOVERY':
      return process.env.EXPO_PUBLIC_E2E_GPS_RECOVERY;
  }
}

function readEnv(key: E2eEnvKey): string | undefined {
  const extra = readExtra();
  const fromProcess = readProcessEnv(key);
  if (fromProcess != null && fromProcess !== '') return fromProcess;
  const fromExtra = extra[key];
  if (fromExtra != null && fromExtra !== '') return fromExtra;
  return undefined;
}

function readEnvFlag(key: E2eEnvKey): boolean {
  return readEnv(key) === 'true';
}

export const e2eConfig = {
  autoLogin: readEnvFlag('EXPO_PUBLIC_E2E_AUTO_LOGIN'),
  skipOnboarding: readEnvFlag('EXPO_PUBLIC_E2E_SKIP_ONBOARDING'),
  gpsRecoverySeed: readEnvFlag('EXPO_PUBLIC_E2E_GPS_RECOVERY'),
};

export function isE2eAutoLoginEnabled(): boolean {
  return e2eConfig.autoLogin;
}

/** When E2E auto-login is active, skip onboarding unless explicitly disabled. */
export function shouldSkipOnboardingForE2e(): boolean {
  if (!isE2eAutoLoginEnabled()) return false;
  if (readEnv('EXPO_PUBLIC_E2E_SKIP_ONBOARDING') === 'false') return false;
  return true;
}
