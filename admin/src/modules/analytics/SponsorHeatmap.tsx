import React from 'react';
import { Card, Box, Badge, Text } from '@mantine/core';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { Map } from 'react-map-gl/maplibre';

export const SponsorHeatmap = () => {
  // Mocking sponsor-specific POI activity
  const data = [
    { COORDINATES: [22.2906, 52.1672], RADIUS: 100, INTENSITY: 0.8 },
    { COORDINATES: [22.2850, 52.1650], RADIUS: 80, INTENSITY: 0.5 },
    { COORDINATES: [22.2950, 52.1700], RADIUS: 120, INTENSITY: 0.9 },
  ];

  const layers = [
    new ScatterplotLayer({
      id: 'sponsor-poi-layer',
      data,
      getPosition: d => d.COORDINATES,
      getRadius: d => d.RADIUS,
      getFillColor: [139, 92, 246, 180], // Violet for Premium Sponsor
      stroked: true,
      lineWidthMinPixels: 2,
      getLineColor: [255, 255, 255],
    })
  ];

  return (
    <Card radius="xl" p={0} className="fluent-acrylic" style={{ height: '300px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
      <Box p="md" style={{ position: 'absolute', zIndex: 10 }}>
        <Badge color="violet" variant="filled">YOUR POI POPULARITY</Badge>
      </Box>
      <DeckGL
        initialViewState={{ longitude: 22.2906, latitude: 52.1672, zoom: 14, pitch: 45 }}
        controller={true}
        layers={layers}
      >
        <Map mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" />
      </DeckGL>
    </Card>
  );
};
