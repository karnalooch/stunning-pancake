import React, { useState, useEffect } from 'react';
import { Card, Text, Group, Title, SimpleGrid, ThemeIcon, Box } from '@mantine/core';
import { Gift, TrendingUp, Users, Activity } from 'lucide-react';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';

export const SponsorDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/rewards/sponsor-stats/')
      .then(res => setStats(res.data || {}))
      .catch(err => {
        console.warn('Sponsor stats unavailable:', err?.response?.status || err?.message);
        setStats({});
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box><PageHeader title="Sponsor Dashboard" subtitle="Track voucher performance and ROI" />
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="xl" spacing="md">
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          <Group gap="sm"><ThemeIcon size={36} radius="md" color="indigo" variant="light"><Gift size={18} /></ThemeIcon><Box><Text size="xs" c="dimmed">Active Vouchers</Text><Text fw={700} size="xl">{stats?.active_vouchers ?? '—'}</Text></Box></Group>
        </Card>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          <Group gap="sm"><ThemeIcon size={36} radius="md" color="green" variant="light"><TrendingUp size={18} /></ThemeIcon><Box><Text size="xs" c="dimmed">Redemptions</Text><Text fw={700} size="xl">{stats?.total_redemptions ?? '—'}</Text></Box></Group>
        </Card>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          <Group gap="sm"><ThemeIcon size={36} radius="md" color="violet" variant="light"><Users size={18} /></ThemeIcon><Box><Text size="xs" c="dimmed">Reach</Text><Text fw={700} size="xl">{stats?.total_reach ?? '—'}</Text></Box></Group>
        </Card>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          <Group gap="sm"><ThemeIcon size={36} radius="md" color="orange" variant="light"><Activity size={18} /></ThemeIcon><Box><Text size="xs" c="dimmed">Conversion</Text><Text fw={700} size="xl">{stats?.conversion_rate ? `${stats.conversion_rate}%` : '—'}</Text></Box></Group>
        </Card>
      </SimpleGrid>
      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <Title order={5} mb="md">Recent Activity</Title>
        <Text c="dimmed" ta="center" py="xl">Voucher activity data will appear here.</Text>
      </Card>
    </Box>
  );
};
