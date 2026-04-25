import { Box, Group, Stack, Text, Badge, Switch, SimpleGrid, ScrollArea } from '@mantine/core';
import { WinWindow } from '../../core/Layout';
import { Shield, AlertTriangle, Cpu, Activity, Loader2 } from 'lucide-react';
import { AdaptiveIntegrity } from './AdaptiveIntegrity';
import { useQuery } from '@tanstack/react-query';
import { TelemetryApi } from '../../api/client';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

export const AntiCheat = () => {
  const { data: anomalies, isLoading } = useQuery({
    queryKey: ['anomalies'],
    queryFn: TelemetryApi.getAnomalies,
    refetchInterval: 5000 // Refetch every 5 seconds
  });

  // Example Deck.GL layers (Static mock for demonstration)
  const layers = [
    new ScatterplotLayer({
      id: 'scatter-layer',
      data: [{position: [22.29, 52.17], size: 100, color: [255, 0, 0]}],
      getPosition: d => d.position,
      getFillColor: d => d.color,
      getRadius: d => d.size,
    })
  ];

  const INITIAL_VIEW_STATE = {
    longitude: 22.29, // Siedlce
    latitude: 52.17,
    zoom: 13,
    pitch: 45,
    bearing: 0
  };

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
              {isLoading ? (
                <Group justify="center" p="xl"><Loader2 className="animate-spin" /></Group>
              ) : anomalies?.length === 0 ? (
                <Text size="sm" c="dimmed" p="md">No anomalies detected.</Text>
              ) : (
                anomalies?.map((item: any) => (
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
                ))
              )}
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
          <DeckGL
            initialViewState={INITIAL_VIEW_STATE}
            controller={true}
            layers={layers}
            style={{ position: 'absolute', top: '0px', left: '0px', width: '100%', height: '100%', borderRadius: '8px' }}
          >
            <Map mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" />
          </DeckGL>
          <Box 
            style={{ 
              position: 'absolute', 
              top: 20, 
              right: 20, 
              padding: '10px', 
              background: 'rgba(0,0,0,0.7)', 
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.2)',
              zIndex: 10
            }}
          >
            <Text size="xs" fw={800} c="white">DECK.GL VIEWPORT</Text>
            <Text size="xs" c="dimmed">Live BRouter Matrix</Text>
          </Box>
        </Box>
      </WinWindow>

      <WinWindow title="Adaptive Operations Control">
        <AdaptiveIntegrity />
      </WinWindow>
    </Box>
  );
};
