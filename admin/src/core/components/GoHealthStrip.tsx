import React from 'react';
import { Group, Badge, Text, Card, ThemeIcon, Skeleton } from '@mantine/core';
import { Activity, Radio, ShieldAlert, Gauge } from 'lucide-react';

export interface GoHealthStripProps {
  loading?: boolean;
  unverifiedTotal?: number;
  simOn?: boolean;
  routingQueueDepth?: number;
  routingBackpressure?: boolean;
  apiLatencyMs?: number | null;
  dataSource?: 'production' | 'sim-lab';
}

export const GoHealthStrip: React.FC<GoHealthStripProps> = ({
  loading,
  unverifiedTotal = 0,
  simOn = false,
  routingQueueDepth = 0,
  routingBackpressure = false,
  apiLatencyMs = null,
  dataSource = 'production',
}) => {
  if (loading) {
    return <Skeleton height={52} radius="md" mb="md" />;
  }

  return (
    <Card
      mb="md"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '12px 18px',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <Group justify="space-between" wrap="wrap" gap="md">
        <Group gap="lg">
          <Group gap={6}>
            <ThemeIcon size={28} variant="light" color="indigo" radius="md">
              <Gauge size={14} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">API</Text>
            <Badge size="sm" variant="light" color={apiLatencyMs != null && apiLatencyMs < 500 ? 'green' : 'yellow'}>
              {apiLatencyMs != null ? `${apiLatencyMs} ms` : 'OK'}
            </Badge>
          </Group>
          <Group gap={6}>
            <ThemeIcon size={28} variant="light" color="orange" radius="md">
              <ShieldAlert size={14} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">Mod queue</Text>
            <Badge size="sm" variant="light" color={unverifiedTotal > 10 ? 'orange' : 'green'}>
              {unverifiedTotal.toLocaleString()} pending
            </Badge>
          </Group>
          <Group gap={6}>
            <ThemeIcon size={28} variant="light" color={simOn ? 'green' : 'gray'} radius="md">
              <Radio size={14} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">Simulator</Text>
            <Badge size="sm" variant="light" color={simOn ? 'green' : 'gray'}>
              {simOn ? 'ON' : 'OFF'}
            </Badge>
          </Group>
          {simOn && (
            <Group gap={6}>
              <ThemeIcon size={28} variant="light" color="violet" radius="md">
                <Activity size={14} />
              </ThemeIcon>
              <Text size="xs" c="dimmed">Routing queue</Text>
              <Badge size="sm" variant="light" color={routingBackpressure ? 'red' : 'violet'}>
                {routingQueueDepth}
                {routingBackpressure ? ' BP' : ''}
              </Badge>
            </Group>
          )}
        </Group>
        <Group gap="xs">
          {dataSource === 'sim-lab' && (
            <Badge size="sm" variant="light" color="teal">
              sim-lab KPI
            </Badge>
          )}
          <Text size="10px" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.06em' }}>
            Control plane
          </Text>
        </Group>
      </Group>
    </Card>
  );
};
