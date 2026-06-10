import React, { useState, useEffect } from 'react';
import { Card, Text, Group, SimpleGrid, ThemeIcon, Box, Stack, Skeleton, Button } from '@mantine/core';
import { Gift, TrendingUp, Activity, MapPin, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_PATHS } from '@4velo/api-client';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';
import { SponsorEmptyCta } from '../../core/components/SponsorEmptyCta';
import { useI18n } from '../../i18n/useI18n';

export const SponsorDashboard: React.FC = () => {
  const { t } = useI18n();
  const [stats, setStats] = useState<Record<string, number | undefined> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient.get(API_PATHS.sponsorStats)
      .then((res) => setStats(res.data || {}))
      .catch(() => setStats({}))
      .finally(() => setLoading(false));
  }, []);

  const hasData = (stats?.active_vouchers ?? 0) > 0 || (stats?.poi_count ?? 0) > 0;

  return (
    <Box>
      <PageHeader title={t.sponsor.commandCenter} subtitle={t.sponsor.commandSubtitle} />
      <Group mb="md" gap="sm">
        <Button component={Link} to="/owner/sponsor/poi" variant="light" leftSection={<MapPin size={16} />}>{t.sponsor.poiMap}</Button>
        <Button component={Link} to="/owner/analytics/sponsorship" variant="light" leftSection={<BarChart3 size={16} />}>{t.sponsor.analytics}</Button>
        <Button component={Link} to="/owner/analytics/vouchers" variant="light" leftSection={<Gift size={16} />}>{t.sponsor.vouchers}</Button>
        <Button component={Link} to="/owner/sponsor/campaigns" variant="light">{t.sponsor.campaigns}</Button>
        <Button component={Link} to="/owner/sponsor/brand" variant="light">{t.sponsor.brandStudio}</Button>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="xl" spacing="md">
        {loading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} height={88} radius="md" />)
        ) : (
          <>
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
              <Group gap="sm"><ThemeIcon size={36} radius="md" color="indigo" variant="light"><Gift size={18} /></ThemeIcon><Box><Text size="xs" c="dimmed">{t.sponsor.activeVouchers}</Text><Text fw={700} size="xl">{stats?.active_vouchers ?? '—'}</Text></Box></Group>
            </Card>
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
              <Group gap="sm"><ThemeIcon size={36} radius="md" color="green" variant="light"><TrendingUp size={18} /></ThemeIcon><Box><Text size="xs" c="dimmed">{t.sponsor.redemptions}</Text><Text fw={700} size="xl">{stats?.redeemed_count ?? '—'}</Text></Box></Group>
            </Card>
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
              <Group gap="sm"><ThemeIcon size={36} radius="md" color="violet" variant="light"><MapPin size={18} /></ThemeIcon><Box><Text size="xs" c="dimmed">{t.sponsor.poiLocations}</Text><Text fw={700} size="xl">{stats?.poi_count ?? '—'}</Text></Box></Group>
            </Card>
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
              <Group gap="sm"><ThemeIcon size={36} radius="md" color="orange" variant="light"><Activity size={18} /></ThemeIcon><Box><Text size="xs" c="dimmed">{t.sponsor.conversion}</Text><Text fw={700} size="xl">{stats?.redemption_rate !== undefined ? `${(stats.redemption_rate * 100).toFixed(0)}%` : '—'}</Text></Box></Group>
            </Card>
          </>
        )}
      </SimpleGrid>
      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        {loading ? (
          <Skeleton height={120} radius="md" />
        ) : !hasData ? (
          <SponsorEmptyCta />
        ) : (
          <>
            <Text fw={600} mb="md">{t.sponsor.recentActivity}</Text>
            <Text c="dimmed" size="sm">
              {(stats?.vouchers_distributed ?? 0).toLocaleString()} {t.sponsor.distributed} ·{' '}
              {(stats?.redeemed_count ?? 0).toLocaleString()} {t.sponsor.redeemed}.{' '}
              <Text component={Link} to="/owner/analytics/sponsorship" span c="indigo" size="sm">{t.sponsor.viewAnalytics}</Text>
            </Text>
          </>
        )}
      </Card>
    </Box>
  );
};
