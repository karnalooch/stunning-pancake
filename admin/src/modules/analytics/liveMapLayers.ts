import type { LiveMapPosition } from './liveMapMarkers';
import { resolveActivityKind, speedToKmh } from './liveMapMarkers';
import { POLAND_SIM_CITIES } from './liveMapCities';
import { CLUSTER_MAX_ZOOM } from './liveMapZoom';
import { ensureLiveMapSprites } from './liveMapSprite';

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
                    2, '#22d3ee', 15, '#8b5cf6', 40, '#ec4899', 80, '#f43f5e',
                ],
                'circle-radius': [
                    'interpolate', ['linear'], ['get', 'point_count'],
                    2, 22, 10, 28, 30, 36, 60, 44,
                ],
                'circle-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    6.5, 0.42, 8.5, 0.82, 11.8, 0.94, 12.6, 0.55, 13.2, 0,
                ],
                'circle-stroke-width': 2.5,
                'circle-stroke-color': 'rgba(255,255,255,0.55)',
                'circle-blur': 0.12,
            },
        });

        map.addLayer({
            id: LIVE_LAYERS.clusterCount,
            type: 'symbol',
            source: LIVE_SOURCES.positions,
            filter: ['has', 'point_count'],
            layout: {
                'text-field': ['get', 'point_count_abbreviated'],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 13,
            },
            paint: {
                'text-color': '#ffffff',
                'text-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    6.5, 0.5, 11.8, 1, 13, 0,
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
                    7, 5, 9, 7, 11, 8, 12.2, 7, 13, 0,
                ],
                'circle-color': [
                    'match', ['get', 'kind'],
                    'run', '#10b981',
                    'bike', '#7c3aed',
                    '#6366f1',
                ],
                'circle-stroke-width': 1.5,
                'circle-stroke-color': '#312e81',
                'circle-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    7, 0.35, 11.2, 0.82, 12.4, 0.7, 12.8, 0.35, 13.2, 0,
                ],
            },
        });

        map.addLayer({
            id: LIVE_LAYERS.riderIcons,
            type: 'symbol',
            source: LIVE_SOURCES.positions,
            filter: ['!', ['has', 'point_count']],
            minzoom: 11.8,
            maxzoom: 13.45,
            layout: {
                'icon-image': [
                    'match', ['get', 'kind'],
                    'run', 'live-icon-run',
                    'bike', 'live-icon-bike',
                    'live-icon-bike',
                ],
                'icon-size': [
                    'interpolate', ['linear'], ['zoom'],
                    12, 0.5, 13.5, 0.72, 15, 0.88,
                ],
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'symbol-sort-key': ['-', ['coalesce', ['get', 'speed'], 0]],
            },
            paint: {
                'icon-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    11.8, 0.15, 12.2, 0.75, 12.6, 0.95, 13.2, 0.85,
                ],
            },
        });

        map.addLayer({
            id: LIVE_LAYERS.riderLabels,
            type: 'symbol',
            source: LIVE_SOURCES.positions,
            filter: ['!', ['has', 'point_count']],
            minzoom: 13.35,
            layout: {
                'icon-image': [
                    'match', ['get', 'kind'],
                    'run', 'live-icon-run',
                    'bike', 'live-icon-bike',
                    'live-icon-bike',
                ],
                'icon-size': [
                    'interpolate', ['linear'], ['zoom'],
                    13.5, 0.68, 15, 0.88,
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
                'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
                'text-size': 11,
                'text-offset': [0, -2.4],
                'text-anchor': 'top',
                'text-optional': true,
                'text-allow-overlap': false,
                'text-ignore-placement': false,
                'text-max-width': 14,
                'symbol-sort-key': ['-', ['coalesce', ['get', 'speed'], 0]],
            },
            paint: {
                'text-color': '#18181b',
                'text-halo-color': 'rgba(255,255,255,0.92)',
                'text-halo-width': 1.4,
                'icon-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    13.3, 0.5, 13.55, 1,
                ],
                'text-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    13.35, 0, 13.7, 1,
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
            maxzoom: 10,
            paint: {
                'circle-radius': 22,
                'circle-color': ['get', 'color'],
                'circle-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    6, 0.65, 8.5, 1, 9.5, 0,
                ],
                'circle-stroke-width': 2.5,
                'circle-stroke-color': 'rgba(255,255,255,0.9)',
            },
        });

        map.addLayer({
            id: LIVE_LAYERS.cityHubCount,
            type: 'symbol',
            source: LIVE_SOURCES.cityHubs,
            maxzoom: 10,
            layout: {
                'text-field': ['to-string', ['get', 'count']],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 13,
            },
            paint: {
                'text-color': '#ffffff',
                'text-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    6, 0.7, 8.5, 1, 9.5, 0,
                ],
            },
        });

        map.addLayer({
            id: LIVE_LAYERS.cityHubName,
            type: 'symbol',
            source: LIVE_SOURCES.cityHubs,
            maxzoom: 10,
            layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
                'text-size': 11,
                'text-offset': [0, 2.2],
                'text-anchor': 'top',
            },
            paint: {
                'text-color': '#3f3f46',
                'text-halo-color': 'rgba(255,255,255,0.85)',
                'text-halo-width': 1.2,
                'text-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    6.5, 0.6, 8.5, 1, 9.5, 0,
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
