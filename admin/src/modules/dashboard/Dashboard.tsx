import React, { useState, useEffect } from 'react';
import { SimpleGrid, Card, Text, Group, Badge, Progress, Table, Box, Stack } from '@mantine/core';
import { Users, Activity, Gauge, TrendingUp, ShieldCheck } from 'lucide-react';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';
import { useAuth } from '../../core/auth/useAuth';
import { ModeratorWorklist } from './ModeratorWorklist';
import { GlobalHeatmap } from '../analytics/GlobalHeatmap';
import { SystemIntelligence } from '../analytics/SystemIntelligence';

interface TenantRow {
  tenant_id: string; tenant_name: string; users: number; activities: number;
  distance_km: number; verified_pct: number; primary_color: string; secondary_color: string;
}
interface DashboardStats {
  total_users: number; total_activities: number; total_distance_km: number; total_calories: number;
  new_users_last_7d: number; new_activities_last_7d: number;
  verified_total: number; verified_pct: number; unverified_total: number;
  per_tenant: TenantRow[];
}

const StatCard = ({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) => (
  <Card withBorder>
    <Group justify="space-between" mb="xs">
      <Text size="xs" c="dimmed" fw={500}>{label}</Text>
      <Box c={color}>{icon}</Box>
    </Group>
    <Text size="xl" fw={700}>{value}</Text>
    {sub && <Text size="xs" c={color.startsWith('#') ? color : 'dimmed'} mt={4}>{sub}</Text>}
  </Card>
);

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const isGlobalOwner = user?.role === 'GLOBAL_OWNER';
  const isModerator = user?.role === 'TENANT_MODERATOR';

  useEffect(() => {
    apiClient.get('/activities/admin/stats/')
      .then(res => setStats(res.data))
      .catch(() => {});
  }, []);

  return (
    <Box>
      <PageHeader
        title={isGlobalOwner ? 'Global Dashboard' : `${user?.tenantId || 'Tenant'} Dashboard`}
        subtitle={isGlobalOwner ? 'All platform instances overview' : 'Local instance metrics'}
      />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="xl">
        <StatCard icon={<Users size={18} />} label="Athletes" value={stats ? stats.total_users.toLocaleString() : '—'} sub={stats ? `+${stats.new_users_last_7d} this week` : undefined} color="var(--mantine-color-blue-6)" />
        <StatCard icon={<Activity size={18} />} label="Activities" value={stats ? stats.total_activities.toLocaleString() : '—'} sub={stats ? `+${stats.new_activities_last_7d} this week` : undefined} color="var(--mantine-color-green-6)" />
        <StatCard icon={<Gauge size={18} />} label="Distance" value={stats ? `${stats.total_distance_km.toFixed(1)} km` : '—'} color="var(--mantine-color-violet-6)" />
        <StatCard icon={<ShieldCheck size={18} />} label="Verified" value={stats ? `${stats.verified_pct}%` : '—'} sub={stats ? `${stats.unverified_total} flagged` : undefined} color={stats && stats.unverified_total > 0 ? 'var(--mantine-color-orange-6)' : 'var(--mantine-color-green-6)'} />
      </SimpleGrid>

      {isGlobalOwner && stats?.per_tenant && (
        <Card withBorder mb="xl">
          <Group mb="md">
            <Text fw={600}>Per-Tenant Breakdown</Text>
            <Badge color="blue" variant="light">{stats.per_tenant.length} tenants</Badge>
          </Group>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tenant</Table.Th>
                <Table.Th>Users</Table.Th>
                <Table.Th>Activities</Table.Th>
                <Table.Th>Distance</Table.Th>
                <Table.Th>Verified</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {stats.per_tenant.map((t) => (
                <Table.Tr key={t.tenant_id}>
                  <Table.Td>
                    <Group gap="xs">
                      <Box w={10} h={10} style={{ borderRadius: '50%', background: t.primary_color }} />
                      <Text fw={500}>{t.tenant_name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>{t.users}</Table.Td>
                  <Table.Td>{t.activities}</Table.Td>
                  <Table.Td>{t.distance_km.toFixed(1)} km</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Progress value={t.verified_pct} size="sm" w={80} color={t.verified_pct >= 80 ? 'green' : t.verified_pct >= 50 ? 'yellow' : 'red'} />
                      <Text size="xs">{t.verified_pct}%</Text>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {isGlobalOwner && (
        <Stack gap="xl">
          <SystemIntelligence />
          <GlobalHeatmap />
        </Stack>
      )}
      {isModerator && <ModeratorWorklist />}
    </Box>
  );
};
