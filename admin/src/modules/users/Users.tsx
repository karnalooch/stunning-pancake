import { Box, Table, Badge, Group, Text, Button, TextInput, Stack, ActionIcon, Drawer, SimpleGrid, Modal, ScrollArea, Tabs, Code } from '@mantine/core';
import { useState, useEffect } from 'react';
import { WinWindow } from '../../core/Layout';
import { Search, ShieldAlert, Activity, UserCog, MoreVertical, Eye, UserPlus, ClipboardList, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../core/auth/useAuth';
import { AdminApi } from '../../api/client';

export const Users = () => {
  const { user } = useAuth();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [inviteModalOpened, setInviteModalOpened] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateError, setImpersonateError] = useState<string | null>(null);
  const [impersonateResult, setImpersonateResult] = useState<any | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);

  useEffect(() => {
    AdminApi.getUsers()
      .then(data => {
        // Map real user data fields
        const mapped = data.map((u: any) => ({
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
  }, []);

  useEffect(() => {
    if (user?.role === 'GLOBAL_OWNER') {
      setAuditLogLoading(true);
      AdminApi.getAuditLogs(50)
        .then(data => setAuditLogs(data))
        .catch(err => console.error("Failed to load audit logs:", err))
        .finally(() => setAuditLogLoading(false));
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
      // Store the access token so the admin can use it
      localStorage.setItem('impersonation_token', result.access);
      localStorage.setItem('impersonated_user', JSON.stringify({
        username: result.impersonated_user,
        role: result.impersonated_role,
      }));
    } catch (err: any) {
      setImpersonateError(err?.response?.data?.error || err?.message || 'Impersonation failed');
    } finally {
      setImpersonating(false);
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
          <WinWindow title={windowTitle}>
            <Stack gap="md">
              <Group justify="space-between">
                <TextInput
                  placeholder={isGlobalOwner ? "Global Search (ID, Email, Name)..." : "Search within city..."}
                  leftSection={<Search size={14} />}
                  style={{ width: '400px' }}
                  className="fluent-acrylic"
                />
                <Group>
                  <Button
                    leftSection={<UserPlus size={16} />}
                    variant="filled"
                    color="cyan"
                    onClick={() => setInviteModalOpened(true)}
                  >
                    Invite Staff
                  </Button>
                  <Button leftSection={<UserCog size={16} />} variant="light" color="gray">
                    Batch Actions
                  </Button>
                </Group>
              </Group>

              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>User ID</Table.Th>
                    <Table.Th>Name / Email</Table.Th>
                    <Table.Th>Tenant</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Security Flags</Table.Th>
                    <Table.Th></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {usersList.map((user) => (
                    <Table.Tr key={user.id}>
                      <Table.Td><Text size="sm" ff="monospace" c="dimmed">{user.displayId}</Text></Table.Td>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text size="sm" fw={600}>{user.name}</Text>
                          <Text size="xs" c="dimmed">{user.email}</Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td><Text size="sm">{user.tenant}</Text></Table.Td>
                      <Table.Td>
                        <Badge
                          color={user.status === 'Active' ? 'cyan' : user.status === 'Suspicious' ? 'yellow' : 'red'}
                          variant="light"
                          size="xs"
                        >
                          {user.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {user.flags > 0 ? (
                          <Badge color="red" variant="dot" size="sm">{user.flags} Flags</Badge>
                        ) : (
                          <Text size="sm" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={0} justify="flex-end">
                          <ActionIcon variant="subtle" color="cyan" onClick={() => setSelectedUser(user)}>
                            <Eye size={16} />
                          </ActionIcon>
                          <ActionIcon variant="subtle" color="gray"><MoreVertical size={16} /></ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </WinWindow>
        </Tabs.Panel>

        {isGlobalOwner && (
          <Tabs.Panel value="audit" pt="md">
            <WinWindow title="Audit Log — Recent 50 Entries">
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
                        {auditLogs.map((log: any, idx: number) => (
                          <Table.Tr key={log.id || idx}>
                            <Table.Td>
                              <Text size="xs" ff="monospace">
                                {new Date(log.timestamp).toLocaleString()}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" style={{ maxWidth: '250px', wordBreak: 'break-word' }}>
                                {log.action}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs">{log.impersonator_username || log.impersonator || '-'}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs">{log.target_user_username || log.target_user || '-'}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" ff="monospace">{log.tenant_id || '-'}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge size="xs" color={log.status_code < 400 ? 'cyan' : 'red'} variant="light">
                                {log.status_code}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" ff="monospace">{log.ip_address || '-'}</Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                )}
              </Stack>
            </WinWindow>
          </Tabs.Panel>
        )}
      </Tabs>

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
        styles={{
          content: { background: 'var(--mantine-color-body)' },
          header: { background: 'transparent' }
        }}
      >
        {selectedUser && (
          <Stack gap="xl">
            <SimpleGrid cols={2}>
              <Box p="md" className="fluent-acrylic" style={{ borderRadius: '8px' }}>
                <Text size="xs" c="dimmed" tt="uppercase">Last Known Location</Text>
                <Text size="md" fw={600}>52.1672° N, 22.2906° E</Text>
              </Box>
              <Box p="md" className="fluent-acrylic" style={{ borderRadius: '8px' }}>
                <Text size="xs" c="dimmed" tt="uppercase">Device Fingerprint</Text>
                <Text size="md" fw={600} ff="monospace">iPhone14,2 (iOS 17.4)</Text>
              </Box>
            </SimpleGrid>

            <Box>
              <Text fw={600} mb="sm">Recent Activities</Text>
              <Stack gap="sm">
                {[1, 2, 3].map((i) => (
                  <Group key={i} p="sm" className="fluent-acrylic" style={{ borderRadius: '6px' }} justify="space-between">
                    <Group>
                      <Activity size={16} color="#00D1FF" />
                      <Stack gap={0}>
                        <Text size="sm">Morning Run - 5.2km</Text>
                        <Text size="xs" c="dimmed">Today, 06:30 AM</Text>
                      </Stack>
                    </Group>
                    <Badge color="cyan" variant="light">Valid</Badge>
                  </Group>
                ))}
              </Stack>
            </Box>

            <Box>
              <Text fw={600} mb="sm" c="red">Security Warnings</Text>
              {selectedUser && selectedUser.flags > 0 ? (
                <Group p="sm" style={{ background: 'rgba(255,0,0,0.1)', borderRadius: '6px', border: '1px solid rgba(255,0,0,0.2)' }}>
                  <ShieldAlert size={20} color="red" />
                  <Stack gap={0}>
                    <Text size="sm" fw={600} c="red">V-max violation detected</Text>
                    <Text size="xs" c="red" opacity={0.8}>Speed exceeded biological limits (45km/h sustained) on segment 14.</Text>
                  </Stack>
                </Group>
              ) : (
                <Text size="sm" c="dimmed">No security flags raised.</Text>
              )}
            </Box>

            {/* Impersonation Section */}
            <Box>
              <Text fw={600} mb="sm" c="orange">Impersonation (Audited Action)</Text>
              {impersonateResult ? (
                <Stack gap="sm" p="sm" style={{ background: 'rgba(0,255,0,0.08)', borderRadius: '6px', border: '1px solid rgba(0,255,0,0.2)' }}>
                  <Text size="sm" c="green">✅ Impersonation successful!</Text>
                  <Text size="xs" c="dimmed">
                    Token for <b>{impersonateResult.impersonated_user}</b> ({impersonateResult.impersonated_role}) has been stored.
                  </Text>
                  <Text size="xs" c="dimmed" ff="monospace" style={{ wordBreak: 'break-all' }}>
                    Access: {impersonateResult.access?.substring(0, 40)}...
                  </Text>
                  <Button size="xs" variant="light" color="red" onClick={() => {
                    localStorage.removeItem('impersonation_token');
                    localStorage.removeItem('impersonated_user');
                    setImpersonateResult(null);
                  }}>
                    Clear Impersonation Token
                  </Button>
                </Stack>
              ) : impersonateError ? (
                <Stack gap="sm" p="sm" style={{ background: 'rgba(255,0,0,0.08)', borderRadius: '6px', border: '1px solid rgba(255,0,0,0.2)' }}>
                  <Group>
                    <AlertTriangle size={16} color="red" />
                    <Text size="sm" c="red">❌ {impersonateError}</Text>
                  </Group>
                </Stack>
              ) : (
                <Text size="xs" c="dimmed" mb="sm">
                  This will generate a JWT token for <b>{selectedUser.name}</b> without knowing their password.
                  All actions performed with this token will be logged in the audit trail.
                </Text>
              )}
              {!impersonateResult && (
                <Button
                  color="red"
                  variant="light"
                  leftSection={<ShieldAlert size={16} />}
                  fullWidth
                  loading={impersonating}
                  onClick={() => handleImpersonate(selectedUser.id)}
                >
                  {impersonating ? 'Generating Token...' : 'Impersonate User (Audited Action)'}
                </Button>
              )}
            </Box>
          </Stack>
        )}
      </Drawer>

      <Modal
        opened={inviteModalOpened}
        onClose={() => setInviteModalOpened(false)}
        title={<Text fw={700}>Invite New Staff / Moderator</Text>}
        centered
        className="fluent-acrylic"
        styles={{ content: { borderRadius: '12px', background: 'rgba(32,32,32,0.95)', border: '1px solid rgba(255,255,255,0.1)' } }}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            This will send an invitation to join your city as a **Tenant Moderator**. They will have access to Anti-Cheat and local moderation.
          </Text>
          <TextInput label="Email Address" placeholder="moderator@city.gov" required />
          <TextInput label="Full Name" placeholder="Jan Kowalski" />
          <Button fullWidth onClick={() => setInviteModalOpened(false)} color="cyan" mt="md">
            Send Invitation Token
          </Button>
        </Stack>
      </Modal>
    </Box>
  );
};
