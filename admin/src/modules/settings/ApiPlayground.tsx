import React, { useMemo } from 'react';
import { Box, Text, Group, Badge, Card, Button, Code, Stack, ThemeIcon } from '@mantine/core';
import { ExternalLink, Server, Shield, Book, Key, Users, Activity, FileJson } from 'lucide-react';
import { resolveApiBaseUrl, resolveApiDocsUrl } from '../../api/apiBase';

const endpoints = [
    { method: 'GET', path: '/activities/admin/all/', desc: 'List all activities', icon: Activity },
    { method: 'GET', path: '/users/profile/', desc: 'Get current user profile', icon: Users },
    { method: 'POST', path: '/auth/token/', desc: 'Obtain JWT token', icon: Key },
    { method: 'POST', path: '/auth/token/refresh/', desc: 'Refresh JWT token', icon: Key },
    { method: 'GET', path: '/users/rbac/user-roles/my_roles/', desc: 'Get user RBAC roles', icon: Shield },
    { method: 'GET', path: '/schema/', desc: 'OpenAPI schema (JSON)', icon: FileJson },
    { method: 'GET', path: '/activities/heatmap/', desc: 'Activity heatmap GeoJSON', icon: Activity },
    { method: 'GET', path: '/activities/admin/stats/', desc: 'Dashboard statistics', icon: Activity },
];

const methodColors: Record<string, string> = {
    GET: 'blue',
    POST: 'green',
    PUT: 'orange',
    DELETE: 'red',
    PATCH: 'yellow',
};

export const ApiPlayground: React.FC = () => {
    const apiBase = useMemo(() => resolveApiBaseUrl(), []);
    const docsUrl = useMemo(() => resolveApiDocsUrl(), []);

    return (
        <Box p="md">
            <Text fw={700} size="xl" mb="md">API Playground</Text>

            <Card mb="md" withBorder>
                <Group justify="space-between" mb="xs">
                    <Group>
                        <Book size={18} />
                        <Text fw={600}>Interactive API Documentation</Text>
                    </Group>
                    <Button
                        component="a"
                        href={docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                        rightSection={<ExternalLink size={14} />}
                    >
                        Open Swagger UI
                    </Button>
                </Group>
                <Text size="sm" c="dimmed">
                    The interactive documentation is hosted at <Code>{docsUrl}</Code>. Open it in a new tab for full Swagger UI experience.
                </Text>
            </Card>

            <Card withBorder>
                <Group mb="xs">
                    <Server size={18} />
                    <Text fw={600}>Quick API Reference</Text>
                    <Badge variant="light" size="sm">Base: {apiBase}</Badge>
                </Group>
                <Text size="sm" c="dimmed" mb="sm">
                    All requests require <Code>{`Authorization: Bearer <token>`}</Code> header (except auth endpoints).
                </Text>
                <Stack gap="xs">
                    {endpoints.map((ep) => {
                        const Icon = ep.icon;
                        return (
                            <Group
                                key={ep.path}
                                gap="sm"
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: 8,
                                    background: 'var(--surface-tertiary)',
                                }}
                            >
                                <ThemeIcon size={28} radius="sm" variant="light" color="gray">
                                    <Icon size={14} />
                                </ThemeIcon>
                                <Badge color={methodColors[ep.method] || 'gray'} size="sm" fw={700} w={50}>
                                    {ep.method}
                                </Badge>
                                <Code fz="xs" style={{ flex: 1 }}>{ep.path}</Code>
                                <Text size="xs" c="dimmed" style={{ maxWidth: 200, textAlign: 'right' }}>{ep.desc}</Text>
                            </Group>
                        );
                    })}
                </Stack>
            </Card>
        </Box>
    );
};
