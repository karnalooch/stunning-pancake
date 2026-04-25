import { Box, SimpleGrid, Group, Stack, Text, ScrollArea, Button, Badge } from '@mantine/core';
import { WinWindow } from '../../core/Layout';
import { AreaChart, Title, Metric, Flex, ProgressBar } from '@tremor/react';
import { useDesigner, EditableText } from '../../providers/DesignerProvider';
import { Settings2, Users, Radio, ShieldCheck, TrendingUp, Activity as ActivityIcon } from 'lucide-react';
import { motion } from 'framer-motion';

const chartdata = [
  { date: "Jan 22", "Active Users": 2890, "Telemetry Packets": 2338 },
  { date: "Feb 22", "Active Users": 2756, "Telemetry Packets": 2103 },
  { date: "Mar 22", "Active Users": 3322, "Telemetry Packets": 2194 },
  { date: "Apr 22", "Active Users": 3470, "Telemetry Packets": 2108 },
  { date: "May 22", "Active Users": 3475, "Telemetry Packets": 1812 },
  { date: "Jun 22", "Active Users": 3129, "Telemetry Packets": 1726 },
];

const dataFormatter = (number: number) =>
  Intl.NumberFormat("us").format(number).toString();

export const Dashboard = ({ mode }: { mode: string }) => {
  const { isEditMode, toggleEditMode } = useDesigner();

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      <Group justify="space-between">
        <Stack gap={0}>
          <Title className="text-gradient">
            <EditableText initialValue="Global Command Center" size="xl" weight={900} />
          </Title>
          <Text size="xs" c="dimmed">Operational status for {mode} node</Text>
        </Stack>
        <Button 
          variant={isEditMode ? 'filled' : 'light'} 
          color={isEditMode ? 'green' : 'blue'}
          onClick={toggleEditMode}
          leftSection={<Settings2 size={16} />}
        >
          {isEditMode ? 'Exit Designer Mode' : 'Enter Designer Mode'}
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl">
        {[
          { icon: <Users size={14} color="#60cdff" />, label: 'Total Athletes', value: '1,042,981', badge: '+12.3%', color: 'blue', progress: 72, glow: 'glow-blue' },
          { icon: <Radio size={14} color="var(--mantine-primary-color-filled)" />, label: 'Active Telemetry', value: '241,082', badge: 'LIVE', color: 'lime', progress: 84, glow: 'glow-lime' },
          { icon: <ShieldCheck size={14} color="#ffcc00" />, label: 'Integrity Index', value: '98.4%', badge: 'SECURE', color: 'yellow', progress: 98, glow: '' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
          >
            <Box p="lg" className={`fluent-acrylic stat-card-premium ${stat.glow}`}>
              <Flex alignItems="start">
                <Stack gap={0}>
                  <Group gap="xs">
                    {stat.icon}
                    <Text size="xs" tt="uppercase" fw={700} c="dimmed">{stat.label}</Text>
                  </Group>
                  <Metric style={{ color: 'white', fontWeight: 900, letterSpacing: '-1px' }}>{stat.value}</Metric>
                </Stack>
                <Badge variant="light" color={stat.color} size="sm">{stat.badge}</Badge>
              </Flex>
              <ProgressBar value={stat.progress} color={stat.color} className="mt-4" />
            </Box>
          </motion.div>
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" style={{ flex: 1 }}>
        <WinWindow title={<Group gap="xs"><TrendingUp size={14} /><span>Engagement Metrics (Real-time)</span></Group>}>
          <AreaChart
            className="h-72 mt-4"
            data={chartdata}
            index="date"
            categories={["Active Users", "Telemetry Packets"]}
            colors={["blue", "cyan"]}
            valueFormatter={dataFormatter}
          />
        </WinWindow>

        <WinWindow title={<Group gap="xs"><ActivityIcon size={14} /><span>Anti-Cheat System Pulse</span></Group>}>
          <ScrollArea h={300}>
            <Stack gap="sm">
              {[...Array(8)].map((_, i) => (
                <Group key={i} justify="space-between" p="xs" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px' }} className="fluent-acrylic-hover">
                  <Stack gap={0}>
                    <Text size="sm" fw={700}>Node {String(i+1).padStart(2, '0')} Analysis</Text>
                    <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>SHA-256: {Math.random().toString(16).substring(2, 10).toUpperCase()}</Text>
                  </Stack>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">4ms</Text>
                    <Badge color="lime" variant="dot" size="sm">Active</Badge>
                  </Group>
                </Group>
              ))}
            </Stack>
          </ScrollArea>
        </WinWindow>
      </SimpleGrid>
    </Box>
  );
};
