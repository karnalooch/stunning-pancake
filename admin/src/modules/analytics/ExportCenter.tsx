import React, { useState } from 'react';
import { Box, Card, Text, Button, SimpleGrid, ThemeIcon } from '@mantine/core';
import { FileSpreadsheet, FileJson, FileText, Download } from 'lucide-react';
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

export const ExportCenter: React.FC = () => {
    const [loading, setLoading] = useState<Record<string, boolean>>({});

    const items: ExportItem[] = [
        { icon: FileSpreadsheet, label: 'Activities CSV', desc: 'Export all activities as CSV', color: 'green', resource: 'activities', format: 'csv', ext: 'csv' },
        { icon: FileJson, label: 'Users JSON', desc: 'Export users as JSON', color: 'blue', resource: 'users', format: 'json', ext: 'json' },
        { icon: FileText, label: 'Statistics PDF', desc: 'Weekly statistics report', color: 'violet', resource: 'statistics', format: 'pdf', ext: 'pdf' },
    ];

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
            .catch(() => { })
            .finally(() => setLoading(prev => ({ ...prev, [label]: false })));
    };

    return (
        <Box p="md"><PageHeader title="Export Center" subtitle="Download data in multiple formats" />
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
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
            </SimpleGrid>
        </Box>
    );
};
