import React, { useState, useEffect } from 'react';
import { Card, Text, Group, Stack, SimpleGrid, Badge, Box, Divider } from '@mantine/core';
import { Gift, TrendingUp } from 'lucide-react';
import { apiClient, RewardsApi } from '../../api/client';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '../../core/components/PageHeader';

export const SponsorDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    RewardsApi.getSponsorStats()
      .then(data => setStats(data))
      .catch(() => {
        notifications.show({ title: 'Sponsor Dashboard', message: 'Failed to load sponsor stats.', color: 'red' });
      });
  }, []);

  return (
    <Box>
      <PageHeader title="Sponsor Dashboard" subtitle="Performance and redemption metrics" />

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="xl">
        <Card withBorder>
          <Stack gap={0} align="center">
            <Gift size={24} />
            <Text size="xl" fw={700} mt="sm">{stats?.vouchers_distributed ?? '—'}</Text>
            <Text size="xs" c="dimmed">Distributed</Text>
          </Stack>
        </Card>
        <Card withBorder>
          <Stack gap={0} align="center">
            <TrendingUp size={24} />
            <Text size="xl" fw={700} mt="sm">{stats?.redeemed_count ?? '—'}</Text>
            <Text size="xs" c="dimmed">Redeemed</Text>
          </Stack>
        </Card>
        <Card withBorder>
          <Stack gap={0} align="center">
            <Text size="xl" fw={700} mt="sm">{stats ? `${Math.round((stats.redemption_rate || 0) * 100)}%` : '—'}</Text>
            <Text size="xs" c="dimmed">Redemption Rate</Text>
          </Stack>
        </Card>
      </SimpleGrid>

      <Card withBorder>
        <Group mb="md">
          <Text fw={600}>Activity Summary</Text>
        </Group>
        <Divider mb="md" />
        <Group gap="xl">
          <Stack gap={0}>
            <Text size="xs" c="dimmed">Active Vouchers</Text>
            <Text fw={600}>{stats?.active_vouchers ?? '—'}</Text>
          </Stack>
          <Stack gap={0}>
            <Text size="xs" c="dimmed">Expired</Text>
            <Text fw={600}>{stats?.expired_vouchers ?? '—'}</Text>
          </Stack>
          <Stack gap={0}>
            <Text size="xs" c="dimmed">POIs</Text>
            <Text fw={600}>{stats?.poi_count ?? '—'}</Text>
          </Stack>
        </Group>
      </Card>
    </Box>
  );
};
