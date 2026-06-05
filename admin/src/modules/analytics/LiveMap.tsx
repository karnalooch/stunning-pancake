import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Box, Text, Badge, Group, Skeleton, ActionIcon, Tooltip, Button } from '@mantine/core';
import { Map as MapIcon, Activity, Layers, Zap, Stethoscope, AlertTriangle } from 'lucide-react';
import { LiveMapStatusBar } from './LiveMapStatusBar';
import { LiveMapFiltersBar } from './LiveMapFiltersBar';
import { LiveMapCapBanner } from './LiveMapCapBanner';
import { LiveMapCityRankingPanel } from './LiveMapCityRankingPanel';
import { LiveMapDiagnosticsDrawer } from './LiveMapDiagnosticsDrawer';
import { LiveMapReplayScrubber } from './LiveMapReplayScrubber';
import { computeLiveMapHealth, parsePollAfterMs, resolveStaleAfterMs } from './liveMapHealth';
import {
    DEFAULT_LIVE_MAP_FILTERS,
    filtersToApiParams,
    filtersToSearchParams,
    mergeFilters,
    parseFiltersFromSearch,
    type LiveMapFilters,
} from './liveMapFilters';
import { maskRiderName } from './liveMapPrivacy';
import { appendRequestLog, buildIncidentBundle, type LiveMapRequestLogEntry } from './liveMapDiagnostics';
import { addLiveMapBookmark, loadLiveMapBookmarks } from './liveMapBookmarks';
import { LiveMapReplayBuffer } from './liveMapReplay';
import { handleLiveMapKeyDown } from './liveMapKeyboard';
import { LiveMapFpsMonitor } from './liveMapPerformance';
import {
    resolveLiveMapPollDelayWithStream,
} from './liveMapPoll';
import { connectLiveMapSse, parseStreamIntervalMs } from './liveMapStream';
import { connectLiveMapWs } from './liveMapWs';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiClient, TelemetryApi } from '../../api/client';
import { formatQuickLaunchError, quickLaunchLiveMap, QuickLaunchBlockedError } from '../../api/simulatorBatch';
import { hasStoredSession } from '../../core/auth/tokens';
import { useAuth } from '../../core/auth/useAuth';
import { notifications } from '@mantine/notifications';
import {
    resolveActivityKind,
    speedToKmh,
    type LiveMapPosition,
} from './liveMapMarkers';
import { POLAND_SIM_CITIES, polandCitiesBounds, nearestCitySlug, cityBySlug } from './liveMapCities';
import {
    CLUSTER_MAX_ZOOM,
    apiDetailForZoom,
    clusterRadiusForZoom,
    limitForZoom,
    resolveLiveMapTier,
    TIER_MODE_LABEL,
} from './liveMapZoom';
import {
    installLiveMapLayers,
    LIVE_LAYERS,
    LIVE_SOURCES,
    prepareLiveMapStyle,
    setCityHubData,
    countLivePositionFeatures,
    setLivePositionsData,
    type LiveMapClickEvent,
} from './liveMapLayers';
import { LivePositionInterpolator } from './liveMapInterp';
import { bboxFromMap } from './liveMapBbox';
import {
    liveMapViewportKey,
    shouldClearOnEmptyViewportChange,
    shouldRetainMarkersOnEmptyPayload,
} from './liveMapViewport';
import type { LiveApiDetail } from './liveMapZoom';
import { MAP_ATTRIBUTION_CONTROL_OPTIONS, resolveMapStyleUrl } from '../../core/map/mapBasemap';
import { classifyMapLibreError } from '../../core/map/mapErrorPolicy';
import { isLiveMapE2eEnabled, publishLiveMapE2e } from './liveMapE2e';

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

const MAP_STYLE = resolveMapStyleUrl('light');
const DEFAULT_CENTER: [number, number] = [19.1344, 51.9194];
const DEFAULT_ZOOM = 6;
const MOVE_DEBOUNCE_MS = 180;
const MOVE_FETCH_THROTTLE_MS = 120;
const STALE_EMPTY_MS = 3500;

function featureToPosition(
    props: Record<string, unknown>,
    lng: number,
    lat: number,
): UserPosition {
    const rideState = props.ride_state != null ? String(props.ride_state) : undefined;
    return {
        deviceId: String(props.deviceId ?? ''),
        name: String(props.name ?? ''),
        type: String(props.type ?? ''),
        lat,
        lng,
        speed: Number(props.speed ?? 0),
        course: Number(props.course ?? 0),
        lastUpdate: '',
        ...(rideState ? { ride_state: rideState } : {}),
        ...(props.flagged ? { flagged: true } : {}),
    };
}

function parseInitialFilters(): LiveMapFilters {
    if (typeof window === 'undefined') return DEFAULT_LIVE_MAP_FILTERS;
    const hash = window.location.hash;
    const q = hash.includes('?') ? hash.split('?')[1] : '';
    return mergeFilters(DEFAULT_LIVE_MAP_FILTERS, parseFiltersFromSearch(q));
}

