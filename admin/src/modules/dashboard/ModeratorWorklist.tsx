import React, { useState, useEffect } from 'react';
import { Card, Text, Group, Stack, Badge, Button, ScrollArea, Box } from '@mantine/core';
import { AlertCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiClient } from '../../api/client';

export const ModeratorWorklist = () => {
  const [tickets, setTickets] = useState<any[]>([]);

  useEffect(() => {
    apiClient.get('/activities/telemetry/anomalies/')
      .then(res => setTickets(res.data))
      .catch(err => console.error("Failed to load anomalies:", err));
  }, []);

  return (
    <Stack gap="xl">
      <Card radius="xl" p="xl" className="fluent-acrylic" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
        <Group mb="xl" justify="space-between">
          <Stack gap={0}>
            <Text fw={900} size="lg" color="white">Moderation Queue</Text>
            <Text size="xs" c="dimmed">Review flagged activities for your instance</Text>
          </Stack>
          <Badge size="lg" color="orange" variant="light">{tickets.length} PENDING TICKETS</Badge>
        </Group>

        <ScrollArea h={400}>
          <Stack gap="md">
            {tickets.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="xl">No pending integrity issues found.</Text>
            ) : (
              tickets.map((ticket, index) => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
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
                        <Text size="xs" c="dimmed">{ticket.type} • Score: {ticket.score}</Text>
                      </Stack>
                    </Group>

                    <Group>
                      <Button variant="light" color="green" size="xs" leftSection={<CheckCircle2 size={14}/>}>Approve</Button>
                      <Button variant="light" color="red" size="xs" leftSection={<XCircle size={14}/>}>Ban</Button>
                      <Button variant="subtle" color="gray" size="xs">Details</Button>
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
           <Text size="sm" fw={600} color="white">Daily Moderation Goal: 100% Clean</Text>
        </Group>
      </Card>
    </Stack>
  );
};
