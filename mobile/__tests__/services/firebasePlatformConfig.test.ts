import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

jest.mock('dotenv', () => ({ config: () => undefined }));

type AppConfigFn = (context: { config: Record<string, unknown> }) => {
  ios?: { googleServicesFile?: unknown };
  android?: { googleServicesFile?: unknown };
  plugins?: Array<string | [string, Record<string, unknown>]>;
};

const originalFirebaseFlag = process.env.EXPO_PUBLIC_ENABLE_FIREBASE;

const loadAppConfig = (): AppConfigFn => {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../../app.config.js') as { default: AppConfigFn }).default;
};

afterEach(() => {
  if (originalFirebaseFlag === undefined) {
    delete process.env.EXPO_PUBLIC_ENABLE_FIREBASE;
  } else {
    process.env.EXPO_PUBLIC_ENABLE_FIREBASE = originalFirebaseFlag;
  }
});

describe('platform-specific Google Services file gating', () => {
  test('enables each tracked platform-specific Google Services file', () => {
    const androidFile = resolve(__dirname, '../../google-services.json');
    const iosFile = resolve(__dirname, '../../GoogleService-Info.plist');

    expect(existsSync(androidFile)).toBe(true);
    expect(existsSync(iosFile)).toBe(true);

    process.env.EXPO_PUBLIC_ENABLE_FIREBASE = 'true';
    const resolved = loadAppConfig()({ config: {} });

    expect(resolved.android?.googleServicesFile).toBe('./google-services.json');
    expect(resolved.ios?.googleServicesFile).toBe('./GoogleService-Info.plist');
  });

  test('explicit Firebase opt-out clears Google Services files on both platforms', () => {
    process.env.EXPO_PUBLIC_ENABLE_FIREBASE = 'false';
    const resolved = loadAppConfig()({ config: {} });

    expect(resolved.android?.googleServicesFile).toBeUndefined();
    expect(resolved.ios?.googleServicesFile).toBeUndefined();
  });
});
