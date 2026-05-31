import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Text, Badge, Group, Skeleton, ActionIcon, Tooltip, Button } from '@mantine/core';
import { Map as MapIcon, Activity, Layers, Zap } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiClient } from '../../api/client';
import { notifications } from '@mantine/notifications';

// Lazy-init maplibregl — flatten double/triple-wrapped CJS interop from Rollup/Vite
let _mlPromise: Promise<any> | null = null;
function loadMaplibregl(): Promise<any> {
    if (!_mlPromise) {
        _mlPromise = import('maplibre-gl').then((raw: any) => {
            // Rollup/Vite sometimes wraps CJS exports through multiple .default layers.
            // Keep unwrapping until we find an object that has a 'Map' constructor.
            let m: any = raw;
            while (m && m.default && typeof m.default === 'object' && !m.default.Map) {
                m = m.default;
            }
            // Prefer the innermost .default if it has Map, otherwise return the whole namespace
            if (m.default && m.default.Map) return m.default;
            if (m.Map) return m;
            // Last resort: try the original raw module
            return raw.default || raw;
        });
    }
    return _mlPromise;
}

interface UserPosition {
    deviceId: string; name: string; type: string;
    lat: number; lng: number; speed: number; course: number; lastUpdate: string;
}

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const DEFAULT_CENTER: [number, number] = [19.1344, 51.9194];
const DEFAULT_ZOOM = 6;
const POLL_INTERVAL = 5000;
const DETAIL_ZOOM_THRESHOLD = 11;

