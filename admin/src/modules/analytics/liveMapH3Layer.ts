import type { LiveMapTheme } from './liveMapTheme';
import { defaultLiveMapTheme } from './liveMapTheme';
import { resolveLiveMapTier } from './liveMapEnterprise';
import { isPlaywrightE2eSession } from '../../core/auth/e2eEnv';

export const H3_SOURCE = 'live-h3-cells';
export const H3_LAYER = 'live-h3-cells-fill';

export const MESO_RIDER_LAYERS = [
    'live-clusters',
    'live-cluster-count',
    'live-direction-dots',
] as const;

export const MICRO_RIDER_LAYERS = [
    'live-unclustered',
    'live-rider-icons',
    'live-rider-labels',
] as const;

const ALL_RIDER_LAYERS = [...MESO_RIDER_LAYERS, ...MICRO_RIDER_LAYERS];

export function layerVisibilityForRenderMode(
    layerId: string,
    mode: 'points' | 'clusters' | 'aggregate',
    zoom?: number,
): boolean {
    if (mode === 'aggregate') {
        return false;
    }
    const tier = zoom != null ? resolveLiveMapTier(zoom) : null;
    if (tier === 'macro') {
        return false;
    }
    const isMicroLayer = (MICRO_RIDER_LAYERS as readonly string[]).includes(layerId);
    const isMesoLayer = (MESO_RIDER_LAYERS as readonly string[]).includes(layerId);

    if (isMesoLayer) {
        return tier === null || tier === 'meso';
    }
    if (isMicroLayer) {
        return tier === 'micro';
    }
    return false;
}

export function installH3Layer(
    map: {
        getSource: (id: string) => unknown;
        addSource: (id: string, spec: object) => void;
        addLayer: (spec: object, before?: string) => void;
    },
    theme: LiveMapTheme = defaultLiveMapTheme(),
): void {
    if (!map.getSource(H3_SOURCE)) {
        map.addSource(H3_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
            id: H3_LAYER,
            source: H3_SOURCE,
            type: 'fill',
            paint: {
                'fill-color': theme.h3Fill,
                'fill-opacity': [
                    'interpolate', ['linear'], ['get', 'weight'],
                    0, 0.12,
                    0.25, 0.28,
                    0.5, 0.42,
                    1, 0.62,
                ],
                'fill-outline-color': theme.h3Stroke,
            },
        });
    }
}

export function setH3CellData(
    map: { getSource: (id: string) => { setData?: (d: object) => void } | null },
    geojson: { type: string; features: unknown[] },
): void {
    const src = map.getSource(H3_SOURCE);
    src?.setData?.(geojson);
}

export function setLiveMapRenderMode(
    map: {
        getLayer: (id: string) => unknown;
        setLayoutProperty: (id: string, prop: string, value: unknown) => void;
    },
    mode: 'points' | 'clusters' | 'aggregate',
    zoom?: number,
): void {
    const showH3 = mode === 'aggregate';

    const e2eVis: Record<string, string> = {};
    for (const id of ALL_RIDER_LAYERS) {
        const visible = layerVisibilityForRenderMode(id, mode, zoom);
        e2eVis[id] = visible ? 'visible' : 'none';
        if (!map.getLayer(id)) continue;
        map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
    if (map.getLayer(H3_LAYER)) {
        map.setLayoutProperty(H3_LAYER, 'visibility', showH3 ? 'visible' : 'none');
        e2eVis[H3_LAYER] = showH3 ? 'visible' : 'none';
    }
    if (isPlaywrightE2eSession() && typeof window !== 'undefined') {
        (window as Window & { __liveMapLayerVis?: Record<string, string> }).__liveMapLayerVis = e2eVis;
    }
}
