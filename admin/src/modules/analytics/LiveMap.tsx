import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Text, Badge, Group, Skeleton, ActionIcon, Tooltip, Button } from '@mantine/core';
import { Map as MapIcon, Activity, Layers, Zap } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiClient, TelemetryApi } from '../../api/client';
import { hasStoredSession } from '../../core/auth/tokens';
import { useAuth } from '../../core/auth/useAuth';
import { notifications } from '@mantine/notifications';
import {
    createLiveUserMarkerElement,
    updateLiveUserMarkerElement,
    animateMarkerTo,
    resolveActivityKind,
    type LiveMapPosition,
} from './liveMapMarkers';

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

type UserPosition = LiveMapPosition;

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const DEFAULT_CENTER: [number, number] = [19.1344, 51.9194];
const DEFAULT_ZOOM = 6;
const POLL_INTERVAL_MS = 2500;
const MOVE_DEBOUNCE_MS = 400;
const DETAIL_ZOOM_THRESHOLD = 11;
const DETAIL_MARKER_CAP = 120;
const FETCH_LIMIT = 500;

function bboxFromMap(map: any): string {
    const bounds = map.getBounds();
    return `${bounds.getWest().toFixed(4)},${bounds.getSouth().toFixed(4)},${bounds.getEast().toFixed(4)},${bounds.getNorth().toFixed(4)}`;
}

