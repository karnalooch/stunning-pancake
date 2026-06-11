import * as Linking from 'expo-linking';
import { API_PATHS_FULL } from '@4velo/api-client';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://backend-production-55c7.up.railway.app';

export const SocialAuthService = {
  googleLoginUrl: () => `${BASE_URL}${API_PATHS_FULL.authGoogleLogin}?client=mobile`,
  facebookLoginUrl: () => `${BASE_URL}${API_PATHS_FULL.authFacebookLogin}?client=mobile`,

  parseCallbackUrl(url: string): { access: string; refresh: string } | null {
    const parsed = Linking.parse(url);
    const path = parsed.path ?? '';
    if (!path.includes('auth/callback')) {
      return null;
    }
    const access = parsed.queryParams?.access;
    const refresh = parsed.queryParams?.refresh;
    if (typeof access === 'string' && typeof refresh === 'string') {
      if (__DEV__) {
        console.log('[OAuth] Callback received for auth/callback');
      }
      return { access, refresh };
    }
    return null;
  },
};
