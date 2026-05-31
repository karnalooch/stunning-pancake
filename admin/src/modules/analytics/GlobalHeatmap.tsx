import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, SegmentedControl, Group, Skeleton, Alert, Badge } from '@mantine/core';
import { AlertCircle, Map } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiClient } from '../../api/client';

// Lazy-init maplibregl — flatten double/triple-wrapped CJS interop from Rollup/Vite
let _mlPromise: Promise<any> | null = null;
function loadMaplibregl(): Promise<any> {
    if (!_mlPromise) {
        _mlPromise = import('maplibre-gl').then((raw: any) => {
            let m: any = raw;
            while (m && m.default && typeof m.default === 'object' && !m.default.Map) {
                m = m.default;
            }
            if (m.default && m.default.Map) return m.default;
            if (m.Map) return m;
            return raw.default || raw;
        });
    }
    return _mlPromise;
}

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const DEFAULT_CENTER: [number, number] = [19.1344, 51.9194];
const DEFAULT_ZOOM = 5.5;

type ActivityType = 'ALL' | 'RUN' | 'BIKE' | 'WALK';

export const GlobalHeatmap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityType, setActivityType] = useState<ActivityType>('ALL');
  const [cellCount, setCellCount] = useState(0);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    loadMaplibregl().then((m: any) => {
      if (!mapContainer.current) return;

      const map = new m.Map({
        container: mapContainer.current,
        style: MAP_STYLE,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
      });
      map.addControl(new m.NavigationControl(), 'top-right');
      map.addControl(new m.AttributionControl({ compact: true }), 'bottom-right');
      map.on('load', () => setLoading(false));
      map.on('error', () => { setError('Failed to load map tiles.'); setLoading(false); });
      mapRef.current = map;
    }).catch(() => {
      setError('Failed to load map library.');
      setLoading(false);
    });

    return () => { if (mapRef.current) { try { mapRef.current.remove(); } catch {} } mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const fetchHeatmap = async () => {
      const bounds = map.getBounds();
      const bbox = `${bounds.getWest().toFixed(4)},${bounds.getSouth().toFixed(4)},${bounds.getEast().toFixed(4)},${bounds.getNorth().toFixed(4)}`;
      const zoom = Math.round(map.getZoom());

      try {
        const params: Record<string, string | number> = { bbox, zoom };
        if (activityType !== 'ALL') params.type = activityType;

        const { data } = await apiClient.get('/api/heatmap/', { params });
        const features = data?.features ?? [];
        setCellCount(features.length);

        if (map.getSource('heatmap-cells')) {
          if (map.getLayer('heatmap-fill')) map.removeLayer('heatmap-fill');
          if (map.getLayer('heatmap-outline')) map.removeLayer('heatmap-outline');
          map.removeSource('heatmap-cells');
        }

        if (features.length === 0) return;

        map.addSource('heatmap-cells', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features },
        });

        map.addLayer({
          id: 'heatmap-fill',
          type: 'fill',
          source: 'heatmap-cells',
          paint: {
            'fill-color': [
              'interpolate', ['linear'], ['get', 'weight'],
              0, '#1a3a5c', 0.25, '#2d6a9f', 0.5, '#f59e0b', 0.75, '#ef4444', 1, '#dc2626',
            ],
            'fill-opacity': [
              'interpolate', ['linear'], ['get', 'weight'],
              0, 0.2, 0.5, 0.55, 1, 0.85,
            ],
          },
        });

        map.addLayer({
          id: 'heatmap-outline',
          type: 'line',
          source: 'heatmap-cells',
          paint: { 'line-color': 'rgba(255,255,255,0.12)', 'line-width': 0.5 },
        });
      } catch (err) {
        console.warn('Heatmap data fetch failed:', err);
        setCellCount(0);
      }
    };

    fetchHeatmap();
    map.on('moveend', fetchHeatmap);
    return () => { map.off('moveend', fetchHeatmap); };
  }, [activityType]);

  if (error) {
    return (
      <Box p="md">
        <Alert color="red" icon={<AlertCircle size={18} />} title="Map Error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box p="md">
      <Group justify="space-between" mb="md">
        <Group>
          <Map size={20} style={{ color: 'var(--accent)' }} />
          <Text fw={700} size="lg">Activity Heatmaps</Text>
          {cellCount > 0 && <Badge variant="light" size="sm">{cellCount.toLocaleString()} cells</Badge>}
        </Group>
        <SegmentedControl
          size="xs"
          value={activityType}
          onChange={(v) => setActivityType(v as ActivityType)}
          data={[
            { value: 'ALL', label: 'All' },
            { value: 'RUN', label: 'Run' },
            { value: 'BIKE', label: 'Bike' },
            { value: 'WALK', label: 'Walk' },
          ]}
        />
      </Group>

      <Box style={{ position: 'relative', width: '100%', height: 'calc(100vh - 220px)', minHeight: 500, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', background: '#1a1b1e' }}>
        {loading && (
          <Box style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 10, background: '#1a1b1e' }}>
            <Map size={48} style={{ color: 'var(--accent)', opacity: 0.4 }} />
            <Skeleton width={200} height={8} radius="xl" />
            <Text size="sm" c="dimmed">Loading map tiles...</Text>
          </Box>
        )}
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      </Box>

      <Group mt="xs" gap="lg" justify="center">
        <Group gap={6}><Box w={12} h={12} style={{ borderRadius: 2, background: '#1a3a5c' }} /><Text size="xs" c="dimmed">Low</Text></Group>
        <Group gap={6}><Box w={12} h={12} style={{ borderRadius: 2, background: '#2d6a9f' }} /><Text size="xs" c="dimmed">Medium</Text></Group>
        <Group gap={6}><Box w={12} h={12} style={{ borderRadius: 2, background: '#f59e0b' }} /><Text size="xs" c="dimmed">High</Text></Group>
        <Group gap={6}><Box w={12} h={12} style={{ borderRadius: 2, background: '#ef4444' }} /><Text size="xs" c="dimmed">Very High</Text></Group>
      </Group>
    </Box>
  );
};
