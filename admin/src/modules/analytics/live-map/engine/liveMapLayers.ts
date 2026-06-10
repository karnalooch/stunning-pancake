import type { LiveMapPosition } from './liveMapMarkers';
import { resolveActivityKind, speedToKmh } from './liveMapMarkers';
import { POLAND_SIM_CITIES } from './liveMapCities';
import { LIVE_MAP_TIER } from './liveMapEnterprise';
import {
    CLUSTER_CIRCLE_OPACITY_STOPS,
    CLUSTER_COUNT_OPACITY_STOPS,
    CITY_HUB_RING_OPACITY_STOPS,
    LIVE_MAP_LOD,
    zoomInterpolate,
} from './liveMapZoom';

import { ensureLiveMapSprites } from './liveMapSprite';
import { MAP_TEXT_FONT_BOLD, MAP_TEXT_FONT_REGULAR } from '../../../../core/map/mapBasemap';
import {
    activityKindColorExpression,
    clusterColorExpression,
    clusterRadiusExpression,
    defaultLiveMapTheme,
    type LiveMapTheme,
} from './liveMapTheme';
import type { PerformanceDegradeLevel } from './liveMapPerformance';
import { H3_LAYER, H3_SOURCE } from './liveMapH3Layer';
import { resolveLiveMapTier } from './liveMapEnterprise';
import { buildMesoClusterFeatureCollectionAsync } from './liveMapMesoClusters';

/** Bump when layer/source spec changes — triggers reinstall for stale browser sessions. */
export const LIVE_MAP_LAYER_VERSION = 10;
export const LIVE_MAP_LAYER_VERSION_KEY = 'live-map-layer-v';

export const LIVE_SOURCES = {
    positions: 'live-positions',
    mesoClusters: 'live-meso-clusters',
    cityHubs: 'live-city-hubs',
} as const;

export const LIVE_LAYERS = {
    clusters: 'live-clusters',
    clusterCount: 'live-cluster-count',
    directionDots: 'live-direction-dots',
    unclustered: 'live-unclustered',
    cityHubRing: 'live-city-hub-ring',
    cityHubCount: 'live-city-hub-count',
    cityHubSub: 'live-city-hub-sub',
    cityHubName: 'live-city-hub-name',
    /** Single micro symbol layer — icons + optional labels (no duplicate icon draw). */
    riderLabels: 'live-rider-labels',
} as const;

export type CityHubDataInput = {
    counts: Record<string, number>;
    bikeCounts?: Record<string, number>;
    runCounts?: Record<string, number>;
    trend?: Record<string, number>;
};

const CLUSTER_CLICK_LAYERS = [
    LIVE_LAYERS.clusters,
    LIVE_LAYERS.unclustered,
    LIVE_LAYERS.riderLabels,
];

const LOD = LIVE_MAP_LOD;

const ALL_LIVE_LAYER_IDS = Object.values(LIVE_LAYERS);

function riderLabelsIconOpacity(): unknown[] {
    return [
        'interpolate', ['linear'], ['zoom'],
        LOD.iconFadeInStart, LOD.iconMicroMinOpacity,
        LOD.iconFadeInEnd, LOD.iconMicroMinOpacity,
        LOD.labelFadeInStart, LOD.labelIconOpacityAtHandoff,
        LOD.labelFadeInEnd, 1,
    ];
}

function riderLabelsTextOpacity(): unknown[] {
    return [
        'interpolate', ['linear'], ['zoom'],
        LOD.labelFadeInStart, 0,
        LOD.labelFadeInEnd, 1,
    ];
}

/** Restore zoom-based paint after performance degrade is cleared. */
export function applyRiderLabelsPaint(
    map: { getLayer: (id: string) => unknown; setPaintProperty: (id: string, prop: string, value: unknown) => void },
    _theme: LiveMapTheme = defaultLiveMapTheme(),
): void {
    if (!map.getLayer(LIVE_LAYERS.riderLabels)) return;
    map.setPaintProperty(LIVE_LAYERS.riderLabels, 'icon-opacity', riderLabelsIconOpacity());
    map.setPaintProperty(LIVE_LAYERS.riderLabels, 'text-opacity', riderLabelsTextOpacity());
}