export const LiveMap: React.FC = () => {
    const { token, isAuthenticated } = useAuth();
    const canFetch = Boolean(token || hasStoredSession());
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const mlRef = useRef<any>(null);
    const detailMarkersRef = useRef<Map<string, any>>(new Map());
    const positionsRef = useRef<UserPosition[]>([]);
    const heatmapDebounceRef = useRef<ReturnType<typeof setTimeout>>();
    const moveDebounceRef = useRef<ReturnType<typeof setTimeout>>();
    const abortRef = useRef<AbortController | null>(null);
    const fetchInFlightRef = useRef(false);
    const tabVisibleRef = useRef(typeof document === 'undefined' || !document.hidden);

    const [onlineCount, setOnlineCount] = useState(0);
    const [cyclists, setCyclists] = useState(0);
    const [runners, setRunners] = useState(0);
    const [loading, setLoading] = useState(true);
    const [mapReady, setMapReady] = useState(false);
    const [mlReady, setMlReady] = useState(false);
    const [tabVisible, setTabVisible] = useState(tabVisibleRef.current);
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [heatmapLoading, setHeatmapLoading] = useState(false);
    const [cellCount, setCellCount] = useState(0);
    const [launching, setLaunching] = useState(false);
    const [lastRefreshMs, setLastRefreshMs] = useState<number | null>(null);

    const getMl = () => mlRef.current;

    const ensureLiveSource = useCallback((map: any) => {
        if (map.getSource('live-positions')) return;
        map.addSource('live-positions', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 50,
        });
        map.addLayer({
            id: 'live-clusters',
            type: 'circle',
            source: 'live-positions',
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': ['step', ['get', 'point_count'], '#06b6d4', 10, '#8b5cf6', 30, '#ec4899'],
                'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 30, 40],
                'circle-opacity': 0.85,
                'circle-stroke-width': 2,
                'circle-stroke-color': 'rgba(255,255,255,0.4)',
            },
        });
        try {
            if (map.getLayer('live-dots')) map.removeLayer('live-dots');
        } catch { /* legacy */ }
    }, []);

    const updateLiveSource = useCallback((positions: UserPosition[]) => {
        const map = mapRef.current;
        if (!map || !mapReady) return;
        ensureLiveSource(map);
        const features = positions.map((pos) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [pos.lng, pos.lat] },
            properties: {
                deviceId: pos.deviceId,
                name: pos.name,
                type: pos.type,
                speed: pos.speed,
                course: pos.course,
            },
        }));
        const source = map.getSource('live-positions');
        if (source?.setData) source.setData({ type: 'FeatureCollection', features });
    }, [mapReady, ensureLiveSource]);

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
        const cap = Math.min(DETAIL_MARKER_CAP, positionsRef.current.length);
        const seen = new Set<string>();
        for (const pos of positionsRef.current.slice(0, cap)) {
            if (!pos.deviceId || !pos.lat || !pos.lng) continue;
            seen.add(pos.deviceId);
            const target: [number, number] = [pos.lng, pos.lat];
            const existing = detailMarkersRef.current.get(pos.deviceId);
            if (existing) {
                animateMarkerTo(existing, target);
                updateLiveUserMarkerElement(existing.getElement() as HTMLDivElement, pos);
                continue;
            }
            const el = createLiveUserMarkerElement(pos);
            const marker = new ml.Marker({ element: el, anchor: 'bottom' })
                .setLngLat(target)
                .addTo(map);
            detailMarkersRef.current.set(pos.deviceId, marker);
        }
        for (const [id, marker] of detailMarkersRef.current) {
            if (!seen.has(id)) {
                (marker as any).remove();
                detailMarkersRef.current.delete(id);
            }
        }
    }, []);

    const applyMetaCounts = useCallback((list: UserPosition[], meta: Record<string, unknown> | null | undefined) => {
        const riding =
            typeof meta?.active_riding === 'number'
                ? meta.active_riding
                : typeof meta?.redis_active === 'number'
                    ? meta.redis_active
                    : list.length;
        setOnlineCount((prev) => (riding !== prev ? riding : prev));

        const bikeMeta = meta?.viewport_bike;
        const runMeta = meta?.viewport_run;
        if (typeof bikeMeta === 'number' && typeof runMeta === 'number') {
            setCyclists((prev) => (bikeMeta !== prev ? bikeMeta : prev));
            setRunners((prev) => (runMeta !== prev ? runMeta : prev));
            return;
        }
        let bike = 0;
        let run = 0;
        for (const p of list) {
            const k = resolveActivityKind(p.type);
            if (k === 'bike') bike += 1;
            else run += 1;
        }
        setCyclists((prev) => (bike !== prev ? bike : prev));
        setRunners((prev) => (run !== prev ? run : prev));
    }, []);

    const fetchPositions = useCallback(async () => {
        if (!canFetch || !tabVisibleRef.current || fetchInFlightRef.current) return;
        fetchInFlightRef.current = true;
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;
        const t0 = performance.now();
        try {
            const map = mapRef.current;
            const params: Record<string, string | number> = { limit: FETCH_LIMIT };
            if (map) params.bbox = bboxFromMap(map);

            const data = await TelemetryApi.getLivePositions(params, { signal: ac.signal });
            if (ac.signal.aborted) return;

            const list = data?.positions ?? [];
            const meta = data?.meta;
            if (Array.isArray(list)) {
                positionsRef.current = list;
                applyMetaCounts(list, meta);
                updateLiveSource(list);
                requestAnimationFrame(syncDetailMarkers);
            }
            setLastRefreshMs(Math.round(performance.now() - t0));
        } catch (err: unknown) {
            if (ac.signal.aborted) return;
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status !== 401 && status !== 403) { /* silent poll */ }
        } finally {
            fetchInFlightRef.current = false;
            setLoading(false);
        }
    }, [updateLiveSource, syncDetailMarkers, canFetch, applyMetaCounts]);

    const fetchPositionsRef = useRef(fetchPositions);
    fetchPositionsRef.current = fetchPositions;

    const scheduleMoveFetch = useCallback(() => {
        if (moveDebounceRef.current) clearTimeout(moveDebounceRef.current);
        moveDebounceRef.current = setTimeout(() => {
            fetchPositionsRef.current();
        }, MOVE_DEBOUNCE_MS);
    }, []);

    const handleQuickLaunch = useCallback(async () => {
        setLaunching(true);
        try {
            await apiClient.post('/activities/admin/live-simulate/', {
                pool_pct: 1.0,
                active_ratio: 0.3,
                cheat_ratio: 0.05,
                tick_seconds: 8,
            });
            notifications.show({
                title: 'Live Simulation Started',
                message: 'Cyclists are now riding on the map',
                color: 'teal',
            });
        } catch (err: any) {
            if (err?.response?.status === 400) {
                notifications.show({
                    title: 'No athletes',
                    message: 'Go to Simulator to generate cyclists first.',
                    color: 'orange',
                });
            } else {
                notifications.show({
                    title: 'Launch failed',
                    message: err?.message || 'Unknown error',
                    color: 'red',
                });
            }
        } finally {
            setLaunching(false);
            fetchPositions();
        }
    }, [fetchPositions]);

    const loadHeatmap = useCallback(() => {
        const map = mapRef.current;
        if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;
        if (heatmapDebounceRef.current) clearTimeout(heatmapDebounceRef.current);
        heatmapDebounceRef.current = setTimeout(async () => {
            const bbox = bboxFromMap(map);
            try {
                setHeatmapLoading(true);
                const { data } = await apiClient.get('/api/heatmap/', {
                    params: { bbox, zoom: Math.round(map.getZoom()) },
                });
                const features = data?.features ?? [];
                setCellCount(features.length);
                const source = map.getSource('heatmap-cells');
                if (!source && features.length > 0) {
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
                                0, 0.12, 0.5, 0.4, 1, 0.6,
                            ],
                        },
                    });
                    map.addLayer({
                        id: 'heatmap-outline',
                        type: 'line',
                        source: 'heatmap-cells',
                        paint: { 'line-color': 'rgba(255,255,255,0.06)', 'line-width': 0.5 },
                    });
                } else if (source?.setData) {
                    source.setData({ type: 'FeatureCollection', features });
                }
            } catch {
                setCellCount(0);
            } finally {
                setHeatmapLoading(false);
            }
        }, 300);
    }, []);

    useEffect(() => {
        const onVis = () => {
            const vis = !document.hidden;
            tabVisibleRef.current = vis;
            setTabVisible(vis);
            if (vis) fetchPositionsRef.current();
        };
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, []);

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
            map.on('load', () => {
                if (!cancelled) {
                    ensureLiveSource(map);
                    setMapReady(true);
                }
            });
            map.on('zoom', syncDetailMarkers);
            map.on('moveend', scheduleMoveFetch);
            mapRef.current = map;
        }).catch(() => {
            if (!cancelled) {
                setLoading(false);
                setMapReady(false);
            }
        });

        return () => {
            cancelled = true;
            detailMarkersRef.current.forEach((m: any) => m.remove());
            detailMarkersRef.current.clear();
            if (mapRef.current) {
                try {
                    mapRef.current.off('moveend', scheduleMoveFetch);
                    mapRef.current.remove();
                } catch { /* */ }
            }
            mapRef.current = null;
        };
    }, [ensureLiveSource, syncDetailMarkers, scheduleMoveFetch]);

    useEffect(() => {
        if (!mlReady || !canFetch || !tabVisible) return;
        fetchPositions();
        const interval = setInterval(() => fetchPositionsRef.current(), POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [fetchPositions, mlReady, canFetch, isAuthenticated, tabVisible]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (!showHeatmap) {
            try { if (map.getLayer('heatmap-fill')) map.removeLayer('heatmap-fill'); } catch { /* */ }
            try { if (map.getLayer('heatmap-outline')) map.removeLayer('heatmap-outline'); } catch { /* */ }
            try { if (map.getSource('heatmap-cells')) map.removeSource('heatmap-cells'); } catch { /* */ }
            setCellCount(0);
            return;
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
                        {onlineCount.toLocaleString()} active
                    </Badge>
                    {cyclists > 0 && (
                        <Badge variant="light" color="violet" radius="sm" size="md">{cyclists} cyclists</Badge>
                    )}
                    {runners > 0 && (
                        <Badge variant="light" color="teal" radius="sm" size="md">{runners} runners</Badge>
                    )}
                    {lastRefreshMs != null && onlineCount > 0 && (
                        <Badge variant="outline" color="gray" radius="sm" size="sm">{lastRefreshMs}ms</Badge>
                    )}
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
