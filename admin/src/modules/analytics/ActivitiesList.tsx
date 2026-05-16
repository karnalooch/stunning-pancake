import React, { useState, useEffect } from 'react';
import { Box, Table, Text, Badge, Skeleton, Alert, Group, ThemeIcon, Pagination } from '@mantine/core';
import { AlertCircle, Bike, Footprints, PersonStanding, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';

interface ActivityItem {
    id: number;
    user?: string;
    user_info?: { username: string; id: number };
    type: string;
    start_time: string;
    end_time?: string | null;
    distance: number;
    duration?: number;
    is_verified: boolean;
    verification_score?: number;
}

const typeIcons: Record<string, React.ComponentType<{ size?: number }>> = {
    RUN: Footprints,
    BIKE: Bike,
    WALK: PersonStanding,
};

const PAGE_SIZE = 50;

export const ActivitiesList: React.FC = () => {
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        setLoading(true);
        apiClient.get('/activities/admin/all/', { params: { page, page_size: PAGE_SIZE } })
            .then(r => {
                const results = Array.isArray(r.data) ? r.data : r.data?.results ?? [];
                setActivities(results);
                setTotal(r.data?.count ?? results.length);
            })
            .catch(() => setError('Failed to load activities.'))
            .finally(() => setLoading(false));
    }, [page]);

    if (loading) {
        return (
            <Box p="md">
                <PageHeader title="All Activities" subtitle="Browse and inspect every recorded activity" />
                {[...Array(10)].map((_, i) => <Skeleton key={i} height={48} radius="md" mb="sm" />)}
            </Box>
        );
    }

    if (error) {
        return (
            <Box p="md">
                <PageHeader title="All Activities" />
                <Alert color="red" icon={<AlertCircle size={18} />} title="Error">{error}</Alert>
            </Box>
        );
    }

    if (activities.length === 0) {
        return (
            <Box p="md">
                <PageHeader title="All Activities" />
                <Text c="dimmed" ta="center" py="xl">No activities found.</Text>
            </Box>
        );
    }

    return (
        <Box p="md">
            <PageHeader title="All Activities" subtitle={`${total.toLocaleString()} activities recorded`} />
            <Box style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                <Table>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>#</Table.Th>
                            <Table.Th>User</Table.Th>
                            <Table.Th>Type</Table.Th>
                            <Table.Th>Distance</Table.Th>
                            <Table.Th>Duration</Table.Th>
                            <Table.Th>Date</Table.Th>
                            <Table.Th>Status</Table.Th>
                            <Table.Th></Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {activities.map((a) => {
                            const Icon = typeIcons[a.type] || Bike;
                            const username = a.user_info?.username || a.user || 'Unknown';
                            const distKm = ((a.distance || 0) / 1000).toFixed(1);
                            const durationMin = a.duration ? Math.floor((a.duration || 0) / 60) : null;
                            return (
                                <Table.Tr
                                    key={a.id}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/owner/activities/${a.id}`)}
                                >
                                    <Table.Td><Text size="xs" ff="monospace" c="dimmed">#{a.id}</Text></Table.Td>
                                    <Table.Td><Text size="sm" fw={500}>{username}</Text></Table.Td>
                                    <Table.Td>
                                        <Group gap={6}>
                                            <Icon size={14} />
                                            <Text size="sm">{a.type}</Text>
                                        </Group>
                                    </Table.Td>
                                    <Table.Td><Text size="sm">{distKm} km</Text></Table.Td>
                                    <Table.Td>
                                        <Text size="sm">{durationMin != null ? `${durationMin} min` : '—'}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="xs">{new Date(a.start_time).toLocaleDateString()}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Badge
                                            color={a.is_verified ? 'green' : 'orange'}
                                            variant="light"
                                            size="xs"
                                        >
                                            {a.is_verified ? 'Verified' : 'Pending'}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        <ArrowUpRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                                    </Table.Td>
                                </Table.Tr>
                            );
                        })}
                    </Table.Tbody>
                </Table>
            </Box>
            {total > PAGE_SIZE && (
                <Group justify="center" mt="md">
                    <Pagination total={Math.ceil(total / PAGE_SIZE)} value={page} onChange={setPage} />
                </Group>
            )}
        </Box>
    );
};
