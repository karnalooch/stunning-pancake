import React, { useEffect, useState } from 'react';
import { clearStoredSession } from './tokens';
import { useAuth } from './useAuth';
import { TextInput, Button, Text, Stack, Box, Group, PasswordInput, Divider } from '@mantine/core';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ShieldCheck, Globe, Layers, AlertCircle } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const GOOGLE_AUTH_URL = `${API_BASE}/auth/google/login/?client=admin`;
const FACEBOOK_AUTH_URL = `${API_BASE}/auth/facebook/login/?client=admin`;

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<void>;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const { t } = useI18n();
  const logout = useAuth((s) => s.logout);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const features = [
    {
      icon: <Globe size={18} />,
      title: t.auth.featurePlatformTitle,
      desc: t.auth.featurePlatformDesc,
    },
    {
      icon: <ShieldCheck size={18} />,
      title: t.auth.featureAntiCheatTitle,
      desc: t.auth.featureAntiCheatDesc,
    },
    {
      icon: <Layers size={18} />,
      title: t.auth.featureWhiteLabelTitle,
      desc: t.auth.featureWhiteLabelDesc,
    },
  ];

  useEffect(() => {
    clearStoredSession();
    logout();
  }, [logout]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError(t.auth.fillAllFields);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onLogin(username, password);
    } catch (err: any) {
      setError(err?.message || t.auth.invalidCredentials);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--surface-secondary)',
      }}
    >
      {/* ── Left branding panel (desktop only) ──────── */}
      <Box
        visibleFrom="md"
        style={{
          width: '45%',
          minHeight: '100vh',
          background: 'linear-gradient(145deg, #3730A3 0%, #6366F1 40%, #8B5CF6 75%, #A855F7 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative blobs */}
        <Box
          style={{
            position: 'absolute',
            top: '-80px',
            right: '-80px',
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            pointerEvents: 'none',
          }}
        />
        <Box
          style={{
            position: 'absolute',
            bottom: '-60px',
            left: '-60px',
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
            pointerEvents: 'none',
          }}
        />
        <Box
          style={{
            position: 'absolute',
            top: '35%',
            left: '-40px',
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
            pointerEvents: 'none',
          }}
        />

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Group gap="sm">
            <Box
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(8px)',
              }}
            >
              <Zap size={20} color="white" fill="white" />
            </Box>
            <Text fw={900} size="lg" c="white" style={{ letterSpacing: '-0.02em' }}>
              4VELO
            </Text>
          </Group>
        </motion.div>

        {/* Hero text */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBlock: '40px' }}
        >
          <Text
            style={{
              fontSize: '34px',
              fontWeight: 900,
              color: 'white',
              lineHeight: 1.2,
              letterSpacing: '-0.025em',
              marginBottom: 12,
            }}
          >
            {t.auth.heroTitleLine1}
            <br />
            {t.auth.heroTitleLine2}
            <br />
            <span style={{ opacity: 0.75 }}>{t.auth.heroTitleLine3}</span>
          </Text>
          <Text
            style={{
              fontSize: '15px',
              color: 'rgba(255,255,255,0.65)',
              fontWeight: 400,
              lineHeight: 1.6,
              maxWidth: 340,
            }}
          >
            {t.auth.heroDesc}
          </Text>

          {/* Feature list */}
          <Stack gap="md" mt={36}>
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.25 + i * 0.1 }}
              >
                <Group gap="sm" align="flex-start">
                  <Box
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      background: 'rgba(255,255,255,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      flexShrink: 0,
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    {f.icon}
                  </Box>
                  <Stack gap={2}>
                    <Text size="sm" fw={700} c="white" style={{ lineHeight: 1.3 }}>
                      {f.title}
                    </Text>
                    <Text size="xs" style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                      {f.desc}
                    </Text>
                  </Stack>
                </Group>
              </motion.div>
            ))}
          </Stack>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {t.auth.footerCopyright}
          </Text>
        </motion.div>
      </Box>

      {/* ── Right form panel ─────────────────────────── */}
      <Box
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          background: 'var(--surface-secondary)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15 }}
          style={{ width: '100%', maxWidth: 400 }}
        >
          {/* Mobile logo */}
          <Box hiddenFrom="md" mb={32}>
            <Group gap="sm" justify="center">
              <Box
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'var(--brand-gradient)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Zap size={20} color="white" fill="white" />
              </Box>
              <Text fw={900} size="xl" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                4VELO
              </Text>
            </Group>
          </Box>

          {/* Form card */}
          <Box
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: '36px 32px',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <Stack gap={4} mb={28}>
              <Text
                style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                  lineHeight: 1.25,
                }}
              >
                {t.auth.welcomeBack}
              </Text>
              <Text size="sm" style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                {t.auth.loginIntro}
              </Text>
            </Stack>

            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <TextInput
                  label={t.auth.usernameOrEmail}
                  placeholder={t.auth.usernamePlaceholder}
                  value={username}
                  onChange={(e) => setUsername(e.currentTarget.value)}
                  required
                  autoComplete="username"
                  styles={{
                    label: {
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: 6,
                    },
                    input: {
                      height: 42,
                      borderRadius: 10,
                      fontSize: '14px',
                    },
                  }}
                />

                <PasswordInput
                  label={t.auth.password}
                  placeholder={t.auth.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  required
                  autoComplete="current-password"
                  styles={{
                    label: {
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: 6,
                    },
                    input: {
                      height: 42,
                      borderRadius: 10,
                      fontSize: '14px',
                    },
                  }}
                />

                {/* Error message */}
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Group
                        gap="xs"
                        style={{
                          padding: '10px 14px',
                          background: 'var(--danger-light)',
                          borderRadius: 10,
                          border: '1px solid rgba(239,68,68,0.2)',
                        }}
                      >
                        <AlertCircle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                        <Text size="sm" style={{ color: 'var(--danger)', fontWeight: 500 }}>
                          {error}
                        </Text>
                      </Group>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button
                  type="submit"
                  fullWidth
                  loading={loading}
                  size="md"
                  style={{
                    height: 44,
                    background: 'var(--brand-gradient)',
                    border: 'none',
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: '14px',
                    letterSpacing: '-0.01em',
                    transition: 'opacity 150ms ease, transform 150ms ease, box-shadow 150ms ease',
                    boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = '0.9';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(99,102,241,0.5)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px rgba(99,102,241,0.4)';
                  }}
                >
                  {loading ? t.auth.signingIn : t.auth.signIn}
                </Button>
              </Stack>
            </form>

            {/* Social Logins */}
            <Box mt="md">
              <Divider label={t.auth.orContinueWith} labelPosition="center" mb="md" />
              <Stack gap="xs">
                <Button
                  fullWidth
                  variant="outline"
                  size="md"
                  component="a"
                  href={GOOGLE_AUTH_URL}
                  leftSection={
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  }
                  style={{ height: 44, borderRadius: 10, borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  {t.auth.signInWithGoogle}
                </Button>

                <Button
                  fullWidth
                  variant="outline"
                  size="md"
                  component="a"
                  href={FACEBOOK_AUTH_URL}
                  leftSection={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  }
                  style={{ height: 44, borderRadius: 10, borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  {t.auth.signInWithFacebook}
                </Button>
              </Stack>
            </Box>
          </Box>

          <Text
            size="xs"
            ta="center"
            mt="lg"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t.auth.secureAuditNotice}
          </Text>
        </motion.div>
      </Box>
    </Box>
  );
};