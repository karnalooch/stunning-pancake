import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Text, Badge, Group, Skeleton, ActionIcon, Tooltip, Switch } from '@mantine/core';
import { Bike, Map, MapPin, Activity, Layers } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiClient } from '../../api/client';

interface UserPosition {
    deviceId: string;
    name: string;
    type: string;
    lat: number;
    lng: number;
    speed: number;
    course: number;
    lastUpdate: string;
}

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const DEFAULT_CENTER: [number, number] = [19.1344, 51.9194];
const DEFAULT_ZOOM = 6;

/** Inline SVG for the cyclist bike marker with rotation */
const createBikeMarkerHTML = (name: string, speed: number, course: number) => {
    const speedKmh = (speed * 3.6).toFixed(0);
    return `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-16px, -36px);">
      <div style="
        background: rgba(10, 10, 15, 0.92);
        border: 1px solid rgba(255,255,255,0.25);
        border-radius: 8px;
        padding: 2px 8px;
        font-size: 10px;
        font-weight: 600;
        color: #e2e8f0;
        white-space: nowrap;
        margin-bottom: 3px;
        backdrop-filter: blur(6px);
        line-height: 1.4;
      ">
        <span style="color: #38bdf8;">${name}</span><br/>
        <span style="color: #4ade80;">⚡ ${speedKmh} km/h</span>
      </div>
      <div style="
        width: 36px; height: 36px;
        border-radius: 50%;
        background: conic-gradient(from ${course}deg, #06b6d4, #8b5cf6, #ec4899, #06b6d4);
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 0 20px rgba(6, 182, 212, 0.5), 0 0 40px rgba(139, 92, 246, 0.3);
        border: 2px solid rgba(255,255,255,0.3);
        animation: pulse 2s ease-in-out infinite;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));">
          <circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/>
          <path d="M5 18l2-6h4l4-6h3"/>
          <path d="M15 12h2l2-2"/>
          <path d="M11 12h4"/>
        </svg>
      </div>
      <div style="
        width: 0; height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 8px solid rgba(255,255,255,0.85);
        margin-top: -1px;
      "></div>
    </div>
    <style>
      @keyframes pulse {
        0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(6, 182, 212, 0.5); }
        50% { transform: scale(1.08); box-shadow: 0 0 35px rgba(139, 92, 246, 0.6); }
      }
    </style>`;
};

