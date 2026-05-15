import React from 'react';
import { Box, Card, Text, Title, Button, Group, SimpleGrid, ThemeIcon } from '@mantine/core';
import { FileSpreadsheet, FileJson, FileText, Download } from 'lucide-react';
import { PageHeader } from '../../core/components/PageHeader';

export const ExportCenter: React.FC = () => {
    const items = [
        { icon: FileSpreadsheet, label: 'Activities CSV', desc: 'Export all activities as CSV', color: 'green' },
        { icon: FileJson, label: 'Users JSON', desc: 'Export users as JSON', color: 'blue' },
        { icon: FileText, label: 'Statistics PDF', desc: 'Weekly statistics report', color: 'violet' },
    ];

    return (
        <Box p="md"><PageHeader title="Export Center" subtitle="Download data in multiple formats" />
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                {items.map((item, i) => (
                    <Card key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, textAlign: 'center' }}>
                        <ThemeIcon size={48} radius="md" color={item.color} variant="light" mx="auto" mb="md"><item.icon size={24} /></ThemeIcon>
                        <Text fw={700} size="lg" mb="xs">{item.label}</Text>
                        <Text size="xs" c="dimmed" mb="md">{item.desc}</Text>
                        <Button variant="light" leftSection={<Download size={16} />} fullWidth>Export</Button>
                    </Card>
                ))}
            </SimpleGrid>
        </Box>
    );
};
