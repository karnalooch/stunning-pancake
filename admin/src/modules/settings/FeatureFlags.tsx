import React from 'react';
import { Card, Text, Switch, Group, Stack, Box } from '@mantine/core';
import { PageHeader } from '../../core/components/PageHeader';

const flags = [
    { key: 'departments_enabled', label: 'Departments', desc: 'Enable department hierarchy', default: true },
    { key: 'rbac_enabled', label: 'RBAC System', desc: 'Use new permission system', default: true },
    { key: 'map_enabled', label: 'User Map', desc: 'MapLibre live map', default: true },
    { key: 'ai_insights', label: 'AI Insights', desc: 'System Intelligence panel', default: true },
    { key: 'export_enabled', label: 'Export Center', desc: 'CSV/JSON/PDF exports', default: true },
];

export const FeatureFlags: React.FC = () => (
    <Box p="md"><PageHeader title="Feature Flags" subtitle="Toggle features without redeploy" />
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
            <Stack gap="md">{flags.map(f => (
                <Group key={f.key} justify="space-between" p="sm" style={{ borderRadius: 10, background: 'var(--surface-secondary)' }}>
                    <Box><Text fw={600} size="sm">{f.label}</Text><Text size="xs" c="dimmed">{f.desc}</Text></Box>
                    <Switch defaultChecked={f.default} onLabel="ON" offLabel="OFF" size="md" />
                </Group>
            ))}</Stack>
        </Card>
    </Box>
);
