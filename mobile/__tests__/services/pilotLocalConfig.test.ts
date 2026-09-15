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

type PluginEntry = string | [string, Record<string, unknown>];

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

const loadAppConfig = (): AppConfigFn => {
  // Re-require on every call so process.env mutations between tests produce a
  // fresh module graph (avoiding stale env captured by top-level reads).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require('../../app.config.js') as { default: AppConfigFn };
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

const isCleartextPluginEntry = (
  entry: PluginEntry,
): entry is [string, { android: { usesCleartextTraffic?: boolean } }] =>
  Array.isArray(entry) &&
  entry[0] === 'expo-build-properties' &&
  typeof entry[1]?.android === 'object';

const findCleartextPluginEntries = (
  plugins: PluginEntry[],
): [string, { android: { usesCleartextTraffic?: boolean } }][] =>
  plugins.filter(isCleartextPluginEntry);

const findAnyBuildPropertiesEntries = (
  plugins: PluginEntry[],
): [string, Record<string, unknown>][] =>
  plugins.filter(
    (entry): entry is [string, Record<string, unknown>] =>
      Array.isArray(entry) && entry[0] === 'expo-build-properties',
  );

describe('pilot-local eas.json contract', () => {
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

  test('Railway URLs in development/preview/production remain exactly unchanged in eas.json', () => {
    for (const profile of ['development', 'preview', 'production'] as const) {
      expect(profile in build).toBe(true);
      expect(build[profile].env.EXPO_PUBLIC_API_URL).toBe(RAILWAY_API_URL);
      expect(build[profile].env.EXPO_PUBLIC_TELEMETRY_URL).toBe(RAILWAY_TELEMETRY_URL);
    }
  });
});

describe('app.config.js resolved Android cleartext plugin', () => {
  test('pilot-local registers expo-build-properties with android.usesCleartextTraffic=true', () => {
    const resolved = resolveWithProfile('pilot-local') as { plugins?: PluginEntry[] };
    const entries = findCleartextPluginEntries(resolved.plugins ?? []);
    expect(entries).toHaveLength(1);
    const first = entries[0];
    if (!first) throw new Error('expected one cleartext plugin entry');
    expect(first[1].android.usesCleartextTraffic).toBe(true);
  });

  test('pilot-local registers expo-build-properties exactly once', () => {
    const resolved = resolveWithProfile('pilot-local') as { plugins?: PluginEntry[] };
    const entries = findAnyBuildPropertiesEntries(resolved.plugins ?? []);
    expect(entries).toHaveLength(1);
  });

  test('pilot-local exposes no iOS keys to expo-build-properties', () => {
    const resolved = resolveWithProfile('pilot-local') as { plugins?: PluginEntry[] };
    const entries = findCleartextPluginEntries(resolved.plugins ?? []);
    expect(entries).toHaveLength(1);
    const first = entries[0];
    if (!first) throw new Error('expected one cleartext plugin entry');
    const opts = first[1] as { android?: unknown; ios?: unknown };
    expect(opts.ios).toBeUndefined();
  });

  test.each(['development', 'preview', 'production'] as const)(
    '%s profile does not register expo-build-properties for cleartext',
    (profile) => {
      const resolved = resolveWithProfile(profile) as { plugins?: PluginEntry[] };
      expect(findCleartextPluginEntries(resolved.plugins ?? [])).toEqual([]);
    },
  );

  test('default resolution without EAS profile does not register expo-build-properties for cleartext', () => {
    const resolved = resolveWithProfile(null) as { plugins?: PluginEntry[] };
    expect(findCleartextPluginEntries(resolved.plugins ?? [])).toEqual([]);
  });

  test('unknown EAS profile does not register expo-build-properties for cleartext', () => {
    const resolved = resolveWithProfile('mystery-profile') as { plugins?: PluginEntry[] };
    expect(findCleartextPluginEntries(resolved.plugins ?? [])).toEqual([]);
  });

  test('development profile with overridden localhost URL still does not register cleartext plugin', () => {
    // Regression guard: EAS_BUILD_PROFILE is the security boundary. Even if a
    // developer overrides EXPO_PUBLIC_API_URL to localhost while keeping the
    // development profile, cleartext must remain disabled so a Railway-bound
    // development build never talks HTTP in cleartext.
    const resolved = resolveWithProfile('development', {
      EXPO_PUBLIC_API_URL: 'http://localhost:8000',
    }) as { plugins?: PluginEntry[] };
    expect(findCleartextPluginEntries(resolved.plugins ?? [])).toEqual([]);
    expect(process.env.EAS_BUILD_PROFILE).toBe('development');
    expect(process.env.EXPO_PUBLIC_API_URL).toBe('http://localhost:8000');
  });

  test('unset profile with localhost API/telemetry does not register cleartext plugin', () => {
    // Regression guard: the cleartext gate must depend solely on EAS_BUILD_PROFILE.
    // A misconfigured shell that exports EXPO_PUBLIC_API_URL=http://localhost:8000
    // without setting EAS_BUILD_PROFILE must NOT register the cleartext plugin.
    const resolved = resolveWithProfile(null, {
      EXPO_PUBLIC_API_URL: 'http://localhost:8000',
      EXPO_PUBLIC_TELEMETRY_URL: 'http://localhost:8001',
    }) as { plugins?: PluginEntry[] };
    expect(findCleartextPluginEntries(resolved.plugins ?? [])).toEqual([]);
  });

  test('resolved pilot-local contract matches the documented pilot-local profile', () => {
    // The full contract the pilot-local artifact must satisfy: development
    // client on the pilot-local channel talking to localhost only, with WS
    // ingest and Firebase explicitly disabled.
    expect(build['pilot-local']).toMatchObject({
      developmentClient: true,
      channel: 'pilot-local',
    });
    expect(build['pilot-local'].env).toMatchObject({
      EXPO_PUBLIC_API_URL: 'http://localhost:8000',
      EXPO_PUBLIC_TELEMETRY_URL: 'http://localhost:8001',
      EXPO_PUBLIC_TELEMETRY_WS_INGEST: 'false',
      EXPO_PUBLIC_ENABLE_FIREBASE: 'false',
    });
  });

  test('Railway URLs in development/preview/production remain exactly unchanged in resolved app.config.js', () => {
    for (const profile of ['development', 'preview', 'production'] as const) {
      const resolved = resolveWithProfile(profile) as { extra?: Record<string, unknown> };
      // app.config.js does not source these from extra; the gates come from
      // process.env. Confirm the resolved process.env-driven values reach the
      // test unchanged and the documented Railway defaults are still exported.
      expect(process.env.EXPO_PUBLIC_API_URL).toBe(RAILWAY_API_URL);
      expect(process.env.EXPO_PUBLIC_TELEMETRY_URL).toBe(RAILWAY_TELEMETRY_URL);
      expect(resolved.extra?.EXPO_PUBLIC_API_URL).toBe(RAILWAY_API_URL);
      expect(resolved.extra?.EXPO_PUBLIC_TELEMETRY_URL).toBe(RAILWAY_TELEMETRY_URL);
    }
  });

  test('preserves the original plugins (expo-location, expo-font, maplibre) when adding the cleartext plugin', () => {
    const resolved = resolveWithProfile('pilot-local') as { plugins?: PluginEntry[] };
    const pluginNames = (resolved.plugins ?? []).map((p) =>
      Array.isArray(p) ? p[0] : p,
    );
    expect(pluginNames).toEqual(
      expect.arrayContaining([
        'expo-location',
        'expo-font',
        '@maplibre/maplibre-react-native',
        'expo-build-properties',
      ]),
    );
  });
});