/** Auto-degrade: hide labels first, then symbol layer (keep GL dots). */
export function setMicroRiderDegrade(
    map: {
        getLayer: (id: string) => unknown;
        setLayoutProperty: (id: string, prop: string, value: unknown) => void;
        setPaintProperty: (id: string, prop: string, value: unknown) => void;
    },
    level: PerformanceDegradeLevel,
    theme: LiveMapTheme = defaultLiveMapTheme(),
): void {
    const id = LIVE_LAYERS.riderLabels;
    if (!map.getLayer(id)) return;
    if (level === 'symbols') {
        map.setLayoutProperty(id, 'visibility', 'none');
        return;
    }
    map.setLayoutProperty(id, 'visibility', 'visible');
    if (level === 'labels') {
        map.setPaintProperty(id, 'icon-opacity', riderLabelsIconOpacity());
        map.setPaintProperty(id, 'text-opacity', 0);
        return;
    }
    applyRiderLabelsPaint(map, theme);
}

export function needsLiveMapLayerReinstall(): boolean {
    if (typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem(LIVE_MAP_LAYER_VERSION_KEY) !== String(LIVE_MAP_LAYER_VERSION);
}

export function markLiveMapLayerInstalled(): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(LIVE_MAP_LAYER_VERSION_KEY, String(LIVE_MAP_LAYER_VERSION));
}

export function removeLiveMapLayers(map: {
    getLayer: (id: string) => unknown;
    removeLayer: (id: string) => void;
    getSource: (id: string) => unknown;
    removeSource: (id: string) => void;
}): void {
    for (const id of ALL_LIVE_LAYER_IDS) {
        try {
            if (map.getLayer(id)) map.removeLayer(id);
        } catch { /* */ }
    }
    for (const id of [...Object.values(LIVE_SOURCES), H3_SOURCE] as string[]) {
        try {
            if (map.getSource(id)) map.removeSource(id);
        } catch { /* */ }
    }
    try {
        if (map.getLayer(H3_LAYER)) map.removeLayer(H3_LAYER);
    } catch { /* */ }
}

function isValidLiveCoord(n: number): boolean {
    return Number.isFinite(n) && Math.abs(n) <= 180;
}

export function countLivePositionFeatures(positions: LiveMapPosition[]): number {
    return positionsToFeatures(positions).length;
}

function positionsToFeatures(positions: LiveMapPosition[]) {
    return positions
        .filter((p) => {
            if (!p.deviceId) return false;
            const lat = Number(p.lat);
            const lng = Number(p.lng);
            if (!isValidLiveCoord(lat) || !isValidLiveCoord(lng)) return false;
            return lat !== 0 || lng !== 0;
        })
        .map((pos) => {
            const lat = Number(pos.lat);
            const lng = Number(pos.lng);
            const speed = Number(pos.speed);
            const course = Number(pos.course);
            return {
            type: 'Feature' as const,
            geometry: {
                type: 'Point' as const,
                coordinates: [lng, lat] as [number, number],
            },
            properties: {
                deviceId: pos.deviceId,
                name: pos.name || `Athlete ${pos.deviceId}`,
                type: pos.type || '',
                kind: resolveActivityKind(pos.type),
                speed: Number.isFinite(speed) ? speed : 0,
                speedKmh: speedToKmh(Number.isFinite(speed) ? speed : 0),
                course: Number.isFinite(course) ? course : 0,
                ride_state: pos.ride_state || 'ACTIVE',
                flagged: Boolean(pos.flagged),
            },
        };
        });
}

