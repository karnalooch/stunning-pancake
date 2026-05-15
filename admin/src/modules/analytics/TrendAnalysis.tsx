import React from 'react';
import { Box, Card, Text, SimpleGrid, ThemeIcon } from '@mantine/core';
import { TrendingUp, TrendingDown, Gauge, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';

const data = [{ w: 'W1', km: 12 }, { w: 'W2', km: 15 }, { w: 'W3', km: 18 }, { w: 'W4', km: 14 }, { w: 'W5', km: 20 }, { w: 'W6', km: 22 }, { w: 'W7', km: 25 }, { w: 'W8', km: 28 }];

export const TrendAnalysis: React.FC = () => (
    <Box p="md">
        <Text fw={700} size="xl" mb="md">Trend Analysis</Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="xl">
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}><ThemeIcon size={36} radius="md" color="green" variant="light" mx="auto"><TrendingUp size={18} /></ThemeIcon><Text fw={700} size="xl" mt="sm">+12.5%</Text><Text size="xs" c="dimmed">Weekly Growth</Text></Card>
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}><ThemeIcon size={36} radius="md" color="violet" variant="light" mx="auto"><Gauge size={18} /></ThemeIcon><Text fw={700} size="xl" mt="sm">1.15</Text><Text size="xs" c="dimmed">ACWR Ratio</Text></Card>
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}><ThemeIcon size={36} radius="md" color="indigo" variant="light" mx="auto"><Activity size={18} /></ThemeIcon><Text fw={700} size="xl" mt="sm">28.3</Text><Text size="xs" c="dimmed">Avg km/week</Text></Card>
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}><ThemeIcon size={36} radius="md" color="orange" variant="light" mx="auto"><TrendingDown size={18} /></ThemeIcon><Text fw={700} size="xl" mt="sm">-2.1%</Text><Text size="xs" c="dimmed">Injury Risk</Text></Card>
        </SimpleGrid>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
            <Text fw={700} mb="md">Weekly Training Volume</Text>
            <ResponsiveContainer width="100%" height={300}><LineChart data={data}><XAxis dataKey="w" /><YAxis /><Line type="monotone" dataKey="km" stroke="var(--chart-1)" strokeWidth={3} dot={{ fill: 'var(--chart-1)', r: 4 }} /></LineChart></ResponsiveContainer>
        </Card>
    </Box>
);
