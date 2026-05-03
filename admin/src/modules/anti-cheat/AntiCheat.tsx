import React, { useState, useEffect } from 'react';
import { Card, Text, Group, Switch, Stack, Box, Divider, Slider, Badge } from '@mantine/core';
import { ShieldAlert, Activity } from 'lucide-react';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';

export const AntiCheat: React.FC = () => {
  const [config, setConfig] = useState({ brouterCutoff: 1.5, mlSensitivity: 0.8, autoBan: true });
  const [anomalies, setAnomalies] = useState<any[]>([]);

  useEffect(() => {
    apiClient.get('/activities/telemetry/config/').then(res => setConfig(res.data)).catch(() => {});
    apiClient.get('/activities/telemetry/anomalies/').then(res => setAnomalies(res.data || [])).catch(() => {});
  }, []);

  const updateConfig = async (key: string, value: any) => {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    try {
      await apiClient.post('/activities/telemetry/config/', updated);
    } catch {}
  };

  return (
    <Box>
      <PageHeader title="Anti-Cheat" subtitle="Integrity monitoring and configuration" />

      <Stack gap="xl">
        <Card withBorder>
          <Group mb="md">
            <ShieldAlert size={18} />
            <Text fw={600}>Detection Filters</Text>
          </Group>
          <Divider mb="md" />
          <Stack gap="md">
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="sm" fw={500}>BRouter Topological Validation</Text>
                <Text size="xs" c="dimmed">Cutoff ratio for GPS vs map distance</Text>
              </Stack>
              <Slider value={config.brouterCutoff} onChange={(v) => updateConfig('brouterCutoff', v)} min={1.0} max={3.0} step={0.1} w={200} marks={[{ value: 1.5, label: '1.5' }, { value: 2.0, label: '2.0' }, { value: 3.0, label: '3.0' }]} />
            </Group>

            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="sm" fw={500}>ML Sensitivity</Text>
                <Text size="xs" c="dimmed">IsolationForest anomaly threshold</Text>
              </Stack>
              <Slider value={config.mlSensitivity} onChange={(v) => updateConfig('mlSensitivity', v)} min={0.5} max={1.0} step={0.05} w={200} marks={[{ value: 0.5, label: '0.5' }, { value: 0.8, label: '0.8' }, { value: 1.0, label: '1.0' }]} />
            </Group>

            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="sm" fw={500}>Auto-Ban</Text>
                <Text size="xs" c="dimmed">Automatically ban confirmed cheaters</Text>
              </Stack>
              <Switch checked={config.autoBan} onChange={(e) => updateConfig('autoBan', e.currentTarget.checked)} />
            </Group>
          </Stack>
        </Card>

        <Card withBorder>
          <Group mb="md">
            <Activity size={18} />
            <Text fw={600}>Recent Anomalies</Text>
            <Badge color="orange" variant="light">{anomalies.length}</Badge>
          </Group>
          <Divider mb="md" />
          {anomalies.length === 0 ? (
            <Text size="sm" c="dimmed" py="md" ta="center">No anomalies detected.</Text>
          ) : (
            <Stack gap="xs">
              {anomalies.slice(0, 10).map((a: any, i: number) => (
                <Group key={i} p="sm" style={{ borderRadius: 8, background: 'var(--surface-secondary)' }} justify="space-between">
                  <Stack gap={0}>
                    <Text size="sm" fw={500}>{a.user}</Text>
                    <Text size="xs" c="dimmed">{a.type} · Score: {a.score}</Text>
                  </Stack>
                  <Badge color="orange" variant="light">Flagged</Badge>
                </Group>
              ))}
            </Stack>
          )}
        </Card>
      </Stack>
    </Box>
  );
};
