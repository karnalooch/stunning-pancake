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
  'EAS_BUILD_PROFILE',
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

const loadAppConfig = (): AppConfigFn => {
  // Cache the module reference locally so TypeScript can narrow the nullable
  // module-level `appConfigModule` across the if-block. Assign back to the
  // cache only after the local value is established; never widen to `any` and
  // never use a non-null assertion.
  let module = appConfigModule;
  if (!module) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    module = require('../../app.config.js') as { default: AppConfigFn };
    appConfigModule = module;
  }
  return module.default;
};

const resolveWithProfile = (
  profile: string | null,
  overrides: Record<string, string | null> = {},
) => {
  const fn = loadAppConfig();
  if (profile === 'pilot-local') {
    process.env.EAS_BUILD_PROFILE = 'pilot-local';
    process.env.EXPO_PUBLIC_API_URL = PILOT_LOCAL_API_URL;
    process.env.EXPO_PUBLIC_TELEMETRY_URL = PILOT_LOCAL_TELEMETRY_URL;
    process.env.EXPO_PUBLIC_TELEMETRY_WS_INGEST = 'false';
    process.env.EXPO_PUBLIC_ENABLE_FIREBASE = 'false';
  } else if (
    profile === 'development' ||
    profile === 'preview' ||
    profile === 'production'
  ) {
    process.env.EAS_BUILD_PROFILE = profile;
    process.env.EXPO_PUBLIC_API_URL = RAILWAY_API_URL;
    process.env.EXPO_PUBLIC_TELEMETRY_URL = RAILWAY_TELEMETRY_URL;
    process.env.EXPO_PUBLIC_ENABLE_FIREBASE = 'false';
    delete process.env.EXPO_PUBLIC_TELEMETRY_WS_INGEST;
  } else {
    delete process.env.EAS_BUILD_PROFILE;
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_TELEMETRY_URL;
    delete process.env.EXPO_PUBLIC_TELEMETRY_WS_INGEST;
    delete process.env.EXPO_PUBLIC_ENABLE_FIREBASE;
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
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

  test('localhost API URL without EAS_BUILD_PROFILE still does not enable Android cleartext', () => {
    // Regression guard: the cleartext gate must depend solely on EAS_BUILD_PROFILE.
    // A misconfigured shell that exports EXPO_PUBLIC_API_URL=http://localhost:8000
    // without setting EAS_BUILD_PROFILE must NOT enable cleartext.
    const resolved = resolveWithProfile(null, {
      EXPO_PUBLIC_API_URL: 'http://localhost:8000',
      EXPO_PUBLIC_TELEMETRY_URL: 'http://localhost:8001',
    }) as { android?: { usesCleartextTraffic?: boolean } };
    expect(resolved.android?.usesCleartextTraffic).toBeUndefined();
  });

  test('development profile with overridden localhost URL still does not enable Android cleartext', () => {
    // Regression guard: EAS_BUILD_PROFILE is the security boundary. Even if a
    // developer overrides EXPO_PUBLIC_API_URL to localhost while keeping the
    // development profile, cleartext must remain disabled so a Railway-bound
    // development build never talks HTTP in cleartext.
    const resolved = resolveWithProfile('development', {
      EXPO_PUBLIC_API_URL: 'http://localhost:8000',
    }) as { android?: { usesCleartextTraffic?: boolean } };
    expect(resolved.android?.usesCleartextTraffic).toBeUndefined();
    expect(process.env.EAS_BUILD_PROFILE).toBe('development');
    expect(process.env.EXPO_PUBLIC_API_URL).toBe('http://localhost:8000');
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