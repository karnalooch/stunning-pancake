import React, { useEffect, useState } from 'react';
import { Box, Card, SimpleGrid, Text, ThemeIcon, Skeleton, Group } from '@mantine/core';
import { DollarSign, Users, Building2 } from 'lucide-react';
import { API_PATHS } from '@4velo/api-client';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';
import { useI18n } from '../../i18n/useI18n';

interface RevenueSummary {
  premium_users: number;
  active_sponsors: number;
  mrr_estimate_usd: number;
  stripe_webhook_status: string;
}

export const RevenueDashboard: React.FC = () => {
  const { t } = useI18n();
  const [data, setData] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get(API_PATHS.revenueSummary)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <PageHeader title={t.controlPlane.revenue} subtitle={t.controlPlane.revenueSubtitle} />
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="xl">
        {loading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} height={100} />)
        ) : (
          <>
            <Card padding="lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
              <Group gap="sm">
                <ThemeIcon color="green" variant="light"><DollarSign size={18} /></ThemeIcon>
                <Box>
                  <Text size="xs" c="dimmed">{t.controlPlane.mrrEstimate}</Text>
                  <Text fw={800} size="xl">${data?.mrr_estimate_usd?.toLocaleString() ?? '—'}</Text>
                </Box>
              </Group>
            </Card>
            <Card padding="lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
              <Group gap="sm">
                <ThemeIcon color="indigo" variant="light"><Users size={18} /></ThemeIcon>
                <Box>
                  <Text size="xs" c="dimmed">{t.controlPlane.premiumUsers}</Text>
                  <Text fw={800} size="xl">{data?.premium_users ?? '—'}</Text>
                </Box>
              </Group>
            </Card>
            <Card padding="lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
              <Group gap="sm">
                <ThemeIcon color="violet" variant="light"><Building2 size={18} /></ThemeIcon>
                <Box>
                  <Text size="xs" c="dimmed">{t.controlPlane.activeSponsors}</Text>
                  <Text fw={800} size="xl">{data?.active_sponsors ?? '—'}</Text>
                </Box>
              </Group>
            </Card>
          </>
        )}
      </SimpleGrid>
      <Card padding="lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
        <Text size="sm" c="dimmed">{t.controlPlane.stripeNote}</Text>
      </Card>
    </Box>
  );
};
