import React, { useState, useEffect } from 'react';
import { Card, Text, Group, SimpleGrid, ThemeIcon, Box, Button, Stack } from '@mantine/core';
import { Gift, TrendingUp, Users, Activity, MapPin, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';

export const SponsorDashboard: React.FC = () => {
  const [stats, setStats] = useState<Record<string, number | undefined> | null>(null);

  useEffect(() => {
    apiClient.get('/rewards/sponsor-stats/')
      .then(res => setStats(res.data || {}))
      .catch(() => setStats({}));
  }, []);

  const hasData = (stats?.active_vouchers ?? 0) > 0 || (stats?.poi_count ?? 0) > 0;

  return (
    <Box>
      <PageHeader title="Sponsor Dashboard" subtitle="Track voucher performance and ROI" />
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="xl" spacing="md">
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          <Group gap="sm"><ThemeIcon size={36} radius="md" color="indigo" variant="light"><Gift size={18} /></ThemeIcon><Box><Text size="xs" c="dimmed">Active Vouchers</Text><Text fw={700} size="xl">{stats?.active_vouchers ?? '—'}</Text></Box></Group>
        </Card>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          <Group gap="sm"><ThemeIcon size={36} radius="md" color="green" variant="light"><TrendingUp size={18} /></ThemeIcon><Box><Text size="xs" c="dimmed">Redemptions</Text><Text fw={700} size="xl">{stats?.redeemed_count ?? '—'}</Text></Box></Group>
        </Card>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          <Group gap="sm"><ThemeIcon size={36} radius="md" color="violet" variant="light"><MapPin size={18} /></ThemeIcon><Box><Text size="xs" c="dimmed">POI Locations</Text><Text fw={700} size="xl">{stats?.poi_count ?? '—'}</Text></Box></Group>
        </Card>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          <Group gap="sm"><ThemeIcon size={36} radius="md" color="orange" variant="light"><Activity size={18} /></ThemeIcon><Box><Text size="xs" c="dimmed">Conversion</Text><Text fw={700} size="xl">{stats?.redemption_rate !== undefined ? `${(stats.redemption_rate * 100).toFixed(0)}%` : '—'}</Text></Box></Group>
        </Card>
      </SimpleGrid>
      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        {!hasData ? (
          <Stack align="center" py="xl" gap="md">
            <Gift size={48} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
            <Text fw={600}>Welcome to your sponsor portal</Text>
            <Text c="dimmed" size="sm" maw={420} ta="center">
              Create your first voucher pool and add a POI on the map so athletes can discover and redeem your rewards.
            </Text>
            <Group>
              <Button component={Link} to="/owner/analytics/vouchers" leftSection={<Plus size={16} />}>
                Create first voucher
              </Button>
              <Button component={Link} to="/owner/sponsor/poi" variant="light" leftSection={<MapPin size={16} />}>
                Add POI location
              </Button>
            </Group>
          </Stack>
        ) : (
          <>
            <Text fw={600} mb="md">Recent Activity</Text>
            <Text c="dimmed" size="sm">
              {(stats?.vouchers_distributed ?? 0).toLocaleString()} vouchers distributed ·{' '}
              {(stats?.redeemed_count ?? 0).toLocaleString()} redeemed.
              {' '}
              <Text component={Link} to="/owner/analytics/sponsorship" span c="indigo" size="sm">View analytics →</Text>
            </Text>
          </>
        )}
      </Card>
    </Box>
  );
};
