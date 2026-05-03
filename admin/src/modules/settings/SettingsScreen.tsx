import React, { useState, useEffect } from 'react';
import { Card, Text, Group, Button, Stack, PasswordInput, Divider, Badge, Code, Box } from '@mantine/core';
import { Key, Server } from 'lucide-react';
import { useAuth } from '../../core/auth/useAuth';
import { apiClient } from '../../api/client';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '../../core/components/PageHeader';

export const SettingsScreen: React.FC = () => {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    apiClient.get('/infra/health/').then(res => setHealth(res.data)).catch(() => {});
  }, []);

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || newPassword.length < 8) {
      notifications.show({ title: 'Validation', message: 'New password must be at least 8 characters.', color: 'red' });
      return;
    }
    setChangingPassword(true);
    try {
      await apiClient.post('/users/password/change/', { old_password: oldPassword, new_password: newPassword });
      notifications.show({ title: 'Success', message: 'Password changed.', color: 'green' });
      setOldPassword('');
      setNewPassword('');
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e?.response?.data?.error || e?.message || 'Failed.', color: 'red' });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Box>
      <PageHeader title="Settings" subtitle="Account and system configuration" />

      <Stack gap="xl">
        <Card withBorder>
          <Group mb="md">
            <Key size={18} />
            <Text fw={600}>Account</Text>
          </Group>
          <Divider mb="md" />
          <Stack gap="md">
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="sm" fw={500}>Signed in as</Text>
                <Text size="xs" c="dimmed">{user?.username} · {user?.role?.replace('_', ' ')}</Text>
              </Stack>
              <Badge variant="light">{user?.tenantId || 'Global'}</Badge>
            </Group>

            <Divider />
            <Text size="sm" fw={500}>Change Password</Text>
            <PasswordInput label="Current Password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
            <PasswordInput label="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <Button onClick={handleChangePassword} loading={changingPassword} variant="light">
              Change Password
            </Button>
          </Stack>
        </Card>

        <Card withBorder>
          <Group mb="md">
            <Server size={18} />
            <Text fw={600}>System Health</Text>
          </Group>
          <Divider mb="md" />
          {health ? (
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm">Redis</Text>
                <Badge color={health?.redis?.status === 'ok' ? 'green' : 'red'} variant="light">
                  {health?.redis?.status || 'Unknown'}
                </Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Citus</Text>
                <Badge color={health?.citus?.status === 'ok' ? 'green' : 'gray'} variant="light">
                  {health?.citus?.status || 'N/A'}
                </Badge>
              </Group>
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">Loading system status...</Text>
          )}
        </Card>
      </Stack>
    </Box>
  );
};
