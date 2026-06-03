import type { LiveMapPosition } from './liveMapMarkers';
import { resolveActivityKind, speedToKmh } from './liveMapMarkers';
import { POLAND_SIM_CITIES } from './liveMapCities';
import { CLUSTER_MAX_ZOOM, LIVE_MAP_LOD } from './liveMapZoom';
import { ensureLiveMapSprites } from './liveMapSprite';
import { MAP_TEXT_FONT_BOLD, MAP_TEXT_FONT_REGULAR } from '../../core/map/mapBasemap';

export const LIVE_SOURCES = {
    positions: 'live-positions',
    cityHubs: 'live-city-hubs',
} as const;

export const LIVE_LAYERS = {
    clusters: 'live-clusters',
    clusterCount: 'live-cluster-count',
    unclustered: 'live-unclustered',
    cityHubRing: 'live-city-hub-ring',
    cityHubCount: 'live-city-hub-count',
    cityHubName: 'live-city-hub-name',
    riderIcons: 'live-rider-icons',
    riderLabels: 'live-rider-labels',
} as const;

const CLUSTER_CLICK_LAYERS = [
    LIVE_LAYERS.clusters,
    LIVE_LAYERS.unclustered,
    LIVE_LAYERS.riderIcons,
];

const LOD = LIVE_MAP_LOD;

function positionsToFeatures(positions: LiveMapPosition[]) {
    return positions
        .filter((p) => p.lat && p.lng && p.deviceId)
        .map((pos) => ({
            type: 'Feature' as const,
            geometry: {
                type: 'Point' as const,
                coordinates: [pos.lng, pos.lat] as [number, number],
            },
            properties: {
                deviceId: pos.deviceId,
                name: pos.name || `Athlete ${pos.deviceId}`,
                type: pos.type || '',
                kind: resolveActivityKind(pos.type),
                speed: pos.speed ?? 0,
                speedKmh: speedToKmh(pos.speed ?? 0),
                course: pos.course ?? 0,
                ride_state: pos.ride_state || 'ACTIVE',
            },
        }));
}

