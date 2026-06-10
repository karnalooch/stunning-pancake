import React, { useState, useEffect } from 'react';
import { Box, Title, Table, Button, Modal, TextInput, Select, Text, Badge, ActionIcon, Group, Stack, Tree, Paper, Skeleton } from '@mantine/core';
import { useAuth } from '../../core/auth/useAuth';
import { apiClient } from '../../api/client';
import { IconPlus, IconEdit, IconTrash, IconUsers } from '@tabler/icons-react';
import { TenantScopeBanner } from '../../core/components/TenantScopeBanner';
import { useTenantScope } from '../../hooks/useTenantScope';

interface Department {
    id: number;
    name: string;
    tenant: number;
    tenant_name: string;
    parent: number | null;
    parent_name: string | null;
    moderator: number | null;
    moderator_name: string | null;
    department_type: string;
    description: string;
    is_active: boolean;
    member_count: number;
    created_at: string;
}

interface DepartmentTreeNode {
    id: number;
    name: string;
    department_type: string;
    member_count: number;
    children: DepartmentTreeNode[];
}

export const Departments: React.FC = () => {
    const { hasPermission } = useAuth();
    const [stats, setStats] = useState<{ scoped_tenant_id?: string; per_tenant?: Array<{ tenant_id: string; tenant_name: string }> } | null>(null);
    const tenantScope = useTenantScope(stats);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [tree, setTree] = useState<DepartmentTreeNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');

    const canManage = hasPermission('departments.create') || hasPermission('departments.edit');
    const canDelete = hasPermission('departments.delete');

    const fetchDepartments = async () => {
        try {
            const { data } = await apiClient.get('/users/departments/');
            const arr = Array.isArray(data) ? data : (data && Array.isArray(data.results) ? data.results : []);
            setDepartments(arr);
        } catch (err) {
            console.error('Failed to fetch departments:', err);
            setDepartments([]);
        }
    };

    const fetchTree = async () => {
        try {
            const { data } = await apiClient.get('/users/departments/tree/');
            const arr = Array.isArray(data) ? data : (data && Array.isArray(data.results) ? data.results : []);
            setTree(arr);
        } catch (err) {
            console.error('Failed to fetch department tree:', err);
            setTree([]);
        }
    };

    useEffect(() => {
        setLoading(true);
        Promise.all([
            fetchDepartments(),
            fetchTree(),
            apiClient.get('/activities/admin/stats/').then((r) => setStats(r.data)).catch(() => setStats(null)),
        ]).finally(() => setLoading(false));
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this department?')) return;
        try {
            await apiClient.delete(`/users/departments/${id}/`);
            fetchDepartments();
            fetchTree();
        } catch (err) {
            console.error('Failed to delete department:', err);
        }
    };

    const typeLabels: Record<string, string> = {
        department: 'Department',
        class: 'Class',
        faculty: 'Faculty',
        team: 'Team',
        district: 'District',
        other: 'Other',
    };

    const buildTreeData = (nodes: DepartmentTreeNode[]): any[] => {
        return nodes.map((node) => ({
            label: `${node.name} (${node.member_count})`,
            value: node.id.toString(),
            children: node.children ? buildTreeData(node.children) : [],
        }));
    };

    return (
        <Box p="md">
            {tenantScope.isTenantScoped && (
                <TenantScopeBanner
                    tenantId={tenantScope.tenantId}
                    tenantName={tenantScope.tenantName}
                    roleLabel={tenantScope.isTenantAdmin ? 'Tenant Admin' : 'Moderator'}
                />
            )}
            <Group justify="space-between" mb="md">
                <Title order={2}>Departments / Classes</Title>
                <Group>
                    <Button.Group>
                        <Button
                            variant={viewMode === 'list' ? 'filled' : 'outline'}
                            onClick={() => setViewMode('list')}
                        >
                            List
                        </Button>
                        <Button
                            variant={viewMode === 'tree' ? 'filled' : 'outline'}
                            onClick={() => setViewMode('tree')}
                        >
                            Tree
                        </Button>
                    </Button.Group>
                    {canManage && (
                        <Button leftSection={<IconPlus size={16} />} onClick={() => { setEditingDept(null); setModalOpen(true); }}>
                            New Department
                        </Button>
                    )}
                </Group>
            </Group>

            {loading ? (
                <Stack gap="sm">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} height={44} radius="md" />)}
                </Stack>
            ) : viewMode === 'list' ? (
                <Paper withBorder>
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Name</Table.Th>
                                <Table.Th>Type</Table.Th>
                                <Table.Th>Members</Table.Th>
                                <Table.Th>Moderator</Table.Th>
                                <Table.Th>Parent</Table.Th>
                                <Table.Th>Actions</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {departments.map((dept) => (
                                <Table.Tr key={dept.id}>
                                    <Table.Td>{dept.name}</Table.Td>
                                    <Table.Td>
                                        <Badge>{typeLabels[dept.department_type] || dept.department_type}</Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap={4}>
                                            <IconUsers size={16} />
                                            <Text size="sm">{dept.member_count}</Text>
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>{dept.moderator_name || '—'}</Table.Td>
                                    <Table.Td>{dept.parent_name || '—'}</Table.Td>
                                    <Table.Td>
                                        <Group gap={4}>
                                            {canManage && (
                                                <ActionIcon variant="subtle" onClick={() => { setEditingDept(dept); setModalOpen(true); }}>
                                                    <IconEdit size={16} />
                                                </ActionIcon>
                                            )}
                                            {canDelete && (
                                                <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(dept.id)}>
                                                    <IconTrash size={16} />
                                                </ActionIcon>
                                            )}
                                        </Group>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </Paper>
            ) : (
                <Paper withBorder p="md">
                    <Tree
                        data={buildTreeData(tree)}
                        expandOnClick
                    />
                </Paper>
            )}

            <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editingDept ? 'Edit Department' : 'New Department'}>
                <DepartmentForm
                    department={editingDept}
                    departments={departments}
                    onSuccess={() => { setModalOpen(false); fetchDepartments(); fetchTree(); }}
                />
            </Modal>
        </Box>
    );
};