export const LiveMap: React.FC = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<maplibregl.Marker[]>([]);
    const [positions, setPositions] = useState<UserPosition[]>([]);
    const [loading, setLoading] = useState(true);
    const [mapReady, setMapReady] = useState(false);
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [heatmapLoading, setHeatmapLoading] = useState(false);
    const [cellCount, setCellCount] = useState(0);

    /** Clear all existing markers */
    const clearMarkers = useCallback(() => {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
    }, []);

    /** Fetch live positions */
    const fetchPositions = useCallback(async () => {
        try {
            const { data } = await apiClient.get('/activities/telemetry/live/');
            if (Array.isArray(data)) setPositions(data);
        } catch {
            // Silently fail on network errors
        } finally {
            setLoading(false);
        }
    }, []);

    /** Fetch heatmap data */
    const fetchHeatmap = useCallback(async () => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;

        const bounds = map.getBounds();
        const bbox = `${bounds.getWest().toFixed(4)},${bounds.getSouth().toFixed(4)},${bounds.getEast().toFixed(4)},${bounds.getNorth().toFixed(4)}`;
        const zoom = Math.round(map.getZoom());

        try {
            setHeatmapLoading(true);
            const { data } = await apiClient.get('/api/heatmap/', { params: { bbox, zoom } });
            const features = data?.features ?? [];
            setCellCount(features.length);

            // Remove old heatmap source/layer
            if (map.getLayer('heatmap-fill')) map.removeLayer('heatmap-fill');
            if (map.getLayer('heatmap-outline')) map.removeLayer('heatmap-outline');
            if (map.getSource('heatmap-cells')) map.removeSource('heatmap-cells');

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
                        0, 0.15, 0.5, 0.45, 1, 0.7,
                    ],
                },
            });

            map.addLayer({
                id: 'heatmap-outline',
                type: 'line',
                source: 'heatmap-cells',
                paint: { 'line-color': 'rgba(255,255,255,0.08)', 'line-width': 0.5 },
            });
        } catch {
            setCellCount(0);
        } finally {
            setHeatmapLoading(false);
        }
    }, []);

    /** Initialize map */
    useEffect(() => {
        let cancelled = false;
        if (!mapContainer.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainer.current,
            style: MAP_STYLE,
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            attributionControl: false,
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

        map.on('load', () => {
            if (!cancelled) setMapReady(true);
        });
        map.on('error', () => {
            if (!cancelled) {
                setLoading(false);
                setMapReady(false);
            }
        });

        mapRef.current = map;

        return () => {
            cancelled = true;
            try { map.remove(); } catch {}
            mapRef.current = null;
        };
    }, []);

    /** Update markers when positions change */
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady) return;

        clearMarkers();

        positions.forEach((pos) => {
            if (!pos.lat || !pos.lng) return;

            const el = document.createElement('div');
            el.innerHTML = createBikeMarkerHTML(pos.name || `Rider ${pos.deviceId}`, pos.speed || 0, pos.course || 0);

            const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([pos.lng, pos.lat])
                .addTo(map);

            markersRef.current.push(marker);
        });
    }, [positions, mapReady, clearMarkers]);

    /** Polling effect */
    useEffect(() => {
        fetchPositions();
        const interval = setInterval(fetchPositions, 3000);
        return () => clearInterval(interval);
    }, [fetchPositions]);

    /** Heatmap toggle effect */
    useEffect(() => {
        if (!showHeatmap) {
            const map = mapRef.current;
            if (map) {
                try { if (map.getLayer('heatmap-fill')) map.removeLayer('heatmap-fill'); } catch {}
                try { if (map.getLayer('heatmap-outline')) map.removeLayer('heatmap-outline'); } catch {}
                try { if (map.getSource('heatmap-cells')) map.removeSource('heatmap-cells'); } catch {}
            }
            setCellCount(0);
            return;
        }

        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;

        fetchHeatmap();
        map.on('moveend', fetchHeatmap);
        return () => { map.off('moveend', fetchHeatmap); };
    }, [showHeatmap, fetchHeatmap]);

    const onlineCount = positions.length;

    return (
        <Box style={{ position: 'relative', width: '100%', height: '100%', minHeight: 450, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {/* Top bar */}
            <Group
                style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10 }}
                justify="space-between"
            >
                <Group gap="xs">
                    <Badge
                        variant="filled"
                        color={onlineCount > 0 ? 'green' : 'gray'}
                        radius="sm"
                        size="md"
                        leftSection={<Activity size={12} />}
                    >
                        {onlineCount} online
                    </Badge>
                    {cellCount > 0 && showHeatmap && (
                        <Badge variant="light" color="orange" radius="sm" size="md">
                            {cellCount.toLocaleString()} cells
                        </Badge>
                    )}
                </Group>

                <Group gap="xs">
                    <Tooltip label="Toggle activity heatmap overlay">
                        <ActionIcon
                            variant={showHeatmap ? 'filled' : 'light'}
                            color={showHeatmap ? 'orange' : 'gray'}
                            size="lg"
                            radius="md"
                            onClick={() => setShowHeatmap(!showHeatmap)}
                            loading={heatmapLoading}
                        >
                            <Layers size={18} />
                        </ActionIcon>
                    </Tooltip>
                </Group>
            </Group>

            {/* Loading skeleton */}
            {loading && (
                <Skeleton height="100%" radius="md" style={{ position: 'absolute', inset: 0, zIndex: 5 }} />
            )}

            {/* Map container */}
            <div ref={mapContainer} style={{ width: '100%', height: '100%', cursor: 'grab' }} />

            {/* Map loading fallback */}
            {!mapReady && !loading && (
                <Box style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 12,
                    background: '#f8f9fa', borderRadius: 14, zIndex: 10,
                }}>
                    <Map size={48} style={{ color: 'var(--accent)', opacity: 0.4 }} />
                    <Skeleton width={200} height={8} radius="xl" />
                    <Text size="sm" c="dimmed">Loading map tiles...</Text>
                </Box>
            )}

            {/* Heatmap legend */}
            {showHeatmap && cellCount > 0 && (
                <Group gap="sm" justify="center" style={{
                    position: 'absolute', bottom: 10, left: 0, right: 0, zIndex: 10,
                    pointerEvents: 'none',
                }}>
                    <Group gap={4} style={{
                        background: 'rgba(15, 15, 20, 0.85)',
                        backdropFilter: 'blur(6px)',
                        borderRadius: 20,
                        padding: '4px 14px',
                        border: '1px solid rgba(255,255,255,0.1)',
                    }}>
                        <Group gap={4}><Box w={10} h={10} style={{ borderRadius: 2, background: '#1a3a5c' }} /><Text size="2xs" c="dimmed">Low</Text></Group>
                        <Group gap={4}><Box w={10} h={10} style={{ borderRadius: 2, background: '#2d6a9f' }} /><Text size="2xs" c="dimmed">Med</Text></Group>
                        <Group gap={4}><Box w={10} h={10} style={{ borderRadius: 2, background: '#f59e0b' }} /><Text size="2xs" c="dimmed">High</Text></Group>
                        <Group gap={4}><Box w={10} h={10} style={{ borderRadius: 2, background: '#ef4444' }} /><Text size="2xs" c="dimmed">Max</Text></Group>
                    </Group>
                </Group>
            )}
        </Box>
    );
};
