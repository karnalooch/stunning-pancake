import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Text, Group, Badge, Button, Stack, Table, Skeleton, Tabs, Anchor,
} from '@mantine/core';
import { Check, X, Activity, ShieldAlert, Calendar, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../core/auth/useAuth';
import { PageHeader } from '../../core/components/PageHeader';

function resolvePendingQueue(data: Record<string, unknown>, tenantId: string | null | undefined): unknown[] {
  if (Array.isArray(data.recent_unverified) && data.recent_unverified.length > 0) {
    return data.recent_unverified;
  }
  const perTenant = data.per_tenant;
  if (!Array.isArray(perTenant)) return [];
  if (tenantId) {
    const row = perTenant.find((t: { tenant_id?: string }) => String(t.tenant_id) === String(tenantId));
    if (row && Array.isArray((row as { recent_unverified?: unknown[] }).recent_unverified)) {
      return (row as { recent_unverified: unknown[] }).recent_unverified;
    }
  }
  return [];
}

export const ModeratorInbox: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const [activities, setActivities] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, cheatRes] = await Promise.all([
        apiClient.get('/activities/admin/stats/'),
        apiClient.get('/activities/telemetry/anomalies/').catch(() => ({ data: [] })),
      ]);
      setActivities(resolvePendingQueue(statsRes.data as Record<string, unknown>, tenantId) as any[]);
      const raw = cheatRes.data;
      setAnomalies(Array.isArray(raw) ? raw : raw?.results ?? []);
    } catch {
      setActivities([]);
      setAnomalies([]);
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

  const totalCount = activities.length + anomalies.length;

  return (
    <Box>
      <PageHeader title="Moderation Inbox" subtitle="Unified queue — activities, anomalies, events" />
      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <Group mb="md">
          <Activity size={20} style={{ color: 'var(--accent)' }} />
          <Text fw={700} size="lg">Work queue</Text>
          <Badge color="orange" variant="light">{totalCount} open</Badge>
        </Group>

        <Tabs defaultValue="activities">
          <Tabs.List mb="md">
            <Tabs.Tab value="activities" leftSection={<Activity size={14} />}>
              Activities ({activities.length})
            </Tabs.Tab>
            <Tabs.Tab value="anomalies" leftSection={<ShieldAlert size={14} />}>
              Anomalies ({anomalies.length})
            </Tabs.Tab>
            <Tabs.Tab value="events" leftSection={<Calendar size={14} />}>
              Events
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="activities">
            {loading ? (
              <Stack gap="sm">{[...Array(4)].map((_, i) => <Skeleton key={i} height={48} radius="md" />)}</Stack>
            ) : activities.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">No pending activities.</Text>
            ) : (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Distance</Table.Th>
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

          <Tabs.Panel value="anomalies">
            {loading ? (
              <Skeleton height={120} radius="md" />
            ) : anomalies.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">No anomalies flagged.</Text>
            ) : (
              <Stack gap="sm">
                {anomalies.slice(0, 20).map((a: any, i: number) => (
                  <Group key={a.id ?? i} justify="space-between" p="sm" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                    <Text size="sm">{a.description || a.type || `Anomaly #${a.id ?? i}`}</Text>
                    <Button size="xs" variant="light" component={Link} to="/owner/anti-cheat">Review</Button>
                  </Group>
                ))}
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="events">
            <Text c="dimmed" ta="center" py="xl">
              Event moderation — <Anchor component={Link} to="/owner/analytics/events">open Events Manager</Anchor>
            </Text>
          </Tabs.Panel>
        </Tabs>
      </Card>
    </Box>
  );
};
