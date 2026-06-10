import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Card, Text, Group, Badge, Button, Stack, Table, Skeleton, Tabs, Anchor,
} from '@mantine/core';
import { Check, X, Activity, ShieldAlert, Calendar, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../core/auth/useAuth';
import { PageHeader } from '../../core/components/PageHeader';
import { resolvePendingQueue } from '../../utils/moderationQueue';
import { severityColor, severityLabel } from '../../utils/anomalySeverity';

interface AnomalyRow {
  id: string;
  activity_id: number;
  user: string;
  type: string;
  score: number;
  severity?: string;
  description?: string;
  distance?: number;
}

interface DraftEvent {
  id: number;
  title: string;
  status: string;
  event_type?: string;
  start_date?: string;
}

export const ModeratorInbox: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const [activities, setActivities] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([]);
  const [draftEvents, setDraftEvents] = useState<DraftEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, cheatRes, eventsRes] = await Promise.all([
        apiClient.get('/activities/admin/stats/'),
        apiClient.get('/activities/telemetry/anomalies/').catch(() => ({ data: [] })),
        apiClient.get('/events/').catch(() => ({ data: [] })),
      ]);
      const rawAnomalies = cheatRes.data;
      const anomalyList: AnomalyRow[] = Array.isArray(rawAnomalies)
        ? rawAnomalies
        : rawAnomalies?.results ?? [];
      setAnomalies(anomalyList);

      const anomalyIds = new Set(anomalyList.map((a) => a.activity_id));
      const pending = resolvePendingQueue(statsRes.data as Record<string, unknown>, tenantId);
      setActivities(
        pending.filter((a) => !anomalyIds.has((a.id || a.activity_id) as number)),
      );

      const rawEvents = eventsRes.data;
      const eventList: DraftEvent[] = Array.isArray(rawEvents)
        ? rawEvents
        : rawEvents?.results ?? [];
      setDraftEvents(eventList.filter((e) => e.status === 'DRAFT'));
    } catch {
      setActivities([]);
      setAnomalies([]);
      setDraftEvents([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    try {
      await apiClient.post(`/activities/admin/${action}/${id}/`);
      notifications.show({ title: 'Done', message: `Activity ${action}d.`, color: action === 'approve' ? 'green' : 'orange' });
      fetchAll();
    } catch {
      notifications.show({ title: 'Error', message: 'Action failed.', color: 'red' });
    }
  };

  const publishEvent = async (id: number) => {
    try {
      await apiClient.patch(`/events/${id}/`, { status: 'PUBLISHED' });
      notifications.show({ title: 'Published', message: 'Event is now live.', color: 'green' });
      fetchAll();
    } catch {
      notifications.show({ title: 'Error', message: 'Publish failed.', color: 'red' });
    }
  };

  const defaultTab = useMemo(() => {
    if (anomalies.length > 0) return 'anomalies';
    if (activities.length > 0) return 'activities';
    if (draftEvents.length > 0) return 'events';
    return 'activities';
  }, [anomalies.length, activities.length, draftEvents.length]);

  const totalCount = activities.length + anomalies.length + draftEvents.length;

  return (
    <Box>
      <PageHeader
        title="Moderation Inbox"
        subtitle="Unified queue — low-score anomalies first, then standard pending review"
      />
      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <Group mb="md">
          <Activity size={20} style={{ color: 'var(--accent)' }} />
          <Text fw={700} size="lg">Work queue</Text>
          <Badge color="orange" variant="light">{totalCount} open</Badge>
          {anomalies.length > 0 && (
            <Badge color="red" variant="light">{anomalies.length} anti-cheat</Badge>
          )}
        </Group>

        <Tabs defaultValue={defaultTab}>
          <Tabs.List mb="md">
            <Tabs.Tab value="anomalies" leftSection={<ShieldAlert size={14} />}>
              Anti-Cheat ({anomalies.length})
            </Tabs.Tab>
            <Tabs.Tab value="activities" leftSection={<Activity size={14} />}>
              Pending ({activities.length})
            </Tabs.Tab>
            <Tabs.Tab value="events" leftSection={<Calendar size={14} />}>
              Events ({draftEvents.length})
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="anomalies">
            {loading ? (
              <Skeleton height={120} radius="md" />
            ) : anomalies.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">No low-score anomalies — good sign.</Text>
            ) : (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Severity</Table.Th>
                    <Table.Th>Athlete</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Score</Table.Th>
                    <Table.Th>Issue</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {anomalies.map((a) => (
                    <Table.Tr key={a.id}>
                      <Table.Td>
                        <Badge size="sm" color={severityColor(a.severity)} variant="filled">
                          {severityLabel(a.severity)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Anchor component={Link} to={`/owner/activities/${a.activity_id}`} size="sm" fw={500}>
                          {a.user}
                        </Anchor>
                      </Table.Td>
                      <Table.Td>{a.type}</Table.Td>
                      <Table.Td>
                        <Text ff="monospace" size="sm" c={a.score < 0.2 ? 'red' : undefined}>
                          {a.score.toFixed(2)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed" maw={280} lineClamp={2}>
                          {a.description || 'Verification anomaly'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <Button
                            size="xs"
                            variant="light"
                            component={Link}
                            to={`/owner/activities/${a.activity_id}`}
                          >
                            Detail
                          </Button>
                          <Button size="xs" color="green" variant="light" leftSection={<Check size={12} />} onClick={() => handleAction(a.activity_id, 'approve')}>Approve</Button>
                          <Button size="xs" color="red" variant="light" leftSection={<X size={12} />} onClick={() => handleAction(a.activity_id, 'reject')}>Reject</Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="activities">
            {loading ? (
              <Stack gap="sm">{[...Array(4)].map((_, i) => <Skeleton key={i} height={48} radius="md" />)}</Stack>
            ) : activities.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">No standard pending activities.</Text>
            ) : (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Distance</Table.Th>
                    <Table.Th>Score</Table.Th>
                    <Table.Th>GPX</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {activities.map((a: any) => {
                    const aid = a.id || a.activity_id;
                    return (
                      <Table.Tr key={aid}>
                        <Table.Td>
                          <Anchor component={Link} to={`/owner/activities/${aid}`} size="sm" fw={500}>
                            {a.user || a.username || 'Unknown'}
                          </Anchor>
                        </Table.Td>
                        <Table.Td>{a.type || '—'}</Table.Td>
                        <Table.Td>{a.distance ? `${(a.distance / 1000).toFixed(1)} km` : '—'}</Table.Td>
                        <Table.Td>
                          <Text ff="monospace" size="sm">{(a.score ?? 0).toFixed(2)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Button
                            component="a"
                            href={`${apiClient.defaults.baseURL || '/api'}/activities/sessions/${aid}/gpx/`}
                            target="_blank"
                            rel="noreferrer"
                            size="xs"
                            variant="light"
                            leftSection={<Download size={12} />}
                          >
                            GPX
                          </Button>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            <Button size="xs" color="green" variant="light" leftSection={<Check size={12} />} onClick={() => handleAction(aid, 'approve')}>Approve</Button>
                            <Button size="xs" color="red" variant="light" leftSection={<X size={12} />} onClick={() => handleAction(aid, 'reject')}>Reject</Button>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="events">
            {loading ? (
              <Skeleton height={120} radius="md" />
            ) : draftEvents.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                No draft events — <Anchor component={Link} to="/owner/analytics/events">Events Manager</Anchor>
              </Text>
            ) : (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Title</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Start</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {draftEvents.map((e) => (
                    <Table.Tr key={e.id}>
                      <Table.Td><Text fw={500} size="sm">{e.title}</Text></Table.Td>
                      <Table.Td>{e.event_type || '—'}</Table.Td>
                      <Table.Td>{e.start_date ? new Date(e.start_date).toLocaleDateString() : '—'}</Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <Button size="xs" color="green" variant="light" onClick={() => publishEvent(e.id)}>Publish</Button>
                          <Button size="xs" variant="light" component={Link} to="/owner/analytics/events">Manager</Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>
        </Tabs>
      </Card>
    </Box>
  );
};
