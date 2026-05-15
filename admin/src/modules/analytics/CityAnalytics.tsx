import React, { useState, useEffect } from 'react';
import { Card, Text, Group, Badge, Stack, Box, SimpleGrid, Divider } from '@mantine/core';
import { Building2, Users, Activity } from 'lucide-react';
import { apiClient } from '../../api/client';
import { notifications } from '@mantine/notifications';

interface Props {
  cityId?: string;
}

export const CityAnalytics: React.FC<Props> = ({ cityId }) => {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    apiClient.get('/activities/admin/stats/')
      .then(res => {
        const tenant = res.data?.per_tenant?.find((t: any) => t.tenant_id === cityId);
        setStats(tenant || null);
      })
      .catch(() => {
        notifications.show({ title: 'City Analytics', message: 'Failed to load city analytics.', color: 'red' });
      });
  }, [cityId]);

  return (
    <Box>
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="xl">
        <Card withBorder>
          <Stack gap={0} align="center">
            <Users size={24} />
            <Text size="xl" fw={700} mt="sm">{stats?.users ?? '—'}</Text>
            <Text size="xs" c="dimmed">Citizens</Text>
          </Stack>
        </Card>
        <Card withBorder>
          <Stack gap={0} align="center">
            <Activity size={24} />
            <Text size="xl" fw={700} mt="sm">{stats?.activities ?? '—'}</Text>
            <Text size="xs" c="dimmed">Activities</Text>
          </Stack>
        </Card>
        <Card withBorder>
          <Stack gap={0} align="center">
            <Building2 size={24} />
            <Text size="xl" fw={700} mt="sm">{stats?.distance_km?.toFixed(0) ?? '—'} km</Text>
            <Text size="xs" c="dimmed">Total Distance</Text>
          </Stack>
        </Card>
      </SimpleGrid>

      <Card withBorder>
        <Group mb="md">
          <Text fw={600}>Verification Status</Text>
        </Group>
        <Divider mb="md" />
        <Group gap="xl">
          <Stack gap={0}>
            <Text size="xs" c="dimmed">Verification Rate</Text>
            <Text fw={600} c={stats?.verified_pct >= 80 ? 'green' : 'orange'}>
              {stats?.verified_pct ?? 0}%
            </Text>
          </Stack>
          <Stack gap={0}>
            <Text size="xs" c="dimmed">Status</Text>
            <Badge color={stats?.verified_pct >= 80 ? 'green' : 'orange'} variant="light">
              {stats?.verified_pct >= 80 ? 'Healthy' : 'Review Needed'}
            </Badge>
          </Stack>
        </Group>
      </Card>
    </Box>
  );
};
