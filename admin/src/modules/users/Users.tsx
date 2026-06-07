import {
  Box, Table, Badge, Group, Text, Button, TextInput, Stack, ActionIcon,
  Drawer, Modal, ScrollArea, Tabs, Select, PasswordInput,
  Switch, Textarea, Tooltip, Card, Checkbox, Progress, Skeleton
} from '@mantine/core';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedValue } from '@mantine/hooks';
import {
  Search, ShieldAlert, UserCog, Eye, UserPlus, ClipboardList,
  Trash2, Send, Lock, Unlock, Mail, Shield, Building
} from 'lucide-react';
import { useAuth } from '../../core/auth/useAuth';
import { AdminApi } from '../../api/client';
import { notifications } from '@mantine/notifications';

interface UserRow {
  id: number;
  displayId: string;
  name: string;
  email: string;
  tenant: string;
  tenant_id: string | null;
  status: string;
  flags: number;
  role: string;
  avatar: string | null;
  bio: string;
  is_active: boolean;
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
  const [searchParams] = useSearchParams();
  const [usersList, setUsersList] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [tenantsList, setTenantsList] = useState<TenantRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [inviteModalOpened, setInviteModalOpened] = useState(false);
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [deleteConfirmOpened, setDeleteConfirmOpened] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateResult, setImpersonateResult] = useState<{ access: string; impersonated_user: string; impersonated_role: string } | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);
  
  // Filters
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedTenant, setSelectedTenant] = useState<string>('');

  useEffect(() => {
    const tid = searchParams.get('tenant_id');
    if (tid) setSelectedTenant(tid);
  }, [searchParams]);

  // Cursor pagination (scales to 300k+ without offset scans).
  const pageSize = 25;
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const currentCursor = cursorStack[cursorIndex] ?? null;
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Server-side sorting
  const [sortBy, setSortBy] = useState<'id' | 'username' | 'email' | 'role' | 'status' | 'tenant'>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Bulk selection (current cursor page only).
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [bulkRoleModalOpened, setBulkRoleModalOpened] = useState(false);
  const [bulkChangeRoleForm, setBulkChangeRoleForm] = useState<{
    role: string;
    update_tenant: boolean;
    tenant_id: string;
  }>({ role: 'ATHLETE', update_tenant: false, tenant_id: '' });
  const [bulkJob, setBulkJob] = useState<null | {
    job_id: string;
    status: string;
    progress_pct?: number;
    processed?: number;
    total?: number;
    error?: string;
    message?: string;
    action?: string;
  }>(null);

  // Create user form state
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'ATHLETE',
    tenant_id: '',
  });

  // Edit user drawer form state
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    role: '',
    tenant_id: '',
    is_active: true,
    avatar: '',
    bio: '',
    password: '',
  });

  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    role: 'TENANT_MODERATOR',
  });

  const mapUserRow = (u: {
    id: number;
    username: string;
    email?: string;
    tenant_name?: string;
    tenant_id?: string | null;
    is_active?: boolean;
    role: string;
    avatar?: string | null;
    bio?: string;
  }): UserRow => ({
    id: u.id,
    displayId: `U-${u.id}`,
    name: u.username,
    email: u.email || `${u.username}@sport-platform.com`,
    tenant: u.tenant_name || 'Global HQ',
    tenant_id: u.tenant_id != null ? String(u.tenant_id) : null,
    status: u.is_active ? 'Active' : 'Locked',
    flags: 0,
    role: u.role,
    avatar: u.avatar || null,
    bio: u.bio || '',
    is_active: u.is_active ?? true,
  });

  const fetchUsers = useCallback(() => {
    setUsersLoading(true);
    const params: Record<string, string | number | null> = {
      cursor: currentCursor,
      page_size: pageSize,
      sort: sortBy,
      order: sortOrder,
    };
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (selectedRole) params.role = selectedRole;
    if (selectedTenant) params.tenant_id = selectedTenant;

    AdminApi.getUsers(params)
      .then(({ results, next_cursor, has_more }) => {
        setUsersList(results.map(mapUserRow));
        setSelectedUserIds([]);
        setNextCursor(next_cursor ?? null);
        setHasMore(Boolean(has_more));
      })
      .catch((err) => console.error('Failed to load users:', err))
      .finally(() => setUsersLoading(false));
  }, [currentCursor, pageSize, debouncedSearch, selectedRole, selectedTenant, sortBy, sortOrder]);

  // Reset cursor when filters/sorting change.
  useEffect(() => {
    setCursorStack([null]);
    setCursorIndex(0);
  }, [debouncedSearch, selectedRole, selectedTenant, sortBy, sortOrder]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Poll async bulk actions (redis-backed) until completion.
  useEffect(() => {
    if (!bulkJob?.job_id) return;

    const jobId = bulkJob.job_id;
    let stopped = false;
    const intervalId = setInterval(async () => {
      try {
        const s = await AdminApi.getBulkJobStatus(jobId);
        if (stopped) return;

        setBulkJob((prev) => {
          if (!prev || prev.job_id !== jobId) return prev;
          return { ...prev, ...s, job_id: jobId };
        });

        if (s.status === 'complete') {
          clearInterval(intervalId);
          if (stopped) return;
          notifications.show({
            title: 'Bulk action complete',
            message: s.message || 'Done.',
            color: 'green',
          });
          setSelectedUserIds([]);
          setBulkRoleModalOpened(false);
          setBulkJob(null);
          fetchUsers();
        } else if (s.status === 'error') {
          clearInterval(intervalId);
          if (stopped) return;
          notifications.show({
            title: 'Bulk action failed',
            message: s.error || s.message || 'Unknown error',
            color: 'red',
          });
          setBulkJob(null);
          fetchUsers();
        }
      } catch (err: any) {
        notifications.show({
          title: 'Bulk status polling failed',
          message: err?.response?.data?.error || err.message || 'Unknown error',
          color: 'red',
        });
        clearInterval(intervalId);
      }
    }, 1500);

    return () => {
      stopped = true;
      clearInterval(intervalId);
    };
  }, [bulkJob?.job_id, fetchUsers]);
  
  useEffect(() => {
    if (user?.role === 'GLOBAL_OWNER') {
      Promise.resolve().then(() => setAuditLogLoading(true));
      AdminApi.getAuditLogs(50)
        .then(data => setAuditLogs(data))
        .catch(err => console.error("Failed to load audit logs:", err))
        .finally(() => setAuditLogLoading(false));
      AdminApi.getTenants()
        .then(data => setTenantsList(data))
        .catch(() => { });
    }
  }, [user]);

  const [drawerUserLoading, setDrawerUserLoading] = useState(false);
  useEffect(() => {
    if (!selectedUser) return;
    let cancelled = false;

    // Instant populate to avoid a blank drawer while we lazily fetch.
    setEditForm({
      username: selectedUser.name,
      email: selectedUser.email,
      role: selectedUser.role,
      tenant_id: selectedUser.tenant_id || '',
      is_active: selectedUser.is_active,
      avatar: selectedUser.avatar || '',
      bio: selectedUser.bio || '',
      password: '',
    });

    setDrawerUserLoading(true);
    AdminApi.getUserDetail(selectedUser.id)
      .then((details: any) => {
        if (cancelled) return;
        setEditForm({
          username: details.username ?? selectedUser.name,
          email: details.email ?? selectedUser.email,
          role: details.role ?? selectedUser.role,
          tenant_id: details.tenant_id ?? '',
          is_active: Boolean(details.is_active),
          avatar: details.avatar ?? '',
          bio: details.bio ?? '',
          password: '',
        });
      })
      .catch(() => {
        notifications.show({
          title: 'User load failed',
          message: 'Could not load the full user details.',
          color: 'red',
        });
      })
      .finally(() => {
        if (!cancelled) setDrawerUserLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedUser?.id]);

  const isGlobalOwner = user?.role === 'GLOBAL_OWNER';

  const handleImpersonate = async (targetUserId: number) => {
    setImpersonating(true);
    setImpersonateResult(null);
    try {
      const result = await AdminApi.impersonateUser(targetUserId);
      setImpersonateResult(result);
      localStorage.setItem('impersonation_token', result.access);
      localStorage.setItem('impersonated_user', JSON.stringify({
        username: result.impersonated_user,
        role: result.impersonated_role,
      }));
      notifications.show({ title: 'Impersonation Active', message: `Now simulating ${result.impersonated_user}`, color: 'green' });
    } catch {
      notifications.show({ title: 'Impersonation Failed', message: 'Unauthorized or invalid token.', color: 'red' });
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
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err?.response?.data?.details || err?.message || 'Failed to create user.', color: 'red' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const updatePayload: any = {
        username: editForm.username,
        email: editForm.email,
        role: editForm.role,
        is_active: editForm.is_active,
        bio: editForm.bio,
        avatar: editForm.avatar || null,
      };

      if (editForm.tenant_id) {
        updatePayload.tenant_id = editForm.tenant_id;
      }
      if (editForm.password) {
        updatePayload.password = editForm.password;
      }

      await AdminApi.updateUser(selectedUser.id, updatePayload);
      notifications.show({ title: 'User Updated', message: `${editForm.username} profile saved.`, color: 'green' });
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      notifications.show({ title: 'Update Failed', message: err?.response?.data?.details || err?.message || 'Failed to update user.', color: 'red' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleLockUser = async (userRow: UserRow) => {
    try {
      const newStatus = !userRow.is_active;
      await AdminApi.updateUser(userRow.id, { is_active: newStatus });
      notifications.show({
        title: newStatus ? 'Account Unlocked' : 'Account Locked',
        message: `${userRow.name} status updated successfully.`,
        color: newStatus ? 'green' : 'orange'
      });
      fetchUsers();
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err?.message || 'Failed to toggle status.', color: 'red' });
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await AdminApi.deleteUser(deleteTarget.id);
      notifications.show({ title: 'User Deleted', message: `${deleteTarget.name} removed permanently.`, color: 'orange' });
      setDeleteConfirmOpened(false);
      setDeleteTarget(null);
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err?.message || 'Failed to delete user.', color: 'red' });
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
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err?.message || 'Failed to send invitation.', color: 'red' });
    } finally {
      setActionLoading(false);
    }
  };

  const [activeTab, setActiveTab] = useState<string | null>('users');

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="users" leftSection={<UserCog size={16} />}>Users Registry</Tabs.Tab>
          {isGlobalOwner && (
            <Tabs.Tab value="audit" leftSection={<ClipboardList size={16} />}>
              Audit Log {auditLogs.length > 0 && `(${auditLogs.length})`}
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="users" pt="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Group gap="sm" grow style={{ flex: 1, minWidth: '400px' }}>
                <TextInput
                  placeholder={isGlobalOwner ? "Search (ID, Email, Nickname)..." : "Search within city..."}
                  leftSection={<Search size={14} />}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.currentTarget.value);
                  }}
                />
                <Select
                  placeholder="Role Filter"
                  data={[
                    { value: '', label: 'All Roles' },
                    { value: 'ATHLETE', label: 'Athlete' },
                    { value: 'TENANT_ADMIN', label: 'Tenant Admin' },
                    { value: 'TENANT_MODERATOR', label: 'Moderator' },
                    { value: 'SPONSOR', label: 'Sponsor' },
                    { value: 'GLOBAL_OWNER', label: 'Global Owner' },
                  ]}
                  value={selectedRole}
                  onChange={(v) => {
                    setSelectedRole(v || '');
                  }}
                  clearable
                />
                <Select
                  placeholder="Sort"
                  data={[
                    { value: 'id_desc', label: 'Newest (ID desc)' },
                    { value: 'id_asc', label: 'Oldest (ID asc)' },
                    { value: 'username_asc', label: 'Username A-Z' },
                    { value: 'username_desc', label: 'Username Z-A' },
                    { value: 'email_asc', label: 'Email A-Z' },
                    { value: 'email_desc', label: 'Email Z-A' },
                    { value: 'role_asc', label: 'Role (A-Z)' },
                    { value: 'status_desc', label: 'Status: Active first' },
                    { value: 'tenant_asc', label: 'Tenant (A-Z)' },
                  ]}
                  value={`${sortBy}_${sortOrder}`}
                  onChange={(v) => {
                    if (!v) return;
                    const [nextSortBy, nextSortOrder] = String(v).split('_');
                    setSortBy(nextSortBy as any);
                    setSortOrder(nextSortOrder as any);
                  }}
                />
                {isGlobalOwner && (
                  <Select
                    placeholder="Tenant Filter"
                    data={[
                      { value: '', label: 'All Cities / Tenants' },
                      ...tenantsList.map(t => ({ value: String(t.id), label: t.name }))
                    ]}
                    value={selectedTenant}
                    onChange={(v) => {
                      setSelectedTenant(v || '');
                    }}
                    clearable
                  />
                )}
              </Group>
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

            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                {usersLoading
                  ? 'Loading users...'
                  : `Showing ${usersList.length.toLocaleString()} users${hasMore ? ' (more available)' : ''}`}
              </Text>
            </Group>

            {selectedUserIds.length > 0 && (
              <Card
                withBorder
                padding="md"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <Group justify="space-between" align="center">
                  <Text size="sm" c="dimmed">
                    Selected {selectedUserIds.length.toLocaleString()} user{selectedUserIds.length !== 1 ? 's' : ''} (current page)
                  </Text>
                  <Group gap="sm" wrap="nowrap">
                    <Button
                      size="xs"
                      variant="outline"
                      color="orange"
                      leftSection={<Lock size={14} />}
                      onClick={() => {
                        AdminApi.bulkSetStatus({ user_ids: selectedUserIds, is_active: false })
                          .then((res) => {
                            setBulkJob({ ...res, job_id: res.job_id, status: res.status });
                            notifications.show({
                              title: 'Bulk lock started',
                              message: `Job ${res.job_id} queued.`,
                              color: 'orange',
                            });
                          })
                          .catch((err) => {
                            notifications.show({
                              title: 'Bulk lock failed',
                              message: err?.response?.data?.error || err.message || 'Unknown error',
                              color: 'red',
                            });
                          });
                      }}
                    >
                      Lock
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      color="green"
                      leftSection={<Unlock size={14} />}
                      onClick={() => {
                        AdminApi.bulkSetStatus({ user_ids: selectedUserIds, is_active: true })
                          .then((res) => {
                            setBulkJob({ ...res, job_id: res.job_id, status: res.status });
                            notifications.show({
                              title: 'Bulk unlock started',
                              message: `Job ${res.job_id} queued.`,
                              color: 'green',
                            });
                          })
                          .catch((err) => {
                            notifications.show({
                              title: 'Bulk unlock failed',
                              message: err?.response?.data?.error || err.message || 'Unknown error',
                              color: 'red',
                            });
                          });
                      }}
                    >
                      Unlock
                    </Button>
                    <Button size="xs" variant="light" color="cyan" leftSection={<Shield size={14} />} onClick={() => setBulkRoleModalOpened(true)}>
                      Change Role
                    </Button>
                  </Group>
                </Group>

                {bulkJob?.job_id && (bulkJob.status === 'queued' || bulkJob.status === 'running') && (
                  <>
                    <Text size="xs" c="dimmed" mt="sm">
                      Bulk action: {bulkJob.action || bulkJob.status} - {bulkJob.progress_pct ?? 0}% - processed {bulkJob.processed ?? 0}/{bulkJob.total ?? selectedUserIds.length}
                    </Text>
                    <Progress value={bulkJob.progress_pct ?? 0} size="sm" mt="xs" />
                  </>
                )}
              </Card>
            )}

            <Card withBorder padding="md" style={{ background: 'var(--surface)' }}>
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: '44px' }}>
                      <Checkbox
                        aria-label="Select all visible"
                        checked={usersList.length > 0 && usersList.every((u) => selectedUserIds.includes(u.id))}
                        indeterminate={usersList.some((u) => selectedUserIds.includes(u.id)) && !usersList.every((u) => selectedUserIds.includes(u.id))}
                        onChange={(e) => {
                          const checked = e.currentTarget.checked;
                          const visibleIds = usersList.map((u) => u.id);
                          if (checked) {
                            setSelectedUserIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
                          } else {
                            setSelectedUserIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
                          }
                        }}
                      />
                    </Table.Th>
                    <Table.Th>User ID</Table.Th>
                    <Table.Th>Identity</Table.Th>
                    <Table.Th>City / Tenant</Table.Th>
                    <Table.Th>System Role</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th style={{ width: '100px' }}></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {usersLoading ? (
                    <Table.Tr>
                      <Table.Td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        Loading...
                      </Table.Td>
                    </Table.Tr>
                  ) : usersList.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        No users match the active filter criteria.
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    usersList.map((u) => (
                      <Table.Tr key={u.id}>
                        <Table.Td>
                          <Checkbox
                            aria-label={`Select user ${u.displayId}`}
                            checked={selectedUserIds.includes(u.id)}
                            onChange={(e) => {
                              const checked = e.currentTarget.checked;
                              setSelectedUserIds((prev) => {
                                if (checked) return Array.from(new Set([...prev, u.id]));
                                return prev.filter((id) => id !== u.id);
                              });
                            }}
                          />
                        </Table.Td>
                        <Table.Td><Text size="sm" ff="monospace" c="dimmed">{u.displayId}</Text></Table.Td>
                        <Table.Td>
                          <Stack gap={0}>
                            <Text size="sm" fw={600}>{u.name}</Text>
                            <Text size="xs" c="dimmed">{u.email}</Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td><Text size="sm">{u.tenant}</Text></Table.Td>
                        <Table.Td>
                          <Badge color={
                            u.role === 'GLOBAL_OWNER' ? 'red' :
                            u.role === 'TENANT_ADMIN' ? 'blue' :
                            u.role === 'TENANT_MODERATOR' ? 'violet' :
                            u.role === 'SPONSOR' ? 'grape' : 'cyan'
                          } variant="light" size="xs">
                            {u.role}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Badge color={u.is_active ? 'green' : 'orange'} variant="light" size="xs">
                              {u.is_active ? 'Active' : 'Locked'}
                            </Badge>
                            <Tooltip label={u.is_active ? 'Lock Account' : 'Unlock Account'}>
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                color={u.is_active ? 'orange' : 'green'}
                                onClick={() => handleToggleLockUser(u)}
                              >
                                {u.is_active ? <Lock size={12} /> : <Unlock size={12} />}
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} justify="flex-end">
                            <Tooltip label="Edit Profile / Telemetry">
                              <ActionIcon variant="subtle" color="cyan" onClick={() => setSelectedUser(u)}><Eye size={16} /></ActionIcon>
                            </Tooltip>
                            <Tooltip label="Delete User">
                              <ActionIcon variant="subtle" color="red" onClick={() => { setDeleteTarget(u); setDeleteConfirmOpened(true); }}>
                                <Trash2 size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Card>

            <Group justify="space-between" mt="md">
              <Button
                variant="light"
                onClick={() => cursorIndex > 0 && setCursorIndex((i) => i - 1)}
                disabled={cursorIndex <= 0 || usersLoading}
              >
                Previous
              </Button>
              <Button
                variant="light"
                onClick={() => {
                  if (!nextCursor) return;
                  setCursorStack((prev) => [...prev.slice(0, cursorIndex + 1), nextCursor]);
                  setCursorIndex((i) => i + 1);
                }}
                disabled={!nextCursor || usersLoading}
              >
                Next
              </Button>
            </Group>
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
                <Card withBorder padding="md" style={{ background: 'var(--surface)' }}>
                  <ScrollArea style={{ height: '600px' }}>
                    <Table verticalSpacing="xs" highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Timestamp</Table.Th>
                          <Table.Th>Action</Table.Th>
                          <Table.Th>Impersonator</Table.Th>
                          <Table.Th>Target User</Table.Th>
                          <Table.Th>Tenant ID</Table.Th>
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
                            <Table.Td><Badge size="xs" color={log.status_code < 400 ? 'green' : 'red'} variant="light">{log.status_code}</Badge></Table.Td>
                            <Table.Td><Text size="xs" ff="monospace">{log.ip_address || '-'}</Text></Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                </Card>
              )}
            </Stack>
          </Tabs.Panel>
        )}
      </Tabs>

      {/* User Detail & Interactive Profile Editor Drawer */}
      <Drawer
        opened={!!selectedUser}
        onClose={() => {
          setSelectedUser(null);
          setImpersonateResult(null);
        }}
        position="right"
        size="lg"
        title={<Text fw={700} size="lg">Modify Profile & Telemetry Details</Text>}
        styles={{ content: { background: 'var(--surface-secondary)' }, header: { background: 'transparent' } }}
      >
        {selectedUser && (
          <ScrollArea style={{ height: 'calc(100vh - 80px)' }} offsetScrollbars>
            {drawerUserLoading ? (
              <Stack gap="md" p="md">
                <Skeleton height={72} radius="md" />
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} height={140} radius="md" />
                ))}
                <Skeleton height={44} radius="md" />
              </Stack>
            ) : (
            <Stack gap="xl" p="md">
              {/* Profile Card Summary */}
              <Card withBorder padding="md" style={{ background: 'var(--surface)' }}>
                <Group gap="md">
                  <Box
                    w={48} h={48}
                    style={{
                      borderRadius: 12,
                      background: 'var(--brand-gradient)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {editForm.is_active ? <Unlock size={24} color="white" /> : <Lock size={24} color="white" />}
                  </Box>
                  <Stack gap={2}>
                    <Text fw={700} size="md">{selectedUser.name}</Text>
                    <Text size="xs" c="dimmed">{selectedUser.email}</Text>
                  </Stack>
                </Group>
              </Card>

              {/* Edit Identity Information Section */}
              <Card withBorder padding="md" style={{ background: 'var(--surface)' }}>
                <Stack gap="sm">
                  <Text fw={700} size="sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={16} color="cyan" /> Identity Configuration
                  </Text>
                  
                  <TextInput
                    label="Username"
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    required
                  />
                  <TextInput
                    label="Email Address"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                    leftSection={<Mail size={14} />}
                  />
                  <Select
                    label="System Role"
                    value={editForm.role}
                    onChange={(v) => setEditForm({ ...editForm, role: v || 'ATHLETE' })}
                    data={[
                      { value: 'ATHLETE', label: 'Athlete' },
                      { value: 'TENANT_MODERATOR', label: 'Moderator' },
                      { value: 'TENANT_ADMIN', label: 'Tenant Admin' },
                      { value: 'SPONSOR', label: 'Sponsor' },
                      { value: 'GLOBAL_OWNER', label: 'Global Owner' },
                    ]}
                    disabled={!isGlobalOwner && editForm.role === 'GLOBAL_OWNER'}
                  />
                  {isGlobalOwner && (
                    <Select
                      label="Assigned Tenant"
                      value={editForm.tenant_id}
                      onChange={(v) => setEditForm({ ...editForm, tenant_id: v || '' })}
                      data={tenantsList.map((t: TenantRow) => ({ value: String(t.id), label: t.name }))}
                      clearable
                      leftSection={<Building size={14} />}
                    />
                  )}
                  <Group justify="space-between" mt="xs">
                    <Text size="sm" fw={500}>Account Status (Active / Unlocked)</Text>
                    <Switch
                      checked={editForm.is_active}
                      onChange={(e) => setEditForm({ ...editForm, is_active: e.currentTarget.checked })}
                      color="cyan"
                    />
                  </Group>
                </Stack>
              </Card>

              {/* Avatars & Biography Customization Section */}
              <Card withBorder padding="md" style={{ background: 'var(--surface)' }}>
                <Stack gap="sm">
                  <Text fw={700} size="sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Custom Profile Branding
                  </Text>
                  <TextInput
                    label="Custom Avatar URL"
                    value={editForm.avatar}
                    placeholder="https://example.com/avatar.png"
                    onChange={(e) => setEditForm({ ...editForm, avatar: e.target.value })}
                  />
                  <Textarea
                    label="Biography Description"
                    placeholder="Enter athlete bio, training goals or company description..."
                    minRows={3}
                    maxRows={6}
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  />
                </Stack>
              </Card>

              {/* Password Management */}
              <Card withBorder padding="md" style={{ background: 'var(--surface)' }}>
                <Stack gap="sm">
                  <Text fw={700} size="sm">Security Credentials</Text>
                  <PasswordInput
                    label="Force Reset Password"
                    placeholder="Enter new password to force update"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  />
                </Stack>
              </Card>

              {/* Save & Impersonation Buttons */}
              <Stack gap="sm">
                <Button color="cyan" fullWidth onClick={handleUpdateUser} loading={actionLoading}>
                  Save All Profile Changes
                </Button>

                {user?.role === 'GLOBAL_OWNER' && (
                  <Box mt="md">
                    <Text fw={700} size="sm" mb="xs" c="orange">Impersonation Sandbox</Text>
                    {impersonateResult ? (
                      <Stack gap="sm" p="sm" style={{ background: 'rgba(0,255,0,0.08)', borderRadius: '6px' }}>
                        <Text size="sm" c="green">Impersonating {impersonateResult.impersonated_user}</Text>
                        <Text size="xs" c="dimmed">
                          Session token cached. The frontend mimics this user&apos;s dashboards and permissions.
                        </Text>
                        <Button size="xs" variant="light" color="red" onClick={() => {
                          localStorage.removeItem('impersonation_token');
                          localStorage.removeItem('impersonated_user');
                          setImpersonateResult(null);
                        }}>End Impersonation Session</Button>
                      </Stack>
                    ) : (
                      <Button
                        color="orange"
                        variant="light"
                        leftSection={<ShieldAlert size={16} />}
                        fullWidth
                        loading={impersonating}
                        onClick={() => handleImpersonate(selectedUser.id)}
                      >
                        {impersonating ? 'Connecting Session...' : 'Launch Impersonated Session'}
                      </Button>
                    )}
                  </Box>
                )}
              </Stack>
            </Stack>
            )}
          </ScrollArea>
        )}
      </Drawer>

      {/* Create User Modal */}
      <Modal opened={createModalOpened} onClose={() => setCreateModalOpened(false)} title={<Text fw={700}>Create New System User</Text>} centered size="md">
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

      {/* Bulk Change Role Modal */}
      <Modal
        opened={bulkRoleModalOpened}
        onClose={() => setBulkRoleModalOpened(false)}
        title={<Text fw={700}>Change role for selected users</Text>}
        centered
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Selected: <b>{selectedUserIds.length.toLocaleString()}</b> users (this cursor page).
          </Text>

          <Select
            label="New Role"
            value={bulkChangeRoleForm.role}
            onChange={(v) => {
              const role = v || 'ATHLETE';
              setBulkChangeRoleForm((prev) => ({
                ...prev,
                role,
                // GLOBAL_OWNER always clears tenant on the backend.
                update_tenant: role === 'GLOBAL_OWNER' ? false : prev.update_tenant,
                tenant_id: role === 'GLOBAL_OWNER' ? '' : prev.tenant_id,
              }));
            }}
            data={[
              { value: 'ATHLETE', label: 'Athlete' },
              { value: 'TENANT_MODERATOR', label: 'Tenant Moderator' },
              { value: 'TENANT_ADMIN', label: 'Tenant Admin' },
              { value: 'SPONSOR', label: 'Sponsor' },
              { value: 'GLOBAL_OWNER', label: 'Global Owner' },
            ]}
          />

          {bulkChangeRoleForm.role !== 'GLOBAL_OWNER' && (
            <>
              <Checkbox
                checked={bulkChangeRoleForm.update_tenant}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setBulkChangeRoleForm((prev) => ({
                    ...prev,
                    update_tenant: checked,
                    tenant_id: checked ? prev.tenant_id : '',
                  }));
                }}
                label="Also update tenant for all selected users"
                description="When unchecked, role is changed but existing tenant assignments remain unchanged."
              />

              {bulkChangeRoleForm.update_tenant && (
                <Select
                  label="Tenant"
                  placeholder="Pick a tenant..."
                  value={bulkChangeRoleForm.tenant_id}
                  onChange={(v) => setBulkChangeRoleForm((prev) => ({ ...prev, tenant_id: v || '' }))}
                  data={tenantsList.map((t) => ({ value: String(t.id), label: t.name }))}
                  clearable
                />
              )}
            </>
          )}

          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setBulkRoleModalOpened(false)}>
              Cancel
            </Button>
            <Button
              color="cyan"
              onClick={async () => {
                if (selectedUserIds.length === 0) return;
                if (bulkChangeRoleForm.role !== 'GLOBAL_OWNER' && bulkChangeRoleForm.update_tenant) {
                  if (!bulkChangeRoleForm.tenant_id) {
                    notifications.show({ title: 'Tenant required', message: 'Select tenant or uncheck tenant update.', color: 'red' });
                    return;
                  }
                }
                try {
                  const res = await AdminApi.bulkChangeRole({
                    user_ids: selectedUserIds,
                    role: bulkChangeRoleForm.role,
                    update_tenant: bulkChangeRoleForm.role !== 'GLOBAL_OWNER' ? bulkChangeRoleForm.update_tenant : false,
                    tenant_id: bulkChangeRoleForm.update_tenant ? bulkChangeRoleForm.tenant_id : null,
                  });
                  setBulkJob({ ...res, job_id: res.job_id, status: res.status });
                  setBulkRoleModalOpened(false);
                  notifications.show({
                    title: 'Bulk role change started',
                    message: `Job ${res.job_id} queued.`,
                    color: 'cyan',
                  });
                } catch (err: any) {
                  notifications.show({
                    title: 'Bulk role change failed',
                    message: err?.response?.data?.error || err.message || 'Unknown error',
                    color: 'red',
                  });
                }
              }}
            >
              Start Job
            </Button>
          </Group>
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