export const LiveMap: React.FC = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const mlRef = useRef<any>(null);
    const detailMarkersRef = useRef<Map<string, any>>(new Map());
    const heatmapDebounceRef = useRef<ReturnType<typeof setTimeout>>();

    const [onlineCount, setOnlineCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [mapReady, setMapReady] = useState(false);
    const [mlReady, setMlReady] = useState(false);
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [heatmapLoading, setHeatmapLoading] = useState(false);
    const [cellCount, setCellCount] = useState(0);
    const [launching, setLaunching] = useState(false);

    const getMl = () => mlRef.current;

    /* ---------- helpers (use mlRef) ---------- */

    /* ---------- WebGL source ---------- */
    const ensureLiveSource = useCallback((map: any) => {
        if (map.getSource('live-positions')) return;
        map.addSource('live-positions', {
            type: 'geojson', data: { type: 'FeatureCollection', features: [] },
            cluster: true, clusterMaxZoom: 14, clusterRadius: 50,
        });
        map.addLayer({ id: 'live-clusters', type: 'circle', source: 'live-positions',
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': ['step', ['get', 'point_count'], '#06b6d4', 10, '#8b5cf6', 30, '#ec4899'],
                'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 30, 40],
                'circle-opacity': 0.85, 'circle-stroke-width': 2, 'circle-stroke-color': 'rgba(255,255,255,0.4)',
            },
        });
        map.addLayer({ id: 'live-cluster-count', type: 'symbol', source: 'live-positions',
            filter: ['has', 'point_count'],
            layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12, 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'] },
            paint: { 'text-color': '#fff' },
        });
        map.addLayer({ id: 'live-dots', type: 'circle', source: 'live-positions',
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-color': ['match', ['get', 'type'], 'BIKE', '#06b6d4', 'RUN', '#f59e0b', '#8b5cf6'],
                'circle-radius': 6, 'circle-opacity': 0.8, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff',
            },
        });
    }, []);

    const updateLiveSource = useCallback((positions: UserPosition[]) => {
        const map = mapRef.current;
        if (!map || !mapReady) return;
        ensureLiveSource(map);
        const features = positions.slice(0, 500).map((pos) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [pos.lng, pos.lat] },
            properties: { deviceId: pos.deviceId, name: pos.name, type: pos.type, speed: pos.speed, course: pos.course },
        }));
        const source = map.getSource('live-positions');
        if (source?.setData) source.setData({ type: 'FeatureCollection', features });
    }, [mapReady, ensureLiveSource]);

    /* ---------- Detail markers (high zoom) ---------- */
    const syncDetailMarkers = useCallback(() => {
        const map = mapRef.current;
        const ml = getMl();
        if (!map || !ml) return;
        const zoom = map.getZoom();
        if (zoom < DETAIL_ZOOM_THRESHOLD) {
            detailMarkersRef.current.forEach((m) => m.remove());
            detailMarkersRef.current.clear();
            return;
        }
        // small bike markers via Marker API
        try {
            const features = map.querySourceFeatures('live-positions', { filter: ['!', ['has', 'point_count']] });
            const seen = new Set<string>();
            for (const feat of features.slice(0, 50)) {
                const props = feat.properties ?? {};
                const id = props.deviceId;
                if (!id) continue;
                seen.add(id);
                if (detailMarkersRef.current.has(id)) continue;
                const [lng, lat] = (feat.geometry as any).coordinates;
                const el = document.createElement('div');
                el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-10px,-22px)"><div style="background:rgba(0,0,0,0.78);color:#e2e8f0;font-size:9px;font-weight:600;padding:1px 6px;border-radius:4px;white-space:nowrap;margin-bottom:2px;border:1px solid rgba(255,255,255,0.12)">${props.name||'Rider'}&nbsp;<span style="color:#4ade80">${((props.speed||0)*3.6).toFixed(0)}</span></div><div style="width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#06b6d4,#8b5cf6);border:2px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="M5 18l2-6h4l4-6h3"/><path d="M15 12h2l2-2"/></svg></div></div>`;
                const marker = new ml.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map);
                detailMarkersRef.current.set(id, marker);
            }
            for (const [id, marker] of detailMarkersRef.current) {
                if (!seen.has(id)) { (marker as any).remove(); detailMarkersRef.current.delete(id); }
            }
        } catch {}
    }, []);

    /* ---------- Fetch ---------- */
    const fetchPositions = useCallback(async () => {
        try {
            const map = mapRef.current;
            let params: Record<string, string> | undefined;
            if (map) {
                const bounds = map.getBounds();
                params = { bbox: `${bounds.getWest().toFixed(4)},${bounds.getSouth().toFixed(4)},${bounds.getEast().toFixed(4)},${bounds.getNorth().toFixed(4)}` };
            }
            const { data } = await apiClient.get('/activities/telemetry/live/', { params });
            if (Array.isArray(data)) {
                setOnlineCount(data.length);
                updateLiveSource(data);
                requestAnimationFrame(syncDetailMarkers);
            }
        } catch {} finally { setLoading(false); }
    }, [updateLiveSource, syncDetailMarkers]);

    const handleQuickLaunch = useCallback(async () => {
        setLaunching(true);
        try {
            await apiClient.post('/activities/admin/live-simulate/', { pool_pct: 1.0, active_ratio: 0.3, cheat_ratio: 0.05, tick_seconds: 8 });
            notifications.show({ title: 'Live Simulation Started', message: 'Cyclists are now riding on the map', color: 'teal' });
        } catch (err: any) {
            if (err?.response?.status === 400) {
                notifications.show({ title: 'No athletes', message: 'Go to Simulator to generate cyclists first.', color: 'orange' });
            } else {
                notifications.show({ title: 'Launch failed', message: err?.message || 'Unknown error', color: 'red' });
            }
        } finally { setLaunching(false); fetchPositions(); }
    }, [fetchPositions]);

    /* ---------- Heatmap ---------- */
    const loadHeatmap = useCallback(() => {
        const map = mapRef.current;
        if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;
        if (heatmapDebounceRef.current) clearTimeout(heatmapDebounceRef.current);
        heatmapDebounceRef.current = setTimeout(async () => {
            const bounds = map.getBounds();
            const bbox = `${bounds.getWest().toFixed(4)},${bounds.getSouth().toFixed(4)},${bounds.getEast().toFixed(4)},${bounds.getNorth().toFixed(4)}`;
            try {
                setHeatmapLoading(true);
                const { data } = await apiClient.get('/api/heatmap/', { params: { bbox, zoom: Math.round(map.getZoom()) } });
                const features = data?.features ?? [];
                setCellCount(features.length);
                const source = map.getSource('heatmap-cells');
                if (!source && features.length > 0) {
                    map.addSource('heatmap-cells', { type: 'geojson', data: { type: 'FeatureCollection', features } });
                    map.addLayer({ id: 'heatmap-fill', type: 'fill', source: 'heatmap-cells',
                        paint: { 'fill-color': ['interpolate',['linear'],['get','weight'],0,'#1a3a5c',0.25,'#2d6a9f',0.5,'#f59e0b',0.75,'#ef4444',1,'#dc2626'],
                                 'fill-opacity': ['interpolate',['linear'],['get','weight'],0,0.12,0.5,0.4,1,0.6] },
                    });
                    map.addLayer({ id: 'heatmap-outline', type: 'line', source: 'heatmap-cells',
                        paint: { 'line-color': 'rgba(255,255,255,0.06)', 'line-width': 0.5 },
                    });
                } else if (source?.setData) {
                    source.setData({ type: 'FeatureCollection', features });
                }
            } catch { setCellCount(0); } finally { setHeatmapLoading(false); }
        }, 300);
    }, []);

    /* ---------- Init: lazy-load maplibregl via dynamic import ---------- */
    useEffect(() => {
        let cancelled = false;
        if (!mapContainer.current || mapRef.current) return;

        loadMaplibregl().then((m: any) => {
            if (cancelled || !mapContainer.current) return;
            mlRef.current = m;
            setMlReady(true);

            const map = new m.Map({
                container: mapContainer.current,
                style: MAP_STYLE,
                center: DEFAULT_CENTER,
                zoom: DEFAULT_ZOOM,
                attributionControl: false,
            });
            map.addControl(new m.NavigationControl(), 'top-right');
            map.addControl(new m.AttributionControl({ compact: true }), 'bottom-right');
            map.on('load', () => { if (!cancelled) { ensureLiveSource(map); setMapReady(true); } });
            map.on('zoom', syncDetailMarkers);
            mapRef.current = map;
        }).catch(() => {
            if (!cancelled) { setLoading(false); setMapReady(false); }
        });

        return () => {
            cancelled = true;
            detailMarkersRef.current.forEach((m: any) => m.remove());
            detailMarkersRef.current.clear();
            if (mapRef.current) { try { mapRef.current.remove(); } catch {} }
            mapRef.current = null;
        };
    }, [ensureLiveSource, syncDetailMarkers]);

    /* ---------- Polling ---------- */
    useEffect(() => {
        if (!mlReady) return;
        fetchPositions();
        const interval = setInterval(fetchPositions, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchPositions, mlReady]);

    /* ---------- Heatmap toggle ---------- */
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (!showHeatmap) {
            try { if (map.getLayer('heatmap-fill')) map.removeLayer('heatmap-fill'); } catch {}
            try { if (map.getLayer('heatmap-outline')) map.removeLayer('heatmap-outline'); } catch {}
            try { if (map.getSource('heatmap-cells')) map.removeSource('heatmap-cells'); } catch {}
            setCellCount(0); return;
        }
        if (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) loadHeatmap();
        map.on('moveend', loadHeatmap);
        return () => { map.off('moveend', loadHeatmap); };
    }, [showHeatmap, loadHeatmap]);

    return (
        <Box style={{ position: 'relative', width: '100%', height: '100%', minHeight: 450, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <Group style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10 }} justify="space-between">
                <Group gap="xs">
                    <Badge variant="filled" color={onlineCount > 0 ? 'green' : 'gray'} radius="sm" size="md" leftSection={<Activity size={12} />}>
                        {onlineCount} online
                    </Badge>
                    {onlineCount === 0 && !loading && mapReady && (
                        <Button size="xs" color="teal" leftSection={<Zap size={14} />} loading={launching} onClick={handleQuickLaunch}>
                            Quick Launch
                        </Button>
                    )}
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
                    <MapIcon size={48} style={{ color: 'var(--accent)', opacity: 0.4 }} />
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
