import React, { useState, useEffect } from 'react';
import { Box, Card, Text, SimpleGrid, ThemeIcon, Skeleton, Alert } from '@mantine/core';
import { SponsorEmptyCta } from '../../core/components/SponsorEmptyCta';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Gift, TrendingUp, Users, Award, AlertCircle } from 'lucide-react';
import { apiClient } from '../../api/client';

interface SponsorStats {
    poi_count: number;
    vouchers_distributed: number;
    redeemed_count: number;
    redemption_rate: number;
    active_vouchers: number;
    expired_vouchers: number;
}

export const SponsorshipAnalytics: React.FC = () => {
    const [stats, setStats] = useState<SponsorStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiClient.get('/rewards/sponsor-stats/')
            .then(r => setStats(r.data))
            .catch(() => setError('Failed to load sponsorship data.'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <Box p="md">
                <Skeleton height={32} width={250} mb="md" />
                <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="xl">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} height={120} radius="md" />)}
                </SimpleGrid>
                <Skeleton height={350} radius="md" />
            </Box>
        );
    }

    if (error) {
        return (
            <Box p="md">
                <Text fw={700} size="xl" mb="md">Sponsorship Analytics</Text>
                <Alert color="red" icon={<AlertCircle size={18} />} title="Error">{error}</Alert>
            </Box>
        );
    }

    if (!stats) {
        return (
            <Box p="md">
                <Text fw={700} size="xl" mb="md">Sponsorship Analytics</Text>
                <Text c="dimmed" ta="center">No sponsorship data available.</Text>
            </Box>
        );
    }

    const isEmpty =
        stats.active_vouchers === 0
        && stats.vouchers_distributed === 0
        && stats.redeemed_count === 0
        && stats.poi_count === 0;

    if (isEmpty) {
        return (
            <Box p="md">
                <Text fw={700} size="xl" mb="md">Sponsorship Analytics</Text>
                <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                    <SponsorEmptyCta
                        title="No sponsorship data yet"
                        description="Analytics will appear after you create voucher pools and athletes start redeeming. Set up your first offer to track ROI."
                    />
                </Card>
            </Box>
        );
    }

    const statCards = [
        { icon: Gift, label: 'Active Vouchers', value: String(stats.active_vouchers), color: 'indigo' },
        { icon: TrendingUp, label: 'Redemption Rate', value: `${(stats.redemption_rate * 100).toFixed(0)}%`, color: 'green' },
        { icon: Users, label: 'Total Distributed', value: String(stats.vouchers_distributed), color: 'violet' },
        { icon: Award, label: 'Redeemed', value: String(stats.redeemed_count), color: 'orange' },
    ];

    const chartData = [
        { name: 'Active', vouchers: stats.active_vouchers },
        { name: 'Redeemed', redeemed: stats.redeemed_count },
        { name: 'Expired', expired: stats.expired_vouchers },
    ];

    return (
        <Box p="md">
            <Text fw={700} size="xl" mb="md">Sponsorship Analytics</Text>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="xl">
                {statCards.map((s, i) => (
                    <Card key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}>
                        <ThemeIcon size={36} radius="md" color={s.color} variant="light" mx="auto"><s.icon size={18} /></ThemeIcon>
                        <Text fw={700} size="xl" mt="sm">{s.value}</Text>
                        <Text size="xs" c="dimmed">{s.label}</Text>
                    </Card>
                ))}
            </SimpleGrid>
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                <Text fw={700} mb="md">Summary</Text>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Bar dataKey="vouchers" fill="var(--chart-1)" name="Active" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="redeemed" fill="var(--chart-3)" name="Redeemed" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expired" fill="var(--chart-4)" name="Expired" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </Card>
        </Box>
    );
};
