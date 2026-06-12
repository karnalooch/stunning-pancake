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
import { ModerationActionBar } from '../moderation/ModerationActionBar';
import { useAuth } from '../../core/auth/useAuth';
import { buildSpeedProfile } from '../../utils/routeSpeedProfile';
import { useI18n } from '../../i18n/useI18n';

const typeIcons: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  RUN: Footprints, BIKE: Bike, WALK: PersonStanding,
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
  gpx_forensics_flags?: string[];
  rejection_reason?: string;
  rejection_notes?: string;
  user_info: { id: number; username: string; role: string };
  created_at: string;
}

export const ActivityDetail: React.FC = () => {
  const { t } = useI18n();
  const { hasAnyPermission } = useAuth();
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
        setError(typeof detail === 'string' ? detail : err.message || t.activity.loadFailed);
      })
      .finally(() => setLoading(false));
  }, [id, t.activity.loadFailed]);

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
      setError(t.activity.gpxExportFailed);
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
        <Title order={2} mb="md">{t.activity.detail} #{id}</Title>
        <Alert color="red" title={t.activity.errorLoadingTitle} variant="light">{error}</Alert>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box p="md">
        <Title order={2} mb="md">{t.activity.detail} #{id}</Title>
        <Alert color="gray" title={t.activity.notFoundTitle} variant="light">
          {t.activity.notFoundDesc.replace('{id}', String(id))}
        </Alert>
      </Box>
    );
  }

  const scorePct = Math.round(data.verification_score * 100);
  const scoreColor = data.verification_score >= 0.7 ? 'green' : data.verification_score >= 0.4 ? 'yellow' : 'red';

  const typeLabels: Record<string, string> = {
    RUN: t.activity.running,
    BIKE: t.activity.cycling,
    WALK: t.activity.nordicWalking,
  };

  return (
    <Box p="md">
      <Title order={2} mb="md">{t.activity.detail} #{id}</Title>

      {hasAnyPermission(['activities.approve', '*']) && (
        <ModerationActionBar activityId={data.id} isVerified={data.is_verified} />
      )}

      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }} mb="md">
        <Group mb="xs" gap="sm">
          <TypeIcon size={24} style={{ color: 'var(--accent)' }} />
          <Text fw={700} size="lg">{typeLabels[data.type] || data.type}</Text>
          <Badge color={data.is_verified ? 'green' : 'orange'} variant="light">
            {data.is_verified ? t.activity.verified : t.activity.unverified}
          </Badge>
          {data.gpx_sha256 && (
            <Badge color="teal" variant="light" size="sm">{t.activity.gpxArchived}</Badge>
          )}
        </Group>
        <Group gap="xl" mt="sm" wrap="wrap">
          <Box><Text size="xs" c="dimmed">{t.activity.user}</Text><Text fw={600}>{data.user_info.username}</Text></Box>
          <Box><Text size="xs" c="dimmed">{t.activity.distance}</Text><Text fw={600}>{(data.distance / 1000).toFixed(2)} km</Text></Box>
          <Box><Text size="xs" c="dimmed">{t.activity.start}</Text><Text fw={600}>{new Date(data.start_time).toLocaleString()}</Text></Box>
          <Box><Text size="xs" c="dimmed">{t.activity.verification}</Text><Badge color={scoreColor} variant="light">{scorePct}%</Badge></Box>
        </Group>
      </Card>

      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }} mb="md">
        <Group mb="md" justify="space-between">
          <Group gap="sm">
            <MapPin size={20} style={{ color: 'var(--accent)' }} />
            <Text fw={700}>{t.activity.gpsRouteInspector}</Text>
            {routePointCount > 0 && (
              <Badge color="indigo" variant="light">{routePointCount.toLocaleString()} {t.activity.points}</Badge>
            )}
          </Group>
          {routePointCount > 0 && (
            <Button size="xs" variant="light" leftSection={<Download size={14} />} onClick={downloadGpx}>
              {t.activity.downloadGpx}
            </Button>
          )}
        </Group>
        {routePointCount > 0 ? (
          <ActivityRouteMap routeCoords={data.route_coords!} verified={data.is_verified} height={320} />
        ) : (
          <Text c="dimmed" ta="center" py="xl">{t.activity.noRouteData}</Text>
        )}
      </Card>

      {speedProfile.length > 1 && (
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }} mb="md">
          <Text fw={700} mb="md">{t.activity.speedProfileEstimated}</Text>
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
          <Text fw={700}>{t.activity.antiCheatResults}</Text>
        </Group>
        <Stack gap="sm">
          <Group gap="sm">
            <Badge color={scoreColor} variant="light" size="lg">{t.activity.overallScore}: {scorePct}%</Badge>
            <Badge color={data.is_verified ? 'green' : 'orange'} variant="light" size="lg">
              {data.is_verified ? t.moderation.approved : t.activity.pendingReview}
            </Badge>
          </Group>
          {!data.is_verified && data.rejection_reason && (
            <Alert color="orange" variant="light" title={t.activity.rejectionReason}>
              {data.rejection_reason}{data.rejection_notes ? ` — ${data.rejection_notes}` : ''}
            </Alert>
          )}
          {data.verification_score < 0.3 && !data.is_verified && (
            <Alert color="red" variant="light" title={t.activity.lowConfidence}>
              {t.activity.lowConfidenceDesc}
            </Alert>
          )}
          {Array.isArray(data.gpx_forensics_flags) && data.gpx_forensics_flags.length > 0 && (
            <Alert color="orange" variant="light" title={t.activity.gpxForensics}>
              {data.gpx_forensics_flags.join(', ')}
            </Alert>
          )}
        </Stack>
      </Card>
    </Box>
  );
};
