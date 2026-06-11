import React from 'react';
import type { Observable } from '@legendapp/state';
import { Column } from '../components/Column';
import { PixelText } from '../components/PixelText';
import { ArcadeButton } from '../components/ArcadeButton';
import { RetroInput } from '../components/RetroInput';

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
  onSubmit: () => void;
  onToggleMode: () => void;
  onSocialLogin: (provider: 'google' | 'facebook') => void;
};

export function AuthScreen({ auth, colors, onSubmit, onToggleMode, onSocialLogin }: Props) {
  const C = colors;
  const mode = auth.mode.get();

  return (
    <Column flex={1} style={{ backgroundColor: C.background, justifyContent: 'center' }} padding={24} gap={24}>
      <Column alignItems="center" style={{ marginBottom: 16 }}>
        <PixelText size="2xl" color={C.primary} style={{ fontSize: 36, color: C.primary }}>
          4VELO
        </PixelText>
        <PixelText size="xs" color={C.secondary} style={{ marginTop: 8, color: C.secondary }}>
          {mode === 'login' ? 'MISSION LOGIN' : 'NEW PILOT REGISTRATION'}
        </PixelText>
      </Column>

      <Column gap={16}>
        {mode === 'register' && (
          <RetroInput
            placeholder="PILOT_NAME"
            value={auth.username.get()}
            onChangeText={(v: string) => auth.username.set(v)}
          />
        )}
        <RetroInput
          testID="auth-email"
          placeholder="EMAIL / OPERATOR ID"
          value={auth.email.get()}
          onChangeText={(v: string) => auth.email.set(v)}
          autoCapitalize="none"
        />
        <RetroInput
          testID="auth-password"
          placeholder="ACCESS TOKEN"
          value={auth.password.get()}
          onChangeText={(v: string) => auth.password.set(v)}
          secureTextEntry
        />
        {mode === 'register' && (
          <RetroInput
            placeholder="CONFIRM ACCESS TOKEN"
            value={auth.confirmPassword.get()}
            onChangeText={(v: string) => auth.confirmPassword.set(v)}
            secureTextEntry
          />
        )}
      </Column>

      <Column gap={16} style={{ marginTop: 16 }}>
        <ArcadeButton
          variant="primary"
          onPress={onSubmit}
          disabled={auth.isSubmitting.get()}
          label={
            auth.isSubmitting.get()
              ? 'CONNECTING...'
              : mode === 'login'
                ? 'AUTHORIZE'
                : 'REGISTER PILOT'
          }
        />
        <ArcadeButton
          variant="ghost"
          onPress={onToggleMode}
          label={mode === 'login' ? 'NEW PILOT? REGISTER' : 'EXISTING PILOT? LOGIN'}
          size="sm"
        />
        <PixelText size="xs" color={C.secondary} style={{ textAlign: 'center', marginTop: 8, color: C.secondary }}>
          OR CONTINUE WITH
        </PixelText>
        <ArcadeButton
          variant="secondary"
          onPress={() => onSocialLogin('google')}
          disabled={auth.isSubmitting.get()}
          label="GOOGLE"
          size="sm"
        />
        <ArcadeButton
          variant="secondary"
          onPress={() => onSocialLogin('facebook')}
          disabled={auth.isSubmitting.get()}
          label="FACEBOOK"
          size="sm"
        />
      </Column>
    </Column>
  );
}
