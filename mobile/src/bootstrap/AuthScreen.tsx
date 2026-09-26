import React, { useState } from 'react';
import type { Observable } from '@legendapp/state';
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SceneBackground } from '../components/scene/SceneBackground';
import { APPROVED_ASSETS } from '../assets/approvedAssets';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import type { RideEdgeMessage } from '../services/apiRetry';
import { useI18n } from '../i18n/useI18n';
import { APP_BRAND_NAME } from '../theme/brand';
import type { AuthMode } from './useAuthSession';

type AuthState = {
  mode: AuthMode;
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
  onModeChange: (mode: AuthMode) => void;
  onSocialLogin: (provider: 'google' | 'facebook') => void;
};

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  colors: Record<string, string>;
  variant?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
  testID?: string;
};

function ActionButton({
  label,
  onPress,
  colors: C,
  variant = 'primary',
  disabled = false,
  testID,
}: ActionButtonProps) {
  const primary = variant === 'primary';
  const quiet = variant === 'quiet';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        quiet && styles.quietButton,
        {
          backgroundColor: primary ? C.goldAmber : quiet ? 'transparent' : C.surfaceContainerLowest,
          borderColor: quiet ? C.gpGoldLight : C.outlineVariant,
          opacity: disabled ? 0.55 : pressed ? 0.82 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          { color: primary ? C.onBackground : quiet ? C.gpGoldLight : C.onBackground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AuthScreen({
  auth,
  colors: C,
  banner,
  onDismissBanner,
  onSubmit,
  onModeChange,
  onSocialLogin,
}: Props) {
  const { t } = useI18n();
  const mode = auth.mode.get();
  const submitting = auth.isSubmitting.get();
  const [passwordVisible, setPasswordVisible] = useState(false);

  if (mode === 'welcome') {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: C.hudBackground }]}>
        <SceneBackground sceneId="onboarding" scrim="strong" />
        <View style={styles.welcomeLayout}>
          <View style={styles.brandBlock}>
            <Text style={[styles.brand, { color: C.gpGoldLight }]}>{APP_BRAND_NAME}</Text>
            <Text style={[styles.brandTag, { color: C.hudText }]}>{t.auth.brandTagline}</Text>
          </View>

          <ImageBackground
            source={APPROVED_ASSETS.homeHeroDay}
            resizeMode="cover"
            style={[styles.welcomeHero, { borderColor: C.gpGoldLight }]}
            imageStyle={styles.welcomeHeroImage}
            testID="auth-welcome-hero-approved"
          >
            <View style={[styles.welcomeHeroShade, { backgroundColor: C.scrimSoft }]} />
          </ImageBackground>

          <View style={[styles.welcomePanel, { backgroundColor: C.parchment, borderColor: C.goldAmber }]}>
            <Text style={[styles.eyebrow, { color: C.secondary }]}>{t.auth.welcomeEyebrow}</Text>
            <Text style={[styles.heroTitle, { color: C.onBackground }]}>{t.auth.welcomeTitle}</Text>
            <Text style={[styles.heroBody, { color: C.secondary }]}>{t.auth.welcomeBody}</Text>
            <View style={styles.actionStack}>
              <ActionButton
                label={t.auth.welcomePrimary}
                onPress={() => onModeChange('register')}
                colors={C}
                testID="auth-welcome-register"
              />
              <ActionButton
                label={t.auth.welcomeSecondary}
                onPress={() => onModeChange('login')}
                colors={C}
                variant="secondary"
                testID="auth-welcome-login"
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const isRegister = mode === 'register';
  const title = isRegister ? t.auth.registerTitle : t.auth.loginTitle;
  const subtitle = isRegister ? t.auth.registerSubtitle : t.auth.loginSubtitle;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: C.hudBackground }]}>
      <SceneBackground sceneId="onboarding" scrim="strong" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formBrandRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.auth.backToWelcome}
              onPress={() => onModeChange('welcome')}
              hitSlop={12}
            >
              <Text style={[styles.backText, { color: C.gpGoldLight }]}>‹ {t.auth.backToWelcome}</Text>
            </Pressable>
            <Text style={[styles.formBrand, { color: C.gpGoldLight }]}>{APP_BRAND_NAME}</Text>
          </View>

          {banner ? (
            <EdgeStateBanner
              title={banner.title}
              message={banner.message}
              variant={banner.variant}
              onDismiss={onDismissBanner}
            />
          ) : null}

          <View style={[styles.formPanel, { backgroundColor: C.parchment, borderColor: C.goldAmber }]}>
            <Text style={[styles.eyebrow, { color: C.secondary }]}>{t.auth.brandTagline}</Text>
            <Text style={[styles.formTitle, { color: C.onBackground }]}>{title}</Text>
            <Text style={[styles.formSubtitle, { color: C.secondary }]}>{subtitle}</Text>

            <View style={styles.fields}>
              {isRegister ? (
                <View>
                  <Text style={[styles.label, { color: C.secondary }]}>{t.auth.username}</Text>
                  <TextInput
                    testID="auth-username"
                    accessibilityLabel={t.auth.username}
                    style={[
                      styles.input,
                      {
                        color: C.onBackground,
                        borderColor: C.outlineVariant,
                        backgroundColor: C.surfaceContainerLowest,
                      },
                    ]}
                    placeholder={t.auth.username}
                    placeholderTextColor={C.secondary}
                    value={auth.username.get()}
                    onChangeText={(value) => auth.username.set(value)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>
              ) : null}

              <View>
                <Text style={[styles.label, { color: C.secondary }]}>
                  {isRegister ? t.auth.email : t.auth.identifier}
                </Text>
                <TextInput
                  testID="auth-email"
                  accessibilityLabel={isRegister ? t.auth.email : t.auth.identifier}
                  style={[
                    styles.input,
                    {
                      color: C.onBackground,
                      borderColor: C.outlineVariant,
                      backgroundColor: C.surfaceContainerLowest,
                    },
                  ]}
                  placeholder={isRegister ? t.auth.email : t.auth.identifier}
                  placeholderTextColor={C.secondary}
                  value={auth.email.get()}
                  onChangeText={(value) => auth.email.set(value)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={isRegister ? 'email-address' : 'default'}
                  returnKeyType="next"
                />
              </View>

              <View>
                <Text style={[styles.label, { color: C.secondary }]}>{t.auth.password}</Text>
                <View
                  style={[
                    styles.passwordRow,
                    {
                      borderColor: C.outlineVariant,
                      backgroundColor: C.surfaceContainerLowest,
                    },
                  ]}
                >
                  <TextInput
                    testID="auth-password"
                    accessibilityLabel={t.auth.password}
                    style={[styles.passwordInput, { color: C.onBackground }]}
                    placeholder={t.auth.password}
                    placeholderTextColor={C.secondary}
                    value={auth.password.get()}
                    onChangeText={(value) => auth.password.set(value)}
                    secureTextEntry={!passwordVisible}
                    autoCapitalize="none"
                    returnKeyType={isRegister ? 'next' : 'done'}
                    onSubmitEditing={() => {
                      if (!isRegister && !submitting) onSubmit();
                    }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={passwordVisible ? t.auth.hidePassword : t.auth.showPassword}
                    onPress={() => setPasswordVisible((visible) => !visible)}
                    hitSlop={10}
                  >
                    <Text style={[styles.passwordToggle, { color: C.primary }]}>
                      {passwordVisible ? t.auth.hidePassword : t.auth.showPassword}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {isRegister ? (
                <View>
                  <Text style={[styles.label, { color: C.secondary }]}>{t.auth.confirmPassword}</Text>
                  <TextInput
                    testID="auth-confirm-password"
                    accessibilityLabel={t.auth.confirmPassword}
                    style={[
                      styles.input,
                      {
                        color: C.onBackground,
                        borderColor: C.outlineVariant,
                        backgroundColor: C.surfaceContainerLowest,
                      },
                    ]}
                    placeholder={t.auth.confirmPassword}
                    placeholderTextColor={C.secondary}
                    value={auth.confirmPassword.get()}
                    onChangeText={(value) => auth.confirmPassword.set(value)}
                    secureTextEntry={!passwordVisible}
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (!submitting) onSubmit();
                    }}
                  />
                </View>
              ) : null}
            </View>

            <ActionButton
              label={submitting ? t.auth.connecting : isRegister ? t.auth.submitRegister : t.auth.submitLogin}
              onPress={onSubmit}
              colors={C}
              disabled={submitting}
              testID="auth-submit"
            />

            <Pressable
              accessibilityRole="button"
              onPress={() => onModeChange(isRegister ? 'login' : 'register')}
              disabled={submitting}
            >
              <Text style={[styles.switchMode, { color: C.primary }]}>
                {isRegister ? t.auth.toggleLogin : t.auth.toggleRegister}
              </Text>
            </Pressable>

            <View style={styles.socialBlock}>
              <Text style={[styles.socialLabel, { color: C.secondary }]}>{t.auth.orSocial}</Text>
              <View style={styles.socialRow}>
                <View style={styles.socialButtonWrap}>
                  <ActionButton
                    label={t.auth.google}
                    onPress={() => onSocialLogin('google')}
                    colors={C}
                    variant="secondary"
                    disabled={submitting}
                  />
                </View>
                <View style={styles.socialButtonWrap}>
                  <ActionButton
                    label={t.auth.facebook}
                    onPress={() => onSocialLogin('facebook')}
                    colors={C}
                    variant="secondary"
                    disabled={submitting}
                  />
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  welcomeLayout: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  brandBlock: { alignItems: 'center', gap: 4 },
  brand: { fontSize: 38, fontWeight: '900', letterSpacing: 1.5 },
  brandTag: { fontSize: 12, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  welcomeHero: {
    width: '100%',
    height: 176,
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  welcomeHeroImage: {
    borderRadius: 20,
  },
  welcomeHeroShade: {
    ...StyleSheet.absoluteFillObject,
  },
  welcomePanel: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 22,
    padding: 22,
    gap: 10,
  },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase' },
  heroTitle: { fontSize: 34, lineHeight: 39, fontWeight: '800' },
  heroBody: { fontSize: 16, lineHeight: 23 },
  actionStack: { gap: 10, marginTop: 10 },
  button: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  quietButton: { backgroundColor: 'transparent' },
  buttonText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.4 },
  formScroll: { flexGrow: 1, justifyContent: 'center', padding: 20, gap: 14 },
  formBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  backText: { fontSize: 15, fontWeight: '700' },
  formBrand: { fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  formPanel: { borderWidth: 1, borderRadius: 22, padding: 20, gap: 12 },
  formTitle: { fontSize: 30, lineHeight: 36, fontWeight: '800' },
  formSubtitle: { fontSize: 15, lineHeight: 21, marginBottom: 4 },
  fields: { gap: 14 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  passwordRow: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 10,
  },
  passwordInput: { flex: 1, minHeight: 48, fontSize: 16, paddingVertical: 0 },
  passwordToggle: { fontSize: 12, fontWeight: '800', paddingVertical: 10, paddingLeft: 10 },
  switchMode: { textAlign: 'center', fontSize: 14, fontWeight: '700', paddingVertical: 5 },
  socialBlock: { gap: 10, marginTop: 2 },
  socialLabel: { textAlign: 'center', fontSize: 13 },
  socialRow: { flexDirection: 'row', gap: 10 },
  socialButtonWrap: { flex: 1 },
});
