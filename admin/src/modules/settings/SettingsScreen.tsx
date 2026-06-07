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

export const SettingsScreen: React.FC = () => {
  const { user } = useAuth();
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
    language: 'en',
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

  const startMfaSetup = async () => {
    try {
      const { data } = await apiClient.post('/users/mfa/setup/');
      setMfaSetupUri(data.provisioning_uri || null);
      notifications.show({ title: 'MFA', message: 'Scan URI in authenticator app, then enter code.', color: 'blue' });
    } catch {
      notifications.show({ title: 'MFA', message: 'Setup failed.', color: 'red' });
    }
  };

  const confirmMfa = async () => {
    try {
      await apiClient.post('/users/mfa/enable/', { code: mfaCode });
      setMfaEnabled(true);
      setMfaSetupUri(null);
      setMfaCode('');
      notifications.show({ title: 'MFA', message: 'Two-factor authentication enabled.', color: 'green' });
    } catch {
      notifications.show({ title: 'MFA', message: 'Invalid code.', color: 'red' });
    }
  };

  const handleSave = () => {
    notifications.show({ title: 'Settings', message: 'Settings saved successfully.', color: 'green' });
  };

  const items = [
    {
      icon: <Bell size={22} />, color: 'indigo', title: 'Notifications', children: (
        <Stack gap="md">
          <Group justify="space-between"><Box><Text fw={600} size="sm">Push Notifications</Text><Text size="xs" c="dimmed">Real-time alerts for anomalies</Text></Box><Switch checked={settings.notifications} onChange={(e) => setSettings({ ...settings, notifications: e.currentTarget.checked })} /></Group>
          <Group justify="space-between"><Box><Text fw={600} size="sm">Weekly Email Digest</Text><Text size="xs" c="dimmed">Summary report every Monday</Text></Box><Switch checked={settings.emailDigest} onChange={(e) => setSettings({ ...settings, emailDigest: e.currentTarget.checked })} /></Group>
        </Stack>
      )
    },
    {
      icon: <PaintBucket size={22} />, color: 'violet', title: 'Appearance', children: (
        <Stack gap="md">
          <Group justify="space-between"><Box><Text fw={600} size="sm">Dark Mode</Text><Text size="xs" c="dimmed">Toggle dark/light theme</Text></Box><Switch checked={settings.darkMode} onChange={(e) => setSettings({ ...settings, darkMode: e.currentTarget.checked })} /></Group>
          <Select label="Language" value={settings.language} onChange={(v) => setSettings({ ...settings, language: v || 'pl' })} data={[{ value: 'pl', label: 'Polski' }, { value: 'en', label: 'English' }]} />
        </Stack>
      )
    },
    {
      icon: <Shield size={22} />, color: 'red', title: 'Security', children: (
        <Stack gap="md">
          <Button variant="light" color="red" leftSection={<Shield size={16} />}>Change Password</Button>
          {mfaLoading ? (
            <Stack gap="sm">
              <Skeleton height={20} width="60%" radius="md" />
              <Skeleton height={36} radius="md" />
            </Stack>
          ) : (
            <>
              <Group justify="space-between">
                <Box>
                  <Text fw={600} size="sm">Two-Factor Authentication (TOTP)</Text>
                  <Text size="xs" c="dimmed">{mfaEnabled ? 'Enabled' : 'Recommended for Global Owner'}</Text>
                </Box>
                <Switch checked={mfaEnabled} readOnly />
              </Group>
              {!mfaEnabled && (
                <>
                  <Button variant="light" onClick={startMfaSetup}>Set up MFA</Button>
                  {mfaSetupUri && <Code block style={{ fontSize: 10, wordBreak: 'break-all' }}>{mfaSetupUri}</Code>}
                  {mfaSetupUri && (
                    <Group>
                      <TextInput placeholder="6-digit code" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} maw={160} />
                      <Button onClick={confirmMfa}>Enable</Button>
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
      icon: <Zap size={22} />, color: 'orange', title: 'Performance', children: (
        <Stack gap="md"><Group justify="space-between"><Box><Text fw={600} size="sm">API Cache</Text><Text size="xs" c="dimmed">Redis-based caching</Text></Box><Switch defaultChecked /></Group></Stack>
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
    setWipeStatus({ running: true, phase: 'queued', progress_pct: 0, message: 'Starting prod wipe…' });
    try {
      const result = await SimulatorApi.wipeData((s) => setWipeStatus(s), {
        confirmPhrase: wipeConfirmPhrase,
        mfaConfirmed: wipeMfaAck,
        target: prodWipeTarget,
      });
      const warn = result?.warning;
      notifications.show({
        title: 'Prod data wiped',
        message: warn || 'Prod DB cleared (dashboard KPIs will refresh).',
        color: warn ? 'yellow' : 'green',
      });
      setWipeModalOpen(false);
      setWipeConfirmPhrase('');
      setWipeMfaAck(false);
    } catch (err: unknown) {
      if (err instanceof WipeStuckError) {
        setWipeStatus(err.status);
        notifications.show({
          title: 'Wipe stuck',
          message: err.message,
          color: 'orange',
        });
      } else {
        notifications.show({
          title: 'Wipe failed',
          message: formatApiError(err, 'Wipe failed.'),
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
        title: 'Data Wiped',
        message: result?.warning || 'All data except Global Owner has been deleted.',
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
        title: 'Recovery failed',
        message: formatApiError(err, 'Could not recover stuck wipe.'),
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
        title: 'Wipe cleared',
        message: 'Locks cleared. You can close this dialog or retry wipe.',
        color: 'teal',
      });
    } catch (err: unknown) {
      notifications.show({
        title: 'Unstick failed',
        message: formatApiError(err, 'Could not clear wipe locks.'),
        color: 'red',
      });
    }
  };

  return (
    <Box><PageHeader title="Settings" subtitle="Platform configuration and preferences" />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="xl">
        {items.map((item, i) => (
          <Card key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }} h="100%">
            <Group mb="md"><ThemeIcon size={36} radius="md" color={item.color} variant="light">{item.icon}</ThemeIcon><Text fw={700} size="lg">{item.title}</Text></Group>
            {item.children}
          </Card>
        ))}
      </SimpleGrid>
      <Button onClick={handleSave} size="md" style={{ background: 'var(--brand-gradient)', borderRadius: 10 }}>Save Settings</Button>

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
              Danger Zone
            </Text>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            Czyści <b>prod DB</b> (KPI na dashboardzie): użytkownicy, tenanty, działy i aktywności.
            {simTarget?.mode === 'sim-lab-proxy' && (
              <> Wipe w Simulatorze idzie na {simTarget.sim_lab_label || 'sim-lab'} — nie dotyka tych danych.</>
            )}
            {' '}CLI: <Code>node scripts/wipe-prod-local.mjs</Code>
          </Text>
          <Button color="red" variant="outline" leftSection={<Trash2 size={16} />} onClick={() => setWipeModalOpen(true)}>
            Wipe All Data
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
            title={<Text fw={700} c="red">⚠️ Wipe All Data</Text>}
            centered
          >
            <Stack gap="md">
              <Text size="sm" c="orange" fw={600}>
                Cel: prod Postgres (force_local) — status: GET wipe-data/?local=1
              </Text>
              <Text size="sm" c="dimmed">
                Stop 1/2: Type the exact phrase (role + environment).
              </Text>
              <Text size="sm">
                Usuwa z prod DB: aktywności, użytkowników (oprócz <b>GLOBAL_OWNER</b>), tenanty i działy.
                Type <b>exactly</b>: <span style={{ fontFamily: 'monospace' }}>&quot;{requiredWipePhrase}&quot;</span>
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
                label="Stop 2/2: I confirm (MFA-like checkbox) that I understand the consequences."
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
                    Reset and retry
                  </Button>
                  <Button color="gray" variant="outline" onClick={handleWipeUnstick} disabled={wiping}>
                    Clear locks only
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
                  ? `Wiping… ${(wipeStatus?.progress_pct ?? 0).toFixed(0)}%`
                  : 'Yes, Delete Everything'}
              </Button>
            </Stack>
          </Modal>
        </Card>
      )}
    </Box>
  );
};
