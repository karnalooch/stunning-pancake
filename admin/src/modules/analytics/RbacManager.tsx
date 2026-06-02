import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, Card, SimpleGrid, ThemeIcon, Group, Badge, Skeleton, Stack, Paper, Drawer, ScrollArea, Divider, Anchor } from '@mantine/core';
import { Shield, Key, Lock, AlertCircle, FolderTree } from 'lucide-react';
import { PageHeader } from '../../core/components/PageHeader';
import { apiClient } from '../../api/client';

interface RoleItem {
    id: number;
    slug: string;
    name: string;
    description: string;
    is_system: boolean;
    permissions: any[];
    created_at: string;
}

interface PermResource {
    codename: string;
    action: string;
    name: string;
}

const roleColorMap: Record<string, string> = {
    global_owner: 'red',
    tenant_admin: 'blue',
    tenant_moderator: 'violet',
    department_moderator: 'cyan',
    sponsor: 'orange',
    athlete: 'green',
};

const resourceColorMap: Record<string, string> = {
    activities: 'indigo',
    users: 'blue',
    tenants: 'violet',
    departments: 'grape',
    rewards: 'orange',
    analytics: 'cyan',
    sponsors: 'yellow',
    settings: 'gray',
};

export const RbacManager: React.FC = () => {
    const [roles, setRoles] = useState<RoleItem[]>([]);
    const [permissionsByResource, setPermissionsByResource] = useState<Record<string, PermResource[]>>({});
    const [drawerRole, setDrawerRole] = useState<RoleItem | null>(null);
    const [drawerOpened, setDrawerOpened] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [rolesRes, permsRes] = await Promise.all([
                    apiClient.get('/users/rbac/roles/'),
                    apiClient.get('/users/rbac/permissions/by_resource/'),
                ]);
                const rolesData = Array.isArray(rolesRes.data)
                    ? rolesRes.data
                    : (rolesRes.data?.results && Array.isArray(rolesRes.data.results) ? rolesRes.data.results : []);
                setRoles(rolesData);
                setPermissionsByResource(permsRes.data || {});
            } catch (err) {
                setError('Unable to load RBAC data. Please try again later.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const getRoleColor = (slug: string) => roleColorMap[slug] || 'gray';

    const permissionsByResourceForDrawer = useMemo(() => {
        if (!drawerRole?.permissions || drawerRole.permissions.length === 0) return {};
        const byResource: Record<string, PermResource[]> = {};
        for (const rp of drawerRole.permissions as any[]) {
            const p = rp?.permission;
            if (!p?.resource) continue;
            const resource = p.resource as string;
            byResource[resource] = byResource[resource] || [];
            byResource[resource].push({
                codename: p.codename,
                action: p.action,
                name: p.name,
            });
        }
        return byResource;
    }, [drawerRole]);

    return (
        <Box p="md">
            <PageHeader title="RBAC Manager" subtitle="Visual role & permission management" />

            {/* ── Roles Section ── */}
            <Text fw={700} size="lg" mb="md">Roles</Text>
            {loading ? (
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} height={120} radius="md" />
                    ))}
                </SimpleGrid>
            ) : error ? (
                <Paper p="md" style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border)', borderRadius: 12 }}>
                    <Group gap="sm"><AlertCircle size={20} style={{ color: 'var(--danger)' }} /><Text c="dimmed">{error}</Text></Group>
                </Paper>
            ) : roles.length === 0 ? (
                <Text c="dimmed" ta="center" py="md">No roles found.</Text>
            ) : (
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                    {roles.map(r => {
                        const color = getRoleColor(r.slug);
                        const permCount = r.permissions?.length ?? 0;
                        return (
                            <Card
                                key={r.id || r.slug}
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, cursor: 'pointer' }}
                                onClick={() => {
                                    setDrawerRole(r);
                                    setDrawerOpened(true);
                                }}
                            >
                                <Group mb="md">
                                    <ThemeIcon size={42} radius="md" color={color} variant="light">
                                        <Shield size={20} />
                                    </ThemeIcon>
                                    <Box>
                                        <Text fw={700} size="lg">{r.name}</Text>
                                        <Text size="xs" c="dimmed">{r.slug}</Text>
                                    </Box>
                                </Group>
                                <Group gap="xs">
                                    <Badge color={color} variant="light">{permCount} permission{permCount !== 1 ? 's' : ''}</Badge>
                                    {r.is_system && <Badge variant="light" color="gray" leftSection={<Lock size={10} />}>System</Badge>}
                                    <Badge variant="light" leftSection={<Key size={10} />}>Manage</Badge>
                                </Group>
                            </Card>
                        );
                    })}
                </SimpleGrid>
            )}

            {/* ── Permissions by Resource ── */}
            {!loading && !error && Object.keys(permissionsByResource).length > 0 && (
                <>
                    <Text fw={700} size="lg" mt="xl" mb="md">Permissions by Resource</Text>
                    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                        {Object.entries(permissionsByResource).map(([resource, perms]) => {
                            const color = resourceColorMap[resource] || 'gray';
                            return (
                                <Card key={resource} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                                    <Group mb="sm">
                                        <ThemeIcon size={36} radius="md" color={color} variant="light">
                                            <FolderTree size={18} />
                                        </ThemeIcon>
                                        <Box>
                                            <Text fw={700} size="sm" tt="capitalize">{resource}</Text>
                                            <Text size="xs" c="dimmed">{perms.length} permission{perms.length !== 1 ? 's' : ''}</Text>
                                        </Box>
                                    </Group>
                                    <Group gap={6} wrap="wrap">
                                        {perms.slice(0, 6).map(p => (
                                            <Badge key={p.codename} size="xs" variant="light" color={color}>{p.action}</Badge>
                                        ))}
                                        {perms.length > 6 && (
                                            <Badge size="xs" variant="outline" color="gray">+{perms.length - 6} more</Badge>
                                        )}
                                    </Group>
                                </Card>
                            );
                        })}
                    </SimpleGrid>
                </>
            )}

            {/* ── Role details drawer ── */}
            <Drawer
                opened={drawerOpened}
                onClose={() => {
                    setDrawerOpened(false);
                    setDrawerRole(null);
                }}
                position="right"
                size="lg"
                title={<Text fw={700} size="lg">Role details</Text>}
            >
                {drawerRole ? (
                    <ScrollArea style={{ height: 'calc(100vh - 120px)' }}>
                        <Stack gap="md" p="md">
                            <Paper
                                p="md"
                                style={{
                                    background: 'var(--surface-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 12,
                                }}
                            >
                                <Group gap="sm">
                                    <ThemeIcon size={42} radius="md" color={getRoleColor(drawerRole.slug)} variant="light">
                                        <Shield size={20} />
                                    </ThemeIcon>
                                    <Box>
                                        <Text fw={800} size="lg">{drawerRole.name}</Text>
                                        <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>{drawerRole.slug}</Text>
                                    </Box>
                                </Group>
                                <Divider my="sm" />
                                <Group gap="xs" wrap="wrap">
                                    <Badge color={getRoleColor(drawerRole.slug)} variant="light">
                                        {drawerRole.permissions?.length ?? 0} permissions
                                    </Badge>
                                    {drawerRole.is_system && (
                                        <Badge variant="light" color="gray" leftSection={<Lock size={10} />}>
                                            System
                                        </Badge>
                                    )}
                                    <Badge variant="light" leftSection={<Key size={10} />}>
                                        Manage
                                    </Badge>
                                </Group>
                            </Paper>

                            <Box>
                                <Text fw={700} size="sm" mb="sm">Effective permissions by resource</Text>
                                {Object.keys(permissionsByResourceForDrawer).length === 0 ? (
                                    <Text size="sm" c="dimmed">No permissions attached to this role.</Text>
                                ) : (
                                    <Stack gap="sm">
                                        {Object.entries(permissionsByResourceForDrawer).map(([resource, perms]) => {
                                            const color = resourceColorMap[resource] || 'gray';
                                            return (
                                                <Card
                                                    key={resource}
                                                    padding="md"
                                                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                                                >
                                                    <Group mb="sm" justify="space-between">
                                                        <Group gap="sm">
                                                            <ThemeIcon size={32} radius="md" color={color} variant="light">
                                                                <FolderTree size={14} />
                                                            </ThemeIcon>
                                                            <Box>
                                                                <Text fw={700} size="xs" tt="capitalize">{resource}</Text>
                                                                <Text size="2xs" c="dimmed">{perms.length} actions</Text>
                                                            </Box>
                                                        </Group>
                                                    </Group>
                                                    <Group gap={6} wrap="wrap">
                                                        {perms.slice(0, 16).map(p => (
                                                            <Badge key={p.codename} size="xs" variant="light" color={color}>
                                                                {p.action}
                                                            </Badge>
                                                        ))}
                                                        {perms.length > 16 && (
                                                            <Badge size="xs" variant="outline" color="gray">
                                                                +{perms.length - 16} more
                                                            </Badge>
                                                        )}
                                                    </Group>
                                                </Card>
                                            );
                                        })}
                                    </Stack>
                                )}
                            </Box>

                            <Box>
                                <Text fw={700} size="sm" mb="xs">Next step</Text>
                                <Text size="sm" c="dimmed" mb="xs">
                                    Drawer is read-only; editing is supported via the RBAC API.
                                </Text>
                                <Text size="sm">
                                    Edit endpoint:{" "}
                                    <Text component="span" style={{ fontFamily: 'monospace' }}>
                                        PATCH /api/users/rbac/roles/{drawerRole.id}/
                                    </Text>
                                </Text>
                                <Anchor href="/api/docs/" target="_blank" mt="xs">Open API docs</Anchor>
                            </Box>
                        </Stack>
                    </ScrollArea>
                ) : (
                    <Text size="sm" c="dimmed">Select a role to inspect permissions.</Text>
                )}
            </Drawer>
        </Box>
    );
};
