import React, { useState, useEffect } from 'react';
import { Box, Card, Text, SimpleGrid, ThemeIcon, Skeleton, Alert } from '@mantine/core';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Users, Activity, Gauge, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';

interface DepartmentData {
    department_id: number;
    department_name: string;
    users: number;
    activities: number;
    distance_km: number;
    verified_pct: number;
}

export const DepartmentAnalyticsPage: React.FC = () => {
    const [data, setData] = useState<DepartmentData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: res } = await apiClient.get('/activities/analytics/department/');
                setData(Array.isArray(res) ? res : []);
            } catch {
                setError('Unable to load department analytics. Please try again later.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const chartData = data.map(d => ({
        name: d.department_name,
        acts: d.activities,
    }));

    return (
        <Box p="md">
            <PageHeader title="Department Analytics" subtitle="Activity breakdown by department" />

            {error && (
                <Alert icon={<AlertCircle size={16} />} color="red" variant="light" mb="md">
                    {error}
                </Alert>
            )}

            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="xl">
                {loading
                    ? [...Array(4)].map((_, i) => (
                        <Card key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}>
                            <Skeleton height={28} radius="sm" mb="sm" mx="auto" width="50%" />
                            <SimpleGrid cols={2} mt="sm">
                                {[...Array(4)].map((_, j) => (
                                    <Box key={j}>
                                        <Skeleton height={24} circle mb={4} mx="auto" />
                                        <Skeleton height={18} radius="sm" mb={2} mx="auto" width="40%" />
                                        <Skeleton height={12} radius="sm" mx="auto" width="55%" />
                                    </Box>
                                ))}
                            </SimpleGrid>
                        </Card>
                    ))
                    : data.map(d => (
                        <Card key={d.department_id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}>
                            <Text fw={700} size="lg">{d.department_name}</Text>
                            <SimpleGrid cols={2} mt="sm">
                                <Box>
                                    <ThemeIcon size={24} radius="md" color="indigo" variant="light"><Users size={12} /></ThemeIcon>
                                    <Text fw={700}>{d.users}</Text>
                                    <Text size="xs" c="dimmed">Users</Text>
                                </Box>
                                <Box>
                                    <ThemeIcon size={24} radius="md" color="green" variant="light"><Activity size={12} /></ThemeIcon>
                                    <Text fw={700}>{d.activities}</Text>
                                    <Text size="xs" c="dimmed">Activities</Text>
                                </Box>
                                <Box>
                                    <ThemeIcon size={24} radius="md" color="violet" variant="light"><Gauge size={12} /></ThemeIcon>
                                    <Text fw={700}>{d.distance_km}km</Text>
                                    <Text size="xs" c="dimmed">Distance</Text>
                                </Box>
                                <Box>
                                    <ThemeIcon size={24} radius="md" color="orange" variant="light"><ShieldCheck size={12} /></ThemeIcon>
                                    <Text fw={700}>{d.verified_pct}%</Text>
                                    <Text size="xs" c="dimmed">Verified</Text>
                                </Box>
                            </SimpleGrid>
                        </Card>
                    ))
                }
            </SimpleGrid>

            {!loading && data.length === 0 && !error && (
                <Text c="dimmed" ta="center" py="xl">No department data available.</Text>
            )}

            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                <Text fw={700} mb="md">Activities by Department</Text>
                {loading ? (
                    <Skeleton height={300} radius="md" />
                ) : data.length === 0 ? (
                    <Text c="dimmed" ta="center" py="xl">No chart data available.</Text>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData}>
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Bar dataKey="acts" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </Card>
        </Box>
    );
};
