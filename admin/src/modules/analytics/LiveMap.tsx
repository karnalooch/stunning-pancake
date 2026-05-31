import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Text, Badge, Group, Skeleton, ActionIcon, Tooltip } from '@mantine/core';
import { Map, Activity, Layers } from 'lucide-react';
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
const MAX_MARKERS = 200;
const POLL_INTERVAL = 5000; // 5s – balance between responsiveness and performance

/** Lightweight inline SVG bike marker – no CSS animations, no backdrop-filter */
const BIKE_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="M5 18l2-6h4l4-6h3"/><path d="M15 12h2l2-2"/><path d="M11 12h4"/></svg>`;

function buildMarkerEl(name: string, speedMs: number): HTMLDivElement {
    const speedKmh = (speedMs * 3.6).toFixed(0);
    const el = document.createElement('div');
    el.className = 'live-bike-marker';
    el.innerHTML = `<div class="lbm-inner">
      <div class="lbm-badge">${name}&nbsp;<span class="lbm-speed">${speedKmh}km/h</span></div>
      <div class="lbm-icon">${BIKE_SVG}</div>
      <div class="lbm-arrow"></div>
    </div>`;
    return el;
}

export const LiveMap: React.FC = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
    const rafRef = useRef<number>(0);
    const latestPositions = useRef<UserPosition[]>([]);
    const heatmapDebounceRef = useRef<ReturnType<typeof setTimeout>>();

    const [onlineCount, setOnlineCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [mapReady, setMapReady] = useState(false);
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [heatmapLoading, setHeatmapLoading] = useState(false);
    const [cellCount, setCellCount] = useState(0);

    /** ---------- Marker sync (diff-based, no full clear) ---------- */
    const syncMarkers = useCallback(() => {
        const map = mapRef.current;
        if (!map || !mapReady) return;

        const newPositions = latestPositions.current;
        const currentMarkers = markersRef.current;
        const incomingIds = new Set<string>();

        // Cap to MAX_MARKERS to prevent DOM overload
        const capped = newPositions.slice(0, MAX_MARKERS);

        for (const pos of capped) {
            if (!pos.lat || !pos.lng) continue;
            incomingIds.add(pos.deviceId);

            const existing = currentMarkers.get(pos.deviceId);
            if (existing) {
                // Update position only – no DOM recreation
                existing.setLngLat([pos.lng, pos.lat]);
            } else {
                // Create new marker
                const el = buildMarkerEl(pos.name || `Rider ${pos.deviceId.slice(0,6)}`, pos.speed || 0);
                const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
                    .setLngLat([pos.lng, pos.lat])
                    .addTo(map);
                currentMarkers.set(pos.deviceId, marker);
            }
        }

        // Remove markers for riders that disappeared
        for (const [id, marker] of currentMarkers) {
            if (!incomingIds.has(id)) {
                marker.remove();
                currentMarkers.delete(id);
            }
        }
    }, [mapReady]);

    /** ---------- Fetch positions (lightweight, just stores raw data) ---------- */
    const fetchPositions = useCallback(async () => {
        try {
            const { data } = await apiClient.get('/activities/telemetry/live/');
            if (Array.isArray(data)) {
                latestPositions.current = data;
                setOnlineCount(data.length);

                // Batch marker updates via rAF – once per frame max
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                rafRef.current = requestAnimationFrame(syncMarkers);
            }
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [syncMarkers]);

    /** ---------- Heatmap (debounced + uses setData for updates) ---------- */
    const loadHeatmap = useCallback(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;
        if (heatmapDebounceRef.current) clearTimeout(heatmapDebounceRef.current);

        heatmapDebounceRef.current = setTimeout(async () => {
            const bounds = map.getBounds();
            const bbox = `${bounds.getWest().toFixed(4)},${bounds.getSouth().toFixed(4)},${bounds.getEast().toFixed(4)},${bounds.getNorth().toFixed(4)}`;
            const zoom = Math.round(map.getZoom());
            try {
                setHeatmapLoading(true);
                const { data } = await apiClient.get('/api/heatmap/', { params: { bbox, zoom } });
                const features = data?.features ?? [];
                setCellCount(features.length);

                const source = map.getSource('heatmap-cells') as maplibregl.GeoJSONSource | undefined;

                if (features.length === 0) {
                    if (source) source.setData({ type: 'FeatureCollection', features: [] });
                    return;
                }

                if (!source) {
                    map.addSource('heatmap-cells', { type: 'geojson', data: { type: 'FeatureCollection', features } });
                    map.addLayer({
                        id: 'heatmap-fill', type: 'fill', source: 'heatmap-cells',
                        paint: {
                            'fill-color': ['interpolate', ['linear'], ['get', 'weight'], 0, '#1a3a5c', 0.25, '#2d6a9f', 0.5, '#f59e0b', 0.75, '#ef4444', 1, '#dc2626'],
                            'fill-opacity': ['interpolate', ['linear'], ['get', 'weight'], 0, 0.12, 0.5, 0.4, 1, 0.6],
                        },
                    });
                    map.addLayer({
                        id: 'heatmap-outline', type: 'line', source: 'heatmap-cells',
                        paint: { 'line-color': 'rgba(255,255,255,0.06)', 'line-width': 0.5 },
                    });
                } else {
                    source.setData({ type: 'FeatureCollection', features });
                }
            } catch {
                setCellCount(0);
            } finally {
                setHeatmapLoading(false);
            }
        }, 300);
    }, []);

    /** ---------- Init map ---------- */
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
        map.on('load', () => { if (!cancelled) setMapReady(true); });
        mapRef.current = map;

        return () => {
            cancelled = true;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            markersRef.current.forEach((m) => m.remove());
            markersRef.current.clear();
            try { map.remove(); } catch {}
            mapRef.current = null;
        };
    }, []);

    /** ---------- Polling ---------- */
    useEffect(() => {
        fetchPositions();
        const interval = setInterval(fetchPositions, POLL_INTERVAL);
        return () => { clearInterval(interval); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [fetchPositions]);

    /** ---------- Heatmap toggle ---------- */
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (!showHeatmap) {
            try { if (map.getLayer('heatmap-fill')) map.removeLayer('heatmap-fill'); } catch {}
            try { if (map.getLayer('heatmap-outline')) map.removeLayer('heatmap-outline'); } catch {}
            try { if (map.getSource('heatmap-cells')) map.removeSource('heatmap-cells'); } catch {}
            setCellCount(0);
            return;
        }
        if (!map.isStyleLoaded()) return;
        loadHeatmap();
        map.on('moveend', loadHeatmap);
        return () => { map.off('moveend', loadHeatmap); };
    }, [showHeatmap, loadHeatmap]);

    return (
        <Box style={{ position: 'relative', width: '100%', height: '100%', minHeight: 450, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <style>{`
              .live-bike-marker { display:flex; flex-direction:column; align-items:center; transform:translate(-16px,-30px); pointer-events:none; }
              .lbm-inner { display:flex; flex-direction:column; align-items:center; }
              .lbm-badge { background:rgba(0,0,0,0.82); color:#e2e8f0; font-size:10px; font-weight:600; padding:2px 8px; border-radius:6px; white-space:nowrap; margin-bottom:2px; border:1px solid rgba(255,255,255,0.15); }
              .lbm-speed { color:#4ade80; }
              .lbm-icon { width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#06b6d4,#8b5cf6);display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.25); }
              .lbm-arrow { width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid rgba(255,255,255,0.7);margin-top:-1px; }
            `}</style>

            {/* Top bar */}
            <Group style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10 }} justify="space-between">
                <Group gap="xs">
                    <Badge variant="filled" color={onlineCount > 0 ? 'green' : 'gray'} radius="sm" size="md" leftSection={<Activity size={12} />}>
                        {onlineCount} online
                    </Badge>
                    {cellCount > 0 && showHeatmap && (
                        <Badge variant="light" color="orange" radius="sm" size="md">{cellCount.toLocaleString()} cells</Badge>
                    )}
                </Group>
                <Tooltip label="Toggle activity heatmap overlay">
                    <ActionIcon variant={showHeatmap ? 'filled' : 'light'} color={showHeatmap ? 'orange' : 'gray'} size="lg" radius="md"
                        onClick={() => setShowHeatmap(!showHeatmap)} loading={heatmapLoading}>
                        <Layers size={18} />
                    </ActionIcon>
                </Tooltip>
            </Group>

            {loading && <Skeleton height="100%" radius="md" style={{ position: 'absolute', inset: 0, zIndex: 5 }} />}
            <div ref={mapContainer} style={{ width: '100%', height: '100%', cursor: 'grab' }} />

            {!mapReady && !loading && (
                <Box style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#f8f9fa', borderRadius: 14, zIndex: 10 }}>
                    <Map size={48} style={{ color: 'var(--accent)', opacity: 0.4 }} />
                    <Skeleton width={200} height={8} radius="xl" />
                    <Text size="sm" c="dimmed">Loading map tiles...</Text>
                </Box>
            )}

            {showHeatmap && cellCount > 0 && (
                <Group gap="sm" justify="center" style={{ position: 'absolute', bottom: 10, left: 0, right: 0, zIndex: 10, pointerEvents: 'none' }}>
                    <Group gap={4} style={{ background: 'rgba(15,15,20,0.85)', backdropFilter: 'blur(6px)', borderRadius: 20, padding: '4px 14px', border: '1px solid rgba(255,255,255,0.1)' }}>
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
