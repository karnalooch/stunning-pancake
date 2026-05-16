import React, { useState } from 'react';
import { Box, Text, Alert, Skeleton, Group, Badge, Card, SimpleGrid, Button, Code } from '@mantine/core';
import { AlertCircle, ExternalLink, Book, Server, Shield } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const DOCS_URL = API_BASE.startsWith('http') ? `${API_BASE}/docs/` : '/api/docs/';

export const ApiPlayground: React.FC = () => {
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [iframeError, setIframeError] = useState(false);

    const endpoints = [
        { method: 'GET', path: '/activities/admin/all/', desc: 'List all activities' },
        { method: 'GET', path: '/users/profile/', desc: 'Get current user profile' },
        { method: 'POST', path: '/auth/token/', desc: 'Obtain JWT token' },
        { method: 'POST', path: '/auth/token/refresh/', desc: 'Refresh JWT token' },
        { method: 'GET', path: '/users/rbac/user-roles/my_roles/', desc: 'Get user RBAC roles' },
        { method: 'GET', path: '/schema/', desc: 'OpenAPI schema (JSON)' },
    ];

    const methodColors: Record<string, string> = {
        GET: 'blue',
        POST: 'green',
        PUT: 'orange',
        DELETE: 'red',
        PATCH: 'yellow',
    };

    return (
        <Box p="md">
            <Text fw={700} size="xl" mb="md">API Playground</Text>

            {/* Embedded Swagger UI */}
            <Card mb="md" withBorder>
                <Group justify="space-between" mb="xs">
                    <Group>
                        <Book size={18} />
                        <Text fw={600}>Interactive API Documentation</Text>
                    </Group>
                    <Button
                        component="a"
                        href={DOCS_URL}
                        target="_blank"
                        variant="light"
                        size="xs"
                        rightSection={<ExternalLink size={14} />}
                    >
                        Open in new tab
                    </Button>
                </Group>
                <Box style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', height: 600, position: 'relative' }}>
                    {!iframeLoaded && !iframeError && (
                        <Box style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-secondary)' }}>
                            <Skeleton width={200} height={8} radius="xl" />
                        </Box>
                    )}
                    {iframeError ? (
                        <Box p="xl">
                            <Alert color="red" icon={<AlertCircle size={18} />} title="Unable to load documentation">
                                <Text size="sm" mb="xs">
                                    The interactive documentation could not be embedded. This may be due to CORS or X-Frame-Options restrictions.
                                </Text>
                                <Button
                                    component="a"
                                    href={DOCS_URL}
                                    target="_blank"
                                    variant="filled"
                                    size="xs"
                                    rightSection={<ExternalLink size={14} />}
                                >
                                    Open documentation in new tab
                                </Button>
                            </Alert>
                        </Box>
                    ) : (
                        <iframe
                            src={DOCS_URL}
                            style={{ width: '100%', height: '100%', border: 'none', display: iframeLoaded ? 'block' : 'none' }}
                            title="API Documentation"
                            onLoad={() => setIframeLoaded(true)}
                            onError={() => setIframeError(true)}
                        />
                    )}
                </Box>
            </Card>

            {/* Quick reference */}
            <Card withBorder>
                <Group mb="xs">
                    <Server size={18} />
                    <Text fw={600}>Quick API Reference</Text>
                    <Badge variant="light" size="sm">Base: {API_BASE}</Badge>
                </Group>
                <Text size="sm" c="dimmed" mb="sm">
                    All requests require <Code>Authorization: Bearer &lt;token&gt;</Code> header (except auth endpoints).
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    {endpoints.map((ep) => (
                        <Box
                            key={ep.path}
                            style={{
                                padding: '8px 12px',
                                borderRadius: 8,
                                background: 'var(--surface-tertiary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <Badge color={methodColors[ep.method] || 'gray'} size="sm" fw={700}>
                                {ep.method}
                            </Badge>
                            <Code fz="xs">{ep.path}</Code>
                        </Box>
                    ))}
                </SimpleGrid>
            </Card>
        </Box>
    );
};
