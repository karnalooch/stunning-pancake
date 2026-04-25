import { Box, Table, Badge, Group, Text, Button, TextInput, Stack, ActionIcon, Drawer, SimpleGrid } from '@mantine/core';
import { useState } from 'react';
import { WinWindow } from '../../core/Layout';
import { Search, ShieldAlert, Activity, UserCog, MoreVertical, Eye } from 'lucide-react';

const MOCK_USERS = [
  { id: 'U-9921', name: 'Alex Runner', email: 'alex@example.com', tenant: 'Warsaw Runners', status: 'Active', flags: 0 },
  { id: 'U-9922', name: 'Sarah Cyclist', email: 'sarah@example.com', tenant: 'Berlin Health Corp', status: 'Suspicious', flags: 2 },
  { id: 'U-9923', name: 'Mike Sprinter', email: 'mike@example.com', tenant: 'Siedlce City', status: 'Banned', flags: 5 },
  { id: 'U-9924', name: 'Emma Walker', email: 'emma@example.com', tenant: 'Warsaw Runners', status: 'Active', flags: 0 },
];

export const Users = () => {
  const [selectedUser, setSelectedUser] = useState<typeof MOCK_USERS[0] | null>(null);

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      <WinWindow title="User Audit Suite — Global Registry">
        <Stack gap="md">
          <Group justify="space-between">
            <TextInput 
              placeholder="Global Search (ID, Email, Name)..." 
              leftSection={<Search size={14} />}
              style={{ width: '400px' }}
              className="fluent-acrylic"
            />
            <Button leftSection={<UserCog size={16} />} variant="light" color="gray">
              Batch Actions
            </Button>
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
              {MOCK_USERS.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td><Text size="sm" ff="monospace" c="dimmed">{user.id}</Text></Table.Td>
                  <Table.Td>
                    <Stack gap={0}>
                      <Text size="sm" fw={600}>{user.name}</Text>
                      <Text size="xs" c="dimmed">{user.email}</Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td><Text size="sm">{user.tenant}</Text></Table.Td>
                  <Table.Td>
                    <Badge 
                      color={user.status === 'Active' ? 'green' : user.status === 'Suspicious' ? 'yellow' : 'red'} 
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
                      <ActionIcon variant="subtle" color="blue" onClick={() => setSelectedUser(user)}>
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

      <Drawer
        opened={!!selectedUser}
        onClose={() => setSelectedUser(null)}
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
                      <Activity size={16} color="var(--color-win-accent-dark)" />
                      <Stack gap={0}>
                        <Text size="sm">Morning Run - 5.2km</Text>
                        <Text size="xs" c="dimmed">Today, 06:30 AM</Text>
                      </Stack>
                    </Group>
                    <Badge color="green" variant="light">Valid</Badge>
                  </Group>
                ))}
              </Stack>
            </Box>

            <Box>
              <Text fw={600} mb="sm" c="red">Security Warnings</Text>
              {selectedUser.flags > 0 ? (
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

            <Button 
              color="red" 
              variant="light" 
              leftSection={<ShieldAlert size={16} />}
              fullWidth
              mt="xl"
            >
              Impersonate User (Audited Action)
            </Button>
          </Stack>
        )}
      </Drawer>
    </Box>
  );
};