function cityHubFeatures(input: CityHubDataInput) {
    const { counts, bikeCounts = {}, runCounts = {}, trend = {} } = input;
    return POLAND_SIM_CITIES.filter((city) => (counts[city.slug] ?? 0) > 0).map((city) => {
        const bike = bikeCounts[city.slug] ?? 0;
        const run = runCounts[city.slug] ?? 0;
        const tr = trend[city.slug] ?? 0;
        const trendLabel = tr > 0 ? `+${tr}` : tr < 0 ? String(tr) : '';
        return {
            type: 'Feature' as const,
            geometry: {
                type: 'Point' as const,
                coordinates: [city.lng, city.lat] as [number, number],
            },
            properties: {
                slug: city.slug,
                name: city.name,
                count: counts[city.slug] ?? 0,
                bike,
                run,
                trend: tr,
                sublabel: `${bike}B ${run}R${trendLabel ? ` ${trendLabel}` : ''}`,
                color: city.colors[0],
                color2: city.colors[1],
            },
        };
    });
}

export function installLiveMapLayers(
    map: {
        getSource: (id: string) => unknown;
        addSource: (id: string, spec: object) => void;
        addLayer: (spec: object, before?: string) => void;
        getLayer: (id: string) => unknown;
        removeLayer: (id: string) => void;
        on: (event: string, layer: string | string[], cb: (e: LiveMapClickEvent) => void) => void;
    },
    clusterRadius: number,
    handlers: {
        onClusterClick: (e: LiveMapClickEvent) => void;
        onRiderClick: (e: LiveMapClickEvent) => void;
        onCityHubClick?: (e: LiveMapClickEvent) => void;
        onClusterHover?: (html: string | null, lngLat?: { lng: number; lat: number }) => void;
        getClusterBreakdown?: (clusterId: number) => { bike: number; run: number } | null;
    },
    theme: LiveMapTheme = defaultLiveMapTheme(),
): void {
    const clusterColors = clusterColorExpression(theme);
    const setCursor = (cursor: string) => {
        const canvas = (map as { getCanvas?: () => HTMLCanvasElement }).getCanvas?.();
        if (canvas) canvas.style.cursor = cursor;
    };

    if (!map.getSource(LIVE_SOURCES.mesoClusters)) {
        map.addSource(LIVE_SOURCES.mesoClusters, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
        });
    }

    if (!map.getSource(LIVE_SOURCES.positions)) {
        map.addSource(LIVE_SOURCES.positions, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
        });

        map.addLayer({
            id: LIVE_LAYERS.clusters,
            type: 'circle',
            source: LIVE_SOURCES.mesoClusters,
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': clusterColors,
                'circle-radius': clusterRadiusExpression(),
                'circle-opacity': zoomInterpolate(...CLUSTER_CIRCLE_OPACITY_STOPS),
                'circle-stroke-width': [
                    'interpolate', ['linear'], ['zoom'],
                    7, 2, 11, 2.8, 13, 2.2,
                ],
                'circle-stroke-color': 'rgba(255,255,255,0.72)',
            },
        });

        map.addLayer({
            id: LIVE_LAYERS.clusterCount,
            type: 'symbol',
            source: LIVE_SOURCES.mesoClusters,
            filter: ['has', 'point_count'],
            layout: {
                'text-field': '{point_count_abbreviated}',
                'text-font': [...MAP_TEXT_FONT_BOLD],
                'text-size': [
                    'interpolate', ['linear'], ['zoom'],
                    7, 11, 10, 12.5, 12.5, 13.5,
                ],
                'text-allow-overlap': true,
                'text-ignore-placement': true,
            },
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': 'rgba(15,23,42,0.35)',
                'text-halo-width': 1.2,
                'text-opacity': zoomInterpolate(...CLUSTER_COUNT_OPACITY_STOPS),
            },
        });

        map.addLayer({
            id: LIVE_LAYERS.directionDots,
            type: 'symbol',
            source: LIVE_SOURCES.mesoClusters,
            filter: ['!', ['has', 'point_count']],
            layout: {
                'icon-image': 'live-icon-direction',
                'icon-size': [
                    'interpolate', ['linear'], ['zoom'],
                    11.5, 0.55, 12, 0.65,
                ],
                'icon-rotate': ['coalesce', ['get', 'course'], 0],
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
            },
            paint: {
                'icon-color': activityKindColorExpression(theme),
                'icon-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    LIVE_MAP_TIER.mesoMinZoom, 0.35,
                    11.2, 0.55,
                    11.8, 0.72,
                    LOD.dotFadeInStart - 0.1, 0.35,
                    LOD.dotFadeInStart, 0,
                ],
            },
        });

        map.addLayer({
            id: LIVE_LAYERS.unclustered,
            type: 'circle',
            source: LIVE_SOURCES.positions,
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    LIVE_MAP_TIER.mesoMinZoom - 0.001, 0,
                    LIVE_MAP_TIER.mesoMinZoom, 5,
                    LOD.dotFadeInStart - 0.15, 6,
                    LOD.dotFadeInStart, 0,
                    LOD.dotFadeInStart + 0.25, 5,
                    12.2, 8,
                    LOD.dotFadeInEnd, 7,
                    LOD.dotFadeOutStart, 6,
                    LOD.dotFadeOutEnd, 0,
                ],
                'circle-color': activityKindColorExpression(theme),
                'circle-stroke-width': [
                    'case', ['boolean', ['get', 'flagged'], false], 2.5, 1.5,
                ],
                'circle-stroke-color': [
                    'case', ['boolean', ['get', 'flagged'], false], '#ef4444', '#312e81',
                ],
                'circle-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    LIVE_MAP_TIER.mesoMinZoom - 0.001, 0,
                    LIVE_MAP_TIER.mesoMinZoom, 0.38,
                    LOD.dotFadeInStart - 0.15, 0.42,
                    LOD.dotFadeInStart, 0,
                    LOD.dotFadeInStart + 0.25, 0.35,
                    LOD.dotFadeInEnd, 0.82,
                    LOD.iconFadeInEnd, LOD.dotMicroMinOpacity,
                    LOD.dotFadeOutStart, LOD.dotMicroMinOpacity,
                    LOD.dotFadeOutEnd, 0,
                ],
            },
        });

        map.addLayer({
            id: LIVE_LAYERS.riderLabels,
            type: 'symbol',
            source: LIVE_SOURCES.positions,
            filter: ['!', ['has', 'point_count']],
            minzoom: LOD.iconMinZoom,
            layout: {
                'icon-image': [
                    'match', ['get', 'kind'],
                    'run', 'live-icon-run',
                    'bike', 'live-icon-bike',
                    'live-icon-bike',
                ],
                'icon-size': [
                    'interpolate', ['linear'], ['zoom'],
                    LOD.iconMinZoom, LOD.iconMicroMinSize,
                    13.5, 0.88,
                    15, 0.88,
                ],
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'text-field': [
                    'format',
                    ['get', 'name'], { 'font-scale': 1 },
                    '\n', {},
                    ['to-string', ['coalesce', ['get', 'speedKmh'], 0]], { 'font-scale': 0.92 },
                    ' km/h', { 'font-scale': 0.85 },
                ],
                'text-font': [...MAP_TEXT_FONT_REGULAR],
                'text-size': [
                    'interpolate', ['linear'], ['zoom'],
                    LOD.labelFadeInStart, 10,
                    14.5, 11.5,
                ],
                'text-offset': [0, -2.35],
                'text-anchor': 'top',
                'text-optional': true,
                'text-allow-overlap': false,
                'text-ignore-placement': false,
                'text-max-width': 14,
                'symbol-sort-key': ['-', ['coalesce', ['get', 'speed'], 0]],
            },
            paint: {
                'text-color': '#18181b',
                'text-halo-color': 'rgba(255,255,255,0.94)',
                'text-halo-width': 1.6,
                'icon-opacity': riderLabelsIconOpacity(),
                'text-opacity': riderLabelsTextOpacity(),
            },
        });

        map.on('click', LIVE_LAYERS.clusters, handlers.onClusterClick);
        map.on('click', [LIVE_LAYERS.unclustered, LIVE_LAYERS.riderLabels], handlers.onRiderClick);
        map.on('mouseenter', CLUSTER_CLICK_LAYERS, () => setCursor('pointer'));
        map.on('mouseleave', CLUSTER_CLICK_LAYERS, () => setCursor(''));

        if (handlers.onClusterHover) {
            const onClusterMove = (e: LiveMapClickEvent & {
                features?: Array<{ properties?: Record<string, unknown> }>;
            }) => {
                const f = e.features?.[0];
                const clusterId = f?.properties?.cluster_id;
                if (clusterId == null || !f?.properties?.point_count) {
                    handlers.onClusterHover?.(null);
                    return;
                }
                const total = Number(f.properties.point_count);
                const breakdown = handlers.getClusterBreakdown?.(Number(clusterId));
                if (breakdown) {
                    handlers.onClusterHover!(
                        `<strong>${total}</strong> w widoku<br/>${breakdown.bike} rower · ${breakdown.run} bieg`,
                        e.lngLat,
                    );
                } else {
                    handlers.onClusterHover!(
                        `<strong>${total}</strong> w widoku`,
                        e.lngLat,
                    );
                }
            };
            map.on('mousemove', LIVE_LAYERS.clusters, onClusterMove as (e: LiveMapClickEvent) => void);
            map.on('mouseleave', LIVE_LAYERS.clusters, () => handlers.onClusterHover?.(null));
        }
    }

    if (!map.getSource(LIVE_SOURCES.cityHubs)) {
        map.addSource(LIVE_SOURCES.cityHubs, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
        });

        map.addLayer({
            id: LIVE_LAYERS.cityHubRing,
            type: 'circle',
            source: LIVE_SOURCES.cityHubs,
            minzoom: LOD.cityHubMin,
            maxzoom: LOD.cityHubFadeOutEnd,
            paint: {
                'circle-radius': [
                    '*',
                    ['interpolate', ['linear'], ['get', 'count'],
                        1, 16, 8, 20, 20, 24, 50, 30, 120, 36,
                    ],
                    zoomInterpolate([5, 1], [LOD.cityHubFadeOutEnd, 1.3]),
                ],
                'circle-color': ['get', 'color'],
                'circle-opacity': zoomInterpolate(...CITY_HUB_RING_OPACITY_STOPS),
                'circle-stroke-width': 2.8,
                'circle-stroke-color': 'rgba(255,255,255,0.92)',
            },
        });

        map.addLayer({
            id: LIVE_LAYERS.cityHubCount,
            type: 'symbol',
            source: LIVE_SOURCES.cityHubs,
            minzoom: LOD.cityHubMin,
            maxzoom: LOD.cityHubFadeOutEnd,
            layout: {
                'text-field': ['to-string', ['get', 'count']],
                'text-font': [...MAP_TEXT_FONT_BOLD],
                'text-size': [
                    'interpolate', ['linear'], ['zoom'],
                    LOD.cityHubMin, 10,
                    5, 11,
                    8, 13,
                    9.5, 14,
                ],
            },
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': 'rgba(15,23,42,0.4)',
                'text-halo-width': 1.2,
                'text-opacity': zoomInterpolate(
                    [LOD.cityHubMin, 0.6],
                    [LOD.cityHubFadeInEnd, 0.9],
                    [8, 1],
                    [LOD.cityHubFadeOutStart, 0.92],
                    [LOD.cityHubFadeOutEnd, 0],
                ),
            },
        });

        map.addLayer({
            id: LIVE_LAYERS.cityHubSub,
            type: 'symbol',
            source: LIVE_SOURCES.cityHubs,
            minzoom: LOD.cityHubFadeInEnd,
            maxzoom: LOD.cityHubFadeOutEnd,
            layout: {
                'text-field': ['get', 'sublabel'],
                'text-font': [...MAP_TEXT_FONT_REGULAR],
                'text-size': 9,
                'text-offset': [0, 1.35],
                'text-anchor': 'top',
            },
            paint: {
                'text-color': '#52525b',
                'text-halo-color': 'rgba(255,255,255,0.85)',
                'text-halo-width': 1,
                'text-opacity': zoomInterpolate(
                    [7, 0.5],
                    [8.5, 0.9],
                    [LOD.cityHubFadeOutStart, 0.88],
                    [LOD.cityHubFadeOutEnd, 0],
                ),
            },
        });

        map.addLayer({
            id: LIVE_LAYERS.cityHubName,
            type: 'symbol',
            source: LIVE_SOURCES.cityHubs,
            minzoom: LOD.cityHubMin + 0.5,
            maxzoom: LOD.cityHubFadeOutEnd,
            layout: {
                'text-field': ['get', 'name'],
                'text-font': [...MAP_TEXT_FONT_REGULAR],
                'text-size': [
                    'interpolate', ['linear'], ['zoom'],
                    6.8, 10,
                    8.5, 11.5,
                    9.5, 12,
                ],
                'text-offset': [0, 2.1],
                'text-anchor': 'top',
            },
            paint: {
                'text-color': '#27272a',
                'text-halo-color': 'rgba(255,255,255,0.9)',
                'text-halo-width': 1.4,
                'text-opacity': zoomInterpolate(
                    [LOD.cityHubMin + 0.5, 0],
                    [LOD.cityHubFadeInEnd + 0.3, 0.65],
                    [8.5, 1],
                    [LOD.cityHubFadeOutStart, 0.9],
                    [LOD.cityHubFadeOutEnd, 0],
                ),
            },
        });

        if (handlers.onCityHubClick) {
            const hubLayers = [LIVE_LAYERS.cityHubRing, LIVE_LAYERS.cityHubCount];
            map.on('click', hubLayers, handlers.onCityHubClick);
            map.on('mouseenter', hubLayers, () => setCursor('pointer'));
            map.on('mouseleave', hubLayers, () => setCursor(''));
        }
    }

    try {
        if (map.getLayer('live-dots')) map.removeLayer('live-dots');
        if (map.getLayer('live-rider-icons')) map.removeLayer('live-rider-icons');
    } catch { /* legacy */ }

    markLiveMapLayerInstalled();
}

