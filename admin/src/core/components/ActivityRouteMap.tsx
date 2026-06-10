import React, { useEffect, useRef } from 'react';
import { Box, Skeleton, Text } from '@mantine/core';
import 'maplibre-gl/dist/maplibre-gl.css';
import { loadMaplibregl } from '../map/loadMaplibre';
import {
  MAP_ATTRIBUTION_CONTROL_OPTIONS,
  resolveMapStyleUrl,
  transformMapGlyphsStyle,
} from '../map/mapBasemap';

interface ActivityRouteMapProps {
  routeCoords: Array<[number, number]>;
  verified: boolean;
  height?: number;
}

const ROUTE_SOURCE = 'activity-route';
const ROUTE_LAYER = 'activity-route-line';

export const ActivityRouteMap: React.FC<ActivityRouteMapProps> = ({
  routeCoords,
  verified,
  height = 300,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || routeCoords.length < 2) return;

    let cancelled = false;

    loadMaplibregl().then((ml) => {
      if (cancelled || !containerRef.current) return;

      const lineCoords = routeCoords.map(([lon, lat]) => [lon, lat]);
      const lngs = lineCoords.map((c) => c[0]);
      const lats = lineCoords.map((c) => c[1]);
      const center: [number, number] = [
        (Math.min(...lngs) + Math.max(...lngs)) / 2,
        (Math.min(...lats) + Math.max(...lats)) / 2,
      ];

      const map = new ml.Map({
        container: containerRef.current,
        style: resolveMapStyleUrl('dark'),
        transformStyle: transformMapGlyphsStyle,
        center,
        zoom: 12,
        attributionControl: false,
      });
      map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new ml.AttributionControl(MAP_ATTRIBUTION_CONTROL_OPTIONS), 'bottom-right');

      map.on('load', () => {
        map.addSource(ROUTE_SOURCE, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: lineCoords },
          },
        });
        map.addLayer({
          id: ROUTE_LAYER,
          type: 'line',
          source: ROUTE_SOURCE,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': verified ? '#22d3ee' : '#f97316',
            'line-width': 4,
            'line-opacity': 0.92,
          },
        });

        const bounds = lineCoords.reduce(
          (b, coord) => b.extend(coord as [number, number]),
          new ml.LngLatBounds(lineCoords[0], lineCoords[0]),
        );
        map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
      });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [routeCoords, verified]);

  if (routeCoords.length < 2) {
    return (
      <Box
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface-secondary)',
          borderRadius: 12,
        }}
      >
        <Text c="dimmed" size="sm">Not enough route points to render map</Text>
      </Box>
    );
  }

  return (
    <Box style={{ position: 'relative', height, borderRadius: 12, overflow: 'hidden' }}>
      <Box ref={containerRef} style={{ width: '100%', height: '100%' }} data-testid="activity-route-map" />
      <Skeleton
        visible={false}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />
    </Box>
  );
};
