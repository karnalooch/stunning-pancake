import React from 'react';
import { Box, Card, Text, Table, Badge, SimpleGrid, ThemeIcon } from '@mantine/core';
import { Gift, Users, TrendingUp, CheckCircle2 } from 'lucide-react';

const vouchers = [{ code: 'COFFEE-20', value: '20%', poi: 'Eco Coffee', used: 45, expires: '2026-08-01' }, { code: 'BIKE-50', value: '50 PLN', poi: 'Bike Service', used: 12, expires: '2026-07-15' }, { code: 'RUN-10', value: '10%', poi: 'Sport Shop', used: 78, expires: '2026-09-01' }];

export const RewardsVouchers: React.FC = () => (
    <Box p="md"><Text fw={700} size="xl" mb="md">Rewards & Vouchers</Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="xl">
            {[{ icon: Gift, label: 'Active Vouchers', value: '8', color: 'indigo' }, { icon: Users, label: 'Total Redeemed', value: '135', color: 'green' }, { icon: TrendingUp, label: 'Conversion Rate', value: '82%', color: 'violet' }, { icon: CheckCircle2, label: 'Available', value: '24', color: 'orange' }].map((s, i) =>
                <Card key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}><ThemeIcon size={36} radius="md" color={s.color} variant="light" mx="auto"><s.icon size={18} /></ThemeIcon><Text fw={700} size="xl" mt="sm">{s.value}</Text><Text size="xs" c="dimmed">{s.label}</Text></Card>
            )}</SimpleGrid>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}><Text fw={700} mb="md">Active Vouchers</Text>
            <Table><thead><tr><th>Code</th><th>Value</th><th>POI</th><th>Used</th><th>Expires</th></tr></thead><tbody>{vouchers.map(v => <tr key={v.code}><td><Text fw={500} ff="monospace">{v.code}</Text></td><td>{v.value}</td><td>{v.poi}</td><td>{v.used}</td><td><Badge color={new Date(v.expires) > new Date() ? 'green' : 'red'}>{v.expires}</Badge></td></tr>)}</tbody></Table>
        </Card>
    </Box>
);
