import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Text, Group, Switch, Stack, Box, Divider, Slider, Badge, SimpleGrid,
  ThemeIcon, Skeleton, Button, Table, Anchor,
} from '@mantine/core';
import { ShieldAlert, Activity, Gauge, Zap, AlertTriangle, CheckCircle2, MapPin, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';
import { severityColor, severityLabel } from '../../utils/anomalySeverity';

interface AnomalyRow {
  id: string;
  activity_id: number;
  user: string;
  type: string;
  score: number;
  severity?: string;
  description?: string;
  distance?: number;
  time?: string;
}

export const AntiCheat: React.FC = () => {
  const [config, setConfig] = useState({ brouterCutoff: 1.5, mlSensitivity: 0.8, autoBan: true });
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiClient.get('/activities/telemetry/config/'),
      apiClient.get('/activities/telemetry/anomalies/'),
    ])
      .then(([cfgRes, anomRes]) => {
        setConfig(cfgRes.data);
        const raw = anomRes.data;
        setAnomalies(Array.isArray(raw) ? raw : raw?.results ?? []);
      })
      .catch(() => {
        notifications.show({ title: 'Anti-Cheat', message: 'Failed to load data.', color: 'red' });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateConfig = async (key: string, value: unknown) => {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    try {
      await apiClient.post('/activities/telemetry/config/', updated);
    } catch {
      notifications.show({ title: 'Config', message: 'Save failed.', color: 'red' });
    }
  };

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    try {
      await apiClient.post(`/activities/admin/${action}/${id}/`);
      notifications.show({
        title: 'Done',
        message: `Activity ${action}d.`,
        color: action === 'approve' ? 'green' : 'orange',
      });
      fetchData();
    } catch {
      notifications.show({ title: 'Error', message: 'Action failed.', color: 'red' });
    }
  };

  return (
    <Box>
      <PageHeader title="Anti-Cheat Engine" subtitle="4-layer integrity monitoring & detection configuration" />

      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="xl" spacing="md">
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          <Group gap="sm">
            <ThemeIcon size={36} radius="md" color="indigo" variant="light"><Gauge size={18} /></ThemeIcon>
            <Box><Text size="xs" c="dimmed">BRouter Cutoff</Text><Text fw={700}>{config.brouterCutoff}x</Text></Box>
          </Group>
        </Card>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          <Group gap="sm">
            <ThemeIcon size={36} radius="md" color="violet" variant="light"><Zap size={18} /></ThemeIcon>
            <Box><Text size="xs" c="dimmed">ML Sensitivity</Text><Text fw={700}>{config.mlSensitivity}</Text></Box>
          </Group>
        </Card>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          <Group gap="sm">
            <ThemeIcon size={36} radius="md" color={config.autoBan ? 'red' : 'green'} variant="light"><ShieldAlert size={18} /></ThemeIcon>
            <Box><Text size="xs" c="dimmed">Auto-Ban</Text><Text fw={700} c={config.autoBan ? 'red' : 'green'}>{config.autoBan ? 'ON' : 'OFF'}</Text></Box>
          </Group>
        </Card>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          <Group gap="sm">
            <ThemeIcon size={36} radius="md" color={anomalies.length > 0 ? 'orange' : 'green'} variant="light"><AlertTriangle size={18} /></ThemeIcon>
            <Box><Text size="xs" c="dimmed">Low-score queue</Text><Text fw={700}>{anomalies.length}</Text></Box>
          </Group>
        </Card>
      </SimpleGrid>

      <Card mb="xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <Group mb="md"><ShieldAlert size={20} style={{ color: 'var(--accent)' }} /><Text fw={700} size="lg">Detection Configuration</Text></Group>
        <Divider mb="md" />
        <Stack gap="xl">
          <Group justify="space-between" wrap="nowrap">
            <Stack gap={2}><Text fw={600}>BRouter Topological Validation</Text><Text size="xs" c="dimmed">Cutoff ratio for GPS vs map distance</Text></Stack>
            <Slider value={config.brouterCutoff} onChange={(v) => updateConfig('brouterCutoff', v)} min={1.0} max={3.0} step={0.1} w={200} marks={[{ value: 1.5, label: '1.5' }, { value: 2.0, label: '2.0' }, { value: 3.0, label: '3.0' }]} color="indigo" />
          </Group>
          <Group justify="space-between" wrap="nowrap">
            <Stack gap={2}><Text fw={600}>ML Sensitivity</Text><Text size="xs" c="dimmed">IsolationForest anomaly threshold</Text></Stack>
            <Slider value={config.mlSensitivity} onChange={(v) => updateConfig('mlSensitivity', v)} min={0.5} max={1.0} step={0.05} w={200} marks={[{ value: 0.5, label: '0.5' }, { value: 0.8, label: '0.8' }, { value: 1.0, label: '1.0' }]} color="violet" />
          </Group>
          <Group justify="space-between">
            <Stack gap={2}><Text fw={600}>Auto-Ban</Text><Text size="xs" c="dimmed">Automatically ban confirmed cheaters</Text></Stack>
            <Switch checked={config.autoBan} onChange={(e) => updateConfig('autoBan', e.currentTarget.checked)} color="red" size="md" />
          </Group>
        </Stack>
      </Card>

      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <Group mb="md">
          <Activity size={20} style={{ color: 'var(--accent)' }} />
          <Text fw={700} size="lg">Recent Anomalies</Text>
          <Badge color="orange" variant="light" size="lg">{anomalies.length}</Badge>
        </Group>
        <Divider mb="md" />
        {loading ? (
          <Stack gap="sm">{[...Array(5)].map((_, i) => (<Skeleton key={i} height={56} radius="md" />))}</Stack>
        ) : anomalies.length === 0 ? (
          <Text size="sm" c="dimmed" py="xl" ta="center">
            <CheckCircle2 size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            No low-score anomalies — system clean
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Severity</Table.Th>
                <Table.Th>Athlete</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Score</Table.Th>
                <Table.Th>Issue</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {anomalies.map((a) => (
                <Table.Tr key={a.id}>
                  <Table.Td>
                    <Badge size="sm" color={severityColor(a.severity)} variant="filled">
                      {severityLabel(a.severity)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Anchor component={Link} to={`/owner/activities/${a.activity_id}`} size="sm" fw={500}>
                      {a.user}
                    </Anchor>
                  </Table.Td>
                  <Table.Td>{a.type}</Table.Td>
                  <Table.Td>
                    <Text ff="monospace" size="sm" c={a.score < 0.2 ? 'red' : undefined}>
                      {a.score.toFixed(2)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed" maw={240} lineClamp={2}>
                      {a.description || 'Verification anomaly'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Button
                        component="a"
                        href={`#/owner/analytics/live-map?flagged=1&activity=${a.activity_id}`}
                        size="xs"
                        variant="light"
                        color="indigo"
                        leftSection={<MapPin size={12} />}
                        data-testid="anti-cheat-show-on-map"
                      >
                        Map
                      </Button>
                      <Button size="xs" color="green" variant="light" leftSection={<Check size={12} />} onClick={() => handleAction(a.activity_id, 'approve')}>Approve</Button>
                      <Button size="xs" color="red" variant="light" leftSection={<X size={12} />} onClick={() => handleAction(a.activity_id, 'reject')}>Reject</Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Box>
  );
};
