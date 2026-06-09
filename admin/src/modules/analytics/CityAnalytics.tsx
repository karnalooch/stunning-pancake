import React, { useState, useEffect } from 'react';

import { Alert, Card, Text, Title, SimpleGrid, Skeleton, Badge, Stack } from '@mantine/core';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line } from 'recharts';


import { apiClient } from '../../api/client';

import { PageHeader } from '../../core/components/PageHeader';

import { RouteLoadingCard } from '../../core/components/RouteLoadingCard';
import { useSimDataSource } from '../../hooks/useSimDataSource';



interface Props { cityId?: string }



const fallbackWeek = [

  { name: 'Mon', run: 12, bike: 8, walk: 5 },

  { name: 'Tue', run: 15, bike: 10, walk: 7 },

  { name: 'Wed', run: 18, bike: 12, walk: 9 },

  { name: 'Thu', run: 14, bike: 9, walk: 6 },

  { name: 'Fri', run: 20, bike: 15, walk: 10 },

  { name: 'Sat', run: 25, bike: 18, walk: 12 },

  { name: 'Sun', run: 22, bike: 14, walk: 8 },

];



export const CityAnalytics: React.FC<Props> = ({ cityId }) => {

  const [stats, setStats] = useState<{ total_users?: number; total_activities?: number; total_distance_km?: number } | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const { showSyntheticBanner, simLabLabel } = useSimDataSource();

  const chartData = fallbackWeek;



  useEffect(() => {

    setLoading(true);

    setError(null);

    apiClient.get('/activities/admin/stats/')

      .then((r) => setStats(r.data))

      .catch(() => {

        setStats(null);

        setError('Unable to load tenant stats.');

      })

      .finally(() => setLoading(false));

  }, [cityId]);



  return (

    <div>

      <PageHeader

        title="City Analytics"

        subtitle={cityId ? `Scoped to tenant ${cityId}` : 'Activity trends and performance metrics'}

      />

      {showSyntheticBanner && (
        <Alert variant="light" color="teal" mb="md" title="KPI z sim-lab">
          Liczniki użytkowników/aktywności pochodzą z {simLabLabel}. Wykres tygodniowy pozostaje danymi przykładowymi (Faza 2).
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

            <Badge size="xs" variant="light" color="gray">Charts: sample data</Badge>

          </Stack>

          <ResponsiveContainer width="100%" height={280}>

            <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={12} /><YAxis stroke="var(--text-tertiary)" fontSize={12} /><Bar dataKey="run" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /><Bar dataKey="bike" fill="var(--chart-2)" radius={[4, 4, 0, 0]} /><Bar dataKey="walk" fill="var(--chart-3)" radius={[4, 4, 0, 0]} /></BarChart>

          </ResponsiveContainer>

        </Card>

        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>

          <Stack gap="xs" mb="md">

            <Title order={5}>Distance Trend</Title>

            <Badge size="xs" variant="light" color="gray">Charts: sample data</Badge>

          </Stack>

          <ResponsiveContainer width="100%" height={280}>

            <LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={12} /><YAxis stroke="var(--text-tertiary)" fontSize={12} /><Line type="monotone" dataKey="run" stroke="var(--chart-1)" strokeWidth={2} dot={{ fill: 'var(--chart-1)' }} /><Line type="monotone" dataKey="bike" stroke="var(--chart-2)" strokeWidth={2} dot={{ fill: 'var(--chart-2)' }} /></LineChart>

          </ResponsiveContainer>

        </Card>

      </SimpleGrid>

    </div>

  );

};


