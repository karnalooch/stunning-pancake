import React, { useState, useEffect, useCallback } from 'react';
import { Card, Text, Group, Stack, Badge, Button, ScrollArea, Box, Modal, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { AlertCircle, CheckCircle2, XCircle, Clock, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiClient } from '../../api/client';

interface Ticket {
  id: string;
  user: string;
  type: string;
  score: number;
  time: string;
  activityId?: number;
}

export const ModeratorWorklist = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAnomalies = useCallback(() => {
    setLoading(true);
    apiClient.get('/activities/telemetry/anomalies/')
      .then(res => {
        const data = (res.data || []).map((t: any) => ({
          ...t,
          activityId: t.activity_id ?? (t.id ? parseInt(t.id.replace('AN-', ''), 10) : undefined),
        }));
        setTickets(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load anomalies:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchAnomalies();
  }, [fetchAnomalies]);

  const executeAction = async () => {
    if (!selectedTicket || !selectedTicket.activityId || !confirmAction) return;
    setActionLoading(true);
    try {
      const endpoint = confirmAction === 'approve' 
        ? `/activities/admin/approve/${selectedTicket.activityId}/`
        : `/activities/admin/reject/${selectedTicket.activityId}/`;
      await apiClient.post(endpoint);
      setTickets(prev => prev.filter(t => t.id !== selectedTicket.id));
    } catch (err) {
      console.error(`Failed to ${confirmAction} ticket:`, err);
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
      setSelectedTicket(null);
    }
  };

  const handleApprove = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setConfirmAction('approve');
  };

  const handleReject = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setConfirmAction('reject');
  };

  return (
    <Stack gap="xl">
      <Modal
        opened={!!confirmAction}
        onClose={() => { setConfirmAction(null); setSelectedTicket(null); }}
        title={confirmAction === 'approve' ? 'Approve Activity?' : 'Reject Activity?'}
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            {confirmAction === 'approve'
              ? `Mark activity for ${selectedTicket?.user} as verified (score: 1.0)?`
              : `Reject activity for ${selectedTicket?.user} (score: 0.0)? This will flag it as cheating.`}
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => { setConfirmAction(null); setSelectedTicket(null); }}>
              Cancel
            </Button>
            <Button
              color={confirmAction === 'approve' ? 'green' : 'red'}
              onClick={executeAction}
              loading={actionLoading}
            >
              {confirmAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Card radius="xl" p="xl" className="fluent-acrylic" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
        <Group mb="xl" justify="space-between">
          <Stack gap={0}>
            <Text fw={900} size="lg" color="white">Moderation Queue</Text>
            <Text size="xs" c="dimmed">Review flagged activities for your instance</Text>
          </Stack>
          <Badge size="lg" color={tickets.length > 0 ? 'orange' : 'green'} variant="light">
            {loading ? 'LOADING...' : `${tickets.length} PENDING TICKETS`}
          </Badge>
        </Group>

        <ScrollArea h={400}>
          <Stack gap="md">
            {loading ? (
              <Text size="sm" c="dimmed" ta="center" py="xl">Loading moderation queue...</Text>
            ) : tickets.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="xl">No pending integrity issues found.</Text>
            ) : (
              tickets.map((ticket, index) => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Box 
                    p="md" 
                    style={{ 
                      background: 'rgba(255,255,255,0.03)', 
                      borderRadius: '16px', 
                      border: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <Group>
                      <Box p="xs" bg="rgba(251, 191, 36, 0.1)" style={{ borderRadius: '12px' }}>
                        <AlertCircle size={20} color="#FBBF24" />
                      </Box>
                      <Stack gap={0}>
                        <Text size="sm" fw={800} color="white">{ticket.user}</Text>
                        <Text size="xs" c="dimmed">{ticket.type} • Score: {ticket.score} • {ticket.time}</Text>
                      </Stack>
                    </Group>

                    <Group>
                      <Tooltip label="Approve as legitimate activity">
                        <Button 
                          variant="light" 
                          color="green" 
                          size="xs" 
                          leftSection={<CheckCircle2 size={14}/>}
                          onClick={() => handleApprove(ticket)}
                        >
                          Approve
                        </Button>
                      </Tooltip>
                      <Tooltip label="Reject and flag as cheating">
                        <Button 
                          variant="light" 
                          color="red" 
                          size="xs" 
                          leftSection={<XCircle size={14}/>}
                          onClick={() => handleReject(ticket)}
                        >
                          Reject
                        </Button>
                      </Tooltip>
                      <Tooltip label={`Activity ID: ${ticket.activityId ?? 'N/A'} | Score: ${ticket.score}`}>
                        <Button variant="subtle" color="gray" size="xs">
                          <Info size={14} />
                        </Button>
                      </Tooltip>
                    </Group>
                  </Box>
                </motion.div>
              ))
            )}
          </Stack>
        </ScrollArea>
      </Card>

      <Card radius="xl" p="xl" bg="rgba(37, 99, 235, 0.05)" style={{ border: '1px dashed rgba(37, 99, 235, 0.3)' }}>
        <Group>
           <Clock size={20} color="#2563EB" />
           <Text size="sm" fw={600} color="white">
             Daily Moderation Goal: {tickets.length > 0 ? `${tickets.length} remaining` : '100% Clean ✓'}
           </Text>
        </Group>
      </Card>
    </Stack>
  );
};
