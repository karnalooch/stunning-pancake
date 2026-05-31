import * as Linking from 'expo-linking';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://backend-production-55c7.up.railway.app';

export const SocialAuthService = {
  googleLoginUrl: () => `${BASE_URL}/api/auth/google/login/?client=mobile`,
  facebookLoginUrl: () => `${BASE_URL}/api/auth/facebook/login/?client=mobile`,

  parseCallbackUrl(url: string): { access: string; refresh: string } | null {
    const parsed = Linking.parse(url);
    const path = parsed.path ?? '';
    if (!path.includes('auth/callback')) {
      return null;
    }
    const access = parsed.queryParams?.access;
    const refresh = parsed.queryParams?.refresh;
    if (typeof access === 'string' && typeof refresh === 'string') {
      return { access, refresh };
    }
    return null;
  },
};
