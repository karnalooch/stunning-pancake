import React from 'react';
import { Box, SimpleGrid, Text, Group, Stack, ScrollArea } from '@mantine/core';

// Lucide icons simulation (using text fallbacks for now, imagine these are Win11 icons)
const WinWindow = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Box className="fluent-acrylic" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
    {/* Fake Windows Title Bar */}
    <Group justify="space-between" px="md" py="xs" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', userSelect: 'none' }}>
      <Text size="sm" fw={500} style={{ fontFamily: 'var(--font-segoe)' }}>{title}</Text>
      <Group gap={8}>
        <Box w={12} h={2} bg="dimmed" style={{ cursor: 'pointer' }} />
        <Box w={10} h={10} style={{ border: '1px solid var(--mantine-color-dimmed)', cursor: 'pointer' }} />
        <Text size="sm" style={{ cursor: 'pointer' }}>✕</Text>
      </Group>
    </Group>
    {/* Content Area */}
    <Box p="md" style={{ flex: 1, overflow: 'auto' }}>
      {children}
    </Box>
  </Box>
);

export default function App() {
  const mode = import.meta.env.VITE_APP_MODE || 'DEVELOPMENT';
  
  return (
    <Box p="xl" h="100vh" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

      {/* Fake Windows 11 Taskbar */}
      <Box 
        className="fluent-acrylic" 
        style={{ 
          height: '48px', 
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '0 16px'
        }}
      >
        <Box w={24} h={24} bg="var(--color-win-accent-dark)" style={{ borderRadius: '4px' }} />
        <Box w={24} h={24} bg="rgba(255,255,255,0.1)" style={{ borderRadius: '4px' }} />
        <Box w={24} h={24} bg="rgba(255,255,255,0.1)" style={{ borderRadius: '4px' }} />
      </Box>
    </Box>
  );
}