export type LiveMapClickEvent = {
    point: { x: number; y: number };
    lngLat: { lng: number; lat: number };
};

type LiveMapDataHost = {
    getZoom?: () => number;
    getBounds?: () => { getWest: () => number; getSouth: () => number; getEast: () => number; getNorth: () => number };
    getSource: (id: string) => { setData?: (d: object) => void; loaded?: () => boolean } | undefined;
    isSourceLoaded?: (id: string) => boolean;
    triggerRepaint?: () => void;
    once?: (event: string, cb: (...args: unknown[]) => void) => void;
};

function mapBbox(map: LiveMapDataHost): [number, number, number, number] | undefined {
    try {
        const b = map.getBounds?.();
        if (b) return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    } catch { /* */ }
    return undefined;
}

function afterSourcePaint(
    map: LiveMapDataHost,
    sourceId: string,
    commit: () => void,
    onDone?: () => void,
): void {
    const fire = () => onDone?.();
    const run = () => {
        commit();
        map.triggerRepaint?.();
        if (typeof map.once === 'function') {
            map.once('idle', fire);
        } else {
            fire();
        }
    };
    const src = map.getSource(sourceId);
    if (map.isSourceLoaded?.(sourceId) || src?.loaded?.()) {
        run();
    } else if (typeof map.once === 'function') {
        map.once('sourcedata', (e: unknown) => {
            const ev = e as { sourceId?: string; isSourceLoaded?: boolean };
            if (ev.sourceId === sourceId && ev.isSourceLoaded) run();
        });
    } else {
        run();
    }
}

