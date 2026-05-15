import React, { useState, useEffect } from 'react';
import { Box, Title, Table, Button, Modal, TextInput, Select, Text, Badge, ActionIcon, Group, Stack, Tree, Paper } from '@mantine/core';
import { useAuth } from '../../core/auth/useAuth';
import { apiClient } from '../../api/client';
import { IconPlus, IconEdit, IconTrash, IconUsers } from '@tabler/icons-react';

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
    const [departments, setDepartments] = useState<Department[]>([]);
    const [tree, setTree] = useState<DepartmentTreeNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');

    const canManage = hasPermission('departments.create') || hasPermission('departments.edit');
    const canDelete = hasPermission('departments.delete');

    useEffect(() => {
        fetchDepartments();
        fetchTree();
    }, []);

    const fetchDepartments = async () => {
        try {
            const { data } = await apiClient.get('/users/departments/');
            setDepartments(data);
        } catch (err) {
            console.error('Failed to fetch departments:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchTree = async () => {
        try {
            const { data } = await apiClient.get('/users/departments/tree/');
            setTree(data);
        } catch (err) {
            console.error('Failed to fetch department tree:', err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Czy na pewno chcesz usunąć ten dział?')) return;
        try {
            await apiClient.delete(`/users/departments/${id}/`);
            fetchDepartments();
            fetchTree();
        } catch (err) {
            console.error('Failed to delete department:', err);
        }
    };

    const typeLabels: Record<string, string> = {
        department: 'Dział',
        class: 'Klasa',
        faculty: 'Wydział',
        team: 'Zespół',
        district: 'Dzielnica',
        other: 'Inne',
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
            <Group justify="space-between" mb="md">
                <Title order={2}>Działy / Klasy</Title>
                <Group>
                    <Button.Group>
                        <Button
                            variant={viewMode === 'list' ? 'filled' : 'outline'}
                            onClick={() => setViewMode('list')}
                        >
                            Lista
                        </Button>
                        <Button
                            variant={viewMode === 'tree' ? 'filled' : 'outline'}
                            onClick={() => setViewMode('tree')}
                        >
                            Drzewo
                        </Button>
                    </Button.Group>
                    {canManage && (
                        <Button leftSection={<IconPlus size={16} />} onClick={() => { setEditingDept(null); setModalOpen(true); }}>
                            Nowy dział
                        </Button>
                    )}
                </Group>
            </Group>

            {viewMode === 'list' ? (
                <Paper withBorder>
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Nazwa</Table.Th>
                                <Table.Th>Typ</Table.Th>
                                <Table.Th>Członkowie</Table.Th>
                                <Table.Th>Moderator</Table.Th>
                                <Table.Th>Nadrzędny</Table.Th>
                                <Table.Th>Akcje</Table.Th>
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

            <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editingDept ? 'Edytuj dział' : 'Nowy dział'}>
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
    const [description, setDescription] = useState(department?.description || '');
    const [saving, setSaving] = useState(false);

    const typeOptions = [
        { value: 'department', label: 'Dział' },
        { value: 'class', label: 'Klasa' },
        { value: 'faculty', label: 'Wydział' },
        { value: 'team', label: 'Zespół' },
        { value: 'district', label: 'Dzielnica' },
        { value: 'other', label: 'Inne' },
    ];

    const parentOptions = [
        { value: '', label: 'Brak (główny)' },
        ...departments
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
                <TextInput label="Nazwa" value={name} onChange={(e) => setName(e.target.value)} required />
                <Select label="Typ" data={typeOptions} value={departmentType} onChange={(v) => setDepartmentType(v || 'department')} required />
                <Select label="Dział nadrzędny" data={parentOptions} value={parentId} onChange={(v) => setParentId(v != null ? String(v) : '')} />
                <TextInput label="Opis" value={description} onChange={(e) => setDescription(e.target.value)} />
                <Button type="submit" loading={saving}>{department ? 'Zapisz' : 'Utwórz'}</Button>
            </Stack>
        </form>
    );
};
