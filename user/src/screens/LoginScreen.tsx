/**
 * Login Screen — SPORT Mobile App
 * ==================================
 * Milestone 2: React Native Fabric/JSI migration
 * Constitution §9.1: Optimistic UI + JWT Auth
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { api } from '../services/api';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

interface Props {
  onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<Props> = ({ onLoginSuccess }) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Podaj email i hasło.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.login(email.trim(), password);
      onLoginSuccess?.();
    } catch (err: unknown) {
      setError('Nieprawidłowe dane logowania. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />

      {/* Logo / brand */}
      <View style={styles.brand}>
        <Text style={styles.brandIcon}>🏃</Text>
        <Text style={styles.brandTitle}>SPORT</Text>
        <Text style={styles.brandSub}>Track. Compete. Connect.</Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>EMAIL</Text>
          <TextInput
            id="login-email"
            style={styles.input}
            placeholder="twoj@email.pl"
            placeholderTextColor="#3a4a5a"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>HASŁO</Text>
          <TextInput
            id="login-password"
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#3a4a5a"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
            onSubmitEditing={handleLogin}
            returnKeyType="go"
          />
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠ {error}</Text>
          </View>
        )}

        <TouchableOpacity
          id="login-submit"
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityLabel="Zaloguj się"
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.loginBtnText}>ZALOGUJ SIĘ</Text>
          }
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>v0.1.0-alpha — SPORT Platform</Text>
    </KeyboardAvoidingView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0a0e1a', justifyContent: 'center', paddingHorizontal: 28 },
  brand:           { alignItems: 'center', marginBottom: 48 },
  brandIcon:       { fontSize: 64, marginBottom: 12 },
  brandTitle:      { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: 8 },
  brandSub:        { fontSize: 14, color: '#5a6a7a', marginTop: 6, letterSpacing: 2 },
  form:            { gap: 16 },
  inputWrapper:    { gap: 6 },
  inputLabel:      { fontSize: 11, fontWeight: '700', color: '#5a6a7a', letterSpacing: 1.5 },
  input: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e2a3a',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#fff',
  },
  errorBox:        { backgroundColor: 'rgba(255,77,77,0.1)', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: 'rgba(255,77,77,0.3)' },
  errorText:       { color: '#ff4d4d', fontSize: 13 },
  loginBtn:        { backgroundColor: '#00d2ff', borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 8 },
  loginBtnDisabled:{ backgroundColor: '#1a3a4a' },
  loginBtnText:    { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 2 },
  footer:          { textAlign: 'center', color: '#2a3a4a', fontSize: 11, marginTop: 40 },
});
