import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { observable } from '@legendapp/state';
import { AuthScreen } from '../../src/bootstrap/AuthScreen';
import { stringsPl } from '../../src/i18n/strings.pl';

// Keep the real Legend observer and shared controls: only native boundaries and
// locale persistence are substituted. The Jest resolver owns React identity.
jest.mock('react-native-unistyles', () => {
  const { grandPrixTheme } = jest.requireActual('../../src/theme/grandPrix');
  return { useUnistyles: () => ({ theme: grandPrixTheme }),
    StyleSheet: { create: (factory: unknown) => typeof factory === 'function' ? factory(grandPrixTheme) : factory } };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('../../src/i18n/useI18n', () => ({ useI18n: () => ({ locale: 'pl', t: require('../../src/i18n/strings.pl').stringsPl }) }));

let tree: TestRenderer.ReactTestRenderer | undefined;
afterEach(() => { act(() => tree?.unmount()); tree = undefined; });
// Query real control semantics, not the identity of a memo/forwardRef export.
// Stop at the first matching boundary so its native descendants are not duplicates.
const control = (testID: string, predicate: (node: TestRenderer.ReactTestInstance) => boolean) => {
  const matches = tree!.root.findAll((node) => node.props.testID === testID && predicate(node), { deep: false });
  const node = matches[0];
  if (matches.length !== 1 || !node) throw new Error(`expected one control ${testID}, found ${matches.length}`);
  return node;
};
const button = (testID: string) => control(testID, (node) =>
  node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function');
const input = (testID: string) => control(testID, (node) =>
  typeof node.props.accessibilityLabel === 'string' && typeof node.props.onChangeText === 'function');
const render = async (mode: 'welcome' | 'login' | 'register' = 'login') => {
  const auth = observable({ mode, email: '', username: '', password: '', confirmPassword: '', isSubmitting: false });
  const onSubmit = jest.fn(); const onModeChange = jest.fn(); const onSocialLogin = jest.fn();
  await act(async () => { tree = TestRenderer.create(<AuthScreen auth={auth} colors={{}}
    onSubmit={onSubmit} onModeChange={onModeChange} onSocialLogin={onSocialLogin} />); });
  return { auth, onSubmit, onModeChange, onSocialLogin };
};

describe('Roadbook AuthScreen with real observable updates', () => {
  test('renders localized login affordances and binds edits to the actual observable', async () => {
    const { auth, onSubmit } = await render();
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('4VELO');
    expect(json).toContain(stringsPl.auth.loginTitle);
    expect(button('auth-submit').props.accessibilityLabel).toBe(stringsPl.auth.submitLogin);
    await act(async () => { input('auth-email').props.onChangeText('rider@example.test'); });
    expect(auth.email.get()).toBe('rider@example.test');
    expect(input('auth-email').props.value).toBe('rider@example.test');
    act(() => button('auth-submit').props.onPress());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
  test('busy state disables editing, submission and social actions without bypassing the submit guard', async () => {
    const { auth, onSubmit } = await render();
    const submit = button('auth-submit').props.onPress;
    await act(async () => { auth.isSubmitting.set(true); });
    expect(input('auth-email').props.editable).toBe(false);
    expect(input('auth-password').props.editable).toBe(false);
    for (const id of ['auth-submit', 'auth-google', 'auth-facebook']) {
      expect(button(id).props.disabled).toBe(true);
      expect(button(id).props.accessibilityState.disabled).toBe(true);
    }
    act(() => submit());
    expect(onSubmit).not.toHaveBeenCalled();
  });
  test('password visibility is explicit and registration exposes confirmation', async () => {
    const { auth } = await render('register');
    expect(input('auth-password').props.secureTextEntry).toBe(true);
    expect(input('auth-confirm-password').props.secureTextEntry).toBe(true);
    act(() => button('auth-password-visibility').props.onPress());
    expect(input('auth-password').props.secureTextEntry).toBe(false);
    await act(async () => { input('auth-confirm-password').props.onChangeText('confirmation'); });
    expect(auth.confirmPassword.get()).toBe('confirmation');
  });
  test('Welcome keeps registration and login actions usable without artwork', async () => {
    const { onModeChange } = await render('welcome');
    act(() => button('auth-welcome-register').props.onPress());
    act(() => button('auth-welcome-login').props.onPress());
    expect(onModeChange.mock.calls).toEqual([['register'], ['login']]);
  });
});
