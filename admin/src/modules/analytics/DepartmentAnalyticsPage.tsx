import React from 'react';
import { Box, Card, Text, SimpleGrid, ThemeIcon } from '@mantine/core';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Users, Activity, Gauge, ShieldCheck } from 'lucide-react';

const data = [{ name: 'IT', users: 47, acts: 1247, km: 847 }, { name: 'HR', users: 32, acts: 892, km: 623 }, { name: 'Sales', users: 28, acts: 756, km: 512 }];

export const DepartmentAnalyticsPage: React.FC = () => (
    <Box p="md">
        <Text fw={700} size="xl" mb="md">Department Analytics</Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="xl">
            {data.map(d => (
                <Card key={d.name} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}>
                    <Text fw={700} size="lg">{d.name}</Text>
                    <SimpleGrid cols={2} mt="sm">
                        <Box><ThemeIcon size={24} radius="md" color="indigo" variant="light"><Users size={12} /></ThemeIcon><Text fw={700}>{d.users}</Text><Text size="xs" c="dimmed">Users</Text></Box>
                        <Box><ThemeIcon size={24} radius="md" color="green" variant="light"><Activity size={12} /></ThemeIcon><Text fw={700}>{d.acts}</Text><Text size="xs" c="dimmed">Activities</Text></Box>
                        <Box><ThemeIcon size={24} radius="md" color="violet" variant="light"><Gauge size={12} /></ThemeIcon><Text fw={700}>{d.km}km</Text><Text size="xs" c="dimmed">Distance</Text></Box>
                        <Box><ThemeIcon size={24} radius="md" color="orange" variant="light"><ShieldCheck size={12} /></ThemeIcon><Text fw={700}>94%</Text><Text size="xs" c="dimmed">Verified</Text></Box>
                    </SimpleGrid>
                </Card>
            ))}
        </SimpleGrid>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
            <Text fw={700} mb="md">Activities by Department</Text>
            <ResponsiveContainer width="100%" height={300}><BarChart data={data}><XAxis dataKey="name" /><YAxis /><Bar dataKey="acts" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </Card>
    </Box>
);
