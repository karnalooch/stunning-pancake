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
    createCityHubMarkerElement,
    updateCityHubMarkerElement,
    animateMarkerTo,
    resolveActivityKind,
    type LiveMapPosition,
} from './liveMapMarkers';
import {
    POLAND_SIM_CITIES,
    polandCitiesBounds,
    nearestCitySlug,
} from './liveMapCities';

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
const POLL_BASE_MS = 2200;
const MOVE_DEBOUNCE_MS = 280;
const OVERVIEW_ZOOM_THRESHOLD = 9;
const DETAIL_ZOOM_THRESHOLD = 11;
const CLUSTER_MAX_ZOOM = 10;

/** API fetch cap scales with zoom — country overview vs street detail. */
function limitForZoom(zoom: number): number {
    if (zoom < 7) return 1200;
    if (zoom < OVERVIEW_ZOOM_THRESHOLD) return 2500;
    if (zoom < DETAIL_ZOOM_THRESHOLD) return 5000;
    if (zoom < 13) return 8000;
    return 12000;
}

function detailMarkerCap(zoom: number, total: number): number {
    if (zoom < 12) return Math.min(80, total);
    if (zoom < 13) return Math.min(180, total);
    return Math.min(350, total);
}

function clusterRadiusForZoom(zoom: number): number {
    if (zoom < 7) return 58;
    if (zoom < OVERVIEW_ZOOM_THRESHOLD) return 44;
    if (zoom < DETAIL_ZOOM_THRESHOLD) return 34;
    return 26;
}