interface DepartmentFormProps {
    department: Department | null;
    departments: Department[];
    onSuccess: () => void;
}

const DepartmentForm: React.FC<DepartmentFormProps> = ({ department, departments, onSuccess }) => {
    const [name, setName] = useState(department?.name || '');
    const [departmentType, setDepartmentType] = useState(department?.department_type || 'department');
    const [parentId, setParentId] = useState<string>(department?.parent?.toString() || '');
    const [moderatorId, setModeratorId] = useState<string>(department?.moderator?.toString() || '');
    const [description, setDescription] = useState(department?.description || '');
    const [moderatorOptions, setModeratorOptions] = useState<{ value: string; label: string }[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const modRoles = new Set(['TENANT_MODERATOR', 'DEPARTMENT_MODERATOR', 'tenant_moderator', 'department_moderator']);
        apiClient.get('/users/')
            .then(({ data }) => {
                const rows = Array.isArray(data) ? data : data?.results ?? [];
                const mods = rows
                    .filter((u: { id: number; username?: string; role?: string }) => modRoles.has(String(u.role || '')))
                    .map((u: { id: number; username?: string }) => ({
                        value: String(u.id),
                        label: u.username || `User #${u.id}`,
                    }));
                setModeratorOptions([{ value: '', label: 'None' }, ...mods]);
            })
            .catch(() => setModeratorOptions([{ value: '', label: 'None' }]));
    }, []);

    const typeOptions = [
        { value: 'department', label: 'Department' },
        { value: 'class', label: 'Class' },
        { value: 'faculty', label: 'Faculty' },
        { value: 'team', label: 'Team' },
        { value: 'district', label: 'District' },
        { value: 'other', label: 'Other' },
    ];

    const parentOptions = [
        { value: '', label: 'None (root)' },
        ...(Array.isArray(departments) ? departments : [])
            .filter((d) => d.id !== department?.id)
            .map((d) => ({ value: d.id.toString(), label: d.name })),
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                name,
                department_type: departmentType,
                parent: parentId ? parseInt(parentId) : null,
                moderator: moderatorId ? parseInt(moderatorId) : null,
                description,
            };

            if (department) {
                await apiClient.put(`/users/departments/${department.id}/`, payload);
            } else {
                await apiClient.post('/users/departments/', payload);
            }
            onSuccess();
        } catch (err) {
            console.error('Failed to save department:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <Stack>
                <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
                <Select label="Type" data={typeOptions} value={departmentType} onChange={(v) => setDepartmentType(v || 'department')} required />
                <Select label="Parent Department" data={parentOptions} value={parentId} onChange={(v) => setParentId(v != null ? String(v) : '')} />
                <Select label="Department Moderator" data={moderatorOptions} value={moderatorId} onChange={(v) => setModeratorId(v != null ? String(v) : '')} clearable searchable />
                <TextInput label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
                <Button type="submit" loading={saving}>{department ? 'Save' : 'Create'}</Button>
            </Stack>
        </form>
    );
};
