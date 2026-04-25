import { Box, SimpleGrid, Group, Stack, Text, ScrollArea, Button, Badge } from '@mantine/core';
import { WinWindow } from '../../core/Layout';
import { AreaChart, Title, Metric, Flex, ProgressBar } from '@tremor/react';
import { useDesigner, EditableText } from '../../providers/DesignerProvider';
import { Settings2 } from 'lucide-react';

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
          <Title style={{ color: 'white' }}>
            <EditableText initialValue="Platform Overview" size="xl" weight={800} />
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
        <Box p="md" className="fluent-acrylic" style={{ borderRadius: '8px' }}>
          <Flex alignItems="start">
            <Stack gap={0}>
              <Text size="xs" tt="uppercase" fw={600} c="dimmed">Total Athletes</Text>
              <Metric style={{ color: 'white' }}>1,042,981</Metric>
            </Stack>
            <Badge color="green">+12.3%</Badge>
          </Flex>
          <ProgressBar value={72} color="blue" className="mt-3" />
        </Box>

        <Box p="md" className="fluent-acrylic" style={{ borderRadius: '8px' }}>
          <Stack gap={0}>
            <Text size="xs" tt="uppercase" fw={600} c="dimmed">Active telemetry Streams</Text>
            <Metric style={{ color: 'var(--color-win-accent-dark)' }}>241,082</Metric>
          </Stack>
          <ProgressBar value={84} color="emerald" className="mt-3" />
        </Box>

        <Box p="md" className="fluent-acrylic" style={{ borderRadius: '8px' }}>
          <Stack gap={0}>
            <Text size="xs" tt="uppercase" fw={600} c="dimmed">Global Trust Score</Text>
            <Metric style={{ color: 'white' }}>98.4%</Metric>
          </Stack>
          <ProgressBar value={98} color="amber" className="mt-3" />
        </Box>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" style={{ flex: 1 }}>
        <WinWindow title="Engagement Metrics (Real-time)">
          <AreaChart
            className="h-72 mt-4"
            data={chartdata}
            index="date"
            categories={["Active Users", "Telemetry Packets"]}
            colors={["blue", "cyan"]}
            valueFormatter={dataFormatter}
          />
        </WinWindow>

        <WinWindow title="Anti-Cheat System Pulse">
          <ScrollArea h={300}>
            <Stack gap="sm">
              {[...Array(8)].map((_, i) => (
                <Group key={i} justify="space-between" p="xs" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <Stack gap={0}>
                    <Text size="sm" fw={600}>Node {i+1} Verification</Text>
                    <Text size="xs" c="dimmed">Viterbi matching depth: 12ms</Text>
                  </Stack>
                  <Badge color="green" variant="dot">Healthy</Badge>
                </Group>
              ))}
            </Stack>
          </ScrollArea>
        </WinWindow>
      </SimpleGrid>
    </Box>
  );
};
