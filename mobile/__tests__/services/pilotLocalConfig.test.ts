import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RAILWAY_API_URL = 'https://backend-production-55c7.up.railway.app';
const RAILWAY_TELEMETRY_URL = 'https://docker-telemetry-production-123c.up.railway.app';
const PILOT_LOCAL_API_URL = 'http://localhost:8000';
const PILOT_LOCAL_TELEMETRY_URL = 'http://localhost:8001';

const { build } = JSON.parse(
  readFileSync(resolve(__dirname, '../../eas.json'), 'utf8'),
);

jest.mock('dotenv', () => ({ config: () => undefined }));

type AppConfigFn = (context: { config: Record<string, unknown> }) => Record<string, unknown>;

const envKeysToRestore = [
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_TELEMETRY_URL',
  'EXPO_PUBLIC_TELEMETRY_WS_INGEST',
  'EXPO_PUBLIC_ENABLE_FIREBASE',
  'EXPO_PUBLIC_E2E_AUTO_LOGIN',
  'EXPO_PUBLIC_E2E_SKIP_ONBOARDING',
  'EXPO_PUBLIC_E2E_EMAIL',
  'EXPO_PUBLIC_E2E_PASSWORD',
  'EXPO_PUBLIC_E2E_GPS_RECOVERY',
  'EXPO_PUBLIC_VISION_FIXTURES',
] as const;

const originalEnv: Record<string, string | undefined> = {};
for (const key of envKeysToRestore) {
  originalEnv[key] = process.env[key];
}

const restoreEnv = () => {
  for (const key of envKeysToRestore) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
};

afterEach(() => {
  restoreEnv();
});

let appConfigModule: { default: AppConfigFn } | null = null;

const loadAppConfig = () => {
  if (!appConfigModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    appConfigModule = require('../../app.config.js');
  }
  return appConfigModule.default;
};

const resolveWithProfile = (profile: string | null) => {
  const fn = loadAppConfig();
  if (profile === 'pilot-local') {
    process.env.EXPO_PUBLIC_API_URL = PILOT_LOCAL_API_URL;
    process.env.EXPO_PUBLIC_TELEMETRY_URL = PILOT_LOCAL_TELEMETRY_URL;
    process.env.EXPO_PUBLIC_TELEMETRY_WS_INGEST = 'false';
    process.env.EXPO_PUBLIC_ENABLE_FIREBASE = 'false';
  } else if (
    profile === 'development' ||
    profile === 'preview' ||
    profile === 'production'
  ) {
    process.env.EXPO_PUBLIC_API_URL = RAILWAY_API_URL;
    process.env.EXPO_PUBLIC_TELEMETRY_URL = RAILWAY_TELEMETRY_URL;
    process.env.EXPO_PUBLIC_ENABLE_FIREBASE = 'false';
    delete process.env.EXPO_PUBLIC_TELEMETRY_WS_INGEST;
  } else {
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_TELEMETRY_URL;
    delete process.env.EXPO_PUBLIC_TELEMETRY_WS_INGEST;
    delete process.env.EXPO_PUBLIC_ENABLE_FIREBASE;
  }
  return fn({ config: {} });
};

describe('pilot-local build configuration', () => {
  test('uses an independent internal development profile', () => {
    expect(build['pilot-local']).toMatchObject({
      node: '22.13.0',
      developmentClient: true,
      distribution: 'internal',
      channel: 'pilot-local',
    });
    expect(build['pilot-local']).not.toHaveProperty('extends');
  });

  test('targets only the two ADB reverse service endpoints', () => {
    expect(build['pilot-local'].env.EXPO_PUBLIC_API_URL).toBe('http://localhost:8000');
    expect(build['pilot-local'].env.EXPO_PUBLIC_TELEMETRY_URL).toBe('http://localhost:8001');
  });

  test('explicitly disables the optional WS lane and requests Firebase off', () => {
    // This checks declared intent; Firebase consumers do not yet honor the flag.
    expect(build['pilot-local'].env.EXPO_PUBLIC_TELEMETRY_WS_INGEST).toBe('false');
    expect(build['pilot-local'].env.EXPO_PUBLIC_ENABLE_FIREBASE).toBe('false');
  });
});

describe('app.config.js resolved Android cleartext', () => {
  test('pilot-local enables Android cleartext to reach localhost via ADB reverse', () => {
    const resolved = resolveWithProfile('pilot-local') as { android?: { usesCleartextTraffic?: boolean } };
    expect(resolved.android?.usesCleartextTraffic).toBe(true);
  });

  test.each(['development', 'preview', 'production'] as const)(
    '%s profile does not enable Android cleartext',
    (profile) => {
      const resolved = resolveWithProfile(profile) as { android?: { usesCleartextTraffic?: boolean } };
      expect(resolved.android?.usesCleartextTraffic).toBeUndefined();
    },
  );

  test('default resolution without EAS profile does not enable Android cleartext', () => {
    const resolved = resolveWithProfile(null) as { android?: { usesCleartextTraffic?: boolean } };
    expect(resolved.android?.usesCleartextTraffic).toBeUndefined();
  });

  test('Railway URLs in development/preview/production remain exactly unchanged', () => {
    for (const profile of ['development', 'preview', 'production'] as const) {
      const resolved = resolveWithProfile(profile) as { extra?: Record<string, unknown> };
      // app.config.js does not source these from extra; the gates come from process.env.
      // Confirm the resolved process.env-driven values reach the test unchanged.
      expect(process.env.EXPO_PUBLIC_API_URL).toBe(RAILWAY_API_URL);
      expect(process.env.EXPO_PUBLIC_TELEMETRY_URL).toBe(RAILWAY_TELEMETRY_URL);
      // Sanity: extra still carries the documented Railway defaults.
      expect(resolved.extra?.EXPO_PUBLIC_API_URL).toBe(RAILWAY_API_URL);
      expect(resolved.extra?.EXPO_PUBLIC_TELEMETRY_URL).toBe(RAILWAY_TELEMETRY_URL);
      expect(profile in build).toBe(true);
      expect(build[profile].env.EXPO_PUBLIC_API_URL).toBe(RAILWAY_API_URL);
      expect(build[profile].env.EXPO_PUBLIC_TELEMETRY_URL).toBe(RAILWAY_TELEMETRY_URL);
    }
  });
});