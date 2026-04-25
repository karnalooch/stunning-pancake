import React from 'react';
import { Container, Title, Text, Grid, Paper, Group, Badge, Stack, SimpleGrid } from '@mantine/core';
import { IconUsers, IconAlertTriangle, IconCheck, IconMapPin } from '@tabler/icons-react';

// This is a "New Era" view for Milestone 6.4
export const CityModeratorDashboard: React.FC = () => {
  return (
    <Container fluid p="md">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end">
          <Stack gap={0}>
            <Text size="sm" fw={700} c="dimmed" tt="uppercase" lts={1}>
              City Moderator Portal
            </Text>
            <Title order={1} fw={900} lts={-1.5} style={{ fontSize: '36px' }}>
              Siedlce Community Hub
            </Title>
          </Stack>
          <Badge size="xl" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
            Level 3 Access
          </Badge>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <StatCard 
            title="Active Athletes" 
            value="1,248" 
            icon={<IconUsers size={24} />} 
            color="blue" 
          />
          <StatCard 
            title="Flagged Tracks" 
            value="12" 
            icon={<IconAlertTriangle size={24} />} 
            color="orange" 
          />
          <StatCard 
            title="Verified Today" 
            value="452" 
            icon={<IconCheck size={24} />} 
            color="teal" 
          />
          <StatCard 
            title="Hotspots" 
            value="8" 
            icon={<IconMapPin size={24} />} 
            color="indigo" 
          />
        </SimpleGrid>

        <Grid gutter="md">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Paper p="xl" radius="lg" withBorder style={{ height: '400px', background: 'rgba(255,255,255,0.02)' }}>
              <Title order={3} mb="lg">Live Activity Feed (deck.gl Mock)</Title>
              <Text c="dimmed">Immersive geospatial view will be rendered here.</Text>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Paper p="xl" radius="lg" withBorder>
              <Title order={3} mb="lg">Quick Actions</Title>
              <Stack>
                <ActionItem label="Review Pending Tracks" count={12} color="orange" />
                <ActionItem label="Active Challenges" count={3} color="blue" />
                <ActionItem label="User Reports" count={0} color="teal" />
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
};

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => (
  <Paper p="lg" radius="lg" withBorder>
    <Group justify="space-between">
      <Stack gap={0}>
        <Text size="xs" c="dimmed" fw={700} tt="uppercase">{title}</Text>
        <Text size="xl" fw={900}>{value}</Text>
      </Stack>
      <div style={{ color: `var(--mantine-color-${color}-6)` }}>
        {icon}
      </div>
    </Group>
  </Paper>
);

const ActionItem: React.FC<{ label: string; count: number; color: string }> = ({ label, count, color }) => (
  <Paper p="sm" radius="md" withBorder style={{ cursor: 'pointer' }}>
    <Group justify="space-between">
      <Text size="sm" fw={600}>{label}</Text>
      <Badge color={color} variant="light">{count}</Badge>
    </Group>
  </Paper>
);
