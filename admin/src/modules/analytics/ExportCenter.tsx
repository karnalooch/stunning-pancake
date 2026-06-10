import React, { useCallback, useEffect, useState } from 'react';
import { Box, Card, Text, Button, SimpleGrid, ThemeIcon, Badge, Stack } from '@mantine/core';
import { FileSpreadsheet, FileJson, FileText, Download, Archive } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '../../core/components/PageHeader';
import { apiClient } from '../../api/client';

interface ExportItem {
    icon: React.FC<{ size?: number }>;
    label: string;
    desc: string;
    color: string;
    resource: string;
    format: string;
    ext: string;
}

interface RodoJob {
    job_id: string;
    status: string;
    activity_count: number;
    expires_at: string;
    expired: boolean;
    download_url: string | null;
}

export const ExportCenter: React.FC = () => {
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [rodoJobs, setRodoJobs] = useState<RodoJob[]>([]);
    const [rodoLoading, setRodoLoading] = useState(false);

    const items: ExportItem[] = [
        { icon: FileSpreadsheet, label: 'Activities CSV', desc: 'Export all activities as CSV', color: 'green', resource: 'activities', format: 'csv', ext: 'csv' },
        { icon: FileJson, label: 'Users JSON', desc: 'Export users as JSON', color: 'blue', resource: 'users', format: 'json', ext: 'json' },
        { icon: FileText, label: 'Statistics PDF', desc: 'Weekly statistics report', color: 'violet', resource: 'statistics', format: 'pdf', ext: 'pdf' },
    ];

    const refreshRodoJobs = useCallback(() => {
        return apiClient.get<RodoJob[]>('/users/me/export/').then(res => {
            const rows = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
            setRodoJobs(rows);
            return rows as RodoJob[];
        });
    }, []);

    useEffect(() => {
        refreshRodoJobs().catch(() => {});
    }, [refreshRodoJobs]);

    const handleExport = (resource: string, format: string, label: string) => {
        setLoading(prev => ({ ...prev, [label]: true }));
        apiClient.get(`/activities/export/${resource}/`, { params: { format }, responseType: 'blob' })
            .then(response => {
                const blob = new Blob([response.data]);
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${resource}.${format}`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
            })
            .catch((err) => {
                const detail = err.response?.data;
                const message =
                    typeof detail === 'string'
                        ? detail
                        : detail?.detail || detail?.error || `Export failed (${label}).`;
                notifications.show({ title: 'Export failed', message, color: 'red' });
            })
            .finally(() => setLoading(prev => ({ ...prev, [label]: false })));
    };

    const handleRodoExport = async () => {
        setRodoLoading(true);
        try {
            await apiClient.post('/users/me/export/');
            notifications.show({
                title: 'RODO export queued',
                message: 'ZIP with profile + GPX activities — refresh when status is ready.',
                color: 'blue',
            });
            const rows = await refreshRodoJobs();
            const pending = rows.find(j => j.status === 'pending');
            if (pending) {
                let attempts = 0;
                const poll = setInterval(async () => {
                    attempts += 1;
                    const latest = await refreshRodoJobs();
                    const job = latest.find(j => j.job_id === pending.job_id);
                    if (job?.status === 'ready' || attempts > 30) {
                        clearInterval(poll);
                    }
                }, 2000);
            }
        } catch (err: any) {
            const detail = err.response?.data;
            notifications.show({
                title: 'RODO export failed',
                message: detail?.detail || detail?.error || 'Could not queue export.',
                color: 'red',
            });
        } finally {
            setRodoLoading(false);
        }
    };

    const downloadRodo = async (job: RodoJob) => {
        if (!job.download_url) return;
        try {
            const res = await apiClient.get(job.download_url, { responseType: 'blob' });
            const blob = new Blob([res.data], { type: 'application/zip' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `4velo-rodo-${job.job_id}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            notifications.show({ title: 'Download failed', message: 'Export expired or not ready.', color: 'red' });
        }
    };

    return (
        <Box p="md">
            <PageHeader title="Export Center" subtitle="Download data in multiple formats" />
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
                {items.map((item, i) => (
                    <Card key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, textAlign: 'center' }}>
                        <ThemeIcon size={48} radius="md" color={item.color} variant="light" mx="auto" mb="md"><item.icon size={24} /></ThemeIcon>
                        <Text fw={700} size="lg" mb="xs">{item.label}</Text>
                        <Text size="xs" c="dimmed" mb="md">{item.desc}</Text>
                        <Button
                            variant="light"
                            leftSection={<Download size={16} />}
                            fullWidth
                            loading={loading[item.label]}
                            onClick={() => handleExport(item.resource, item.format, item.label)}
                        >
                            Export
                        </Button>
                    </Card>
                ))}
                <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, textAlign: 'center' }}>
                    <ThemeIcon size={48} radius="md" color="orange" variant="light" mx="auto" mb="md"><Archive size={24} /></ThemeIcon>
                    <Text fw={700} size="lg" mb="xs">RODO data export</Text>
                    <Text size="xs" c="dimmed" mb="md">ZIP: profile.json + your activity GPX files (24h link)</Text>
                    <Button
                        variant="light"
                        color="orange"
                        leftSection={<Download size={16} />}
                        fullWidth
                        loading={rodoLoading}
                        onClick={handleRodoExport}
                    >
                        Request export
                    </Button>
                    {rodoJobs.length > 0 && (
                        <Stack gap="xs" mt="md" align="stretch">
                            {rodoJobs.slice(0, 3).map(job => (
                                <Box key={job.job_id}>
                                    <GroupInline job={job} onDownload={() => downloadRodo(job)} />
                                </Box>
                            ))}
                        </Stack>
                    )}
                </Card>
            </SimpleGrid>
        </Box>
    );
};

const GroupInline: React.FC<{ job: RodoJob; onDownload: () => void }> = ({ job, onDownload }) => (
    <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text size="xs" c="dimmed" truncate>
            {job.job_id.slice(0, 8)}…
            <Badge size="xs" ml={6} color={job.status === 'ready' ? 'green' : job.expired ? 'gray' : 'yellow'}>
                {job.expired ? 'expired' : job.status}
            </Badge>
        </Text>
        {job.download_url && !job.expired && (
            <Button size="compact-xs" variant="subtle" onClick={onDownload}>ZIP</Button>
        )}
    </Box>
);
