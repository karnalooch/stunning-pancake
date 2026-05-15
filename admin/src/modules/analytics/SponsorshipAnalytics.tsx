import React from 'react';
import { Box, Card, Text, SimpleGrid, ThemeIcon } from '@mantine/core';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Gift, TrendingUp, Users, DollarSign } from 'lucide-react';

const data = [{ month: 'Jan', vouchers: 45, redemptions: 32 }, { month: 'Feb', vouchers: 52, redemptions: 41 }, { month: 'Mar', vouchers: 48, redemptions: 38 }, { month: 'Apr', vouchers: 61, redemptions: 55 }, { month: 'May', vouchers: 55, redemptions: 47 }, { month: 'Jun', vouchers: 67, redemptions: 58 }];

export const SponsorshipAnalytics: React.FC = () => (
    <Box p="md"><Text fw={700} size="xl" mb="md">Sponsorship Analytics</Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="xl">
            {[{ icon: Gift, label: 'Active Vouchers', value: '12', color: 'indigo' }, { icon: TrendingUp, label: 'Conversion Rate', value: '82%', color: 'green' }, { icon: Users, label: 'Total Reach', value: '2,847', color: 'violet' }, { icon: DollarSign, label: 'Estimated ROI', value: '3.2x', color: 'orange' }].map((s, i) =>
                <Card key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}><ThemeIcon size={36} radius="md" color={s.color} variant="light" mx="auto"><s.icon size={18} /></ThemeIcon><Text fw={700} size="xl" mt="sm">{s.value}</Text><Text size="xs" c="dimmed">{s.label}</Text></Card>
            )}</SimpleGrid>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}><Text fw={700} mb="md">Monthly Vouchers vs Redemptions</Text><ResponsiveContainer width="100%" height={300}><BarChart data={data}><XAxis dataKey="month" /><YAxis /><Bar dataKey="vouchers" fill="var(--chart-1)" name="Vouchers" radius={[4, 4, 0, 0]} /><Bar dataKey="redemptions" fill="var(--chart-3)" name="Redemptions" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></Card>
    </Box>
);
