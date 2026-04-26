import React from 'react';
import { Card, Text, Group, Stack, SimpleGrid, Box, Badge } from '@mantine/core';
import { BarChart, DonutChart } from '@tremor/react';
import { MapPin, Zap, Ticket, Users } from 'lucide-react';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { Map } from 'react-map-gl/maplibre';

const VOUCHER_DATA = [
  { name: 'Eco Coffee', 'Redeemed': 452, 'Issued': 600 },
  { name: 'Sport Shop', 'Redeemed': 210, 'Issued': 500 },
  { name: 'Bike Service', 'Redeemed': 89, 'Issued': 150 },
];

export const CityAnalytics = ({ cityId }: { cityId: string }) => {
  // Local points of activity for the city
  const data = Array.from({ length: 100 }).map(() => ({
    COORDINATES: [22.29 + Math.random() * 0.02, 52.16 + Math.random() * 0.02],
    RADIUS: 50 + Math.random() * 100
  }));

  const layers = [
    new ScatterplotLayer({
      id: 'scatterplot-layer',
      data,
      getPosition: d => d.COORDINATES,
      getRadius: d => d.RADIUS,
      getFillColor: [37, 99, 235, 140],
      stroked: true,
      lineWidthMinPixels: 1,
      getLineColor: [255, 255, 255]
    })
  ];

  return (
    <Stack gap="xl">
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
        <Card radius="xl" p={0} className="fluent-acrylic" style={{ height: '400px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Box p="md" style={{ position: 'absolute', zIndex: 10 }}>
            <Badge color="blue" variant="filled">LIVE LOCAL HEATMAP</Badge>
          </Box>
          <DeckGL
            initialViewState={{ longitude: 22.2906, latitude: 52.1672, zoom: 13, pitch: 45 }}
            controller={true}
            layers={layers}
          >
            <Map mapStyle="https://tiles.openfreemap.org/styles/dark" />
          </DeckGL>
        </Card>

        <Card radius="xl" p="xl" className="fluent-acrylic" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          <Group mb="xl" justify="space-between">
            <Stack gap={0}>
              <Text fw={900} size="lg" color="white">Voucher Conversion</Text>
              <Text size="xs" c="dimmed">Redemption rate across local sponsors</Text>
            </Stack>
            <Ticket size={24} color="#2563EB" />
          </Group>
          <BarChart
            className="mt-6 h-60"
            data={VOUCHER_DATA}
            index="name"
            categories={["Redeemed", "Issued"]}
            colors={["blue", "gray"]}
            valueFormatter={(number) => `${number}`}
            yAxisWidth={48}
          />
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl">
         <Card radius="lg" p="md" bg="rgba(255,255,255,0.03)">
            <Group>
               <Users size={20} color="#2563EB" />
               <Box>
                  <Text size="xs" fw={700} c="dimmed">CITIZEN ADOPTION</Text>
                  <Text size="xl" fw={900}>64%</Text>
               </Box>
            </Group>
         </Card>
         <Card radius="lg" p="md" bg="rgba(255,255,255,0.03)">
            <Group>
               <Zap size={20} color="#FBBF24" />
               <Box>
                  <Text size="xs" fw={700} c="dimmed">CO2 REDUCED</Text>
                  <Text size="xl" fw={900}>1,242 kg</Text>
               </Box>
            </Group>
         </Card>
         <Card radius="lg" p="md" bg="rgba(255,255,255,0.03)">
            <Group>
               <MapPin size={20} color="#10B981" />
               <Box>
                  <Text size="xs" fw={700} c="dimmed">ACTIVE HOTSPOTS</Text>
                  <Text size="xl" fw={900}>14 Points</Text>
               </Box>
            </Group>
         </Card>
      </SimpleGrid>
    </Stack>
  );
};
