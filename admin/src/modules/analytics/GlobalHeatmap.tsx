import React from 'react';
import { Box, Card, Text, Group, Badge } from '@mantine/core';
import DeckGL from '@deck.gl/react';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { Map } from 'react-map-gl/maplibre';
import { Globe, Zap } from 'lucide-react';

const INITIAL_VIEW_STATE = {
  longitude: 19.1451,
  latitude: 51.9194,
  zoom: 5.5,
  pitch: 45,
  bearing: 0
};

export const GlobalHeatmap = () => {
  // Mocking high-density global activity data
  const data = Array.from({ length: 500 }).map(() => ({
    COORDINATES: [19.1 + Math.random() * 5, 51.9 + Math.random() * 2],
    WEIGHT: Math.random() * 10
  }));

  const layers = [
    new HeatmapLayer({
      id: 'heatmap-layer',
      data,
      getPosition: d => d.COORDINATES,
      getWeight: d => d.WEIGHT,
      radiusPixels: 40,
      intensity: 1,
      threshold: 0.05,
      colorRange: [
        [37, 99, 235], [16, 185, 129], [251, 191, 36], [220, 38, 38]
      ]
    })
  ];

  return (
    <Card p={0} radius="xl" className="fluent-acrylic" style={{ height: '600px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
      <Box p="lg" style={{ position: 'absolute', zIndex: 10, top: 0, left: 0 }}>
        <Group>
          <Box p="xs" bg="rgba(0,0,0,0.8)" style={{ borderRadius: '12px' }}>
             <Globe size={20} color="#2563EB" />
          </Box>
          <Box>
            <Text fw={900} size="lg" color="white">Global Activity Heatmap</Text>
            <Text size="xs" c="dimmed">Real-time telemetry across all 200+ instances</Text>
          </Box>
        </Group>
      </Box>

      <Box style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 10 }}>
        <Badge variant="filled" color="indigo" size="lg" leftSection={<Zap size={14} />}>
          LIVE SYNC ACTIVE
        </Badge>
      </Box>

      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
      >
        <Map
          mapStyle="https://tiles.openfreemap.org/styles/dark"
        />
      </DeckGL>
    </Card>
  );
};
