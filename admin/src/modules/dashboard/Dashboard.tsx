import React, { useState, useEffect } from 'react';
import { Box, Group, Stack, Title, Text, Button, SimpleGrid, Card, Badge, Progress, Table, ScrollArea } from '@mantine/core';
import { useDesigner, EditableText } from '../../providers/DesignerProvider';
import { apiClient } from '../../api/client';
import { Settings2, Users, Radio, ShieldCheck, TrendingUp, Plus, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDisclosure } from '@mantine/hooks';
import { StatCard } from './components/StatCard';
import { GlobalHeatmap } from '../analytics/GlobalHeatmap';
import { SystemIntelligence } from '../analytics/SystemIntelligence';
import { CityAnalytics } from '../analytics/CityAnalytics';
import { ModeratorWorklist } from './ModeratorWorklist';
import { InstanceWizard } from '../tenants/InstanceWizard';

import { useAuth } from '../../core/auth/useAuth';

interface TenantRow {
  tenant_id: string;
  tenant_name: string;
  users: number;
  activities: number;
  distance_km: number;
  verified_pct: number;
  primary_color: string;
  secondary_color: string;
}

interface DashboardStats {
  total_users: number;
  total_activities: number;
  total_distance_km: number;
  total_calories: number;
  new_users_today: number;
  new_users_last_7d: number;
  new_activities_last_7d: number;
  verified_total: number;
  verified_pct: number;
  unverified_total: number;
  per_tenant: TenantRow[];
}

export const Dashboard: React.FC<{ mode: 'light' | 'dark' }> = ({ mode }) => {
  const { user } = useAuth();
  const { isEditMode, toggleEditMode } = useDesigner();
  const [wizardOpened, { open, close }] = useDisclosure(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  
  useEffect(() => {
    apiClient.get('/activities/admin/stats/')
      .then(res => setStats(res.data))
      .catch(err => console.error("Stats fetch error:", err));
  }, []);
  
  const isGlobalOwner = user?.role === 'GLOBAL_OWNER';
  const isModerator = user?.role === 'TENANT_MODERATOR';

  const verifiedPct = stats?.verified_pct ?? 0;
  const userGrowth = stats ? `+${stats.new_users_last_7d}` : '...';
  const activityGrowth = stats ? `+${stats.new_activities_last_7d}` : '...';

  return (
    <Box p="xl" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
      <InstanceWizard opened={wizardOpened} onClose={close} />
      
      <Group justify="space-between" mb="xl">
        <Stack gap={0}>
          <Title className="text-gradient glitch-hover" style={{ fontSize: '36px', fontWeight: 900, cursor: 'default' }}>
            <EditableText 
              initialValue={isGlobalOwner ? "Global Owner Console" : `${user?.tenantId?.toUpperCase() || 'Tenant'} Console`} 
              size="xl" weight={900} 
            />
          </Title>
          <Text size="xs" c="dimmed">
            {isGlobalOwner ? 'Operational status for all platform nodes' : `Local node performance metrics`}
          </Text>
        </Stack>
        <Group>
          <Button 
            variant={isEditMode ? 'filled' : 'light'} 
            color={isEditMode ? 'green' : 'blue'}
            onClick={toggleEditMode}
            leftSection={<Settings2 size={16} />}
          >
            {isEditMode ? 'Exit Designer Mode' : 'Enter Designer Mode'}
          </Button>
          {isGlobalOwner && (
            <Button 
              size="md" 
              radius="md" 
              color="blue" 
              leftSection={<Plus size={20} />}
              onClick={open}
            >
              Deploy New Instance
            </Button>
          )}
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 4 }} spacing="xl" mb="xl">
        <StatCard icon={<Users size={20} />} label="Total Athletes" value={stats ? stats.total_users.toLocaleString() : '...'} badge={userGrowth} color="blue" progress={Math.min(stats ? (stats.total_users / 100) * 100 : 0, 100)} glow="glow-blue" />
        <StatCard icon={<Radio size={20} />} label="Total Activities" value={stats ? stats.total_activities.toLocaleString() : '...'} badge={activityGrowth} color="lime" progress={Math.min(stats ? (stats.total_activities / 200) * 100 : 0, 100)} glow="glow-lime" />
        <StatCard icon={<ShieldCheck size={20} />} label="Total Distance" value={stats ? `${stats.total_distance_km.toFixed(1)} km` : '...'} badge={`${verifiedPct}% VERIFIED`} color="red" progress={verifiedPct} />
        <StatCard icon={<TrendingUp size={20} />} label="Calories Burned" value={stats ? stats.total_calories.toLocaleString() : '...'} badge={`${stats?.unverified_total ?? 0} FLAGGED`} color="indigo" progress={Math.min(stats ? (stats.verified_total / Math.max(stats.total_activities, 1)) * 100 : 0, 100)} />
      </SimpleGrid>

      {isGlobalOwner && stats?.per_tenant && stats.per_tenant.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card radius="xl" p="xl" className="fluent-acrylic" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <Group mb="md" justify="space-between">
              <Stack gap={0}>
                <Text fw={900} size="lg" color="white">Per-Tenant Breakdown</Text>
                <Text size="xs" c="dimmed">Real-time metrics across all active instances</Text>
              </Stack>
              <Badge size="lg" color="blue" variant="light">{stats.per_tenant.length} ACTIVE TENANTS</Badge>
            </Group>
            <ScrollArea>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tenant</Table.Th>
                    <Table.Th>Users</Table.Th>
                    <Table.Th>Activities</Table.Th>
                    <Table.Th>Distance (km)</Table.Th>
                    <Table.Th>Verified %</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {stats.per_tenant.map((tenant) => (
                    <Table.Tr key={tenant.tenant_id}>
                      <Table.Td>
                        <Group gap="xs">
                          <Box w={10} h={10} style={{ borderRadius: '50%', background: tenant.primary_color }} />
                          <Text fw={600} size="sm">{tenant.tenant_name}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td><Text size="sm">{tenant.users}</Text></Table.Td>
                      <Table.Td><Text size="sm">{tenant.activities}</Text></Table.Td>
                      <Table.Td><Text size="sm">{tenant.distance_km.toFixed(1)}</Text></Table.Td>
                      <Table.Td>
                        <Progress value={tenant.verified_pct} color={tenant.verified_pct >= 80 ? 'green' : tenant.verified_pct >= 50 ? 'yellow' : 'red'} size="sm" />
                        <Text size="xs" c="dimmed">{tenant.verified_pct}%</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" color={tenant.verified_pct >= 80 ? 'green' : tenant.verified_pct >= 50 ? 'yellow' : 'red'} variant="light">
                          {tenant.verified_pct >= 80 ? 'HEALTHY' : tenant.verified_pct >= 50 ? 'REVIEW' : 'CRITICAL'}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Card>
        </motion.div>
      )}

      {isGlobalOwner ? (
        <>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            style={{ marginBottom: '24px' }}
          >
            <SystemIntelligence />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            <GlobalHeatmap />
          </motion.div>
        </>
      ) : isModerator ? (
        <ModeratorWorklist />
      ) : (
        <CityAnalytics cityId={user?.tenantId || 'siedlce'} />
      )}

    </Box>
  );
};
