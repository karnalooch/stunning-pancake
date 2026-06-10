import React from 'react';
import { Group, Badge, Text, Card, ThemeIcon, Skeleton, Anchor } from '@mantine/core';
import { Activity, Radio, ShieldAlert, Gauge, CircleCheck, CircleAlert, CircleX } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  computeControlPlaneStatus,
  controlPlaneLabel,
  type ControlPlaneStatus,
} from '../../utils/goHealth';

export interface GoHealthStripProps {
  loading?: boolean;
  unverifiedTotal?: number;
  simOn?: boolean;
  routingQueueDepth?: number;
  routingBackpressure?: boolean;
  maxRoutingQueueDepth?: number | null;
  apiLatencyMs?: number | null;
  dataSource?: 'production' | 'sim-lab';
  synthetic?: boolean;
  federationFallback?: boolean;
  dataStale?: boolean;
}

const statusColor: Record<ControlPlaneStatus, string> = {
  go: 'green',
  warn: 'yellow',
  'no-go': 'red',
};

const statusIcon: Record<ControlPlaneStatus, React.FC<{ size?: number }>> = {
  go: CircleCheck,
  warn: CircleAlert,
  'no-go': CircleX,
};

export const GoHealthStrip: React.FC<GoHealthStripProps> = ({
  loading,
  unverifiedTotal = 0,
  simOn = false,
  routingQueueDepth = 0,
  routingBackpressure = false,
  maxRoutingQueueDepth = null,
  apiLatencyMs = null,
  dataSource = 'production',
  synthetic = false,
  federationFallback = false,
  dataStale = false,
}) => {
  if (loading) {
    return <Skeleton height={52} radius="md" mb="md" />;
  }

  const goStatus = computeControlPlaneStatus({
    apiLatencyMs,
    unverifiedTotal,
    simOn,
    routingQueueDepth,
    routingBackpressure,
    maxRoutingQueueDepth,
    synthetic,
    federationFallback,
    dataStale,
  });
  const StatusIcon = statusIcon[goStatus];

  return (
    <Card
      mb="md"
      style={{
        background: 'var(--surface)',
        border: `1px solid var(--border)`,
        borderRadius: 12,
        padding: '12px 18px',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <Group justify="space-between" wrap="wrap" gap="md">
        <Group gap="lg">
          <Group gap={6}>
            <ThemeIcon size={28} variant="light" color={statusColor[goStatus]} radius="md">
              <StatusIcon size={14} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">Platform</Text>
            <Badge size="sm" variant="filled" color={statusColor[goStatus]}>
              {controlPlaneLabel(goStatus)}
            </Badge>
          </Group>
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
            <Anchor component={Link} to="/owner/moderation" underline="never">
              <Badge
                size="sm"
                variant="light"
                color={unverifiedTotal > 10 ? 'orange' : 'green'}
                style={{ cursor: 'pointer' }}
              >
                {unverifiedTotal.toLocaleString()} pending
              </Badge>
            </Anchor>
          </Group>
          <Group gap={6}>
            <ThemeIcon size={28} variant="light" color={simOn ? 'green' : 'gray'} radius="md">
              <Radio size={14} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">Simulator</Text>
            <Anchor component={Link} to="/owner/analytics/simulator" underline="never">
              <Badge
                size="sm"
                variant="light"
                color={simOn ? 'green' : 'gray'}
                style={{ cursor: 'pointer' }}
              >
                {simOn ? 'ON' : 'OFF'}
              </Badge>
            </Anchor>
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
                {maxRoutingQueueDepth != null ? ` / ${maxRoutingQueueDepth}` : ''}
              </Badge>
            </Group>
          )}
        </Group>
        <Group gap="xs">
          {(dataSource === 'sim-lab' || synthetic) && (
            <Badge size="sm" variant="filled" color="orange">
              sim-lab KPI
            </Badge>
          )}
          {federationFallback && dataSource !== 'sim-lab' && !synthetic && (
            <Badge size="sm" variant="light" color="yellow">
              federation fallback
            </Badge>
          )}
          {dataSource === 'production' && !synthetic && !federationFallback && (
            <Badge size="sm" variant="light" color="green">
              prod DB
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