function cityHubFeatures(counts: Record<string, number>) {
    return POLAND_SIM_CITIES.map((city) => ({
        type: 'Feature' as const,
        geometry: {
            type: 'Point' as const,
            coordinates: [city.lng, city.lat] as [number, number],
        },
        properties: {
            slug: city.slug,
            name: city.name,
            count: counts[city.slug] ?? 0,
            color: city.colors[0],
            color2: city.colors[1],
        },
    }));
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
    },
): void {
    if (!map.getSource(LIVE_SOURCES.positions)) {
        map.addSource(LIVE_SOURCES.positions, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
            cluster: true,
            clusterMaxZoom: CLUSTER_MAX_ZOOM,
            clusterRadius,
        });

        map.addLayer({
            id: LIVE_LAYERS.clusters,
            type: 'circle',
            source: LIVE_SOURCES.positions,
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': [
                    'interpolate', ['linear'], ['get', 'point_count'],
                    2, '#06b6d4', 12, '#6366f1', 35, '#a855f7', 70, '#ec4899', 120, '#e11d48',
                ],
                'circle-radius': [
                    'interpolate', ['linear'], ['get', 'point_count'],
                    2, 24, 8, 28, 25, 34, 50, 40, 100, 48,
                ],
                'circle-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    LOD.clusterVisibleStart, 0.32,
                    8, 0.72,
                    10.5, 0.88,
                    LOD.clusterPeakEnd, 0.94,
                    LOD.clusterFadeOutEnd - 1.2, 0.62,
                    LOD.clusterFadeOutEnd, 0,
                ],
                'circle-stroke-width': [
                    'interpolate', ['linear'], ['zoom'],
                    7, 2, 11, 2.8, 13, 2.2,
                ],
                'circle-stroke-color': 'rgba(255,255,255,0.72)',
                'circle-blur': 0.08,
            },
        });

        map.addLayer({
            id: LIVE_LAYERS.clusterCount,
            type: 'symbol',
            source: LIVE_SOURCES.positions,
            filter: ['has', 'point_count'],
            layout: {
                'text-field': ['get', 'point_count_abbreviated'],
                'text-font': [...MAP_TEXT_FONT_BOLD],
                'text-size': [
                    'interpolate', ['linear'], ['zoom'],
                    7, 11, 10, 12.5, 12.5, 13.5,
                ],
            },
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': 'rgba(15,23,42,0.35)',
                'text-halo-width': 1.2,
                'text-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    LOD.clusterVisibleStart, 0.45,
                    9, 0.92,
                    LOD.clusterPeakEnd, 1,
                    LOD.clusterFadeOutEnd - 0.8, 0.55,
                    LOD.clusterFadeOutEnd, 0,
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
                    LOD.dotFadeInStart, 4,
                    LOD.dotFadeInEnd, 7.5,
                    LOD.dotFadeOutStart, 7,
                    LOD.dotFadeOutEnd, 0,
                ],
                'circle-color': [
                    'match', ['get', 'kind'],
                    'run', '#059669',
                    'bike', '#6d28d9',
                    '#4f46e5',
                ],
                'circle-stroke-width': [
                    'interpolate', ['linear'], ['zoom'],
                    LOD.dotFadeInEnd, 1.8,
                    12.5, 2.2,
                    LOD.dotFadeOutEnd, 0,
                ],
                'circle-stroke-color': '#1e1b4b',
                'circle-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    LOD.dotFadeInStart, 0,
                    LOD.dotFadeInEnd, 0.78,
                    LOD.dotFadeOutStart, 0.72,
                    LOD.dotFadeOutEnd, 0,
                ],
            },
        });

        map.addLayer({
            id: LIVE_LAYERS.riderIcons,
            type: 'symbol',
            source: LIVE_SOURCES.positions,
            filter: ['!', ['has', 'point_count']],
            minzoom: LOD.iconMinZoom,
            maxzoom: LOD.iconMaxZoom,
            layout: {
                'icon-image': [
                    'match', ['get', 'kind'],
                    'run', 'live-icon-run',
                    'bike', 'live-icon-bike',
                    'live-icon-bike',
                ],
                'icon-size': [
                    'interpolate', ['linear'], ['zoom'],
                    LOD.iconFadeInStart, 0.52,
                    12.5, 0.68,
                    13.2, 0.78,
                    14, 0.88,
                ],
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'symbol-sort-key': ['-', ['coalesce', ['get', 'speed'], 0]],
            },
            paint: {
                'icon-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    LOD.iconFadeInStart, 0,
                    LOD.iconFadeInEnd, 0.88,
                    LOD.iconFadeOutStart, 0.92,
                    LOD.iconFadeOutEnd, 0,
                ],
            },
        });

        map.addLayer({
            id: LIVE_LAYERS.riderLabels,
            type: 'symbol',
            source: LIVE_SOURCES.positions,
            filter: ['!', ['has', 'point_count']],
            minzoom: LOD.labelMinZoom,
            layout: {
                'icon-image': [
                    'match', ['get', 'kind'],
                    'run', 'live-icon-run',
                    'bike', 'live-icon-bike',
                    'live-icon-bike',
                ],
                'icon-size': [
                    'interpolate', ['linear'], ['zoom'],
                    LOD.labelFadeInStart, 0.64,
                    14, 0.86,
                    15.5, 0.92,
                ],
                'icon-allow-overlap': false,
                'icon-ignore-placement': false,
                'text-field': [
                    'format',
                    ['get', 'name'], { 'font-scale': 1 },
                    '\n', {},
                    ['to-string', ['get', 'speedKmh']], { 'font-scale': 0.92 },
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
                'icon-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    LOD.labelFadeInStart, 0.35,
                    LOD.labelFadeInEnd, 1,
                ],
                'text-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    LOD.labelFadeInStart, 0,
                    LOD.labelFadeInEnd, 1,
                ],
            },
        });

        map.on('click', LIVE_LAYERS.clusters, handlers.onClusterClick);
        map.on('click', [LIVE_LAYERS.unclustered, LIVE_LAYERS.riderIcons, LIVE_LAYERS.riderLabels], handlers.onRiderClick);
        const setCursor = (cursor: string) => {
            const canvas = (map as { getCanvas?: () => HTMLCanvasElement }).getCanvas?.();
            if (canvas) canvas.style.cursor = cursor;
        };
        map.on('mouseenter', CLUSTER_CLICK_LAYERS, () => setCursor('pointer'));
        map.on('mouseleave', CLUSTER_CLICK_LAYERS, () => setCursor(''));
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
                    'interpolate', ['linear'], ['zoom'],
                    LOD.cityHubMin, 18,
                    7.5, 22,
                    9, 26,
                    LOD.cityHubFadeOutStart, 24,
                ],
                'circle-color': ['get', 'color'],
                'circle-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    LOD.cityHubMin, 0,
                    LOD.cityHubFadeInEnd, 0.72,
                    8.2, 0.95,
                    LOD.cityHubFadeOutStart, 0.88,
                    LOD.cityHubFadeOutEnd, 0,
                ],
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
                    LOD.cityHubMin, 11,
                    8, 13,
                    9.5, 14,
                ],
            },
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': 'rgba(15,23,42,0.4)',
                'text-halo-width': 1.2,
                'text-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    LOD.cityHubMin, 0,
                    LOD.cityHubFadeInEnd, 0.75,
                    8.2, 1,
                    LOD.cityHubFadeOutStart, 0.9,
                    LOD.cityHubFadeOutEnd, 0,
                ],
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
                'text-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    LOD.cityHubMin + 0.5, 0,
                    LOD.cityHubFadeInEnd + 0.3, 0.65,
                    8.5, 1,
                    LOD.cityHubFadeOutStart, 0.85,
                    LOD.cityHubFadeOutEnd, 0,
                ],
            },
        });
    }

    try {
        if (map.getLayer('live-dots')) map.removeLayer('live-dots');
    } catch { /* legacy */ }
}

export type LiveMapClickEvent = {
    point: { x: number; y: number };
    lngLat: { lng: number; lat: number };
};

export function setLivePositionsData(
    map: { getSource: (id: string) => { setData?: (d: object) => void } | undefined },
    positions: LiveMapPosition[],
): void {
    const source = map.getSource(LIVE_SOURCES.positions);
    source?.setData?.({
        type: 'FeatureCollection',
        features: positionsToFeatures(positions),
    });
}

export function setCityHubData(
    map: { getSource: (id: string) => { setData?: (d: object) => void } | undefined },
    counts: Record<string, number>,
): void {
    const source = map.getSource(LIVE_SOURCES.cityHubs);
    source?.setData?.({
        type: 'FeatureCollection',
        features: cityHubFeatures(counts),
    });
}

export async function prepareLiveMapStyle(map: Parameters<typeof ensureLiveMapSprites>[0]): Promise<void> {
    await ensureLiveMapSprites(map);
}
