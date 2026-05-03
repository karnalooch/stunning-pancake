import React, { useEffect, useState } from 'react';
import {
  Box, Card, Text, Group, Stack, TextInput, PasswordInput,
  Button, Badge, SimpleGrid, Divider, Tabs, Code, Switch, Loader,
} from '@mantine/core';
import {
  Settings, Key, Server, Shield, Activity, HardDrive, Cpu, Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../core/auth/useAuth';
import { apiClient, AdminApi } from '../../api/client';

interface HealthData {
  status: string;
  redis?: { status: string; latency_ms?: number };
  citus?: { mode: string; nodes?: number };
}

export const SettingsScreen = () => {
  const { user, logout } = useAuth();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Password change form
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  useEffect(() => {
    loadHealth();
    loadAudit();
  }, []);

  const loadHealth = async () => {
    setHealthLoading(true);
    try {
      const { data } = await apiClient.get('/infra/health/');
      setHealth(data);
    } catch { /* silently ignore — non-critical */ }
    setHealthLoading(false);
  };

  const loadAudit = async () => {
    setAuditLoading(true);
    try {
      const logs = await AdminApi.getAuditLogs(20);
      setAuditLogs(Array.isArray(logs) ? logs : []);
    } catch { /* silently ignore */ }
    setAuditLoading(false);
  };

  const handlePasswordChange = async () => {
    if (!oldPw || !newPw || !pwConfirm) {
      setPwMsg('Fill all password fields.');
      return;
    }
    if (newPw !== pwConfirm) {
      setPwMsg('New passwords do not match.');
      return;
    }
    if (newPw.length < 8) {
      setPwMsg('Password must be at least 8 characters.');
      return;
    }
    setPwLoading(true);
    setPwMsg('');
    try {
      await apiClient.post('/users/password/change/', {
        old_password: oldPw,
        new_password: newPw,
      });
      setPwMsg('Password changed successfully.');
      setOldPw('');
      setNewPw('');
      setPwConfirm('');
    } catch (err: any) {
      setPwMsg(err?.message || 'Password change failed.');
    }
    setPwLoading(false);
  };

  return (
    <Box p="xl">
      <Group mb="xl">
        <Box p="xs" bg="rgba(37, 99, 235, 0.1)" style={{ borderRadius: '12px' }}>
          <Settings size={24} color="#2563EB" />
        </Box>
        <Box>
          <Text fw={900} size="lg" color="white">Settings</Text>
          <Text size="xs" c="dimmed">Platform configuration & diagnostics</Text>
        </Box>
      </Group>

      <Tabs defaultValue="account">
        <Tabs.List mb="xl">
          <Tabs.Tab value="account" leftSection={<Key size={14} />}>Account</Tabs.Tab>
          <Tabs.Tab value="system" leftSection={<Server size={14} />}>System</Tabs.Tab>
          <Tabs.Tab value="audit" leftSection={<Shield size={14} />}>Audit Log</Tabs.Tab>
        </Tabs.List>

        {/* ── Account Tab ────────────────────────────────── */}
        <Tabs.Panel value="account">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            {/* Current session */}
            <Card radius="lg" p="xl" className="fluent-acrylic" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              <Group mb="md">
                <Zap size={18} color="#FBBF24" />
                <Text fw={700} size="sm" color="yellow">Active Session</Text>
              </Group>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Operator:</Text>
                  <Badge variant="outline" color="blue">{user?.username}</Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Role:</Text>
                  <Badge variant="outline" color={user?.role === 'GLOBAL_OWNER' ? 'red' : 'blue'}>
                    {user?.role?.replace('_', ' ')}
                  </Badge>
                </Group>
                {user?.tenantId && (
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">Tenant:</Text>
                    <Badge variant="outline" color="teal">{user.tenantId.slice(0, 8)}</Badge>
                  </Group>
                )}
                {user?.isImpersonated && (
                  <Badge color="orange" variant="filled" w="fit-content">IMPERSONATION ACTIVE</Badge>
                )}
              </Stack>
              <Button
                color="red"
                variant="light"
                mt="xl"
                fullWidth
                onClick={logout}
                leftSection={<Zap size={14} />}
              >
                Terminate Session
              </Button>
            </Card>

            {/* Password change */}
            <Card radius="lg" p="xl" className="fluent-acrylic" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              <Group mb="md">
                <Key size={18} color="#10B981" />
                <Text fw={700} size="sm" color="green">Change Password</Text>
              </Group>
              <Stack gap="sm">
                <PasswordInput
                  placeholder="Current password"
                  value={oldPw}
                  onChange={(e) => setOldPw(e.target.value)}
                />
                <PasswordInput
                  placeholder="New password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                />
                <PasswordInput
                  placeholder="Confirm new password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                />
                <Button
                  onClick={handlePasswordChange}
                  loading={pwLoading}
                  leftSection={<Key size={14} />}
                  variant="outline"
                  color="green"
                >
                  Update Password
                </Button>
                {pwMsg && (
                  <Text size="xs" c={pwMsg.includes('success') ? 'green' : 'red'}>
                    {pwMsg}
                  </Text>
                )}
              </Stack>
            </Card>
          </SimpleGrid>
        </Tabs.Panel>

        {/* ── System Tab ────────────────────────────────── */}
        <Tabs.Panel value="system">
          <Card radius="lg" p="xl" className="fluent-acrylic" style={{ border: '1px solid rgba(255,255,255,0.1)' }} mb="xl">
            <Group mb="md">
              <Server size={18} color="#10B981" />
              <Text fw={700} size="sm" color="green">Infrastructure Health</Text>
              <Badge
                color={health?.status === 'ok' ? 'green' : 'yellow'}
                variant="filled"
                ml="auto"
              >
                {health?.status?.toUpperCase() || 'UNKNOWN'}
              </Badge>
            </Group>

            {healthLoading ? (
              <Loader size="sm" />
            ) : health ? (
              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                <Card p="md" bg="rgba(0,0,0,0.3)" radius="md">
                  <Group mb="xs">
                    <HardDrive size={16} color="#60A5FA" />
                    <Text size="xs" fw={700} c="blue">Database</Text>
                  </Group>
                  <Badge variant="outline" color="blue">
                    {health.citus?.mode?.toUpperCase() || 'STANDALONE'}
                  </Badge>
                </Card>
                <Card p="md" bg="rgba(0,0,0,0.3)" radius="md">
                  <Group mb="xs">
                    <Activity size={16} color="#F472B6" />
                    <Text size="xs" fw={700} c="pink">Redis</Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {health.redis?.status?.toUpperCase() || 'N/A'}
                    {health.redis?.latency_ms != null && ` · ${health.redis.latency_ms}ms`}
                  </Text>
                </Card>
                <Card p="md" bg="rgba(0,0,0,0.3)" radius="md">
                  <Group mb="xs">
                    <Cpu size={16} color="#34D399" />
                    <Text size="xs" fw={700} c="emerald">Citus</Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {health.citus?.mode === 'cluster' ? `${health.citus.nodes} nodes` : 'Single node'}
                  </Text>
                </Card>
              </SimpleGrid>
            ) : (
              <Text size="xs" c="dimmed">Health endpoint unavailable.</Text>
            )}

            <Button
              variant="subtle"
              size="xs"
              mt="md"
              onClick={loadHealth}
              loading={healthLoading}
            >
              Refresh
            </Button>
          </Card>

          {/* Backend info */}
          <Card radius="lg" p="xl" className="fluent-acrylic" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <Group mb="md">
              <Cpu size={18} color="#60A5FA" />
              <Text fw={700} size="sm" color="blue">Backend Configuration</Text>
            </Group>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              <Stack gap="xs">
                <Text size="xs" c="dimmed">API Version</Text>
                <Code block>v0.1.0-beta.2</Code>
              </Stack>
              <Stack gap="xs">
                <Text size="xs" c="dimmed">Engine</Text>
                <Code block>Django 5.x + DRF + SimpleJWT</Code>
              </Stack>
              <Stack gap="xs">
                <Text size="xs" c="dimmed">Database</Text>
                <Code block>TimescaleDB + PostGIS</Code>
              </Stack>
              <Stack gap="xs">
                <Text size="xs" c="dimmed">Auth</Text>
                <Code block>JWT (60min access / 30d refresh)</Code>
              </Stack>
              <Stack gap="xs">
                <Text size="xs" c="dimmed">Endpoint</Text>
                <Code block>backend-production-55c7.up.railway.app</Code>
              </Stack>
              <Stack gap="xs">
                <Text size="xs" c="dimmed">Admin Panel</Text>
                <Code block>v0.1.0-beta.2 · Mantine v9 · Octopath HD-2D</Code>
              </Stack>
            </SimpleGrid>
          </Card>
        </Tabs.Panel>

        {/* ── Audit Log Tab ────────────────────────────────── */}
        <Tabs.Panel value="audit">
          <Card radius="lg" p="xl" className="fluent-acrylic" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <Group mb="md">
              <Shield size={18} color="#FBBF24" />
              <Text fw={700} size="sm" color="yellow">Recent Audit Entries</Text>
              <Button
                variant="subtle"
                size="xs"
                ml="auto"
                onClick={loadAudit}
                loading={auditLoading}
              >
                Refresh
              </Button>
            </Group>

            {auditLogs.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="xl">
                {auditLoading ? 'Loading...' : 'No audit entries found.'}
              </Text>
            ) : (
              <Stack gap="xs">
                {auditLogs.map((log: any, i: number) => (
                  <Card key={i} p="sm" bg="rgba(0,0,0,0.3)" radius="md">
                    <Group justify="space-between" wrap="wrap">
                      <Stack gap={2}>
                        <Text size="xs" fw={600} c="white">{log.action}</Text>
                        <Text size="xs" c="dimmed">
                          by{' '}
                          {log.impersonator_username || log.impersonator || 'N/A'}
                          {' → '}
                          {log.target_user_username || log.target_user || 'N/A'}
                        </Text>
                      </Stack>
                      <Stack gap={2} align="flex-end">
                        <Badge
                          size="xs"
                          variant="outline"
                          color={log.status_code < 300 ? 'green' : log.status_code < 500 ? 'yellow' : 'red'}
                        >
                          {log.status_code}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {new Date(log.timestamp).toLocaleString()}
                        </Text>
                      </Stack>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
};
