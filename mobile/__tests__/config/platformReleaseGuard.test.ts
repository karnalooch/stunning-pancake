jest.mock('dotenv', () => ({ config: () => undefined }));

type AppConfigFn = (context: { config: Record<string, unknown> }) => Record<string, unknown>;

function loadConfig(): AppConfigFn {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../app.config.js').default as AppConfigFn;
}

describe('release-grade public env guard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.EXPO_PUBLIC_E2E_AUTO_LOGIN;
    delete process.env.EXPO_PUBLIC_E2E_SKIP_ONBOARDING;
    delete process.env.EXPO_PUBLIC_E2E_EMAIL;
    delete process.env.EXPO_PUBLIC_E2E_PASSWORD;
    delete process.env.EXPO_PUBLIC_E2E_GPS_RECOVERY;
    delete process.env.EXPO_PUBLIC_VISION_FIXTURES;
    delete process.env.EXPO_PUBLIC_LLM_API_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('production rejects baked E2E credentials', () => {
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_E2E_PASSWORD = 'synthetic-secret';

    const config = loadConfig();

    expect(() => config({ config: {} })).toThrow(
      /forbidden public test\/secret variables: EXPO_PUBLIC_E2E_PASSWORD/,
    );
  });

  test('production rejects credential fields even when their literal value is false', () => {
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_E2E_PASSWORD = 'false';

    const config = loadConfig();

    expect(() => config({ config: {} })).toThrow(/EXPO_PUBLIC_E2E_PASSWORD/);
  });

  test('production rejects public LLM key material', () => {
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_LLM_API_KEY = 'sk-should-never-be-public';

    const config = loadConfig();

    expect(() => config({ config: {} })).toThrow(/EXPO_PUBLIC_LLM_API_KEY/);
  });

  test('production accepts clean runtime endpoints', () => {
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
    process.env.EXPO_PUBLIC_TELEMETRY_URL = 'https://telemetry.example.test';

    const config = loadConfig();
    const resolved = config({ config: {} }) as { extra?: Record<string, unknown> };

    expect(resolved.extra?.EXPO_PUBLIC_API_URL).toBe('https://api.example.test');
    expect(resolved.extra?.EXPO_PUBLIC_TELEMETRY_URL).toBe('https://telemetry.example.test');
  });
});
