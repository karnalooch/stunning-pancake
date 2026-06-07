import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Title, Table, Button, Modal, Select, Text, Group, Paper, Badge, Stack, Skeleton } from '@mantine/core';
import { apiClient } from '../../api/client';
import { useAuth } from '../../core/auth/useAuth';
import { IconUserPlus, IconUserMinus } from '@tabler/icons-react';

interface User {
    id: number;
    username: string;
    email: string;
    role: string;
}

interface Department {
    id: number;
    name: string;
    member_count: number;
}

export const DepartmentUsers: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { hasPermission } = useAuth();
    const [department, setDepartment] = useState<Department | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string>('');

    const canAssign = hasPermission('departments.assign_users');
    const canRemove = hasPermission('departments.remove_users');

    const fetchDepartment = async () => {
        try {
            const { data } = await apiClient.get(`/users/departments/${id}/`);
            setDepartment(data);
        } catch (err) {
            console.error('Failed to fetch department:', err);
        }
    };

    const fetchUsers = async () => {
        try {
            const { data } = await apiClient.get(`/users/departments/${id}/users/`);
            setUsers(data);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const { data } = await apiClient.get('/users/all/', { params: { page_size: 100 } });
            setAllUsers(Array.isArray(data) ? data : data?.results ?? []);
        } catch (err) {
            console.error('Failed to fetch all users:', err);
        }
    };

    useEffect(() => {
        if (id) {
            Promise.resolve().then(() => {
                fetchDepartment();
                fetchUsers();
                fetchAllUsers();
            });
        }
    }, [id]);

    const handleAssign = async () => {
        if (!selectedUserId) return;
        try {
            await apiClient.post(`/users/departments/${id}/assign/`, { user_id: parseInt(selectedUserId) });
            setAssignModalOpen(false);
            setSelectedUserId('');
            fetchUsers();
        } catch (err) {
            console.error('Failed to assign user:', err);
        }
    };

    const handleRemove = async (userId: number) => {
        if (!confirm('Are you sure you want to remove this user from the department?')) return;
        try {
            await apiClient.post(`/users/departments/${id}/remove/`, { user_id: userId });
            fetchUsers();
        } catch (err) {
            console.error('Failed to remove user:', err);
        }
    };

    const assignedUserIds = new Set(users.map((u) => u.id));
    const availableUsers = allUsers.filter((u) => !assignedUserIds.has(u.id));

    if (loading) {
        return (
            <Box>
                <Skeleton height={32} width={240} mb="md" radius="md" />
                <Stack gap="sm">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} height={44} radius="md" />)}
                </Stack>
            </Box>
        );
    }
    if (!department) return <Text>Department not found.</Text>;

    return (
        <Box p="md">
            <Group justify="space-between" mb="md">
                <Title order={2}>{department.name} — Users</Title>
                {canAssign && (
                    <Button leftSection={<IconUserPlus size={16} />} onClick={() => setAssignModalOpen(true)}>
                        Add User
                    </Button>
                )}
            </Group>

            <Paper withBorder>
                <Table>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>User</Table.Th>
                            <Table.Th>Email</Table.Th>
                            <Table.Th>Role</Table.Th>
                            {canRemove && <Table.Th>Actions</Table.Th>}
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {users.map((user) => (
                            <Table.Tr key={user.id}>
                                <Table.Td>{user.username}</Table.Td>
                                <Table.Td>{user.email}</Table.Td>
                                <Table.Td><Badge>{user.role}</Badge></Table.Td>
                                {canRemove && (
                                    <Table.Td>
                                        <Button variant="subtle" color="red" size="xs" leftSection={<IconUserMinus size={14} />} onClick={() => handleRemove(user.id)}>
                                            Remove
                                        </Button>
                                    </Table.Td>
                                )}
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </Paper>

            <Modal opened={assignModalOpen} onClose={() => setAssignModalOpen(false)} title="Add User to Department">
                <Stack>
                    <Select
                        label="User"
                        data={availableUsers.map((u) => ({ value: u.id.toString(), label: `${u.username} (${u.email})` }))}
                        value={selectedUserId}
                        onChange={(v) => setSelectedUserId(v != null ? String(v) : '')}
                        placeholder="Select user"
                    />
                    <Button onClick={handleAssign} disabled={!selectedUserId}>Add</Button>
                </Stack>
            </Modal>
        </Box>
    );
};
