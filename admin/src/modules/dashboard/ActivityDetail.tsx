import React from 'react';
import { Box, Text, Title, Group, Badge, Card } from '@mantine/core';
import { MapPin, Clock, Gauge, ShieldCheck } from 'lucide-react';
import { useParams } from 'react-router-dom';

export const ActivityDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    return (
        <Box p="md">
            <Title order={2} mb="md">Activity #{id}</Title>
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }} mb="md">
                <Group mb="md"><MapPin size={20} style={{ color: 'var(--accent)' }} /><Text fw={700}>GPS Route</Text></Group>
                <Box style={{ height: 300, background: 'var(--surface-secondary)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Text c="dimmed">Map view loading...</Text>
                </Box>
            </Card>
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                <Group mb="md"><ShieldCheck size={20} style={{ color: 'var(--accent)' }} /><Text fw={700}>Anti-Cheat Results</Text></Group>
                <Group gap="sm">
                    <Badge color="green" variant="light">Layer 1: Kinematic ✅</Badge>
                    <Badge color="green" variant="light">Layer 2: V-max ✅</Badge>
                    <Badge color="yellow" variant="light">Layer 3: BRouter ⏳</Badge>
                    <Badge color="gray" variant="light">Layer 4: Viterbi —</Badge>
                </Group>
            </Card>
        </Box>
    );
};
