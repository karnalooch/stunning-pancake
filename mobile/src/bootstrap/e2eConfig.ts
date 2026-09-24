/** Build-time E2E flags only. Credentials must never be baked into the mobile bundle. */
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

export const E2E_GPS_LOST_KEY_CONFIRMATION = 'DELETE_GPS_ENCRYPTION_KEY';
export const E2E_GPS_BACKGROUND_PROOF_CONFIRMATION = 'PROVE_BACKGROUND_GPS';

type E2eEnvKey =
  | 'EXPO_PUBLIC_E2E_AUTO_LOGIN'
  | 'EXPO_PUBLIC_E2E_SKIP_ONBOARDING'
  | 'EXPO_PUBLIC_E2E_GPS_RECOVERY'
  | 'EXPO_PUBLIC_E2E_GPS_LOST_KEY'
  | 'EXPO_PUBLIC_E2E_GPS_BACKGROUND_PROOF';

function readProcessEnv(key: E2eEnvKey): string | undefined {
  switch (key) {
    case 'EXPO_PUBLIC_E2E_AUTO_LOGIN':
      return process.env.EXPO_PUBLIC_E2E_AUTO_LOGIN;
    case 'EXPO_PUBLIC_E2E_SKIP_ONBOARDING':
      return process.env.EXPO_PUBLIC_E2E_SKIP_ONBOARDING;
    case 'EXPO_PUBLIC_E2E_GPS_RECOVERY':
      return process.env.EXPO_PUBLIC_E2E_GPS_RECOVERY;
    case 'EXPO_PUBLIC_E2E_GPS_LOST_KEY':
      return process.env.EXPO_PUBLIC_E2E_GPS_LOST_KEY;
    case 'EXPO_PUBLIC_E2E_GPS_BACKGROUND_PROOF':
      return process.env.EXPO_PUBLIC_E2E_GPS_BACKGROUND_PROOF;
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
  gpsLostKeyDestructive:
    readEnv('EXPO_PUBLIC_E2E_GPS_LOST_KEY') === E2E_GPS_LOST_KEY_CONFIRMATION,
  gpsBackgroundProof:
    readEnv('EXPO_PUBLIC_E2E_GPS_BACKGROUND_PROOF') ===
    E2E_GPS_BACKGROUND_PROOF_CONFIRMATION,
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
