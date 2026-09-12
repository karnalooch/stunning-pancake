import React, { useMemo, useState, useEffect } from 'react';
import { Card, Text, Group, Stack, Switch, Select, Button, Box, SimpleGrid, ThemeIcon, Modal, Checkbox, TextInput, Code, Skeleton } from '@mantine/core';
import { apiClient } from '../../api/client';
import { Bell, PaintBucket, Shield, Zap, Trash2, AlertTriangle } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '../../core/components/PageHeader';
import { useAuth } from '../../core/auth/useAuth';
import { WipeProgressBar } from '../analytics/SimulationProgressBar';
import {
  formatApiError,
  SimulatorApi,
  WipeStuckError,
  type SimTargetInfo,
  type WipeProgressStatus,
} from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { API_PATHS } from '@4velo/api-client';

export const SettingsScreen: React.FC = () => {
  const { user } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const isGlobalOwner = user?.role === 'GLOBAL_OWNER';

  const environmentLabel = useMemo(
    () => (import.meta.env.DEV ? 'DEVELOPMENT' : 'PRODUCTION'),
    [],
  );

  const requiredWipePhrase = useMemo(
    () => `DELETE ALL DATA — ${environmentLabel} — GLOBAL_OWNER`,
    [environmentLabel],
  );

  const [settings, setSettings] = useState({
    notifications: true,
    emailDigest: false,
    darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    language: locale,
  });

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaSetupUri, setMfaSetupUri] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  useEffect(() => {
    setMfaLoading(true);
    apiClient.get('/users/mfa/status/')
      .then((r) => setMfaEnabled(Boolean(r.data?.mfa_enabled)))
      .catch(() => {})
      .finally(() => setMfaLoading(false));
  }, []);

  useEffect(() => {
    setSettings((prev) => ({ ...prev, language: locale }));
  }, [locale]);

  useEffect(() => {
    apiClient.get(API_PATHS.userPreferences)
      .then((r) => {
        const p = r.data || {};
        if (p.language === 'pl' || p.language === 'en') setLocale(p.language);
        setSettings((prev) => ({
          ...prev,
          notifications: p.notifications ?? prev.notifications,
          emailDigest: p.emailDigest ?? prev.emailDigest,
          darkMode: p.darkMode ?? prev.darkMode,
          language: p.language ?? prev.language,
        }));
      })
      .catch(() => {});
  }, [setLocale]);

  const startMfaSetup = async () => {
    try {
      const { data } = await apiClient.post('/users/mfa/setup/');
      setMfaSetupUri(data.provisioning_uri || null);
      notifications.show({ title: 'MFA', message: t.settings.mfaScanNotice, color: 'blue' });
    } catch {
      notifications.show({ title: 'MFA', message: t.settings.mfaSetupFailed, color: 'red' });
    }
  };

  const confirmMfa = async () => {
    try {
      const { data } = await apiClient.post('/users/mfa/enable/', { code: mfaCode });
      if (data.access && data.refresh) {
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        useAuth.setState({ token: data.access, refreshToken: data.refresh });
      }
      setMfaEnabled(true);
      setMfaSetupUri(null);
      setMfaCode('');
      notifications.show({ title: 'MFA', message: t.settings.mfaEnabledNotice, color: 'green' });
    } catch {
      notifications.show({ title: 'MFA', message: t.settings.mfaInvalidCode, color: 'red' });
    }
  };

  const handleSave = async () => {
    try {
      await apiClient.patch(API_PATHS.userPreferences, {
        notifications: settings.notifications,
        emailDigest: settings.emailDigest,
        darkMode: settings.darkMode,
        language: settings.language,
      });
      notifications.show({ title: t.settings.title, message: t.settings.saveOk, color: 'green' });
    } catch {
      notifications.show({ title: t.common.error, message: t.settings.saveFailed, color: 'red' });
    }
  };

  const items = [
    {
      icon: <Bell size={22} />, color: 'indigo', title: t.settings.notificationsTitle, children: (
        <Stack gap="md">
          <Group justify="space-between"><Box><Text fw={600} size="sm">{t.settings.pushNotifications}</Text><Text size="xs" c="dimmed">{t.settings.pushNotificationsDesc}</Text></Box><Switch checked={settings.notifications} onChange={(e) => setSettings({ ...settings, notifications: e.currentTarget.checked })} /></Group>
          <Group justify="space-between"><Box><Text fw={600} size="sm">{t.settings.weeklyDigest}</Text><Text size="xs" c="dimmed">{t.settings.weeklyDigestDesc}</Text></Box><Switch checked={settings.emailDigest} onChange={(e) => setSettings({ ...settings, emailDigest: e.currentTarget.checked })} /></Group>
        </Stack>
      )
    },
    {
      icon: <PaintBucket size={22} />, color: 'violet', title: t.settings.appearanceTitle, children: (
        <Stack gap="md">
          <Group justify="space-between"><Box><Text fw={600} size="sm">{t.settings.darkMode}</Text><Text size="xs" c="dimmed">{t.settings.darkModeDesc}</Text></Box><Switch checked={settings.darkMode} onChange={(e) => setSettings({ ...settings, darkMode: e.currentTarget.checked })} /></Group>
          <Select
            label={t.settings.languageLabel}
            value={settings.language}
            onChange={(v) => {
              const next = (v || 'pl') as 'pl' | 'en';
              setSettings({ ...settings, language: next });
              setLocale(next);
            }}
            data={[{ value: 'pl', label: 'Polski' }, { value: 'en', label: 'English' }]}
          />
        </Stack>
      )
    },
    {
      icon: <Shield size={22} />, color: 'red', title: t.settings.securityTitle, children: (
        <Stack gap="md">
          <Button variant="light" color="red" leftSection={<Shield size={16} />}>{t.settings.changePassword}</Button>
          {mfaLoading ? (
              <Stack gap="sm">
                <Skeleton height={20} width="60%" radius="md" />
                <Skeleton height={36} radius="md" />
              </Stack>
            ) : (
              <>
                <Group justify="space-between">
                  <Box>
                    <Text fw={600} size="sm">{t.settings.mfaTitle}</Text>
                    <Text size="xs" c="dimmed">{mfaEnabled ? t.settings.mfaEnabled : t.settings.mfaOptional}</Text>
                  </Box>
                  <Switch checked={mfaEnabled} readOnly />
                </Group>
                {!mfaEnabled && (
                  <>
                    <Button variant="light" onClick={startMfaSetup}>{t.settings.mfaSetup}</Button>
                    {mfaSetupUri && <Code block style={{ fontSize: 10, wordBreak: 'break-all' }}>{mfaSetupUri}</Code>}
                    {mfaSetupUri && (
                      <Group>
                        <TextInput placeholder={t.settings.mfaCodePlaceholder} value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} maw={160} />
                        <Button onClick={confirmMfa}>{t.settings.mfaEnable}</Button>
                      </Group>
                    )}
                  </>
                )}
              </>
            )}
        </Stack>
      )
    },
    {
      icon: <Zap size={22} />, color: 'orange', title: t.settings.performanceTitle, children: (
        <Stack gap="md"><Group justify="space-between"><Box><Text fw={600} size="sm">{t.settings.apiCache}</Text><Text size="xs" c="dimmed">{t.settings.apiCacheDesc}</Text></Box><Switch defaultChecked /></Group></Stack>
      )
    },
  ];

  const [simTarget, setSimTarget] = useState<SimTargetInfo | null>(null);
  const [wipeModalOpen, setWipeModalOpen] = useState(false);
  const [wipeConfirmPhrase, setWipeConfirmPhrase] = useState('');
  const [wipeMfaAck, setWipeMfaAck] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [wipeStatus, setWipeStatus] = useState<WipeProgressStatus | null>(null);

  const prodWipeTarget = 'prod-local' as const;

  useEffect(() => {
    SimulatorApi.getSimTarget().then(setSimTarget).catch(() => setSimTarget(null));
    SimulatorApi.getWipeStatus(prodWipeTarget)
      .then((ws) => {
        if (SimulatorApi.isWipeActive(ws)) {
          setWipeStatus(ws);
          setWiping(SimulatorApi.isWipeBlocked(ws));
          setWipeModalOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  const isWipeBlocked = wiping || SimulatorApi.isWipeBlocked(wipeStatus);
  const isWipeStuck = Boolean(wipeStatus?.stuck) && !wiping;

  const handleWipe = async () => {
    setWiping(true);
    setWipeStatus({ running: true, phase: 'queued', progress_pct: 0, message: t.settings.wipeButton });
    try {
      const result = await SimulatorApi.wipeData((s) => setWipeStatus(s), {
        confirmPhrase: wipeConfirmPhrase,
        mfaConfirmed: wipeMfaAck,
        target: prodWipeTarget,
      });
      const warn = result?.warning;
      notifications.show({
        title: t.settings.wipeDone,
        message: warn || t.settings.wipeDoneMsg,
        color: warn ? 'yellow' : 'green',
      });
      setWipeModalOpen(false);
      setWipeConfirmPhrase('');
      setWipeMfaAck(false);
    } catch (err: unknown) {
      if (err instanceof WipeStuckError) {
        setWipeStatus(err.status);
        notifications.show({
          title: t.settings.wipeStuck,
          message: err.message,
          color: 'orange',
        });
      } else {
        notifications.show({
          title: t.settings.wipeFailed,
          message: formatApiError(err, t.settings.wipeFailed),
          color: 'red',
        });
      }
    } finally {
      setWiping(false);
    }
  };

  const handleWipeRecover = async () => {
    setWiping(true);
    try {
      const restarted = await SimulatorApi.recoverStuckWipe({
        confirmPhrase: wipeConfirmPhrase,
        mfaConfirmed: wipeMfaAck,
        target: prodWipeTarget,
      });
      setWipeStatus(restarted);
      const result = await SimulatorApi.wipeData((s) => setWipeStatus(s), {
        confirmPhrase: wipeConfirmPhrase,
        mfaConfirmed: wipeMfaAck,
        target: prodWipeTarget,
      });
      notifications.show({
        title: t.settings.dataWiped,
        message: result?.warning || t.settings.dataWipedMsg,
        color: result?.warning ? 'yellow' : 'green',
      });
      setWipeModalOpen(false);
      setWipeConfirmPhrase('');
      setWipeMfaAck(false);
    } catch (err: unknown) {
      if (err instanceof WipeStuckError) {
        setWipeStatus(err.status);
      }
      notifications.show({
        title: t.settings.wipeRecoveryFailed,
        message: formatApiError(err, t.settings.wipeRecoveryFailedMsg),
        color: 'red',
      });
    } finally {
      setWiping(false);
    }
  };

  const handleWipeUnstick = async () => {
    try {
      const cleared = await SimulatorApi.forceUnstickWipe(prodWipeTarget);
      setWipeStatus(cleared);
      setWiping(false);
      notifications.show({
        title: t.settings.wipeCleared,
        message: t.settings.wipeClearedMsg,
        color: 'teal',
      });
    } catch (err: unknown) {
      notifications.show({
        title: t.settings.wipeUnstickFailed,
        message: formatApiError(err, t.settings.wipeUnstickFailedMsg),
        color: 'red',
      });
    }
  };

  return (
    <Box><PageHeader title={t.settings.title} subtitle={t.settings.subtitle} />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="xl">
        {items.map((item, i) => (
          <Card key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }} h="100%">
            <Group mb="md"><ThemeIcon size={36} radius="md" color={item.color} variant="light">{item.icon}</ThemeIcon><Text fw={700} size="lg">{item.title}</Text></Group>
            {item.children}
          </Card>
        ))}
      </SimpleGrid>
      <Button onClick={handleSave} size="md" style={{ background: 'var(--brand-gradient)', borderRadius: 10 }}>{t.settings.saveSettings}</Button>

      {/* Danger Zone */}
      {isGlobalOwner && (
        <Card
          mt="xl"
          style={{ background: 'var(--surface)', border: '2px solid var(--mantine-color-red-6)', borderRadius: 14, padding: 24 }}
        >
          <Group mb="md">
            <ThemeIcon size={36} radius="md" color="red" variant="light">
              <AlertTriangle size={20} />
            </ThemeIcon>
            <Text fw={700} size="lg" c="red">
              {t.settings.dangerZone}
            </Text>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            {t.settings.wipeDesc}
            {simTarget?.mode === 'sim-lab-proxy' && (
              <> {t.settings.wipeSimLabNotice.replace('{label}', simTarget.sim_lab_label || 'sim-lab')}</>
            )}
            {' '}CLI: <Code>node scripts/wipe-prod-local.mjs</Code>
          </Text>
          <Button color="red" variant="outline" leftSection={<Trash2 size={16} />} onClick={() => setWipeModalOpen(true)}>
            {t.settings.wipeButton}
          </Button>

          <Modal
            opened={wipeModalOpen}
            onClose={() => {
              if (isWipeBlocked) return;
              setWipeModalOpen(false);
              setWipeConfirmPhrase('');
              setWipeMfaAck(false);
            }}
            closeOnClickOutside={!isWipeBlocked}
            closeOnEscape={!isWipeBlocked}
            title={<Text fw={700} c="red">⚠️ {t.settings.wipeModalTitle}</Text>}
            centered
          >
            <Stack gap="md">
              <Text size="sm" c="orange" fw={600}>
                {t.settings.wipeTargetLabel}
              </Text>
              <Text size="sm" c="dimmed">
                {t.settings.wipeStepOne}
              </Text>
              <Text size="sm">
                {t.settings.wipeStepOneDesc}{' '}
                <span style={{ fontFamily: 'monospace' }}>&quot;{requiredWipePhrase}&quot;</span>
              </Text>

              <input
                type="text"
                value={wipeConfirmPhrase}
                onChange={(e) => setWipeConfirmPhrase(e.target.value)}
                placeholder={requiredWipePhrase}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--mantine-color-red-6)',
                  borderRadius: 8,
                  background: 'var(--surface-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  width: '100%',
                  fontFamily: 'monospace',
                }}
              />

              <Checkbox
                checked={wipeMfaAck}
                onChange={(e) => setWipeMfaAck(e.currentTarget.checked)}
                label={t.settings.wipeStepTwo}
              />

              {(wiping || wipeStatus) && (
                <WipeProgressBar
                  running={SimulatorApi.isWipeBlocked(wipeStatus) || wiping}
                  progressPct={wipeStatus?.progress_pct ?? 0}
                  phase={wipeStatus?.phase}
                  phaseLabel={wipeStatus?.phase_label}
                  message={wipeStatus?.message}
                  tablesDone={wipeStatus?.tables_done}
                  tablesTotal={wipeStatus?.tables_total}
                  rowsDeleted={wipeStatus?.rows_deleted}
                  deleted={wipeStatus?.deleted}
                  startedAt={wipeStatus?.started_at ?? undefined}
                  error={wipeStatus?.error ?? undefined}
                  stuck={wipeStatus?.stuck || isWipeStuck}
                  stuckReason={wipeStatus?.stuck_reason}
                />
              )}

              {(wipeStatus?.stuck || isWipeStuck) && !isWipeBlocked && (
                <Group grow>
                  <Button color="orange" variant="light" onClick={handleWipeRecover} loading={wiping}>
                    {t.settings.wipeResetRetry}
                  </Button>
                  <Button color="gray" variant="outline" onClick={handleWipeUnstick} disabled={wiping}>
                    {t.settings.wipeClearLocks}
                  </Button>
                </Group>
              )}

              <Button
                color="red"
                fullWidth
                leftSection={<Trash2 size={16} />}
                loading={isWipeBlocked}
                disabled={isWipeBlocked || wipeConfirmPhrase !== requiredWipePhrase || !wipeMfaAck}
                onClick={handleWipe}
              >
                {isWipeBlocked
                  ? t.settings.wipeInProgress.replace('{pct}', (wipeStatus?.progress_pct ?? 0).toFixed(0))
                  : t.settings.wipeConfirm}
              </Button>
            </Stack>
          </Modal>
        </Card>
      )}
    </Box>
  );
};
