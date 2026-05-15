import React from 'react';
import { Box, Text, Title, Card, Table } from '@mantine/core';
import { Trophy } from 'lucide-react';
import { PageHeader } from '../../core/components/PageHeader';

const data = [{ rank: 1, name: 'Jan Kowalski', km: 142.3, acts: 47 }, { rank: 2, name: 'Anna Nowak', km: 128.7, acts: 42 }, { rank: 3, name: 'Piotr Wiśniewski', km: 115.2, acts: 38 }, { rank: 4, name: 'Maria Zielińska', km: 98.5, acts: 31 }, { rank: 5, name: 'Tomasz Lewandowski', km: 87.1, acts: 29 }];

export const LeaderboardManager: React.FC = () => (
    <Box p="md"><PageHeader title="Leaderboard Manager" subtitle="Manage rankings and competitions" />
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
            <Text fw={700} size="lg" mb="md"><Trophy size={18} style={{ display: 'inline', marginRight: 8, color: 'var(--accent)' }} />Top Riders</Text>
            <Table><thead><tr><th>#</th><th>User</th><th>Distance</th><th>Activities</th></tr></thead><tbody>
                {data.map(r => <tr key={r.rank}><td>{r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank}</td><td><Text fw={500}>{r.name}</Text></td><td>{r.km}km</td><td>{r.acts}</td></tr>)}
            </tbody></Table>
        </Card>
    </Box>
);
