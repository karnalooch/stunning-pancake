import React, { useMemo, useState } from 'react';
import { Card, Text, Group, Stack, Switch, Select, Button, Box, SimpleGrid, ThemeIcon, Modal, Checkbox } from '@mantine/core';
import { Bell, PaintBucket, Shield, Zap, Trash2, AlertTriangle } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '../../core/components/PageHeader';
import { useAuth } from '../../core/auth/useAuth';
import { WipeProgressBar } from '../analytics/SimulationProgressBar';
import { formatApiError, SimulatorApi, type WipeProgressStatus } from '../../api/client';

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
        <Stack gap="md"><Button variant="light" color="red" leftSection={<Shield size={16} />}>Change Password</Button></Stack>
      )
    },
    {
      icon: <Zap size={22} />, color: 'orange', title: 'Performance', children: (
        <Stack gap="md"><Group justify="space-between"><Box><Text fw={600} size="sm">API Cache</Text><Text size="xs" c="dimmed">Redis-based caching</Text></Box><Switch defaultChecked /></Group></Stack>
      )
    },
  ];

  const [wipeModalOpen, setWipeModalOpen] = useState(false);
  const [wipeConfirmPhrase, setWipeConfirmPhrase] = useState('');
  const [wipeMfaAck, setWipeMfaAck] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [wipeStatus, setWipeStatus] = useState<WipeProgressStatus | null>(null);

  const handleWipe = async () => {
    setWiping(true);
    setWipeStatus({ running: true, phase: 'queued', progress_pct: 0, message: 'Starting wipe…' });
    try {
      const result = await SimulatorApi.wipeData((s) => setWipeStatus(s), {
        confirmPhrase: wipeConfirmPhrase,
        mfaConfirmed: wipeMfaAck,
      });
      const warn = result?.warning;
      notifications.show({
        title: 'Data Wiped',
        message: warn || 'All data except Global Owner has been deleted.',
        color: warn ? 'yellow' : 'green',
      });
      setWipeModalOpen(false);
      setWipeConfirmPhrase('');
      setWipeMfaAck(false);
    } catch (err: unknown) {
      notifications.show({
        title: 'Wipe failed',
        message: formatApiError(err, 'Wipe failed.'),
        color: 'red',
      });
    } finally {
      setWiping(false);
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
            Permanently deletes ALL users (except Global Owner), tenants, departments, and activities. This action cannot be undone.
          </Text>
          <Button color="red" variant="outline" leftSection={<Trash2 size={16} />} onClick={() => setWipeModalOpen(true)}>
            Wipe All Data
          </Button>

          <Modal
            opened={wipeModalOpen}
            onClose={() => {
              setWipeModalOpen(false);
              setWipeConfirmPhrase('');
              setWipeMfaAck(false);
            }}
            title={<Text fw={700} c="red">⚠️ Wipe All Data</Text>}
            centered
          >
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Stop 1/2: Type the exact phrase (role + environment).
              </Text>
              <Text size="sm">
                This will delete ALL activities, users (except <b>GLOBAL_OWNER</b>), tenants, and departments.
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

              {(wiping || SimulatorApi.isWipeActive(wipeStatus)) && (
                <WipeProgressBar
                  running={wiping || SimulatorApi.isWipeActive(wipeStatus)}
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
                />
              )}

              <Button
                color="red"
                fullWidth
                leftSection={<Trash2 size={16} />}
                loading={wiping}
                disabled={wiping || wipeConfirmPhrase !== requiredWipePhrase || !wipeMfaAck}
                onClick={handleWipe}
              >
                {wiping
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
