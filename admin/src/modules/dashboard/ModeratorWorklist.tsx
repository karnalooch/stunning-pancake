import React, { useState, useEffect } from 'react';
import { Card, Text, Group, Badge, Button, Stack, Table, Skeleton } from '@mantine/core';
import { Check, X, Activity } from 'lucide-react';
import { apiClient } from '../../api/client';
import { notifications } from '@mantine/notifications';

export const ModeratorWorklist: React.FC = () => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = async () => {
    try { const { data } = await apiClient.get('/activities/admin/stats/'); setActivities((data as any)?.per_tenant?.[0]?.recent_unverified || []); } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchActivities();
    });
  }, []);

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    try {
      await apiClient.post(`/activities/admin/${action}/${id}/`);
      notifications.show({ title: 'Done', message: `Activity ${action}d.`, color: action === 'approve' ? 'green' : 'orange' });
      fetchActivities();
    } catch { notifications.show({ title: 'Error', message: 'Action failed.', color: 'red' }); }
  };

  return (
    <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
      <Group mb="md"><Activity size={20} style={{ color: 'var(--accent)' }} /><Text fw={700} size="lg">Pending Moderation</Text><Badge color="orange" variant="light">{activities.length}</Badge></Group>
      {loading ? <Stack gap="sm">{[...Array(5)].map((_, i) => <Skeleton key={i} height={48} radius="md" />)}</Stack> : activities.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">No pending activities.</Text>
      ) : (
        <Table>
          <Table.Thead><Table.Tr><Table.Th>User</Table.Th><Table.Th>Type</Table.Th><Table.Th>Distance</Table.Th><Table.Th>Score</Table.Th><Table.Th>Actions</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{activities.map((a: any, i: number) => (
            <Table.Tr key={i}><Table.Td><Text fw={500} size="sm">{a.user || a.username || 'Unknown'}</Text></Table.Td><Table.Td><Badge size="sm" variant="light">{a.type || 'RUN'}</Badge></Table.Td><Table.Td><Text size="sm">{a.distance ? `${(a.distance / 1000).toFixed(1)}km` : '—'}</Text></Table.Td><Table.Td><Badge size="sm" color={a.score > 0.5 ? 'green' : 'orange'} variant="light">{a.score?.toFixed(2) || '0.00'}</Badge></Table.Td><Table.Td>
              <Group gap={4}><Button size="xs" color="green" variant="light" leftSection={<Check size={12} />} onClick={() => handleAction(a.id || a.activity_id, 'approve')}>Approve</Button><Button size="xs" color="red" variant="light" leftSection={<X size={12} />} onClick={() => handleAction(a.id || a.activity_id, 'reject')}>Reject</Button></Group>
            </Table.Td></Table.Tr>
          ))}</Table.Tbody>
        </Table>
      )}
    </Card>
  );
};
