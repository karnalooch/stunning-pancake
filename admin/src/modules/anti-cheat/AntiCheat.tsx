import React, { useState, useEffect } from 'react';
import { Card, Text, Group, Switch, Stack, Box, Divider, Slider, Badge, SimpleGrid, ThemeIcon, Skeleton } from '@mantine/core';
import { ShieldAlert, Activity, Gauge, Zap, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';

export const AntiCheat: React.FC = () => {
  const [config, setConfig] = useState({ brouterCutoff: 1.5, mlSensitivity: 0.8, autoBan: true });
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get('/activities/telemetry/config/'),
      apiClient.get('/activities/telemetry/anomalies/'),
    ])
      .then(([cfgRes, anomRes]) => {
        setConfig(cfgRes.data);
        setAnomalies(anomRes.data || []);
      })
      .catch(() => {
        notifications.show({ title: 'Anti-Cheat', message: 'Failed to load data.', color: 'red' });
      })
      .finally(() => setLoading(false));
  }, []);

  const updateConfig = async (key: string, value: any) => {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    try { await apiClient.post('/activities/telemetry/config/', updated); } catch { }
  };

  return (
    <Box>
      <PageHeader title="Anti-Cheat Engine" subtitle="4-layer integrity monitoring & detection configuration" />

      {/* Stats */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="xl" spacing="md">
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}><Group gap="sm"><ThemeIcon size={36} radius="md" color="indigo" variant="light"><Gauge size={18} /></ThemeIcon><Box><Text size="xs" c="dimmed">BRouter Cutoff</Text><Text fw={700}>{config.brouterCutoff}x</Text></Box></Group></Card>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}><Group gap="sm"><ThemeIcon size={36} radius="md" color="violet" variant="light"><Zap size={18} /></ThemeIcon><Box><Text size="xs" c="dimmed">ML Sensitivity</Text><Text fw={700}>{config.mlSensitivity}</Text></Box></Group></Card>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}><Group gap="sm"><ThemeIcon size={36} radius="md" color={config.autoBan ? 'red' : 'green'} variant="light"><ShieldAlert size={18} /></ThemeIcon><Box><Text size="xs" c="dimmed">Auto-Ban</Text><Text fw={700} c={config.autoBan ? 'red' : 'green'}>{config.autoBan ? 'ON' : 'OFF'}</Text></Box></Group></Card>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}><Group gap="sm"><ThemeIcon size={36} radius="md" color={anomalies.length > 0 ? 'orange' : 'green'} variant="light"><AlertTriangle size={18} /></ThemeIcon><Box><Text size="xs" c="dimmed">Anomalies</Text><Text fw={700}>{anomalies.length}</Text></Box></Group></Card>
      </SimpleGrid>

      {/* Configuration */}
      <Card mb="xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <Group mb="md"><ShieldAlert size={20} style={{ color: 'var(--accent)' }} /><Text fw={700} size="lg">Detection Configuration</Text></Group>
        <Divider mb="md" />
        <Stack gap="xl">
          <Group justify="space-between" wrap="nowrap"><Stack gap={2}><Text fw={600}>BRouter Topological Validation</Text><Text size="xs" c="dimmed">Cutoff ratio for GPS vs map distance</Text></Stack><Slider value={config.brouterCutoff} onChange={(v) => updateConfig('brouterCutoff', v)} min={1.0} max={3.0} step={0.1} w={200} marks={[{ value: 1.5, label: '1.5' }, { value: 2.0, label: '2.0' }, { value: 3.0, label: '3.0' }]} color="indigo" /></Group>
          <Group justify="space-between" wrap="nowrap"><Stack gap={2}><Text fw={600}>ML Sensitivity</Text><Text size="xs" c="dimmed">IsolationForest anomaly threshold</Text></Stack><Slider value={config.mlSensitivity} onChange={(v) => updateConfig('mlSensitivity', v)} min={0.5} max={1.0} step={0.05} w={200} marks={[{ value: 0.5, label: '0.5' }, { value: 0.8, label: '0.8' }, { value: 1.0, label: '1.0' }]} color="violet" /></Group>
          <Group justify="space-between"><Stack gap={2}><Text fw={600}>Auto-Ban</Text><Text size="xs" c="dimmed">Automatically ban confirmed cheaters</Text></Stack><Switch checked={config.autoBan} onChange={(e) => updateConfig('autoBan', e.currentTarget.checked)} color="red" size="md" /></Group>
        </Stack>
      </Card>

      {/* Anomalies Timeline */}
      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <Group mb="md"><Activity size={20} style={{ color: 'var(--accent)' }} /><Text fw={700} size="lg">Recent Anomalies</Text><Badge color="orange" variant="light" size="lg">{anomalies.length}</Badge></Group>
        <Divider mb="md" />
        {loading ? (<Stack gap="sm">{[...Array(5)].map((_, i) => (<Skeleton key={i} height={56} radius="md" />))}</Stack>) : anomalies.length === 0 ? (
          <Text size="sm" c="dimmed" py="xl" ta="center"><CheckCircle2 size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />No anomalies detected — system clean</Text>
        ) : (
          <Stack gap="sm">{anomalies.slice(0, 15).map((a: any, i: number) => (
            <Group key={i} p="sm" style={{ borderRadius: 12, background: 'var(--surface-secondary)', border: '1px solid var(--border-subtle)' }} justify="space-between" wrap="nowrap">
              <Group gap="sm"><ThemeIcon size={32} radius="md" color="orange" variant="light"><AlertTriangle size={14} /></ThemeIcon><Stack gap={0}><Text fw={600} size="sm">{a.user}</Text><Text size="xs" c="dimmed">{a.type} · Score: {a.score?.toFixed(2)} · Distance: {a.distance}m · {a.time}</Text></Stack></Group>
              <Badge color="orange" variant="filled" size="sm">Flagged</Badge>
            </Group>
          ))}</Stack>
        )}
      </Card>
    </Box>
  );
};
