import React from 'react';
import { Box, SimpleGrid, Group, Stack, Text, ScrollArea } from '@mantine/core';
import { WinWindow } from '../../core/Layout';

export const Dashboard = ({ mode }: { mode: string }) => {
  return (
    <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl" style={{ flex: 1 }}>
      {/* Main Telemetry App Window */}
      <Box style={{ gridColumn: 'span 2' }}>
        <WinWindow title={`SPORT Telemetry Dashboard [${mode}] - System.exe`}>
          <Stack gap="lg">
            <Group grow align="flex-start">
              <Box p="md" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                 <Text c="dimmed" size="xs" tt="uppercase" fw={600}>Total Users</Text>
                 <Text size="xl" fw={600}>1,042,981</Text>
              </Box>
              <Box p="md" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                 <Text c="dimmed" size="xs" tt="uppercase" fw={600}>Active Sensors</Text>
                 <Text size="xl" fw={600} c="var(--color-win-accent-dark)">241,082</Text>
              </Box>
              <Box p="md" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                 <Text c="dimmed" size="xs" tt="uppercase" fw={600}>Ingestion Rate</Text>
                 <Text size="xl" fw={600}>34.2k/s</Text>
              </Box>
            </Group>

            {/* Map Placeholder */}
            <Box 
              h={300} 
              style={{ 
                borderRadius: '6px', 
                background: 'rgba(0,0,0,0.2)', 
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Text c="dimmed">Maps Module Loading...</Text>
            </Box>
          </Stack>
        </WinWindow>
      </Box>

      {/* Settings/Logs Window */}
      <Stack gap="xl">
        <WinWindow title="Security Policies">
          <Stack gap="sm">
            <Group justify="space-between">
              <Text size="sm">Anti-Cheat Layer 5</Text>
              <Text size="xs" c="green" fw={600}>Running</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm">Redis Streams Buffer</Text>
              <Text size="xs" c="green" fw={600}>Healthy</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm">TimescaleDB Load</Text>
              <Text size="xs" c="yellow" fw={600}>42%</Text>
            </Group>
          </Stack>
        </WinWindow>
        
        <Box style={{ flex: 1 }}>
          <WinWindow title="System Logs">
            <ScrollArea h={200}>
              {[...Array(15)].map((_, i) => (
                <Text key={i} size="xs" ff="monospace" c="dimmed" mb={4}>
                  [11:39:{40 + i}] batch_insert_complete: 50 records
                </Text>
              ))}
            </ScrollArea>
          </WinWindow>
        </Box>
      </Stack>
    </SimpleGrid>
  );
};
