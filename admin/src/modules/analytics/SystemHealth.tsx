import React, { useState, useEffect } from 'react';
import { Card, Text, Title, SimpleGrid, ThemeIcon, Badge, Skeleton, Alert } from '@mantine/core';
import { Server, Database, Wifi, HardDrive, Activity, AlertCircle } from 'lucide-react';
import { apiClient } from '../../api/client';

interface SubStatus {
    status: string;
    uptime_seconds?: number;
    latency_ms?: number;
    mode?: string;
    workers?: number;
    usage_pct?: number;
    error?: string;
}

interface HealthData {
    status: string;
    backend: SubStatus;
    postgresql: SubStatus;
    redis: SubStatus;
    celery: SubStatus;
    storage: SubStatus;
}

const statusColor = (s: string): string => {
    if (s === 'ok') return 'green';
    if (s === 'warning') return 'yellow';
    return 'red';
};

const formatUptime = (seconds: number): string => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    if (d > 0) return `${d}d ${h}h`;
    return `${h}h ${Math.floor((seconds % 3600) / 60)}m`;
};

export const SystemHealth: React.FC = () => {
    const [health, setHealth] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiClient.get('/infra/health/')
            .then(r => setHealth(r.data))
            .catch(() => setError('Failed to load system health data.'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div style={{ padding: 24 }}>
                <Skeleton height={36} width={200} mb="lg" />
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 5 }} spacing="md">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} height={180} radius="md" />)}
                </SimpleGrid>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: 24 }}>
                <Title order={2} mb="lg">System Health</Title>
                <Alert color="red" icon={<AlertCircle size={18} />} title="Error">{error}</Alert>
            </div>
        );
    }

    if (!health) {
        return (
            <div style={{ padding: 24 }}>
                <Title order={2} mb="lg">System Health</Title>
                <Text c="dimmed" ta="center">No health data available.</Text>
            </div>
        );
    }

    const items = [
        {
            icon: Server,
            label: 'Backend',
            status: health.backend.status,
            color: statusColor(health.backend.status),
            detail: health.backend.uptime_seconds != null ? formatUptime(health.backend.uptime_seconds) : '',
        },
        {
            icon: Database,
            label: 'PostgreSQL',
            status: health.postgresql.status,
            color: statusColor(health.postgresql.status),
            detail: health.postgresql.status === 'ok'
                ? `Latency: ${health.postgresql.latency_ms ?? '?'}ms`
                : health.postgresql.error || '',
        },
        {
            icon: Wifi,
            label: 'Redis',
            status: health.redis.status,
            color: statusColor(health.redis.status),
            detail: health.redis.status === 'ok'
                ? `${health.redis.mode || ''} · ${health.redis.latency_ms ?? '?'}ms`
                : health.redis.error || '',
        },
        {
            icon: Activity,
            label: 'Celery',
            status: health.celery.status,
            color: statusColor(health.celery.status),
            detail: health.celery.status === 'ok'
                ? `${health.celery.workers ?? 0} worker${health.celery.workers !== 1 ? 's' : ''}`
                : health.celery.error || '',
        },
        {
            icon: HardDrive,
            label: 'Storage',
            status: health.storage.status,
            color: statusColor(health.storage.status),
            detail: health.storage.usage_pct != null ? `Usage: ${health.storage.usage_pct}%` : '',
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <Title order={2} mb="lg">System Health</Title>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 5 }} spacing="md">
                {items.map((item, i) => (
                    <Card key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, textAlign: 'center' }}>
                        <ThemeIcon size={48} radius="md" color={item.color} variant="light" mx="auto" mb="md"><item.icon size={24} /></ThemeIcon>
                        <Text fw={700} size="lg">{item.label}</Text>
                        <Badge color={item.color} variant="filled" mt="xs">{item.status}</Badge>
                        {item.detail && <Text size="xs" c="dimmed" mt={4}>{item.detail}</Text>}
                    </Card>
                ))}
            </SimpleGrid>
        </div>
    );
};
