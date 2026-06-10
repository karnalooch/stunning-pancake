import React, { useState, useEffect } from 'react';
import { Box, Card, Text, SimpleGrid, ThemeIcon, Skeleton, Alert } from '@mantine/core';
import { SponsorEmptyCta } from '../../core/components/SponsorEmptyCta';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Gift, TrendingUp, Users, Award, AlertCircle } from 'lucide-react';
import { API_PATHS } from '@4velo/api-client';
import { apiClient } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';

interface SponsorStats {
    poi_count: number;
    vouchers_distributed: number;
    redeemed_count: number;
    redemption_rate: number;
    active_vouchers: number;
    expired_vouchers: number;
}

export const SponsorshipAnalytics: React.FC = () => {
    const { t } = useI18n();
    const [stats, setStats] = useState<SponsorStats | null>(null);
    const [series, setSeries] = useState<{ day: string; count: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([
            apiClient.get(API_PATHS.sponsorStats),
            apiClient.get(API_PATHS.sponsorStatsTimeseries).catch(() => ({ data: { series: [] } })),
        ])
            .then(([statsRes, tsRes]) => {
                setStats(statsRes.data);
                setSeries(tsRes.data?.series ?? []);
            })
            .catch(() => setError(t.sponsor.loadFailed))
            .finally(() => setLoading(false));
    }, [t.sponsor.loadFailed]);

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
                <Text fw={700} size="xl" mb="md">{t.sponsor.analyticsTitle}</Text>
                <Alert color="red" icon={<AlertCircle size={18} />} title={t.common.error}>{error}</Alert>
            </Box>
        );
    }

    if (!stats) {
        return (
            <Box p="md">
                <Text fw={700} size="xl" mb="md">{t.sponsor.analyticsTitle}</Text>
                <Text c="dimmed" ta="center">{t.sponsor.noData}</Text>
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
                <Text fw={700} size="xl" mb="md">{t.sponsor.analyticsTitle}</Text>
                <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                    <SponsorEmptyCta
                        title={t.sponsor.noDataYet}
                        description={t.sponsor.noDataDesc}
                    />
                </Card>
            </Box>
        );
    }

    const statCards = [
        { icon: Gift, label: t.sponsor.activeVouchers, value: String(stats.active_vouchers), color: 'indigo' },
        { icon: TrendingUp, label: t.sponsor.redemptionRate, value: `${(stats.redemption_rate * 100).toFixed(0)}%`, color: 'green' },
        { icon: Users, label: t.sponsor.totalDistributed, value: String(stats.vouchers_distributed), color: 'violet' },
        { icon: Award, label: t.sponsor.redeemed, value: String(stats.redeemed_count), color: 'orange' },
    ];

    const chartData = [
        { name: t.sponsor.active, vouchers: stats.active_vouchers },
        { name: t.sponsor.redeemed, redeemed: stats.redeemed_count },
        { name: t.sponsor.expired, expired: stats.expired_vouchers },
    ];

    return (
        <Box p="md">
            <Text fw={700} size="xl" mb="md">{t.sponsor.analyticsTitle}</Text>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="xl">
                {statCards.map((s, i) => (
                    <Card key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}>
                        <ThemeIcon size={36} radius="md" color={s.color} variant="light" mx="auto"><s.icon size={18} /></ThemeIcon>
                        <Text fw={700} size="xl" mt="sm">{s.value}</Text>
                        <Text size="xs" c="dimmed">{s.label}</Text>
                    </Card>
                ))}
            </SimpleGrid>
            <Card mb="xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                <Text fw={700} mb="md">{t.sponsor.summary}</Text>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Bar dataKey="vouchers" fill="var(--chart-1)" name={t.sponsor.active} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="redeemed" fill="var(--chart-3)" name={t.sponsor.redeemed} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expired" fill="var(--chart-4)" name={t.sponsor.expired} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </Card>
            {series.length > 0 && (
                <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                    <Text fw={700} mb="md">{t.sponsor.redemptionsOverTime}</Text>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={series}>
                            <XAxis dataKey="day" />
                            <YAxis allowDecimals={false} />
                            <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            )}
        </Box>
    );
};
