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
    (Constants as { expoConfig?: { extra?: Record<string, string> } }).expoConfig = { extra: {} };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('shouldSkipOnboardingForE2e defaults true when auto-login credentials are set', () => {
    process.env.EXPO_PUBLIC_E2E_AUTO_LOGIN = 'true';
    process.env.EXPO_PUBLIC_E2E_EMAIL = 'e2e@test.sport.ai';
    process.env.EXPO_PUBLIC_E2E_PASSWORD = 'secret';

    // loadE2eConfig() resets modules, which makes jest-expo (@expo/env) reload a
    // local mobile/.env back into process.env. Blank the flag AFTER that reload
    // (readEnv treats '' as unset) so the "default" path is exercised
    // hermetically regardless of any local .env.
    const { shouldSkipOnboardingForE2e, isE2eAutoLoginEnabled } = loadE2eConfig();
    process.env.EXPO_PUBLIC_E2E_SKIP_ONBOARDING = '';
    expect(isE2eAutoLoginEnabled()).toBe(true);
    expect(shouldSkipOnboardingForE2e()).toBe(true);
  });

  test('shouldSkipOnboardingForE2e respects explicit false', () => {
    process.env.EXPO_PUBLIC_E2E_AUTO_LOGIN = 'true';
    process.env.EXPO_PUBLIC_E2E_EMAIL = 'e2e@test.sport.ai';
    process.env.EXPO_PUBLIC_E2E_PASSWORD = 'secret';
    process.env.EXPO_PUBLIC_E2E_SKIP_ONBOARDING = 'false';

    const { shouldSkipOnboardingForE2e } = loadE2eConfig();
    expect(shouldSkipOnboardingForE2e()).toBe(false);
  });
});
