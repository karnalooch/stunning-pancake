import { Box, Table, Badge, Group, Text, Button, TextInput, Stack, ActionIcon, Drawer, SimpleGrid, Modal, ScrollArea, Tabs, Select, PasswordInput } from '@mantine/core';
import { useState, useEffect } from 'react';
import { Search, ShieldAlert, Activity, UserCog, MoreVertical, Eye, UserPlus, ClipboardList, Trash2, Send } from 'lucide-react';
import { useAuth } from '../../core/auth/useAuth';
import { AdminApi } from '../../api/client';
import { apiClient } from '../../api/client';
import { notifications } from '@mantine/notifications';

interface UserRow {
  id: number;
  displayId: string;
  name: string;
  email: string;
  tenant: string;
  status: string;
  flags: number;
  role: string;
}

interface TenantRow {
  id: number;
  name: string;
}

interface AuditLogEntry {
  id?: number;
  timestamp: string;
  action: string;
  impersonator_username?: string;
  impersonator?: string;
  target_user_username?: string;
  target_user?: string;
  tenant_id?: string;
  status_code: number;
  ip_address?: string;
}

export const Users = () => {
  const { user } = useAuth();
  const [usersList, setUsersList] = useState<UserRow[]>([]);
  const [tenantsList, setTenantsList] = useState<TenantRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [inviteModalOpened, setInviteModalOpened] = useState(false);
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [deleteConfirmOpened, setDeleteConfirmOpened] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateError, setImpersonateError] = useState<string | null>(null);
  const [impersonateResult, setImpersonateResult] = useState<{ access: string; impersonated_user: string; impersonated_role: string } | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [departments, setDepartments] = useState<{ id: number, name: string }[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');

  // Create user form state
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'ATHLETE',
    tenant_id: '',
  });

  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    role: 'TENANT_MODERATOR',
  });

  const fetchUsers = () => {
    AdminApi.getUsers()
      .then(data => {
        const mapped = data.map((u: { id: number; username: string; email?: string; tenant_name?: string; role: string }) => ({
          id: u.id,
          displayId: `U-${u.id}`,
          name: u.username,
          email: u.email || `${u.username}@sport-platform.com`,
          tenant: u.tenant_name || 'Global HQ',
          status: u.role === 'ATHLETE' ? 'Active' : 'Staff',
          flags: 0,
          role: u.role,
        }));
        setUsersList(mapped);
      })
      .catch(err => console.error("Failed to load users:", err));
  };

  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => {
    apiClient.get('/users/departments/').then(({ data }) => {
      const arr = Array.isArray(data) ? data : (data && Array.isArray(data.results) ? data.results : []);
      setDepartments(arr);
    }).catch(() => setDepartments([]));
  }, []);
  useEffect(() => {
    if (user?.role === 'GLOBAL_OWNER') {
      setAuditLogLoading(true);
      AdminApi.getAuditLogs(50)
        .then(data => setAuditLogs(data))
        .catch(err => console.error("Failed to load audit logs:", err))
        .finally(() => setAuditLogLoading(false));
      AdminApi.getTenants()
        .then(data => setTenantsList(data))
        .catch(() => { });
    }
  }, [user]);

  const isGlobalOwner = user?.role === 'GLOBAL_OWNER';
  const windowTitle = isGlobalOwner
    ? "User Audit Suite — Global Registry"
    : `Instance Management — ${user?.username}'s City`;

  const handleImpersonate = async (targetUserId: number) => {
    setImpersonating(true);
    setImpersonateError(null);
    setImpersonateResult(null);
    try {
      const result = await AdminApi.impersonateUser(targetUserId);
      setImpersonateResult(result);
      localStorage.setItem('impersonation_token', result.access);
      localStorage.setItem('impersonated_user', JSON.stringify({
        username: result.impersonated_user,
        role: result.impersonated_role,
      }));
    } catch (err: unknown) {
      setImpersonateError((err as any)?.response?.data?.error || (err as Error)?.message || 'Impersonation failed');
    } finally {
      setImpersonating(false);
    }
  };

  const handleCreateUser = async () => {
    if (!createForm.username || !createForm.email || !createForm.password) {
      notifications.show({ title: 'Missing fields', message: 'Username, email, and password are required.', color: 'red' });
      return;
    }
    setActionLoading(true);
    try {
      await AdminApi.createUser({
        username: createForm.username,
        email: createForm.email,
        password: createForm.password,
        role: createForm.role,
        tenant_id: createForm.tenant_id || undefined,
      });
      notifications.show({ title: 'User Created', message: `${createForm.username} added successfully.`, color: 'green' });
      setCreateModalOpened(false);
      setCreateForm({ username: '', email: '', password: '', role: 'ATHLETE', tenant_id: '' });
      fetchUsers();
    } catch (err: unknown) {
      notifications.show({ title: 'Error', message: (err as Error)?.message || 'Failed to create user.', color: 'red' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await AdminApi.deleteUser(deleteTarget.id);
      notifications.show({ title: 'User Deleted', message: `${deleteTarget.name} removed.`, color: 'orange' });
      setDeleteConfirmOpened(false);
      setDeleteTarget(null);
      setSelectedUser(null);
      fetchUsers();
    } catch (err: unknown) {
      notifications.show({ title: 'Error', message: (err as Error)?.message || 'Failed to delete user.', color: 'red' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendInvitation = async () => {
    if (!inviteForm.email) {
      notifications.show({ title: 'Missing email', message: 'Email address is required.', color: 'red' });
      return;
    }
    setActionLoading(true);
    setInviteResult(null);
    try {
      const result = await AdminApi.sendInvitation({
        email: inviteForm.email,
        name: inviteForm.name,
        role: inviteForm.role,
        tenant_id: user?.tenantId || undefined,
      });
      setInviteResult(result);
      notifications.show({ title: 'Invitation Sent', message: `Token for ${inviteForm.email} generated.`, color: 'cyan' });
    } catch (err: unknown) {
      notifications.show({ title: 'Error', message: (err as Error)?.message || 'Failed to send invitation.', color: 'red' });
    } finally {
      setActionLoading(false);
    }
  };

  const [activeTab, setActiveTab] = useState<string | null>('users');

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="users" leftSection={<UserCog size={16} />}>Users</Tabs.Tab>
          {isGlobalOwner && (
            <Tabs.Tab value="audit" leftSection={<ClipboardList size={16} />}>
              Audit Log {auditLogs.length > 0 && `(${auditLogs.length})`}
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="users" pt="md">
          <Stack gap="md">
            <Group justify="space-between">
              <TextInput
                placeholder={isGlobalOwner ? "Global Search (ID, Email, Name)..." : "Search within city..."}
                leftSection={<Search size={14} />}
                style={{ width: '400px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
              />
              <Select
                label="Department"
                placeholder="All"
                data={[
                  { value: '', label: 'All' },
                  ...departments.map(d => ({ value: d.id.toString(), label: d.name }))
                ]}
                value={selectedDepartment}
                onChange={(v) => setSelectedDepartment(v || '')}
                clearable
                style={{ width: '200px' }}
              />
              <Group>
                <Button
                  leftSection={<UserPlus size={16} />}
                  variant="filled"
                  color="cyan"
                  onClick={() => setCreateModalOpened(true)}
                >
                  Create User
                </Button>
                <Button
                  leftSection={<Send size={16} />}
                  variant="light"
                  color="violet"
                  onClick={() => setInviteModalOpened(true)}
                >
                  Invite Staff
                </Button>
              </Group>
            </Group>

            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>User ID</Table.Th>
                  <Table.Th>Name / Email</Table.Th>
                  <Table.Th>Tenant</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {usersList.filter((u) => !searchQuery || u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()) || u.displayId.toLowerCase().includes(searchQuery.toLowerCase())).map((u) => (
                  <Table.Tr key={u.id}>
                    <Table.Td><Text size="sm" ff="monospace" c="dimmed">{u.displayId}</Text></Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text size="sm" fw={600}>{u.name}</Text>
                        <Text size="xs" c="dimmed">{u.email}</Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td><Text size="sm">{u.tenant}</Text></Table.Td>
                    <Table.Td><Badge color={u.role === 'GLOBAL_OWNER' ? 'red' : u.role === 'TENANT_ADMIN' ? 'blue' : u.role === 'TENANT_MODERATOR' ? 'violet' : 'cyan'} variant="light" size="xs">{u.role}</Badge></Table.Td>
                    <Table.Td>
                      <Badge color={u.status === 'Active' ? 'cyan' : 'yellow'} variant="light" size="xs">{u.status}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={0} justify="flex-end">
                        <ActionIcon variant="subtle" color="cyan" onClick={() => setSelectedUser(u)} aria-label="View user details"><Eye size={16} /></ActionIcon>
                        <ActionIcon variant="subtle" color="red" onClick={() => { setDeleteTarget(u); setDeleteConfirmOpened(true); }} aria-label="Delete user">
                          <Trash2 size={14} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        </Tabs.Panel>

        {isGlobalOwner && (
          <Tabs.Panel value="audit" pt="md">
            <Stack gap="md">
              {auditLogLoading ? (
                <Text c="dimmed">Loading audit logs...</Text>
              ) : auditLogs.length === 0 ? (
                <Text c="dimmed">No audit log entries found.</Text>
              ) : (
                <ScrollArea style={{ height: '600px' }}>
                  <Table verticalSpacing="xs" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Timestamp</Table.Th>
                        <Table.Th>Action</Table.Th>
                        <Table.Th>Impersonator</Table.Th>
                        <Table.Th>Target User</Table.Th>
                        <Table.Th>Tenant</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>IP</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {auditLogs.map((log: AuditLogEntry, idx: number) => (
                        <Table.Tr key={log.id || idx}>
                          <Table.Td><Text size="xs" ff="monospace">{new Date(log.timestamp).toLocaleString()}</Text></Table.Td>
                          <Table.Td><Text size="xs" style={{ maxWidth: '250px', wordBreak: 'break-word' }}>{log.action}</Text></Table.Td>
                          <Table.Td><Text size="xs">{log.impersonator_username || log.impersonator || '-'}</Text></Table.Td>
                          <Table.Td><Text size="xs">{log.target_user_username || log.target_user || '-'}</Text></Table.Td>
                          <Table.Td><Text size="xs" ff="monospace">{log.tenant_id || '-'}</Text></Table.Td>
                          <Table.Td><Badge size="xs" color={log.status_code < 400 ? 'cyan' : 'red'} variant="light">{log.status_code}</Badge></Table.Td>
                          <Table.Td><Text size="xs" ff="monospace">{log.ip_address || '-'}</Text></Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </Stack>
          </Tabs.Panel>
        )}
      </Tabs>

      {/* User Detail Drawer */}
      <Drawer
        opened={!!selectedUser}
        onClose={() => {
          setSelectedUser(null);
          setImpersonateResult(null);
          setImpersonateError(null);
        }}
        position="right"
        size="lg"
        title={<Text fw={700}>Deep-Dive Telemetry: {selectedUser?.name}</Text>}
        styles={{ content: { background: 'var(--mantine-color-body)' }, header: { background: 'transparent' } }}
      >
        {selectedUser && (
          <Stack gap="xl">
            <SimpleGrid cols={2}>
              <Box p="md" style={{ borderRadius: '8px' }}>
                <Text size="xs" c="dimmed" tt="uppercase">Username</Text>
                <Text size="md" fw={600}>{selectedUser.name}</Text>
              </Box>
              <Box p="md" style={{ borderRadius: '8px' }}>
                <Text size="xs" c="dimmed" tt="uppercase">Role</Text>
                <Badge color={selectedUser.role === 'GLOBAL_OWNER' ? 'red' : 'cyan'}>{selectedUser.role}</Badge>
              </Box>
            </SimpleGrid>

            <Box>
              <Text fw={600} mb="sm" c="orange">Impersonation (Audited Action)</Text>
              {impersonateResult ? (
                <Stack gap="sm" p="sm" style={{ background: 'rgba(0,255,0,0.08)', borderRadius: '6px' }}>
                  <Text size="sm" c="green">Impersonation successful!</Text>
                  <Text size="xs" c="dimmed">
                    Token for <b>{impersonateResult.impersonated_user}</b> ({impersonateResult.impersonated_role}) stored.
                  </Text>
                  <Button size="xs" variant="light" color="red" onClick={() => {
                    localStorage.removeItem('impersonation_token');
                    localStorage.removeItem('impersonated_user');
                    setImpersonateResult(null);
                  }}>Clear Impersonation Token</Button>
                </Stack>
              ) : (
                <Button
                  color="red"
                  variant="light"
                  leftSection={<ShieldAlert size={16} />}
                  fullWidth
                  loading={impersonating}
                  onClick={() => handleImpersonate(selectedUser.id)}
                >
                  {impersonating ? 'Generating Token...' : 'Impersonate User'}
                </Button>
              )}
            </Box>
          </Stack>
        )}
      </Drawer>

      {/* Create User Modal */}
      <Modal opened={createModalOpened} onClose={() => setCreateModalOpened(false)} title={<Text fw={700}>Create New User</Text>} centered size="md">
        <Stack gap="md">
          <TextInput label="Username" value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} required />
          <TextInput label="Email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required />
          <PasswordInput label="Password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} required />
          <Select label="Role" value={createForm.role} onChange={(v) => setCreateForm({ ...createForm, role: v || 'ATHLETE' })} data={[
            { value: 'ATHLETE', label: 'Athlete' },
            { value: 'TENANT_MODERATOR', label: 'Moderator' },
            { value: 'TENANT_ADMIN', label: 'Tenant Admin' },
            { value: 'SPONSOR', label: 'Sponsor' },
          ]} />
          {isGlobalOwner && (
            <Select label="Tenant" value={createForm.tenant_id} onChange={(v) => setCreateForm({ ...createForm, tenant_id: v || '' })} data={tenantsList.map((t: TenantRow) => ({ value: String(t.id), label: t.name }))} clearable />
          )}
          <Button fullWidth onClick={handleCreateUser} color="cyan" loading={actionLoading}>Create User</Button>
        </Stack>
      </Modal>

      {/* Invite Modal */}
      <Modal opened={inviteModalOpened} onClose={() => { setInviteModalOpened(false); setInviteResult(null); }} title={<Text fw={700}>Invite Staff / Moderator</Text>} centered size="md">
        <Stack gap="md">
          <TextInput label="Email Address" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="moderator@city.gov" required />
          <TextInput label="Full Name" value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} placeholder="John Doe" />
          <Select label="Role" value={inviteForm.role} onChange={(v) => setInviteForm({ ...inviteForm, role: v || 'TENANT_MODERATOR' })} data={[
            { value: 'TENANT_MODERATOR', label: 'Moderator' },
            { value: 'TENANT_ADMIN', label: 'Tenant Admin' },
          ]} />
          {inviteResult ? (
            <Stack gap="xs" p="sm" style={{ background: 'rgba(0,255,0,0.08)', borderRadius: '6px' }}>
              <Text size="sm" c="green">Invitation created!</Text>
              <Text size="xs">Username: <b>{inviteResult.username}</b></Text>
              <Text size="xs">Password: <b>{inviteResult.temporary_password}</b></Text>
              <Text size="xs" c="dimmed">Share these credentials securely with the user.</Text>
            </Stack>
          ) : (
            <Button fullWidth onClick={handleSendInvitation} color="violet" loading={actionLoading}>
              Generate Invitation Token
            </Button>
          )}
        </Stack>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal opened={deleteConfirmOpened} onClose={() => setDeleteConfirmOpened(false)} title={<Text fw={700} c="red">Delete User?</Text>} centered size="sm">
        <Stack gap="md">
          <Text size="sm">Are you sure you want to permanently delete <b>{deleteTarget?.name}</b> ({deleteTarget?.email})?</Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleteConfirmOpened(false)}>Cancel</Button>
            <Button color="red" onClick={handleDeleteUser} loading={actionLoading}>Delete</Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
};