export const LiveMap: React.FC = () => {
    const { token, isAuthenticated, user } = useAuth();
    const canFetch = isAuthenticated && Boolean(token || hasStoredSession());
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const mlRef = useRef<any>(null);
    const popupRef = useRef<any>(null);
    const clusterPopupRef = useRef<any>(null);
    const cityCountsRef = useRef<Record<string, number>>({});
    const cityBikeCountsRef = useRef<Record<string, number>>({});
    const cityRunCountsRef = useRef<Record<string, number>>({});
    const cityTrendRef = useRef<Record<string, number>>({});
    const filtersRef = useRef<LiveMapFilters>(parseInitialFilters());
    const replayBufferRef = useRef(new LiveMapReplayBuffer());
    const fpsMonitorRef = useRef(new LiveMapFpsMonitor());
    const rafFpsRef = useRef<number | null>(null);
    const fitBoundsDoneRef = useRef(false);
    const positionsRef = useRef<UserPosition[]>([]);
    const heatmapDebounceRef = useRef<ReturnType<typeof setTimeout>>();
    const moveDebounceRef = useRef<ReturnType<typeof setTimeout>>();
    const abortRef = useRef<AbortController | null>(null);
    const fetchInFlightRef = useRef(false);
    const inflightViewportKeyRef = useRef('');
    const tabVisibleRef = useRef(typeof document === 'undefined' || !document.hidden);
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastRefreshRef = useRef<number | null>(null);
    const layersReadyRef = useRef(false);
    const mapHasLoadedRef = useRef(false);
    const interpolatorRef = useRef<LivePositionInterpolator | null>(null);
    const fetchSeqRef = useRef(0);
    const lastMoveAtRef = useRef(0);
    const lastDragFetchAtRef = useRef(0);
    const liveFetchPausedRef = useRef(false);
    const lastViewportKeyRef = useRef('');
    const viewportRefreshRef = useRef(0);
    const streamAbortRef = useRef<AbortController | null>(null);
    const wsDisconnectRef = useRef<(() => void) | null>(null);
    const streamIntervalMsRef = useRef(350);
    const lastStreamAtRef = useRef<number | null>(null);
    const [sseActive, setSseActive] = useState(false);
    const lastTelemetryMetaRef = useRef<Record<string, unknown> | null>(null);
    const lastSuccessAtRef = useRef<number | null>(null);
    const lastErrorAtRef = useRef<number | null>(null);
    const consecutiveErrorsRef = useRef(0);
    const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
    const [consecutiveErrors, setConsecutiveErrors] = useState(0);
    const [mapLoadError, setMapLoadError] = useState<string | null>(null);
    const [mapGeneration, setMapGeneration] = useState(0);

    const [onlineCount, setOnlineCount] = useState(0);
    const [cyclists, setCyclists] = useState(0);
    const [runners, setRunners] = useState(0);
    const [viewportRiders, setViewportRiders] = useState(0);
    const [drawnOnMap, setDrawnOnMap] = useState(0);
    const [renderedOnMap, setRenderedOnMap] = useState(0);
    const [loading, setLoading] = useState(true);
    const [mapReady, setMapReady] = useState(false);
    const [mlReady, setMlReady] = useState(false);
    const [tabVisible, setTabVisible] = useState(tabVisibleRef.current);
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [heatmapLoading, setHeatmapLoading] = useState(false);
    const [cellCount, setCellCount] = useState(0);
    const [launching, setLaunching] = useState(false);
    const [lastRefreshMs, setLastRefreshMs] = useState<number | null>(null);
    const [zoomMode, setZoomMode] = useState('');
    const [mapZoom, setMapZoom] = useState<number | null>(null);
    const [liveFetchPaused, setLiveFetchPaused] = useState(false);
    const [ingestEngaged, setIngestEngaged] = useState(false);
    const ingestPollMultRef = useRef(1);
    const lastPollDelayRef = useRef(1900);

    const [filters, setFilters] = useState<LiveMapFilters>(parseInitialFilters);
    const [cityCounts, setCityCounts] = useState<Record<string, number>>({});
    const [cityBikeCounts, setCityBikeCounts] = useState<Record<string, number>>({});
    const [cityRunCounts, setCityRunCounts] = useState<Record<string, number>>({});
    const [cityTrend, setCityTrend] = useState<Record<string, number>>({});
    const [flaggedCount, setFlaggedCount] = useState(0);
    const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
    const [requestLog, setRequestLog] = useState<LiveMapRequestLogEntry[]>([]);
    const [fps, setFps] = useState(0);
    const [replayIndex, setReplayIndex] = useState(-1);
    const [replayPlaying, setReplayPlaying] = useState(false);
    const [replayFrameCount, setReplayFrameCount] = useState(0);
    const [bookmarks, setBookmarks] = useState(() => loadLiveMapBookmarks());
    const replayPlayingRef = useRef(false);
    const replayIndexRef = useRef(-1);

    filtersRef.current = filters;
    replayPlayingRef.current = replayPlaying;
    replayIndexRef.current = replayIndex;

    useEffect(() => {
        if (isAuthenticated && (token || hasStoredSession())) {
            liveFetchPausedRef.current = false;
            setLiveFetchPaused(false);
        }
    }, [isAuthenticated, token]);

    useEffect(() => {
        const base = window.location.hash.split('?')[0];
        const qs = filtersToSearchParams(filters, mapZoom ?? undefined);
        const next = `${base}${qs}`;
        if (window.location.hash !== next) {
            window.history.replaceState(null, '', next);
        }
    }, [filters, mapZoom]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const handled = handleLiveMapKeyDown(e, {
                zoomIn: () => mapRef.current?.zoomIn?.({ duration: 200 }),
                zoomOut: () => mapRef.current?.zoomOut?.({ duration: 200 }),
                fitBounds: () => mapRef.current?.fitBounds?.(polandCitiesBounds(), { padding: 48, maxZoom: 7 }),
                toggleHeatmap: () => setShowHeatmap((v) => !v),
                toggleDiagnostics: () => setDiagnosticsOpen((v) => !v),
                togglePresentation: () => setFilters((f) => mergeFilters(f, { presentationMode: !f.presentationMode })),
            });
            if (handled) e.preventDefault();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        if (!mapReady) return;
        const tick = (now: number) => {
            const sample = fpsMonitorRef.current.tick(now);
            if (sample) setFps(sample.fps);
            rafFpsRef.current = requestAnimationFrame(tick);
        };
        rafFpsRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafFpsRef.current != null) cancelAnimationFrame(rafFpsRef.current);
        };
    }, [mapReady]);

    useEffect(() => {
        if (!replayPlaying) return;
        const id = setInterval(() => {
            setReplayIndex((prev) => {
                const frames = replayBufferRef.current.getFrames();
                const next = prev < 0 ? 0 : prev + 1;
                if (next >= frames.length) {
                    setReplayPlaying(false);
                    return -1;
                }
                const frame = frames[next];
                ingestPositionsRef.current(frame.positions, { snap: true });
                return next;
            });
        }, 400);
        return () => clearInterval(id);
    }, [replayPlaying]);

    const healthSnapshot = useMemo(() => computeLiveMapHealth({
        mapReady,
        canFetch,
        tabVisible,
        liveFetchPaused,
        ingestEngaged,
        lastSuccessAt,
        lastErrorAt: lastErrorAtRef.current,
        consecutiveErrors,
        lastLatencyMs: lastRefreshMs,
        meta: lastTelemetryMetaRef.current,
        staleAfterMs: resolveStaleAfterMs({
            pollDelayMs: lastPollDelayRef.current,
            lastLatencyMs: lastRefreshMs,
            sseActive,
            streamIntervalMs: streamIntervalMsRef.current,
        }),
        cachedPositionCount: onlineCount,
    }), [
        mapReady, canFetch, tabVisible, liveFetchPaused, ingestEngaged,
        lastSuccessAt, consecutiveErrors, lastRefreshMs, sseActive, onlineCount,
    ]);

    const handleSaveBookmark = useCallback(() => {
        const map = mapRef.current;
        if (!map) return;
        const c = map.getCenter();
        const label = filters.citySlug
            ? `${cityBySlug(filters.citySlug)?.name ?? filters.citySlug} z${map.getZoom().toFixed(1)}`
            : `Widok z${map.getZoom().toFixed(1)}`;
        const next = addLiveMapBookmark(bookmarks, {
            label,
            center: [c.lng, c.lat],
            zoom: map.getZoom(),
            filters: { ...filters },
        });
        setBookmarks(next);
        notifications.show({ title: 'Zapisano widok', message: label, color: 'teal' });
    }, [bookmarks, filters]);

    const copyIncidentBundle = useCallback(() => {
        const map = mapRef.current;
        return buildIncidentBundle({
            bbox: map ? bboxFromMap(map) : undefined,
            zoom: map?.getZoom(),
            detail: map ? apiDetailForZoom(map.getZoom()) : undefined,
            health: healthSnapshot as unknown as Record<string, unknown>,
            meta: lastTelemetryMetaRef.current,
            filters: filters as unknown as Record<string, unknown>,
            requestLog,
        });
    }, [healthSnapshot, filters, requestLog]);

    const pushPositionsToMap = useCallback((list: UserPosition[]) => {
        const map = mapRef.current;
        if (!map || !layersReadyRef.current) return;
        setLivePositionsData(map, list);
    }, []);

    const syncZoomUi = useCallback(() => {
        const map = mapRef.current;
        if (!map) return;
        const z = map.getZoom();
        setMapZoom(Math.round(z * 10) / 10);
        setZoomMode(TIER_MODE_LABEL[resolveLiveMapTier(z)]);
    }, []);

    const showRiderPopup = useCallback((pos: UserPosition, lngLat: { lng: number; lat: number }) => {
        const ml = mlRef.current;
        const map = mapRef.current;
        if (!ml || !map) return;
        popupRef.current?.remove();
        const kind = resolveActivityKind(pos.type);
        const kmh = speedToKmh(pos.speed);
        const displayName = maskRiderName(pos, user?.role);
        const stateLine = pos.ride_state && pos.ride_state !== 'ACTIVE'
            ? `<div style="font-size:11px;color:#64748b;margin-bottom:4px">State: ${pos.ride_state}</div>`
            : '';
        const flaggedLine = pos.flagged
            ? `<div style="font-size:11px;color:#ef4444;margin-bottom:4px">⚠ Podejrzana aktywność</div>`
            : '';
        const cheatLink = pos.flagged && user?.role === 'GLOBAL_OWNER'
            ? `<a href="#/owner/anti-cheat" style="font-size:11px;color:#6366f1">Otwórz Anti-Cheat →</a>`
            : '';
        const html = `
            <div style="font-family:system-ui,sans-serif;min-width:140px;padding:2px 0">
                <div style="font-weight:700;font-size:13px;margin-bottom:4px">${displayName}</div>
                ${flaggedLine}
                ${stateLine}
                <div style="font-size:12px;color:#52525b">${kind === 'bike' ? 'Cycling' : 'Running'} · ${kmh > 0 ? `${kmh} km/h` : '—'}</div>
                ${cheatLink}
            </div>`;
        popupRef.current = new ml.Popup({ closeButton: true, maxWidth: '240px', offset: 12 })
            .setLngLat([lngLat.lng, lngLat.lat])
            .setHTML(html)
            .addTo(map);
    }, [user?.role]);

    const handleClusterClick = useCallback((e: LiveMapClickEvent) => {
        const map = mapRef.current;
        if (!map) return;
        const features = map.queryRenderedFeatures(e.point, { layers: [LIVE_LAYERS.clusters] });
        const feature = features[0];
        if (!feature?.properties?.cluster_id) return;
        const clusterId = feature.properties.cluster_id;
        const coords = (feature.geometry as { coordinates: [number, number] }).coordinates;
        const source = map.getSource(LIVE_SOURCES.positions) as {
            getClusterExpansionZoom?: (id: number, cb: (err: Error | null, z: number) => void) => void;
        };
        source?.getClusterExpansionZoom?.(clusterId, (err, expansionZoom) => {
            if (err) return;
            map.easeTo({
                center: coords,
                zoom: Math.min(expansionZoom + 0.5, 16),
                duration: 450,
            });
        });
    }, []);

    const handleRiderClick = useCallback((e: LiveMapClickEvent) => {
        const map = mapRef.current;
        if (!map) return;
        const layers = [LIVE_LAYERS.riderLabels, LIVE_LAYERS.riderIcons, LIVE_LAYERS.unclustered];
        const features = map.queryRenderedFeatures(e.point, { layers });
        const feature = features[0];
        if (!feature?.properties) return;
        const [lng, lat] = (feature.geometry as { coordinates: [number, number] }).coordinates;
        const pos = featureToPosition(feature.properties as Record<string, unknown>, lng, lat);
        showRiderPopup(pos, { lng, lat });
    }, [showRiderPopup]);

    const handleCityHubClick = useCallback((e: LiveMapClickEvent) => {
        const map = mapRef.current;
        if (!map) return;
        const features = map.queryRenderedFeatures(e.point, {
            layers: [LIVE_LAYERS.cityHubRing, LIVE_LAYERS.cityHubCount],
        });
        const slug = features[0]?.properties?.slug as string | undefined;
        const city = slug ? cityBySlug(slug) : undefined;
        if (!city) return;
        map.easeTo({ center: [city.lng, city.lat], zoom: 10.5, duration: 700 });
        setFilters((prev) => mergeFilters(prev, { citySlug: slug ?? null }));
    }, []);

    const handleClusterHover = useCallback((html: string | null, lngLat?: { lng: number; lat: number }) => {
        const ml = mlRef.current;
        const map = mapRef.current;
        if (!ml || !map) return;
        if (!html || !lngLat) {
            clusterPopupRef.current?.remove();
            clusterPopupRef.current = null;
            return;
        }
        if (!clusterPopupRef.current) {
            clusterPopupRef.current = new ml.Popup({
                closeButton: false,
                closeOnClick: false,
                maxWidth: '200px',
                offset: 8,
                className: 'live-map-cluster-popup',
            });
        }
        clusterPopupRef.current
            .setLngLat([lngLat.lng, lngLat.lat])
            .setHTML(`<div style="font-family:system-ui;font-size:12px;padding:2px 0">${html}</div>`)
            .addTo(map);
    }, []);

    const flyToCity = useCallback((slug: string) => {
        const city = cityBySlug(slug);
        const map = mapRef.current;
        if (!city || !map) return;
        map.easeTo({ center: [city.lng, city.lat], zoom: 10.5, duration: 700 });
        setFilters((prev) => mergeFilters(prev, { citySlug: slug }));
    }, []);

    const ensureMapLayers = useCallback(async (map: any) => {
        if (layersReadyRef.current) return;
        await prepareLiveMapStyle(map);
        installLiveMapLayers(map, clusterRadiusForZoom(map.getZoom()), {
            onClusterClick: handleClusterClick,
            onRiderClick: handleRiderClick,
            onCityHubClick: handleCityHubClick,
            onClusterHover: handleClusterHover,
        });
        setCityHubData(map, {
            counts: cityCountsRef.current,
            bikeCounts: cityBikeCountsRef.current,
            runCounts: cityRunCountsRef.current,
            trend: cityTrendRef.current,
        });
        layersReadyRef.current = true;
        const cached = positionsRef.current;
        if (cached.length > 0) {
            setLivePositionsData(map, cached);
            interpolatorRef.current?.snapTo(cached);
        }
    }, [handleClusterClick, handleRiderClick, handleCityHubClick, handleClusterHover]);

    const aggregateCityCounts = useCallback((list: UserPosition[]): Record<string, number> => {
        const counts: Record<string, number> = {};
        for (const c of POLAND_SIM_CITIES) counts[c.slug] = 0;
        for (const p of list) {
            if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
            const slug = nearestCitySlug(p.lat, p.lng);
            counts[slug] = (counts[slug] ?? 0) + 1;
        }
        return counts;
    }, []);

    const [rideWarming, setRideWarming] = useState(0);

    const applyMetaCounts = useCallback((list: UserPosition[], meta: Record<string, unknown> | null | undefined) => {
        const riding =
            typeof meta?.ride_on_map === 'number'
                ? meta.ride_on_map
                : typeof meta?.active_riding === 'number'
                    ? meta.active_riding
                    : typeof meta?.redis_active === 'number'
                        ? meta.redis_active
                        : list.length;
        const ridingN = typeof riding === 'number' && Number.isFinite(riding) ? riding : 0;
        setOnlineCount((prev) => (ridingN !== prev ? ridingN : prev));

        const viewportReturned = meta?.positions_returned ?? meta?.viewport_returned;
        const inView = list.length > 0
            ? list.length
            : (typeof viewportReturned === 'number' && Number.isFinite(viewportReturned)
                ? viewportReturned
                : 0);
        setViewportRiders((prev) => (inView !== prev ? inView : prev));
        const warming = typeof meta?.ride_warming === 'number' ? meta.ride_warming : 0;
        setRideWarming((prev) => (warming !== prev ? warming : prev));

        const engaged = Boolean(meta?.ingest_engaged ?? meta?.live_read_throttled);
        setIngestEngaged((prev) => (engaged !== prev ? engaged : prev));
        const pollMult =
            typeof meta?.live_poll_interval_multiplier === 'number'
                ? meta.live_poll_interval_multiplier
                : 1;
        if (pollMult >= 1) ingestPollMultRef.current = pollMult;

        if (list.length === 0 && viewportReturned === 0) {
            setCyclists(0);
            setRunners(0);
            return;
        }

        const bikeMeta = meta?.viewport_bike;
        const runMeta = meta?.viewport_run;
        if (
            list.length === 0
            && (typeof bikeMeta === 'number' || typeof runMeta === 'number')
        ) {
            setCyclists(typeof bikeMeta === 'number' ? bikeMeta : 0);
            setRunners(typeof runMeta === 'number' ? runMeta : 0);
            return;
        }
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

    const mergeCityMeta = (
        raw: unknown,
        slugs: typeof POLAND_SIM_CITIES,
    ): Record<string, number> => {
        const merged: Record<string, number> = {};
        for (const c of slugs) merged[c.slug] = 0;
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            for (const [slug, n] of Object.entries(raw as Record<string, unknown>)) {
                if (typeof n === 'number') merged[slug] = n;
            }
        }
        return merged;
    };

    const applyCityCounts = useCallback((
        list: UserPosition[],
        meta: Record<string, unknown> | null | undefined,
    ) => {
        const raw = meta?.city_counts;
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            cityCountsRef.current = mergeCityMeta(raw, POLAND_SIM_CITIES);
        } else {
            cityCountsRef.current = aggregateCityCounts(list);
        }
        cityBikeCountsRef.current = mergeCityMeta(meta?.city_bike_counts, POLAND_SIM_CITIES);
        cityRunCountsRef.current = mergeCityMeta(meta?.city_run_counts, POLAND_SIM_CITIES);
        cityTrendRef.current = mergeCityMeta(meta?.city_trend, POLAND_SIM_CITIES);
        setCityCounts({ ...cityCountsRef.current });
        setCityBikeCounts({ ...cityBikeCountsRef.current });
        setCityRunCounts({ ...cityRunCountsRef.current });
        setCityTrend({ ...cityTrendRef.current });
        const flagged = meta?.flagged_in_viewport;
        if (typeof flagged === 'number') setFlaggedCount(flagged);
        const map = mapRef.current;
        if (map && layersReadyRef.current) {
            setCityHubData(map, {
                counts: cityCountsRef.current,
                bikeCounts: cityBikeCountsRef.current,
                runCounts: cityRunCountsRef.current,
                trend: cityTrendRef.current,
            });
        }
    }, [aggregateCityCounts]);

    const countRenderedRiderFeatures = useCallback((map: {
        queryRenderedFeatures?: (opts: { layers: string[] }) => Array<{ properties?: Record<string, unknown> }>;
    }) => {
        if (!map.queryRenderedFeatures) return 0;
        try {
            const layers = [
                LIVE_LAYERS.clusters,
                LIVE_LAYERS.unclustered,
                LIVE_LAYERS.riderIcons,
                LIVE_LAYERS.riderLabels,
            ];
            const features = map.queryRenderedFeatures({ layers });
            return features.filter((f) => {
                const p = f.properties;
                if (!p) return false;
                if (p.cluster_id != null || p.point_count != null) return true;
                return p.deviceId != null;
            }).length;
        } catch {
            return 0;
        }
    }, []);

    const scheduleRenderedCount = useCallback(() => {
        const map = mapRef.current;
        if (!map || !layersReadyRef.current) return;
        requestAnimationFrame(() => {
            const n = countRenderedRiderFeatures(map);
            setRenderedOnMap((prev) => (n !== prev ? n : prev));
        });
    }, [countRenderedRiderFeatures]);

    const flushPositionsToMapLayer = useCallback(() => {
        const map = mapRef.current;
        if (!map || !layersReadyRef.current) return;
        const list = positionsRef.current;
        setLivePositionsData(map, list);
        const featureN = countLivePositionFeatures(list);
        setDrawnOnMap((prev) => (featureN !== prev ? featureN : prev));
        scheduleRenderedCount();
    }, [scheduleRenderedCount]);

    const ingestPositions = useCallback((list: LiveMapPosition[], opts?: { snap?: boolean }) => {
        positionsRef.current = list;
        if (!interpolatorRef.current) {
            interpolatorRef.current = new LivePositionInterpolator((blended) => {
                pushPositionsToMap(blended);
            });
        }
        if (opts?.snap) {
            interpolatorRef.current.snapTo(list);
            flushPositionsToMapLayer();
        } else {
            interpolatorRef.current.ingestSnapshot(list);
        }
    }, [pushPositionsToMap, flushPositionsToMapLayer]);

    const ingestPositionsRef = useRef(ingestPositions);
    ingestPositionsRef.current = ingestPositions;

    const applyPositionPayload = useCallback((
        list: UserPosition[],
        meta: Record<string, unknown> | null | undefined,
        detail: LiveApiDetail,
        snap: boolean,
        viewportChanged: boolean,
        fromStream = false,
    ) => {
        const movedRecently = Date.now() - lastMoveAtRef.current < STALE_EMPTY_MS;
        const retainMarkers = shouldRetainMarkersOnEmptyPayload({
            listLength: list.length,
            detail,
            movedRecently,
            currentPositions: positionsRef.current.length,
            viewportChanged,
            cachedResponse: Boolean(meta?.cached),
            fromStream,
            meta,
        });

        applyMetaCounts(list, meta);
        applyCityCounts(list, meta);

        if (detail === 'summary') {
            ingestPositions([], { snap: true });
            return;
        }
        if (shouldClearOnEmptyViewportChange(list.length, detail, viewportChanged)) {
            ingestPositions([], { snap: true });
            return;
        }
        if (retainMarkers) {
            flushPositionsToMapLayer();
            return;
        }

        ingestPositions(list, { snap: snap || list.length > 0 });
    }, [applyMetaCounts, applyCityCounts, ingestPositions, flushPositionsToMapLayer]);

    const fetchPositions = useCallback(async (opts?: { priority?: boolean; snap?: boolean }) => {
        if (!canFetch || liveFetchPausedRef.current || !tabVisibleRef.current) return;
        const priority = Boolean(opts?.priority);
        if (!priority && fetchInFlightRef.current) return;

        fetchInFlightRef.current = true;

        const seq = ++fetchSeqRef.current;
        const ac = new AbortController();
        const t0 = performance.now();
        try {
            const map = mapRef.current;
            const zoom = map ? map.getZoom() : DEFAULT_ZOOM;
            const detail = apiDetailForZoom(zoom);
            const bbox = map ? bboxFromMap(map) : undefined;
            const viewportKey = liveMapViewportKey(detail, bbox);
            if (
                priority
                && abortRef.current
                && inflightViewportKeyRef.current
                && inflightViewportKeyRef.current !== viewportKey
            ) {
                abortRef.current.abort();
            }
            abortRef.current = ac;
            inflightViewportKeyRef.current = viewportKey;
            const viewportChanged = viewportKey !== lastViewportKeyRef.current;
            if (viewportChanged) {
                lastViewportKeyRef.current = viewportKey;
                viewportRefreshRef.current += 1;
            }

            const params: Record<string, string | number> = {
                limit: detail === 'summary' ? 0 : limitForZoom(zoom),
                detail,
                ...filtersToApiParams(filtersRef.current),
            };
            if (map) {
                params.bbox = bbox!;
                params.zoom = Math.round(zoom * 10) / 10;
            }
            if (viewportChanged || priority) {
                params.refresh = viewportRefreshRef.current;
            }

            const data = await TelemetryApi.getLivePositions(params, { signal: ac.signal, silent: true });
            if (ac.signal.aborted || seq !== fetchSeqRef.current) return;
            if (liveMapViewportKey(detail, bbox) !== lastViewportKeyRef.current) return;

            const list = data?.positions ?? [];
            const meta = data?.meta;
            if (meta && typeof meta === 'object') {
                lastTelemetryMetaRef.current = meta as Record<string, unknown>;
                const serverPoll = parsePollAfterMs(meta as Record<string, unknown>);
                if (serverPoll != null) ingestPollMultRef.current = 1;
            }
            if (Array.isArray(list)) {
                applyPositionPayload(
                    list,
                    meta,
                    detail,
                    Boolean(opts?.snap) || priority,
                    viewportChanged,
                    false,
                );
                syncZoomUi();
            }
            const tookMs = Math.round(performance.now() - t0);
            lastRefreshRef.current = tookMs;
            setLastRefreshMs(tookMs);
            setRequestLog((prev) => appendRequestLog(prev, {
                bbox,
                zoom: map ? map.getZoom() : undefined,
                detail,
                latencyMs: tookMs,
                positions: list.length,
                readMode: typeof meta?.read_mode === 'string' ? meta.read_mode : undefined,
                capped: Boolean(meta?.capped),
                cached: Boolean(meta?.cached),
            }));
            if (!replayPlayingRef.current && replayIndexRef.current < 0) {
                replayBufferRef.current.push(list, meta ?? undefined);
                setReplayFrameCount(replayBufferRef.current.length);
            }
            const now = Date.now();
            lastSuccessAtRef.current = now;
            setLastSuccessAt(now);
            consecutiveErrorsRef.current = 0;
            setConsecutiveErrors(0);
        } catch (err: unknown) {
            if (ac.signal.aborted || seq !== fetchSeqRef.current) return;
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 401 || status === 403) {
                liveFetchPausedRef.current = true;
                setLiveFetchPaused(true);
                abortRef.current?.abort();
                if (pollTimerRef.current) {
                    clearTimeout(pollTimerRef.current);
                    pollTimerRef.current = null;
                }
            } else {
                consecutiveErrorsRef.current += 1;
                setConsecutiveErrors(consecutiveErrorsRef.current);
                lastErrorAtRef.current = Date.now();
            }
        } finally {
            if (seq === fetchSeqRef.current) {
                fetchInFlightRef.current = false;
            }
            setLoading(false);
        }
    }, [canFetch, applyPositionPayload, syncZoomUi]);

    const fetchPositionsRef = useRef(fetchPositions);
    fetchPositionsRef.current = fetchPositions;

    const applyStreamSnapshot = useCallback((
        list: UserPosition[],
        meta: Record<string, unknown> | null | undefined,
    ) => {
        const map = mapRef.current;
        const zoom = map ? map.getZoom() : DEFAULT_ZOOM;
        const detail = apiDetailForZoom(zoom);
        const streamMs = parseStreamIntervalMs(meta);
        if (streamMs != null) streamIntervalMsRef.current = streamMs;
        applyPositionPayload(list, meta, detail, false, false, true);
        const now = Date.now();
        lastStreamAtRef.current = now;
        lastSuccessAtRef.current = now;
        setLastSuccessAt(now);
        consecutiveErrorsRef.current = 0;
        setConsecutiveErrors(0);
    }, [applyPositionPayload]);

    const stopTelemetryStream = useCallback(() => {
        streamAbortRef.current?.abort();
        streamAbortRef.current = null;
        wsDisconnectRef.current?.();
        wsDisconnectRef.current = null;
        lastStreamAtRef.current = null;
        setSseActive(false);
    }, []);

    const restartTelemetryStream = useCallback(() => {
        stopTelemetryStream();
        if (isLiveMapE2eEnabled()) return;
        if (!canFetch || liveFetchPausedRef.current || !tabVisibleRef.current) return;
        const map = mapRef.current;
        if (!map || !mapReady) return;
        const zoom = map.getZoom();
        const detail = apiDetailForZoom(zoom);
        if (detail === 'summary') return;

        const bbox = bboxFromMap(map);
        const params: Record<string, string | number> = {
            limit: limitForZoom(zoom),
            detail,
            bbox,
            zoom: Math.round(zoom * 10) / 10,
            ...filtersToApiParams(filtersRef.current),
        };

        streamAbortRef.current = connectLiveMapSse(params, {
            onOpen: () => setSseActive(true),
            onSnapshot: (list, meta) => {
                if (Array.isArray(list)) applyStreamSnapshot(list, meta);
            },
            onError: () => setSseActive(false),
        });

        wsDisconnectRef.current = connectLiveMapWs(
            (pos) => interpolatorRef.current?.pushDelta(pos),
            () => { /* WS optional — SSE is primary */ },
        );
    }, [canFetch, mapReady, applyStreamSnapshot, stopTelemetryStream]);

    useEffect(() => {
        if (!mapReady) return;
        fetchPositionsRef.current?.({ priority: true, snap: true });
        restartTelemetryStream();
    }, [filters.activityType, filters.citySlug, mapReady, restartTelemetryStream]);

    const scheduleMoveFetch = useCallback((immediate = false) => {
        lastMoveAtRef.current = Date.now();
        if (moveDebounceRef.current) clearTimeout(moveDebounceRef.current);
        const run = () => {
            fetchPositionsRef.current({ priority: true, snap: true });
            restartTelemetryStream();
        };
        if (immediate) {
            run();
            return;
        }
        moveDebounceRef.current = setTimeout(run, MOVE_DEBOUNCE_MS);
    }, [restartTelemetryStream]);

    const scheduleDragFetch = useCallback(() => {
        lastMoveAtRef.current = Date.now();
        const now = Date.now();
        if (now - lastDragFetchAtRef.current < MOVE_FETCH_THROTTLE_MS) return;
        lastDragFetchAtRef.current = now;
        fetchPositionsRef.current({ priority: true, snap: true });
    }, []);

    const handleQuickLaunch = useCallback(async () => {
        if (!canFetch) {
            notifications.show({
                title: 'Sign in required',
                message: 'Log in as an admin to start the live simulation.',
                color: 'orange',
            });
            return;
        }
        setLaunching(true);
        try {
            await quickLaunchLiveMap();
            notifications.show({
                title: 'Live Simulation Started',
                message: 'Cyclists are now riding on the map',
                color: 'teal',
            });
            if (liveFetchPausedRef.current) {
                liveFetchPausedRef.current = false;
                setLiveFetchPaused(false);
            }
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (err instanceof QuickLaunchBlockedError || status === 409) {
                notifications.show({
                    title: 'Batch w toku',
                    message: formatQuickLaunchError(err),
                    color: 'orange',
                });
            } else {
                notifications.show({
                    title: 'Launch failed',
                    message: formatQuickLaunchError(err),
                    color: 'red',
                });
            }
        } finally {
            setLaunching(false);
            if (!liveFetchPausedRef.current) {
                fetchPositions({ priority: true, snap: true });
            }
        }
    }, [canFetch, fetchPositions]);

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
                        before: LIVE_LAYERS.unclustered,
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
                        before: LIVE_LAYERS.unclustered,
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
            if (vis) {
                fetchPositionsRef.current();
                restartTelemetryStream();
            } else {
                stopTelemetryStream();
            }
        };
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, [restartTelemetryStream, stopTelemetryStream]);

    useEffect(() => {
        let cancelled = false;
        if (!mapContainer.current) return;

        setMapLoadError(null);
        mapHasLoadedRef.current = false;
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
            map.addControl(new m.AttributionControl(MAP_ATTRIBUTION_CONTROL_OPTIONS), 'bottom-right');
            map.on('load', async () => {
                if (cancelled) return;
                await ensureMapLayers(map);
                if (!fitBoundsDoneRef.current) {
                    fitBoundsDoneRef.current = true;
                    map.fitBounds(polandCitiesBounds(), { padding: 48, duration: 0, maxZoom: 7 });
                }
                syncZoomUi();
                mapHasLoadedRef.current = true;
                setMapLoadError(null);
                setLoading(false);
                setMapReady(true);
                if (canFetch && !liveFetchPausedRef.current) {
                    fetchPositionsRef.current({ priority: true, snap: true });
                }
            });
            map.on('error', (e: { error?: { message?: string; status?: number; url?: string } }) => {
                if (cancelled) return;
                if (classifyMapLibreError(e, MAP_STYLE, mapHasLoadedRef.current) === 'ignorable') {
                    return;
                }
                setMapLoadError('Nie udało się wczytać kafelków mapy (CDN / styl).');
                setLoading(false);
                if (!mapHasLoadedRef.current) {
                    setMapReady(false);
                }
            });
            map.on('zoom', () => {
                const z = map.getZoom();
                const src = map.getSource(LIVE_SOURCES.positions);
                if (src) {
                    try {
                        (src as { setClusterOptions?: (o: { radius?: number; clusterMaxZoom?: number }) => void })
                            .setClusterOptions?.({
                                radius: clusterRadiusForZoom(z),
                                clusterMaxZoom: CLUSTER_MAX_ZOOM,
                            });
                    } catch { /* MapLibre < 3.3 */ }
                }
                if (apiDetailForZoom(z) === 'summary') {
                    ingestPositionsRef.current([], { snap: true });
                }
                syncZoomUi();
            });
            map.on('zoomend', () => scheduleMoveFetch(true));
            map.on('movestart', () => {
                lastMoveAtRef.current = Date.now();
            });
            map.on('move', scheduleDragFetch);
            map.on('moveend', () => scheduleMoveFetch(true));
            mapRef.current = map;
        }).catch(() => {
            if (!cancelled) {
                setMapLoadError('Nie udało się załadować biblioteki MapLibre.');
                setLoading(false);
                setMapReady(false);
            }
        });

        return () => {
            cancelled = true;
            stopTelemetryStream();
            publishLiveMapE2e(undefined);
            interpolatorRef.current?.cancel();
            popupRef.current?.remove();
            layersReadyRef.current = false;
            if (mapRef.current) {
                try {
                    mapRef.current.remove();
                } catch { /* */ }
            }
            mapRef.current = null;
        };
    }, [ensureMapLayers, scheduleMoveFetch, scheduleDragFetch, syncZoomUi, mapGeneration]);

    useEffect(() => {
        if (!isLiveMapE2eEnabled() || !mapReady) return;
        const map = mapRef.current;
        if (!map) return;
        const warsawCenter: [number, number] = [21.0122, 52.2297];
        publishLiveMapE2e({
            setZoom: (zoom, center) => {
                map.jumpTo({ zoom, center: center ?? warsawCenter, duration: 0 });
            },
            getZoom: () => map.getZoom(),
            getZoomMode: () => TIER_MODE_LABEL[resolveLiveMapTier(map.getZoom())],
            isReady: () => layersReadyRef.current && map.isStyleLoaded(),
        });
        return () => publishLiveMapE2e(undefined);
    }, [mapReady]);

    useEffect(() => {
        if (!mapReady || !canFetch || !tabVisible || liveFetchPaused) return;
        const loop = async () => {
            await fetchPositionsRef.current();
            const map = mapRef.current;
            const zoom = map ? map.getZoom() : DEFAULT_ZOOM;
            const delay = resolveLiveMapPollDelayWithStream({
                zoom,
                lastRefreshMs: lastRefreshRef.current,
                ingestEngaged,
                pollMultiplier: ingestPollMultRef.current,
                serverPollAfterMs: parsePollAfterMs(lastTelemetryMetaRef.current),
                consecutiveErrors: consecutiveErrorsRef.current,
                sseActive,
                streamIntervalMs: streamIntervalMsRef.current,
            });
            lastPollDelayRef.current = delay;
            pollTimerRef.current = setTimeout(loop, delay);
        };
        loop();
        return () => {
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
            pollTimerRef.current = null;
        };
    }, [fetchPositions, mapReady, canFetch, isAuthenticated, tabVisible, liveFetchPaused, ingestEngaged, consecutiveErrors, sseActive]);

    useEffect(() => {
        if (!mapReady || !canFetch || !tabVisible || liveFetchPaused) {
            stopTelemetryStream();
            return;
        }
        restartTelemetryStream();
        return () => stopTelemetryStream();
    }, [mapReady, canFetch, tabVisible, liveFetchPaused, restartTelemetryStream, stopTelemetryStream]);

    useEffect(() => {
        if (!sseActive || !mapReady || !canFetch || liveFetchPaused || !tabVisible) return;
        const check = () => {
            const streamMs = streamIntervalMsRef.current ?? 350;
            const staleLimit = resolveStaleAfterMs({
                pollDelayMs: lastPollDelayRef.current,
                lastLatencyMs: lastRefreshRef.current,
                sseActive: true,
                streamIntervalMs: streamMs,
            });
            const now = Date.now();
            const sinceStream = lastStreamAtRef.current != null
                ? now - lastStreamAtRef.current
                : Infinity;
            const sinceOk = lastSuccessAtRef.current != null
                ? now - lastSuccessAtRef.current
                : Infinity;
            const streamSilence = Math.max(streamMs * 12, 8_000);
            if (sinceStream > streamSilence || sinceOk > staleLimit) {
                restartTelemetryStream();
                fetchPositionsRef.current({ priority: true, snap: true });
            }
        };
        const id = setInterval(check, 4_000);
        return () => clearInterval(id);
    }, [sseActive, mapReady, canFetch, liveFetchPaused, tabVisible, restartTelemetryStream]);

    const retryMapLoad = useCallback(() => {
        setMapLoadError(null);
        mapHasLoadedRef.current = false;
        layersReadyRef.current = false;
        fitBoundsDoneRef.current = false;
        if (mapRef.current) {
            try {
                mapRef.current.remove();
            } catch { /* */ }
        }
        mapRef.current = null;
        setMapReady(false);
        setLoading(true);
        setMapGeneration((g) => g + 1);
    }, []);

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

    const staleAfterMs = resolveStaleAfterMs({
        pollDelayMs: lastPollDelayRef.current,
        lastLatencyMs: lastRefreshMs,
        sseActive,
        streamIntervalMs: streamIntervalMsRef.current,
    });

    return (
        <Box
            data-testid="live-map-root"
            data-map-ready={mapReady ? 'true' : 'false'}
            data-sync-status={computeLiveMapHealth({
                mapReady,
                canFetch,
                tabVisible,
                liveFetchPaused,
                ingestEngaged,
                lastSuccessAt,
                lastErrorAt: lastErrorAtRef.current,
                consecutiveErrors,
                lastLatencyMs: lastRefreshMs,
                meta: lastTelemetryMetaRef.current,
                staleAfterMs,
                cachedPositionCount: onlineCount,
            }).status}
            style={{ position: 'relative', width: '100%', height: '100%', minHeight: 450, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}
            role="region"
            aria-label="Live mapa telemetryczna — rowerzyści i biegacze w czasie rzeczywistym"
        >
            <Group style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10 }} justify="space-between" wrap="wrap">
                <Group gap="xs" aria-live="polite" aria-atomic="true">
                    <LiveMapFiltersBar
                        filters={filters}
                        onChange={(patch) => setFilters((f) => mergeFilters(f, patch))}
                        onSaveBookmark={handleSaveBookmark}
                        compact={filters.presentationMode}
                    />
                    <Tooltip label="Aktywni jeźdźcy na mapie (FSM, cała symulacja)">
                        <Badge variant="filled" color={onlineCount > 0 ? 'green' : 'gray'} radius="sm" size="md" leftSection={<Activity size={12} />}>
                            {(onlineCount ?? 0).toLocaleString()} active
                        </Badge>
                    </Tooltip>
                    {mapReady && (
                        <Tooltip label="Pozycje z ostatniego payloadu API (bbox). „On map” = features GeoJSON po filtrze współrzędnych. „Rendered” = widoczne piksele MapLibre.">
                            <Badge
                                variant="light"
                                color={viewportRiders > 0 ? 'blue' : 'gray'}
                                radius="sm"
                                size="md"
                                data-testid="live-map-viewport-count"
                            >
                                {viewportRiders.toLocaleString()} in view
                            </Badge>
                        </Tooltip>
                    )}
                    {!filters.presentationMode && mapReady && drawnOnMap > 0 && (
                        <Badge
                            variant="light"
                            color={drawnOnMap === viewportRiders ? 'green' : 'orange'}
                            radius="sm"
                            size="md"
                            data-testid="live-map-drawn-count"
                        >
                            {drawnOnMap.toLocaleString()} on map
                        </Badge>
                    )}
                    {!filters.presentationMode && mapReady && drawnOnMap > 0 && (
                        <Badge
                            variant="light"
                            color={
                                renderedOnMap === 0
                                    ? 'red'
                                    : renderedOnMap >= drawnOnMap
                                        ? 'green'
                                        : 'orange'
                            }
                            radius="sm"
                            size="md"
                            data-testid="live-map-rendered-count"
                        >
                            {renderedOnMap.toLocaleString()} rendered
                        </Badge>
                    )}
                    {flaggedCount > 0 && (
                        <Tooltip label="Podejrzane aktywności w viewport">
                            <Badge variant="light" color="red" radius="sm" size="md" leftSection={<AlertTriangle size={12} />}>
                                {flaggedCount} flagged
                            </Badge>
                        </Tooltip>
                    )}
                    {rideWarming > 0 && (
                        <Badge variant="light" color="yellow" radius="sm" size="md" title="PENDING_ROUTE + ROUTING (not on map yet)">
                            +{rideWarming.toLocaleString()} warming
                        </Badge>
                    )}
                    {cyclists > 0 && (
                        <Badge variant="light" color="violet" radius="sm" size="md">{cyclists} cyclists</Badge>
                    )}
                    {runners > 0 && (
                        <Badge variant="light" color="teal" radius="sm" size="md">{runners} runners</Badge>
                    )}
                    {!filters.presentationMode && mapReady && mapZoom != null && (
                        <Tooltip label="Aktualny poziom zoomu MapLibre (ułatwia debug warstw)">
                            <Badge
                                variant="outline"
                                color="indigo"
                                radius="sm"
                                size="sm"
                                style={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                                z {mapZoom.toFixed(1)}
                            </Badge>
                        </Tooltip>
                    )}
                    {zoomMode && mapReady && (
                        <Badge variant="outline" color="grape" radius="sm" size="sm" data-testid="live-map-zoom-mode">{zoomMode}</Badge>
                    )}
                    {!filters.presentationMode && fps > 0 && fps < 28 && (
                        <Badge variant="light" color="red" radius="sm" size="sm">{fps} FPS</Badge>
                    )}
                    {sseActive && !filters.presentationMode && (
                        <Tooltip label="SSE stream 200–500 ms (HTTP poll w tle co ~15 s)">
                            <Badge variant="light" color="cyan" radius="sm" size="sm" data-testid="live-map-sse-badge">
                                Stream
                            </Badge>
                        </Tooltip>
                    )}
                    {ingestEngaged && (
                        <Tooltip label="Ochrona ingest aktywna — mapa odświeża się rzadziej (ADR 011)">
                            <Badge variant="light" color="orange" radius="sm" size="sm">
                                Ingest load
                            </Badge>
                        </Tooltip>
                    )}
                    {!filters.presentationMode && lastRefreshMs != null && onlineCount > 0 && (
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
                <Group gap="xs">
                    <Tooltip label="Diagnostyka operatora (D)">
                        <ActionIcon
                            variant={diagnosticsOpen ? 'filled' : 'light'}
                            color="blue"
                            size="lg"
                            radius="md"
                            onClick={() => setDiagnosticsOpen((v) => !v)}
                            aria-label="Diagnostyka"
                        >
                            <Stethoscope size={18} />
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Toggle activity heatmap overlay (H)">
                        <ActionIcon
                            variant={showHeatmap ? 'filled' : 'light'}
                            color={showHeatmap ? 'orange' : 'gray'}
                            size="lg"
                            radius="md"
                            onClick={() => setShowHeatmap(!showHeatmap)}
                            loading={heatmapLoading}
                            aria-label="Heatmapa"
                        >
                            <Layers size={18} />
                        </ActionIcon>
                    </Tooltip>
                </Group>
            </Group>
            <LiveMapCapBanner meta={lastTelemetryMetaRef.current} />
            <LiveMapCityRankingPanel
                counts={cityCounts}
                bikeCounts={cityBikeCounts}
                runCounts={cityRunCounts}
                trend={cityTrend}
                onCityClick={flyToCity}
                visible={mapReady && resolveLiveMapTier(mapZoom ?? DEFAULT_ZOOM) === 'macro'}
            />
            {loading && <Skeleton height="100%" radius="md" style={{ position: 'absolute', inset: 0, zIndex: 5 }} />}
            <div
                ref={mapContainer}
                data-testid="live-map-canvas"
                role="application"
                aria-label="Interaktywna mapa MapLibre"
                tabIndex={0}
                style={{ width: '100%', height: '100%', cursor: 'grab' }}
            />
            <LiveMapStatusBar
                mapReady={mapReady}
                canFetch={canFetch}
                tabVisible={tabVisible}
                liveFetchPaused={liveFetchPaused}
                ingestEngaged={ingestEngaged}
                lastSuccessAt={lastSuccessAt}
                lastErrorAt={lastErrorAtRef.current}
                consecutiveErrors={consecutiveErrors}
                lastLatencyMs={lastRefreshMs}
                meta={lastTelemetryMetaRef.current}
                staleAfterMs={staleAfterMs}
                mapLoadError={mapLoadError}
                onRetryMap={retryMapLoad}
                onRetry={() => {
                    consecutiveErrorsRef.current = 0;
                    setConsecutiveErrors(0);
                    restartTelemetryStream();
                    fetchPositions({ priority: true, snap: true });
                }}
                cachedPositionCount={onlineCount}
            />
            {mapReady && mapZoom != null && (
                <Box
                    style={{
                        position: 'absolute',
                        bottom: 12,
                        left: 12,
                        zIndex: 10,
                        pointerEvents: 'none',
                        padding: '6px 10px',
                        borderRadius: 8,
                        background: 'rgba(24,24,27,0.88)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        backdropFilter: 'blur(6px)',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    }}
                >
                    <Text size="xs" c="gray.4" lh={1.2}>
                        zoom
                    </Text>
                    <Text
                        size="sm"
                        c="white"
                        fw={700}
                        data-testid="live-map-zoom-value"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                        {mapZoom.toFixed(1)}
                    </Text>
                    {zoomMode && (
                        <Text size="xs" c="indigo.3" mt={2}>
                            {zoomMode}
                        </Text>
                    )}
                </Box>
            )}
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
            <LiveMapReplayScrubber
                frameCount={replayFrameCount}
                index={replayIndex < 0 ? Math.max(0, replayFrameCount - 1) : replayIndex}
                playing={replayPlaying}
                onIndexChange={(n) => {
                    setReplayPlaying(false);
                    setReplayIndex(n);
                    const frame = replayBufferRef.current.frameAt(n);
                    if (frame) ingestPositionsRef.current(frame.positions, { snap: true });
                }}
                onTogglePlay={() => {
                    if (replayPlaying) {
                        setReplayPlaying(false);
                        setReplayIndex(-1);
                        fetchPositionsRef.current?.({ priority: true, snap: true });
                        return;
                    }
                    if (replayFrameCount < 2) return;
                    setReplayPlaying(true);
                    setReplayIndex(0);
                }}
                onClear={() => {
                    replayBufferRef.current.clear();
                    setReplayFrameCount(0);
                    setReplayIndex(-1);
                    setReplayPlaying(false);
                }}
            />
            <LiveMapDiagnosticsDrawer
                opened={diagnosticsOpen}
                onClose={() => setDiagnosticsOpen(false)}
                health={healthSnapshot}
                meta={lastTelemetryMetaRef.current}
                requestLog={requestLog}
                fps={fps}
                onCopyIncident={copyIncidentBundle}
            />
        </Box>
    );
};
