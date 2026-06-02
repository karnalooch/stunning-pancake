import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
    Box, Text, Card, SimpleGrid, ThemeIcon, Group, Badge, Skeleton, Stack, Paper, Drawer,
    ScrollArea, Divider, Checkbox, Button, Alert,
} from '@mantine/core';
import { Shield, Key, Lock, AlertCircle, FolderTree, Save } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '../../core/components/PageHeader';
import { apiClient } from '../../api/client';

interface RoleItem {
    id: number;
    slug: string;
    name: string;
    description: string;
    is_system: boolean;
    permissions: { id?: number; permission: { id: number; codename: string; name: string; resource: string; action: string } }[];
    created_at: string;
}

interface PermResource {
    codename: string;
    action: string;
    name: string;
}

interface PermissionRow {
    id: number;
    codename: string;
    name: string;
    resource: string;
    action: string;
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
    const [allPermissions, setAllPermissions] = useState<PermissionRow[]>([]);
    const [permissionsByResource, setPermissionsByResource] = useState<Record<string, PermResource[]>>({});
    const [drawerRole, setDrawerRole] = useState<RoleItem | null>(null);
    const [editPermissionIds, setEditPermissionIds] = useState<Set<number>>(new Set());
    const [drawerOpened, setDrawerOpened] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadRoles = useCallback(async () => {
        const rolesRes = await apiClient.get('/users/rbac/roles/');
        const rolesData = Array.isArray(rolesRes.data)
            ? rolesRes.data
            : (rolesRes.data?.results && Array.isArray(rolesRes.data.results) ? rolesRes.data.results : []);
        setRoles(rolesData);
        return rolesData as RoleItem[];
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [, permsRes, permsListRes] = await Promise.all([
                    loadRoles() as Promise<RoleItem[]>,
                    apiClient.get('/users/rbac/permissions/by_resource/'),
                    apiClient.get('/users/rbac/permissions/'),
                ]);
                setPermissionsByResource(permsRes.data || {});
                const permRows = Array.isArray(permsListRes.data)
                    ? permsListRes.data
                    : (permsListRes.data?.results ?? []);
                setAllPermissions(permRows);
            } catch {
                setError('Unable to load RBAC data. Please try again later.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [loadRoles]);

    const getRoleColor = (slug: string) => roleColorMap[slug] || 'gray';

    const openRoleDrawer = (role: RoleItem) => {
        const ids = new Set<number>();
        for (const rp of role.permissions || []) {
            const pid = rp.permission?.id;
            if (pid) ids.add(pid);
        }
        setEditPermissionIds(ids);
        setDrawerRole(role);
        setDrawerOpened(true);
    };

    const closeDrawer = () => {
        setDrawerOpened(false);
        setDrawerRole(null);
        setEditPermissionIds(new Set());
    };

    const togglePermission = (permId: number, checked: boolean) => {
        setEditPermissionIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(permId);
            else next.delete(permId);
            return next;
        });
    };

    const handleSaveRole = async () => {
        if (!drawerRole) return;
        setSaving(true);
        try {
            const { data } = await apiClient.patch(`/users/rbac/roles/${drawerRole.id}/`, {
                permission_ids: Array.from(editPermissionIds),
            });
            notifications.show({
                title: 'RBAC updated',
                message: `Saved ${editPermissionIds.size} permission(s) for "${drawerRole.name}".`,
                color: 'green',
            });
            const updated = data as RoleItem;
            setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setDrawerRole(updated);
            await loadRoles();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                || 'Failed to save role permissions.';
            notifications.show({ title: 'Save failed', message: String(msg), color: 'red' });
        } finally {
            setSaving(false);
        }
    };

    const permissionsByResourceForDrawer = useMemo(() => {
        const grouped: Record<string, PermissionRow[]> = {};
        for (const p of allPermissions) {
            grouped[p.resource] = grouped[p.resource] || [];
            grouped[p.resource].push(p);
        }
        return grouped;
    }, [allPermissions]);

    const permissionsByResourceReadOnly = useMemo(() => {
        if (!drawerRole?.permissions?.length) return {};
        const byResource: Record<string, PermResource[]> = {};
        for (const rp of drawerRole.permissions) {
            const p = rp?.permission;
            if (!p?.resource) continue;
            byResource[p.resource] = byResource[p.resource] || [];
            byResource[p.resource].push({
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
                                onClick={() => openRoleDrawer(r)}
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
                                    <Badge variant="light" leftSection={<Key size={10} />}>Edit</Badge>
                                </Group>
                            </Card>
                        );
                    })}
                </SimpleGrid>
            )}

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

            <Drawer
                opened={drawerOpened}
                onClose={closeDrawer}
                position="right"
                size="lg"
                title={<Text fw={700} size="lg">Edit role permissions</Text>}
            >
                {drawerRole ? (
                    <ScrollArea style={{ height: 'calc(100vh - 120px)' }}>
                        <Stack gap="md" p="md">
                            <Paper p="md" style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border)', borderRadius: 12 }}>
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
                                        {editPermissionIds.size} selected
                                    </Badge>
                                    {drawerRole.is_system && (
                                        <Badge variant="light" color="gray" leftSection={<Lock size={10} />}>System</Badge>
                                    )}
                                </Group>
                            </Paper>

                            {drawerRole.is_system && (
                                <Alert color="yellow" title="System role">
                                    Permission changes apply immediately and are audit-logged via the API.
                                </Alert>
                            )}

                            <Box>
                                <Text fw={700} size="sm" mb="sm">Permissions</Text>
                                {Object.keys(permissionsByResourceForDrawer).length === 0 ? (
                                    <Text size="sm" c="dimmed">No permissions in catalog.</Text>
                                ) : (
                                    <Stack gap="sm">
                                        {Object.entries(permissionsByResourceForDrawer).map(([resource, perms]) => {
                                            const color = resourceColorMap[resource] || 'gray';
                                            return (
                                                <Card key={resource} padding="md" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                                                    <Text fw={700} size="xs" tt="capitalize" mb="xs">{resource}</Text>
                                                    <Stack gap={6}>
                                                        {perms.map((p) => (
                                                            <Checkbox
                                                                key={p.id}
                                                                label={
                                                                    <Group gap={6}>
                                                                        <Text size="sm">{p.name}</Text>
                                                                        <Badge size="xs" variant="light" color={color}>{p.action}</Badge>
                                                                    </Group>
                                                                }
                                                                checked={editPermissionIds.has(p.id)}
                                                                onChange={(e) => togglePermission(p.id, e.currentTarget.checked)}
                                                            />
                                                        ))}
                                                    </Stack>
                                                </Card>
                                            );
                                        })}
                                    </Stack>
                                )}
                            </Box>

                            <Button
                                leftSection={<Save size={16} />}
                                loading={saving}
                                onClick={handleSaveRole}
                            >
                                Save permissions
                            </Button>

                            <Divider label="Current snapshot" labelPosition="center" />
                            <Box>
                                {Object.keys(permissionsByResourceReadOnly).length === 0 ? (
                                    <Text size="sm" c="dimmed">No permissions attached.</Text>
                                ) : (
                                    <Group gap={6} wrap="wrap">
                                        {Object.values(permissionsByResourceReadOnly).flat().map((p) => (
                                            <Badge key={p.codename} size="xs" variant="outline">{p.codename}</Badge>
                                        ))}
                                    </Group>
                                )}
                            </Box>
                        </Stack>
                    </ScrollArea>
                ) : (
                    <Text size="sm" c="dimmed">Select a role to edit permissions.</Text>
                )}
            </Drawer>
        </Box>
    );
};
