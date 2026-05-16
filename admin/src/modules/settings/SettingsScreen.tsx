import React, { useState } from 'react';
import { Card, Text, Group, Stack, Switch, Select, Button, Box, SimpleGrid, ThemeIcon, Modal } from '@mantine/core';
import { Bell, PaintBucket, Shield, Zap, Trash2, AlertTriangle } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';

export const SettingsScreen: React.FC = () => {
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
  const [wipeConfirm, setWipeConfirm] = useState('');
  const [wiping, setWiping] = useState(false);

  const handleWipe = async () => {
    if (wipeConfirm !== 'DELETE ALL DATA') return;
    setWiping(true);
    try {
      await apiClient.delete('/activities/admin/wipe-data/', { data: { confirm: true } });
      notifications.show({ title: 'Data Wiped', message: 'All data except Global Owner has been deleted.', color: 'green' });
      setWipeModalOpen(false);
      setWipeConfirm('');
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err?.response?.data?.error || 'Wipe failed.', color: 'red' });
    } finally { setWiping(false); }
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
      <Card mt="xl" style={{ background: 'var(--surface)', border: '2px solid var(--mantine-color-red-6)', borderRadius: 14, padding: 24 }}>
        <Group mb="md">
          <ThemeIcon size={36} radius="md" color="red" variant="light"><AlertTriangle size={20} /></ThemeIcon>
          <Text fw={700} size="lg" c="red">Danger Zone</Text>
        </Group>
        <Text size="sm" c="dimmed" mb="md">
          This will permanently delete ALL users (except Global Owner), tenants, departments, and activities. This action cannot be undone.
        </Text>
        <Button color="red" variant="outline" leftSection={<Trash2 size={16} />} onClick={() => setWipeModalOpen(true)}>
          Wipe All Data
        </Button>
      </Card>

      <Modal opened={wipeModalOpen} onClose={() => { setWipeModalOpen(false); setWipeConfirm(''); }} title={<Text fw={700} c="red">⚠️ Wipe All Data</Text>} centered>
        <Stack gap="md">
          <Text size="sm">This will delete ALL activities, users (except GLOBAL_OWNER), tenants, and departments. Type <b>DELETE ALL DATA</b> to confirm:</Text>
          <input
            type="text"
            value={wipeConfirm}
            onChange={(e) => setWipeConfirm(e.target.value)}
            placeholder="Type DELETE ALL DATA"
            style={{
              padding: '8px 12px', border: '1px solid var(--mantine-color-red-6)', borderRadius: 8,
              background: 'var(--surface-secondary)', color: 'var(--text-primary)', fontSize: 14, width: '100%',
            }}
          />
          <Button color="red" fullWidth leftSection={<Trash2 size={16} />} loading={wiping} disabled={wipeConfirm !== 'DELETE ALL DATA'} onClick={handleWipe}>
            {wiping ? 'Wiping...' : 'Yes, Delete Everything'}
          </Button>
        </Stack>
      </Modal>
    </Box>
  );
};
