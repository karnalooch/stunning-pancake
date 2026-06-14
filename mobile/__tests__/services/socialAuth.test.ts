describe('SocialAuthService env policy', () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  const loadSocialAuth = (): typeof import('../../src/services/socialAuth') => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../src/services/socialAuth');
  };

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    if (originalApiUrl == null) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    }
    Object.defineProperty(globalThis, '__DEV__', {
      value: originalDev,
      writable: true,
      configurable: true,
    });
    jest.restoreAllMocks();
  });

  test('returns null social URLs in non-dev without EXPO_PUBLIC_API_URL', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    Object.defineProperty(globalThis, '__DEV__', {
      value: false,
      writable: true,
      configurable: true,
    });

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { SocialAuthService } = loadSocialAuth();

    expect(SocialAuthService.googleLoginUrl()).toBeNull();
    expect(SocialAuthService.facebookLoginUrl()).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      '[OAuth] Missing EXPO_PUBLIC_API_URL. Configure runtime env before release builds.',
    );
  });

  test('uses dev fallback URL when __DEV__ is true', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    Object.defineProperty(globalThis, '__DEV__', {
      value: true,
      writable: true,
      configurable: true,
    });

    const { SocialAuthService } = loadSocialAuth();

    expect(SocialAuthService.googleLoginUrl()).toContain('backend-production-55c7.up.railway.app');
    expect(SocialAuthService.facebookLoginUrl()).toContain('backend-production-55c7.up.railway.app');
  });
});
