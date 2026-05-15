import React, { useState } from 'react';
import { Card, Text, Group, Stack, Switch, Select, Button, Box, SimpleGrid, ThemeIcon } from '@mantine/core';
import { Bell, PaintBucket, Shield, Zap } from 'lucide-react';
import { PageHeader } from '../../core/components/PageHeader';
import { notifications } from '@mantine/notifications';

export const SettingsScreen: React.FC = () => {
  const [settings, setSettings] = useState({
    notifications: true,
    emailDigest: false,
    darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    language: 'pl',
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
    </Box>
  );
};
