import React, { useState, useEffect } from 'react';
import { Card, Text, Group, Stack, Badge, Button, Modal, Box, Code } from '@mantine/core';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { apiClient } from '../../api/client';

interface Ticket {
  id: string; activity_id?: number; user: string; type: string; score: number; time: string; distance: number; duration: string | null;
}

export const ModeratorWorklist = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<{ ticket: Ticket; action: 'approve' | 'reject' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAnomalies = () => {
    setLoading(true);
    apiClient.get('/activities/telemetry/anomalies/')
      .then(res => {
        const data = (res.data || []).map((t: any) => ({
          ...t,
          activityId: t.activity_id ?? (t.id ? parseInt(t.id.replace('AN-', ''), 10) : undefined),
        }));
        setTickets(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAnomalies(); }, []);

  const executeAction = async () => {
    if (!confirmAction || !confirmAction.ticket.activityId) return;
    setActionLoading(true);
    try {
      const endpoint = confirmAction.action === 'approve'
        ? `/activities/admin/approve/${confirmAction.ticket.activityId}/`
        : `/activities/admin/reject/${confirmAction.ticket.activityId}/`;
      await apiClient.post(endpoint);
      setTickets(prev => prev.filter(t => t.id !== confirmAction.ticket.id));
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  return (
    <Stack gap="lg">
      <Modal opened={!!confirmAction} onClose={() => setConfirmAction(null)} title={confirmAction?.action === 'approve' ? 'Approve Activity' : 'Reject Activity'} size="sm">
        <Stack gap="md">
          <Text size="sm">
            {confirmAction?.action === 'approve'
              ? `Mark ${confirmAction.ticket.user}'s activity as verified?`
              : `Reject ${confirmAction.ticket.user}'s activity? This flags it as suspicious.`}
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button color={confirmAction?.action === 'approve' ? 'green' : 'red'} onClick={executeAction} loading={actionLoading}>
              {confirmAction?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Card withBorder>
        <Group justify="space-between" mb="lg">
          <Stack gap={0}>
            <Text fw={600}>Moderation Queue</Text>
            <Text size="xs" c="dimmed">Review flagged activities</Text>
          </Stack>
          <Badge size="lg" color={tickets.length > 0 ? 'orange' : 'green'} variant="light">
            {loading ? 'Loading...' : `${tickets.length} pending`}
          </Badge>
        </Group>

        <Stack gap="xs">
          {loading ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">Loading moderation queue...</Text>
          ) : tickets.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">No pending issues. Queue is clear.</Text>
          ) : (
            tickets.map((ticket) => (
              <Group key={ticket.id} p="sm" style={{ borderRadius: 8, background: 'var(--surface-secondary)' }} justify="space-between" align="center">
                <Group gap="sm">
                  <AlertCircle size={18} color="var(--mantine-color-orange-6)" />
                  <Stack gap={0}>
                    <Text size="sm" fw={600}>{ticket.user}</Text>
                    <Text size="xs" c="dimmed">{ticket.type} · Score {ticket.score} · {ticket.time ? new Date(ticket.time).toLocaleDateString() : ''}</Text>
                  </Stack>
                </Group>
                <Group gap="xs">
                  <Button size="xs" color="green" variant="light" leftSection={<CheckCircle2 size={14} />} onClick={() => setConfirmAction({ ticket, action: 'approve' })}>Approve</Button>
                  <Button size="xs" color="red" variant="light" leftSection={<XCircle size={14} />} onClick={() => setConfirmAction({ ticket, action: 'reject' })}>Reject</Button>
                </Group>
              </Group>
            ))
          )}
        </Stack>
      </Card>
    </Stack>
  );
};
