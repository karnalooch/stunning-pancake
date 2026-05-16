import React, { useState, useEffect } from 'react';
import { Box, Card, Text, Table, Badge, SimpleGrid, ThemeIcon, Skeleton, Stack } from '@mantine/core';
import { Gift, Users, TrendingUp, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../../api/client';

export const RewardsVouchers: React.FC = () => {
    const [pools, setPools] = useState<any[]>([]);
    const [balance, setBalance] = useState<{ points: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([
            apiClient.get('/rewards/pools/'),
            apiClient.get('/rewards/balance/'),
        ])
            .then(([poolsRes, balanceRes]) => {
                setPools(Array.isArray(poolsRes.data) ? poolsRes.data : []);
                setBalance(balanceRes.data ?? { points: 0 });
            })
            .catch(() => setError('Failed to load rewards data.'))
            .finally(() => setLoading(false));
    }, []);

    const activeCount = pools.length;
    const totalAvailable = pools.reduce((sum, p) => sum + (p.available || 0), 0);

    const stats = [
        { icon: Gift, label: 'Active Vouchers', value: String(activeCount), color: 'indigo' },
        { icon: Users, label: 'Total Available', value: String(totalAvailable), color: 'green' },
        { icon: TrendingUp, label: 'Pools Active', value: String(activeCount), color: 'violet' },
        { icon: CheckCircle2, label: 'Your Points', value: String(balance?.points ?? '—'), color: 'orange' },
    ];

    return (
        <Box p="md"><Text fw={700} size="xl" mb="md">Rewards & Vouchers</Text>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="xl">
                {stats.map((s, i) => (
                    <Card key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}>
                        <ThemeIcon size={36} radius="md" color={s.color} variant="light" mx="auto"><s.icon size={18} /></ThemeIcon>
                        {loading ? <Skeleton height={28} mt="sm" mx="auto" width={60} radius="sm" /> : <Text fw={700} size="xl" mt="sm">{s.value}</Text>}
                        <Text size="xs" c="dimmed">{s.label}</Text>
                    </Card>
                ))}
            </SimpleGrid>
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                <Text fw={700} mb="md">Active Vouchers</Text>
                {loading ? (
                    <Stack gap="sm">{[...Array(3)].map((_, i) => <Skeleton key={i} height={40} radius="md" />)}</Stack>
                ) : error ? (
                    <Text c="red" size="sm" ta="center">{error}</Text>
                ) : pools.length === 0 ? (
                    <Text c="dimmed" ta="center">No active voucher pools.</Text>
                ) : (
                    <Table>
                        <thead><tr><th>Code</th><th>Value</th><th>POI</th><th>Available</th><th>Expires</th></tr></thead>
                        <tbody>
                            {pools.map((v: any) => (
                                <tr key={v.id}>
                                    <td><Text fw={500} ff="monospace">{v.title}</Text></td>
                                    <td>{v.points_required} pts</td>
                                    <td>{v.sponsor_name || '—'}</td>
                                    <td>{v.available}</td>
                                    <td><Badge color={new Date(v.valid_until) > new Date() ? 'green' : 'red'}>{new Date(v.valid_until).toLocaleDateString()}</Badge></td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </Card>
        </Box>
    );
};
