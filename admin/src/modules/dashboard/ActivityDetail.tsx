import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Text, Title, Group, Badge, Card, Skeleton, Alert, Stack, Button,
} from '@mantine/core';
import { Download } from 'lucide-react';
import { MapPin, Clock, ShieldCheck, Bike, Footprints, PersonStanding } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { apiClient } from '../../api/client';
import { ActivityRouteMap } from '../../core/components/ActivityRouteMap';
import { buildSpeedProfile } from '../../utils/routeSpeedProfile';

const typeIcons: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  RUN: Footprints, BIKE: Bike, WALK: PersonStanding, WHEELCHAIR: PersonStanding,
};
const typeLabels: Record<string, string> = {
  RUN: 'Running', BIKE: 'Cycling', WALK: 'Walking', WHEELCHAIR: 'Wheelchair',
};

interface ActivityDetailData {
  id: number;
  type: string;
  start_time: string;
  end_time: string | null;
  distance: number;
  duration: number | string | null;
  is_verified: boolean;
  verification_score: number;
  route_coords: Array<[number, number]> | null;
  gpx_sha256?: string | null;
  user_info: { id: number; username: string; role: string };
  created_at: string;
}

export const ActivityDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [prevId, setPrevId] = useState<string | undefined>(id);
  const [data, setData] = useState<ActivityDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (id !== prevId) {
    setPrevId(id);
    setLoading(true);
    setError(null);
    setData(null);
  }

  useEffect(() => {
    apiClient.get(`/activities/sessions/${id}/detail/`)
      .then((r) => setData(r.data))
      .catch((err) => {
        const detail = err.response?.data?.detail;
        setError(typeof detail === 'string' ? detail : err.message || 'Failed to load activity');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const speedProfile = useMemo(() => {
    if (!data?.route_coords?.length) return [];
    const dur = typeof data.duration === 'number' ? data.duration : null;
    return buildSpeedProfile(data.route_coords, dur);
  }, [data?.route_coords, data?.duration]);

  const TypeIcon = typeIcons[data?.type || ''] || Clock;

  const downloadGpx = async () => {
    if (!id) return;
    try {
      const res = await apiClient.get(`/activities/sessions/${id}/gpx/`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-${id}.gpx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('GPX export failed or route unavailable.');
    }
  };

  const routePointCount = data?.route_coords?.length ?? 0;

  if (loading) {
    return (
      <Box p="md">
        <Skeleton height={32} width={200} mb="md" radius="sm" />
        <Skeleton height={200} mb="md" radius="md" />
        <Skeleton height={300} radius="md" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p="md">
        <Title order={2} mb="md">Activity #{id}</Title>
        <Alert color="red" title="Error Loading Activity" variant="light">{error}</Alert>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box p="md">
        <Title order={2} mb="md">Activity #{id}</Title>
        <Alert color="gray" title="Not Found" variant="light">No activity data found for ID #{id}.</Alert>
      </Box>
    );
  }

  const scorePct = Math.round(data.verification_score * 100);
  const scoreColor = data.verification_score >= 0.7 ? 'green' : data.verification_score >= 0.4 ? 'yellow' : 'red';

  return (
    <Box p="md">
      <Title order={2} mb="md">Activity #{id}</Title>

      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }} mb="md">
        <Group mb="xs" gap="sm">
          <TypeIcon size={24} style={{ color: 'var(--accent)' }} />
          <Text fw={700} size="lg">{typeLabels[data.type] || data.type}</Text>
          <Badge color={data.is_verified ? 'green' : 'orange'} variant="light">
            {data.is_verified ? 'Verified' : 'Unverified'}
          </Badge>
          {data.gpx_sha256 && (
            <Badge color="teal" variant="light" size="sm">GPX archived</Badge>
          )}
        </Group>
        <Group gap="xl" mt="sm" wrap="wrap">
          <Box><Text size="xs" c="dimmed">User</Text><Text fw={600}>{data.user_info.username}</Text></Box>
          <Box><Text size="xs" c="dimmed">Distance</Text><Text fw={600}>{(data.distance / 1000).toFixed(2)} km</Text></Box>
          <Box><Text size="xs" c="dimmed">Start</Text><Text fw={600}>{new Date(data.start_time).toLocaleString()}</Text></Box>
          <Box><Text size="xs" c="dimmed">Verification</Text><Badge color={scoreColor} variant="light">{scorePct}%</Badge></Box>
        </Group>
      </Card>

      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }} mb="md">
        <Group mb="md" justify="space-between">
          <Group gap="sm">
            <MapPin size={20} style={{ color: 'var(--accent)' }} />
            <Text fw={700}>GPS Route Inspector</Text>
            {routePointCount > 0 && (
              <Badge color="indigo" variant="light">{routePointCount.toLocaleString()} pts</Badge>
            )}
          </Group>
          {routePointCount > 0 && (
            <Button size="xs" variant="light" leftSection={<Download size={14} />} onClick={downloadGpx}>
              Download GPX
            </Button>
          )}
        </Group>
        {routePointCount > 0 ? (
          <ActivityRouteMap routeCoords={data.route_coords!} verified={data.is_verified} height={320} />
        ) : (
          <Text c="dimmed" ta="center" py="xl">No route data recorded</Text>
        )}
      </Card>

      {speedProfile.length > 1 && (
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }} mb="md">
          <Text fw={700} mb="md">Speed profile (estimated)</Text>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={speedProfile}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="km" stroke="var(--text-tertiary)" fontSize={12} label={{ value: 'km', position: 'insideBottom', offset: -2 }} />
              <YAxis stroke="var(--text-tertiary)" fontSize={12} unit=" km/h" />
              <Tooltip />
              <Line type="monotone" dataKey="speedKmh" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <Group mb="md">
          <ShieldCheck size={20} style={{ color: 'var(--accent)' }} />
          <Text fw={700}>Anti-Cheat Results</Text>
        </Group>
        <Stack gap="sm">
          <Group gap="sm">
            <Badge color={scoreColor} variant="light" size="lg">Overall Score: {scorePct}%</Badge>
            <Badge color={data.is_verified ? 'green' : 'orange'} variant="light" size="lg">
              {data.is_verified ? 'Approved' : 'Pending Review'}
            </Badge>
          </Group>
          {data.verification_score < 0.3 && !data.is_verified && (
            <Alert color="red" variant="light" title="Low Confidence">
              Very low verification score — review route on map and GPX before approve.
            </Alert>
          )}
        </Stack>
      </Card>
    </Box>
  );
};