function pollIntervalForZoom(zoom: number, lastRefreshMs: number | null): number {
    // Faster when user inspects details; slower at country view.
    let base = POLL_BASE_MS;
    if (zoom >= 12) base = 1200;
    else if (zoom >= 10) base = 1600;
    else if (zoom >= 8) base = 1900;
    // Add headroom if backend responds slowly.
    if (lastRefreshMs && lastRefreshMs > 900) base += 500;
    return Math.max(900, base);
}

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
    const cityHubMarkersRef = useRef<Map<string, any>>(new Map());
    const cityCountsRef = useRef<Record<string, number>>({});
    const fitBoundsDoneRef = useRef(false);
    const positionsRef = useRef<UserPosition[]>([]);
    const heatmapDebounceRef = useRef<ReturnType<typeof setTimeout>>();
    const moveDebounceRef = useRef<ReturnType<typeof setTimeout>>();
    const abortRef = useRef<AbortController | null>(null);
    const fetchInFlightRef = useRef(false);
    const tabVisibleRef = useRef(typeof document === 'undefined' || !document.hidden);
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastRefreshRef = useRef<number | null>(null);

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
            clusterMaxZoom: CLUSTER_MAX_ZOOM,
            clusterRadius: clusterRadiusForZoom(map.getZoom()),
        });
        map.addLayer({
            id: 'live-clusters',
            type: 'circle',
            source: 'live-positions',
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': [
                    'interpolate', ['linear'], ['get', 'point_count'],
                    2, '#22d3ee', 15, '#8b5cf6', 40, '#ec4899', 80, '#f43f5e',
                ],
                'circle-radius': [
                    'interpolate', ['linear'], ['get', 'point_count'],
                    2, 22, 10, 28, 30, 36, 60, 44,
                ],
                'circle-opacity': 0.88,
                'circle-stroke-width': 2.5,
                'circle-stroke-color': 'rgba(255,255,255,0.55)',
                'circle-blur': 0.15,
            },
        });
        map.addLayer({
            id: 'live-cluster-count',
            type: 'symbol',
            source: 'live-positions',
            filter: ['has', 'point_count'],
            layout: {
                'text-field': ['get', 'point_count_abbreviated'],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 13,
            },
            paint: {
                'text-color': '#ffffff',
            },
        });
        map.addLayer({
            id: 'live-unclustered',
            type: 'circle',
            source: 'live-positions',
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-radius': 6,
                'circle-color': '#6366f1',
                'circle-stroke-width': 1.5,
                'circle-stroke-color': '#fff',
                'circle-opacity': 0.9,
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

    const aggregateCityCounts = useCallback((list: UserPosition[]): Record<string, number> => {
        const counts: Record<string, number> = {};
        for (const c of POLAND_SIM_CITIES) counts[c.slug] = 0;
        for (const p of list) {
            if (!p.lat || !p.lng) continue;
            const slug = nearestCitySlug(p.lat, p.lng);
            counts[slug] = (counts[slug] ?? 0) + 1;
        }
        return counts;
    }, []);

    const syncCityHubMarkers = useCallback(() => {
        const map = mapRef.current;
        const ml = getMl();
        if (!map || !ml) return;
        const zoom = map.getZoom();
        if (zoom >= OVERVIEW_ZOOM_THRESHOLD) {
            cityHubMarkersRef.current.forEach((m) => m.remove());
            cityHubMarkersRef.current.clear();
            return;
        }
        const counts = cityCountsRef.current;
        for (const city of POLAND_SIM_CITIES) {
            const count = counts[city.slug] ?? 0;
            const target: [number, number] = [city.lng, city.lat];
            const existing = cityHubMarkersRef.current.get(city.slug);
            if (existing) {
                updateCityHubMarkerElement(existing.getElement() as HTMLDivElement, city, count);
                continue;
            }
            const el = createCityHubMarkerElement(city, count);
            const marker = new ml.Marker({ element: el, anchor: 'center' })
                .setLngLat(target)
                .addTo(map);
            cityHubMarkersRef.current.set(city.slug, marker);
        }
        try {
            const showGlClusters = zoom >= OVERVIEW_ZOOM_THRESHOLD;
            const clusterOpacity = showGlClusters ? 0.88 : 0;
            if (map.getLayer('live-clusters')) {
                map.setPaintProperty('live-clusters', 'circle-opacity', clusterOpacity);
            }
            if (map.getLayer('live-cluster-count')) {
                map.setLayoutProperty('live-cluster-count', 'visibility', showGlClusters ? 'visible' : 'none');
            }
            if (map.getLayer('live-unclustered')) {
                map.setPaintProperty('live-unclustered', 'circle-opacity', showGlClusters ? 0.9 : 0);
            }
        } catch { /* style not ready */ }
    }, []);

    const syncDetailMarkers = useCallback(() => {
        const map = mapRef.current;
        const ml = getMl();
        if (!map || !ml) return;
        const zoom = map.getZoom();
        syncCityHubMarkers();
        if (zoom < DETAIL_ZOOM_THRESHOLD) {
            detailMarkersRef.current.forEach((m) => m.remove());
            detailMarkersRef.current.clear();
            return;
        }
        const cap = detailMarkerCap(zoom, positionsRef.current.length);
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
        try {
            if (map.getLayer('live-unclustered')) {
                const hideDots = zoom < OVERVIEW_ZOOM_THRESHOLD || zoom >= DETAIL_ZOOM_THRESHOLD;
                map.setPaintProperty('live-unclustered', 'circle-opacity', hideDots ? 0 : 0.9);
            }
            if (map.getLayer('live-clusters') && zoom >= DETAIL_ZOOM_THRESHOLD) {
                map.setPaintProperty('live-clusters', 'circle-opacity', 0);
                if (map.getLayer('live-cluster-count')) {
                    map.setLayoutProperty('live-cluster-count', 'visibility', 'none');
                }
            }
        } catch { /* style not ready */ }
    }, [syncCityHubMarkers]);

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
    }, [syncCityHubMarkers]);

    const applyCityCounts = useCallback((
        list: UserPosition[],
        meta: Record<string, unknown> | null | undefined,
    ) => {
        const raw = meta?.city_counts;
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            const merged: Record<string, number> = {};
            for (const c of POLAND_SIM_CITIES) merged[c.slug] = 0;
            for (const [slug, n] of Object.entries(raw as Record<string, unknown>)) {
                if (typeof n === 'number') merged[slug] = n;
            }
            cityCountsRef.current = merged;
            return;
        }
        cityCountsRef.current = aggregateCityCounts(list);
    }, [aggregateCityCounts]);

    const fetchPositions = useCallback(async () => {
        if (!canFetch || !tabVisibleRef.current || fetchInFlightRef.current) return;
        fetchInFlightRef.current = true;
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;
        const t0 = performance.now();
        try {
            const map = mapRef.current;
            const zoom = map ? map.getZoom() : DEFAULT_ZOOM;
            const params: Record<string, string | number> = {
                limit: limitForZoom(zoom),
            };
            if (map) {
                params.bbox = bboxFromMap(map);
                params.zoom = Math.round(zoom);
            }

            const data = await TelemetryApi.getLivePositions(params, { signal: ac.signal });
            if (ac.signal.aborted) return;

            const list = data?.positions ?? [];
            const meta = data?.meta;
            if (Array.isArray(list)) {
                positionsRef.current = list;
                applyMetaCounts(list, meta);
                applyCityCounts(list, meta);
                updateLiveSource(list);
                requestAnimationFrame(() => {
                    syncCityHubMarkers();
                    syncDetailMarkers();
                });
            }
            const tookMs = Math.round(performance.now() - t0);
            lastRefreshRef.current = tookMs;
            setLastRefreshMs(tookMs);
        } catch (err: unknown) {
            if (ac.signal.aborted) return;
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status !== 401 && status !== 403) { /* silent poll */ }
        } finally {
            fetchInFlightRef.current = false;
            setLoading(false);
        }
    }, [updateLiveSource, syncDetailMarkers, syncCityHubMarkers, canFetch, applyMetaCounts, applyCityCounts]);

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
                    if (!fitBoundsDoneRef.current) {
                        fitBoundsDoneRef.current = true;
                        map.fitBounds(polandCitiesBounds(), { padding: 48, duration: 0, maxZoom: 7 });
                    }
                    setMapReady(true);
                }
            });
            map.on('zoom', () => {
                const src = map.getSource('live-positions');
                if (src) {
                    try {
                        (src as { setClusterOptions?: (o: { radius?: number }) => void })
                            .setClusterOptions?.({ radius: clusterRadiusForZoom(map.getZoom()) });
                    } catch { /* MapLibre < 3.3 */ }
                }
                syncDetailMarkers();
            });
            map.on('moveend', () => {
                scheduleMoveFetch();
                syncDetailMarkers();
            });
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
            cityHubMarkersRef.current.forEach((m: any) => m.remove());
            cityHubMarkersRef.current.clear();
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
        const loop = async () => {
            await fetchPositionsRef.current();
            const map = mapRef.current;
            const zoom = map ? map.getZoom() : DEFAULT_ZOOM;
            const delay = pollIntervalForZoom(zoom, lastRefreshRef.current);
            pollTimerRef.current = setTimeout(loop, delay);
        };
        loop();
        return () => {
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
            pollTimerRef.current = null;
        };
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
