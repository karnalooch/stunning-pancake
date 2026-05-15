import React from 'react';
import { Card, Text, Title, SimpleGrid, ThemeIcon, Badge } from '@mantine/core';
import { Server, Database, Wifi, HardDrive, Activity } from 'lucide-react';

export const SystemHealth: React.FC = () => {
    const items = [
        { icon: Server, label: 'Backend', status: 'Healthy', color: 'green', uptime: '14d 3h' },
        { icon: Database, label: 'PostgreSQL', status: 'Healthy', color: 'green', uptime: '14d 3h' },
        { icon: Wifi, label: 'Redis', status: 'Healthy', color: 'green', uptime: '14d 2h' },
        { icon: Activity, label: 'Celery', status: 'Healthy', color: 'green', uptime: '14d 1h' },
        { icon: HardDrive, label: 'Storage', status: 'Healthy', color: 'green', usage: '42%' },
    ];
    return (
        <div style={{ padding: 24 }}><Title order={2} mb="lg">System Health</Title>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 5 }} spacing="md">
                {items.map((item, i) => (
                    <Card key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, textAlign: 'center' }}>
                        <ThemeIcon size={48} radius="md" color={item.color} variant="light" mx="auto" mb="md"><item.icon size={24} /></ThemeIcon>
                        <Text fw={700} size="lg">{item.label}</Text>
                        <Badge color={item.color} variant="filled" mt="xs">{item.status}</Badge>
                        <Text size="xs" c="dimmed" mt={4}>{item.uptime || `Usage: ${item.usage}`}</Text>
                    </Card>
                ))}
            </SimpleGrid>
        </div>
    );
};
