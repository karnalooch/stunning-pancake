import React, { useState, useEffect } from 'react';
import { Box, Card, Text, Table, Badge, SimpleGrid, ThemeIcon, Skeleton } from '@mantine/core';
import { Calendar, Clock, Users, Trophy } from 'lucide-react';
import { apiClient } from '../../api/client';

export const EventsManager: React.FC = () => {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiClient.get('/events/')
            .then(r => setEvents(Array.isArray(r.data) ? r.data : (r.data?.results || [])))
            .catch(() => setError('Failed to load events.'))
            .finally(() => setLoading(false));
    }, []);

    const activeCount = events.filter(e => e.status === 'ACTIVE').length;
    const upcomingCount = events.filter(e => e.status === 'PUBLISHED').length;

    const statusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'green';
            case 'PUBLISHED': return 'blue';
            case 'COMPLETED': return 'gray';
            case 'DRAFT': return 'yellow';
            case 'CANCELLED': return 'red';
            default: return 'gray';
        }
    };

    const stats = [
        { icon: Trophy, label: 'Active Events', value: String(activeCount), color: 'indigo' },
        { icon: Users, label: 'Total Events', value: String(events.length), color: 'green' },
        { icon: Calendar, label: 'Upcoming', value: String(upcomingCount), color: 'violet' },
    ];

    return (
        <Box p="md"><Text fw={700} size="xl" mb="md">Events Manager</Text>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="xl">
                {stats.map((s, i) => (
                    <Card key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}>
                        <ThemeIcon size={36} radius="md" color={s.color} variant="light" mx="auto"><s.icon size={18} /></ThemeIcon>
                        {loading ? <Skeleton height={28} mt="sm" mx="auto" width={60} radius="sm" /> : <Text fw={700} size="xl" mt="sm">{s.value}</Text>}
                        <Text size="xs" c="dimmed">{s.label}</Text>
                    </Card>
                ))}
            </SimpleGrid>
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                <Text fw={700} mb="md">Event List</Text>
                {loading ? (
                    [...Array(3)].map((_, i) => <Skeleton key={i} height={40} radius="md" mb="sm" />)
                ) : error ? (
                    <Text c="red" size="sm" ta="center">{error}</Text>
                ) : events.length === 0 ? (
                    <Text c="dimmed" ta="center">No events found.</Text>
                ) : (
                    <Table>
                        <thead><tr><th>Event</th><th>Type</th><th>Start Date</th><th>End Date</th><th>Status</th></tr></thead>
                        <tbody>
                            {events.map((e: any) => (
                                <tr key={e.id}>
                                    <td><Text fw={500}>{e.title}</Text></td>
                                    <td><Text size="xs" c="dimmed">{e.event_type}</Text></td>
                                    <td>{new Date(e.start_date).toLocaleDateString()}</td>
                                    <td>{new Date(e.end_date).toLocaleDateString()}</td>
                                    <td><Badge color={statusColor(e.status)}>{e.status}</Badge></td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </Card>
        </Box>
    );
};
