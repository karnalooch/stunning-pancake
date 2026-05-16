import React, { useState, useEffect } from 'react';
import { Box, Text, Card, Table, Skeleton, Alert, Button, Group, Stack, Badge, SimpleGrid } from '@mantine/core';
import { Trophy, RefreshCw, Trash2, AlertCircle, ChevronRight } from 'lucide-react';
import { PageHeader } from '../../core/components/PageHeader';
import { apiClient } from '../../api/client';
import { notifications } from '@mantine/notifications';

interface LeaderboardMeta {
    city_id: string;
    city_name: string;
    total_participants: number;
    last_updated: string | null;
}

interface RankingEntry {
    rank: number;
    user_id: number;
    username: string;
    total_km: number;
    activities: number;
}

export const LeaderboardManager: React.FC = () => {
    const [leaderboards, setLeaderboards] = useState<LeaderboardMeta[]>([]);
    const [rankings, setRankings] = useState<RankingEntry[]>([]);
    const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
    const [selectedCityName, setSelectedCityName] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [rankingsLoading, setRankingsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recalculating, setRecalculating] = useState(false);

    useEffect(() => {
        fetchLeaderboards();
    }, []);

    const fetchLeaderboards = async () => {
        try {
            const { data } = await apiClient.get('/activities/leaderboard/admin/list/');
            const list = Array.isArray(data) ? data : [];
            setLeaderboards(list);
        } catch {
            setError('Unable to load leaderboards. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const fetchRankings = async (cityId: string, cityName: string) => {
        setSelectedCityId(cityId);
        setSelectedCityName(cityName);
        setRankingsLoading(true);
        try {
            const { data } = await apiClient.get(`/activities/leaderboard/${cityId}/`);
            const entries: any[] = data?.leaderboard || [];
            setRankings(entries.map((e: any, i: number) => ({
                rank: i + 1,
                user_id: e.user_id,
                username: e.username || 'Unknown Pilot',
                total_km: typeof e.total_km === 'number' ? Math.round(e.total_km * 10) / 10 : 0,
                activities: e.activities || e.activities_count || 0,
            })));
        } catch {
            notifications.show({ title: 'Error', message: 'Failed to load rankings for this city.', color: 'red' });
        } finally {
            setRankingsLoading(false);
        }
    };

    const handleRecalculateAll = async () => {
        setRecalculating(true);
        try {
            await apiClient.post('/activities/leaderboard/admin/recalculate/');
            notifications.show({ title: 'Recalculating', message: 'All leaderboards are being recalculated in the background.', color: 'blue' });
        } catch {
            notifications.show({ title: 'Error', message: 'Failed to trigger recalculation.', color: 'red' });
        } finally {
            setRecalculating(false);
        }
    };

    const handleClear = async (cityId: string) => {
        try {
            await apiClient.delete(`/activities/leaderboard/admin/${cityId}/`);
            notifications.show({ title: 'Cleared', message: `Leaderboard "${cityId}" has been cleared.`, color: 'orange' });
            await fetchLeaderboards();
            if (selectedCityId === cityId) {
                setRankings([]);
                setSelectedCityId(null);
                setSelectedCityName('');
            }
        } catch {
            notifications.show({ title: 'Error', message: 'Failed to clear leaderboard.', color: 'red' });
        }
    };

    return (
        <Box p="md">
            <PageHeader title="Leaderboard Manager" subtitle="Manage rankings and competitions">
                <Button
                    leftSection={<RefreshCw size={16} />}
                    onClick={handleRecalculateAll}
                    loading={recalculating}
                    variant="light"
                    color="blue"
                >
                    Recalculate All
                </Button>
            </PageHeader>

            {error && (
                <Alert icon={<AlertCircle size={16} />} color="red" variant="light" mb="md">
                    {error}
                </Alert>
            )}

            <Text fw={700} size="lg" mb="md">City Leaderboards</Text>

            {loading ? (
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md" mb="xl">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                            <Skeleton height={24} radius="sm" mb="sm" width="60%" />
                            <Skeleton height={16} radius="sm" mb="xs" width="40%" />
                            <Skeleton height={12} radius="sm" width="30%" />
                        </Card>
                    ))}
                </SimpleGrid>
            ) : leaderboards.length === 0 ? (
                <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }} mb="xl">
                    <Text c="dimmed" ta="center" py="md">No leaderboards found.</Text>
                </Card>
            ) : (
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md" mb="xl">
                    {leaderboards.map(lb => (
                        <Card
                            key={lb.city_id}
                            style={{
                                background: selectedCityId === lb.city_id ? 'var(--surface-secondary)' : 'var(--surface)',
                                border: selectedCityId === lb.city_id ? '2px solid var(--accent)' : '1px solid var(--border)',
                                borderRadius: 14,
                                padding: 20,
                                cursor: 'pointer',
                            }}
                            onClick={() => fetchRankings(lb.city_id, lb.city_name)}
                        >
                            <Group justify="space-between" mb="sm">
                                <Text fw={700} size="md">{lb.city_name || lb.city_id}</Text>
                                <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                            </Group>
                            <Group gap="sm" mb="xs">
                                <Badge variant="light" color="blue" size="sm">
                                    {lb.total_participants ?? '?'} participants
                                </Badge>
                                {lb.last_updated && (
                                    <Badge variant="light" color="gray" size="sm">
                                        Updated: {new Date(lb.last_updated).toLocaleDateString()}
                                    </Badge>
                                )}
                            </Group>
                            <Button
                                size="xs"
                                color="red"
                                variant="subtle"
                                leftSection={<Trash2 size={12} />}
                                onClick={(e) => { e.stopPropagation(); handleClear(lb.city_id); }}
                            >
                                Clear
                            </Button>
                        </Card>
                    ))}
                </SimpleGrid>
            )}

            {selectedCityId && (
                <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                    <Group mb="md">
                        <Trophy size={18} style={{ color: 'var(--accent)' }} />
                        <Text fw={700} size="lg">Top Riders — {selectedCityName || selectedCityId}</Text>
                        {rankings.length > 0 && (
                            <Badge variant="light" color="green" size="sm">
                                {rankings.length} ranked
                            </Badge>
                        )}
                    </Group>

                    {rankingsLoading ? (
                        <Stack gap="sm">
                            {[...Array(5)].map((_, i) => <Skeleton key={i} height={40} radius="sm" />)}
                        </Stack>
                    ) : rankings.length === 0 ? (
                        <Text c="dimmed" ta="center" py="md">
                            No rankings available for this city. Try recalculating.
                        </Text>
                    ) : (
                        <Table>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>#</Table.Th>
                                    <Table.Th>User</Table.Th>
                                    <Table.Th>Distance</Table.Th>
                                    <Table.Th>Activities</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {rankings.map(r => (
                                    <Table.Tr key={r.user_id}>
                                        <Table.Td>
                                            {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank}
                                        </Table.Td>
                                        <Table.Td><Text fw={500}>{r.username}</Text></Table.Td>
                                        <Table.Td>{r.total_km}km</Table.Td>
                                        <Table.Td>{r.activities}</Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    )}
                </Card>
            )}
        </Box>
    );
};
