import React, { useState, useEffect } from 'react';
import { Box, Card, Text, Badge, Group, Stack, Skeleton, Button } from '@mantine/core';
import { Check, Clock } from 'lucide-react';
import { apiClient } from '../../api/client';

export const BetaFeedback: React.FC = () => {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [resolving, setResolving] = useState<Record<number, boolean>>({});

    useEffect(() => {
        apiClient.get('/activities/beta-feedback/list/')
            .then(r => setItems(Array.isArray(r.data) ? r.data : []))
            .catch(() => setError('Failed to load feedback.'))
            .finally(() => setLoading(false));
    }, []);

    const handleResolve = (id: number) => {
        setResolving(prev => ({ ...prev, [id]: true }));
        apiClient.post(`/activities/beta-feedback/${id}/resolve/`)
            .then(() => {
                setItems(prev => prev.map(item => item.id === id ? { ...item, resolved: true } : item));
            })
            .catch(() => { })
            .finally(() => setResolving(prev => ({ ...prev, [id]: false })));
    };

    return (
        <Box p="md"><Text fw={700} size="xl" mb="md">Beta Feedback Dashboard</Text>
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                {loading ? (
                    <Stack gap="sm">{[...Array(3)].map((_, i) => <Skeleton key={i} height={64} radius="md" />)}</Stack>
                ) : error ? (
                    <Text c="red" size="sm" ta="center">{error}</Text>
                ) : items.length === 0 ? (
                    <Text c="dimmed" ta="center">No feedback items.</Text>
                ) : (
                    <Stack gap="sm">
                        {items.map((f) => (
                            <Group key={f.id} p="sm" style={{ borderRadius: 12, background: 'var(--surface-secondary)', border: '1px solid var(--border-subtle)' }} wrap="nowrap">
                                <Box style={{ flex: 1 }}>
                                    <Text size="sm" fw={600}>{f.username}</Text>
                                    <Text size="xs" c="dimmed">{f.message}</Text>
                                </Box>
                                {f.resolved ? (
                                    <Badge color="green" variant="light" leftSection={<Check size={10} />}>Resolved</Badge>
                                ) : (
                                    <Group gap="xs">
                                        <Badge color="orange" variant="light" leftSection={<Clock size={10} />}>Open</Badge>
                                        <Button
                                            size="xs"
                                            variant="light"
                                            color="green"
                                            loading={resolving[f.id]}
                                            onClick={() => handleResolve(f.id)}
                                        >
                                            Resolve
                                        </Button>
                                    </Group>
                                )}
                            </Group>
                        ))}
                    </Stack>
                )}
            </Card>
        </Box>
    );
};
