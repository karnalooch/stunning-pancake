import { useState, useEffect } from 'react';
import { Box, Table, Badge, Group, Text, Button, ActionIcon, TextInput, Stack, SimpleGrid } from '@mantine/core';
import { WinWindow } from '../../core/Layout';
import { Search, Plus, MoreVertical, ExternalLink } from 'lucide-react';
import { WhiteLabelEngine } from './WhiteLabelEngine';
import { AdminApi } from '../../api/client';

export const Tenants = () => {
  const [tenantsList, setTenantsList] = useState<any[]>([]);

  useEffect(() => {
    AdminApi.getTenants()
      .then(data => {
        const mapped = data.map((t: any) => ({
          id: t.id,
          name: t.name,
          region: 'Global Operation',
          status: t.is_active ? 'Active' : 'Inactive',
          users: 'N/A',
          revenue: '$0'
        }));
        setTenantsList(mapped);
      })
      .catch(err => console.error("Failed to load tenants:", err));
  }, []);
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
              {tenantsList.map((tenant) => (
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

      <WinWindow title="Branding Configuration">
        <WhiteLabelEngine />
      </WinWindow>
    </Box>
  );
};


