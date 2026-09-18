jest.mock('dotenv', () => ({ config: () => undefined }));

const mockExistsSync = jest.fn<boolean, [import('node:fs').PathLike]>();

jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: (path: import('node:fs').PathLike) => mockExistsSync(path),
  };
});

type AppConfigFn = (context: { config: Record<string, unknown> }) => {
  ios?: { googleServicesFile?: unknown };
  android?: { googleServicesFile?: unknown };
  plugins?: Array<string | [string, Record<string, unknown>]>;
};

type FilePresence = {
  android: boolean;
  ios: boolean;
};

const originalFirebaseFlag = process.env.EXPO_PUBLIC_ENABLE_FIREBASE;
let filePresence: FilePresence = { android: true, ios: true };

const configureFilePresence = (presence: FilePresence) => {
  filePresence = presence;
  mockExistsSync.mockImplementation((candidate) => {
    const value = String(candidate);
    if (value.endsWith('google-services.json')) return filePresence.android;
    if (value.endsWith('GoogleService-Info.plist')) return filePresence.ios;
    return false;
  });
};

const loadAppConfig = (): AppConfigFn => {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../../app.config.js') as { default: AppConfigFn }).default;
};

beforeEach(() => {
  mockExistsSync.mockReset();
  configureFilePresence({ android: true, ios: true });
  delete process.env.EXPO_PUBLIC_ENABLE_FIREBASE;
});

afterEach(() => {
  if (originalFirebaseFlag === undefined) {
    delete process.env.EXPO_PUBLIC_ENABLE_FIREBASE;
  } else {
    process.env.EXPO_PUBLIC_ENABLE_FIREBASE = originalFirebaseFlag;
  }
});

describe('platform-specific Google Services config behavior', () => {
  test.each([
    {
      name: 'both platform artifacts present',
      presence: { android: true, ios: true },
      android: './google-services.json',
      ios: './GoogleService-Info.plist',
    },
    {
      name: 'Android artifact only',
      presence: { android: true, ios: false },
      android: './google-services.json',
      ios: undefined,
    },
    {
      name: 'iOS artifact only',
      presence: { android: false, ios: true },
      android: undefined,
      ios: './GoogleService-Info.plist',
    },
    {
      name: 'neither platform artifact present',
      presence: { android: false, ios: false },
      android: undefined,
      ios: undefined,
    },
  ])('$name', ({ presence, android, ios }) => {
    configureFilePresence(presence);
    process.env.EXPO_PUBLIC_ENABLE_FIREBASE = 'true';

    const resolved = loadAppConfig()({ config: {} });

    expect(resolved.android?.googleServicesFile).toBe(android);
    expect(resolved.ios?.googleServicesFile).toBe(ios);
  });

  test('explicit Firebase opt-out clears both platform files even when both exist', () => {
    configureFilePresence({ android: true, ios: true });
    process.env.EXPO_PUBLIC_ENABLE_FIREBASE = 'false';

    const resolved = loadAppConfig()({ config: {} });

    expect(resolved.android?.googleServicesFile).toBeUndefined();
    expect(resolved.ios?.googleServicesFile).toBeUndefined();
  });
});