let mesoClusterGen = 0;

function applyMesoPayload(
    map: LiveMapDataHost,
    mesoPayload: GeoJSON.FeatureCollection,
    opts?: { onPositionsSet?: () => void; mesoOnly?: boolean },
): void {
    const mesoSource = map.getSource(LIVE_SOURCES.mesoClusters);
    if (!mesoSource?.setData) return;
    afterSourcePaint(
        map,
        LIVE_SOURCES.mesoClusters,
        () => mesoSource.setData!(mesoPayload),
        opts?.onPositionsSet,
    );
}

function commitPositionsOnly(
    map: LiveMapDataHost,
    positions: LiveMapPosition[],
    opts?: { onPositionsSet?: () => void },
): void {
    const posSource = map.getSource(LIVE_SOURCES.positions);
    if (!posSource?.setData) return;
    const payload = { type: 'FeatureCollection', features: positionsToFeatures(positions) };
    afterSourcePaint(
        map,
        LIVE_SOURCES.positions,
        () => posSource.setData!(payload),
        opts?.onPositionsSet,
    );
}

function commitMesoClusters(
    map: LiveMapDataHost,
    positions: LiveMapPosition[],
    opts?: { onPositionsSet?: () => void; mesoOnly?: boolean },
): void {
    const zoom = map.getZoom?.() ?? 10;
    const tier = resolveLiveMapTier(zoom);

    if (tier === 'micro') {
        if (opts?.mesoOnly) return;
        commitPositionsOnly(map, positions, opts);
        return;
    }

    const bbox = mapBbox(map);
    const gen = ++mesoClusterGen;
    void buildMesoClusterFeatureCollectionAsync(positions, zoom, bbox).then((mesoPayload) => {
        if (gen !== mesoClusterGen) return;
        if (opts?.mesoOnly) {
            applyMesoPayload(map, mesoPayload, opts);
            return;
        }
        commitPositionsOnly(map, positions, {
            onPositionsSet: () => {
                mesoSourceSetData(map, mesoPayload);
                opts?.onPositionsSet?.();
            },
        });
    });
}

