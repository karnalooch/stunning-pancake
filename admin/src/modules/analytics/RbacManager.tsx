import React from 'react';
import { Box, Text, Title, Card, SimpleGrid, ThemeIcon, Group, Badge } from '@mantine/core';
import { Shield, Users, Key, Lock } from 'lucide-react';
import { PageHeader } from '../../core/components/PageHeader';

export const RbacManager: React.FC = () => {
    const roles = [
        { slug: 'global_owner', name: 'Global Owner', perms: 27, color: 'red' },
        { slug: 'tenant_admin', name: 'Tenant Admin', perms: 19, color: 'blue' },
        { slug: 'tenant_moderator', name: 'Tenant Moderator', perms: 8, color: 'violet' },
        { slug: 'department_moderator', name: 'Department Moderator', perms: 9, color: 'cyan' },
        { slug: 'sponsor', name: 'Sponsor', perms: 8, color: 'orange' },
        { slug: 'athlete', name: 'Athlete', perms: 5, color: 'green' },
    ];

    return (
        <Box p="md"><PageHeader title="RBAC Manager" subtitle="Visual role & permission management" />
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                {roles.map(r => (
                    <Card key={r.slug} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                        <Group mb="md"><ThemeIcon size={42} radius="md" color={r.color} variant="light"><Shield size={20} /></ThemeIcon>
                            <Box><Text fw={700} size="lg">{r.name}</Text><Text size="xs" c="dimmed">{r.slug}</Text></Box>
                        </Group>
                        <Group gap="xs"><Badge color={r.color} variant="light">{r.perms} permissions</Badge><Badge variant="light" leftSection={<Key size={10} />}>Manage</Badge></Group>
                    </Card>
                ))}
            </SimpleGrid>
        </Box>
    );
};
