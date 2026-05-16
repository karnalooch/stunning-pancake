import React, { useState, useEffect } from 'react';
import { Box, Card, Text, SimpleGrid, ThemeIcon, Skeleton, Alert } from '@mantine/core';
import { TrendingUp, TrendingDown, Gauge, Activity, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { apiClient } from '../../api/client';

interface WeeklyLoad {
    week_start: string;
    km: number;
}

interface TrendResult {
    slope_km_per_week: number;
    intercept: number;
    trend: string;
    r_squared: number;
    weeks_analysed: number;
}

interface ACWRResult {
    acwr: number;
    acute_km: number;
    chronic_km: number;
    status: string;
    recommendation: string;
}

interface AnalyticsData {
    trend: TrendResult | null;
    training_load: ACWRResult | null;
    weekly_loads: WeeklyLoad[];
}

const statusColor = (status: string): string => {
    switch (status) {
        case 'OPTIMAL': return 'green';
        case 'ELEVATED': return 'yellow';
        case 'OVERTRAINING_RISK':
        case 'UNDERTRAINED': return 'orange';
        default: return 'gray';
    }
};

export const TrendAnalysis: React.FC = () => {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiClient.get('/activities/analytics/')
            .then(r => setData(r.data))
            .catch(() => setError('Failed to load trend data.'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <Box p="md">
                <Skeleton height={32} width={200} mb="md" />
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
                <Text fw={700} size="xl" mb="md">Trend Analysis</Text>
                <Alert color="red" icon={<AlertCircle size={18} />} title="Error">{error}</Alert>
            </Box>
        );
    }

    if (!data) {
        return (
            <Box p="md">
                <Text fw={700} size="xl" mb="md">Trend Analysis</Text>
                <Text c="dimmed" ta="center">No analytics data available.</Text>
            </Box>
        );
    }

    const trend = data.trend;
    const acwr = data.training_load;
    const weeklyLoads = data.weekly_loads || [];

    // Format weekly loads for chart
    const chartData = weeklyLoads.map((w, i) => ({
        w: `W${i + 1}`,
        km: w.km,
    }));

    // Compute avg km/week
    const avgKm = weeklyLoads.length > 0
        ? weeklyLoads.reduce((sum, w) => sum + w.km, 0) / weeklyLoads.length
        : 0;

    return (
        <Box p="md">
            <Text fw={700} size="xl" mb="md">Trend Analysis</Text>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="xl">
                <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}>
                    <ThemeIcon size={36} radius="md" color="green" variant="light" mx="auto"><TrendingUp size={18} /></ThemeIcon>
                    <Text fw={700} size="xl" mt="sm">
                        {trend ? `${trend.slope_km_per_week >= 0 ? '+' : ''}${trend.slope_km_per_week} km/wk` : '—'}
                    </Text>
                    <Text size="xs" c="dimmed">Weekly Trend</Text>
                </Card>
                <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}>
                    <ThemeIcon size={36} radius="md" color="violet" variant="light" mx="auto"><Gauge size={18} /></ThemeIcon>
                    <Text fw={700} size="xl" mt="sm">{acwr ? acwr.acwr.toFixed(2) : '—'}</Text>
                    <Text size="xs" c="dimmed">ACWR Ratio</Text>
                </Card>
                <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}>
                    <ThemeIcon size={36} radius="md" color="indigo" variant="light" mx="auto"><Activity size={18} /></ThemeIcon>
                    <Text fw={700} size="xl" mt="sm">{avgKm.toFixed(1)}</Text>
                    <Text size="xs" c="dimmed">Avg km/week</Text>
                </Card>
                <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}>
                    <ThemeIcon size={36} radius="md" color={acwr ? statusColor(acwr.status) : 'gray'} variant="light" mx="auto"><TrendingDown size={18} /></ThemeIcon>
                    <Text fw={700} size="xl" mt="sm">{acwr ? acwr.status.replace('_', ' ') : 'No Data'}</Text>
                    <Text size="xs" c="dimmed">Training Load</Text>
                </Card>
            </SimpleGrid>
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                <Text fw={700} mb="md">Weekly Training Volume</Text>
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData}>
                            <XAxis dataKey="w" />
                            <YAxis />
                            <Line type="monotone" dataKey="km" stroke="var(--chart-1)" strokeWidth={3} dot={{ fill: 'var(--chart-1)', r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <Text c="dimmed" ta="center" py="xl">No weekly data available.</Text>
                )}
            </Card>
        </Box>
    );
};
