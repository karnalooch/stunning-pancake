import React from 'react';
import { Container, Paper, Title, Text, Stack, Group, SimpleGrid } from '@mantine/core';
import { Card, Metric, Text as TremorText } from '@tremor/react';

// Milestone 6.3: Live GIS Dashboard (New Era)
export const LiveGisDashboard: React.FC = () => {
  return (
    <Container fluid p="md">
      <Stack gap="xl">
        <Group justify="space-between">
          <Stack gap={0}>
            <Title order={1} fw={900} lts={-1.5}>Live GIS & City Interop</Title>
            <Text c="dimmed" fw={600}>OGC Features & Real-time Geospatial Distribution</Text>
          </Stack>
        </Group>

        <Paper radius="lg" withBorder h={600} style={{ background: '#0b0e14', position: 'relative', overflow: 'hidden' }}>
          {/* This would be the deck.gl Layer stack */}
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text c="dimmed" fw={700}>[deck.gl Layer Stack: HexagonLayer + TripsLayer]</Text>
          </div>
          
          <div style={{ position: 'absolute', top: 24, right: 24, width: 300 }}>
            <Card>
              <TremorText>Active Corridors</TremorText>
              <Metric>12</Metric>
              <Text size="xs" mt="sm">Dynamic geofencing active in Siedlce / Warszawa</Text>
            </Card>
          </div>
        </Paper>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
           <Card>
              <TremorText>OGC API Hits</TremorText>
              <Metric>4.5k/m</Metric>
           </Card>
           <Card>
              <TremorText>Moving Features</TremorText>
              <Metric>24,102</Metric>
           </Card>
           <Card>
              <TremorText>GIS Latency</TremorText>
              <Metric>12ms</Metric>
           </Card>
        </SimpleGrid>
      </Stack>
    </Container>
  );
};
