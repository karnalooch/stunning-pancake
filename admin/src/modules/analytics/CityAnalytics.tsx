import React, { useState, useEffect, useMemo } from 'react';
import { Alert, Card, Text, Title, SimpleGrid, Skeleton, Badge, Stack } from '@mantine/core';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line } from 'recharts';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';
import { RouteLoadingCard } from '../../core/components/RouteLoadingCard';
import { useSimDataSource } from '../../hooks/useSimDataSource';

interface WeeklyRow {
  name: string;
  run: number;
  bike: number;
  walk: number;
}

interface Props {
  cityId?: string;
  cityName?: string;
  stats?: {
    total_users?: number;
    total_activities?: number;
    total_distance_km?: number;
    weekly_activity_breakdown?: WeeklyRow[];
  } | null;
}

const EMPTY_WEEK: WeeklyRow[] = [
  { name: 'Mon', run: 0, bike: 0, walk: 0 },
  { name: 'Tue', run: 0, bike: 0, walk: 0 },
  { name: 'Wed', run: 0, bike: 0, walk: 0 },
  { name: 'Thu', run: 0, bike: 0, walk: 0 },
  { name: 'Fri', run: 0, bike: 0, walk: 0 },
  { name: 'Sat', run: 0, bike: 0, walk: 0 },
  { name: 'Sun', run: 0, bike: 0, walk: 0 },
];

export const CityAnalytics: React.FC<Props> = ({ cityId, cityName, stats: statsProp }) => {
  const [stats, setStats] = useState<Props['stats']>(statsProp ?? null);
  const [loading, setLoading] = useState(!statsProp);
  const [error, setError] = useState<string | null>(null);
  const { showSyntheticBanner, simLabLabel } = useSimDataSource();

  useEffect(() => {
    if (statsProp) {
      setStats(statsProp);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const params = cityId ? { tenant_id: cityId } : undefined;
    apiClient.get('/activities/admin/stats/', { params })
      .then((r) => setStats(r.data))
      .catch(() => {
        setStats(null);
        setError('Unable to load tenant stats.');
      })
      .finally(() => setLoading(false));
  }, [cityId, statsProp]);

  const chartData = useMemo(() => {
    const rows = stats?.weekly_activity_breakdown;
    if (Array.isArray(rows) && rows.length > 0) {
      return rows;
    }
    return EMPTY_WEEK;
  }, [stats?.weekly_activity_breakdown]);

  const hasRealCharts = Array.isArray(stats?.weekly_activity_breakdown) && stats.weekly_activity_breakdown.length > 0;
  const chartHasData = chartData.some((d) => d.run + d.bike + d.walk > 0);

  return (
    <div>
      <PageHeader
        title={cityName ? `${cityName} Analytics` : 'City Analytics'}
        subtitle={
          cityName
            ? `Tenant-scoped metrics for ${cityName}`
            : cityId
              ? `Scoped to tenant ${cityId}`
              : 'Activity trends and performance metrics'
        }
      />

      {showSyntheticBanner && (
        <Alert variant="light" color="teal" mb="md" title="KPI z sim-lab">
          Liczniki użytkowników/aktywności pochodzą z {simLabLabel}.
        </Alert>
      )}

      {loading ? (
        <Stack gap="md" mb="md">
          <RouteLoadingCard title="Loading city metrics" subtitle="Aggregating tenant KPIs…" minDelayMs={450} />
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            {[...Array(3)].map((_, i) => <Skeleton key={i} height={88} radius="md" />)}
          </SimpleGrid>
        </Stack>
      ) : error ? (
        <Text c="dimmed" size="sm" mb="md">{error}</Text>
      ) : stats ? (
        <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
          <Card padding="md" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
            <Text size="xs" c="dimmed">Athletes</Text>
            <Text fw={800} size="xl">{(stats.total_users ?? 0).toLocaleString()}</Text>
          </Card>
          <Card padding="md" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
            <Text size="xs" c="dimmed">Activities</Text>
            <Text fw={800} size="xl">{(stats.total_activities ?? 0).toLocaleString()}</Text>
          </Card>
          <Card padding="md" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
            <Text size="xs" c="dimmed">Distance</Text>
            <Text fw={800} size="xl">{(stats.total_distance_km ?? 0).toFixed(1)} km</Text>
          </Card>
        </SimpleGrid>
      ) : null}

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="xl">
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <Stack gap="xs" mb="md">
            <Title order={5}>Weekly Activity Breakdown</Title>
            <Badge size="xs" variant="light" color={hasRealCharts && chartHasData ? 'green' : 'gray'}>
              {hasRealCharts && chartHasData ? 'Live tenant data' : 'No verified activity this week'}
            </Badge>
          </Stack>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={12} />
              <YAxis stroke="var(--text-tertiary)" fontSize={12} />
              <Bar dataKey="run" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="bike" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="walk" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <Stack gap="xs" mb="md">
            <Title order={5}>Distance Trend</Title>
            <Badge size="xs" variant="light" color={hasRealCharts && chartHasData ? 'green' : 'gray'}>
              {hasRealCharts && chartHasData ? 'Activity volume by day' : 'Empty week'}
            </Badge>
          </Stack>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={12} />
              <YAxis stroke="var(--text-tertiary)" fontSize={12} />
              <Line type="monotone" dataKey="run" stroke="var(--chart-1)" strokeWidth={2} dot={{ fill: 'var(--chart-1)' }} />
              <Line type="monotone" dataKey="bike" stroke="var(--chart-2)" strokeWidth={2} dot={{ fill: 'var(--chart-2)' }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </SimpleGrid>
    </div>
  );
};
