jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: {} },
    manifest: { extra: {} },
  },
}));

import Constants from 'expo-constants';

function loadE2eConfig() {
  jest.resetModules();
  return require('../../src/bootstrap/e2eConfig') as typeof import('../../src/bootstrap/e2eConfig');
}

describe('e2eConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.EXPO_PUBLIC_E2E_GPS_LOST_KEY;
    delete process.env.EXPO_PUBLIC_E2E_GPS_RECOVERY;
    (Constants as { expoConfig?: { extra?: Record<string, string> } }).expoConfig = { extra: {} };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('shouldSkipOnboardingForE2e defaults true when the E2E bypass flag is set', () => {
    process.env.EXPO_PUBLIC_E2E_AUTO_LOGIN = 'true';

    // loadE2eConfig() resets modules, which makes jest-expo (@expo/env) reload a
    // local mobile/.env back into process.env. Blank the flag AFTER that reload
    // (readEnv treats '' as unset) so the "default" path is exercised
    // hermetically regardless of any local .env.
    const { shouldSkipOnboardingForE2e, isE2eAutoLoginEnabled } = loadE2eConfig();
    process.env.EXPO_PUBLIC_E2E_SKIP_ONBOARDING = '';
    expect(isE2eAutoLoginEnabled()).toBe(true);
    expect(shouldSkipOnboardingForE2e()).toBe(true);
  });

  test('does not expose credential fields in the mobile E2E config', () => {
    process.env.EXPO_PUBLIC_E2E_AUTO_LOGIN = 'true';

    const { e2eConfig } = loadE2eConfig();

    expect(e2eConfig).not.toHaveProperty('email');
    expect(e2eConfig).not.toHaveProperty('password');
  });

  test('shouldSkipOnboardingForE2e respects explicit false', () => {
    process.env.EXPO_PUBLIC_E2E_AUTO_LOGIN = 'true';
    process.env.EXPO_PUBLIC_E2E_SKIP_ONBOARDING = 'false';

    const { shouldSkipOnboardingForE2e } = loadE2eConfig();
    expect(shouldSkipOnboardingForE2e()).toBe(false);
  });

  test('does not arm destructive GPS lost-key proof for a generic true flag', () => {
    process.env.EXPO_PUBLIC_E2E_GPS_LOST_KEY = 'true';

    const { e2eConfig } = loadE2eConfig();

    expect(e2eConfig.gpsLostKeyDestructive).toBe(false);
  });

  test('arms destructive GPS lost-key proof only for the explicit confirmation token', () => {
    process.env.EXPO_PUBLIC_E2E_GPS_LOST_KEY = 'DELETE_GPS_ENCRYPTION_KEY';

    const { e2eConfig, E2E_GPS_LOST_KEY_CONFIRMATION } = loadE2eConfig();

    expect(E2E_GPS_LOST_KEY_CONFIRMATION).toBe('DELETE_GPS_ENCRYPTION_KEY');
    expect(e2eConfig.gpsLostKeyDestructive).toBe(true);
  });
});
