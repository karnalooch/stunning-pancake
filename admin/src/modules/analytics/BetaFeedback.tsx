import React from 'react';
import { Box, Card, Text, Badge, Group, Stack } from '@mantine/core';
import { MessageSquare, Check, Clock } from 'lucide-react';

const items = [{ user: 'athlete_01', msg: 'Map sometimes freezes on Android 14', status: 'open' }, { user: 'athlete_warsaw', msg: 'Strava sync works great!', status: 'resolved' }, { user: 'global_owner', msg: 'Need dark mode for admin panel', status: 'open' }];

export const BetaFeedback: React.FC = () => (
    <Box p="md"><Text fw={700} size="xl" mb="md">Beta Feedback Dashboard</Text>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
            <Stack gap="sm">{items.map((f, i) =>
                <Group key={i} p="sm" style={{ borderRadius: 12, background: 'var(--surface-secondary)', border: '1px solid var(--border-subtle)' }} wrap="nowrap">
                    <Box style={{ flex: 1 }}><Text size="sm" fw={600}>{f.user}</Text><Text size="xs" c="dimmed">{f.msg}</Text></Box>
                    <Badge color={f.status === 'resolved' ? 'green' : 'orange'} variant="light" leftSection={f.status === 'resolved' ? <Check size={10} /> : <Clock size={10} />}>{f.status === 'resolved' ? 'Resolved' : 'Open'}</Badge>
                </Group>
            )}</Stack>
        </Card>
    </Box>
);
