import { useCallback, useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { useObservable } from '@legendapp/state/react';
import type { UserProfile } from '@4velo/api-client';
import { BrandingService } from '../services/BrandingService';
import { initFirebase } from '../services/FirebaseService';
import { SocialAuthService } from '../services/socialAuth';
import {
  clearSession,
  loadProfileAfterOAuth,
  loginAndLoadProfile,
  registerAndLogin,
  restoreSessionFromStorage,
} from '../services/authSession';
import { AuthService } from '../services/api';
import { registerDevicePushToken } from '../services/PushNotificationService';
import { setOnSessionExpired } from '../services/apiClient';
import { isOnboardingCompleteForUser, setOnboardingCompleteForUser } from './storage';
import { e2eConfig, isE2eAutoLoginEnabled } from './e2eConfig';

const BYPASS_AUTH = false;

export function useAuthSession(onUserReady: (userId: number | null) => Promise<void>) {
  const auth = useObservable({
    isAuthenticated: false,
    isOnboarded: false,
    isLoading: true,
    isSubmitting: false,
    mode: 'login' as 'login' | 'register',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    user: null as UserProfile | null,
  });

  const applyUserSession = useCallback(
    async (user: UserProfile) => {
      auth.user.set(user);
      auth.isAuthenticated.set(true);
      auth.isOnboarded.set(isOnboardingCompleteForUser(user.id));
      const userId = user?.id != null ? Number(user.id) : null;
      await onUserReady(userId);
      if (user.tenant_id) {
        BrandingService.fetch(user.tenant_id);
      }
      registerDevicePushToken().catch(() => null);
    },
    [auth, onUserReady],
  );

  const handleSessionExpired = useCallback(() => {
    auth.user.set(null);
    auth.isAuthenticated.set(false);
    auth.email.set('');
    auth.password.set('');
  }, [auth]);

  useEffect(() => {
    initFirebase();
    setOnSessionExpired(handleSessionExpired);

    void (async () => {
      const token = await restoreSessionFromStorage();
      if (token) {
        try {
          const user = await AuthService.getProfile();
          await applyUserSession(user);
        } catch {
          await clearSession();
        } finally {
          auth.isLoading.set(false);
        }
        return;
      }

      if (isE2eAutoLoginEnabled()) {
        auth.isSubmitting.set(true);
        try {
          const user = await loginAndLoadProfile(e2eConfig.email, e2eConfig.password);
          if (e2eConfig.skipOnboarding) {
            setOnboardingCompleteForUser(user.id);
          }
          await applyUserSession(user);
        } catch {
          auth.isOnboarded.set(false);
        } finally {
          auth.isSubmitting.set(false);
          auth.isLoading.set(false);
        }
        return;
      }

      auth.isLoading.set(false);
    })();

    return () => setOnSessionExpired(null);
  }, [applyUserSession, auth, handleSessionExpired]);

  const completeOAuthLogin = useCallback(
    async (access: string, refresh: string) => {
      const user = await loadProfileAfterOAuth(access, refresh);
      await applyUserSession(user);
    },
    [applyUserSession],
  );

  useEffect(() => {
    const handleOAuthUrl = async (url: string | null) => {
      if (!url) return;
      const tokens = SocialAuthService.parseCallbackUrl(url);
      if (!tokens) return;
      auth.isSubmitting.set(true);
      try {
        await completeOAuthLogin(tokens.access, tokens.refresh);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Could not complete social login.';
        Alert.alert('OAuth Failed', msg);
      } finally {
        auth.isSubmitting.set(false);
      }
    };

    void Linking.getInitialURL().then(handleOAuthUrl);
    const sub = Linking.addEventListener('url', ({ url }) => void handleOAuthUrl(url));
    return () => sub.remove();
  }, [auth, completeOAuthLogin]);

  const openSocialLogin = async (provider: 'google' | 'facebook') => {
    const url =
      provider === 'google'
        ? SocialAuthService.googleLoginUrl()
        : SocialAuthService.facebookLoginUrl();
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unavailable', 'Could not open the login page.');
    }
  };

  const handleOnboardingFinish = async (options?: { refreshProfile?: boolean }) => {
    const userId = auth.user.get()?.id;
    if (userId != null) {
      setOnboardingCompleteForUser(userId);
    }
    if (options?.refreshProfile !== false) {
      try {
        const profile = await AuthService.getProfile();
        auth.user.set(profile);
      } catch {
        // Ignore refresh errors and still complete onboarding locally.
      }
    }
    auth.isOnboarded.set(true);
  };

  const handleAuth = async () => {
    if (!auth.email.get() || !auth.password.get()) {
      Alert.alert('Missing Info', 'Please fill in all required fields.');
      return;
    }
    if (auth.mode.get() === 'register') {
      if (!auth.username.get()) {
        Alert.alert('Missing Info', 'Choose a pilot name (username).');
        return;
      }
      if (auth.password.get() !== auth.confirmPassword.get()) {
        Alert.alert('Mismatch', 'Passwords do not match.');
        return;
      }
    }

    auth.isSubmitting.set(true);
    try {
      if (auth.mode.get() === 'login') {
        const user = await loginAndLoadProfile(auth.email.get(), auth.password.get());
        await applyUserSession(user);
      } else {
        const user = await registerAndLogin(
          {
            email: auth.email.get(),
            username: auth.username.get(),
            password: auth.password.get(),
            tenant_id: 'siedlce-city',
          },
          auth.email.get(),
          auth.password.get(),
        );
        await applyUserSession(user);
        Alert.alert('Welcome!', 'Your account is ready. Welcome to Grupetto Siedlce.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Auth service unavailable.';
      Alert.alert('Operation Failed', msg);
    } finally {
      auth.isSubmitting.set(false);
    }
  };

  const handleLogout = async () => {
    await clearSession();
    auth.user.set(null);
    auth.isAuthenticated.set(false);
    auth.email.set('');
    auth.password.set('');
  };

  return {
    auth,
    BYPASS_AUTH,
    handleAuth,
    handleLogout,
    handleOnboardingFinish,
    openSocialLogin,
  };
}
