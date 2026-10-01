import React, { useState } from 'react';
import type { Observable } from '@legendapp/state';
import { observer } from '@legendapp/state/react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { PrimaryButton } from '../components/product';
import { RoadbookRow } from '../components/roadbook/Surface';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import type { RideEdgeMessage } from '../services/apiRetry';
import { useI18n } from '../i18n/useI18n';
import { APP_BRAND_NAME } from '../theme/brand';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';
import type { AuthMode } from './useAuthSession';

type AuthState = { mode: AuthMode; email: string; username: string; password: string; confirmPassword: string; isSubmitting: boolean };
type Props = {
  auth: Observable<AuthState>;
  /** Kept for the bootstrap boundary; presentation uses the active semantic theme. */
  colors: Record<string, string>;
  banner?: RideEdgeMessage | null; onDismissBanner?: () => void;
  onSubmit: () => void; onModeChange: (mode: AuthMode) => void;
  onSocialLogin: (provider: 'google' | 'facebook') => void;
};
export const AuthScreen = observer(({ auth, banner, onDismissBanner, onSubmit, onModeChange, onSocialLogin }: Props) => {
  const { t } = useI18n();
  const { theme } = useUnistyles();
  const c = getSemanticColors(theme.colors);
  const mode = auth.mode.get();
  const submitting = auth.isSubmitting.get();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isRegister = mode === 'register';
  const changeMode = (next: AuthMode) => { if (!submitting) { setPasswordVisible(false); onModeChange(next); } };
  const submit = () => { if (!auth.isSubmitting.get()) onSubmit(); };
  return <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID="roadbook-auth">
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>{APP_BRAND_NAME}</Text>
        <Text style={styles.caption}>{t.auth.brandTagline}</Text>
        {banner ? <EdgeStateBanner title={banner.title} message={banner.message} variant={banner.variant} onDismiss={onDismissBanner} /> : null}
        {mode === 'welcome' ? <View style={styles.welcome}>
          <Text accessibilityRole="header" style={styles.welcomeTitle}>{t.auth.welcomeTitle}</Text>
          <Text style={styles.body}>{t.auth.welcomeBody}</Text>
          <View style={styles.actions}>
            <PrimaryButton label={t.auth.welcomePrimary} onPress={() => changeMode('register')} testID="auth-welcome-register" />
            <PrimaryButton label={t.auth.welcomeSecondary} onPress={() => changeMode('login')} variant="secondary" testID="auth-welcome-login" />
          </View>
        </View> : <>
          <RoadbookRow label={t.auth.backToWelcome} onPress={() => changeMode('welcome')} disabled={submitting} />
          <Text accessibilityRole="header" style={styles.title}>{isRegister ? t.auth.registerTitle : t.auth.loginTitle}</Text>
          <Text style={styles.body}>{isRegister ? t.auth.registerSubtitle : t.auth.loginSubtitle}</Text>
          {isRegister ? <View style={styles.field}>
            <Text style={styles.label}>{t.auth.username}</Text>
            <TextInput testID="auth-username" accessibilityLabel={t.auth.username} style={styles.input}
              placeholder={t.auth.username} placeholderTextColor={c.text.secondary} value={auth.username.get()}
              onChangeText={(value) => auth.username.set(value)} editable={!submitting}
              autoCapitalize="none" autoCorrect={false} autoComplete="username-new" returnKeyType="next" />
          </View> : null}
          <View style={styles.field}>
            <Text style={styles.label}>{isRegister ? t.auth.email : t.auth.identifier}</Text>
            <TextInput testID="auth-email" accessibilityLabel={isRegister ? t.auth.email : t.auth.identifier}
              style={styles.input} placeholder={isRegister ? t.auth.email : t.auth.identifier} placeholderTextColor={c.text.secondary}
              value={auth.email.get()} onChangeText={(value) => auth.email.set(value)} editable={!submitting}
              autoCapitalize="none" autoCorrect={false} keyboardType={isRegister ? 'email-address' : 'default'}
              autoComplete={isRegister ? 'email' : 'username'} returnKeyType="next" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>{t.auth.password}</Text>
            <TextInput testID="auth-password" accessibilityLabel={t.auth.password} style={styles.input}
              placeholder={t.auth.password} placeholderTextColor={c.text.secondary} value={auth.password.get()}
              onChangeText={(value) => auth.password.set(value)} secureTextEntry={!passwordVisible}
              editable={!submitting} autoCapitalize="none" autoCorrect={false}
              autoComplete={isRegister ? 'new-password' : 'current-password'} returnKeyType={isRegister ? 'next' : 'done'}
              onSubmitEditing={() => { if (!isRegister) submit(); }} />
            <RoadbookRow label={passwordVisible ? t.auth.hidePassword : t.auth.showPassword}
              onPress={() => setPasswordVisible((value) => !value)} testID="auth-password-visibility" />
          </View>
          {isRegister ? <View style={styles.field}>
            <Text style={styles.label}>{t.auth.confirmPassword}</Text>
            <TextInput testID="auth-confirm-password" accessibilityLabel={t.auth.confirmPassword} style={styles.input}
              placeholder={t.auth.confirmPassword} placeholderTextColor={c.text.secondary} value={auth.confirmPassword.get()}
              onChangeText={(value) => auth.confirmPassword.set(value)} secureTextEntry={!passwordVisible}
              editable={!submitting} autoCapitalize="none" autoCorrect={false} autoComplete="new-password"
              returnKeyType="done" onSubmitEditing={submit} />
          </View> : null}
          <PrimaryButton label={submitting ? t.auth.connecting : isRegister ? t.auth.submitRegister : t.auth.submitLogin}
            onPress={submit} disabled={submitting} testID="auth-submit" />
          <RoadbookRow label={isRegister ? t.auth.toggleLogin : t.auth.toggleRegister}
            onPress={() => changeMode(isRegister ? 'login' : 'register')} disabled={submitting} />
          <Text style={styles.caption}>{t.auth.orSocial}</Text>
          <View style={styles.actions}>
            <PrimaryButton label={t.auth.google} variant="secondary" disabled={submitting} onPress={() => onSocialLogin('google')} testID="auth-google" />
            <PrimaryButton label={t.auth.facebook} variant="secondary" disabled={submitting} onPress={() => onSocialLogin('facebook')} testID="auth-facebook" />
          </View>
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
});
const styles = StyleSheet.create((theme) => {
  const c = getSemanticColors(theme.colors);
  return {
    root: { flex: 1, backgroundColor: c.canvas.background }, flex: { flex: 1 },
    content: { padding: 24, gap: 18, flexGrow: 1, maxWidth: 640, width: '100%', alignSelf: 'center' },
    brand: { ...PRODUCT_TYPOGRAPHY.title, color: c.action.primary, marginTop: 16 },
    caption: { ...PRODUCT_TYPOGRAPHY.metricLabel, color: c.text.secondary },
    title: { ...PRODUCT_TYPOGRAPHY.displayEditorial, color: c.text.primary },
    welcome: { flexGrow: 1, justifyContent: 'center', gap: 28, paddingVertical: 40 },
    welcomeTitle: { ...PRODUCT_TYPOGRAPHY.displayEditorial, fontSize: 48, lineHeight: 56, color: c.text.primary },
    body: { ...PRODUCT_TYPOGRAPHY.body, lineHeight: 25, color: c.text.secondary },
    field: { gap: 8 }, label: { ...PRODUCT_TYPOGRAPHY.bodyMedium, color: c.text.primary },
    input: { minHeight: 54, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: c.border.strong,
      borderRadius: 8, backgroundColor: c.surface.default, ...PRODUCT_TYPOGRAPHY.body, color: c.text.primary },
    actions: { gap: 12 },
  };
});
