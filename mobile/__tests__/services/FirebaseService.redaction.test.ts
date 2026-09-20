const mockCrashLog = jest.fn();
const mockRecordError = jest.fn();
const mockAnalyticsLogEvent = jest.fn();

const mockFirebaseFactory = jest.fn(() => ({
  then: (onFulfilled: () => void) => {
    onFulfilled();
    return Promise.resolve();
  },
  analytics: () => ({
    logEvent: mockAnalyticsLogEvent,
  }),
}));

const mockCrashlyticsFactory = jest.fn(() => ({
  log: mockCrashLog,
  recordError: mockRecordError,
}));

jest.mock('@react-native-firebase/app', () => ({
  __esModule: true,
  default: mockFirebaseFactory,
}));

jest.mock('@react-native-firebase/crashlytics', () => ({
  __esModule: true,
  default: mockCrashlyticsFactory,
}));

import {
  firebaseCapture,
  initFirebase,
  setAnalyticsEvent,
} from '../../src/services/FirebaseService';

describe('FirebaseService redaction boundary', () => {
  const originalFirebaseFlag = process.env.EXPO_PUBLIC_ENABLE_FIREBASE;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_ENABLE_FIREBASE = 'true';
    mockCrashLog.mockReset();
    mockRecordError.mockReset();
    mockAnalyticsLogEvent.mockReset();
    mockFirebaseFactory.mockClear();
    mockCrashlyticsFactory.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    initFirebase();
  });

  afterEach(() => {
    if (originalFirebaseFlag === undefined) {
      delete process.env.EXPO_PUBLIC_ENABLE_FIREBASE;
    } else {
      process.env.EXPO_PUBLIC_ENABLE_FIREBASE = originalFirebaseFlag;
    }
    jest.restoreAllMocks();
  });

  test('does not initialize Firebase unless explicitly enabled', () => {
    process.env.EXPO_PUBLIC_ENABLE_FIREBASE = 'false';
    mockFirebaseFactory.mockClear();

    initFirebase();

    expect(mockFirebaseFactory).not.toHaveBeenCalled();
  });

  test('redacts secrets, identity and GPS before Crashlytics receives an error', () => {
    const error = new Error(
      'upload failed token=crash-secret lat=52.167123 email=rider@example.invalid',
    );

    firebaseCapture(error, 'GPS_UPLOAD token=context-secret lon=22.290456');

    expect(mockCrashLog).toHaveBeenCalledTimes(1);
    expect(mockRecordError).toHaveBeenCalledTimes(1);

    const crashLog = String(mockCrashLog.mock.calls[0][0]);
    const recorded = mockRecordError.mock.calls[0][0] as Error;
    const serialized = `${crashLog} ${recorded.message} ${recorded.stack ?? ''}`;

    for (const canary of [
      'crash-secret',
      'context-secret',
      '52.167123',
      '22.290456',
      'rider@example.invalid',
    ]) {
      expect(serialized).not.toContain(canary);
    }
    expect(serialized).toContain('[REDACTED]');
  });

  test('redacts analytics event names and payloads before Firebase receives them', () => {
    setAnalyticsEvent('ride token=analytics-secret', {
      email: 'analytics@example.invalid',
      coordinates: [52.1, 22.2],
      safe_counter: 7,
    });

    expect(mockAnalyticsLogEvent).toHaveBeenCalledTimes(1);
    const [name, params] = mockAnalyticsLogEvent.mock.calls[0];
    const serialized = JSON.stringify({ name, params });

    for (const canary of [
      'analytics-secret',
      'analytics@example.invalid',
      '52.1',
      '22.2',
    ]) {
      expect(serialized).not.toContain(canary);
    }
    expect(params).toMatchObject({
      email: '[REDACTED]',
      coordinates: '[REDACTED]',
      safe_counter: 7,
    });
  });
});
