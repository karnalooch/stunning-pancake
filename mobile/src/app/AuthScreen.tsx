import React from 'react';
import type { Observable } from '@legendapp/state';
import { View } from 'react-native';
import { Column } from '../components/Column';
import { PixelText } from '../components/PixelText';
import { ArcadeButton } from '../components/ArcadeButton';
import { RetroInput } from '../components/RetroInput';
import { SceneBackground } from '../components/scene/SceneBackground';
import { CyclistSprite } from '../components/sprites/CyclistSprite';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import type { RideEdgeMessage } from '../services/apiRetry';
import { useI18n } from '../i18n/useI18n';
import { APP_BRAND_NAME } from '../theme/brand';

type AuthState = {
  mode: 'login' | 'register';
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  isSubmitting: boolean;
};

type Props = {
  auth: Observable<AuthState>;
  colors: Record<string, string>;
  banner?: RideEdgeMessage | null;
  onDismissBanner?: () => void;
  onSubmit: () => void;
  onToggleMode: () => void;
  onSocialLogin: (provider: 'google' | 'facebook') => void;
};

export function AuthScreen({ auth, colors, banner, onDismissBanner, onSubmit, onToggleMode, onSocialLogin }: Props) {
  const C = colors;
  const mode = auth.mode.get();
  const { enabled: immersiveEnabled } = useImmersiveTheme();
  const { t } = useI18n();

  return (
    <View style={{ flex: 1, backgroundColor: immersiveEnabled ? 'transparent' : C.background }}>
      <SceneBackground sceneId="onboarding" scrim={immersiveEnabled ? 'none' : 'soft'} />
      <Column flex={1} style={{ justifyContent: 'center' }} padding={24} gap={24}>
      {banner ? (
        <EdgeStateBanner
          title={banner.title}
          message={banner.message}
          variant={banner.variant}
          onDismiss={onDismissBanner}
        />
      ) : null}
      <Column
        alignItems="center"
        style={{
          marginBottom: 16,
          backgroundColor: 'rgba(245, 230, 204, 0.92)',
          borderWidth: 2,
          borderColor: C.hudOutline ?? C.onBackground,
          borderRadius: 12,
          padding: 20,
          width: '100%',
        }}
      >
        <CyclistSprite size={72} state="idle" expressionMode />
        <PixelText size="2xl" color="primary" style={{ fontSize: 36, marginTop: 12 }}>
          {APP_BRAND_NAME}
        </PixelText>
        <PixelText size="xs" color="secondary" style={{ marginTop: 8 }}>
          {mode === 'login' ? t.auth.loginTitle.toUpperCase() : t.auth.registerTitle.toUpperCase()}
        </PixelText>
      </Column>

      <Column
        gap={16}
        style={{
          backgroundColor: 'rgba(245, 230, 204, 0.95)',
          borderWidth: 2,
          borderColor: C.hudOutline ?? C.onBackground,
          borderRadius: 12,
          padding: 16,
        }}
      >
        {mode === 'register' && (
          <RetroInput
            placeholder={t.auth.username.toUpperCase()}
            value={auth.username.get()}
            onChangeText={(v: string) => auth.username.set(v)}
          />
        )}
        <RetroInput
          testID="auth-email"
          placeholder={t.auth.email.toUpperCase()}
          value={auth.email.get()}
          onChangeText={(v: string) => auth.email.set(v)}
          autoCapitalize="none"
        />
        <RetroInput
          testID="auth-password"
          placeholder={t.auth.password.toUpperCase()}
          value={auth.password.get()}
          onChangeText={(v: string) => auth.password.set(v)}
          secureTextEntry
        />
        {mode === 'register' && (
          <RetroInput
            placeholder={t.auth.confirmPassword.toUpperCase()}
            value={auth.confirmPassword.get()}
            onChangeText={(v: string) => auth.confirmPassword.set(v)}
            secureTextEntry
          />
        )}
      </Column>

      <Column
        gap={16}
        style={{
          marginTop: 16,
          backgroundColor: 'rgba(245, 230, 204, 0.95)',
          borderWidth: 2,
          borderColor: C.hudOutline ?? C.onBackground,
          borderRadius: 12,
          padding: 16,
        }}
      >
        <ArcadeButton
          variant="primary"
          onPress={onSubmit}
          disabled={auth.isSubmitting.get()}
          label={
            auth.isSubmitting.get()
              ? t.auth.connecting.toUpperCase()
              : mode === 'login'
                ? t.auth.submitLogin
                : t.auth.submitRegister
          }
        />
        <ArcadeButton
          variant="ghost"
          onPress={onToggleMode}
          label={mode === 'login' ? t.auth.toggleRegister.toUpperCase() : t.auth.toggleLogin.toUpperCase()}
          size="sm"
        />
        <PixelText size="xs" color="secondary" style={{ textAlign: 'center', marginTop: 8 }}>
          {t.auth.orSocial.toUpperCase()}
        </PixelText>
        <ArcadeButton
          variant="secondary"
          onPress={() => onSocialLogin('google')}
          disabled={auth.isSubmitting.get()}
          label={t.auth.google.toUpperCase()}
          size="sm"
        />
        <ArcadeButton
          variant="secondary"
          onPress={() => onSocialLogin('facebook')}
          disabled={auth.isSubmitting.get()}
          label={t.auth.facebook.toUpperCase()}
          size="sm"
        />
      </Column>
      </Column>
    </View>
  );
}
