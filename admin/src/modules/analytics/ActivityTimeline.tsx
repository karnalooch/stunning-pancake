import React, { useState, useEffect } from 'react';
import { Box, Text, Stack, Group, Badge, Skeleton, ThemeIcon } from '@mantine/core';
import { Clock, Bike, Footprints, PersonStanding } from 'lucide-react';
import { apiClient } from '../../api/client';

const typeIcons: Record<string, any> = { RUN: Footprints, BIKE: Bike, WALK: PersonStanding };

export const ActivityTimeline: React.FC = () => {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get('/activities/sessions/').then(r => {
            setItems((r.data?.results || r.data || []).slice(0, 20));
        }).catch(() => { }).finally(() => setLoading(false));
    }, []);

    return (
        <Box><Text fw={700} size="lg" mb="md">Activity Timeline</Text>
            {loading ? <Stack gap="sm">{[...Array(5)].map((_, i) => <Skeleton key={i} height={48} radius="md" />)}</Stack> : items.length === 0 ? <Text c="dimmed" ta="center">No activities.</Text> : (
                <Stack gap="xs">{items.map((a, i) => {
                    const Icon = typeIcons[a.type] || Clock;
                    return <Group key={i} p="xs" style={{ borderRadius: 10, background: 'var(--surface-secondary)' }} gap="sm" wrap="nowrap">
                        <ThemeIcon size={32} radius="md" color="indigo" variant="light"><Icon size={16} /></ThemeIcon>
                        <Box style={{ flex: 1 }}><Text size="sm" fw={600}>{a.user || a.user_info?.username || 'User'}</Text><Text size="xs" c="dimmed">{a.type} · {((a.distance || 0) / 1000).toFixed(1)}km · {new Date(a.start_time).toLocaleDateString()}</Text></Box>
                        <Badge color={a.is_verified ? 'green' : 'orange'} variant="light" size="xs">{a.is_verified ? '✅' : '⚠️'}</Badge>
                    </Group>;
                })}</Stack>
            )}
        </Box>
    );
};
