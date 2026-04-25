import { Box, Table, Badge, Group, Text, Button, ActionIcon, TextInput, Stack, SimpleGrid } from '@mantine/core';
import { WinWindow } from '../../core/Layout';
import { Search, Plus, MoreVertical, ExternalLink } from 'lucide-react';

const MOCK_TENANTS = [
  { id: 1, name: 'Siedlce City Council', region: 'Masovian, PL', status: 'Active', users: '42,102', revenue: '$12,400' },
  { id: 2, name: 'Warsaw Runners Club', region: 'Warsaw, PL', status: 'Active', users: '128,500', revenue: '$45,000' },
  { id: 3, name: 'Berlin Health Corp', region: 'Berlin, DE', status: 'Pending', users: '0', revenue: '$0' },
  { id: 4, name: 'Gdansk Sports Hub', region: 'Pomeranian, PL', status: 'Suspended', users: '15,200', revenue: '$3,200' },
];

export const Tenants = () => {
  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      <WinWindow title="Tenant Management — Platform Registry">
        <Stack gap="md">
          <Group justify="space-between">
            <TextInput 
              placeholder="Search tenants..." 
              leftSection={<Search size={14} />}
              style={{ width: '300px' }}
              className="fluent-acrylic"
            />
            <Button leftSection={<Plus size={16} />} bg="var(--color-win-accent-dark)">
              Onboard New Tenant
            </Button>
          </Group>

          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Organization</Table.Th>
                <Table.Th>Region</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Total Users</Table.Th>
                <Table.Th>Monthly Revenue</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {MOCK_TENANTS.map((tenant) => (
                <Table.Tr key={tenant.id}>
                  <Table.Td>
                    <Group gap="sm">
                      <Box w={24} h={24} bg="rgba(255,255,255,0.05)" style={{ borderRadius: '4px' }} />
                      <Text size="sm" fw={600}>{tenant.name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{tenant.region}</Text></Table.Td>
                  <Table.Td>
                    <Badge 
                      color={tenant.status === 'Active' ? 'green' : tenant.status === 'Pending' ? 'yellow' : 'red'} 
                      variant="light"
                      size="xs"
                    >
                      {tenant.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td><Text size="sm">{tenant.users}</Text></Table.Td>
                  <Table.Td><Text size="sm" fw={600}>{tenant.revenue}</Text></Table.Td>
                  <Table.Td>
                    <Group gap={0} justify="flex-end">
                      <ActionIcon variant="subtle" color="gray"><ExternalLink size={14} /></ActionIcon>
                      <ActionIcon variant="subtle" color="gray"><MoreVertical size={14} /></ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      </WinWindow>

      <SimpleGrid cols={2} spacing="xl">
        <WinWindow title="Onboarding Health">
          <Box h={100} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text size="xs" c="dimmed">Tenant Provisioning Pipeline: STABLE</Text>
          </Box>
        </WinWindow>
        <WinWindow title="Billing Distribution">
          <Box h={100} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text size="xs" c="dimmed">B2B Revenue Stream: +12.4% vs prev month</Text>
          </Box>
        </WinWindow>
      </SimpleGrid>
    </Box>
  );
};


