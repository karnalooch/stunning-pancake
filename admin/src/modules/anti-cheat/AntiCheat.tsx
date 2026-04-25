import { Box, Group, Stack, Text, Badge, Switch, SimpleGrid, ScrollArea } from '@mantine/core';
import { WinWindow } from '../../core/Layout';
import { Shield, AlertTriangle, Cpu, Activity } from 'lucide-react';
import { AdaptiveIntegrity } from './AdaptiveIntegrity';

const ANOMALIES = [
  { id: 'AN-1042', user: 'athlete_72', type: 'Warp Speed', score: 0.94, time: '2 mins ago' },
  { id: 'AN-1043', user: 'cyclist_12', type: 'Teleportation', score: 0.88, time: '5 mins ago' },
  { id: 'AN-1044', user: 'runner_99', type: 'Biomechanical Anomaly', score: 0.72, time: '12 mins ago' },
];

export const AntiCheat = () => {
  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
        <WinWindow title="Anti-Cheat Command Center — Global Status">
          <Stack gap="lg">
            <Group justify="space-between" p="md" className="fluent-acrylic" style={{ borderRadius: '8px' }}>
              <Group>
                <Shield color="var(--color-win-accent-dark)" />
                <Stack gap={0}>
                  <Text size="sm" fw={700}>Kinematic Filter</Text>
                  <Text size="xs" c="dimmed">Layer 1: Velocity Bounds Check</Text>
                </Stack>
              </Group>
              <Switch defaultChecked color="green" />
            </Group>

            <Group justify="space-between" p="md" className="fluent-acrylic" style={{ borderRadius: '8px' }}>
              <Group>
                <Cpu color="var(--color-win-accent-dark)" />
                <Stack gap={0}>
                  <Text size="sm" fw={700}>BRouter Viterbi Matching</Text>
                  <Text size="xs" c="dimmed">Layer 2: Topological Path Validation</Text>
                </Stack>
              </Group>
              <Switch defaultChecked color="green" />
            </Group>

            <Group justify="space-between" p="md" className="fluent-acrylic" style={{ borderRadius: '8px' }}>
              <Group>
                <Activity color="var(--color-win-accent-dark)" />
                <Stack gap={0}>
                  <Text size="sm" fw={700}>ML Anomaly Detection</Text>
                  <Text size="xs" c="dimmed">Layer 3: Biomechanical Fingerprint</Text>
                </Stack>
              </Group>
              <Switch color="blue" />
            </Group>
          </Stack>
        </WinWindow>

        <WinWindow title="Real-time Anomaly Stream">
          <ScrollArea h={300}>
            <Stack gap="xs">
              {ANOMALIES.map((item) => (
                <Group 
                  key={item.id} 
                  p="xs" 
                  style={{ 
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: item.score > 0.9 ? 'rgba(255,0,0,0.05)' : 'transparent'
                  }}
                >
                  <AlertTriangle size={16} color={item.score > 0.9 ? '#ff4d4d' : '#ffcc00'} />
                  <Stack gap={0} style={{ flex: 1 }}>
                    <Text size="sm" fw={600}>{item.user} — {item.type}</Text>
                    <Text size="xs" c="dimmed">{item.time} | Global Score: {item.score}</Text>
                  </Stack>
                  <Badge size="xs" variant="filled" color={item.score > 0.9 ? 'red' : 'yellow'}>FLAGGED</Badge>
                </Group>
              ))}
            </Stack>
          </ScrollArea>
        </WinWindow>
      </SimpleGrid>

      <WinWindow title="Viterbi HMM Map Matching Visualization">
        <Box 
          h={400} 
          style={{ 
            background: 'rgba(0,0,0,0.3)', 
            borderRadius: '8px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            position: 'relative'
          }}
        >
          <Text size="xs" c="dimmed">Initializing Map Matching Engine (Siedlce-Centrum-2026.osm)...</Text>
          {/* Imagine deck.gl rendering here */}
          <Box 
            style={{ 
              position: 'absolute', 
              top: 20, 
              right: 20, 
              padding: '10px', 
              background: 'rgba(0,0,0,0.5)', 
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <Text size="xs" fw={800}>DECK.GL VIEWPORT</Text>
            <Text size="xs" c="dimmed">Points: 124,082 | Latency: 4ms</Text>
          </Box>
        </Box>
      </WinWindow>

      <WinWindow title="Adaptive Operations Control">
        <AdaptiveIntegrity />
      </WinWindow>
    </Box>
  );
};