function mesoSourceSetData(map: LiveMapDataHost, mesoPayload: GeoJSON.FeatureCollection): void {
    map.getSource(LIVE_SOURCES.mesoClusters)?.setData?.(mesoPayload);
}

/** Meso-only recluster — no HTTP, no live-positions setData. */
export function updateMesoClustersOnly(
    map: LiveMapDataHost,
    positions: LiveMapPosition[],
    opts?: { onPositionsSet?: () => void },
): void {
    commitMesoClusters(map, positions, { ...opts, mesoOnly: true });
}

export function setLivePositionsData(
    map: LiveMapDataHost,
    positions: LiveMapPosition[],
    opts?: { onPositionsSet?: () => void; mesoOnly?: boolean },
): void {
    if (!opts?.mesoOnly) {
        const posSource = map.getSource(LIVE_SOURCES.positions);
        if (!posSource?.setData) return;
    }
    commitMesoClusters(map, positions, opts);
}

export function setCityHubData(
    map: { getSource: (id: string) => { setData?: (d: object) => void } | undefined },
    input: CityHubDataInput | Record<string, number>,
): void {
    const payload: CityHubDataInput = typeof input === 'object' && 'counts' in input
        ? input as CityHubDataInput
        : { counts: input };
    const source = map.getSource(LIVE_SOURCES.cityHubs);
    source?.setData?.({
        type: 'FeatureCollection',
        features: cityHubFeatures(payload),
    });
}

export async function prepareLiveMapStyle(map: Parameters<typeof ensureLiveMapSprites>[0]): Promise<void> {
    await ensureLiveMapSprites(map);
}
