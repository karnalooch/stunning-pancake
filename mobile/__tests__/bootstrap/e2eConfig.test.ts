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
    delete process.env.EXPO_PUBLIC_E2E_SKIP_ONBOARDING;

    const { shouldSkipOnboardingForE2e, isE2eAutoLoginEnabled } = loadE2eConfig();
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
