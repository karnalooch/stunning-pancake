import React, { useState, useEffect } from 'react';
import { Card, Text, Group, Badge, Stack, Box, Divider } from '@mantine/core';
import { Map } from 'lucide-react';
import { apiClient } from '../../api/client';

export const GlobalHeatmap: React.FC = () => {
  const [positions, setPositions] = useState<any[]>([]);

  useEffect(() => {
    apiClient.get('/activities/telemetry/live/')
      .then(res => setPositions(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  return (
    <Card withBorder>
      <Group mb="md">
        <Map size={18} />
        <Text fw={600}>Live Activity</Text>
        <Badge variant="light" color="green">{positions.length} active</Badge>
      </Group>
      <Divider mb="md" />
      {positions.length === 0 ? (
        <Text size="sm" c="dimmed" py="md" ta="center">No live activity detected.</Text>
      ) : (
        <Stack gap="xs">
          {positions.map((pos: any, i: number) => (
            <Group key={i} p="xs" style={{ borderRadius: 6, background: 'var(--surface-secondary)' }} justify="space-between">
              <Text size="sm" fw={500}>{pos.name || `Athlete ${pos.deviceId}`}</Text>
              <Group gap="xs">
                <Text size="xs" c="dimmed">{pos.speed?.toFixed(1) || 0} km/h</Text>
                <Badge size="xs" variant="light" color="blue">Live</Badge>
              </Group>
            </Group>
          ))}
        </Stack>
      )}
    </Card>
  );
};
