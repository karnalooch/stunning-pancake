import React from 'react';
import { Box, Card, Text, Table, Badge, SimpleGrid, ThemeIcon } from '@mantine/core';
import { Calendar, Clock, Users, Trophy } from 'lucide-react';

export const EventsManager: React.FC = () => {
    const events = [
        { name: 'Siedlce Marathon', date: '2026-06-15', participants: 234, status: 'Active' },
        { name: 'Warsaw Bike Race', date: '2026-07-01', participants: 412, status: 'Active' },
        { name: 'Kraków Walk Challenge', date: '2026-05-20', participants: 89, status: 'Ended' },
    ];
    return <Box p="md"><Text fw={700} size="xl" mb="md">Events Manager</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="xl">{[{ icon: Trophy, label: 'Active Events', value: '2', color: 'indigo' }, { icon: Users, label: 'Total Participants', value: '735', color: 'green' }, { icon: Calendar, label: 'Upcoming', value: '4', color: 'violet' }].map((s, i) =>
            <Card key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}><ThemeIcon size={36} radius="md" color={s.color} variant="light" mx="auto"><s.icon size={18} /></ThemeIcon><Text fw={700} size="xl" mt="sm">{s.value}</Text><Text size="xs" c="dimmed">{s.label}</Text></Card>
        )}</SimpleGrid>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
            <Text fw={700} mb="md">Event List</Text>
            <Table><thead><tr><th>Event</th><th>Date</th><th>Participants</th><th>Status</th></tr></thead><tbody>{events.map(e => <tr key={e.name}><td><Text fw={500}>{e.name}</Text></td><td>{e.date}</td><td>{e.participants}</td><td><Badge color={e.status === 'Active' ? 'green' : 'gray'}>{e.status}</Badge></td></tr>)}</tbody></Table>
        </Card>
    </Box>;
};
